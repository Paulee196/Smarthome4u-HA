"""Capability Engine.

Převádí technický Home Assistant objekt na funkci srozumitelnou uživateli.

Rozhoduje VÝHRADNĚ podle domain, device_class, state_class, supported_features
a metadat registru.

NIKDY podle názvu entity. "Dveře kuchyň" není informace o typu.

Tento modul nevrací žádné texty pro uživatele - jen strojové klíče.
Překlad dělá frontend, aby rozpoznávání nezáviselo na jazyku.
"""

from __future__ import annotations

from typing import Any, Callable

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


# ----------------------------------------------------------------------
# Jednotlivé domény. Každá je samostatná funkce, aby šlo snadno přidávat.
# ----------------------------------------------------------------------


def _light(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    modes = set(attributes.get("supported_color_modes") or [])
    return {
        "kind": "light",
        "controllable": True,
        "dimmable": bool(modes & DIMMABLE_COLOR_MODES),
        "color_temp": "color_temp" in modes,
        "color": bool(modes & COLOR_MODES),
    }


def _switch(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    # device_class switch/outlet mění jen ikonu, ne chování.
    return {
        "kind": "switch",
        "controllable": True,
        "outlet": device_class == "outlet",
    }


def _sensor(device_class: str | None, attributes: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "sensor",
        "controllable": False,
        "unit": attributes.get("unit_of_measurement"),
        "state_class": attributes.get("state_class"),
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


_HANDLERS: dict[str, Callable[[str | None, dict[str, Any]], dict[str, Any]]] = {
    "light": _light,
    "switch": _switch,
    "sensor": _sensor,
    "binary_sensor": _binary_sensor,
}


# ----------------------------------------------------------------------
# Akce
# ----------------------------------------------------------------------


def resolve_action(kind: str, action: str) -> tuple[str, str] | None:
    """Přeloží požadavek frontendu na HA doménu a službu.

    Vrací None, pokud akce není pro danou schopnost povolená. Backend tím
    zabrání volání čehokoliv, co frontend pošle.
    """
    allowed = {
        ("light", "turn_on"): ("light", "turn_on"),
        ("light", "turn_off"): ("light", "turn_off"),
        ("light", "toggle"): ("light", "toggle"),
        ("switch", "turn_on"): ("switch", "turn_on"),
        ("switch", "turn_off"): ("switch", "turn_off"),
        ("switch", "toggle"): ("switch", "toggle"),
    }
    return allowed.get((kind, action))
