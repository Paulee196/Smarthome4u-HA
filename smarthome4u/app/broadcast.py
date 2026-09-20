"""Přenos změn do prohlížeče.

Backend drží realtime stav z Home Assistantu. Prohlížeč se na nic neptá
dokola - dostane změnu, jakmile nastane.

Změny se slučují do krátkých dávek, aby velká domácnost s tisíci entitami
nezahltila slabý nástěnný tablet.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from aiohttp import web

if TYPE_CHECKING:
    from .model import HomeModel

_LOGGER = logging.getLogger(__name__)

# Jak dlouho se sbírají změny, než se odešlou jednou zprávou.
BATCH_SECONDS = 0.2


class Broadcaster:
    def __init__(self, model: "HomeModel") -> None:
        self._model = model
        self._sockets: set[web.WebSocketResponse] = set()
        self._changed: set[str] = set()
        self._structural = False
        self._wake = asyncio.Event()

    # ------------------------------------------------------------------
    # Zápis změn
    # ------------------------------------------------------------------

    def note(self, kind: str | None, entity_id: str) -> None:
        if kind is None:
            return
        if kind == "structure":
            self._structural = True
        else:
            self._changed.add(entity_id)
        self._wake.set()

    # ------------------------------------------------------------------
    # Odesílání
    # ------------------------------------------------------------------

    async def run(self) -> None:
        while True:
            await self._wake.wait()
            await asyncio.sleep(BATCH_SECONDS)
            self._wake.clear()

            structural = self._structural
            changed = self._changed
            self._structural = False
            self._changed = set()

            if not self._sockets:
                continue

            if structural:
                await self._send({"type": "reload"})
                continue

            updates = [
                entity.to_dict()
                for entity_id in changed
                if (entity := self._model.find(entity_id)) is not None
            ]
            if updates:
                await self._send({"type": "states", "entities": updates})

    async def _send(self, payload: dict) -> None:
        dead: list[web.WebSocketResponse] = []

        for socket in self._sockets:
            try:
                await socket.send_json(payload)
            except (ConnectionResetError, RuntimeError):
                dead.append(socket)

        for socket in dead:
            self._sockets.discard(socket)

    # ------------------------------------------------------------------
    # Připojení prohlížeče
    # ------------------------------------------------------------------

    async def handle(self, request: web.Request) -> web.WebSocketResponse:
        socket = web.WebSocketResponse(heartbeat=30)
        await socket.prepare(request)
        self._sockets.add(socket)

        try:
            async for _ in socket:
                # Prohlížeč nic neposílá. Akce jdou přes POST /api/action.
                pass
        finally:
            self._sockets.discard(socket)

        return socket
