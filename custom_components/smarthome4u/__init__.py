"""Smarthome4u - uživatelské rozhraní nad Home Assistantem.

Integrace registruje vlastní panel, servíruje jeho soubory, vystavuje interní
API a volitelně schová postranní lištu Home Assistantu, aby působila jako
nadstavba, ne jako další položka v menu.

Tenhle soubor Home Assistant importuje jako první, ještě před config_flow.
Když by tu import spadl, uživatel uvidí jen "Invalid handler specified".
Proto se tady importuje jen to, co je jisté, a zbytek až za běhu.

Každý krok spuštění se hlásí do logu. Když něco selže, musí být z logu vidět
co a proč - jinak uživatel dostane jen "Nastavení se nezdařilo".
"""

from __future__ import annotations

import contextlib
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
    """Spustí rozhraní."""
    _LOGGER.info("Smarthome4u %s se spouští", VERSION)

    # Import až tady. Kdyby některý modul nešel načíst, nesmí to zabránit
    # tomu, aby šla integrace vůbec přidat.
    try:
        from homeassistant.components import frontend, panel_custom
    except ImportError:
        _LOGGER.exception("Nepodařilo se načíst frontend Home Assistantu")
        return False

    from . import api
    from .storage import Settings

    store = hass.data.setdefault(DOMAIN, {})

    if "settings" not in store:
        settings = Settings(hass)
        try:
            await settings.load()
        except Exception:  # noqa: BLE001 - poškozený soubor nesmí shodit start
            _LOGGER.exception("Nastavení se nepodařilo načíst, beru výchozí")
        store["settings"] = settings

    if not await _serve_files(hass, store):
        return False

    if not store.get("api"):
        try:
            api.register(hass)
        except Exception as err:  # noqa: BLE001
            # Při opakovaném spuštění už cesty existují. To není chyba.
            _LOGGER.warning(
                "Interní API bylo nejspíš registrované už dřív (%s). Pokračuji.",
                err,
            )
        store["api"] = True
        _LOGGER.debug("Interní API je registrované")

    hide_sidebar = entry.options.get(OPT_HIDE_SIDEBAR, True)
    landing = entry.options.get(OPT_LANDING, True)

    if not await _register_panel(hass, panel_custom, frontend, hide_sidebar, landing):
        return False

    # Modul se vkládá vždy. Jestli se má lišta schovat, si přečte sám
    # z našeho nastavení, takže přepnutí v aplikaci nevyžaduje restart.
    try:
        frontend.add_extra_js_url(hass, TAKEOVER_URL)
        _LOGGER.debug("Modul pro převzetí rozhraní je vložený")
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning(
            "Kiosk režim se nepodařilo zapnout (%s). "
            "Rozhraní funguje dál, jen bude lišta vidět.",
            err,
        )

    entry.async_on_unload(entry.add_update_listener(_reload))
    _LOGGER.info("Smarthome4u je připravené na /%s", PANEL_URL)
    return True


async def _serve_files(hass: HomeAssistant, store: dict) -> bool:
    """Zpřístupní soubory rozhraní."""
    if store.get("static"):
        return True

    folder = Path(__file__).parent / "frontend"
    if not folder.is_dir():
        _LOGGER.error("Chybí složka %s. Stažení nebylo úplné.", folder)
        return False

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(folder), False)]
        )
    except (ImportError, AttributeError):
        # Starší Home Assistant StaticPathConfig nezná.
        try:
            hass.http.register_static_path(STATIC_URL, str(folder), False)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Soubory rozhraní: %s. Pokračuji.", err)
    except Exception as err:  # noqa: BLE001
        # Při opakovaném spuštění je cesta už registrovaná. To není chyba.
        _LOGGER.warning(
            "Soubory rozhraní byly nejspíš zpřístupněné už dřív (%s). Pokračuji.",
            err,
        )

    store["static"] = True
    _LOGGER.debug("Soubory rozhraní se servírují z %s", STATIC_URL)
    return True


async def _register_panel(
    hass: HomeAssistant,
    panel_custom,
    frontend,
    hide_sidebar: bool,
    landing: bool,
) -> bool:
    """Zaregistruje panel do nabídky Home Assistantu."""
    # Kdyby tu zůstal panel z předchozího pokusu, registrace by spadla.
    with contextlib.suppress(Exception):
        frontend.async_remove_panel(hass, PANEL_URL)

    try:
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
    except Exception:  # noqa: BLE001 - potřebujeme přesný důvod v logu
        _LOGGER.exception(
            "Panel Smarthome4u se nepodařilo zaregistrovat. "
            "Bez něj nemá rozhraní kde běžet."
        )
        return False

    _LOGGER.debug("Panel je v nabídce pod /%s", PANEL_URL)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    from homeassistant.components import frontend

    with contextlib.suppress(Exception):
        frontend.async_remove_panel(hass, PANEL_URL)
    return True


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
