"""Capability Engine.

Převádí technický Home Assistant objekt na funkci srozumitelnou uživateli
a určuje, co se s ní smí dělat.

Rozhoduje VÝHRADNĚ podle domain, device_class, state_class, supported_features
a metadat registru.

NIKDY podle názvu entity. "Dveře kuchyň" není informace o typu.

Tento modul nevrací žádné texty pro uživatele - jen strojové klíče.
Překlad dělá frontend, aby rozpoznávání nezáviselo na jazyku.
"""

from __future__ import annotations

from typing import Any, Callable

# ----------------------------------------------------------------------
# Bitové masky supported_features. Hodnoty jsou dané Home Assistantem.
# ----------------------------------------------------------------------

COVER_OPEN = 1
COVER_CLOSE = 2
COVER_SET_POSITION = 4
COVER_STOP = 8
COVER_SET_TILT = 128

CLIMATE_TARGET_TEMPERATURE = 1
CLIMATE_TARGET_TEMPERATURE_RANGE = 2
CLIMATE_FAN_MODE = 8
CLIMATE_PRESET_MODE = 16

FAN_SET_SPEED = 1

LOCK_OPEN = 1

MEDIA_PAUSE = 1
MEDIA_VOLUME_SET = 4
MEDIA_PLAY = 16384

# Barevné režimy, které znamenají stmívatelné světlo.
DIMMABLE_COLOR_MODES = frozenset(
    {"brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww", "white"}
)
COLOR_MODES = frozenset({"hs", "xy", "rgb", "rgbw", "rgbww"})

# Senzory, které zajímají běžného uživatele. Ostatní patří technikovi.
PRIMARY_SENSOR_CLASSES = frozenset(
    {
        "temperature",
        "humidity",
        "illuminance",
        "power",
        "energy",
        "carbon_dioxide",
        "pm25",
        "battery",
        "pressure",
    }
)

# Binární senzory, které znamenají bezpečnostní událost.
SAFETY_BINARY_CLASSES = frozenset(
    {"smoke", "gas", "moisture", "carbon_monoxide", "safety", "problem"}
)


def classify(
    domain: str,
    device_class: str | None,
    attributes: dict[str, Any],
) -> dict[str, Any]:
    """Vrátí popis schopností entity pro frontend."""
    handler = _HANDLERS.get(domain)
    if handler is None:
        return {"kind": "unsupported", "controllable": False}
    return handler(device_class, attributes)


def _features(attributes: dict[str, Any]) -> int:
    value = attributes.get("supported_features")
    return value if isinstance(value, int) else 0


# ----------------------------------------------------------------------
# Jednotlivé domény. Každá je samostatná funkce, aby šlo snadno přidávat.
# ----------------------------------------------------------------------


def _light(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    modes = set(attributes.get("supported_color_modes") or [])
    return {
        "kind": "light",
        "controllable": True,
        "dimmable": bool(modes & DIMMABLE_COLOR_MODES),
        "colorTemp": "color_temp" in modes,
        "color": bool(modes & COLOR_MODES),
        "minKelvin": attributes.get("min_color_temp_kelvin"),
        "maxKelvin": attributes.get("max_color_temp_kelvin"),
    }


def _switch(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "switch",
        "controllable": True,
        "outlet": device_class == "outlet",
    }


def _cover(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    features = _features(attributes)
    return {
        "kind": "cover",
        "controllable": True,
        "position": bool(features & COVER_SET_POSITION),
        "stop": bool(features & COVER_STOP),
        "tilt": bool(features & COVER_SET_TILT),
    }


def _climate(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    features = _features(attributes)
    return {
        "kind": "climate",
        "controllable": True,
        "targetTemperature": bool(features & CLIMATE_TARGET_TEMPERATURE),
        "temperatureRange": bool(features & CLIMATE_TARGET_TEMPERATURE_RANGE),
        "presets": attributes.get("preset_modes") or [],
        "hvacModes": attributes.get("hvac_modes") or [],
        "minTemp": attributes.get("min_temp"),
        "maxTemp": attributes.get("max_temp"),
        "step": attributes.get("target_temp_step") or 0.5,
    }


def _lock(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "lock",
        "controllable": True,
        "canOpen": bool(_features(attributes) & LOCK_OPEN),
    }


def _fan(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "fan",
        "controllable": True,
        "speed": bool(_features(attributes) & FAN_SET_SPEED),
    }


def _sensor(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "sensor",
        "controllable": False,
        "unit": attributes.get("unit_of_measurement"),
        "stateClass": attributes.get("state_class"),
        "primary": device_class in PRIMARY_SENSOR_CLASSES,
    }


def _binary_sensor(
    device_class: str | None, attributes: dict[str, Any]
) -> dict[str, Any]:
    return {
        "kind": "binary_sensor",
        "controllable": False,
        "safety": device_class in SAFETY_BINARY_CLASSES,
    }


def _scene(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    # sceneId je potřeba pro úpravu a smazání přes config API.
    return {"kind": "scene", "controllable": True, "sceneId": attributes.get("id")}


def _script(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {"kind": "script", "controllable": True}


def _automation(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "automation",
        "controllable": True,
        "automationId": attributes.get("id"),
    }


def _button(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {"kind": "button", "controllable": True}


def _number(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "number",
        "controllable": True,
        "min": attributes.get("min"),
        "max": attributes.get("max"),
        "step": attributes.get("step") or 1,
        "unit": attributes.get("unit_of_measurement"),
    }


def _select(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "select",
        "controllable": True,
        "options": attributes.get("options") or [],
    }


def _media_player(
    device_class: str | None, attributes: dict[str, Any]
) -> dict[str, Any]:
    features = _features(attributes)
    return {
        "kind": "media_player",
        "controllable": True,
        "canPlay": bool(features & (MEDIA_PLAY | MEDIA_PAUSE)),
        "volume": bool(features & MEDIA_VOLUME_SET),
    }


def _presence(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {"kind": "presence", "controllable": False}


_HANDLERS: dict[str, Callable[[str | None, dict[str, Any]], dict[str, Any]]] = {
    "light": _light,
    "switch": _switch,
    "input_boolean": _switch,
    "cover": _cover,
    "climate": _climate,
    "lock": _lock,
    "fan": _fan,
    "sensor": _sensor,
    "binary_sensor": _binary_sensor,
    "scene": _scene,
    "script": _script,
    "automation": _automation,
    "button": _button,
    "input_button": _button,
    "number": _number,
    "input_number": _number,
    "select": _select,
    "input_select": _select,
    "media_player": _media_player,
    "person": _presence,
    "device_tracker": _presence,
}


# ----------------------------------------------------------------------
# Povolené akce
#
# Frontend nesmí zavolat libovolnou Home Assistant službu. Smí jen to,
# co je tady. Každá akce má definovaný tvar hodnoty a ta se ověřuje.
# ----------------------------------------------------------------------

# kind -> action -> (service, jméno pole pro hodnotu, typ hodnoty)
_ACTIONS: dict[str, dict[str, tuple[str, str | None, str | None]]] = {
    "light": {
        "turn_on": ("turn_on", None, None),
        "turn_off": ("turn_off", None, None),
        "toggle": ("toggle", None, None),
        "brightness": ("turn_on", "brightness_pct", "percent"),
        "color_temp": ("turn_on", "color_temp_kelvin", "number"),
        "color": ("turn_on", "rgb_color", "rgb"),
    },
    "switch": {
        "turn_on": ("turn_on", None, None),
        "turn_off": ("turn_off", None, None),
        "toggle": ("toggle", None, None),
    },
    "cover": {
        "open": ("open_cover", None, None),
        "close": ("close_cover", None, None),
        "stop": ("stop_cover", None, None),
        "position": ("set_cover_position", "position", "percent"),
        "tilt": ("set_cover_tilt_position", "tilt_position", "percent"),
    },
    "climate": {
        "temperature": ("set_temperature", "temperature", "number"),
        "hvac_mode": ("set_hvac_mode", "hvac_mode", "text"),
        "preset": ("set_preset_mode", "preset_mode", "text"),
        "turn_on": ("turn_on", None, None),
        "turn_off": ("turn_off", None, None),
    },
    "lock": {
        "lock": ("lock", None, None),
        "unlock": ("unlock", None, None),
        "open": ("open", None, None),
    },
    "fan": {
        "turn_on": ("turn_on", None, None),
        "turn_off": ("turn_off", None, None),
        "toggle": ("toggle", None, None),
        "speed": ("set_percentage", "percentage", "percent"),
    },
    "scene": {
        "activate": ("turn_on", None, None),
    },
    "script": {
        "run": ("turn_on", None, None),
        "stop": ("turn_off", None, None),
    },
    "automation": {
        "turn_on": ("turn_on", None, None),
        "turn_off": ("turn_off", None, None),
        "toggle": ("toggle", None, None),
        "run": ("trigger", None, None),
    },
    "button": {
        "press": ("press", None, None),
    },
    "number": {
        "set": ("set_value", "value", "number"),
    },
    "select": {
        "set": ("select_option", "option", "text"),
    },
    "media_player": {
        "play_pause": ("media_play_pause", None, None),
        "stop": ("media_stop", None, None),
        "volume": ("volume_set", "volume_level", "unit"),
    },
}

# Domény, jejichž služby se jmenují jinak než doména entity.
_SERVICE_DOMAIN = {
    "input_boolean": "input_boolean",
    "input_number": "input_number",
    "input_select": "input_select",
    "input_button": "input_button",
}


class ActionNotAllowed(Exception):
    """Frontend požádal o něco, co pro tuto entitu není povolené."""


def resolve_action(
    kind: str,
    domain: str,
    action: str,
    value: Any = None,
) -> tuple[str, str, dict[str, Any]]:
    """Přeloží požadavek frontendu na Home Assistant službu.

    Vyhodí ActionNotAllowed, pokud akce není pro danou schopnost povolená
    nebo pokud hodnota nemá správný tvar.
    """
    table = _ACTIONS.get(kind)
    if table is None or action not in table:
        raise ActionNotAllowed(f"{kind}.{action}")

    service, field, value_type = table[action]
    data: dict[str, Any] = {}

    if field is not None:
        data[field] = _validate(value_type, value)

    service_domain = _SERVICE_DOMAIN.get(domain, _BASE_DOMAIN.get(kind, domain))
    return service_domain, service, data


# Doména služby podle schopnosti, když se liší od domény entity.
_BASE_DOMAIN = {
    "switch": "switch",
    "scene": "scene",
    "script": "script",
    "automation": "automation",
}


def _validate(value_type: str | None, value: Any) -> Any:
    if value_type == "percent":
        if not isinstance(value, (int, float)) or not 0 <= value <= 100:
            raise ActionNotAllowed("hodnota mimo rozsah 0-100")
        return int(value)

    if value_type == "unit":
        if not isinstance(value, (int, float)) or not 0 <= value <= 1:
            raise ActionNotAllowed("hodnota mimo rozsah 0-1")
        return float(value)

    if value_type == "number":
        if not isinstance(value, (int, float)):
            raise ActionNotAllowed("očekáváno číslo")
        return value

    if value_type == "text":
        if not isinstance(value, str) or len(value) > 100:
            raise ActionNotAllowed("očekáván krátký text")
        return value

    if value_type == "rgb":
        if (
            not isinstance(value, list)
            or len(value) != 3
            or not all(isinstance(c, int) and 0 <= c <= 255 for c in value)
        ):
            raise ActionNotAllowed("očekávána barva RGB")
        return value

    raise ActionNotAllowed("neznámý typ hodnoty")
