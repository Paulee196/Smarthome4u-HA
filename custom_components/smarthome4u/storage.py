"""Vlastní data Smarthome4u.

Ukládá se jen to, co Home Assistant nemá: kdo je správce, jaký dashboard je
vybraný, které entity uživatel přeřadil jinam nebo schoval, a oblíbené.

Používá se standardní Store Home Assistantu, takže je to součást zálohy
a nikdo nesahá na soubory ručně.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from copy import deepcopy

from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.settings"

# Dostupné podoby dashboardu.
PRESET_PREHLED = "prehled"
PRESET_MISTNOSTI = "mistnosti"
PRESET_FUNKCE = "funkce"
PRESET_PUDORYS = "pudorys"
PRESET_PANEL = "panel"

PRESETY = (
    PRESET_PREHLED,
    PRESET_MISTNOSTI,
    PRESET_FUNKCE,
    PRESET_PANEL,
    PRESET_PUDORYS,
)

# Podoby, které jsou zatím jen připravené a nejdou vybrat.
# Všechny podoby jsou hotové.
PRIPRAVUJE_SE: frozenset[str] = frozenset()

VYCHOZI: dict[str, Any] = {
    # HA user ID účtu, který smí měnit nastavení. Ostatní jen ovládají dům.
    "adminUserId": None,
    "preset": PRESET_PREHLED,
    # Kiosk režim schová lištu i hlavičku Home Assistantu. Výchozí je zapnutý,
    # protože Smarthome4u má být nadstavba, ne další položka v menu.
    "kiosk": True,
    "landing": True,
    # Zvětšené ovládání pro starší uživatele a nástěnné panely.
    "bigControls": False,
    # Ruční rozvržení dashboardu. Prázdné znamená pořadí podle Home Assistantu.
    "layout": {"rooms": [], "entities": {}, "sizes": {}},
    # entity_id -> {"kind": "switch"} nebo {"hidden": true}
    "overrides": {},
    "favorites": [],
    # Půdorys: obrázek a body se zařízeními v procentech plochy.
    "floorplan": {"image": None, "points": []},
}


class Settings:
    """Nastavení Smarthome4u. Načte se jednou při startu."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        # Hluboká kopie: layout i floorplan jsou vnořené slovníky. Mělká
        # kopie by je sdílela s výchozími hodnotami a zápis by je přepsal.
        self.data: dict[str, Any] = deepcopy(VYCHOZI)

    async def load(self) -> None:
        ulozene = await self._store.async_load()
        if isinstance(ulozene, dict):
            # Doplní klíče, které v uloženém souboru ještě nebyly.
            self.data = {**deepcopy(VYCHOZI), **ulozene}
        _LOGGER.debug("Nastavení načteno, správce: %s", self.data["adminUserId"])

    async def save(self) -> None:
        await self._store.async_save(self.data)

    # ------------------------------------------------------------------
    # Správce
    # ------------------------------------------------------------------

    @property
    def admin_user_id(self) -> str | None:
        return self.data.get("adminUserId")

    async def claim_admin(self, user_id: str) -> None:
        """První administrátor Home Assistantu, který rozhraní otevře, se
        stane správcem. Může se pak kdykoliv předat."""
        if self.data.get("adminUserId") is None:
            self.data["adminUserId"] = user_id
            await self.save()
            _LOGGER.info("Správcem Smarthome4u je uživatel %s", user_id)

    async def set_admin(self, user_id: str | None) -> None:
        self.data["adminUserId"] = user_id
        await self.save()

    def role(self, user_id: str | None, je_ha_admin: bool) -> str:
        """Vrátí roli pro dané přihlášení.

        Správce je právě jeden účet. Ostatní dům ovládají, ale nenastavují.
        Dokud správce není určený, rozhoduje oprávnění z Home Assistantu -
        jinak by po instalaci nešlo nic nastavit.
        """
        spravce = self.data.get("adminUserId")
        if spravce is None:
            return "admin" if je_ha_admin else "user"
        return "admin" if user_id == spravce else "user"

    # ------------------------------------------------------------------
    # Podoba dashboardu
    # ------------------------------------------------------------------

    @property
    def preset(self) -> str:
        hodnota = self.data.get("preset")
        return hodnota if hodnota in PRESETY else PRESET_PREHLED

    async def set_preset(self, preset: str) -> None:
        if preset not in PRESETY or preset in PRIPRAVUJE_SE:
            raise ValueError(preset)
        self.data["preset"] = preset
        await self.save()

    # ------------------------------------------------------------------
    # Kiosk režim
    # ------------------------------------------------------------------

    @property
    def kiosk(self) -> bool:
        return bool(self.data.get("kiosk", True))

    @property
    def landing(self) -> bool:
        return bool(self.data.get("landing", True))

    @property
    def big_controls(self) -> bool:
        return bool(self.data.get("bigControls", False))

    async def set_big_controls(self, zapnuto: bool) -> None:
        self.data["bigControls"] = bool(zapnuto)
        await self.save()

    async def set_kiosk(self, zapnuto: bool, landing: bool | None = None) -> None:
        self.data["kiosk"] = bool(zapnuto)
        if landing is not None:
            self.data["landing"] = bool(landing)
        await self.save()

    # ------------------------------------------------------------------
    # Rozvržení dashboardu
    # ------------------------------------------------------------------

    @property
    def layout(self) -> dict[str, Any]:
        ulozene = self.data.setdefault("layout", {})
        ulozene.setdefault("rooms", [])
        ulozene.setdefault("entities", {})
        ulozene.setdefault("sizes", {})
        return ulozene

    async def set_room_order(self, poradi: list[str]) -> None:
        self.layout["rooms"] = poradi
        await self.save()

    async def set_entity_order(self, area_id: str, poradi: list[str]) -> None:
        self.layout["entities"][area_id] = poradi
        await self.save()

    async def set_size(self, entity_id: str, size: str | None) -> None:
        """Velikost dlaždice. None znamená výchozí."""
        if size:
            self.layout["sizes"][entity_id] = size
        else:
            self.layout["sizes"].pop(entity_id, None)
        await self.save()

    async def reset_layout(self) -> None:
        self.data["layout"] = {"rooms": [], "entities": {}, "sizes": {}}
        await self.save()

    # ------------------------------------------------------------------
    # Ruční opravy zařazení
    # ------------------------------------------------------------------

    @property
    def overrides(self) -> dict[str, dict]:
        return self.data.setdefault("overrides", {})

    async def set_override(
        self, entity_id: str, kind: str | None, hidden: bool | None
    ) -> None:
        """Uloží, že se entita má brát jinak, než jak ji hlásí Home Assistant."""
        zaznam = dict(self.overrides.get(entity_id, {}))

        if kind is None:
            zaznam.pop("kind", None)
        else:
            zaznam["kind"] = kind

        if hidden is None:
            zaznam.pop("hidden", None)
        else:
            zaznam["hidden"] = hidden

        if zaznam:
            self.overrides[entity_id] = zaznam
        else:
            self.overrides.pop(entity_id, None)

        await self.save()

    # ------------------------------------------------------------------
    # Půdorys
    # ------------------------------------------------------------------

    @property
    def floorplan(self) -> dict[str, Any]:
        plan = self.data.setdefault("floorplan", {})
        plan.setdefault("image", None)
        plan.setdefault("points", [])
        return plan

    async def set_floorplan_image(self, nazev: str | None) -> None:
        self.floorplan["image"] = nazev
        await self.save()

    async def set_floorplan_points(self, body: list[dict]) -> None:
        self.floorplan["points"] = body
        await self.save()

    # ------------------------------------------------------------------
    # Oblíbené
    # ------------------------------------------------------------------

    @property
    def favorites(self) -> list[str]:
        return self.data.setdefault("favorites", [])

    async def set_favorites(self, seznam: list[str]) -> None:
        """Celý seznam najednou - kvůli přeskládání a výměně míst."""
        self.data["favorites"] = seznam
        await self.save()

    async def toggle_favorite(self, entity_id: str) -> bool:
        oblibene = self.favorites
        if entity_id in oblibene:
            oblibene.remove(entity_id)
            pridano = False
        else:
            oblibene.append(entity_id)
            pridano = True
        await self.save()
        return pridano
