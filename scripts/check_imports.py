"""Kontrola, že nepoužíváme balíček, který v Home Assistantu nemusí být.

Verze 0.4.4 se nespustila, protože kód importoval voluptuous_serialize,
který není součástí Home Assistantu. V logu to vyšlo najevo až u zákazníka.

Tenhle skript projde naše soubory a ověří, že každý cizí import je buď
jádro Pythonu, Home Assistant, jistá závislost Home Assistantu, nebo je
uvedený v manifest.json mezi requirements.
"""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

INTEGRACE = Path("custom_components/smarthome4u")

# Balíčky, na kterých Home Assistant sám stojí a vždycky jsou k dispozici.
JISTOTY = {"homeassistant", "aiohttp", "voluptuous", "yarl", "attr", "attrs"}

# Jak se balíček jmenuje při instalaci oproti tomu, jak se importuje.
JMENA = {
    "voluptuous_serialize": "voluptuous-serialize",
    "voluptuous": "voluptuous",
}


def deklarovane() -> set[str]:
    manifest = json.loads((INTEGRACE / "manifest.json").read_text("utf-8"))
    nazvy = set()
    for polozka in manifest.get("requirements", []):
        nazev = polozka.split("==")[0].split(">=")[0].strip()
        nazvy.add(nazev.lower())
    return nazvy


def importy(soubor: Path) -> set[str]:
    strom = ast.parse(soubor.read_text("utf-8"), filename=str(soubor))
    nalezene = set()

    for uzel in ast.walk(strom):
        if isinstance(uzel, ast.Import):
            for jmeno in uzel.names:
                nalezene.add(jmeno.name.split(".")[0])
        elif isinstance(uzel, ast.ImportFrom):
            # Relativní import je náš vlastní modul.
            if uzel.level == 0 and uzel.module:
                nalezene.add(uzel.module.split(".")[0])

    return nalezene


def main() -> int:
    povolene = JISTOTY | set(sys.stdlib_module_names)
    v_manifestu = deklarovane()
    problemy = []

    for soubor in sorted(INTEGRACE.rglob("*.py")):
        for modul in sorted(importy(soubor)):
            if modul in povolene:
                continue

            balicek = JMENA.get(modul, modul).lower()
            if balicek in v_manifestu:
                continue

            problemy.append(
                f"{soubor}: importuje '{modul}', ale balíček '{balicek}' "
                "není v manifest.json mezi requirements"
            )

    if problemy:
        for problem in problemy:
            print("CHYBA:", problem)
        print()
        print(
            "Buď balíček doplň do requirements v manifest.json, nebo ho "
            "nepoužívej. Home Assistant ho jinak nemusí mít."
        )
        return 1

    print("Všechny cizí importy jsou pokryté.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
