"""Interní Smarthome4u API a servírování frontendu.

Frontend nikdy nemluví přímo s Home Assistantem. Mluví jen s tímto API.
Backend validuje každý vstup - frontend nesmí zavolat libovolnou HA službu.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from aiohttp import web

from . import capability
from .broadcast import Broadcaster
from .ha.client import HaClient, HaCommandError
from .model import HomeModel

_LOGGER = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent / "web"
PORT = 8099


def create_app(
    client: HaClient, model: HomeModel, broadcaster: Broadcaster
) -> web.Application:
    app = web.Application()
    app["client"] = client
    app["model"] = model
    app["broadcaster"] = broadcaster

    app.router.add_get("/", _index)
    app.router.add_get("/api/health", _health)
    app.router.add_get("/api/model", _get_model)
    app.router.add_post("/api/action", _post_action)
    app.router.add_get("/api/stream", broadcaster.handle)
    app.router.add_static("/static", WEB_DIR)

    return app


# ----------------------------------------------------------------------
# Identita uživatele
# ----------------------------------------------------------------------


def _ingress_user(request: web.Request) -> dict[str, Any]:
    """Přihlášený uživatel podle Ingress hlaviček od Supervisoru.

    Role je v v0.1 vždy "user". Technický režim se zapne až ve v1.0, kdy
    bude backend umět ověřit, že je uživatel v Home Assistantu administrátor.
    """
    return {
        "id": request.headers.get("X-Remote-User-Id"),
        "name": request.headers.get("X-Remote-User-Display-Name")
        or request.headers.get("X-Remote-User-Name"),
        "role": "user",
    }


# ----------------------------------------------------------------------
# Routes
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

    payload = model.to_dict()
    payload["connected"] = client.connected.is_set()
    payload["user"] = _ingress_user(request)

    return web.json_response(payload)


async def _post_action(request: web.Request) -> web.Response:
    client: HaClient = request.app["client"]
    model: HomeModel = request.app["model"]

    try:
        body = await request.json()
    except ValueError:
        return _error(400, "invalid_request", "Neplatný požadavek.")

    entity_id = body.get("entityId")
    action = body.get("action")

    if not isinstance(entity_id, str) or not isinstance(action, str):
        return _error(400, "invalid_request", "Chybí entita nebo akce.")

    entity = model.find(entity_id)
    if entity is None:
        return _error(404, "unknown_entity", "Zařízení už neexistuje.")

    kind = entity.capability.get("kind", "unsupported")
    resolved = capability.resolve_action(kind, action)
    if resolved is None:
        return _error(400, "action_not_allowed", "Tuto akci nelze provést.")

    domain, service = resolved

    if not client.connected.is_set():
        return _error(
            503,
            "not_connected",
            "Home Assistant není dostupný. Domácnost funguje dál.",
        )

    try:
        await client.call_action(domain, service, entity_id)
    except HaCommandError as err:
        _LOGGER.warning("Akce %s.%s na %s selhala: %s", domain, service, entity_id, err)
        return _error(502, "ha_error", "Home Assistant akci odmítl.")

    return web.json_response({"ok": True})


def _error(status: int, code: str, message: str) -> web.Response:
    """Uživatel nikdy nevidí stack trace. Jen srozumitelnou větu a kód."""
    return web.json_response({"error": code, "message": message}, status=status)


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
