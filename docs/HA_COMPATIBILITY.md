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
| `area_registry.async_get_area` | Ověření značek místností na plánku (od 0.16.0) | veřejné |
| `helpers.device_registry.async_get` | Zařízení | veřejné |
| `helpers.entity_registry.async_get` | Registr entit, persistentní ID | veřejné |
| `helpers.floor_registry.async_get` | Patra | veřejné |
| `hass.states.async_all` / `get` | Aktuální stavy | veřejné |
| `hass.states.async_all("weather")`, `hass.config.location_name` | Místní počasí v hlavičce (od 0.19.6); když entita nebo atribut předpovědi chybí, zobrazí se jen dostupné údaje | veřejné; ověřeno na CI s HA 2026.8+ |
| `hass.services.async_call("weather", "get_forecasts", return_response=True)` | Denní předpověď načtená samostatně, aby nezdržovala hlavní model (od 0.19.6); při chybě zůstane aktuální počasí | veřejné; dokumentovaná akce HA |
| `hass.states.async_all` / `get` + `capability.resolve_action` | Nabídka a ověření cílů značek plánku, včetně scén, skriptů a pomocníků (od 0.17.0); chybějící cíl se ignoruje | veřejné |
| `hass.states.async_all` + registr entit | Samostatný živý seznam pomocníků (od 0.15.2) | veřejné |
| `hass.config_entries.async_entries` | Připojené integrace | veřejné |
| `er.async_entries_for_device` | Entity jednoho zařízení | veřejné |
| `device.primary_config_entry` | Vlastník zařízení (HA 2026.8+) | veřejné |
| `request["hass_user"].id` | Vlastnictví a přiřazení plochy účtu, kontrola role (HA 2026.8+) | veřejné |
| `hass.auth.async_get_user` | Ověření účtu při přidělení technické role (HA 2026.8+) | veřejné |

Model se nikde necachuje. Při každém požadavku se čte živý stav, takže nemůže
vzniknout rozpor mezi tím, co vidíme my, a tím, co má Home Assistant.

Historie úprav ploch používá veřejný `homeassistant.helpers.storage.Store`.
Od 0.19.0 je historie vedena podle ID dashboardu; od 0.19.1 může být
dashboard sdílený nebo vlastněný jedním účtem.
Od 0.19.2 zůstává starý půdorys v interním úložišti jako zdroj šablony,
ale není samostatnou položkou katalogu. Při otevření aplikace se přehled
vybere z existujících dashboardů účtu.
Od 0.19.3 smí sdílenou plochu upravit také účet ve výchozím plném režimu;
vlastní plochy dalších účtů zůstávají oddělené. Rozměry a velikost textu
se ukládají jen jako prezentační data do stejného `Store`.
Ukládá jen prezentaci, nejvýše 20 kroků na plochu; nepřidává další
HA WebSocket, službu ani zdroj stavu zařízení. Po uložení vyvolá
`hass.bus.async_fire` událost `smarthome4u_dashboard_changed` (veřejné API).
Panel ji přijímá přes stávající HA frontend `connection.subscribeEvents`
a mimo režim úprav obnoví právě otevřenou sdílenou plochu. Nová entita
ohlášená přes `state_changed` obnoví automatický přehled místností.

---

## Zápisy

Vše v `api.py`.

| Napojení | Účel | Typ |
|---|---|---|
| `ar.async_create` / `async_update` / `async_delete` | Místnosti | veřejné |
| `fr.async_create` / `async_update` / `async_delete` | Patra | veřejné |
| `dr.async_update_device` | Název a místnost zařízení | veřejné |
| `er.async_update_entity` | Název a místnost entity | veřejné |
| `hass.services.async_call` | Ovládací akce, `scene.reload` a `script.reload` po zápisu | veřejné |
| `hass.config_entries.async_remove` | Odebrání integrace | veřejné |

Smazání místnosti nemaže zařízení. Zůstanou nezařazená.

Frontend nesmí zavolat libovolnou službu. Povolené dvojice schopnost - akce jsou
v `capability.py` v tabulce `_ACTIONS` a hodnoty se ověřují na typ i rozsah.
Od 0.19.14 vychází nabídka přehrávače a žaluzie z HA atributu
`supported_features` (veřejné stavové atributy; ověřeno podle konstant HA
core a v CI proti aktuálně instalované verzi HA).
Média používají služby `media_play`, `media_pause`, `media_stop`,
`media_previous_track`, `media_next_track`, `turn_on` a `turn_off` přes
`hass.services.async_call`;
chybějící bit služby skryje. Při chybě služby zůstává zařízení ovladatelné
ostatními podporovanými akcemi a frontend ukáže chybovou zprávu.

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

Pro výběr půdorysu čteme `hass.config.media_dirs` (nastavené složky knihovny
Média) a `hass.config.path("www")` (lokální obrázky). Jde o konfigurační API
Home Assistanta; ověřeno v testovací instalaci HA používané v CI od verze
0.14.2. Pokud složka neexistuje, výběr ji přeskočí. Soubory se jen čtou;
vybraný obrázek se zkopíruje do vlastní složky Smarthome4u.

| Soubor | Účel | Reload |
|---|---|---|
| `automations.yaml` | Automatizace ze šablon | `automation.reload` |
| `scenes.yaml` | Scény ze stavu vybraných zařízení | `scene.reload` |
| `scripts.yaml` | Skripty vytvořené z povolených akcí | `script.reload` |

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
| `hass.themes.darkMode` | Jestli HA běží ve tmavém režimu; řídí motiv "auto" | **interní** |
| CSS proměnné motivu (`--primary-color`, `--card-background-color`, …) | Motiv "podle Home Assistanta" je přemapuje na naše tokeny | **interní** |

Proměnné motivu si Home Assistant nastavuje na kořeni stránky a do stínového
stromu se dědí. Když některá chybí, tokens.css sáhne po hodnotě tmavého
motivu. Když `hass.themes` chybí, motiv "auto" se řídí nastavením systému.
Ověřeno na HA 2026.9.

---

## Rizikové oblasti

### takeover.js

Schování lišty sahá do stínového stromu `home-assistant-main`, což je vnitřek
frontendu Home Assistantu. Ten se může kdykoliv změnit bez ohlášení.

V HA 2026.9.3 je levý panel uvnitř `ha-drawer` jako `.layout > .sidebar-shell`.
Jeho průhledná vrstva s `z-index: 6` překrývá levé menu Smarthome4u,
i když panel není vidět. Kiosk proto vkládá styl přímo do stínového stromu
`ha-drawer` a obal skryje. Starší `.mdc-drawer` zůstává jako fallback.
Oba selektory jsou **interní** a ověřené na HA 2026.9.3; při změně DOM
zůstane dostupné vypnutí kiosku v nastavení.

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
