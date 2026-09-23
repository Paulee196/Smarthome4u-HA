"""Vlastní data Smarthome4u.

Ukládá se jen to, co Home Assistant nemá: kdo je správce, jaký dashboard je
vybraný, které entity uživatel přeřadil jinam nebo schoval, a oblíbené.

Používá se standardní Store Home Assistantu, takže je to součást zálohy
a nikdo nesahá na soubory ručně.
"""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import refs
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.settings"

# Dostupné podoby plochy.
#
# Místnosti a Funkce tu schválně nejsou. Obojí je v navigaci vlevo,
# takže jako podoba plochy by to bylo totéž dvakrát.
PRESET_PREHLED = "prehled"
PRESET_PUDORYS = "pudorys"
PRESET_TUYA = "tuya"
PRESET_HOME = "home"

# Co existovalo dřív a má se tiše převést.
PRESETY_ZRUSENE = {
    "mistnosti": PRESET_PREHLED,
    "funkce": PRESET_PREHLED,
    "panel": PRESET_PREHLED,
}

PRESETY = (
    PRESET_TUYA,
    PRESET_HOME,
    PRESET_PUDORYS,
    PRESET_PREHLED,
)

# Podoby, které jsou zatím jen připravené a nejdou vybrat.
# Všechny podoby jsou hotové.
PRIPRAVUJE_SE: frozenset[str] = frozenset()

VYCHOZI: dict[str, Any] = {
    # HA user ID účtu, který smí měnit nastavení. Ostatní jen ovládají dům.
    "adminUserId": None,
    "roles": {},
    "profiles": {},
    "preset": PRESET_TUYA,
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
    # Plocha po blocích, zvlášť pro každou podobu dashboardu.
    # Prázdné znamená "použij výchozí sestavu", ne "prázdná plocha".
    "dashboard": {},
}


class Settings:
    """Nastavení Smarthome4u. Načte se jednou při startu."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.hass = hass
        # Hluboká kopie: layout i floorplan jsou vnořené slovníky. Mělká
        # kopie by je sdílela s výchozími hodnotami a zápis by je přepsal.
        self.data: dict[str, Any] = deepcopy(VYCHOZI)

    async def load(self) -> None:
        ulozene = await self._store.async_load()
        if isinstance(ulozene, dict):
            # Doplní klíče, které v uloženém souboru ještě nebyly.
            self.data = {**deepcopy(VYCHOZI), **ulozene}
        self._migrate_entity_ids()
        _LOGGER.debug("Nastavení načteno, správce: %s", self.data["adminUserId"])

    async def save(self) -> None:
        await self._store.async_save(self.data)

    async def migrate_now(self) -> None:
        """Dožene převod na stabilní reference, až jsou entity načtené.

        Nastavení se čte při startu integrace, jenže v tu chvíli většina
        integrací ještě neběží a jejich entity nejsou v hass.states. Převod
        by tedy nenašel nic k převedení a uložená data by zůstala na starých
        entity_id. Proto se to zavolá ještě jednou, až je Home Assistant
        nastartovaný.
        """
        pred = json.dumps(self.data, sort_keys=True, default=str)
        self._migrate_entity_ids()

        if json.dumps(self.data, sort_keys=True, default=str) != pred:
            await self.save()
            _LOGGER.info("Uložené rozvržení převedeno na stabilní reference")

    def _migrate_entity_ids(self) -> None:
        """Convert old presentation data from entity_id to stable refs.

        The migration is intentionally best-effort. Missing entities are kept in
        their old form and later ignored by API/model cleanup instead of losing
        the user's layout during a temporary outage.
        """

        def norm(value: Any) -> Any:
            if not isinstance(value, str):
                return value
            return refs.normalize_ref(self.hass, value) or value

        self._migrate_presentation(self.data, norm)
        for profile in self.data.get("profiles", {}).values():
            if isinstance(profile, dict):
                self._migrate_presentation(profile, norm)

    @staticmethod
    def _migrate_presentation(data: dict, norm) -> None:
        layout = data.setdefault("layout", {})
        sizes = layout.setdefault("sizes", {})
        if isinstance(sizes, dict):
            layout["sizes"] = {norm(key): value for key, value in sizes.items()}

        entities = layout.setdefault("entities", {})
        if isinstance(entities, dict):
            layout["entities"] = {
                area_id: [norm(item) for item in order if isinstance(item, str)]
                for area_id, order in entities.items()
                if isinstance(order, list)
            }

        overrides = data.setdefault("overrides", {})
        if isinstance(overrides, dict):
            data["overrides"] = {
                norm(key): value for key, value in overrides.items()
            }

        favorites = data.setdefault("favorites", [])
        if isinstance(favorites, list):
            data["favorites"] = [
                norm(item) for item in favorites if isinstance(item, str)
            ]

        floorplan = data.setdefault("floorplan", {})
        points = floorplan.setdefault("points", [])
        if isinstance(points, list):
            fixed = []
            for point in points:
                if not isinstance(point, dict):
                    continue
                ref = point.get("entityRef") or point.get("entityId")
                fixed.append(
                    {
                        **{
                            key: point[key]
                            for key in ("label", "icon", "color", "size")
                            if key in point
                        },
                        "entityRef": norm(ref),
                        "x": point.get("x"),
                        "y": point.get("y"),
                    }
                )
            floorplan["points"] = fixed

        dashboard = data.setdefault("dashboard", {})
        if isinstance(dashboard, dict):
            for sestava in dashboard.values():
                # Starší zápis je holý seznam, novější slovník se sloupci.
                blocks = sestava.get("blocks") if isinstance(sestava, dict) else sestava
                if not isinstance(blocks, list):
                    continue
                for block in blocks:
                    if not isinstance(block, dict):
                        continue
                    entity_refs = block.get("entities")
                    if isinstance(entity_refs, list):
                        block["entities"] = [
                            norm(item) for item in entity_refs if isinstance(item, str)
                        ]
                    velikosti = block.get("sizes")
                    if isinstance(velikosti, dict):
                        block["sizes"] = {
                            norm(key): value for key, value in velikosti.items()
                        }
                    tile_styles = block.get("tileStyles")
                    if isinstance(tile_styles, dict):
                        block["tileStyles"] = {
                            norm(key): value for key, value in tile_styles.items()
                        }

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
        if user_id == spravce:
            return "admin"
        return (
            "technician"
            if self.data.get("roles", {}).get(user_id) == "technician"
            else "user"
        )

    async def set_role(self, user_id: str, role: str) -> None:
        if role == "technician":
            self.data.setdefault("roles", {})[user_id] = role
        elif role == "user":
            self.data.setdefault("roles", {}).pop(user_id, None)
        else:
            raise ValueError(role)
        await self.save()

    def presentation(self, user_id: str, role: str):
        """A user's own layout; installers keep editing the shared default."""
        return self if role != "user" else UserPresentation(self, user_id)

    # ------------------------------------------------------------------
    # Podoba dashboardu
    # ------------------------------------------------------------------

    @property
    def preset(self) -> str:
        hodnota = self.data.get("preset")
        hodnota = PRESETY_ZRUSENE.get(hodnota, hodnota)
        return hodnota if hodnota in PRESETY else PRESET_TUYA

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
    # Plocha po blocích
    # ------------------------------------------------------------------

    def board(self, preset: str) -> dict | None:
        """Sestava plochy: sloupce a bloky. None znamená výchozí sestavu.

        Do verze 0.10 se ukládal jen seznam bloků. Takový zápis se převede
        na jeden sloupec, aby stará plocha vypadala stejně jako dřív.
        """
        ulozene = self.data.get("dashboard") or {}
        sestava = ulozene.get(preset)
        # Starý nástěnný panel lze dál upravovat jako přehled.
        if sestava is None and preset == PRESET_PREHLED:
            sestava = ulozene.get("panel")

        if isinstance(sestava, list):
            return {"columns": 1, "blocks": sestava}
        if isinstance(sestava, dict) and isinstance(sestava.get("blocks"), list):
            sloupce = sestava.get("columns")
            return {
                "columns": sloupce if isinstance(sloupce, int) else 1,
                "blocks": sestava["blocks"],
            }
        return None

    async def set_board(self, preset: str, sloupce: int, bloky: list[dict]) -> None:
        """Celá sestava najednou - kvůli přeskládání i mazání."""
        self.data.setdefault("dashboard", {})[preset] = {
            "columns": sloupce,
            "blocks": bloky,
        }
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

    async def set_size(self, entity_ref: str, size: str | None) -> None:
        """Velikost dlaždice. None znamená výchozí."""
        if size:
            self.layout["sizes"][entity_ref] = size
        else:
            self.layout["sizes"].pop(entity_ref, None)
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
        self, entity_ref: str, kind: str | None, hidden: bool | None
    ) -> None:
        """Uloží, že se entita má brát jinak, než jak ji hlásí Home Assistant."""
        zaznam = dict(self.overrides.get(entity_ref, {}))

        if kind is None:
            zaznam.pop("kind", None)
        else:
            zaznam["kind"] = kind

        if hidden is None:
            zaznam.pop("hidden", None)
        else:
            zaznam["hidden"] = hidden

        if zaznam:
            self.overrides[entity_ref] = zaznam
        else:
            self.overrides.pop(entity_ref, None)

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

    async def toggle_favorite(self, entity_ref: str) -> bool:
        oblibene = self.favorites
        if entity_ref in oblibene:
            oblibene.remove(entity_ref)
            pridano = False
        else:
            oblibene.append(entity_ref)
            pridano = True
        await self.save()
        return pridano


class UserPresentation(Settings):
    """Personal layout backed by the same HA Store as the shared settings."""

    def __init__(self, parent: Settings, user_id: str) -> None:
        self.parent = parent
        self.hass = parent.hass
        self.user_id = user_id
        profiles = parent.data.setdefault("profiles", {})
        self._new = user_id not in profiles
        self.data = profiles.get(user_id) or {
            key: deepcopy(parent.data[key])
            for key in ("preset", "layout", "favorites", "floorplan", "dashboard")
        }

    @property
    def preset(self) -> str:
        hodnota = self.data.get("preset", self.parent.preset)
        hodnota = PRESETY_ZRUSENE.get(hodnota, hodnota)
        return hodnota if hodnota in PRESETY else self.parent.preset

    @property
    def overrides(self) -> dict[str, dict]:
        return self.parent.overrides

    @property
    def floorplan(self) -> dict[str, Any]:
        plan = super().floorplan
        # The image belongs to the house; each user may place their own points.
        plan["image"] = self.parent.floorplan["image"]
        return plan

    async def save(self) -> None:
        if self._new:
            self.parent.data.setdefault("profiles", {})[self.user_id] = self.data
            self._new = False
        await self.parent.save()
