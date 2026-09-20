"""Smarthome4u - uživatelské rozhraní nad Home Assistantem.

Integrace registruje vlastní panel, servíruje jeho soubory, vystavuje interní
API a volitelně schová postranní lištu Home Assistantu, aby působila jako
nadstavba, ne jako další položka v menu.

Tenhle soubor Home Assistant importuje jako první, ještě před config_flow.
Když by tu import spadl, uživatel uvidí jen "Invalid handler specified".
Proto se tady importuje jen to, co je jisté, a zbytek až za běhu.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    OPT_HIDE_SIDEBAR,
    OPT_LANDING,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    STATIC_URL,
    TAKEOVER_URL,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

WEBCOMPONENT = "smarthome4u-panel"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Spustí rozhraní. Každý krok hlásí, co dělá, ať jde chyba dohledat."""
    _LOGGER.info("Smarthome4u %s se spouští", VERSION)

    # Import až tady. Kdyby některý modul nešel načíst, nesmí to zabránit
    # tomu, aby šla integrace vůbec přidat.
    from homeassistant.components import frontend, panel_custom
    from homeassistant.components.http import StaticPathConfig

    from . import api

    store = hass.data.setdefault(DOMAIN, {})

    if not store.get("static"):
        folder = Path(__file__).parent / "frontend"
        if not folder.is_dir():
            _LOGGER.error(
                "Chybí složka %s. Stažení přes HACS nebylo úplné.", folder
            )
            return False

        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(folder), False)]
        )
        store["static"] = True
        _LOGGER.debug("Soubory rozhraní se servírují z %s", STATIC_URL)

    if not store.get("api"):
        api.register(hass)
        store["api"] = True
        _LOGGER.debug("Interní API je registrované")

    hide_sidebar = entry.options.get(OPT_HIDE_SIDEBAR, True)
    landing = entry.options.get(OPT_LANDING, True)

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=WEBCOMPONENT,
        module_url=f"{STATIC_URL}/panel.js",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        embed_iframe=False,
        require_admin=False,
        config={"hideSidebar": hide_sidebar, "landing": landing},
    )

    # Modul běží uvnitř frontendu Home Assistantu. Z iframu by to nešlo.
    if hide_sidebar or landing:
        frontend.add_extra_js_url(hass, TAKEOVER_URL)

    entry.async_on_unload(entry.add_update_listener(_reload))
    _LOGGER.info("Smarthome4u je připravené na /%s", PANEL_URL)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, PANEL_URL)
    return True


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
