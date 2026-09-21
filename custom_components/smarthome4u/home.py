"""Pohled na domácnost.

Jako integrace čteme registry Home Assistantu přímo. Odpadá tím vlastní kopie
stavu i hádání nedokumentovaných WebSocket commandů - Home Assistant je
jediný zdroj pravdy a my se ho jen ptáme.
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr

from . import capability

# Pořadí, v jakém se zobrazují schopnosti v místnosti.
KIND_ORDER = {
    "light": 0,
    "switch": 1,
    "cover": 2,
    "climate": 3,
    "lock": 4,
    "fan": 5,
    "media_player": 6,
    "camera": 6,
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

# Schopnosti, které mají vlastní sekci a nepatří na dlaždice místnosti.
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
    "entity_picture",
)

HIDDEN_CATEGORIES = {"config", "diagnostic"}


class Home:
    """Čte strukturu domácnosti z registrů Home Assistantu."""

    def __init__(self, hass: HomeAssistant, settings=None) -> None:
        self.hass = hass
        self.settings = settings

    def _velikost(self, entity_id: str) -> str | None:
        """Velikost dlaždice zvolená správcem."""
        if self.settings is None:
            return None
        return self.settings.layout["sizes"].get(entity_id)

    def _override(self, entity_id: str) -> dict:
        """Ruční oprava zařazení od správce."""
        if self.settings is None:
            return {}
        return self.settings.overrides.get(entity_id, {})

    # ------------------------------------------------------------------
    # Jedna entita
    # ------------------------------------------------------------------

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        state = self.hass.states.get(entity_id)
        if state is None:
            return None

        registry = er.async_get(self.hass)
        entry = registry.async_get(entity_id)
        return self._entity_view(state, entry)

    def _entity_view(self, state: State, entry: er.RegistryEntry | None) -> dict:
        attributes = state.attributes
        domain = state.domain

        device_class = (
            (entry.device_class or entry.original_device_class if entry else None)
            or attributes.get("device_class")
        )

        name = (
            (entry.name if entry else None)
            or attributes.get("friendly_name")
            or (entry.original_name if entry else None)
            or state.entity_id
        )

        area_id = None
        device_id = None
        if entry is not None:
            device_id = entry.device_id
            area_id = entry.area_id
            if area_id is None and device_id:
                device = dr.async_get(self.hass).async_get(device_id)
                area_id = device.area_id if device else None

        schopnost = capability.classify(domain, device_class, attributes)

        # Home Assistant hlásí jako světlo i věci, které světlo nejsou.
        # Správce to může přeřadit ručně.
        oprava = self._override(state.entity_id)
        if oprava.get("kind"):
            schopnost = capability.reclassify(schopnost, oprava["kind"], attributes)

        return {
            "id": state.entity_id,
            # Persistentní identita. entity_id je jen měnitelný atribut.
            "ref": entry.id if entry else None,
            "name": name,
            "domain": domain,
            "deviceClass": device_class,
            "deviceId": device_id,
            "areaId": area_id,
            "state": state.state,
            "available": state.state not in ("unavailable", "unknown"),
            "capability": schopnost,
            "overridden": bool(oprava.get("kind")),
            "size": self._velikost(state.entity_id),
            "attributes": {
                key: attributes[key]
                for key in FORWARDED_ATTRIBUTES
                if key in attributes
            },
            "category": entry.entity_category.value
            if entry and entry.entity_category
            else None,
        }

    # ------------------------------------------------------------------
    # Všechny viditelné entity
    # ------------------------------------------------------------------

    def _visible(self, *, technical: bool = False) -> list[dict]:
        registry = er.async_get(self.hass)
        result = []

        for state in self.hass.states.async_all():
            entry = registry.async_get(state.entity_id)

            if entry is not None and (entry.disabled_by or entry.hidden_by):
                continue

            if self._override(state.entity_id).get("hidden"):
                continue

            view = self._entity_view(state, entry)

            if not technical:
                if view["category"] in HIDDEN_CATEGORIES:
                    continue
                if view["capability"].get("kind") == "unsupported":
                    continue

            result.append(view)

        return result

    # ------------------------------------------------------------------
    # Místnosti
    # ------------------------------------------------------------------

    def rooms(self, *, technical: bool = False) -> list[dict]:
        areas = ar.async_get(self.hass)
        floors = fr.async_get(self.hass)

        buckets: dict[str | None, list[dict]] = {}
        for view in self._visible(technical=technical):
            if view["capability"].get("kind") in SECTION_KINDS:
                continue
            buckets.setdefault(view["areaId"], []).append(view)

        payload = []
        for area_id, entities in buckets.items():
            area = areas.async_get_area(area_id) if area_id else None
            floor = (
                floors.async_get_floor(area.floor_id)
                if area and area.floor_id
                else None
            )

            payload.append(
                {
                    "id": area_id,
                    "name": area.name if area else None,
                    "icon": area.icon if area else None,
                    "floorId": floor.floor_id if floor else None,
                    "floorName": floor.name if floor else None,
                    "floorLevel": floor.level if floor else None,
                    "entities": self._serad_entity(area_id, entities),
                }
            )

        payload.sort(key=_room_sort_key)
        return self._serad_mistnosti(payload)

    # ------------------------------------------------------------------
    # Ruční rozvržení
    #
    # Co správce přetáhl, má přednost. Co v uloženém pořadí není (nové
    # zařízení), se přidá na konec podle výchozího řazení.
    # ------------------------------------------------------------------

    def _layout(self) -> dict:
        if self.settings is None:
            return {"rooms": [], "entities": {}}
        return self.settings.layout

    def _serad_entity(self, area_id: str | None, entities: list[dict]) -> list[dict]:
        vychozi = sorted(entities, key=_entity_sort_key)
        poradi = self._layout()["entities"].get(area_id or "", [])
        if not poradi:
            return vychozi

        index = {entity_id: i for i, entity_id in enumerate(poradi)}
        return sorted(vychozi, key=lambda v: index.get(v["id"], len(index)))

    def _serad_mistnosti(self, rooms: list[dict]) -> list[dict]:
        poradi = self._layout()["rooms"]
        if not poradi:
            return rooms

        index = {area_id: i for i, area_id in enumerate(poradi)}
        return sorted(rooms, key=lambda r: index.get(r["id"] or "", len(index)))

    def by_kind(self, kind: str) -> list[dict]:
        found = [
            view
            for view in self._visible()
            if view["capability"].get("kind") == kind
        ]
        return sorted(found, key=lambda item: item["name"].lower())

    # ------------------------------------------------------------------
    # Zařízení
    # ------------------------------------------------------------------

    def _integration_titles(self) -> dict[str, str]:
        return {
            entry.entry_id: entry.title or entry.domain
            for entry in self.hass.config_entries.async_entries()
        }

    def device_list(self) -> list[dict]:
        devices = dr.async_get(self.hass)
        entities = er.async_get(self.hass)
        areas = ar.async_get(self.hass)
        titles = self._integration_titles()

        counts: dict[str, int] = {}
        for entry in entities.entities.values():
            if entry.device_id and not entry.disabled_by:
                counts[entry.device_id] = counts.get(entry.device_id, 0) + 1

        payload = []
        for device in devices.devices.values():
            if device.disabled_by:
                continue

            area = areas.async_get_area(device.area_id) if device.area_id else None
            payload.append(
                {
                    "id": device.id,
                    "name": device.name_by_user or device.name or device.id,
                    "manufacturer": device.manufacturer,
                    "model": device.model,
                    "areaId": device.area_id,
                    "areaName": area.name if area else None,
                    # Zařízení patří právě jedné config entry (HA 2026.8+).
                    "integration": titles.get(device.primary_config_entry or ""),
                    "viaDeviceId": device.via_device_id,
                    "entityCount": counts.get(device.id, 0),
                }
            )

        payload.sort(key=lambda d: ((d["areaName"] or "￿").lower(), d["name"].lower()))
        return payload

    def device_detail(self, device_id: str) -> dict | None:
        devices = dr.async_get(self.hass)
        device = devices.async_get(device_id)
        if device is None:
            return None

        areas = ar.async_get(self.hass)
        titles = self._integration_titles()
        area = areas.async_get_area(device.area_id) if device.area_id else None

        registry = er.async_get(self.hass)
        entities = []
        for entry in er.async_entries_for_device(registry, device_id):
            if entry.disabled_by or entry.hidden_by:
                continue
            state = self.hass.states.get(entry.entity_id)
            if state is not None:
                entities.append(self._entity_view(state, entry))

        return {
            "id": device.id,
            "name": device.name_by_user or device.name or device.id,
            "manufacturer": device.manufacturer,
            "model": device.model,
            "areaId": device.area_id,
            "areaName": area.name if area else None,
            "integration": titles.get(device.primary_config_entry or ""),
            "entities": sorted(entities, key=_entity_sort_key),
        }

    # ------------------------------------------------------------------
    # Struktura a souhrn
    # ------------------------------------------------------------------

    def structure(self) -> dict:
        areas = ar.async_get(self.hass)
        floors = fr.async_get(self.hass)
        devices = dr.async_get(self.hass)

        per_area: dict[str, int] = {}
        for device in devices.devices.values():
            if device.area_id:
                per_area[device.area_id] = per_area.get(device.area_id, 0) + 1

        return {
            "floors": [
                {"id": floor.floor_id, "name": floor.name, "level": floor.level or 0}
                for floor in sorted(
                    floors.floors.values(), key=lambda f: (f.level or 0, f.name)
                )
            ],
            "areas": [
                {
                    "id": area.id,
                    "name": area.name,
                    "floorId": area.floor_id,
                    "deviceCount": per_area.get(area.id, 0),
                }
                for area in sorted(
                    areas.areas.values(), key=lambda a: a.name.lower()
                )
            ],
        }

    def summary(self) -> dict:
        lights_on = 0
        alerts = []

        for view in self._visible():
            kind = view["capability"].get("kind")
            if kind == "light" and view["state"] == "on":
                lights_on += 1
            elif (
                kind == "binary_sensor"
                and view["state"] == "on"
                and view["capability"].get("safety")
            ):
                alerts.append(view)

        devices = dr.async_get(self.hass)
        areas = ar.async_get(self.hass)

        return {
            "lightsOn": lights_on,
            "alerts": alerts,
            "deviceCount": sum(
                1 for device in devices.devices.values() if not device.disabled_by
            ),
            "areaCount": len(areas.areas),
        }


def _entity_sort_key(view: dict) -> tuple[int, str]:
    kind = view["capability"].get("kind", "unsupported")
    return (KIND_ORDER.get(kind, 99), view["name"].lower())


def _room_sort_key(room: dict) -> tuple[int, int, str]:
    # Nezařazené entity vždy na konec.
    if room["id"] is None:
        return (1, 0, "")
    return (0, room["floorLevel"] or 0, (room["name"] or "").lower())
