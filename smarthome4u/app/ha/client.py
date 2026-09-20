"""Home Assistant Adapter.

JEDINÝ modul produktu, který smí znát konkrétní Home Assistant API
a WebSocket commandy.

Když Home Assistant změní formát, mění se tento soubor - ne obrazovky.

Každý command použitý zde musí být zapsán v docs/HA_COMPATIBILITY.md.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

import aiohttp

_LOGGER = logging.getLogger(__name__)

# Supervisor proxy na Home Assistant Core. Vyžaduje homeassistant_api: true.
WS_URL = "ws://supervisor/core/websocket"

COMMAND_TIMEOUT = 30
MAX_BACKOFF = 60


class HaCommandError(Exception):
    """Home Assistant command selhal."""


class HaClient:
    """WebSocket klient Home Assistantu s automatickým znovupřipojením."""

    def __init__(self, token: str, session: aiohttp.ClientSession) -> None:
        self._token = token
        self._session = session
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._next_id = 0
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._event_handlers: list[Callable[[dict], None]] = []
        self._on_ready: Callable[[], Awaitable[None]] | None = None

        self.ha_version: str | None = None
        self.connected = asyncio.Event()
        self.last_error: str | None = None

    # ------------------------------------------------------------------
    # Životní cyklus spojení
    # ------------------------------------------------------------------

    def set_ready_handler(self, handler: Callable[[], Awaitable[None]]) -> None:
        """Zavolá se pokaždé po úspěšném přihlášení, i po reconnectu."""
        self._on_ready = handler

    def add_event_handler(self, handler: Callable[[dict], None]) -> None:
        self._event_handlers.append(handler)

    async def run(self) -> None:
        """Nekonečná smyčka spojení. Nikdy nespadne do crash loopu."""
        backoff = 1
        while True:
            try:
                await self._connect_once()
                backoff = 1
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 - chceme přežít cokoliv
                self.last_error = str(err)
                _LOGGER.warning(
                    "Spojení s Home Assistantem selhalo (%s). "
                    "Zkusím znovu za %s s.",
                    err,
                    backoff,
                )
            finally:
                self._teardown()

            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)

    async def _connect_once(self) -> None:
        async with self._session.ws_connect(WS_URL, heartbeat=30) as ws:
            self._ws = ws
            await self._authenticate(ws)

            self.connected.set()
            self.last_error = None
            _LOGGER.info("Připojeno k Home Assistantu %s", self.ha_version)

            receiver = asyncio.create_task(self._receive_loop(ws))
            try:
                if self._on_ready is not None:
                    await self._on_ready()
                await receiver
            finally:
                receiver.cancel()

    async def _authenticate(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        # HA_COMPATIBILITY: auth - veřejné WebSocket API
        first = await ws.receive_json(timeout=COMMAND_TIMEOUT)
        if first.get("type") != "auth_required":
            raise HaCommandError(
                f"Neočekávaná odpověď při přihlášení: {first.get('type')}"
            )

        await ws.send_json({"type": "auth", "access_token": self._token})
        result = await ws.receive_json(timeout=COMMAND_TIMEOUT)

        if result.get("type") != "auth_ok":
            # Token do logu nepatří ani při chybě.
            raise HaCommandError("Home Assistant odmítl přihlášení aplikace")

        self.ha_version = result.get("ha_version")

    def _teardown(self) -> None:
        self.connected.clear()
        self._ws = None
        for future in self._pending.values():
            if not future.done():
                future.set_exception(HaCommandError("Spojení bylo přerušeno"))
        self._pending.clear()

    # ------------------------------------------------------------------
    # Příjem zpráv
    # ------------------------------------------------------------------

    async def _receive_loop(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        async for message in ws:
            if message.type is not aiohttp.WSMsgType.TEXT:
                break

            try:
                payload = message.json()
            except ValueError:
                _LOGGER.warning("Home Assistant poslal neplatný JSON")
                continue

            kind = payload.get("type")
            if kind == "result":
                self._resolve(payload)
            elif kind == "event":
                self._dispatch(payload.get("event") or {})

        raise HaCommandError("Home Assistant ukončil spojení")

    def _resolve(self, payload: dict) -> None:
        future = self._pending.pop(payload.get("id"), None)
        if future is None or future.done():
            return

        if payload.get("success"):
            future.set_result(payload.get("result"))
        else:
            error = payload.get("error") or {}
            future.set_exception(
                HaCommandError(error.get("message", "neznámá chyba"))
            )

    def _dispatch(self, event: dict) -> None:
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception:  # noqa: BLE001 - jeden handler nesmí shodit ostatní
                _LOGGER.exception("Chyba při zpracování události z Home Assistantu")

    # ------------------------------------------------------------------
    # Odesílání commandů
    # ------------------------------------------------------------------

    async def _send(self, **payload: Any) -> Any:
        ws = self._ws
        if ws is None or ws.closed:
            raise HaCommandError("Není spojení s Home Assistantem")

        self._next_id += 1
        command_id = self._next_id
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[command_id] = future

        await ws.send_json({"id": command_id, **payload})

        try:
            return await asyncio.wait_for(future, timeout=COMMAND_TIMEOUT)
        except asyncio.TimeoutError as err:
            self._pending.pop(command_id, None)
            raise HaCommandError(
                f"Home Assistant neodpověděl na {payload.get('type')}"
            ) from err

    async def _send_optional(self, default: Any, **payload: Any) -> Any:
        """Command, jehož selhání nesmí shodit aplikaci.

        Používá se pro interní registry commandy, které nejsou veřejná
        smlouva. Fallback je zapsaný v docs/HA_COMPATIBILITY.md.
        """
        try:
            return await self._send(**payload)
        except HaCommandError as err:
            _LOGGER.warning(
                "Command %s selhal (%s), pokračuji bez něj.",
                payload.get("type"),
                err,
            )
            return default

    # ------------------------------------------------------------------
    # Veřejné rozhraní adaptéru
    # ------------------------------------------------------------------

    async def get_config(self) -> dict:
        """HA_COMPATIBILITY: get_config - veřejné WebSocket API."""
        return await self._send(type="get_config")

    async def get_states(self) -> list[dict]:
        """HA_COMPATIBILITY: get_states - veřejné WebSocket API."""
        return await self._send(type="get_states")

    async def list_floors(self) -> list[dict]:
        """HA_COMPATIBILITY: config/floor_registry/list - INTERNÍ command."""
        return await self._send_optional([], type="config/floor_registry/list")

    async def list_areas(self) -> list[dict]:
        """HA_COMPATIBILITY: config/area_registry/list - INTERNÍ command."""
        return await self._send_optional([], type="config/area_registry/list")

    async def list_devices(self) -> list[dict]:
        """HA_COMPATIBILITY: config/device_registry/list - INTERNÍ command."""
        return await self._send_optional([], type="config/device_registry/list")

    async def list_entities(self) -> list[dict]:
        """HA_COMPATIBILITY: config/entity_registry/list - INTERNÍ command."""
        return await self._send_optional([], type="config/entity_registry/list")

    async def subscribe_state_changes(self) -> None:
        """HA_COMPATIBILITY: subscribe_events - veřejné WebSocket API."""
        await self._send(type="subscribe_events", event_type="state_changed")

    async def call_action(
        self,
        domain: str,
        service: str,
        entity_id: str,
        data: dict | None = None,
    ) -> Any:
        """HA_COMPATIBILITY: call_service - veřejné WebSocket API."""
        return await self._send(
            type="call_service",
            domain=domain,
            service=service,
            target={"entity_id": entity_id},
            service_data=data or {},
        )
