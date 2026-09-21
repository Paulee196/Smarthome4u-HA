"""Stavitel automatizací.

Jeden model, dva editory. Jednoduchý KDYŽ / A ZÁROVEŇ / PAK i skládačka
pracují se stejnou strukturou, takže se převod na Home Assistant píše jen
jednou a obě cesty vyrobí stejnou automatizaci.

Model je záměrně chudý. Umí jen to, co jde spolehlivě převést tam i zpět.
Co se nevejde, zůstane v Home Assistantu a Smarthome4u to jen zobrazí
jako pokročilé.
"""

from __future__ import annotations

import time
from typing import Any

# ----------------------------------------------------------------------
# Co umí spouštěč, podmínka a akce
#
# Klíče jsou strojové. Překlad si dělá frontend.
# ----------------------------------------------------------------------

SPOUSTECE = {
    # Zařízení se přepne do stavu.
    "state": {"fields": ["entity", "to"]},
    # Zařízení je ve stavu nepřetržitě po dobu.
    "state_for": {"fields": ["entity", "to", "minutes"]},
    # V zadaný čas.
    "time": {"fields": ["at"]},
    # Při východu nebo západu slunce.
    "sun": {"fields": ["event", "offset"]},
    # Hodnota senzoru překročí nebo klesne pod mez.
    "numeric": {"fields": ["entity", "direction", "value"]},
}

PODMINKY = {
    "state": {"fields": ["entity", "is"]},
    "time_range": {"fields": ["after", "before"]},
    "numeric": {"fields": ["entity", "direction", "value"]},
}

AKCE = {
    # Zapnout, vypnout nebo přepnout zařízení.
    "device": {"fields": ["entity", "command"]},
    # Nastavit hodnotu - jas, polohu žaluzie, teplotu.
    "value": {"fields": ["entity", "command", "value"]},
    "scene": {"fields": ["entity"]},
    "script": {"fields": ["entity"]},
    "wait": {"fields": ["minutes"]},
    "notify": {"fields": ["message"]},
}

PRIKAZY = {
    "turn_on": "turn_on",
    "turn_off": "turn_off",
    "toggle": "toggle",
}

HODNOTOVE_PRIKAZY = {
    "brightness": ("light", "turn_on", "brightness_pct"),
    "position": ("cover", "set_cover_position", "position"),
    "temperature": ("climate", "set_temperature", "temperature"),
}

MODY = ("single", "restart", "queued")


class BuilderError(Exception):
    """Model automatizace nejde převést."""


# ----------------------------------------------------------------------
# Model na Home Assistant
# ----------------------------------------------------------------------


def _entity(krok: dict, klic: str = "entity") -> str:
    hodnota = krok.get(klic)
    if not isinstance(hodnota, str) or "." not in hodnota:
        raise BuilderError("Vyberte prosím zařízení.")
    return hodnota


def _minuty(krok: dict) -> int:
    hodnota = krok.get("minutes", 0)
    if not isinstance(hodnota, int) or not 0 <= hodnota <= 1440:
        raise BuilderError("Doba musí být 0 až 1440 minut.")
    return hodnota


def _cislo(krok: dict, klic: str = "value") -> float:
    hodnota = krok.get(klic)
    if not isinstance(hodnota, (int, float)) or isinstance(hodnota, bool):
        raise BuilderError("Zadejte prosím číslo.")
    return hodnota


def _cas(hodnota: Any) -> str:
    if not isinstance(hodnota, str) or len(hodnota) < 4:
        raise BuilderError("Zadejte prosím čas.")
    return hodnota if hodnota.count(":") == 2 else f"{hodnota}:00"


def _spoustec(krok: dict) -> dict:
    typ = krok.get("type")

    if typ == "state":
        return {
            "trigger": "state",
            "entity_id": _entity(krok),
            "to": krok.get("to") or None,
        }

    if typ == "state_for":
        return {
            "trigger": "state",
            "entity_id": _entity(krok),
            "to": krok.get("to") or None,
            "for": {"minutes": _minuty(krok)},
        }

    if typ == "time":
        return {"trigger": "time", "at": _cas(krok.get("at"))}

    if typ == "sun":
        udalost = krok.get("event")
        if udalost not in ("sunrise", "sunset"):
            raise BuilderError("Vyberte východ nebo západ slunce.")
        spoustec = {"trigger": "sun", "event": udalost}

        # Posun se zadává v minutách, Home Assistant chce HH:MM:SS.
        offset = krok.get("offset")
        if isinstance(offset, int) and offset and -720 <= offset <= 720:
            znamenko = "-" if offset < 0 else ""
            hodiny, minuty = divmod(abs(offset), 60)
            spoustec["offset"] = f"{znamenko}{hodiny:02d}:{minuty:02d}:00"

        return spoustec

    if typ == "numeric":
        smer = krok.get("direction")
        if smer not in ("above", "below"):
            raise BuilderError("Vyberte, jestli nad nebo pod.")
        return {
            "trigger": "numeric_state",
            "entity_id": _entity(krok),
            smer: _cislo(krok),
        }

    raise BuilderError("Neznámý spouštěč.")


def _podminka(krok: dict) -> dict:
    typ = krok.get("type")

    if typ == "state":
        return {
            "condition": "state",
            "entity_id": _entity(krok),
            "state": krok.get("is") or "on",
        }

    if typ == "time_range":
        return {
            "condition": "time",
            "after": _cas(krok.get("after")),
            "before": _cas(krok.get("before")),
        }

    if typ == "numeric":
        smer = krok.get("direction")
        if smer not in ("above", "below"):
            raise BuilderError("Vyberte, jestli nad nebo pod.")
        return {
            "condition": "numeric_state",
            "entity_id": _entity(krok),
            smer: _cislo(krok),
        }

    raise BuilderError("Neznámá podmínka.")


def _akce(krok: dict) -> dict:
    typ = krok.get("type")

    if typ == "device":
        prikaz = PRIKAZY.get(krok.get("command"))
        if prikaz is None:
            raise BuilderError("Vyberte, co se má se zařízením stát.")
        entity_id = _entity(krok)
        domena = entity_id.split(".", 1)[0]
        return {
            "action": f"{domena}.{prikaz}",
            "target": {"entity_id": entity_id},
        }

    if typ == "value":
        nastaveni = HODNOTOVE_PRIKAZY.get(krok.get("command"))
        if nastaveni is None:
            raise BuilderError("Tuhle hodnotu nastavit neumíme.")
        _, sluzba, pole = nastaveni
        entity_id = _entity(krok)
        domena = entity_id.split(".", 1)[0]
        return {
            "action": f"{domena}.{sluzba}",
            "target": {"entity_id": entity_id},
            "data": {pole: _cislo(krok)},
        }

    if typ == "scene":
        return {"action": "scene.turn_on", "target": {"entity_id": _entity(krok)}}

    if typ == "script":
        return {"action": "script.turn_on", "target": {"entity_id": _entity(krok)}}

    if typ == "wait":
        return {"delay": {"minutes": _minuty(krok)}}

    if typ == "notify":
        zprava = krok.get("message")
        if not isinstance(zprava, str) or not zprava.strip():
            raise BuilderError("Napište prosím text upozornění.")
        return {
            "action": "persistent_notification.create",
            "data": {"title": "Smarthome4u", "message": zprava.strip()[:255]},
        }

    raise BuilderError("Neznámá akce.")


def build(model: dict) -> tuple[str, dict]:
    """Vrátí id nové automatizace a její konfiguraci pro Home Assistant."""
    alias = model.get("alias")
    if not isinstance(alias, str) or not alias.strip():
        raise BuilderError("Zadejte prosím název automatizace.")

    when = model.get("when") or []
    then = model.get("then") or []

    if not when:
        raise BuilderError("Doplňte alespoň jeden spouštěč v části KDYŽ.")
    if not then:
        raise BuilderError("Doplňte alespoň jednu akci v části PAK.")

    mode = model.get("mode")
    if mode not in MODY:
        mode = "single"

    config = {
        "id": model.get("id") or str(int(time.time() * 1000)),
        "alias": alias.strip(),
        "description": (model.get("description") or "").strip(),
        "triggers": [_spoustec(krok) for krok in when],
        "conditions": [_podminka(krok) for krok in (model.get("and") or [])],
        "actions": [_akce(krok) for krok in then],
        "mode": mode,
    }

    # Home Assistant nemá rád None v to.
    for spoustec in config["triggers"]:
        if spoustec.get("to") is None:
            spoustec.pop("to", None)

    return config["id"], config


# ----------------------------------------------------------------------
# Home Assistant zpátky na model
#
# Jen pro automatizace, které vznikly tady. Co nepoznáme, označíme jako
# pokročilé a necháme být - nikdy nic nezjednodušujeme destruktivně.
# ----------------------------------------------------------------------


def _zpet_spoustec(polozka: dict) -> dict | None:
    typ = polozka.get("trigger") or polozka.get("platform")

    if typ == "state":
        krok = {
            "type": "state_for" if polozka.get("for") else "state",
            "entity": _prvni(polozka.get("entity_id")),
            "to": polozka.get("to"),
        }
        trvani = polozka.get("for")
        if isinstance(trvani, dict):
            krok["minutes"] = int(trvani.get("minutes", 0))
        return krok

    if typ == "time":
        return {"type": "time", "at": str(polozka.get("at"))}

    if typ == "sun":
        return {"type": "sun", "event": polozka.get("event"), "offset": 0}

    if typ == "numeric_state":
        smer = "above" if "above" in polozka else "below"
        return {
            "type": "numeric",
            "entity": _prvni(polozka.get("entity_id")),
            "direction": smer,
            "value": polozka.get(smer),
        }

    return None


def _zpet_podminka(polozka: dict) -> dict | None:
    typ = polozka.get("condition")

    if typ == "state":
        return {
            "type": "state",
            "entity": _prvni(polozka.get("entity_id")),
            "is": polozka.get("state"),
        }

    if typ == "time":
        return {
            "type": "time_range",
            "after": str(polozka.get("after")),
            "before": str(polozka.get("before")),
        }

    if typ == "numeric_state":
        smer = "above" if "above" in polozka else "below"
        return {
            "type": "numeric",
            "entity": _prvni(polozka.get("entity_id")),
            "direction": smer,
            "value": polozka.get(smer),
        }

    return None


def _zpet_akce(polozka: dict) -> dict | None:
    if "delay" in polozka:
        trvani = polozka["delay"]
        if isinstance(trvani, dict):
            return {"type": "wait", "minutes": int(trvani.get("minutes", 0))}
        return None

    sluzba = polozka.get("action") or polozka.get("service")
    if not isinstance(sluzba, str):
        return None

    entity_id = _prvni((polozka.get("target") or {}).get("entity_id"))
    data = polozka.get("data") or {}

    if sluzba == "scene.turn_on":
        return {"type": "scene", "entity": entity_id}
    if sluzba == "script.turn_on":
        return {"type": "script", "entity": entity_id}
    if sluzba == "persistent_notification.create":
        return {"type": "notify", "message": data.get("message", "")}

    domena, _, nazev = sluzba.partition(".")

    if nazev in PRIKAZY and not data:
        return {"type": "device", "entity": entity_id, "command": nazev}

    for prikaz, (_, sluzba_hodnoty, pole) in HODNOTOVE_PRIKAZY.items():
        if nazev == sluzba_hodnoty and pole in data:
            return {
                "type": "value",
                "entity": entity_id,
                "command": prikaz,
                "value": data[pole],
            }

    return None


def _prvni(hodnota: Any) -> str | None:
    if isinstance(hodnota, list):
        return hodnota[0] if hodnota else None
    return hodnota if isinstance(hodnota, str) else None


def parse(config: dict) -> dict | None:
    """Převede automatizaci na model. Vrátí None, když je moc složitá."""
    if not isinstance(config, dict):
        return None

    spoustece = config.get("triggers") or config.get("trigger") or []
    podminky = config.get("conditions") or config.get("condition") or []
    akce = config.get("actions") or config.get("action") or []

    if isinstance(spoustece, dict):
        spoustece = [spoustece]
    if isinstance(podminky, dict):
        podminky = [podminky]
    if isinstance(akce, dict):
        akce = [akce]

    model = {
        "id": config.get("id"),
        "alias": config.get("alias", ""),
        "description": config.get("description", ""),
        "mode": config.get("mode", "single"),
        "when": [],
        "and": [],
        "then": [],
    }

    for polozka in spoustece:
        krok = _zpet_spoustec(polozka) if isinstance(polozka, dict) else None
        if krok is None:
            return None
        model["when"].append(krok)

    for polozka in podminky:
        krok = _zpet_podminka(polozka) if isinstance(polozka, dict) else None
        if krok is None:
            return None
        model["and"].append(krok)

    for polozka in akce:
        krok = _zpet_akce(polozka) if isinstance(polozka, dict) else None
        if krok is None:
            return None
        model["then"].append(krok)

    return model
