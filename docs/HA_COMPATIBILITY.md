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

## WebSocket commandy

| Command | Účel | Typ | Ověřeno od | Test | Fallback |
|---|---|---|---|---|---|
| `auth` | Přihlášení Supervisor tokenem | veřejné | 2026.9 | připojení při startu | žádný, bez toho aplikace neběží |
| `get_config` | HA verze, jednotky, časová zóna | veřejné | 2026.9 | připojení při startu | version gate se přeskočí |
| `get_states` | Počáteční načtení všech stavů | veřejné | 2026.9 | načtení modelu | žádný |
| `subscribe_events` (`state_changed`) | Realtime změny stavů | veřejné | 2026.9 | realtime test | periodický `get_states` |
| `call_service` | Vykonání akce (zapnout světlo...) | veřejné | 2026.9 | ovládání světla | odkaz do HA |
| `config/floor_registry/list` | Seznam pater | **interní** | 2026.9 | načtení modelu | prázdný seznam, jede se bez pater |
| `config/area_registry/list` | Seznam místností | **interní** | 2026.9 | načtení modelu | prázdný seznam, vše do "Nezařazeno" |
| `config/device_registry/list` | Seznam zařízení | **interní** | 2026.9 | načtení modelu | entity se berou bez zařízení |
| `config/entity_registry/list` | Registr entit, persistentní ID | **interní** | 2026.9 | načtení modelu | jen `get_states`, bez stabilní identity |

---

## REST endpointy

Zatím žádné. Aplikace používá výhradně WebSocket.

---

## Ingress hlavičky

| Hlavička | Účel | Typ |
|---|---|---|
| `X-Remote-User-Id` | HA user ID pro navázání Smarthome4u role | veřejné |
| `X-Remote-User-Name` | Přihlašovací jméno | veřejné |
| `X-Remote-User-Display-Name` | Zobrazované jméno | veřejné |

---

## Rizikové oblasti

### Interní registry commandy

Čtyři `config/*_registry/list` commandy nejsou veřejná smlouva. Používá je HA
frontend a mohou se změnit bez ohlášení v changelogu.

**Opatření:**

- volají se jen z `app/ha/registries.py`,
- selhání jednoho registru nesmí shodit aplikaci,
- každý má definovaný fallback v tabulce výše,
- při neznámém formátu se zapíše varování do logu a pokračuje se.

### Device Registry 2026

Od HA 2026.8 patří zařízení právě jedné config entry. Od 2026.9 existují child
devices přes `via_device_id`. V 2026.10 se zpřísnily deprecated properties.

**Opatření:** model čte `config_entry_id` jako jednu hodnotu, nikoliv množinu.
`via_device_id` se ukládá, ale v v0.1 se nepoužívá pro slučování.

### Automation API

Vytváření a editace HA automatizací **se v v0.1 nepoužívá vůbec**. Developerské
API je označené jako aktivně vyvíjené a není doporučené pro integrace.

Až se přidá, bude to samostatná sekce této tabulky s vlastními testy CRUD.

---

## Postup při breaking change

1. Zjistit z Developer Blogu, co se změnilo.
2. Najít zasažený command v tabulce výše.
3. Zakázat **pouze** postiženou funkci, ne celou aplikaci.
4. Čtení stavů a ovládání nechat běžet, pokud fungují.
5. Upravit adaptér, doplnit test, aktualizovat sloupec "Ověřeno od".
6. Vydat opravu a zapsat do `CHANGELOG.md`.
