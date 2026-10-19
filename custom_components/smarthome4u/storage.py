"""Vlastní data Smarthome4u.

Ukládá se jen to, co Home Assistant nemá: kdo je správce, jaký dashboard je
vybraný, které entity uživatel přeřadil jinam nebo schoval, a oblíbené.

Používá se standardní Store Home Assistantu, takže je to součást zálohy
a nikdo nesahá na soubory ručně.
"""

from __future__ import annotations

import json
import hashlib
import logging
import uuid
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
    "floorplan": {"image": None, "points": [], "rooms": []},
    # Plocha po blocích, zvlášť pro každou podobu dashboardu.
    # Prázdné znamená "použij výchozí sestavu", ne "prázdná plocha".
    "dashboard": {},
    # Poslední úpravy každé podoby plochy; jen layout, nikdy stav zařízení.
    "dashboardHistory": {},
    # Sdílený seznam ploch. Chybějící klíč ve staré instalaci spouští převod.
    "dashboards": None,
    "dashboardAssignments": {},
    "dashboardStartMigrated": False,
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
        migrate_catalog = not isinstance(ulozene, dict) or not isinstance(
            ulozene.get("dashboards"), list)
        if isinstance(ulozene, dict):
            # Doplní klíče, které v uloženém souboru ještě nebyly.
            self.data = {**deepcopy(VYCHOZI), **ulozene}
        self._migrate_dashboards(is_upgrade=isinstance(ulozene, dict))
        self._migrate_dashboard_start()
        self._migrate_entity_ids()
        if migrate_catalog or not isinstance(ulozene, dict) or not ulozene.get(
            "dashboardStartMigrated"):
            await self.save()
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

    def _migrate_dashboards(self, is_upgrade: bool = False) -> None:
        """Keep all four legacy boards on upgrades; start fresh homes simply."""
        if isinstance(self.data.get("dashboards"), list):
            return
        old = self.data.get("dashboard", {})
        legacy = is_upgrade or (isinstance(old, dict) and bool(old))
        legacy = legacy or bool(self.data.get("floorplan", {}).get("image"))
        legacy = legacy or self.data.get("preset") != PRESET_TUYA
        legacy = legacy or bool(self.data.get("profiles"))
        self.data["dashboards"] = (
            [{"id": key, "name": name, "template": key} for key, name in (
                (PRESET_TUYA, "Chytrá domácnost"),
                (PRESET_HOME, "Domov"),
                (PRESET_PUDORYS, "Půdorys"),
                (PRESET_PREHLED, "Přehled HA"),
            )] if legacy else [self._overview()]
        )
        if not legacy:
            self.data["preset"] = "overview"
            return
        # Staré osobní úpravy nesmí při přechodu na sdílený katalog zmizet.
        # Každou odlišnou sestavu převedeme na samostatnou plochu a účtu
        # přiřadíme tu, kterou měl naposledy otevřenou.
        assignments = self.data.setdefault("dashboardAssignments", {})
        global_boards = self.data.setdefault("dashboard", {})
        for user_id, profile in self.data.get("profiles", {}).items():
            if not isinstance(profile, dict):
                continue
            personal_boards = profile.get("dashboard", {})
            imported = {}
            if isinstance(personal_boards, dict):
                for key, board in personal_boards.items():
                    template = PRESETY_ZRUSENE.get(key, key)
                    if template not in PRESETY or board == global_boards.get(key):
                        continue
                    suffix = hashlib.sha256(f"{user_id}:{key}".encode()).hexdigest()[:10]
                    ident = f"old-{suffix}"
                    self.data["dashboards"].append({
                        "id": ident, "name": f"Osobní plocha · {key}",
                        "template": template,
                    })
                    global_boards[ident] = deepcopy(board)
                    personal_history = profile.get("dashboardHistory", {}).get(key)
                    if isinstance(personal_history, dict):
                        self.data.setdefault("dashboardHistory", {})[ident] = deepcopy(
                            personal_history)
                    imported[key] = ident
            selected = PRESETY_ZRUSENE.get(profile.get("preset"), profile.get("preset"))
            assignments[user_id] = imported.get(selected, selected if selected in PRESETY
                                                else self.data["dashboards"][0]["id"])

    def _migrate_dashboard_start(self) -> None:
        """Show the HA-derived overview first, once, without discarding old boards."""
        if self.data.get("dashboardStartMigrated"):
            return
        dashboards = self.dashboards
        if not any(item["id"] == "overview" for item in dashboards):
            dashboards.insert(0, self._overview())
        self.data["preset"] = "overview"
        self.data["dashboardStartMigrated"] = True

    @staticmethod
    def _overview() -> dict[str, str]:
        return {"id": "overview", "name": "Přehled domácnosti", "template": "overview"}

    @property
    def dashboards(self) -> list[dict[str, str]]:
        if self.data.get("dashboards") is None:
            self._migrate_dashboards()
        return self.data["dashboards"]

    def dashboard_ids(self) -> set[str]:
        return {item["id"] for item in self.dashboards}

    def dashboards_for(self, user_id: str, role: str) -> list[dict[str, str]]:
        if role == "admin":
            return self.dashboards
        assigned = self.data.get("dashboardAssignments", {}).get(user_id)
        default = assigned if assigned in self.dashboard_ids() else self.dashboards[0]["id"]
        return [item for item in self.dashboards
                if item["id"] == default or item.get("ownerId") == user_id]

    def can_edit_dashboard(self, user_id: str, role: str, ident: str) -> bool:
        return any(item["id"] == ident and (role == "admin"
                   or item.get("ownerId") == user_id) for item in self.dashboards)

    async def create_dashboard(self, name: str, template: str,
                               owner_id: str | None = None) -> str:
        ident = "d-" + uuid.uuid4().hex[:12]
        entry = {"id": ident, "name": name, "template": template}
        if owner_id:
            entry["ownerId"] = owner_id
        self.dashboards.append(entry)
        if template in ("overview", "pudorys", "blank"):
            blocks = ([
                {"id": "overview-headline", "type": "headline", "cols": 2,
                 "title": "Přehled domácnosti"},
                {"id": "overview-status", "type": "status", "cols": 2},
                {"id": "auto-rooms", "type": "auto_rooms", "cols": 2},
            ] if template == "overview" else
                [{"id": "floorplan", "type": "floorplan", "cols": 2}]
                if template == "pudorys" else [])
            self.data.setdefault("dashboard", {})[ident] = {
                "columns": 2, "blocks": blocks,
            }
        await self.save()
        return ident

    async def rename_dashboard(self, ident: str, name: str) -> None:
        next(item for item in self.dashboards if item["id"] == ident)["name"] = name
        await self.save()

    async def delete_dashboard(self, ident: str) -> None:
        if len(self.dashboards) < 2:
            raise ValueError("last_dashboard")
        was_selected = self.preset == ident
        self.data["dashboards"] = [item for item in self.dashboards if item["id"] != ident]
        self.data.setdefault("dashboard", {}).pop(ident, None)
        self.data.setdefault("dashboardHistory", {}).pop(ident, None)
        if was_selected:
            self.data["preset"] = self.dashboards[0]["id"]
        for uid, assigned in list(self.data.get("dashboardAssignments", {}).items()):
            if assigned == ident:
                self.data["dashboardAssignments"].pop(uid)
        await self.save()

    async def assign_dashboard(self, user_id: str, ident: str) -> None:
        if ident not in self.dashboard_ids():
            raise ValueError(ident)
        self.data.setdefault("dashboardAssignments", {})[user_id] = ident
        await self.save()

    async def restore_overview(self) -> str:
        existing = next((item["id"] for item in self.dashboards
                         if item["id"] == "overview"), None)
        if existing:
            return existing
        self.dashboards.insert(0, self._overview())
        self.data.setdefault("dashboard", {}).pop("overview", None)
        await self.save()
        return "overview"

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
                updated = dict(point)
                updated.pop("entityId", None)
                updated["entityRef"] = norm(ref)
                if updated.get("feedbackRef"):
                    updated["feedbackRef"] = norm(updated["feedbackRef"])
                actions = updated.get("actions")
                for action in actions.values() if isinstance(actions, dict) else []:
                    if isinstance(action, dict) and action.get("entityRef"):
                        action["entityRef"] = norm(action["entityRef"])
                fixed.append(updated)
            floorplan["points"] = fixed
        for marker in floorplan.get("rooms", []):
            if not isinstance(marker, dict):
                continue
            if marker.get("feedbackRef"):
                marker["feedbackRef"] = norm(marker["feedbackRef"])
            actions = marker.get("actions")
            for action in actions.values() if isinstance(actions, dict) else []:
                if isinstance(action, dict) and action.get("entityRef"):
                    action["entityRef"] = norm(action["entityRef"])

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
                    room_layouts = block.get("roomLayouts")
                    if isinstance(room_layouts, dict):
                        for room_layout in room_layouts.values():
                            if not isinstance(room_layout, dict):
                                continue
                            for key in ("entities", "excluded"):
                                items = room_layout.get(key)
                                if isinstance(items, list):
                                    room_layout[key] = [norm(item) for item in items]
                            for key in ("sizes", "tileStyles"):
                                values = room_layout.get(key)
                                if isinstance(values, dict):
                                    room_layout[key] = {
                                        norm(ref): value for ref, value in values.items()
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

        Správce je právě jeden účet. Ostatní mají výchozí plný přístup,
        pokud je správce výslovně neomezil na základní ovládání.
        Dokud správce není určený, rozhoduje oprávnění z Home Assistantu -
        jinak by po instalaci nešlo nic nastavit.
        """
        spravce = self.data.get("adminUserId")
        if spravce is None:
            return "admin" if je_ha_admin else "technician"
        if user_id == spravce:
            return "admin"
        return self.data.get("roles", {}).get(user_id, "technician")

    async def set_role(self, user_id: str, role: str) -> None:
        if role == "technician":
            self.data.setdefault("roles", {}).pop(user_id, None)
        elif role == "user":
            self.data.setdefault("roles", {})[user_id] = role
        else:
            raise ValueError(role)
        await self.save()

    def presentation(self, user_id: str, role: str):
        """Each account edits its own layout; the owner keeps the shared default."""
        return self if role == "admin" else UserPresentation(self, user_id)

    # ------------------------------------------------------------------
    # Podoba dashboardu
    # ------------------------------------------------------------------

    @property
    def preset(self) -> str:
        hodnota = self.data.get("preset")
        hodnota = PRESETY_ZRUSENE.get(hodnota, hodnota)
        return hodnota if hodnota in self.dashboard_ids() else self.dashboards[0]["id"]

    async def set_preset(self, preset: str) -> None:
        if preset not in self.dashboard_ids():
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
        boards = self.data.setdefault("dashboard", {})
        current = {"columns": sloupce, "blocks": bloky}
        if boards.get(preset) == current:
            return
        self._remember_board(preset)
        boards[preset] = current
        await self.save()

    def _board_snapshot(self, preset: str) -> dict:
        result = {"board": deepcopy(self.data.get("dashboard", {}).get(preset))}
        if preset == PRESET_PUDORYS:
            result["points"] = deepcopy(self.floorplan["points"])
            result["rooms"] = deepcopy(self.floorplan["rooms"])
        return result

    def _remember_board(self, preset: str) -> None:
        history = self.data.setdefault("dashboardHistory", {}).setdefault(
            preset, {"undo": [], "redo": []}
        )
        history["undo"] = [*history.get("undo", []), self._board_snapshot(preset)][-20:]
        history["redo"] = []

    def board_history(self, preset: str) -> dict[str, bool]:
        history = self.data.get("dashboardHistory", {}).get(preset, {})
        return {"undo": bool(history.get("undo")), "redo": bool(history.get("redo"))}

    async def restore_board(self, preset: str, direction: str) -> bool:
        """Restore a previously validated layout from this user's own Store."""
        if direction not in ("undo", "redo"):
            return False
        history = self.data.get("dashboardHistory", {}).get(preset, {})
        source = history.get(direction, [])
        if not source:
            return False
        boards = self.data.setdefault("dashboard", {})
        target = "redo" if direction == "undo" else "undo"
        history[target] = [*history.get(target, []), self._board_snapshot(preset)][-20:]
        previous = source.pop()
        if previous["board"] is None:
            boards.pop(preset, None)
        else:
            boards[preset] = previous["board"]
        if preset == PRESET_PUDORYS:
            self.floorplan["points"] = previous["points"]
            self.floorplan["rooms"] = previous["rooms"]
        await self.save()
        return True

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
        plan.setdefault("rooms", [])
        return plan

    async def set_floorplan_image(self, nazev: str | None) -> None:
        self.floorplan["image"] = nazev
        await self.save()

    async def set_floorplan_points(self, body: list[dict]) -> None:
        self.floorplan["points"] = body
        await self.save()

    async def set_floorplan_rooms(self, body: list[dict]) -> None:
        self.floorplan["rooms"] = body
        await self.save()

    async def set_floorplan_markers(
        self, points: list[dict] | None, rooms: list[dict] | None,
    ) -> None:
        """Save validated markers together and keep one reversible revision."""
        if (points is None or self.floorplan["points"] == points) and (
            rooms is None or self.floorplan["rooms"] == rooms
        ):
            return
        self._remember_board(PRESET_PUDORYS)
        if points is not None:
            self.floorplan["points"] = points
        if rooms is not None:
            self.floorplan["rooms"] = rooms
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
            for key in (
                "preset", "layout", "favorites", "floorplan", "dashboard",
                "kiosk", "landing", "bigControls",
            )
        }
        if self._new:
            self.data["dashboardHistory"] = {}

    @property
    def preset(self) -> str:
        hodnota = self.data.get("preset", self.parent.preset)
        hodnota = PRESETY_ZRUSENE.get(hodnota, hodnota)
        return hodnota if hodnota in self.parent.dashboard_ids() else self.parent.preset

    @property
    def dashboards(self) -> list[dict[str, str]]:
        return self.parent.dashboards

    def dashboard_ids(self) -> set[str]:
        return self.parent.dashboard_ids()

    @property
    def kiosk(self) -> bool:
        return bool(self.data.get("kiosk", self.parent.kiosk))

    @property
    def landing(self) -> bool:
        return bool(self.data.get("landing", self.parent.landing))

    @property
    def big_controls(self) -> bool:
        return bool(self.data.get("bigControls", self.parent.big_controls))

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
