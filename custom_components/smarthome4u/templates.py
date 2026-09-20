"""Šablony automatizací.

Šablona nikdy nepředpokládá konkrétní entity_id. Popisuje, jaké schopnosti
potřebuje, a uživatel k nim přiřadí svoje zařízení.

Výstupem je normální Home Assistant automatizace. Vykonává ji Home Assistant,
ne Smarthome4u.

Texty pro uživatele tady nejsou - frontend si je najde podle id šablony.
"""

from __future__ import annotations

import time
from typing import Any, Callable

# ----------------------------------------------------------------------
# Popis vstupů
#
# kind      - schopnost z Capability Engine
# classes   - povolené device_class, prázdné = libovolné
# multiple  - lze vybrat víc zařízení
# ----------------------------------------------------------------------


def _entity(key: str, kind: str, classes: list[str] | None = None, multiple=False):
    return {
        "key": key,
        "type": "entity",
        "kind": kind,
        "classes": classes or [],
        "multiple": multiple,
    }


def _number(key: str, default: int, minimum: int, maximum: int):
    return {
        "key": key,
        "type": "number",
        "default": default,
        "min": minimum,
        "max": maximum,
    }


def _time(key: str, default: str):
    return {"key": key, "type": "time", "default": default}


TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "motion_light",
        "inputs": [
            _entity("sensor", "binary_sensor", ["motion", "occupancy", "presence"]),
            _entity("light", "light", multiple=True),
            _number("minutes", 5, 1, 120),
        ],
    },
    {
        "id": "window_heating",
        "inputs": [
            _entity("window", "binary_sensor", ["window", "door", "opening"]),
            _entity("climate", "climate"),
            _number("minutes", 3, 1, 60),
        ],
    },
    {
        "id": "water_leak",
        "inputs": [_entity("sensor", "binary_sensor", ["moisture"])],
    },
    {
        "id": "leaving_home",
        "inputs": [
            _entity("person", "presence"),
            _entity("light", "light", multiple=True),
        ],
    },
    {
        "id": "arriving_home",
        "inputs": [
            _entity("person", "presence"),
            _entity("light", "light", multiple=True),
        ],
    },
    {
        "id": "good_night",
        "inputs": [_time("at", "23:00:00"), _entity("light", "light", multiple=True)],
    },
]


# ----------------------------------------------------------------------
# Sestavení automatizace
# ----------------------------------------------------------------------


def _targets(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return [value] if isinstance(value, str) else []


def _motion_light(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    sensor = data["sensor"]
    lights = _targets(data["light"])
    return {
        "alias": alias,
        "triggers": [
            {"trigger": "state", "entity_id": sensor, "to": "on", "id": "pohyb"},
            {
                "trigger": "state",
                "entity_id": sensor,
                "to": "off",
                "for": {"minutes": int(data.get("minutes", 5))},
                "id": "klid",
            },
        ],
        "conditions": [],
        "actions": [
            {
                "choose": [
                    {
                        "conditions": [{"condition": "trigger", "id": "pohyb"}],
                        "sequence": [
                            {
                                "action": "light.turn_on",
                                "target": {"entity_id": lights},
                            }
                        ],
                    },
                    {
                        "conditions": [{"condition": "trigger", "id": "klid"}],
                        "sequence": [
                            {
                                "action": "light.turn_off",
                                "target": {"entity_id": lights},
                            }
                        ],
                    },
                ]
            }
        ],
        "mode": "restart",
    }


def _window_heating(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    window = data["window"]
    climate = data["climate"]
    return {
        "alias": alias,
        "triggers": [
            {
                "trigger": "state",
                "entity_id": window,
                "to": "on",
                "for": {"minutes": int(data.get("minutes", 3))},
                "id": "otevreno",
            },
            {"trigger": "state", "entity_id": window, "to": "off", "id": "zavreno"},
        ],
        "conditions": [],
        "actions": [
            {
                "choose": [
                    {
                        "conditions": [{"condition": "trigger", "id": "otevreno"}],
                        "sequence": [
                            {
                                "action": "climate.turn_off",
                                "target": {"entity_id": climate},
                            }
                        ],
                    },
                    {
                        "conditions": [{"condition": "trigger", "id": "zavreno"}],
                        "sequence": [
                            {
                                "action": "climate.turn_on",
                                "target": {"entity_id": climate},
                            }
                        ],
                    },
                ]
            }
        ],
        "mode": "restart",
    }


def _water_leak(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "alias": alias,
        "triggers": [{"trigger": "state", "entity_id": data["sensor"], "to": "on"}],
        "conditions": [],
        "actions": [
            {
                "action": "persistent_notification.create",
                "data": {
                    "title": "Únik vody",
                    "message": "Čidlo hlásí vodu. Zkontrolujte prosím místo.",
                },
            }
        ],
        "mode": "single",
    }


def _leaving_home(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "alias": alias,
        "triggers": [
            {"trigger": "state", "entity_id": data["person"], "to": "not_home"}
        ],
        "conditions": [],
        "actions": [
            {
                "action": "light.turn_off",
                "target": {"entity_id": _targets(data["light"])},
            }
        ],
        "mode": "single",
    }


def _arriving_home(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "alias": alias,
        "triggers": [{"trigger": "state", "entity_id": data["person"], "to": "home"}],
        "conditions": [],
        "actions": [
            {
                "action": "light.turn_on",
                "target": {"entity_id": _targets(data["light"])},
            }
        ],
        "mode": "single",
    }


def _good_night(alias: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "alias": alias,
        "triggers": [{"trigger": "time", "at": data.get("at", "23:00:00")}],
        "conditions": [],
        "actions": [
            {
                "action": "light.turn_off",
                "target": {"entity_id": _targets(data["light"])},
            }
        ],
        "mode": "single",
    }


_BUILDERS: dict[str, Callable[[str, dict[str, Any]], dict[str, Any]]] = {
    "motion_light": _motion_light,
    "window_heating": _window_heating,
    "water_leak": _water_leak,
    "leaving_home": _leaving_home,
    "arriving_home": _arriving_home,
    "good_night": _good_night,
}


class TemplateError(Exception):
    """Šablona nejde sestavit z toho, co uživatel vybral."""


def build(template_id: str, alias: str, data: dict[str, Any]) -> tuple[str, dict]:
    """Vrátí id nové automatizace a její konfiguraci pro Home Assistant."""
    builder = _BUILDERS.get(template_id)
    if builder is None:
        raise TemplateError("neznámá šablona")

    definition = next(t for t in TEMPLATES if t["id"] == template_id)

    for item in definition["inputs"]:
        if item["type"] != "entity":
            continue
        value = data.get(item["key"])
        if not value or (item["multiple"] and not _targets(value)):
            raise TemplateError(f"chybí výběr: {item['key']}")

    if not alias.strip():
        raise TemplateError("chybí název")

    automation_id = str(int(time.time() * 1000))
    return automation_id, builder(alias.strip(), data)
