"""Překlad Home Assistant config flow do tvaru, který umí vykreslit naše UI.

Uživatel nikdy neodchází do Home Assistantu. Kroky průvodce se vykreslují
ve Smarthome4u, jen se k nim musí dostat popisky a typy polí.

Tenhle modul nezná HTTP ani WebSocket - dostane hotovou odpověď z adaptéru
a vrátí datovou strukturu pro frontend.
"""

from __future__ import annotations

from typing import Any

LANGUAGE = "cs"

# Typy polí, které naše UI umí vykreslit.
TEXT_TYPES = {"string", "str"}
NUMBER_TYPES = {"integer", "int", "positive_int", "float", "number"}
BOOL_TYPES = {"boolean", "bool"}


def normalize_step(step: dict, resources: dict, fallback_title: str) -> dict:
    """Převede krok průvodce na popis formuláře pro frontend."""
    domain = step.get("handler") or ""
    step_id = step.get("step_id") or ""
    kind = step.get("type")
    base = f"component.{domain}.config"

    if kind == "create_entry":
        return {
            "type": "done",
            "title": step.get("title") or fallback_title,
            "message": None,
        }

    if kind == "abort":
        reason = step.get("reason") or "unknown"
        return {
            "type": "aborted",
            "title": fallback_title,
            "reason": reason,
            "message": resources.get(f"{base}.abort.{reason}"),
        }

    if kind == "external_step":
        return {
            "type": "external",
            "flowId": step.get("flow_id"),
            "title": fallback_title,
            "url": step.get("url"),
            "message": resources.get(f"{base}.step.{step_id}.description"),
        }

    if kind in ("progress", "show_progress"):
        action = step.get("progress_action") or ""
        return {
            "type": "progress",
            "flowId": step.get("flow_id"),
            "title": fallback_title,
            "message": resources.get(f"{base}.progress.{action}"),
        }

    if kind == "menu":
        options = step.get("menu_options") or []
        if isinstance(options, dict):
            items = [{"value": key, "label": label} for key, label in options.items()]
        else:
            items = [
                {
                    "value": option,
                    "label": resources.get(
                        f"{base}.step.{step_id}.menu_options.{option}", option
                    ),
                }
                for option in options
            ]
        return {
            "type": "menu",
            "flowId": step.get("flow_id"),
            "title": resources.get(f"{base}.step.{step_id}.title", fallback_title),
            "message": resources.get(f"{base}.step.{step_id}.description"),
            "options": items,
        }

    # Zbývá formulář.
    fields = []
    unsupported = []

    for item in step.get("data_schema") or []:
        field = _normalize_field(item, resources, base, step_id)
        if field is None:
            unsupported.append(item.get("name", "?"))
        else:
            fields.append(field)

    errors = {
        key: resources.get(f"{base}.error.{value}", value)
        for key, value in (step.get("errors") or {}).items()
    }

    return {
        "type": "form",
        "flowId": step.get("flow_id"),
        "stepId": step_id,
        "title": resources.get(f"{base}.step.{step_id}.title", fallback_title),
        "message": resources.get(f"{base}.step.{step_id}.description"),
        "fields": fields,
        "errors": errors,
        "unsupported": unsupported,
        "placeholders": step.get("description_placeholders") or {},
    }


def _normalize_field(
    item: dict, resources: dict, base: str, step_id: str
) -> dict | None:
    name = item.get("name")
    if not name:
        return None

    label = resources.get(f"{base}.step.{step_id}.data.{name}", name)
    hint = resources.get(f"{base}.step.{step_id}.data_description.{name}")

    field: dict[str, Any] = {
        "name": name,
        "label": label,
        "hint": hint,
        "required": bool(item.get("required")),
        "default": item.get("default"),
    }

    # Novější Home Assistant popisuje pole selectorem.
    selector = item.get("selector")
    if isinstance(selector, dict):
        return _from_selector(field, selector)

    kind = item.get("type")

    if kind in TEXT_TYPES:
        field["type"] = "password" if item.get("format") == "password" else "text"
        return field

    if kind in NUMBER_TYPES:
        field["type"] = "number"
        field["min"] = item.get("valueMin")
        field["max"] = item.get("valueMax")
        field["step"] = 1 if kind != "float" else "any"
        return field

    if kind in BOOL_TYPES:
        field["type"] = "boolean"
        return field

    if kind == "select":
        field["type"] = "select"
        field["options"] = _options(item.get("options"))
        return field

    if kind == "multi_select":
        field["type"] = "multi"
        field["options"] = _options(item.get("options"))
        return field

    return None


def _from_selector(field: dict, selector: dict) -> dict | None:
    if "text" in selector:
        config = selector["text"] or {}
        field["type"] = (
            "password" if config.get("type") == "password" else "text"
        )
        field["multiline"] = bool(config.get("multiline"))
        return field

    if "number" in selector:
        config = selector["number"] or {}
        field["type"] = "number"
        field["min"] = config.get("min")
        field["max"] = config.get("max")
        field["step"] = config.get("step", 1)
        return field

    if "boolean" in selector:
        field["type"] = "boolean"
        return field

    if "select" in selector:
        config = selector["select"] or {}
        field["type"] = "multi" if config.get("multiple") else "select"
        field["options"] = _options(config.get("options"))
        return field

    return None


def _options(raw: Any) -> list[dict]:
    """Volby chodí jako seznam dvojic, slovník nebo seznam řetězců."""
    if isinstance(raw, dict):
        return [{"value": key, "label": str(label)} for key, label in raw.items()]

    result = []
    for item in raw or []:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            result.append({"value": item[0], "label": str(item[1])})
        elif isinstance(item, dict):
            result.append(
                {
                    "value": item.get("value"),
                    "label": str(item.get("label", item.get("value"))),
                }
            )
        else:
            result.append({"value": item, "label": str(item)})
    return result


def integration_names(manifests: list[dict]) -> dict[str, str]:
    """Doména integrace na její čitelný název."""
    return {
        item["domain"]: item.get("name") or item["domain"]
        for item in manifests
        if item.get("domain")
    }


def addable(manifests: list[dict], handlers: list[str]) -> list[dict]:
    """Integrace, které jde přidat průvodcem.

    Pomocné integrace a věci bez zařízení se nenabízejí - laika by jen mátly.
    """
    allowed = set(handlers)
    hidden_types = {"entity", "system", "helper"}

    result = [
        {
            "domain": item["domain"],
            "name": item.get("name") or item["domain"],
            "type": item.get("integration_type") or "integration",
        }
        for item in manifests
        if item.get("domain") in allowed
        and (item.get("integration_type") or "integration") not in hidden_types
    ]

    result.sort(key=lambda item: item["name"].lower())
    return result
