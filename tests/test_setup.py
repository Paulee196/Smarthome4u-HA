"""Ověření, že integraci jde vůbec přidat a spustit.

Testovací prostředí neumí spustit celý frontend Home Assistantu - má desítky
vlastních závislostí. Označíme ho tedy za spuštěný.

Důležité: odchytává se až `frontend.async_register_built_in_panel`, tedy to
poslední, co Home Assistant sám dělá. Naše volání do `panel_custom` proběhne
doopravdy, takže test odhalí i špatné parametry. Kdyby se mockoval rovnou
`panel_custom`, testy by prošly i s nefunkční integrací - přesně to se stalo
u verze 0.4.3.
"""

from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_mock_service,
)

from custom_components.smarthome4u import storage
from custom_components.smarthome4u.const import DOMAIN, PANEL_URL, STATIC_URL


@pytest.fixture
def frontend_je_pripraveny(hass: HomeAssistant):
    """Tváří se, že frontend a panel_custom už běží."""
    hass.config.components.add("frontend")
    hass.config.components.add("panel_custom")

    with (
        patch(
            "homeassistant.components.frontend.async_register_built_in_panel"
        ) as panel,
        patch("homeassistant.components.frontend.add_extra_js_url") as takeover,
        patch("homeassistant.components.frontend.async_remove_panel"),
    ):
        yield {"panel": panel, "takeover": takeover}


async def test_pruvodce_se_otevre(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Config flow je zaregistrovaný.

    Kdyby ne, Home Assistant hlásí "Invalid handler specified".
    """
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == "form", f"Průvodce se neotevřel: {result}"
    assert result["step_id"] == "user"


async def test_pridani_a_spusteni(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Integrace se přidá a načte."""
    assert await async_setup_component(hass, "http", {})

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry", f"Přidání selhalo: {result}"

    await hass.async_block_till_done()

    entries = hass.config_entries.async_entries(DOMAIN)
    assert len(entries) == 1
    assert entries[0].state is config_entries.ConfigEntryState.LOADED, (
        f"Spuštění selhalo: {entries[0].reason}"
    )


async def test_panel_a_prevzeti(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Panel se registruje se správnými parametry a vkládá se takeover.js."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    panel = frontend_je_pripraveny["panel"]
    assert panel.called, "Panel se nezaregistroval"

    kwargs = panel.call_args.kwargs
    assert kwargs.get("frontend_url_path") == PANEL_URL
    assert kwargs.get("sidebar_title") == "Smarthome4u"

    # panel_custom zabalí naše nastavení do _panel_custom.
    vlastni = (kwargs.get("config") or {}).get("_panel_custom", {})
    assert vlastni.get("module_url") == f"{STATIC_URL}/panel.js"

    assert frontend_je_pripraveny["takeover"].called, "takeover.js se nevložil"


async def test_druhe_spusteni_nespadne(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Znovunačtení nesmí selhat na tom, že panel už existuje."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    assert entry.state is config_entries.ConfigEntryState.LOADED


async def test_api_odpovida(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Interní API vrací model domácnosti."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.get("/api/smarthome4u/model")
    assert response.status == 200, await response.text()

    data = await response.json()
    assert "rooms" in data
    assert "summary" in data
    assert data["user"]["id"]


async def test_akce_mimo_seznam_se_odmitne(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Frontend nesmí zavolat libovolnou službu Home Assistantu."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set("light.test", "off", {"supported_color_modes": ["onoff"]})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.post(
        "/api/smarthome4u/action",
        json={"entityId": "light.test", "action": "vymazat_vsechno"},
    )
    assert response.status == 400
    assert (await response.json())["error"] == "action_not_allowed"


async def test_role_a_nastaveni(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """První administrátor se stane správcem a vidí nastavení."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["user"]["role"] == "admin"
    assert model["preset"] == "tuya"

    nastaveni = await (await client.get("/api/smarthome4u/settings")).json()
    assert nastaveni["adminUserId"] == model["user"]["id"]
    # Místnosti a Funkce jsou v navigaci, jako podoba plochy zmizely.
    assert "mistnosti" not in nastaveni["presets"]
    assert nastaveni["presets"] == ["tuya", "home", "pudorys", "prehled"]
    assert "light" in nastaveni["kinds"]


async def test_zmena_podoby_dashboardu(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Správce může přepnout podobu dashboardu. Neznámou backend odmítne."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    odpoved = await client.post(
        "/api/smarthome4u/settings", json={"preset": "home"}
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["preset"] == "home"

    # Zrušená podoba ze starší verze se tiše převede na Přehled.
    settings = hass.data[DOMAIN]["settings"]
    settings.data["preset"] = "mistnosti"
    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["preset"] == "prehled"

    # Osobní volba se mění na samostatném endpointu.
    odpoved = await client.post(
        "/api/smarthome4u/preset", json={"preset": "pudorys"}
    )
    assert odpoved.status == 200
    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["preset"] == "pudorys"

    # Neznámou podobu ale backend odmítne.
    odpoved = await client.post(
        "/api/smarthome4u/preset", json={"preset": "neexistuje"}
    )
    assert odpoved.status == 400


async def test_prerazeni_entity(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Co Home Assistant hlásí jako světlo, jde přeřadit na zásuvku."""
    assert await async_setup_component(hass, "http", {})
    # Stmívatelné, takže ho automatika nechá být jako světlo.
    hass.states.async_set(
        "light.kontrolka", "on", {"supported_color_modes": ["brightness"]}
    )

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    def najdi(model):
        for room in model["rooms"]:
            for ent in room["entities"]:
                if ent["id"] == "light.kontrolka":
                    return ent
        return None

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert najdi(model)["capability"]["kind"] == "light"

    odpoved = await client.post(
        "/api/smarthome4u/entities/light.kontrolka/classify",
        json={"kind": "switch"},
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert najdi(model)["capability"]["kind"] == "switch"

    # A jde ji taky úplně schovat.
    odpoved = await client.post(
        "/api/smarthome4u/entities/light.kontrolka/classify",
        json={"hidden": True},
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert najdi(model) is None


async def test_pudorys(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Půdorys jde nahrát a rozmístit na něj zařízení."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set("light.lampa", "off", {"supported_color_modes": ["onoff"]})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    prazdny = await (await client.get("/api/smarthome4u/floorplan")).json()
    assert prazdny["image"] is None
    assert prazdny["points"] == []

    # Nejmenší platný PNG.
    obrazek = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    odpoved = await client.post(
        "/api/smarthome4u/floorplan/image", json={"data": obrazek}
    )
    assert odpoved.status == 200, await odpoved.text()

    odpoved = await client.post(
        "/api/smarthome4u/floorplan",
        json={"points": [{"entityId": "light.lampa", "x": 25, "y": 75}]},
    )
    assert odpoved.status == 200

    plan = await (await client.get("/api/smarthome4u/floorplan")).json()
    assert plan["image"].endswith(".png")
    assert plan["points"][0]["x"] == 25

    # Souřadnice mimo plochu se odmítnou.
    odpoved = await client.post(
        "/api/smarthome4u/floorplan",
        json={"points": [{"entityId": "light.lampa", "x": 500, "y": 0}]},
    )
    assert odpoved.status == 400


async def test_automatizace_z_editoru(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Model z editoru se převede na automatizaci a zpátky."""
    from custom_components.smarthome4u import builder

    model = {
        "alias": "Světlo na chodbě",
        "when": [{"type": "state", "entity": "binary_sensor.pohyb", "to": "on"}],
        "and": [],
        "then": [
            {"type": "device", "entity": "light.chodba", "command": "turn_on"},
            {"type": "wait", "minutes": 3},
            {"type": "device", "entity": "light.chodba", "command": "turn_off"},
        ],
        "mode": "restart",
    }

    _, config = builder.build(model)
    assert config["alias"] == "Světlo na chodbě"
    assert config["triggers"][0]["trigger"] == "state"
    assert config["actions"][0]["action"] == "light.turn_on"
    assert config["actions"][1]["delay"] == {"minutes": 3}

    zpet = builder.parse(config)
    assert zpet is not None
    assert len(zpet["then"]) == 3
    assert zpet["then"][1]["minutes"] == 3


async def test_slozita_automatizace_se_neupravuje(
    hass: HomeAssistant, frontend_je_pripraveny
) -> None:
    """Co editor nezná, se označí jako pokročilé a nesahá se na to."""
    from custom_components.smarthome4u import builder

    assert (
        builder.parse(
            {
                "alias": "Složitá",
                "triggers": [{"trigger": "webhook", "webhook_id": "x"}],
                "actions": [{"action": "light.turn_on"}],
            }
        )
        is None
    )


async def test_vymena_oblibenych(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Často používané jdou uložit jako celý seznam a vyměnit místo."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set("light.a", "off", {"supported_color_modes": ["onoff"]})
    hass.states.async_set("light.b", "off", {"supported_color_modes": ["onoff"]})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    odpoved = await client.post(
        "/api/smarthome4u/favorites", json={"entities": ["light.a"]}
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.a"]

    # Výměna místa je uložení celého seznamu s jiným obsahem.
    odpoved = await client.post(
        "/api/smarthome4u/favorites", json={"entities": ["light.b"]}
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.b"]


async def test_oblibene_preziji_prejmenovani_entity(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Oblíbené se vážou na registry ID, ne na měnitelné entity_id."""
    assert await async_setup_component(hass, "http", {})

    registry = er.async_get(hass)
    entry_record = registry.async_get_or_create(
        "light", "test", "stable-a", suggested_object_id="lampa"
    )
    hass.states.async_set(
        entry_record.entity_id, "off", {"supported_color_modes": ["onoff"]}
    )

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    assert (
        await client.post(
            "/api/smarthome4u/favorites",
            json={"entities": [entry_record.entity_id]},
        )
    ).status == 200

    registry.async_update_entity(
        entry_record.entity_id, new_entity_id="light.nova_lampa"
    )
    hass.states.async_remove(entry_record.entity_id)
    hass.states.async_set(
        "light.nova_lampa", "off", {"supported_color_modes": ["onoff"]}
    )

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.nova_lampa"]
    assert [e["ref"] for e in model["favorites"]] == [entry_record.id]

    # Co v Home Assistantu není, se tiše vynechá.
    hass.states.async_set("light.b", "off", {"supported_color_modes": ["onoff"]})
    odpoved = await client.post(
        "/api/smarthome4u/favorites",
        json={"entities": ["light.b", "light.neexistuje"]},
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.b"]


async def test_kiosk_zustane_zapnuty(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Kiosk je ve výchozím stavu zapnutý a přepnutí přežije restart."""
    assert await async_setup_component(hass, "http", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    # Bez jakéhokoliv nastavení musí být kiosk zapnutý.
    stav = await (await client.get("/api/smarthome4u/kiosk")).json()
    assert stav["kiosk"] is True

    # Vypnutí a zapnutí se musí propsat do nastavení i do uloženého souboru.
    assert (
        await client.post("/api/smarthome4u/settings", json={"kiosk": False})
    ).status == 200
    stav = await (await client.get("/api/smarthome4u/kiosk")).json()
    assert stav["kiosk"] is False

    assert (
        await client.post("/api/smarthome4u/settings", json={"kiosk": True})
    ).status == 200

    # Nová instance čte tentýž soubor - tohle je ten restart.
    nove = storage.Settings(hass)
    await nove.load()
    assert nove.kiosk is True


async def test_pomocnici_se_zobrazi(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Pomocníci z Home Assistanta nesmí propadnout sítem."""
    assert await async_setup_component(hass, "http", {})

    hass.states.async_set("input_text.poznamka", "ahoj", {"max": 100})
    hass.states.async_set("input_datetime.budik", "2026-09-21 06:30:00",
                          {"has_date": True, "has_time": True})
    # Počítadlo jako skutečná integrace - jinak by neexistovala služba
    # counter.increment a nešlo by ověřit, že se dá ovládat.
    assert await async_setup_component(
        hass, "counter", {"counter": {"kava": {"initial": 3, "step": 1}}}
    )
    hass.states.async_set("timer.peceni", "idle", {"duration": "0:30:00"})
    hass.states.async_set("schedule.topeni", "on", {})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    model = await (await client.get("/api/smarthome4u/model")).json()

    druhy = {
        entity["id"]: entity["capability"]["kind"]
        for room in model["rooms"]
        for entity in room["entities"]
    }

    assert druhy.get("input_text.poznamka") == "text"
    assert druhy.get("input_datetime.budik") == "datetime"
    assert druhy.get("counter.kava") == "counter"
    assert druhy.get("timer.peceni") == "timer"
    assert druhy.get("schedule.topeni") == "schedule"

    # A musí jít i ovládat, ne jen zobrazit.
    odpoved = await client.post(
        "/api/smarthome4u/action",
        json={"entityId": "counter.kava", "action": "increment"},
    )
    assert odpoved.status == 200


async def test_plocha_po_blocich(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Sestava plochy se uloží, vrátí a přežije restart."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set("light.a", "off", {"supported_color_modes": ["onoff"]})

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    # Dokud správce nic neupravil, rozhoduje výchozí sestava z frontendu.
    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["board"] is None

    odpoved = await client.post("/api/smarthome4u/preset", json={"preset": "prehled"})
    assert odpoved.status == 200

    sestava = [
        {"id": "b1", "type": "status", "cols": 3, "icon": "home", "color": "mint"},
        {
            "id": "b2",
            "type": "entities",
            "title": "Moje",
            "cols": 9,
            "entities": ["light.a", "light.neexistuje"],
            "sizes": {"light.a": "l", "light.neexistuje": "s", "x": "obri"},
            "tileStyles": {
                "light.a": {
                    "label": "Nový název", "icon": "lighting", "color": "blue"
                }
            },
        },
    ]
    odpoved = await client.post(
        "/api/smarthome4u/dashboard",
        json={"preset": "prehled", "columns": 3, "blocks": sestava},
    )
    assert odpoved.status == 200, await odpoved.text()

    model = await (await client.get("/api/smarthome4u/model")).json()
    sestava = model["board"]
    assert sestava["columns"] == 3
    assert [b["type"] for b in sestava["blocks"]] == ["status", "entities"]
    assert sestava["blocks"][0]["cols"] == 3
    assert sestava["blocks"][0]["color"] == "mint"
    # Šířka přes víc sloupců, než plocha má, se zahodí.
    assert "cols" not in sestava["blocks"][1]
    # Co v Home Assistantu není, se tiše vynechá - v seznamu i ve velikostech.
    assert sestava["blocks"][1]["entities"] == ["entity:light.a"]
    assert sestava["blocks"][1]["sizes"] == {"entity:light.a": "l"}
    assert sestava["blocks"][1]["tileStyles"] == {
        "entity:light.a": {"label": "Nový název", "icon": "lighting", "color": "blue"}
    }
    assert sestava["blocks"][1]["title"] == "Moje"

    # Nová instance čte tentýž soubor - tohle je ten restart.
    nove = storage.Settings(hass)
    await nove.load()
    assert len(nove.board("prehled")["blocks"]) == 2
    # Ostatní podoby plochy se tím nezměnily.
    assert nove.board("panel") is None

    # Sestava ze starší verze byla holý seznam. Musí se přečíst jako
    # jeden sloupec, aby stará plocha vypadala stejně jako dřív.
    nove.data["dashboard"]["panel"] = [{"id": "z", "type": "clock"}]
    assert nove.board("panel") == {
        "columns": 1,
        "blocks": [{"id": "z", "type": "clock"}],
    }

    # Nesmysly se odmítnou.
    spatne = await client.post(
        "/api/smarthome4u/dashboard",
        json={"preset": "neexistuje", "blocks": []},
    )
    assert spatne.status == 400
    spatne = await client.post(
        "/api/smarthome4u/dashboard",
        json={"preset": "prehled", "columns": 7, "blocks": []},
    )
    assert spatne.status == 400


async def test_bloky_preziji_prejmenovani_entity(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Dashboard bloky drží stabilní ref a dohledají nový entity_id."""
    assert await async_setup_component(hass, "http", {})

    registry = er.async_get(hass)
    entry_record = registry.async_get_or_create(
        "light", "test", "stable-block", suggested_object_id="pracovna"
    )
    hass.states.async_set(
        entry_record.entity_id, "off", {"supported_color_modes": ["onoff"]}
    )

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()

    odpoved = await client.post("/api/smarthome4u/preset", json={"preset": "prehled"})
    assert odpoved.status == 200

    odpoved = await client.post(
        "/api/smarthome4u/dashboard",
        json={
            "preset": "prehled",
            "blocks": [
                {
                    "id": "b1",
                    "type": "entities",
                    "title": "Pracovna",
                    "entities": [entry_record.entity_id],
                }
            ],
        },
    )
    assert odpoved.status == 200, await odpoved.text()

    registry.async_update_entity(
        entry_record.entity_id, new_entity_id="light.pracovna_nova"
    )
    hass.states.async_remove(entry_record.entity_id)
    hass.states.async_set(
        "light.pracovna_nova", "off", {"supported_color_modes": ["onoff"]}
    )

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["board"]["blocks"][0]["entities"] == [entry_record.id]
    assert any(
        entity["id"] == "light.pracovna_nova" and entity["ref"] == entry_record.id
        for room in model["rooms"]
        for entity in room["entities"]
    )


async def test_pudorys_prezije_prejmenovani_entity(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Body půdorysu se ukládají přes ref a vrací aktuální entity_id."""
    assert await async_setup_component(hass, "http", {})

    registry = er.async_get(hass)
    entry_record = registry.async_get_or_create(
        "light", "test", "stable-plan", suggested_object_id="bod"
    )
    hass.states.async_set(
        entry_record.entity_id, "off", {"supported_color_modes": ["onoff"]}
    )

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    odpoved = await client.post(
        "/api/smarthome4u/floorplan",
        json={"points": [{"entityId": entry_record.entity_id, "x": 10, "y": 20}]},
    )
    assert odpoved.status == 200, await odpoved.text()

    registry.async_update_entity(entry_record.entity_id, new_entity_id="light.bod_novy")
    hass.states.async_remove(entry_record.entity_id)
    hass.states.async_set("light.bod_novy", "off", {"supported_color_modes": ["onoff"]})

    plan = await (await client.get("/api/smarthome4u/floorplan")).json()
    assert plan["points"] == [
        {
            "entityRef": entry_record.id,
            "entityId": "light.bod_novy",
            "x": 10,
            "y": 20,
        }
    ]


async def test_svetlo_je_jen_svetlo(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Co umí jen zapnout a vypnout, není světlo - dokud správce neřekne."""
    assert await async_setup_component(hass, "http", {})

    # Skutečné světlo: umí se stmívat.
    hass.states.async_set(
        "light.stropni", "on", {"supported_color_modes": ["brightness"]}
    )
    # Relé v prodlužce, které se hlásí jako světlo.
    hass.states.async_set(
        "light.prodluzka", "on", {"supported_color_modes": ["onoff"]}
    )

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    model = await (await client.get("/api/smarthome4u/model")).json()

    druhy = {
        entity["id"]: entity["capability"]["kind"]
        for room in model["rooms"]
        for entity in room["entities"]
    }
    assert druhy["light.stropni"] == "light"
    assert druhy["light.prodluzka"] == "switch"

    # Do počtu rozsvícených světel se prodlužka nesmí počítat.
    assert model["summary"]["lightsOn"] == 1

    # Správce to může vrátit.
    nastaveni = await (await client.get("/api/smarthome4u/settings")).json()
    assert {p["id"] for p in nastaveni["lights"]} == {
        "light.stropni",
        "light.prodluzka",
    }

    odpoved = await client.post(
        "/api/smarthome4u/entities/light.prodluzka/classify",
        json={"kind": "light"},
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["summary"]["lightsOn"] == 2

    # A vypnout musí jít pořád - služba se volá na doméně entity,
    # ne na doméně, kterou jsme si o ní mysleli.
    odpoved = await client.post(
        "/api/smarthome4u/entities/light.prodluzka/classify",
        json={"kind": "switch"},
    )
    assert odpoved.status == 200

    volani = async_mock_service(hass, "light", "turn_off")
    odpoved = await client.post(
        "/api/smarthome4u/action",
        json={"entityId": "light.prodluzka", "action": "turn_off"},
    )
    assert odpoved.status == 200
    await hass.async_block_till_done()
    assert len(volani) == 1


async def test_migrace_dozene_reference_po_startu(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Uložená data ze starších verzí se převedou, až entity naběhnou.

    Nastavení se čte při startu integrace, kdy většina entit ještě
    neexistuje. Kdyby se převod odbyl jen tam, zůstala by stará data
    navždy na entity_id.
    """
    assert await async_setup_component(hass, "http", {})

    registry = er.async_get(hass)
    zaznam = registry.async_get_or_create(
        "light", "test", "stabilni-migrace", suggested_object_id="lampa"
    )

    # Nastavení, jaké po sobě nechala verze 0.10.1: klíčem je entity_id.
    stara = storage.Settings(hass)
    await stara.load()
    stara.data["favorites"] = [zaznam.entity_id]
    await stara.save()

    entry = MockConfigEntry(domain=DOMAIN, title="Smarthome4u", unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Entita naběhne až teď, po startu integrace.
    hass.states.async_set(
        zaznam.entity_id, "off", {"supported_color_modes": ["onoff"]}
    )

    settings = hass.data[DOMAIN]["settings"]
    await settings.migrate_now()

    assert settings.favorites == [zaznam.id]

    # A převod se nesmí při opakování rozjet podruhé.
    await settings.migrate_now()
    assert settings.favorites == [zaznam.id]

    # Po přejmenování ukazuje oblíbená položka pořád na tutéž entitu.
    registry.async_update_entity(zaznam.entity_id, new_entity_id="light.jina")
    hass.states.async_remove(zaznam.entity_id)
    hass.states.async_set("light.jina", "off", {"supported_color_modes": ["onoff"]})

    client = await hass_client()
    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.jina"]
