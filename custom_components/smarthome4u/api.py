"""Interní API Smarthome4u.

Frontend mluví jen s tímhle API. Nikdy přímo s Home Assistantem a nikdy
nevolá libovolnou službu - povolené akce jsou v capability.py.
"""

from __future__ import annotations

import base64
import binascii
import logging
import time
from functools import wraps
from pathlib import Path
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

from . import builder, capability, config_files, flows, refs, storage, system, templates
from .const import API_BASE, DOMAIN, LANGUAGE, USER_DIR, USER_URL, VERSION
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


def admin(func):
    """Operace, kterou smí provést jen správce."""

    @wraps(func)
    async def wrapper(self, request: web.Request, *args, **kwargs):
        self.require_admin(request)
        return await func(self, request, *args, **kwargs)

    return wrapper


def technician(func):
    """House setup is available to an assigned technician or administrator."""

    @wraps(func)
    async def wrapper(self, request: web.Request, *args, **kwargs):
        if self.role(request) not in ("technician", "admin"):
            raise ApiError("Tohle může měnit jen technik domácnosti.", 403, "forbidden")
        return await func(self, request, *args, **kwargs)

    return wrapper


class Sh4uView(HomeAssistantView):
    """Základ pro všechny naše pohledy."""

    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    @property
    def settings(self):
        """Nastavení Smarthome4u. Načítá se při spuštění integrace."""
        return self.hass.data.get(DOMAIN, {}).get("settings")

    @property
    def home(self) -> Home:
        return Home(self.hass, self.settings)

    def presentation(self, request: web.Request):
        settings = self.settings
        if settings is None:
            return None
        return settings.presentation(request["hass_user"].id, self.role(request))

    def home_for(self, request: web.Request) -> Home:
        return Home(self.hass, self.presentation(request))

    def role(self, request: web.Request) -> str:
        user = request["hass_user"]
        settings = self.settings
        if settings is None:
            return "admin" if user.is_admin else "user"
        return settings.role(user.id, user.is_admin)

    def require_admin(self, request: web.Request) -> None:
        """Nastavovat smí jen správce. Ostatní dům ovládají, ale nenastavují."""
        if self.role(request) != "admin":
            raise ApiError(
                "Tohle může měnit jen správce domácnosti.", 403, "forbidden"
            )

    def entity_ref(self, value: Any) -> str:
        """Accept a stable ref or old entity_id and return a valid ref."""
        if not isinstance(value, str):
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")
        entity_ref = refs.normalize_ref(self.hass, value)
        if entity_ref is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")
        return entity_ref

    def entity_id_from_ref(self, value: Any) -> str:
        if not isinstance(value, str):
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")
        entity_id = refs.entity_id_for_ref(self.hass, value)
        if entity_id is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")
        return entity_id

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
        settings = self.settings

        # První administrátor Home Assistantu se stane správcem.
        if settings is not None and settings.admin_user_id is None and user.is_admin:
            await settings.claim_admin(user.id)

        presentation = self.presentation(request)
        home = Home(self.hass, presentation)
        return web.json_response(
            {
                "version": VERSION,
                "haVersion": self.hass.config.as_dict().get("version"),
                "loaded": True,
                "connected": True,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "role": self.role(request),
                },
                "preset": settings.preset if settings else "prehled",
                "bigControls": settings.big_controls if settings else False,
                # Sestava plochy. None znamená "použij výchozí sestavu".
                "board": presentation.board(settings.preset) if settings else None,
                "favorites": home.favorites(),
                "summary": home.summary(),
                "roomSummaries": home.room_summaries(),
                "rooms": home.rooms(),
                "scenes": home.by_kind("scene")[:8],
                "nowPlaying": home.now_playing(),
                "attention": home.attention(),
            }
        )


class SectionView(Sh4uView):
    url = f"{API_BASE}/sections/{{kind}}"
    name = "api:smarthome4u:sections"

    @handler
    async def get(self, request: web.Request, kind: str) -> web.Response:
        home = self.home_for(request)
        if kind == "scenes":
            return web.json_response(
                {
                    "scenes": home.by_kind("scene"),
                    "scripts": home.by_kind("script"),
                }
            )
        if kind == "automations":
            return web.json_response({"automations": home.by_kind("automation")})
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

        home = self.home_for(request)
        entities = [
            view
            for entity_id in ids
            if isinstance(entity_id, str)
            and (view := home.entity(entity_id)) is not None
        ]
        return web.json_response({"entities": entities})


class StructureView(Sh4uView):
    url = f"{API_BASE}/structure"
    name = "api:smarthome4u:structure"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        return web.json_response(self.home_for(request).structure())


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

        view = self.home_for(request).entity(entity_id)
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
        return web.json_response({"devices": self.home_for(request).device_list()})


class DeviceView(Sh4uView):
    url = f"{API_BASE}/devices/{{device_id}}"
    name = "api:smarthome4u:device"

    @handler
    async def get(self, request: web.Request, device_id: str) -> web.Response:
        detail = self.home_for(request).device_detail(device_id)
        if detail is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_device")
        return web.json_response(detail)

    @handler
    @technician
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
    @technician
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
    @technician
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
    @technician
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
    @technician
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
    @technician
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
    @technician
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
    @technician
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


async def _integration_catalog(hass: HomeAssistant) -> list[dict]:
    """Co jde přidat průvodcem. Manifestů jsou stovky, načítá se to jednou.

    Entity a systémové integrace se nenabízejí - laika by jen mátly.
    Pomocníci zůstávají, jen se poznají podle typu.
    """
    store = hass.data.setdefault(DOMAIN, {})
    if "catalog" in store:
        return store["catalog"]

    domains = await async_get_config_flows(hass)
    loaded = await async_get_integrations(hass, domains)

    katalog: list[dict] = []
    names: dict[str, str] = {}

    for domain, item in loaded.items():
        if isinstance(item, Exception):
            continue

        name = getattr(item, "name", domain) or domain
        typ = getattr(item, "integration_type", None) or "integration"
        names[domain] = name

        if typ in ("entity", "system"):
            continue
        katalog.append({"domain": domain, "name": name, "type": typ})

    katalog.sort(key=lambda polozka: polozka["name"].lower())
    store["catalog"] = katalog
    store["names"] = names
    return katalog


async def _integration_names(hass: HomeAssistant) -> dict[str, str]:
    """Názvy integrací podle domény."""
    await _integration_catalog(hass)
    return hass.data.get(DOMAIN, {}).get("names", {})


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
    @technician
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
    @technician
    async def get(self, request: web.Request) -> web.Response:
        katalog = await _integration_catalog(self.hass)
        return web.json_response(
            {
                "available": [i for i in katalog if i["type"] != "helper"],
                "helpers": [i for i in katalog if i["type"] == "helper"],
            }
        )


class FlowStartView(Sh4uView):
    url = f"{API_BASE}/integrations/flow"
    name = "api:smarthome4u:flow:start"

    @handler
    @technician
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
    @technician
    async def get(self, request: web.Request, flow_id: str) -> web.Response:
        for flow in self.hass.config_entries.flow.async_progress():
            if flow["flow_id"] == flow_id:
                result = await self.hass.config_entries.flow.async_configure(flow_id)
                return await _render(self.hass, result)
        raise ApiError("Průvodce už skončil.", 404, "flow_gone")

    @handler
    @technician
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
    @technician
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
    @technician
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
    @technician
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


class AutomationBuildView(Sh4uView):
    """Vytvoření a úprava automatizace z editoru.

    Stejný model používá jednoduchý editor KDYŽ / A ZÁROVEŇ / PAK i skládačka,
    takže obě cesty vyrobí stejnou automatizaci.
    """

    url = f"{API_BASE}/automations/build"
    name = "api:smarthome4u:automations:build"

    @handler
    @technician
    async def post(self, request: web.Request) -> web.Response:
        payload = await self.body(request)
        model = payload.get("model")
        if not isinstance(model, dict):
            raise ApiError("Chybí popis automatizace.")

        try:
            automation_id, config = builder.build(model)
        except builder.BuilderError as err:
            raise ApiError(str(err)) from err

        await config_files.save_automation(self.hass, config)
        return web.json_response({"ok": True, "id": automation_id})


class AutomationModelView(Sh4uView):
    """Načte automatizaci zpátky do editoru.

    Co se nevejde do našeho modelu, se neupravuje. Nikdy nic
    nezjednodušujeme destruktivně.
    """

    url = f"{API_BASE}/automations/{{automation_id}}/model"
    name = "api:smarthome4u:automation:model"

    @handler
    @technician
    async def get(self, request: web.Request, automation_id: str) -> web.Response:
        config = await config_files.read_automation(self.hass, automation_id)
        if config is None:
            raise ApiError(
                "Tuhle automatizaci jsme nenašli. Možná vznikla jinde.",
                404,
                "unknown_automation",
            )

        model = builder.parse(config)
        if model is None:
            return web.json_response({"advanced": True, "alias": config.get("alias")})

        return web.json_response({"advanced": False, "model": model})


class AutomationDeleteView(Sh4uView):
    url = f"{API_BASE}/automations/{{automation_id}}/delete"
    name = "api:smarthome4u:automation:delete"

    @handler
    @technician
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
    @technician
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
    @technician
    async def post(self, request: web.Request, scene_id: str) -> web.Response:
        await config_files.delete_scene(self.hass, scene_id)
        return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Nastavení Smarthome4u
# ----------------------------------------------------------------------


class SettingsView(Sh4uView):
    url = f"{API_BASE}/settings"
    name = "api:smarthome4u:settings"

    @handler
    @technician
    async def get(self, request: web.Request) -> web.Response:
        settings = self.settings
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        users = {}
        for user in await self.hass.auth.async_get_users():
            if not user.system_generated and user.is_active:
                users[user.id] = user.name

        return web.json_response(
            {
                "role": self.role(request),
                "preset": settings.preset,
                "presets": list(storage.PRESETY),
                "unavailable": list(storage.PRIPRAVUJE_SE),
                "adminUserId": settings.admin_user_id,
                "roles": settings.data.get("roles", {}),
                "kiosk": settings.kiosk,
                "landing": settings.landing,
                "bigControls": settings.big_controls,
                "hasLayout": bool(
                    settings.layout["rooms"] or settings.layout["entities"]
                ),
                "users": [{"id": uid, "name": name} for uid, name in users.items()],
                "kinds": list(capability.PRERADITELNE),
                "overrides": settings.overrides,
                "lights": self.home.light_candidates(),
            }
        )

    @handler
    @admin
    async def post(self, request: web.Request) -> web.Response:
        settings = self.settings
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)

        if "preset" in payload:
            try:
                await settings.set_preset(payload["preset"])
            except ValueError as err:
                raise ApiError("Tahle podoba dashboardu zatím nejde vybrat.") from err

        if "kiosk" in payload or "landing" in payload:
            kiosk = payload.get("kiosk", settings.kiosk)
            landing = payload.get("landing", settings.landing)
            if not isinstance(kiosk, bool) or not isinstance(landing, bool):
                raise ApiError("Neplatný požadavek.")
            await settings.set_kiosk(kiosk, landing)

        if "bigControls" in payload:
            hodnota = payload["bigControls"]
            if not isinstance(hodnota, bool):
                raise ApiError("Neplatný požadavek.")
            await settings.set_big_controls(hodnota)

        if "adminUserId" in payload:
            novy = payload["adminUserId"]
            if not isinstance(novy, str) or not novy:
                raise ApiError("Vyberte prosím účet správce.")

            uzivatel = await self.hass.auth.async_get_user(novy)
            if uzivatel is None:
                raise ApiError("Takový účet neexistuje.")
            if not uzivatel.is_admin:
                raise ApiError(
                    "Správcem Smarthome4u může být jen administrátor "
                    "Home Assistantu."
                )
            await settings.set_admin(novy)

        return web.json_response({"ok": True})


class RoleView(Sh4uView):
    """Only the owner can grant or revoke installer privileges."""

    url = f"{API_BASE}/roles/{{user_id}}"
    name = "api:smarthome4u:roles"

    @handler
    @admin
    async def post(self, request: web.Request, user_id: str) -> web.Response:
        settings = self.settings
        payload = await self.body(request)
        role = payload.get("role")
        if role not in ("user", "technician"):
            raise ApiError("Neplatná role.")
        user = await self.hass.auth.async_get_user(user_id)
        if user is None or not user.is_active or user.system_generated:
            raise ApiError("Takový účet neexistuje.", 404, "unknown_user")
        if user_id == settings.admin_user_id:
            raise ApiError("Roli správce zde nelze změnit.")
        await settings.set_role(user_id, role)
        return web.json_response({"ok": True})


class SystemView(Sh4uView):
    """Stav systému - verze, aktualizace, místo na disku."""

    url = f"{API_BASE}/system"
    name = "api:smarthome4u:system"

    @handler
    @admin
    async def get(self, request: web.Request) -> web.Response:
        return web.json_response(system.overview(self.hass))


class UpdateInstallView(Sh4uView):
    url = f"{API_BASE}/system/update/{{entity_id}}"
    name = "api:smarthome4u:system:update"

    @handler
    @admin
    async def post(self, request: web.Request, entity_id: str) -> web.Response:
        if not entity_id.startswith("update."):
            raise ApiError("Tohle není aktualizace.")
        if self.hass.states.get(entity_id) is None:
            raise ApiError("Aktualizace už není k dispozici.", 404, "unknown_entity")

        await self.hass.services.async_call(
            "update", "install", {}, blocking=False, target={"entity_id": entity_id}
        )
        return web.json_response({"ok": True})


class KioskView(Sh4uView):
    """Čte takeover.js, který běží ve frontendu Home Assistantu.

    Musí být dostupné i běžnému uživateli - jinak by se mu lišta neschovala.
    """

    url = f"{API_BASE}/kiosk"
    name = "api:smarthome4u:kiosk"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        settings = self.settings
        return web.json_response(
            {
                "kiosk": settings.kiosk if settings else True,
                "landing": settings.landing if settings else True,
            }
        )


class LayoutView(Sh4uView):
    """Ruční rozvržení dashboardu z editoru."""

    url = f"{API_BASE}/layout"
    name = "api:smarthome4u:layout"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)

        if payload.get("reset"):
            await settings.reset_layout()
            return web.json_response({"ok": True})

        if "rooms" in payload:
            rooms = payload["rooms"]
            if not isinstance(rooms, list) or not all(
                isinstance(r, str) for r in rooms
            ):
                raise ApiError("Neplatné pořadí místností.")
            await settings.set_room_order(rooms)

        entity_key = payload.get("entityRef", payload.get("entityId"))
        if "size" in payload and entity_key is not None:
            entity_ref = self.entity_ref(entity_key)
            size = payload["size"]
            if size not in (None, "", "wide", "tall", "big"):
                raise ApiError("Takovou velikost neznáme.")
            await settings.set_size(entity_ref, size or None)

        if "areaId" in payload and "entities" in payload:
            area_id = payload["areaId"]
            entities = payload["entities"]
            if not isinstance(area_id, str) or not isinstance(entities, list):
                raise ApiError("Neplatné pořadí zařízení.")
            if not all(isinstance(e, str) for e in entities):
                raise ApiError("Neplatné pořadí zařízení.")
            # Co mezitím z Home Assistanta zmizelo, se tiše vynechá.
            # Odmítnout celé přeskládání kvůli jedné odebrané zásuvce by
            # znamenalo, že si správce po výměně zařízení pořadí neuloží.
            poradi = []
            for item in entities:
                entity_ref = refs.normalize_ref(self.hass, item)
                if entity_ref is not None:
                    poradi.append(entity_ref)
            await settings.set_entity_order(area_id, poradi)

        return web.json_response({"ok": True})


class FloorplanView(Sh4uView):
    """Půdorys bytu - obrázek a rozmístění zařízení."""

    url = f"{API_BASE}/floorplan"
    name = "api:smarthome4u:floorplan"

    @handler
    async def get(self, request: web.Request) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            return web.json_response({"image": None, "points": []})

        plan = settings.floorplan
        body = []
        for point in plan["points"]:
            entity_ref = point.get("entityRef") or point.get("entityId")
            entity_id = refs.entity_id_for_ref(self.hass, entity_ref)
            if entity_id is None:
                continue
            body.append(
                {
                    "entityRef": refs.normalize_ref(self.hass, entity_ref),
                    "entityId": entity_id,
                    "x": point.get("x"),
                    "y": point.get("y"),
                }
            )
        return web.json_response(
            {
                "image": f"{USER_URL}/{plan['image']}" if plan["image"] else None,
                "points": body,
            }
        )

    @handler
    async def post(self, request: web.Request) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)

        if "points" in payload:
            body = payload["points"]
            if not isinstance(body, list) or len(body) > 200:
                raise ApiError("Neplatné rozmístění.")

            ocistene = []
            for bod in body:
                if not isinstance(bod, dict):
                    raise ApiError("Neplatné rozmístění.")
                entity_ref = bod.get("entityRef", bod.get("entityId"))
                x = bod.get("x")
                y = bod.get("y")
                entity_ref = self.entity_ref(entity_ref)
                if not isinstance(x, (int, float)) or not 0 <= x <= 100:
                    raise ApiError("Neplatné rozmístění.")
                if not isinstance(y, (int, float)) or not 0 <= y <= 100:
                    raise ApiError("Neplatné rozmístění.")
                ocistene.append(
                    {"entityRef": entity_ref, "x": round(x, 2), "y": round(y, 2)}
                )

            await settings.set_floorplan_points(ocistene)

        return web.json_response({"ok": True})


class FloorplanImageView(Sh4uView):
    """Nahrání obrázku půdorysu.

    Ukládá se mimo složku integrace, aby přežil aktualizaci přes HACS.
    """

    url = f"{API_BASE}/floorplan/image"
    name = "api:smarthome4u:floorplan:image"

    # Co Home Assistant bezpečně zobrazí v prohlížeči.
    POVOLENE = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
    MAX_BYTU = 8 * 1024 * 1024

    @handler
    @technician
    async def post(self, request: web.Request) -> web.Response:
        settings = self.settings
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)
        data = payload.get("data")

        if not isinstance(data, str) or not data.startswith("data:"):
            raise ApiError("Vyberte prosím obrázek.")

        hlavicka, _, telo = data.partition(",")
        typ = hlavicka[5:].split(";")[0]

        pripona = self.POVOLENE.get(typ)
        if pripona is None:
            raise ApiError("Podporujeme PNG, JPG a WEBP.")

        try:
            obsah = base64.b64decode(telo, validate=True)
        except (ValueError, binascii.Error) as err:
            raise ApiError("Obrázek se nepodařilo přečíst.") from err

        if len(obsah) > self.MAX_BYTU:
            raise ApiError("Obrázek je větší než 8 MB.")

        slozka = Path(self.hass.config.path(USER_DIR))
        nazev = f"pudorys.{pripona}"

        def zapsat() -> None:
            slozka.mkdir(parents=True, exist_ok=True)
            # Staré přípony se uklidí, ať nezůstane viset neplatný soubor.
            for stary in self.POVOLENE.values():
                soubor = slozka / f"pudorys.{stary}"
                if soubor.exists() and stary != pripona:
                    soubor.unlink()
            (slozka / nazev).write_bytes(obsah)

        await self.hass.async_add_executor_job(zapsat)
        await settings.set_floorplan_image(nazev)

        return web.json_response({"ok": True, "image": f"{USER_URL}/{nazev}"})


# Kolik bloků a kolik dlaždic v bloku má ještě smysl. Nad tím už to není
# plocha, ale seznam - a ten patří do Místností.
MAX_BLOKU = 30
MAX_V_BLOKU = 60
# Sloupce plochy. Víc než čtyři se nevejdou ani na velkou obrazovku.
MAX_SLOUPCU = 4
VELIKOSTI_DLAZDIC = ("s", "m", "l")


class DashboardView(Sh4uView):
    """Plocha po blocích.

    Posílá se vždy celá sestava, takže se nemůže rozejít pořadí s obsahem.
    Ukládá se zvlášť pro každou podobu plochy - správce si může Přehled
    poskládat jinak než Nástěnný panel.
    """

    url = f"{API_BASE}/dashboard"
    name = "api:smarthome4u:dashboard"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)
        preset = payload.get("preset")
        bloky = payload.get("blocks")
        sloupce = payload.get("columns", 1)

        if preset not in storage.PRESETY:
            raise ApiError("Neznámá podoba plochy.")
        if not isinstance(bloky, list) or len(bloky) > MAX_BLOKU:
            raise ApiError("Neplatná sestava plochy.")
        if not isinstance(sloupce, int) or not 1 <= sloupce <= MAX_SLOUPCU:
            raise ApiError("Počet sloupců musí být 1 až 4.")

        ocistene = []
        for blok in bloky:
            if not isinstance(blok, dict):
                raise ApiError("Neplatný blok.")

            typ = blok.get("type")
            ident = blok.get("id")
            if not isinstance(typ, str) or not isinstance(ident, str):
                raise ApiError("Neplatný blok.")

            novy: dict[str, Any] = {"id": ident[:40], "type": typ[:40]}

            nadpis = blok.get("title")
            if isinstance(nadpis, str) and nadpis.strip():
                novy["title"] = nadpis.strip()[:60]

            # Šířka bloku ve sloupcích. Víc než má plocha sloupců nejde.
            sirka = blok.get("cols")
            if isinstance(sirka, int) and 1 <= sirka <= sloupce:
                novy["cols"] = sirka

            entity = blok.get("entities")
            if isinstance(entity, list):
                # Co už v Home Assistantu není, se tiše vynechá.
                novy["entities"] = [
                    ref
                    for item in entity[:MAX_V_BLOKU]
                    if isinstance(item, str)
                    and (ref := refs.normalize_ref(self.hass, item)) is not None
                ]

            # Velikost jednotlivých dlaždic. Klíčem je stabilní reference.
            velikosti = blok.get("sizes")
            if isinstance(velikosti, dict):
                novy["sizes"] = {
                    ref: velikost
                    for klic, velikost in velikosti.items()
                    if isinstance(klic, str)
                    and velikost in VELIKOSTI_DLAZDIC
                    and (ref := refs.normalize_ref(self.hass, klic)) is not None
                }

            ocistene.append(novy)

        await settings.set_board(preset, sloupce, ocistene)
        return web.json_response({"ok": True})


class FavoritesView(Sh4uView):
    """Celý seznam často používaných.

    Používá se při výměně jednoho místa i při přeskládání. Posílá se vždy
    celý seznam, takže se nemůže rozejít pořadí s obsahem.
    """

    url = f"{API_BASE}/favorites"
    name = "api:smarthome4u:favorites"

    @handler
    async def post(self, request: web.Request) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        payload = await self.body(request)
        seznam = payload.get("entities")

        if not isinstance(seznam, list) or len(seznam) > 60:
            raise ApiError("Neplatný seznam.")

        ocistene = []
        for item in seznam:
            if not isinstance(item, str):
                raise ApiError("Neplatný seznam.")
            # Co už v Home Assistantu není, se tiše vynechá.
            entity_ref = refs.normalize_ref(self.hass, item)
            if entity_ref is not None:
                ocistene.append(entity_ref)

        await settings.set_favorites(ocistene)
        return web.json_response({"ok": True})


class ClassifyView(Sh4uView):
    """Ruční oprava zařazení entity.

    Home Assistant hlásí jako světlo i kontrolky. Podle názvu to poznat
    nesmíme, takže to musí jít opravit ručně.
    """

    url = f"{API_BASE}/entities/{{entity_id}}/classify"
    name = "api:smarthome4u:entity:classify"

    @handler
    @technician
    async def post(self, request: web.Request, entity_id: str) -> web.Response:
        settings = self.settings
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        if self.hass.states.get(entity_id) is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")

        payload = await self.body(request)

        kind = payload.get("kind")
        if kind is not None and kind not in capability.PRERADITELNE:
            raise ApiError("Na tenhle typ to přeřadit nejde.")

        hidden = payload.get("hidden")
        if hidden is not None and not isinstance(hidden, bool):
            raise ApiError("Neplatný požadavek.")

        await settings.set_override(self.entity_ref(entity_id), kind, hidden)
        return web.json_response({"ok": True})


class FavoriteView(Sh4uView):
    url = f"{API_BASE}/favorites/{{entity_id}}"
    name = "api:smarthome4u:favorite"

    @handler
    async def post(self, request: web.Request, entity_id: str) -> web.Response:
        settings = self.presentation(request)
        if settings is None:
            raise ApiError("Nastavení není k dispozici.", 503, "not_ready")

        if self.hass.states.get(entity_id) is None:
            raise ApiError("Zařízení už neexistuje.", 404, "unknown_entity")

        pridano = await settings.toggle_favorite(self.entity_ref(entity_id))
        return web.json_response({"ok": True, "favorite": pridano})


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
    AutomationBuildView,
    AutomationModelView,
    AutomationDeleteView,
    ScenesView,
    SceneDeleteView,
    SettingsView,
    RoleView,
    SystemView,
    UpdateInstallView,
    KioskView,
    LayoutView,
    FloorplanView,
    FloorplanImageView,
    ClassifyView,
    FavoriteView,
    FavoritesView,
    DashboardView,
)


def register(hass: HomeAssistant) -> None:
    for view in VIEWS:
        hass.http.register_view(view(hass))
