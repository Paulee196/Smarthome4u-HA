"""Normalizovaný model domácnosti.

Není to druhá kopie pravdy. Je to pohled na aktuální stav Home Assistantu,
který se dá kdykoliv zahodit a postavit znovu.

Persistentní identitou entity je registry ID, ne entity_id. Uživatel může
entity_id kdykoliv změnit a nesmí tím nic rozbít.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from . import capability

_LOGGER = logging.getLogger(__name__)

# Pořadí, v jakém se zobrazují schopnosti v místnosti.
KIND_ORDER = {
    "light": 0,
    "switch": 1,
    "cover": 2,
    "climate": 3,
    "lock": 4,
    "fan": 5,
    "media_player": 6,
    "number": 7,
    "select": 8,
    "button": 9,
    "binary_sensor": 10,
    "sensor": 11,
    "presence": 12,
    "scene": 20,
    "script": 21,
    "automation": 22,
    "unsupported": 99,
}

# Schopnosti, které nepatří na dashboard místnosti - mají vlastní sekci.
SECTION_KINDS = frozenset({"scene", "script", "automation"})

# Atributy, které frontend potřebuje pro ovládání a zobrazení stavu.
FORWARDED_ATTRIBUTES = (
    "brightness",
    "color_temp_kelvin",
    "rgb_color",
    "current_position",
    "current_tilt_position",
    "current_temperature",
    "temperature",
    "hvac_action",
    "preset_mode",
    "percentage",
    "unit_of_measurement",
    "volume_level",
    "media_title",
    "last_triggered",
)


@dataclass(slots=True)
class Entity:
    """Jedna funkce zařízení."""

    entity_id: str
    registry_id: str | None
    name: str
    domain: str
    device_class: str | None
    area_id: str | None
    device_id: str | None
    entity_category: str | None
    platform: str | None = None
    state: str = "unavailable"
    attributes: dict[str, Any] = field(default_factory=dict)
    capability: dict[str, Any] = field(default_factory=dict)

    @property
    def available(self) -> bool:
        return self.state not in ("unavailable", "unknown")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.entity_id,
            "ref": self.registry_id,
            "name": self.name,
            "domain": self.domain,
            "deviceClass": self.device_class,
            "deviceId": self.device_id,
            "areaId": self.area_id,
            "state": self.state,
            "available": self.available,
            "capability": self.capability,
            "attributes": {
                key: self.attributes[key]
                for key in FORWARDED_ATTRIBUTES
                if key in self.attributes
            },
        }


@dataclass(slots=True)
class Device:
    device_id: str
    name: str
    manufacturer: str | None
    model: str | None
    area_id: str | None
    config_entry_id: str | None
    via_device_id: str | None

    def to_dict(self, integration: str | None = None) -> dict[str, Any]:
        return {
            "id": self.device_id,
            "name": self.name,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "areaId": self.area_id,
            "integration": integration,
            # Child device podle HA 2026.9. Nikdy neslučovat podle názvu.
            "viaDeviceId": self.via_device_id,
        }


@dataclass(slots=True)
class Area:
    area_id: str
    name: str
    floor_id: str | None
    icon: str | None


@dataclass(slots=True)
class Floor:
    floor_id: str
    name: str
    level: int


class HomeModel:
    """Sestavuje a udržuje pohled na domácnost."""

    def __init__(self) -> None:
        self.ha_version: str | None = None
        self.floors: dict[str, Floor] = {}
        self.areas: dict[str, Area] = {}
        self.devices: dict[str, Device] = {}
        self.integrations: dict[str, str] = {}
        self.entities: dict[str, Entity] = {}
        self.generation = 0
        self.loaded = False

    # ------------------------------------------------------------------
    # Sestavení
    # ------------------------------------------------------------------

    def rebuild(
        self,
        *,
        ha_version: str | None,
        floors: list[dict],
        areas: list[dict],
        devices: list[dict],
        entities: list[dict],
        states: list[dict],
        config_entries: list[dict] | None = None,
    ) -> None:
        self.ha_version = ha_version

        self.floors = {
            item["floor_id"]: Floor(
                floor_id=item["floor_id"],
                name=item.get("name") or item["floor_id"],
                level=item.get("level") or 0,
            )
            for item in floors
            if item.get("floor_id")
        }

        self.areas = {
            item["area_id"]: Area(
                area_id=item["area_id"],
                name=item.get("name") or item["area_id"],
                floor_id=item.get("floor_id"),
                icon=item.get("icon"),
            )
            for item in areas
            if item.get("area_id")
        }

        self.integrations = {
            entry["entry_id"]: entry.get("title") or entry.get("domain") or ""
            for entry in (config_entries or [])
            if entry.get("entry_id")
        }

        # Device Registry 2026: zařízení patří právě jedné config entry.
        # Slučování podle názvu, výrobce nebo modelu je zakázané.
        self.devices = {}
        for item in devices:
            device_id = item.get("id")
            if not device_id or item.get("disabled_by"):
                continue
            self.devices[device_id] = Device(
                device_id=device_id,
                name=item.get("name_by_user") or item.get("name") or device_id,
                manufacturer=item.get("manufacturer"),
                model=item.get("model"),
                area_id=item.get("area_id"),
                config_entry_id=_single_config_entry(item),
                via_device_id=item.get("via_device_id"),
            )

        state_index = {item["entity_id"]: item for item in states}
        self.entities = {}

        for record in entities:
            entity = self._build_entity(record, state_index)
            if entity is not None:
                self.entities[entity.entity_id] = entity

        # Entity bez záznamu v registru (např. z YAML) se nesmí ztratit.
        for entity_id, state in state_index.items():
            if entity_id not in self.entities:
                self.entities[entity_id] = self._build_orphan_entity(entity_id, state)

        self.loaded = True
        self.generation += 1
        _LOGGER.info(
            "Model sestaven: %s pater, %s místností, %s zařízení, %s entit",
            len(self.floors),
            len(self.areas),
            len(self.devices),
            len(self.entities),
        )

    def _build_entity(
        self, record: dict, state_index: dict[str, dict]
    ) -> Entity | None:
        entity_id = record.get("entity_id")
        if not entity_id or record.get("disabled_by") or record.get("hidden_by"):
            return None

        state = state_index.get(entity_id) or {}
        attributes = state.get("attributes") or {}
        domain = entity_id.split(".", 1)[0]

        device_id = record.get("device_id")
        device = self.devices.get(device_id or "")
        area_id = record.get("area_id") or (device.area_id if device else None)

        device_class = (
            record.get("device_class")
            or record.get("original_device_class")
            or attributes.get("device_class")
        )

        name = (
            record.get("name")
            or attributes.get("friendly_name")
            or record.get("original_name")
            or entity_id
        )

        return Entity(
            entity_id=entity_id,
            # Persistentní identita. entity_id je jen měnitelný atribut.
            registry_id=record.get("id"),
            name=name,
            domain=domain,
            device_class=device_class,
            area_id=area_id,
            device_id=device_id,
            entity_category=record.get("entity_category"),
            platform=record.get("platform"),
            state=state.get("state", "unavailable"),
            attributes=attributes,
            capability=capability.classify(domain, device_class, attributes),
        )

    def _build_orphan_entity(self, entity_id: str, state: dict) -> Entity:
        attributes = state.get("attributes") or {}
        domain = entity_id.split(".", 1)[0]
        device_class = attributes.get("device_class")

        return Entity(
            entity_id=entity_id,
            registry_id=None,
            name=attributes.get("friendly_name") or entity_id,
            domain=domain,
            device_class=device_class,
            area_id=None,
            device_id=None,
            entity_category=None,
            state=state.get("state", "unavailable"),
            attributes=attributes,
            capability=capability.classify(domain, device_class, attributes),
        )

    # ------------------------------------------------------------------
    # Realtime
    # ------------------------------------------------------------------

    def apply_state_change(self, event: dict) -> str | None:
        """Zpracuje událost state_changed.

        Vrací "state" při změně hodnoty, "structure" při vzniku nebo zániku
        entity a None, když se nic nezměnilo.
        """
        data = event.get("data") or {}
        entity_id = data.get("entity_id")
        new_state = data.get("new_state")

        if not entity_id:
            return None

        entity = self.entities.get(entity_id)

        if new_state is None:
            # Entita zmizela - odebrat z pohledu, nic nemazat v HA.
            if entity is not None:
                del self.entities[entity_id]
                self.generation += 1
                return "structure"
            return None

        attributes = new_state.get("attributes") or {}

        if entity is None:
            # Nová entita vznikla přímo v Home Assistantu.
            self.entities[entity_id] = self._build_orphan_entity(entity_id, new_state)
            self.generation += 1
            return "structure"

        entity.state = new_state.get("state", "unavailable")
        entity.attributes = attributes
        entity.capability = capability.classify(
            entity.domain, entity.device_class, attributes
        )
        self.generation += 1
        return "state"

    # ------------------------------------------------------------------
    # Výstup pro frontend
    # ------------------------------------------------------------------

    def find(self, entity_id: str) -> Entity | None:
        return self.entities.get(entity_id)

    def rooms(self, *, technical: bool = False) -> list[dict[str, Any]]:
        """Místnosti s ovládacími prvky. Scény a automatizace mají vlastní sekci."""
        buckets: dict[str | None, list[Entity]] = {}

        for entity in self.entities.values():
            if not self._is_visible(entity, technical=technical):
                continue
            if entity.capability.get("kind") in SECTION_KINDS:
                continue
            buckets.setdefault(entity.area_id, []).append(entity)

        payload = []
        for area_id, entities in buckets.items():
            area = self.areas.get(area_id) if area_id else None
            floor = self.floors.get(area.floor_id) if area and area.floor_id else None

            payload.append(
                {
                    "id": area_id,
                    "name": area.name if area else None,
                    "icon": area.icon if area else None,
                    "floorId": floor.floor_id if floor else None,
                    "floorName": floor.name if floor else None,
                    "floorLevel": floor.level if floor else None,
                    "entities": [
                        entity.to_dict()
                        for entity in sorted(entities, key=_entity_sort_key)
                    ],
                }
            )

        payload.sort(key=_room_sort_key)
        return payload

    def by_kind(self, kind: str) -> list[dict[str, Any]]:
        """Všechny entity jedné schopnosti - pro sekce Scény a Automatizace."""
        found = [
            entity
            for entity in self.entities.values()
            if entity.capability.get("kind") == kind
            and entity.entity_category not in ("diagnostic", "config")
        ]
        return [
            entity.to_dict() for entity in sorted(found, key=lambda e: e.name.lower())
        ]

    def device_list(self) -> list[dict[str, Any]]:
        counts: dict[str, int] = {}
        for entity in self.entities.values():
            if entity.device_id:
                counts[entity.device_id] = counts.get(entity.device_id, 0) + 1

        payload = []
        for device in self.devices.values():
            item = device.to_dict(self.integrations.get(device.config_entry_id or ""))
            item["entityCount"] = counts.get(device.device_id, 0)
            area = self.areas.get(device.area_id or "")
            item["areaName"] = area.name if area else None
            payload.append(item)

        payload.sort(key=lambda d: ((d["areaName"] or "￿").lower(), d["name"].lower()))
        return payload

    def device_detail(self, device_id: str) -> dict[str, Any] | None:
        device = self.devices.get(device_id)
        if device is None:
            return None

        item = device.to_dict(self.integrations.get(device.config_entry_id or ""))
        area = self.areas.get(device.area_id or "")
        item["areaName"] = area.name if area else None
        item["entities"] = [
            entity.to_dict()
            for entity in sorted(
                (e for e in self.entities.values() if e.device_id == device_id),
                key=_entity_sort_key,
            )
        ]
        return item

    def structure(self) -> dict[str, Any]:
        """Patra a místnosti pro správu."""
        return {
            "floors": [
                {"id": f.floor_id, "name": f.name, "level": f.level}
                for f in sorted(self.floors.values(), key=lambda f: (f.level, f.name))
            ],
            "areas": [
                {
                    "id": a.area_id,
                    "name": a.name,
                    "floorId": a.floor_id,
                    "deviceCount": sum(
                        1 for d in self.devices.values() if d.area_id == a.area_id
                    ),
                }
                for a in sorted(self.areas.values(), key=lambda a: a.name.lower())
            ],
        }

    def summary(self) -> dict[str, Any]:
        """Souhrn domu pro domovskou obrazovku."""
        lights_on = 0
        alerts = []

        for entity in self.entities.values():
            kind = entity.capability.get("kind")
            if kind == "light" and entity.state == "on":
                lights_on += 1
            elif (
                kind == "binary_sensor"
                and entity.state == "on"
                and entity.capability.get("safety")
            ):
                alerts.append(entity.to_dict())

        return {
            "lightsOn": lights_on,
            "alerts": alerts,
            "deviceCount": len(self.devices),
            "areaCount": len(self.areas),
        }

    @staticmethod
    def _is_visible(entity: Entity, *, technical: bool) -> bool:
        if technical:
            return True
        # Diagnostické a konfigurační entity patří technikovi.
        if entity.entity_category in ("diagnostic", "config"):
            return False
        return entity.capability.get("kind") != "unsupported"


def _single_config_entry(item: dict) -> str | None:
    """Zařízení patří právě jedné config entry (HA 2026.8+).

    Starší tvar `config_entries` jako seznam se čte jen kvůli kompatibilitě
    a bere se z něj první položka - nikdy se nepovažuje za množinu vlastníků.
    """
    direct = item.get("primary_config_entry") or item.get("config_entry_id")
    if direct:
        return direct

    legacy = item.get("config_entries")
    if isinstance(legacy, list) and legacy:
        return legacy[0]
    return None


def _entity_sort_key(entity: Entity) -> tuple[int, str]:
    kind = entity.capability.get("kind", "unsupported")
    return (KIND_ORDER.get(kind, 99), entity.name.lower())


def _room_sort_key(room: dict) -> tuple[int, int, str]:
    # Nezařazené entity vždy na konec.
    if room["id"] is None:
        return (1, 0, "")
    return (0, room["floorLevel"] or 0, (room["name"] or "").lower())
