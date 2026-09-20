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
| `config_entries/get` | Seznam připojených integrací | **interní** | 2026.9 | detail zařízení neukáže integraci |
| `manifest/list` | Názvy a typy všech integrací | **interní** | 2026.9 | zobrazí se doména místo názvu |
| `frontend/get_translations` | České popisky polí v průvodci | **interní** | 2026.9 | zobrazí se strojové názvy polí |

Čtecí commandy označené jako interní procházejí přes `_send_optional`. Jejich
selhání zapíše varování do logu a aplikace pokračuje.

---

## Ovládání - WebSocket

| Command | Účel | Typ | Ověřeno od | Fallback |
|---|---|---|---|---|
| `call_service` | Všechny ovládací akce | veřejné | 2026.9 | hláška v aplikaci |

Frontend nesmí volat libovolnou službu. Povolené dvojice schopnost - akce jsou
v `app/capability.py` v tabulce `_ACTIONS` a hodnoty se ověřují na typ i rozsah.

---

## Zápisy do registrů - WebSocket

Všechno jsou **interní** commandy. Selhání se hlásí uživateli srozumitelnou
větou přímo v aplikaci.

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

Základ je `http://supervisor/core/api`. Tyhle endpointy používá frontend
Home Assistantu pro editory a pro přidávání integrací. **Nejsou součástí veřejné
REST dokumentace** a jsou nejrizikovější částí celé aplikace.

| Endpoint | Metoda | Účel |
|---|---|---|
| `/config/automation/config/{id}` | POST | Uložení automatizace ze šablony |
| `/config/automation/config/{id}` | DELETE | Smazání automatizace |
| `/config/scene/config/{id}` | POST | Uložení scény ze stavu místnosti |
| `/config/scene/config/{id}` | DELETE | Smazání scény |
| `/config/config_entries/flow` | GET | Nalezená zařízení čekající na nastavení |
| `/config/config_entries/flow_handlers` | GET | Integrace, které jdou přidat průvodcem |
| `/config/config_entries/flow` | POST | Zahájení přidání integrace |
| `/config/config_entries/flow/{id}` | GET | Aktuální krok průvodce |
| `/config/config_entries/flow/{id}` | POST | Odeslání vyplněného kroku |
| `/config/config_entries/flow/{id}` | DELETE | Zrušení průvodce |
| `/config/config_entries/entry/{id}` | DELETE | Odebrání integrace i s jejími zařízeními |

Selhání kteréhokoliv z nich skončí srozumitelnou hláškou v aplikaci. Nikdy se
uživatel neposílá do Home Assistantu.

---

## Ingress hlavičky

| Hlavička | Účel | Typ |
|---|---|---|
| `X-Remote-User-Id` | HA user ID pro navázání Smarthome4u role | veřejné |
| `X-Remote-User-Name` | Přihlašovací jméno | veřejné |
| `X-Remote-User-Display-Name` | Zobrazované jméno | veřejné |

---

## Žádné odkazy do Home Assistantu

Smarthome4u uživatele nikdy nepřesouvá do rozhraní Home Assistantu. Dřívější
odkazy s `target="_top"` byly odstraněny včetně pomocné funkce `haLink`, která
je vytvářela.

Jediný odkaz ven vede na **poskytovatele služby** při přihlášení přes jeho účet
(krok `external_step`). Otevírá se v nové záložce a s Home Assistantem nesouvisí.

---

## Rizikové oblasti

### Interní registry commandy

Čtení i zápis registrů není veřejná smlouva. Používá je HA frontend a mohou se
změnit bez ohlášení v changelogu.

**Opatření:** volají se jen z `app/ha/client.py`, čtení má definovaný fallback,
zápis hlásí srozumitelnou chybu přímo v aplikaci.

### Config Flow ve vlastním UI

Tvar `data_schema` není veřejná smlouva. Pole se serializují ze schématu, které
si každá integrace definuje sama, a novější integrace používají selektory.

**Opatření:** `app/integrations.py` umí text, heslo, číslo, přepínač, výběr
a vícenásobný výběr, ve starém i selektorovém tvaru. Pole, které nerozpozná, se
přeskočí a uživateli se řekne, že část nastavení nešla zobrazit. Neznámý typ
kroku aplikaci nikdy nezhroutí - skončí hláškou a nabídkou zrušení.

Podporované typy kroků: `form`, `menu`, `external_step`, `progress`,
`create_entry`, `abort`.

### Config API pro automatizace a scény

Developerské Automation API je označené jako aktivně vyvíjené a není doporučené
pro integrace. Proto Smarthome4u **negeneruje automatizace volně** - jen ze
šesti pevných šablon, jejichž výstup je známý a testovatelný.

Editace existující automatizace se zatím nedělá. Složitá automatizace se
zobrazuje jen ke čtení, se zapnutím, vypnutím a ručním spuštěním.

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
