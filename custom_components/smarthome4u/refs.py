"""Stable references for Home Assistant entities.

Home Assistant services still need the current ``entity_id``. Smarthome4u
layout data must not store it as identity, because users can rename entities.
For registry-backed entities we store the entity registry entry id. Entities
without registry entries get an explicit fallback reference.
"""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

FALLBACK_PREFIX = "entity:"


def ref_for_entity(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the stable reference for an entity id."""
    if not isinstance(entity_id, str) or hass.states.get(entity_id) is None:
        return None

    entry = er.async_get(hass).async_get(entity_id)
    if entry is not None:
        return entry.id
    return f"{FALLBACK_PREFIX}{entity_id}"


def entity_id_for_ref(hass: HomeAssistant, ref: str) -> str | None:
    """Resolve a stored reference to the current entity id."""
    if not isinstance(ref, str) or not ref:
        return None

    if ref.startswith(FALLBACK_PREFIX):
        entity_id = ref.removeprefix(FALLBACK_PREFIX)
        return entity_id if hass.states.get(entity_id) is not None else None

    registry = er.async_get(hass)

    # Registr si drží rejstřík podle svého ID. Procházet stovky entit
    # při každém hledání by bylo zbytečné - a hledá se u každé oblíbené
    # položky, u každého bodu v půdorysu a při každém sestavení modelu.
    najit = getattr(registry.entities, "get_entry", None)
    entry = najit(ref) if callable(najit) else None

    if entry is None and not callable(najit):
        # Starší Home Assistant rejstřík nemá. Pak nezbývá než projít.
        entry = next(
            (e for e in registry.entities.values() if e.id == ref),
            None,
        )

    if entry is not None:
        return entry.entity_id if hass.states.get(entry.entity_id) else None

    # Backward compatibility for data saved before stable refs existed.
    if hass.states.get(ref) is not None:
        return ref

    return None


def normalize_ref(hass: HomeAssistant, value: str) -> str | None:
    """Accept a new ref or an old entity_id and return the stored ref."""
    entity_id = entity_id_for_ref(hass, value)
    if entity_id is None:
        return None
    return ref_for_entity(hass, entity_id)

