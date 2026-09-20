# Kompatibilita s Home Assistant API

Povinná evidence. Každý Home Assistant command, který Smarthome4u používá, musí
být v této tabulce. Cíl: při breaking change v Home Assistantu okamžitě vědět,
co může být zasažené.

Všechny commandy se volají **výhradně** z `smarthome4u/app/ha/`. Žádný jiný modul
nesmí znát konkrétní HA API.

---

## Legenda typů

| Typ | Význam | Riziko |
|---|---|---|
| **veřejné** | Dokumentované v developers.home-assistant.io | Nízké, breaking change je ohlášený |
| **interní** | Používá HA frontend, není veřejná smlouva | Vysoké, může se změnit bez ohlášení |

---

## Čtení - WebSocket

| Command | Účel | Typ | Ověřeno od | Fallback |
|---|---|---|---|---|
| `auth` | Přihlášení Supervisor tokenem | veřejné | 2026.9 | žádný, bez toho aplikace neběží |
| `get_config` | HA verze, jednotky, časová zóna | veřejné | 2026.9 | version gate se přeskočí |
| `get_states` | Počáteční načtení všech stavů | veřejné | 2026.9 | žádný |
| `subscribe_events` (`state_changed`) | Realtime změny stavů | veřejné | 2026.9 | periodický `get_states` |
| `config/floor_registry/list` | Seznam pater | **interní** | 2026.9 | prázdný seznam, jede se bez pater |
| `config/area_registry/list` | Seznam místností | **interní** | 2026.9 | prázdný seznam, vše do "Nezařazeno" |
| `config/device_registry/list` | Seznam zařízení | **interní** | 2026.9 | entity se berou bez zařízení |
| `config/entity_registry/list` | Registr entit, persistentní ID | **interní** | 2026.9 | jen `get_states`, bez stabilní identity |
| `config_entries/get` | Názvy integrací pro detail zařízení | **interní** | 2026.9 | detail zařízení neukáže integraci |

Čtecí commandy označené jako interní procházejí přes `_send_optional`. Jejich
selhání zapíše varování do logu a aplikace pokračuje.

---

## Ovládání - WebSocket

| Command | Účel | Typ | Ověřeno od | Fallback |
|---|---|---|---|---|
| `call_service` | Všechny ovládací akce | veřejné | 2026.9 | odkaz do HA |

Frontend nesmí volat libovolnou službu. Povolené dvojice schopnost - akce jsou
v `app/capability.py` v tabulce `_ACTIONS` a hodnoty se ověřují na typ i rozsah.

---

## Zápisy do registrů - WebSocket

Všechno jsou **interní** commandy. Selhání se hlásí uživateli srozumitelnou
větou a nabídne se "Otevřít v Home Assistantu".

| Command | Účel | Ověřeno od |
|---|---|---|
| `config/area_registry/create` | Nová místnost | 2026.9 |
| `config/area_registry/update` | Přejmenování, přesun do patra | 2026.9 |
| `config/area_registry/delete` | Smazání místnosti | 2026.9 |
| `config/floor_registry/create` | Nové patro | 2026.9 |
| `config/floor_registry/update` | Přejmenování, podlaží | 2026.9 |
| `config/floor_registry/delete` | Smazání patra | 2026.9 |
| `config/device_registry/update` | Název a místnost zařízení | 2026.9 |
| `config/entity_registry/update` | Název a místnost entity | 2026.9 |

Smazání místnosti nemaže zařízení. Zařízení jen zůstanou nezařazená.

---

## Config API - REST přes Supervisor proxy

Základ je `http://supervisor/core/api`. Tyhle endpointy používá editor
automatizací a scén v Home Assistantu. **Nejsou součástí veřejné REST
dokumentace** a jsou nejrizikovější částí celé aplikace.

| Endpoint | Metoda | Účel | Fallback |
|---|---|---|---|
| `/config/automation/config/{id}` | POST | Uložení automatizace ze šablony | odkaz na editor v HA |
| `/config/automation/config/{id}` | DELETE | Smazání automatizace | odkaz na editor v HA |
| `/config/scene/config/{id}` | POST | Uložení scény ze stavu místnosti | odkaz na editor v HA |
| `/config/scene/config/{id}` | DELETE | Smazání scény | odkaz na editor v HA |
| `/config/config_entries/flow` | GET | Nalezená zařízení čekající na nastavení | prázdný seznam |

---

## Ingress hlavičky

| Hlavička | Účel | Typ |
|---|---|---|
| `X-Remote-User-Id` | HA user ID pro navázání Smarthome4u role | veřejné |
| `X-Remote-User-Name` | Přihlašovací jméno | veřejné |
| `X-Remote-User-Display-Name` | Zobrazované jméno | veřejné |

---

## Hluboké odkazy do Home Assistantu

Aplikace běží v iframe, proto všechny odkazy používají `target="_top"`.

| Cesta | Kam vede |
|---|---|
| `/config/integrations/dashboard` | Integrace a nalezená zařízení |
| `/config/integrations/dashboard/add?domain=...` | Přidání konkrétní integrace |
| `/config/devices/device/{id}` | Detail zařízení |
| `/config/automation/dashboard` | Editor automatizací |
| `/config/scene/dashboard` | Editor scén |
| `/config/areas/dashboard` | Patra a místnosti |
| `/history?entity_id=...` | Historie entity |

---

## Rizikové oblasti

### Interní registry commandy

Čtení i zápis registrů není veřejná smlouva. Používá je HA frontend a mohou se
změnit bez ohlášení v changelogu.

**Opatření:** volají se jen z `app/ha/client.py`, čtení má definovaný fallback,
zápis hlásí srozumitelnou chybu a nabízí fallback do HA.

### Config API pro automatizace a scény

Developerské Automation API je označené jako aktivně vyvíjené a není doporučené
pro integrace. Proto Smarthome4u **negeneruje automatizace volně** - jen ze
šesti pevných šablon, jejichž výstup je známý a testovatelný.

Editace existujících automatizací se nedělá vůbec. Ta vede do HA.

### Device Registry 2026

Od HA 2026.8 patří zařízení právě jedné config entry. Od 2026.9 existují child
devices přes `via_device_id`. V 2026.10 se zpřísnily deprecated properties.

**Opatření:** `_single_config_entry()` čte `primary_config_entry`, a jen pokud
chybí, sáhne na starý seznam a vezme první položku. Nikdy se nepovažuje za
množinu vlastníků. `via_device_id` se ukládá, ale neslučuje se podle něj.

---

## Postup při breaking change

1. Zjistit z Developer Blogu, co se změnilo.
2. Najít zasažený command v tabulce výše.
3. Zakázat **pouze** postiženou funkci, ne celou aplikaci.
4. Čtení stavů a ovládání nechat běžet, pokud fungují.
5. Upravit adaptér, doplnit test, aktualizovat sloupec "Ověřeno od".
6. Vydat opravu a zapsat do `CHANGELOG.md`.
