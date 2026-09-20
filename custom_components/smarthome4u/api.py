"""Interní API Smarthome4u.

Frontend mluví jen s tímhle API. Nikdy přímo s Home Assistantem a nikdy
nevolá libovolnou službu - povolené akce jsou v capability.py.
"""

from __future__ import annotations

import logging
import time
from functools import wraps
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr
from homeassistant.helpers.translation import async_get_translations
from homeassistant.loader import async_get_config_flows, async_get_integrations

from . import capability, config_files, flows, templates
from .const import API_BASE, LANGUAGE, VERSION
from .home import Home

_LOGGER = logging.getLogger(__name__)

MAX_NAME = 80

# Klíče kroku průvodce, které smí opustit backend. Nic jiného se neposílá,
# aby se ven nedostaly interní objekty Home Assistantu.
FLOW_KEYS = (
    "type",
    "flow_id",
    "handler",
    "step_id",
    "errors",
    "description_placeholders",
    "last_step",
    "menu_options",
    "url",
    "progress_action",
    "reason",
    "title",
)


class ApiError(Exception):
    """Chyba, kterou má vidět uživatel."""

    def __init__(self, message: str, status: int = 400, code: str = "invalid_request"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def handler(func):
    """Převede výjimky na srozumitelnou odpověď bez stack trace."""

    @wraps(func)
    async def wrapper(self, request: web.Request, *args, **kwargs):
        try:
            return await func(self, request, *args, **kwargs)
        except ApiError as err:
            return web.json_response(
                {"error": err.code, "message": err.message}, status=err.status
            )
        except capability.ActionNotAllowed:
            return web.json_response(
                {"error": "action_not_allowed", "message": "Tuto akci nelze provést."},
                status=400,
            )
        except templates.TemplateError as err:
            return web.json_response(
                {"error": "template_error", "message": str(err)}, status=400
            )
        except config_files.ConfigFileError as err:
            return web.json_response(
                {"error": "config_file", "message": str(err)}, status=500
            )
        except Exception:  # noqa: BLE001 - uživatel nikdy nevidí stack trace
            _LOGGER.exception("Chyba v %s", func.__name__)
            return web.json_response(
                {
                    "error": "internal",
                    "message": "Něco se nepovedlo. Zkuste to prosím znovu.",
                },
                status=500,
            )

    return wrapper


class Sh4uView(HomeAssistantView):
    """Základ pro všechny naše pohledy."""

    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.home = Home(hass)

    async def body(self, request: web.Request) -> dict[str, Any]:
        try:
            payload = await request.json()
        except ValueError as err:
            raise ApiError("Neplatný požadavek.") from err
        if not isinstance(payload, dict):
            raise ApiError("Neplatný požadavek.")
        return payload

    @staticmethod
    def name_of(payload: dict, key: str = "name") -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ApiError("Zadejte prosím název.")
        if len(value) > MAX_NAME:
            raise ApiError(f"Název může mít nejvýš {MAX_NAME} znaků.")
        return value.strip()


# ----------------------------------------------------------------------
# Čtení
# ----------------------------------------------------------------------


class ModelView(Sh4uView):
    url = f"{API_BASE}/model"
    name = "api:smarthome4u:model"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        user = request["hass_user"]
        return web.json_response(
            {
                "version": VERSION,
                "haVersion": self.hass.config.as_dict().get("version"),
                "loaded": True,
                "connected": True,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "role": "admin" if user.is_admin else "user",
                },
                "summary": self.home.summary(),
                "rooms": self.home.rooms(),
            }
        )


class SectionView(Sh4uView):
    url = f"{API_BASE}/sections/{{kind}}"
    name = "api:smarthome4u:sections"

    @handler
    async def get(self, request: web.Request, kind: str) -> web.Response:
        if kind == "scenes":
            return web.json_response(
                {
                    "scenes": self.home.by_kind("scene"),
                    "scripts": self.home.by_kind("script"),
                }
            )
        if kind == "automations":
            return web.json_response({"automations": self.home.by_kind("automation")})
        raise ApiError("Neznámá sekce.", 404, "unknown_section")


class EntityBatchView(Sh4uView):
    """Hromadné načtení změněných entit po realtime události."""

    url = f"{API_BASE}/entities/batch"
    name = "api:smarthome4u:entities:batch"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        ids = payload.get("ids")
        if not isinstance(ids, list) or len(ids) > 500:
            raise ApiError("Neplatný požadavek.")

        entities = [
            view
            for entity_id in ids
            if isinstance(entity_id, str)
            and (view := self.home.entity(entity_id)) is not None
        ]
        return web.json_response({"entities": entities})


class StructureView(Sh4uView):
    url = f"{API_BASE}/structure"
    name = "api:smarthome4u:structure"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        return web.json_response(self.home.structure())


class TemplatesView(Sh4uView):
    url = f"{API_BASE}/templates"
    name = "api:smarthome4u:templates"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        return web.json_response({"templates": templates.TEMPLATES})


# ----------------------------------------------------------------------
# Ovládání
# ----------------------------------------------------------------------


class ActionView(Sh4uView):
    url = f"{API_BASE}/action"
    name = "api:smarthome4u:action"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        entity_id = payload.get("entityId")
        action = payload.get("action")

        if not isinstance(entity_id, str) or not isinstance(action, str):
            raise ApiError("Chybí zařízení nebo akce.")

        view = self.home.entity(entity_id)
        if view is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")

        domain, service, data = capability.resolve_action(
            view["capability"].get("kind", "unsupported"),
            view["domain"],
            action,
            payload.get("value"),
        )

        await self.hass.services.async_call(
            domain, service, data, blocking=False, target={"entity_id": entity_id}
        )
        return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Zařízení
# ----------------------------------------------------------------------


class DevicesView(Sh4uView):
    url = f"{API_BASE}/devices"
    name = "api:smarthome4u:devices"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        return web.json_response({"devices": self.home.device_list()})


class DeviceView(Sh4uView):
    url = f"{API_BASE}/devices/{{device_id}}"
    name = "api:smarthome4u:device"

    @handler
    async def get(self, request: web.Request, device_id: str) -> web.Response:
        detail = self.home.device_detail(device_id)
        if detail is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_device")
        return web.json_response(detail)

    @handler
    async def post(self, request: web.Request, device_id: str) -> web.Response:
        devices = dr.async_get(self.hass)
        if devices.async_get(device_id) is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_device")

        payload = await self.body(request)
        changes: dict[str, Any] = {}

        if "name" in payload:
            changes["name_by_user"] = self.name_of(payload)
        if "areaId" in payload:
            changes["area_id"] = _area_or_none(self.hass, payload["areaId"])

        if not changes:
            raise ApiError("Není co uložit.")

        devices.async_update_device(device_id, **changes)
        return web.json_response({"ok": True})


class EntityView(Sh4uView):
    url = f"{API_BASE}/entities/{{entity_id}}"
    name = "api:smarthome4u:entity"

    @handler
    async def post(self, request: web.Request, entity_id: str) -> web.Response:
        registry = er.async_get(self.hass)
        if registry.async_get(entity_id) is None:
            raise ApiError(
                "Tuhle položku nejde přejmenovat. Vznikla mimo registr "
                "Home Assistantu.",
                400,
                "not_in_registry",
            )

        payload = await self.body(request)
        changes: dict[str, Any] = {}

        if "name" in payload:
            changes["name"] = self.name_of(payload)
        if "areaId" in payload:
            changes["area_id"] = _area_or_none(self.hass, payload["areaId"])

        if not changes:
            raise ApiError("Není co uložit.")

        registry.async_update_entity(entity_id, **changes)
        return web.json_response({"ok": True})


def _area_or_none(hass: HomeAssistant, value: Any) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str) or ar.async_get(hass).async_get_area(value) is None:
        raise ApiError("Taková místnost neexistuje.")
    return value


# ----------------------------------------------------------------------
# Místnosti a patra
# ----------------------------------------------------------------------


class AreasView(Sh4uView):
    url = f"{API_BASE}/structure/areas"
    name = "api:smarthome4u:areas"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        floor_id = payload.get("floorId")
        if floor_id not in (None, "") and _floor(self.hass, floor_id) is None:
            raise ApiError("Takové patro neexistuje.")

        ar.async_get(self.hass).async_create(
            self.name_of(payload), floor_id=floor_id or None
        )
        return web.json_response({"ok": True})


class AreaView(Sh4uView):
    url = f"{API_BASE}/structure/areas/{{area_id}}"
    name = "api:smarthome4u:area"

    @handler
    async def post(self, request: web.Request, area_id: str) -> web.Response:
        areas = ar.async_get(self.hass)
        if areas.async_get_area(area_id) is None:
            raise ApiError("Místnost už neexistuje.", 404, "unknown_area")

        payload = await self.body(request)
        changes: dict[str, Any] = {}

        if "name" in payload:
            changes["name"] = self.name_of(payload)
        if "floorId" in payload:
            floor_id = payload["floorId"]
            if floor_id not in (None, "") and _floor(self.hass, floor_id) is None:
                raise ApiError("Takové patro neexistuje.")
            changes["floor_id"] = floor_id or None

        if not changes:
            raise ApiError("Není co uložit.")

        areas.async_update(area_id, **changes)
        return web.json_response({"ok": True})


class AreaDeleteView(Sh4uView):
    url = f"{API_BASE}/structure/areas/{{area_id}}/delete"
    name = "api:smarthome4u:area:delete"

    @handler
    async def post(self, request: web.Request, area_id: str) -> web.Response:
        areas = ar.async_get(self.hass)
        if areas.async_get_area(area_id) is None:
            raise ApiError("Místnost už neexistuje.", 404, "unknown_area")
        # Smazání místnosti nemaže zařízení. Zůstanou nezařazená.
        areas.async_delete(area_id)
        return web.json_response({"ok": True})


class FloorsView(Sh4uView):
    url = f"{API_BASE}/structure/floors"
    name = "api:smarthome4u:floors"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        fr.async_get(self.hass).async_create(
            self.name_of(payload), level=_level(payload.get("level", 0))
        )
        return web.json_response({"ok": True})


class FloorView(Sh4uView):
    url = f"{API_BASE}/structure/floors/{{floor_id}}"
    name = "api:smarthome4u:floor"

    @handler
    async def post(self, request: web.Request, floor_id: str) -> web.Response:
        floors = fr.async_get(self.hass)
        if floors.async_get_floor(floor_id) is None:
            raise ApiError("Patro už neexistuje.", 404, "unknown_floor")

        payload = await self.body(request)
        changes: dict[str, Any] = {}

        if "name" in payload:
            changes["name"] = self.name_of(payload)
        if "level" in payload:
            changes["level"] = _level(payload["level"])

        if not changes:
            raise ApiError("Není co uložit.")

        floors.async_update(floor_id, **changes)
        return web.json_response({"ok": True})


class FloorDeleteView(Sh4uView):
    url = f"{API_BASE}/structure/floors/{{floor_id}}/delete"
    name = "api:smarthome4u:floor:delete"

    @handler
    async def post(self, request: web.Request, floor_id: str) -> web.Response:
        floors = fr.async_get(self.hass)
        if floors.async_get_floor(floor_id) is None:
            raise ApiError("Patro už neexistuje.", 404, "unknown_floor")
        floors.async_delete(floor_id)
        return web.json_response({"ok": True})


def _floor(hass: HomeAssistant, floor_id: str):
    return fr.async_get(hass).async_get_floor(floor_id)


def _level(value: Any) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not -10 <= value <= 50:
        raise ApiError("Podlaží musí být celé číslo.")
    return value


# ----------------------------------------------------------------------
# Integrace a průvodce přidáním
# ----------------------------------------------------------------------


async def _integration_names(hass: HomeAssistant) -> dict[str, str]:
    """Názvy integrací. Načte se jednou a zůstane v paměti."""
    from .const import DOMAIN

    store = hass.data.setdefault(DOMAIN, {})
    if "names" in store:
        return store["names"]

    domains = await async_get_config_flows(hass)
    loaded = await async_get_integrations(hass, domains)

    names = {
        domain: getattr(item, "name", domain)
        for domain, item in loaded.items()
        if not isinstance(item, Exception)
    }
    store["names"] = names
    return names


async def _render(hass: HomeAssistant, result: dict) -> web.Response:
    domain = result.get("handler") or ""
    names = await _integration_names(hass)

    resources = {}
    if domain:
        try:
            resources = await async_get_translations(
                hass, LANGUAGE, "config", {domain}
            )
        except Exception:  # noqa: BLE001 - bez překladů to jde taky
            _LOGGER.debug("Překlady pro %s se nepodařilo načíst", domain)

    payload = flows.normalize_step(
        _serialize(result), resources, names.get(domain, domain)
    )
    payload["domain"] = domain
    return web.json_response(payload)


def _serialize(result: dict) -> dict:
    """Vybere z výsledku jen to, co smí ven, a přeloží schéma na seznam polí."""
    data = {}
    for key in FLOW_KEYS:
        if key in result:
            value = result[key]
            data[key] = getattr(value, "value", value) if key == "type" else value

    data["data_schema"] = _convert_schema(result.get("data_schema"))
    return data


def _convert_schema(schema) -> list:
    """Převede voluptuous schéma na seznam polí pro frontend.

    Balíček voluptuous_serialize je deklarovaný v manifestu, takže si ho
    Home Assistant doinstaluje. Kdyby přesto chyběl, průvodce ukáže krok bez
    polí místo toho, aby spadla celá integrace.
    """
    if schema is None:
        return []

    try:
        import voluptuous_serialize
    except ImportError:
        _LOGGER.error(
            "Chybí balíček voluptuous-serialize. Průvodce přidáním integrace "
            "nemůže zobrazit formuláře. Zkuste restartovat Home Assistant."
        )
        return []

    try:
        return voluptuous_serialize.convert(
            schema, custom_serializer=cv.custom_serializer
        )
    except Exception:  # noqa: BLE001 - neznámé schéma nesmí shodit průvodce
        _LOGGER.warning("Schéma kroku se nepodařilo přeložit")
        return []


class IntegrationsView(Sh4uView):
    url = f"{API_BASE}/integrations"
    name = "api:smarthome4u:integrations"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        names = await _integration_names(self.hass)
        devices = dr.async_get(self.hass)

        per_entry: dict[str, int] = {}
        for device in devices.devices.values():
            if device.primary_config_entry:
                per_entry[device.primary_config_entry] = (
                    per_entry.get(device.primary_config_entry, 0) + 1
                )

        configured = [
            {
                "entryId": entry.entry_id,
                "domain": entry.domain,
                "title": entry.title,
                "name": names.get(entry.domain, entry.domain),
                "state": entry.state.value if entry.state else None,
                "deviceCount": per_entry.get(entry.entry_id, 0),
            }
            for entry in self.hass.config_entries.async_entries()
            if entry.source != "ignore"
        ]
        configured.sort(key=lambda item: (item["name"] or "").lower())

        discovered = [
            {
                "flowId": flow["flow_id"],
                "handler": flow["handler"],
                "name": names.get(flow["handler"], flow["handler"]),
                "title": (flow.get("context") or {})
                .get("title_placeholders", {})
                .get("name"),
            }
            for flow in self.hass.config_entries.flow.async_progress()
            if flow.get("context", {}).get("source") != "user"
        ]

        return web.json_response(
            {"configured": configured, "discovered": discovered}
        )


class AvailableView(Sh4uView):
    url = f"{API_BASE}/integrations/available"
    name = "api:smarthome4u:integrations:available"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        names = await _integration_names(self.hass)
        available = [
            {"domain": domain, "name": name} for domain, name in names.items()
        ]
        available.sort(key=lambda item: item["name"].lower())
        return web.json_response({"available": available})


class FlowStartView(Sh4uView):
    url = f"{API_BASE}/integrations/flow"
    name = "api:smarthome4u:flow:start"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        handler_domain = payload.get("handler")
        if not isinstance(handler_domain, str) or not handler_domain:
            raise ApiError("Vyberte prosím, co chcete přidat.")

        result = await self.hass.config_entries.flow.async_init(
            handler_domain,
            context={"source": "user", "show_advanced_options": False},
        )
        return await _render(self.hass, result)


class FlowStepView(Sh4uView):
    url = f"{API_BASE}/integrations/flow/{{flow_id}}"
    name = "api:smarthome4u:flow:step"

    @handler
    async def get(self, request: web.Request, flow_id: str) -> web.Response:
        for flow in self.hass.config_entries.flow.async_progress():
            if flow["flow_id"] == flow_id:
                result = await self.hass.config_entries.flow.async_configure(flow_id)
                return await _render(self.hass, result)
        raise ApiError("Průvodce už skončil.", 404, "flow_gone")

    @handler
    async def post(self, request: web.Request, flow_id: str) -> web.Response:
        payload = await self.body(request)
        data = payload.get("data")
        if not isinstance(data, dict):
            raise ApiError("Neplatný požadavek.")

        result = await self.hass.config_entries.flow.async_configure(flow_id, data)
        return await _render(self.hass, result)


class FlowAbortView(Sh4uView):
    url = f"{API_BASE}/integrations/flow/{{flow_id}}/abort"
    name = "api:smarthome4u:flow:abort"

    @handler
    async def post(self, request: web.Request, flow_id: str) -> web.Response:
        try:
            self.hass.config_entries.flow.async_abort(flow_id)
        except Exception:  # noqa: BLE001 - průvodce mohl skončit sám
            _LOGGER.debug("Průvodce %s už neexistuje", flow_id)
        return web.json_response({"ok": True})


class EntryDeleteView(Sh4uView):
    url = f"{API_BASE}/integrations/{{entry_id}}/delete"
    name = "api:smarthome4u:integration:delete"

    @handler
    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        if self.hass.config_entries.async_get_entry(entry_id) is None:
            raise ApiError("Tenhle systém už připojený není.", 404, "unknown_entry")
        await self.hass.config_entries.async_remove(entry_id)
        return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Automatizace a scény
# ----------------------------------------------------------------------


class AutomationsView(Sh4uView):
    url = f"{API_BASE}/automations"
    name = "api:smarthome4u:automations"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        template_id = payload.get("templateId")
        data = payload.get("data")

        if not isinstance(template_id, str) or not isinstance(data, dict):
            raise ApiError("Chybí šablona nebo výběr zařízení.")

        automation_id, config = templates.build(
            template_id, self.name_of(payload), data
        )
        config["id"] = automation_id
        await config_files.save_automation(self.hass, config)
        return web.json_response({"ok": True, "id": automation_id})


class AutomationDeleteView(Sh4uView):
    url = f"{API_BASE}/automations/{{automation_id}}/delete"
    name = "api:smarthome4u:automation:delete"

    @handler
    async def post(self, request: web.Request, automation_id: str) -> web.Response:
        await config_files.delete_automation(self.hass, automation_id)
        return web.json_response({"ok": True})


# Schopnosti, jejichž stav má smysl uložit do scény.
SNAPSHOT_KINDS = frozenset({"light", "switch", "cover", "climate", "fan"})

SNAPSHOT_ATTRIBUTES = {
    "light": ("brightness", "color_temp_kelvin", "rgb_color"),
    "cover": ("current_position",),
    "climate": ("temperature",),
    "fan": ("percentage",),
}


class ScenesView(Sh4uView):
    url = f"{API_BASE}/scenes"
    name = "api:smarthome4u:scenes"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        area_id = payload.get("areaId")

        if not isinstance(area_id, str) or _area_or_none(self.hass, area_id) is None:
            raise ApiError("Vyberte prosím místnost.")

        snapshot: dict[str, Any] = {}
        for room in self.home.rooms():
            if room["id"] != area_id:
                continue
            for view in room["entities"]:
                kind = view["capability"].get("kind")
                if kind not in SNAPSHOT_KINDS or not view["available"]:
                    continue

                record: dict[str, Any] = {"state": view["state"]}
                for key in SNAPSHOT_ATTRIBUTES.get(kind, ()):
                    if view["attributes"].get(key) is not None:
                        record[key] = view["attributes"][key]
                snapshot[view["id"]] = record

        if not snapshot:
            raise ApiError("V téhle místnosti není co uložit.")

        scene_id = str(int(time.time() * 1000))
        await config_files.save_scene(
            self.hass,
            {"id": scene_id, "name": self.name_of(payload), "entities": snapshot},
        )
        return web.json_response(
            {"ok": True, "id": scene_id, "count": len(snapshot)}
        )


class SceneDeleteView(Sh4uView):
    url = f"{API_BASE}/scenes/{{scene_id}}/delete"
    name = "api:smarthome4u:scene:delete"

    @handler
    async def post(self, request: web.Request, scene_id: str) -> web.Response:
        await config_files.delete_scene(self.hass, scene_id)
        return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Registrace
# ----------------------------------------------------------------------

VIEWS = (
    ModelView,
    SectionView,
    EntityBatchView,
    StructureView,
    TemplatesView,
    ActionView,
    DevicesView,
    DeviceView,
    EntityView,
    AreasView,
    AreaView,
    AreaDeleteView,
    FloorsView,
    FloorView,
    FloorDeleteView,
    IntegrationsView,
    AvailableView,
    FlowStartView,
    FlowStepView,
    FlowAbortView,
    EntryDeleteView,
    AutomationsView,
    AutomationDeleteView,
    ScenesView,
    SceneDeleteView,
)


def register(hass: HomeAssistant) -> None:
    for view in VIEWS:
        hass.http.register_view(view(hass))
