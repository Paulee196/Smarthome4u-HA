"""Informace o systému pro sekci Nastavení.

Uživatel nemá chodit do Home Assistantu ani kvůli tomu, aby zjistil, že je
k dispozici aktualizace nebo že dochází místo na disku.

Všechno je nepovinné. Když nějaký zdroj není k dispozici, prostě se
nezobrazí - nikdy se kvůli tomu nic nerozbije.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import VERSION

_LOGGER = logging.getLogger(__name__)


def updates(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Co čeká na aktualizaci.

    Home Assistant hlásí aktualizace jako entity v doméně update - jádro,
    doplňky, integrace z HACS i firmware zařízení.
    """
    nalezene = []

    for state in hass.states.async_all("update"):
        if state.state != "on":
            continue

        atributy = state.attributes
        nalezene.append(
            {
                "id": state.entity_id,
                "name": atributy.get("friendly_name") or state.entity_id,
                "installed": atributy.get("installed_version"),
                "latest": atributy.get("latest_version"),
                "inProgress": bool(atributy.get("in_progress")),
                # Ne každá aktualizace jde spustit odsud.
                "canInstall": bool(atributy.get("supported_features", 0) & 1),
            }
        )

    nalezene.sort(key=lambda item: item["name"].lower())
    return nalezene


def _host(hass: HomeAssistant) -> dict[str, Any] | None:
    """Údaje o stroji. Jen na Home Assistant OS a Supervised."""
    try:
        from homeassistant.components import hassio
    except ImportError:
        return None

    try:
        if not hassio.is_hassio(hass):
            return None

        info = hassio.get_host_info(hass) or {}
        os_info = hassio.get_os_info(hass) or {}
    except Exception:  # noqa: BLE001 - starší nebo jiná instalace
        _LOGGER.debug("Informace o stroji nejsou k dispozici")
        return None

    celkem = info.get("disk_total")
    volno = info.get("disk_free")
    pouzito = info.get("disk_used")

    return {
        "hostname": info.get("hostname"),
        "system": info.get("operating_system") or os_info.get("version"),
        "diskTotal": celkem,
        "diskUsed": pouzito,
        "diskFree": volno,
        "diskPercent": round(pouzito / celkem * 100)
        if isinstance(celkem, (int, float))
        and isinstance(pouzito, (int, float))
        and celkem
        else None,
    }


def _counts(hass: HomeAssistant) -> dict[str, int]:
    devices = dr.async_get(hass)
    entities = er.async_get(hass)

    return {
        "devices": sum(1 for d in devices.devices.values() if not d.disabled_by),
        "entities": sum(1 for e in entities.entities.values() if not e.disabled_by),
        "integrations": len(hass.config_entries.async_entries()),
        "automations": len(hass.states.async_entity_ids("automation")),
        "scenes": len(hass.states.async_entity_ids("scene")),
    }


def overview(hass: HomeAssistant) -> dict[str, Any]:
    """Souhrn pro sekci Nastavení."""
    return {
        "appVersion": VERSION,
        "haVersion": hass.config.as_dict().get("version"),
        "timezone": str(hass.config.time_zone),
        "counts": _counts(hass),
        "host": _host(hass),
        "updates": updates(hass),
    }
