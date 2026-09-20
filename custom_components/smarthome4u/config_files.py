"""Zápis automatizací a scén.

Píšeme do `automations.yaml` a `scenes.yaml`, tedy do běžných konfiguračních
souborů, které Home Assistant sám používá pro své editory. Po zápisu se volá
standardní služba reload.

Do `.storage` se nesahá nikdy.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util.yaml import dump, load_yaml

_LOGGER = logging.getLogger(__name__)

AUTOMATIONS = "automations.yaml"
SCENES = "scenes.yaml"


class ConfigFileError(Exception):
    """Soubor nejde přečíst nebo zapsat."""


def _read(path: str) -> list[dict[str, Any]]:
    if not os.path.isfile(path):
        return []
    try:
        content = load_yaml(path)
    except Exception as err:  # noqa: BLE001 - poškozený soubor nesmí shodit HA
        raise ConfigFileError(f"Soubor {os.path.basename(path)} nejde přečíst") from err

    if content is None:
        return []
    if not isinstance(content, list):
        raise ConfigFileError(
            f"Soubor {os.path.basename(path)} nemá očekávaný tvar seznamu"
        )
    return content


def _write(path: str, items: list[dict[str, Any]]) -> None:
    tmp = f"{path}.sh4u.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        handle.write(dump(items))
    os.replace(tmp, path)


def _upsert(items: list[dict], item: dict, key: str = "id") -> list[dict]:
    for index, existing in enumerate(items):
        if isinstance(existing, dict) and existing.get(key) == item.get(key):
            items[index] = item
            return items
    items.append(item)
    return items


def _remove(items: list[dict], item_id: str, key: str = "id") -> list[dict]:
    return [
        existing
        for existing in items
        if not (isinstance(existing, dict) and existing.get(key) == item_id)
    ]


async def save_automation(hass: HomeAssistant, config: dict) -> None:
    path = hass.config.path(AUTOMATIONS)

    def work() -> None:
        _write(path, _upsert(_read(path), config))

    await hass.async_add_executor_job(work)
    await hass.services.async_call("automation", "reload", blocking=True)


async def delete_automation(hass: HomeAssistant, automation_id: str) -> None:
    path = hass.config.path(AUTOMATIONS)

    def work() -> None:
        _write(path, _remove(_read(path), automation_id))

    await hass.async_add_executor_job(work)
    await hass.services.async_call("automation", "reload", blocking=True)


async def save_scene(hass: HomeAssistant, config: dict) -> None:
    path = hass.config.path(SCENES)

    def work() -> None:
        _write(path, _upsert(_read(path), config))

    await hass.async_add_executor_job(work)
    await hass.services.async_call("scene", "reload", blocking=True)


async def delete_scene(hass: HomeAssistant, scene_id: str) -> None:
    path = hass.config.path(SCENES)

    def work() -> None:
        _write(path, _remove(_read(path), scene_id))

    await hass.async_add_executor_job(work)
    await hass.services.async_call("scene", "reload", blocking=True)
