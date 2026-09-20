"""Interní Smarthome4u API a servírování frontendu.

Frontend nikdy nemluví přímo s Home Assistantem. Mluví jen s tímto API.
Backend validuje každý vstup - frontend nesmí zavolat libovolnou HA službu
ani zapsat libovolné pole do registru.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Awaitable, Callable

from aiohttp import web

from . import capability, templates
from .broadcast import Broadcaster
from .ha.client import HaClient, HaCommandError
from .model import HomeModel

_LOGGER = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent / "web"
PORT = 8099
MAX_NAME = 80


@web.middleware
async def _no_cache(request: web.Request, handler):
    """Prohlížeč si nesmí nechat starou verzi rozhraní.

    Aplikace běží v iframe a ten drží skripty v cache velmi tvrdě. Bez tohohle
    zůstane po aktualizaci doplňku viset staré UI.
    """
    response = await handler(request)
    if not isinstance(response, web.WebSocketResponse):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def create_app(
    client: HaClient,
    model: HomeModel,
    broadcaster: Broadcaster,
    reload_home: Callable[[], Awaitable[None]],
) -> web.Application:
    app = web.Application(middlewares=[_no_cache])
    app["client"] = client
    app["model"] = model
    app["broadcaster"] = broadcaster
    app["reload"] = reload_home

    app.router.add_get("/", _index)
    app.router.add_get("/api/health", _health)
    app.router.add_get("/api/model", _get_model)
    app.router.add_get("/api/sections/{kind}", _get_section)
    app.router.add_get("/api/devices", _get_devices)
    app.router.add_get("/api/devices/{device_id}", _get_device)
    app.router.add_post("/api/devices/{device_id}", _update_device)
    app.router.add_post("/api/entities/{entity_id}", _update_entity)
    app.router.add_get("/api/structure", _get_structure)
    app.router.add_post("/api/structure/areas", _create_area)
    app.router.add_post("/api/structure/areas/{area_id}", _update_area)
    app.router.add_post("/api/structure/areas/{area_id}/delete", _delete_area)
    app.router.add_post("/api/structure/floors", _create_floor)
    app.router.add_post("/api/structure/floors/{floor_id}", _update_floor)
    app.router.add_post("/api/structure/floors/{floor_id}/delete", _delete_floor)
    app.router.add_get("/api/discovered", _get_discovered)
    app.router.add_get("/api/templates", _get_templates)
    app.router.add_post("/api/automations", _create_automation)
    app.router.add_post("/api/automations/{automation_id}/delete", _delete_automation)
    app.router.add_post("/api/scenes", _create_scene)
    app.router.add_post("/api/scenes/{scene_id}/delete", _delete_scene)
    app.router.add_post("/api/action", _post_action)
    app.router.add_get("/api/stream", broadcaster.handle)
    app.router.add_static("/static", WEB_DIR)

    return app


# ----------------------------------------------------------------------
# Pomocné
# ----------------------------------------------------------------------


def _ingress_user(request: web.Request) -> dict[str, Any]:
    """Přihlášený uživatel podle Ingress hlaviček od Supervisoru.

    Role je zatím vždy "user". Technický režim se zapne, až bude backend umět
    ověřit, že je uživatel v Home Assistantu administrátor.
    """
    return {
        "id": request.headers.get("X-Remote-User-Id"),
        "name": request.headers.get("X-Remote-User-Display-Name")
        or request.headers.get("X-Remote-User-Name"),
        "role": "user",
    }


def _error(status: int, code: str, message: str) -> web.Response:
    """Uživatel nikdy nevidí stack trace. Jen srozumitelnou větu a kód."""
    return web.json_response({"error": code, "message": message}, status=status)


async def _body(request: web.Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError as err:
        raise _Invalid("Neplatný požadavek.") from err
    if not isinstance(payload, dict):
        raise _Invalid("Neplatný požadavek.")
    return payload


class _Invalid(Exception):
    """Vstup od frontendu neprošel kontrolou."""


def _name(payload: dict[str, Any], key: str = "name") -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise _Invalid("Zadejte prosím název.")
    if len(value) > MAX_NAME:
        raise _Invalid(f"Název může mít nejvýš {MAX_NAME} znaků.")
    return value.strip()


def _require_connection(client: HaClient) -> None:
    if not client.connected.is_set():
        raise _Offline()


class _Offline(Exception):
    """Home Assistant není dostupný."""


def guard(handler):
    """Převede výjimky na srozumitelnou odpověď bez stack trace."""

    async def wrapper(request: web.Request) -> web.Response:
        try:
            return await handler(request)
        except _Invalid as err:
            return _error(400, "invalid_request", str(err))
        except _Offline:
            return _error(
                503,
                "not_connected",
                "Home Assistant není dostupný. Domácnost funguje dál.",
            )
        except capability.ActionNotAllowed:
            return _error(400, "action_not_allowed", "Tuto akci nelze provést.")
        except templates.TemplateError as err:
            return _error(400, "template_error", str(err))
        except HaCommandError as err:
            _LOGGER.warning("%s selhalo: %s", handler.__name__, err)
            return _error(
                502,
                "ha_error",
                "Home Assistant požadavek odmítl. Zkuste to prosím v Home Assistantu.",
            )

    wrapper.__name__ = handler.__name__
    return wrapper


async def _refresh(request: web.Request) -> None:
    """Po zápisu do registru přenačte model a řekne prohlížeči, ať se obnoví."""
    await request.app["reload"]()
    request.app["broadcaster"].note("structure", "")


# ----------------------------------------------------------------------
# Čtení
# ----------------------------------------------------------------------


async def _index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")


async def _health(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    return web.json_response(
        {
            "connected": client.connected.is_set(),
            "haVersion": client.ha_version,
            "modelLoaded": model.loaded,
            "lastError": client.last_error,
        }
    )


async def _get_model(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]

    return web.json_response(
        {
            "haVersion": model.ha_version,
            "generation": model.generation,
            "loaded": model.loaded,
            "connected": client.connected.is_set(),
            "user": _ingress_user(request),
            "summary": model.summary(),
            "rooms": model.rooms(),
        }
    )


@guard
async def _get_section(request: web.Request) -> web.Response:
    model: HomeModel = request.app["model"]
    kind = request.match_info["kind"]

    if kind == "scenes":
        return web.json_response(
            {"scenes": model.by_kind("scene"), "scripts": model.by_kind("script")}
        )
    if kind == "automations":
        return web.json_response({"automations": model.by_kind("automation")})

    raise _Invalid("Neznámá sekce.")


async def _get_devices(request: web.Request) -> web.Response:
    model: HomeModel = request.app["model"]
    return web.json_response({"devices": model.device_list()})


@guard
async def _get_device(request: web.Request) -> web.Response:
    model: HomeModel = request.app["model"]
    detail = model.device_detail(request.match_info["device_id"])
    if detail is None:
        return _error(404, "unknown_device", "Zařízení už neexistuje.")
    return web.json_response(detail)


async def _get_structure(request: web.Request) -> web.Response:
    model: HomeModel = request.app["model"]
    return web.json_response(model.structure())


@guard
async def _get_discovered(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    _require_connection(client)

    flows = await client.discovered_flows()
    found = [
        {
            "flowId": flow.get("flow_id"),
            "handler": flow.get("handler"),
            "title": flow.get("context", {}).get("title_placeholders", {}).get("name")
            or flow.get("handler"),
            "source": flow.get("context", {}).get("source"),
        }
        for flow in flows
        if isinstance(flow, dict)
    ]
    return web.json_response({"discovered": found})


async def _get_templates(request: web.Request) -> web.Response:
    return web.json_response({"templates": templates.TEMPLATES})


# ----------------------------------------------------------------------
# Ovládání
# ----------------------------------------------------------------------


@guard
async def _post_action(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    payload = await _body(request)

    entity_id = payload.get("entityId")
    action = payload.get("action")

    if not isinstance(entity_id, str) or not isinstance(action, str):
        raise _Invalid("Chybí zařízení nebo akce.")

    entity = model.find(entity_id)
    if entity is None:
        return _error(404, "unknown_entity", "Zařízení už neexistuje.")

    domain, service, data = capability.resolve_action(
        entity.capability.get("kind", "unsupported"),
        entity.domain,
        action,
        payload.get("value"),
    )

    _require_connection(client)
    await client.call_action(domain, service, entity_id, data)
    return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Zařízení a entity
# ----------------------------------------------------------------------


@guard
async def _update_device(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    device_id = request.match_info["device_id"]

    if device_id not in model.devices:
        return _error(404, "unknown_device", "Zařízení už neexistuje.")

    payload = await _body(request)
    changes: dict[str, Any] = {}

    if "name" in payload:
        changes["name_by_user"] = _name(payload)
    if "areaId" in payload:
        changes["area_id"] = _area_or_none(model, payload["areaId"])

    if not changes:
        raise _Invalid("Není co uložit.")

    _require_connection(client)
    await client.update_device(device_id, **changes)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _update_entity(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    entity_id = request.match_info["entity_id"]

    entity = model.find(entity_id)
    if entity is None:
        return _error(404, "unknown_entity", "Zařízení už neexistuje.")
    if entity.registry_id is None:
        raise _Invalid(
            "Tuhle položku nejde přejmenovat odsud. Vznikla mimo registr "
            "Home Assistantu."
        )

    payload = await _body(request)
    changes: dict[str, Any] = {}

    if "name" in payload:
        changes["name"] = _name(payload)
    if "areaId" in payload:
        changes["area_id"] = _area_or_none(model, payload["areaId"])

    if not changes:
        raise _Invalid("Není co uložit.")

    _require_connection(client)
    await client.update_entity(entity_id, **changes)
    await _refresh(request)
    return web.json_response({"ok": True})


def _area_or_none(model: HomeModel, value: Any) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str) or value not in model.areas:
        raise _Invalid("Taková místnost neexistuje.")
    return value


# ----------------------------------------------------------------------
# Patra a místnosti
# ----------------------------------------------------------------------


@guard
async def _create_area(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    payload = await _body(request)

    floor_id = payload.get("floorId")
    if floor_id not in (None, "") and floor_id not in model.floors:
        raise _Invalid("Takové patro neexistuje.")

    _require_connection(client)
    await client.create_area(_name(payload), floor_id or None)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _update_area(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    area_id = request.match_info["area_id"]

    if area_id not in model.areas:
        return _error(404, "unknown_area", "Místnost už neexistuje.")

    payload = await _body(request)
    changes: dict[str, Any] = {}

    if "name" in payload:
        changes["name"] = _name(payload)
    if "floorId" in payload:
        floor_id = payload["floorId"]
        if floor_id not in (None, "") and floor_id not in model.floors:
            raise _Invalid("Takové patro neexistuje.")
        changes["floor_id"] = floor_id or None

    if not changes:
        raise _Invalid("Není co uložit.")

    _require_connection(client)
    await client.update_area(area_id, **changes)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _delete_area(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    area_id = request.match_info["area_id"]

    if area_id not in model.areas:
        return _error(404, "unknown_area", "Místnost už neexistuje.")

    _require_connection(client)
    # Smazání místnosti nemaže zařízení. Ta jen zůstanou nezařazená.
    await client.delete_area(area_id)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _create_floor(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    payload = await _body(request)
    level = payload.get("level", 0)
    if not isinstance(level, int) or not -10 <= level <= 50:
        raise _Invalid("Podlaží musí být celé číslo.")

    _require_connection(client)
    await client.create_floor(_name(payload), level)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _update_floor(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    floor_id = request.match_info["floor_id"]

    if floor_id not in model.floors:
        return _error(404, "unknown_floor", "Patro už neexistuje.")

    payload = await _body(request)
    changes: dict[str, Any] = {}

    if "name" in payload:
        changes["name"] = _name(payload)
    if "level" in payload:
        level = payload["level"]
        if not isinstance(level, int) or not -10 <= level <= 50:
            raise _Invalid("Podlaží musí být celé číslo.")
        changes["level"] = level

    if not changes:
        raise _Invalid("Není co uložit.")

    _require_connection(client)
    await client.update_floor(floor_id, **changes)
    await _refresh(request)
    return web.json_response({"ok": True})


@guard
async def _delete_floor(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    floor_id = request.match_info["floor_id"]

    if floor_id not in model.floors:
        return _error(404, "unknown_floor", "Patro už neexistuje.")

    _require_connection(client)
    await client.delete_floor(floor_id)
    await _refresh(request)
    return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Automatizace
# ----------------------------------------------------------------------


@guard
async def _create_automation(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    payload = await _body(request)

    template_id = payload.get("templateId")
    data = payload.get("data")
    if not isinstance(template_id, str) or not isinstance(data, dict):
        raise _Invalid("Chybí šablona nebo výběr zařízení.")

    automation_id, config = templates.build(template_id, _name(payload), data)

    _require_connection(client)
    await client.save_automation(automation_id, config)
    await _refresh(request)
    return web.json_response({"ok": True, "id": automation_id})


@guard
async def _delete_automation(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    automation_id = request.match_info["automation_id"]

    _require_connection(client)
    await client.delete_automation(automation_id)
    await _refresh(request)
    return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Scény
# ----------------------------------------------------------------------

# Schopnosti, jejichž stav má smysl uložit do scény.
SNAPSHOT_KINDS = frozenset({"light", "switch", "cover", "climate", "fan"})

# Atributy ukládané do scény podle schopnosti.
SNAPSHOT_ATTRIBUTES = {
    "light": ("brightness", "color_temp_kelvin", "rgb_color"),
    "cover": ("current_position",),
    "climate": ("temperature",),
    "fan": ("percentage",),
}


@guard
async def _create_scene(request: web.Request) -> web.Response:
    """Uloží aktuální stav místnosti jako scénu."""
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]
    payload = await _body(request)

    area_id = payload.get("areaId")
    if not isinstance(area_id, str) or area_id not in model.areas:
        raise _Invalid("Vyberte prosím místnost.")

    snapshot: dict[str, Any] = {}
    for entity in model.entities.values():
        if entity.area_id != area_id:
            continue
        kind = entity.capability.get("kind")
        if kind not in SNAPSHOT_KINDS or not entity.available:
            continue

        record: dict[str, Any] = {"state": entity.state}
        for key in SNAPSHOT_ATTRIBUTES.get(kind, ()):
            if entity.attributes.get(key) is not None:
                record[key] = entity.attributes[key]
        snapshot[entity.entity_id] = record

    if not snapshot:
        raise _Invalid("V téhle místnosti není co uložit.")

    scene_id = str(int(time.time() * 1000))
    _require_connection(client)
    await client.save_scene(
        scene_id, {"id": scene_id, "name": _name(payload), "entities": snapshot}
    )
    await _refresh(request)
    return web.json_response({"ok": True, "id": scene_id, "count": len(snapshot)})


@guard
async def _delete_scene(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    _require_connection(client)
    await client.delete_scene(request.match_info["scene_id"])
    await _refresh(request)
    return web.json_response({"ok": True})


# ----------------------------------------------------------------------
# Spuštění
# ----------------------------------------------------------------------


async def start(app: web.Application) -> web.AppRunner:
    runner = web.AppRunner(app)
    await runner.setup()

    # Bez "ports" v config.yaml je port dostupný jen přes Supervisor ingress.
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()

    _LOGGER.info("Smarthome4u poslouchá na portu %s", PORT)
    return runner
