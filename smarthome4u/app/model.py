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
    "binary_sensor": 2,
    "sensor": 3,
    "unsupported": 9,
}

# Atributy, které frontend potřebuje. Zbytek se neposílá.
FORWARDED_ATTRIBUTES = ("brightness", "unit_of_measurement")


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
        self.device_areas: dict[str, str | None] = {}
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

        # Device Registry 2026: zařízení patří právě jedné config entry.
        # Slučování podle názvu nebo modelu je zakázané.
        self.device_areas = {
            item["id"]: item.get("area_id")
            for item in devices
            if item.get("id") and not item.get("disabled_by")
        }

        state_index = {item["entity_id"]: item for item in states}
        self.entities = {}

        for record in entities:
            entity = self._build_entity(record, state_index)
            if entity is not None:
                self.entities[entity.entity_id] = entity

        # Entity bez záznamu v registru (např. z YAML) se nesmí ztratit.
        for entity_id, state in state_index.items():
            if entity_id not in self.entities:
                entity = self._build_orphan_entity(entity_id, state)
                if entity is not None:
                    self.entities[entity_id] = entity

        self.loaded = True
        self.generation += 1
        _LOGGER.info(
            "Model sestaven: %s místností, %s entit",
            len(self.areas),
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
        area_id = record.get("area_id") or self.device_areas.get(device_id or "")

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
            state=state.get("state", "unavailable"),
            attributes=attributes,
            capability=capability.classify(domain, device_class, attributes),
        )

    def _build_orphan_entity(self, entity_id: str, state: dict) -> Entity | None:
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
            created = self._build_orphan_entity(entity_id, new_state)
            if created is None:
                return None
            self.entities[entity_id] = created
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

    def to_dict(self, *, technical: bool = False) -> dict[str, Any]:
        rooms: dict[str | None, list[Entity]] = {}

        for entity in self.entities.values():
            if not self._is_visible(entity, technical=technical):
                continue
            rooms.setdefault(entity.area_id, []).append(entity)

        payload = []
        for area_id, entities in rooms.items():
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

        return {
            "haVersion": self.ha_version,
            "generation": self.generation,
            "loaded": self.loaded,
            "rooms": payload,
        }

    @staticmethod
    def _is_visible(entity: Entity, *, technical: bool) -> bool:
        if technical:
            return True
        # Diagnostické a konfigurační entity patří technikovi.
        if entity.entity_category in ("diagnostic", "config"):
            return False
        return entity.capability.get("kind") != "unsupported"


def _entity_sort_key(entity: Entity) -> tuple[int, str]:
    kind = entity.capability.get("kind", "unsupported")
    return (KIND_ORDER.get(kind, 9), entity.name.lower())


def _room_sort_key(room: dict) -> tuple[int, int, str]:
    # Nezařazené entity vždy na konec.
    if room["id"] is None:
        return (1, 0, "")
    return (0, room["floorLevel"] or 0, (room["name"] or "").lower())
