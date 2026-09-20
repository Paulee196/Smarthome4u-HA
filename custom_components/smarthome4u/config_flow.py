"""Přidání Smarthome4u do Home Assistantu.

Nic se nevyplňuje. Stačí potvrdit a rozhraní je dostupné.

Tenhle soubor musí jít naimportovat za každých okolností. Home Assistant ho
načítá dřív, než cokoliv jiného, a když import spadne, hlásí uživateli jen
"Invalid handler specified" bez vysvětlení. Proto se tady neimportuje nic
kromě konstant.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback

from .const import DOMAIN, OPT_HIDE_SIDEBAR, OPT_LANDING, PANEL_TITLE


class Smarthome4uConfigFlow(ConfigFlow, domain=DOMAIN):
    """Jediná instance, bez vyplňování."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

        return self.async_create_entry(title=PANEL_TITLE, data={})

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return Smarthome4uOptionsFlow()


class Smarthome4uOptionsFlow(OptionsFlow):
    """Jak moc má Smarthome4u převzít rozhraní."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)

        options = self.config_entry.options
        schema = vol.Schema(
            {
                vol.Optional(
                    OPT_HIDE_SIDEBAR,
                    default=options.get(OPT_HIDE_SIDEBAR, True),
                ): bool,
                vol.Optional(
                    OPT_LANDING,
                    default=options.get(OPT_LANDING, True),
                ): bool,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
