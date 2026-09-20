"""Version gate.

Ověří, zda běžíme proti otestované verzi Home Assistantu.

Neznámá novější verze NESMÍ zablokovat aplikaci. Čtení stavů a ovládání
pokračuje, jen se rizikové zápisové operace označí jako neověřené.
"""

from __future__ import annotations

import re

# Otestovaný rozsah. Aktualizuje se spolu s docs/HA_COMPATIBILITY.md.
TESTED_MIN = (2026, 8)
TESTED_MAX = (2026, 9)

_VERSION_RE = re.compile(r"^(\d{4})\.(\d{1,2})")


def parse(version: str | None) -> tuple[int, int] | None:
    if not version:
        return None
    match = _VERSION_RE.match(version)
    if match is None:
        return None
    return (int(match.group(1)), int(match.group(2)))


def check(version: str | None) -> dict[str, object]:
    """Vrátí stav kompatibility a zda jsou zápisové operace ověřené."""
    parsed = parse(version)

    if parsed is None:
        return {
            "status": "unknown",
            "writesVerified": False,
            "version": version,
        }

    if parsed < TESTED_MIN:
        return {"status": "older", "writesVerified": False, "version": version}

    if parsed > TESTED_MAX:
        return {"status": "newer", "writesVerified": False, "version": version}

    return {"status": "ok", "writesVerified": True, "version": version}
