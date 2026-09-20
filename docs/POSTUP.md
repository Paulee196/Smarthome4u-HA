# Postup prací

Zdroj pravdy o stavu projektu. Aktualizuje se po každé dokončené části, aby se
dalo navázat z jakéhokoliv počítače.

**Poslední aktualizace:** 20. 9. 2026
**Aktuální verze:** 0.4.1
**Fáze:** v0.4 nadstavba - hotový kód, čeká na ověření na reálném HA

---

## Kde se to dělá

| Co | Kde |
|---|---|
| Repozitář | https://github.com/Paulee196/Smarthome4u-HA |
| Lokální složka | `C:\Users\Pavel\Desktop\Claude\Smarthome4u-HA` |
| Závazné zadání | `docs/ZADANI.md` |
| Pravidla pro vývoj | `CLAUDE.md` |
| Napojení na HA | `docs/HA_COMPATIBILITY.md` |

---

## Upřesnění zadání, která už padla

**1. Jednoduchost je o ovládání, ne o počtu funkcí** (kapitola 1.1)
Smarthome4u musí umět všechno, co uživatel od domu potřebuje. Závazný seznam
je v kapitole 1.2 a nic z něj se nesmí vynechat.

**2. Žádné předávání do Home Assistantu** (kapitola 1.3)
Nikdy žádné tlačítko "Otevřít v Home Assistantu". Průvodce přidáním integrace
se vykresluje u nás. Jediná výjimka je přihlášení u poskytovatele služby.

**3. Nadstavba, ne doplněk** (kapitola 1.4)
Jako One UI nad Androidem. Po přihlášení uživatel vidí Smarthome4u, lišta
Home Assistantu je schovaná. Kvůli tomu je Smarthome4u integrace, ne doplněk -
z iframu by to nešlo.

---

## Hotovo

### Rozhraní (v0.1 - v0.3)

- [x] Pět sekcí: Domů, Místnosti, Scény, Automatizace, Zařízení
- [x] Spodní lišta na telefonu, levý panel od 900 px
- [x] Dlaždice v mřížce, 30 vlastních ikon, proužek úrovně
- [x] Přepínač Podle místností / Podle funkcí
- [x] Ovládací panel: stmívání, teplota bílé, barva, žaluzie, termostat,
      zámek, ventilátor, hlasitost, číselné vstupy, výběry
- [x] Správa místností a pater
- [x] Zařízení: seznam, detail, přejmenování, přiřazení
- [x] Scény: spuštění, uložení stavu místnosti, mazání
- [x] Automatizace: zapnutí, ruční spuštění, mazání, šest šablon
- [x] Integrace: vlastní katalog, průvodce přidáním, odebrání
- [x] Uvítací karta pro první spuštění

### Nadstavba (v0.4)

- [x] Přechod z doplňku na integraci v `custom_components/smarthome4u`
- [x] Vlastní panel přes `panel_custom`, bez iframu
- [x] Panel běží ve stínovém stromu - styly se navzájem neovlivňují
- [x] `takeover.js` schová lištu Home Assistantu
- [x] Přistání ve Smarthome4u po přihlášení
- [x] Volby integrace pro vypnutí obojího
- [x] Registry, služby a config flow přes Python API místo WebSocketu
- [x] Realtime přes spojení, které frontend HA už má otevřené
- [x] Automatizace a scény do YAML se standardním reloadem
- [x] CI instaluje skutečný Home Assistant a ověřuje importy
- [x] Hassfest kontroluje manifest
- [x] Testy spouští skutečný Home Assistant: otevřou průvodce, přidají
      integraci, ověří registraci panelu, zavolají API a zkusí zakázanou akci
- [x] Kontrola vypisuje skutečnou chybu jako anotaci, ne jen návratový kód

---

## Vyřešené potíže

**Invalid handler specified (0.4.0)** - Home Assistant importuje `__init__.py`
dřív než `config_flow.py`. Když import spadne, uživatel vidí jen tuhle hlášku
bez vysvětlení a v logu nemusí být nic užitečného.

Opraveno v 0.4.1: oba soubory na začátku importují jen jistoty, zbytek se
načítá až za běhu v `async_setup_entry`. Chybějící složka `frontend/` se hlásí
srozumitelně místo pádu. Každý krok spuštění píše do logu.

Testy v CI od té doby tenhle scénář ověřují na skutečném Home Assistantu.

## Neověřeno - čeká na reálný Home Assistant

Kód projde hassfestem i importy proti skutečnému Home Assistantu, ale
v0.4 nikdy neběžela.

- [ ] Integrace se přidá a panel se objeví v nabídce
- [ ] Lišta Home Assistantu se schová
- [ ] Po přihlášení se otevře Smarthome4u
- [ ] Vypnutí voleb v Možnostech vrátí lištu zpět
- [ ] Načtení místností, zařízení a stavů
- [ ] Realtime - fyzický vypínač na zdi se projeví v rozhraní
- [ ] Ovládací panel u světla, žaluzie, termostatu a zámku
- [ ] Vytvoření a přejmenování místnosti
- [ ] Přejmenování zařízení a přiřazení do místnosti
- [ ] Katalog integrací se načte a jde v něm hledat
- [ ] Průvodce přidáním integrace projde celý (zkusit MQTT nebo Shelly)
- [ ] Uložení scény ze stavu místnosti
- [ ] Vytvoření automatizace ze šablony
- [ ] Odebrání integrace

### Nejpravděpodobnější místa problémů

1. **`takeover.js`** - sahá do stínového stromu Home Assistantu. Selektory se
   mohou lišit podle verze. Nejhorší následek: lišta zůstane vidět.
2. **Zápis do `automations.yaml`** - pokud `configuration.yaml` nemá
   `automation: !include automations.yaml`, automatizace se nenačtou.
3. **Katalog integrací** - `async_get_integrations` načítá stovky manifestů.
   Může to při prvním otevření chvíli trvat.

---

## Vědomě neuděláno

| Co chybí | Kdy |
|---|---|
| Editor KDYŽ / POKUD / UDĚLEJ | v1.0 |
| Úprava existující automatizace | v1.0 |
| Čtyři šablony dashboardu, oblíbené, pořadí | v1.0 |
| Vlastní datastore přes `Store` | v1.0 |
| Technický režim a role | v1.0 |
| Odebrání jednotlivého zařízení | v1.0, teď jen celá integrace |
| Logo a ikona | až dodá Pavel |
| Finální brand barvy | po auditu webu smarthome4u.cz |
| Testy ovládání a průvodce integracemi | v1.0, teď je pokryté spuštění a API |

---

## Rozhodnutí, která už padla

| Rozhodnutí | Proč |
|---|---|
| Integrace místo doplňku | Z iframu nejde schovat lišta ani přistát po přihlášení |
| Panel ve stínovém stromu | Styly HA a naše se nesmí ovlivňovat |
| Bez vlastní cache modelu | HA je zdroj pravdy, čte se živě při každém požadavku |
| Realtime přes spojení HA | Druhé spojení by bylo zbytečné |
| Čistý HTML/CSS/JS frontend | Žádný build krok, rychlé na levném tabletu |
| Automatizace jen ze šablon | HA Automation API není stabilní smlouva |
| Zápis do YAML, ne do .storage | Stejná cesta, jakou používá editor HA |
| Odebrání zařízení přes integraci | Nevratná operace patří tam, kde je celý kontext |

---

## Co se čeká na Pavlovi

- [ ] Nainstalovat v0.4 podle README a projít seznam "Neověřeno"
- [ ] Poslat screenshot a log, pokud něco selže
- [ ] Dodat logo a ikonu
- [ ] Rozhodnout, jestli chceme Smarthome4u zveřejnit v HACS

---

## Další krok

Ověřit v0.4 na reálném Home Assistantu.

Pak v1.0: editor automatizací KDYŽ / POKUD / UDĚLEJ, šablony dashboardu
s oblíbenými, technický režim a audit webu smarthome4u.cz pro finální barvy.
