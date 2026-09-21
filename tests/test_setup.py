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
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

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
    assert model["preset"] == "prehled"

    nastaveni = await (await client.get("/api/smarthome4u/settings")).json()
    assert nastaveni["adminUserId"] == model["user"]["id"]
    assert "mistnosti" in nastaveni["presets"]
    assert "panel" in nastaveni["presets"]
    assert len(nastaveni["presets"]) == 5
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
        "/api/smarthome4u/settings", json={"preset": "mistnosti"}
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert model["preset"] == "mistnosti"

    # Půdorys je od 0.8.0 hotový.
    odpoved = await client.post(
        "/api/smarthome4u/settings", json={"preset": "pudorys"}
    )
    assert odpoved.status == 200

    # Neznámou podobu ale backend odmítne.
    odpoved = await client.post(
        "/api/smarthome4u/settings", json={"preset": "neexistuje"}
    )
    assert odpoved.status == 400


async def test_prerazeni_entity(
    hass: HomeAssistant, frontend_je_pripraveny, hass_client
) -> None:
    """Co Home Assistant hlásí jako světlo, jde přeřadit na zásuvku."""
    assert await async_setup_component(hass, "http", {})
    hass.states.async_set(
        "light.kontrolka", "on", {"supported_color_modes": ["onoff"]}
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

    # Co v Home Assistantu není, se tiše vynechá.
    odpoved = await client.post(
        "/api/smarthome4u/favorites",
        json={"entities": ["light.b", "light.neexistuje"]},
    )
    assert odpoved.status == 200

    model = await (await client.get("/api/smarthome4u/model")).json()
    assert [e["id"] for e in model["favorites"]] == ["light.b"]
