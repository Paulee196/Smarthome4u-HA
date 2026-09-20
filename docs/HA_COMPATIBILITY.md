# Napojení na Home Assistant

Povinná evidence. Každé místo, kde Smarthome4u sahá na Home Assistant, musí být
v této tabulce. Cíl: při breaking change okamžitě vědět, co může být zasažené.

Jako integrace používáme Python API Home Assistantu. Odpadlo tím celé dřívější
hádání nedokumentovaných WebSocket commandů.

---

## Legenda

| Typ | Význam | Riziko |
|---|---|---|
| **veřejné** | Dokumentované pro autory integrací | Nízké, breaking change je ohlášený |
| **interní** | Stabilní, ale bez záruky pro integrace | Střední |

---

## Čtení domácnosti

Vše v `home.py`.

| Napojení | Účel | Typ |
|---|---|---|
| `helpers.area_registry.async_get` | Místnosti | veřejné |
| `helpers.device_registry.async_get` | Zařízení | veřejné |
| `helpers.entity_registry.async_get` | Registr entit, persistentní ID | veřejné |
| `helpers.floor_registry.async_get` | Patra | veřejné |
| `hass.states.async_all` / `get` | Aktuální stavy | veřejné |
| `hass.config_entries.async_entries` | Připojené integrace | veřejné |
| `er.async_entries_for_device` | Entity jednoho zařízení | veřejné |
| `device.primary_config_entry` | Vlastník zařízení (HA 2026.8+) | veřejné |

Model se nikde necachuje. Při každém požadavku se čte živý stav, takže nemůže
vzniknout rozpor mezi tím, co vidíme my, a tím, co má Home Assistant.

---

## Zápisy

Vše v `api.py`.

| Napojení | Účel | Typ |
|---|---|---|
| `ar.async_create` / `async_update` / `async_delete` | Místnosti | veřejné |
| `fr.async_create` / `async_update` / `async_delete` | Patra | veřejné |
| `dr.async_update_device` | Název a místnost zařízení | veřejné |
| `er.async_update_entity` | Název a místnost entity | veřejné |
| `hass.services.async_call` | Všechny ovládací akce | veřejné |
| `hass.config_entries.async_remove` | Odebrání integrace | veřejné |

Smazání místnosti nemaže zařízení. Zůstanou nezařazená.

Frontend nesmí zavolat libovolnou službu. Povolené dvojice schopnost - akce jsou
v `capability.py` v tabulce `_ACTIONS` a hodnoty se ověřují na typ i rozsah.

---

## Průvodce přidáním integrace

| Napojení | Účel | Typ |
|---|---|---|
| `hass.config_entries.flow.async_init` | Zahájení průvodce | veřejné |
| `hass.config_entries.flow.async_configure` | Další krok | veřejné |
| `hass.config_entries.flow.async_abort` | Zrušení | veřejné |
| `hass.config_entries.flow.async_progress` | Nalezená zařízení | veřejné |
| `loader.async_get_config_flows` | Co jde přidat průvodcem | **interní** |
| `loader.async_get_integrations` | Názvy integrací | **interní** |
| `voluptuous_serialize.convert` | Schéma na popis formuláře | **interní** |
| `cv.custom_serializer` | Serializace selektorů | **interní** |
| `helpers.translation.async_get_translations` | České popisky polí | veřejné |

Dvojice `voluptuous_serialize` a `cv.custom_serializer` je přesně to, co používá
frontend Home Assistantu. Dostáváme tedy stejná data jako on.

---

## Soubory

| Soubor | Účel | Reload |
|---|---|---|
| `automations.yaml` | Automatizace ze šablon | `automation.reload` |
| `scenes.yaml` | Scény ze stavu místnosti | `scene.reload` |

Zapisuje se přes dočasný soubor a atomické přejmenování, aby výpadek napájení
nepoškodil konfiguraci.

**Do `.storage` se ručně nesahá nikdy.** Vlastní data půjdou přes
`helpers.storage.Store`.

Předpoklad: `configuration.yaml` obsahuje výchozí
`automation: !include automations.yaml` a `scene: !include scenes.yaml`.
Bez nich se zapsané automatizace nenačtou.

---

## Frontend

| Napojení | Účel | Typ |
|---|---|---|
| `panel_custom.async_register_panel` | Registrace našeho panelu | veřejné |
| `http.StaticPathConfig` | Servírování našich souborů | veřejné |
| `HomeAssistantView` | Interní API s ověřením přihlášení | veřejné |
| `frontend.add_extra_js_url` | Vložení `takeover.js` do frontendu HA | **interní** |
| `frontend.async_remove_panel` | Úklid při vypnutí | veřejné |
| `hass.connection.subscribeEvents` | Realtime změny stavů | veřejné |

---

## Rizikové oblasti

### takeover.js

Schování lišty sahá do stínového stromu `home-assistant-main`, což je vnitřek
frontendu Home Assistantu. Ten se může kdykoliv změnit bez ohlášení.

**Opatření:** celý modul je v try/catch, při jakékoliv nejistotě neudělá nic
a Home Assistant zůstane plně funkční. Nejhorší možný následek je, že lišta
zůstane vidět. Uživatel si obojí může vypnout v možnostech integrace.

### Config Flow ve vlastním UI

Tvar serializovaného schématu není smlouva pro integrace. Novější integrace
používají selektory.

**Opatření:** `flows.py` umí text, heslo, číslo, přepínač, výběr a vícenásobný
výběr ve starém i selektorovém tvaru. Pole, které nerozpozná, se přeskočí
a uživateli se řekne, že část nastavení nešla zobrazit. Neznámý typ kroku
skončí hláškou a nabídkou zrušení, nikdy pádem.

Podporované typy kroků: `form`, `menu`, `external_step`, `progress`,
`create_entry`, `abort`.

### Zápis do konfiguračních souborů

Home Assistant nemá veřejné Python API pro ukládání automatizací a scén. Proto
píšeme do stejných souborů, do kterých píše jeho vlastní editor.

**Opatření:** automatizace se tvoří jen ze šesti pevných šablon, jejichž výstup
je známý. Poškozený nebo neočekávaný soubor skončí srozumitelnou chybou, nikdy
se nepřepíše.

### Device Registry 2026

Od HA 2026.8 patří zařízení právě jedné config entry, od 2026.9 existují child
devices přes `via_device_id`.

**Opatření:** čteme `primary_config_entry` jako jednu hodnotu, nikdy jako
množinu. `via_device_id` se neslučuje.

---

## Žádné odkazy do Home Assistantu

Smarthome4u uživatele nikdy nepřesouvá do rozhraní Home Assistantu.

Jediný odkaz ven vede na **poskytovatele služby** při přihlášení přes jeho účet
(krok `external_step`). Otevírá se v nové záložce a s Home Assistantem nesouvisí.

---

## Postup při breaking change

1. Zjistit z Developer Blogu, co se změnilo.
2. Najít zasažené napojení v tabulce výše.
3. Zakázat **pouze** postiženou funkci, ne celou aplikaci.
4. Čtení stavů a ovládání nechat běžet, pokud fungují.
5. Upravit, doplnit test, zapsat do `CHANGELOG.md`.

CI instaluje skutečný Home Assistant a ověřuje, že se všechny moduly načtou.
Hassfest kontroluje manifest. Zelená kontrola tedy znamená, že napojení
existuje.
