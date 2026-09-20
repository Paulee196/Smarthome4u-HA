"""Ověření, že integraci jde vůbec přidat a spustit.

Tenhle test pokrývá chybu "Invalid handler specified", kterou Home Assistant
hlásí, když se nepodaří načíst config_flow. Pouhý import modulů ji neodhalí.
"""

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.smarthome4u.const import DOMAIN, PANEL_URL


async def test_pridani_a_spusteni(hass: HomeAssistant) -> None:
    """Průvodce se otevře, integrace se přidá a načte."""
    assert await async_setup_component(hass, "http", {})
    await hass.async_block_till_done()

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == "form", f"Průvodce se neotevřel: {result}"

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry", f"Přidání selhalo: {result}"

    await hass.async_block_till_done()

    entries = hass.config_entries.async_entries(DOMAIN)
    assert len(entries) == 1
    assert entries[0].state is config_entries.ConfigEntryState.LOADED


async def test_panel_se_zaregistruje(hass: HomeAssistant) -> None:
    """Po přidání se objeví panel v nabídce Home Assistantu."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert PANEL_URL in hass.data.get("frontend_panels", {})


async def test_api_odpovida(hass: HomeAssistant, hass_client) -> None:
    """Interní API vrací model domácnosti."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.get("/api/smarthome4u/model")
    assert response.status == 200

    data = await response.json()
    assert "rooms" in data
    assert "summary" in data
