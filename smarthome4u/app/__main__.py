"""Vstupní bod aplikace Smarthome4u.

Startovní sekvence podle docs/ZADANI.md kap. 22:
zjistit spojení a verzi HA, načíst registry, sestavit model, navázat
realtime subscription, zpřístupnit UI.

Server se spouští jako první, aby uživatel viděl "Připojuji se..." místo
rozbité stránky, když Home Assistant Core ještě nenaběhl.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import aiohttp

from . import server
from .broadcast import Broadcaster
from .ha import version as ha_version
from .ha.client import HaClient
from .model import HomeModel

_LOGGER = logging.getLogger("smarthome4u")


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)


async def _load_home(
    client: HaClient, model: HomeModel, broadcaster: Broadcaster
) -> None:
    """Načte celý model. Volá se po každém připojení, i po reconnectu."""
    gate = ha_version.check(client.ha_version)
    if gate["status"] != "ok":
        _LOGGER.warning(
            "Home Assistant %s je mimo otestovaný rozsah (%s). "
            "Čtení a ovládání běží dál, zápisové operace jsou neověřené.",
            client.ha_version,
            gate["status"],
        )

    await _refresh_model(client, model)

    await client.subscribe_state_changes()
    _LOGGER.info("Realtime sledování změn je aktivní")

    # Po reconnectu má prohlížeč načíst model znovu.
    broadcaster.note("structure", "")


async def _refresh_model(client: HaClient, model: HomeModel) -> None:
    """Přenačte registry a stavy. Volá se i po změně místnosti nebo názvu."""
    model.rebuild(
        ha_version=client.ha_version,
        floors=await client.list_floors(),
        areas=await client.list_areas(),
        devices=await client.list_devices(),
        entities=await client.list_entities(),
        states=await client.get_states(),
        config_entries=await client.list_config_entries(),
    )


async def main() -> int:
    _setup_logging()

    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        _LOGGER.error(
            "Chybí SUPERVISOR_TOKEN. Aplikace musí běžet jako Home Assistant App "
            "s homeassistant_api: true."
        )
        return 1

    model = HomeModel()
    broadcaster = Broadcaster(model)

    async with aiohttp.ClientSession() as session:
        client = HaClient(token, session)

        def on_event(event: dict) -> None:
            if event.get("event_type") != "state_changed":
                return
            entity_id = (event.get("data") or {}).get("entity_id", "")
            broadcaster.note(model.apply_state_change(event), entity_id)

        client.add_event_handler(on_event)
        client.set_ready_handler(lambda: _load_home(client, model, broadcaster))

        app = server.create_app(
            client, model, broadcaster, lambda: _refresh_model(client, model)
        )
        runner = await server.start(app)
        pump = asyncio.create_task(broadcaster.run())

        try:
            await client.run()
        except asyncio.CancelledError:
            _LOGGER.info("Smarthome4u se ukončuje")
        finally:
            pump.cancel()
            await runner.cleanup()

    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
    except KeyboardInterrupt:
        exit_code = 0

    raise SystemExit(exit_code)
