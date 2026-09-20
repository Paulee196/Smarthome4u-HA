"""Ověření, že integraci jde vůbec přidat a spustit.

Tenhle test pokrývá chybu "Invalid handler specified", kterou Home Assistant
hlásí, když se nepodaří načíst config_flow. Pouhý import modulů ji neodhalí.

Testovací prostředí neumí spustit celý frontend Home Assistantu - má desítky
vlastních závislostí. Označíme ho tedy za spuštěný a naše volání do něj
odchytíme. Testuje se naše logika, ne cizí kód.
"""

from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smarthome4u.const import DOMAIN, PANEL_URL, STATIC_URL


@pytest.fixture
def frontend_je_pripraveny(hass: HomeAssistant):
    """Tváří se, že frontend a panel_custom už běží."""
    hass.config.components.add("frontend")
    hass.config.components.add("panel_custom")

    with (
        patch(
            "homeassistant.components.panel_custom.async_register_panel"
        ) as registrace,
        patch("homeassistant.components.frontend.add_extra_js_url") as vlozeni,
        patch("homeassistant.components.frontend.async_remove_panel"),
    ):
        yield {"panel": registrace, "takeover": vlozeni}


async def test_pruvodce_se_otevre(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Config flow je zaregistrovaný.

    Kdyby ne, Home Assistant hlásí "Invalid handler specified".
    """
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == "form", f"Průvodce se neotevřel: {result}"
    assert result["step_id"] == "user"


async def test_pridani_a_spusteni(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Integrace se přidá a načte."""
    assert await async_setup_component(hass, "http", {})

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry", f"Přidání selhalo: {result}"

    await hass.async_block_till_done()

    entries = hass.config_entries.async_entries(DOMAIN)
    assert len(entries) == 1
    assert entries[0].state is config_entries.ConfigEntryState.LOADED


async def test_panel_a_prevzeti(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Panel se registruje a takeover.js se vkládá do frontendu."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    registrace = frontend_je_pripraveny["panel"]
    assert registrace.called, "Panel se nezaregistroval"
    assert registrace.call_args.kwargs["frontend_url_path"] == PANEL_URL
    assert registrace.call_args.kwargs["module_url"] == f"{STATIC_URL}/panel.js"

    assert frontend_je_pripraveny["takeover"].called, "takeover.js se nevložil"


async def test_api_odpovida(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Interní API vrací model domácnosti."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.get("/api/smarthome4u/model")
    assert response.status == 200, await response.text()

    data = await response.json()
    assert "rooms" in data
    assert "summary" in data
    assert data["user"]["id"]


async def test_akce_mimo_seznam_se_odmitne(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Frontend nesmí zavolat libovolnou službu Home Assistantu."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set("light.test", "off", {"supported_color_modes": ["onoff"]})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.post(
        "/api/smarthome4u/action",
        json={"entityId": "light.test", "action": "vymazat_vsechno"},
    )
    assert response.status == 400
    assert (await response.json())["error"] == "action_not_allowed"
