# Postup prací

Tento soubor je zdroj pravdy o stavu projektu. Aktualizuje se po každé dokončené
části, aby se dalo navázat z jakéhokoliv počítače.

**Poslední aktualizace:** 20. 9. 2026
**Aktuální verze:** 0.2.0
**Aktuální fáze:** v0.2 rozhraní - hotový kód, čeká na ověření na reálném HA

---

## Kde se to dělá

| Co | Kde |
|---|---|
| Repozitář | https://github.com/Paulee196/Smarthome4u-HA |
| Lokální složka | `C:\Users\Pavel\Desktop\Claude\Smarthome4u-HA` |
| Závazné zadání | `docs/ZADANI.md` |
| Pravidla pro vývoj | `CLAUDE.md` |
| Kompatibilita s HA | `docs/HA_COMPATIBILITY.md` |

---

## Důležité upřesnění zadání (20. 9. 2026)

Verze 0.1 uměla jen jinak zobrazit entity. To bylo špatné pochopení zadání.

**Jednoduchost znamená jednoduché ovládání, ne málo funkcí.** Smarthome4u musí
umět všechno, co uživatel od domu potřebuje. Rozdíl oproti Home Assistantu je
v tom, že se to dá udělat bez znalosti pojmů entita, integrace nebo YAML.

Závazný seznam je v `docs/ZADANI.md` kapitola 1.2. Nic z něj se nesmí vynechat.

---

## Hotovo

### Základ (v0.1)

- [x] Repozitář je zároveň App repository i zdrojový kód
- [x] Manifest bez otevřeného portu a bez privilegovaných oprávnění
- [x] Home Assistant Adapter s reconnectem a version gate
- [x] Načtení pater, místností, zařízení, entit a config entries
- [x] Realtime subscription a přenos změn do prohlížeče
- [x] Normalizovaný model s identitou přes registry ID
- [x] Kontrola v GitHub Actions - syntaxe, importy, ruff, manifest

### Rozhraní (v0.2)

- [x] Navigace s pěti sekcemi, spodní lišta na telefonu, levý panel od 900 px
- [x] Domů - souhrn domu, upozornění, zhasnutí všech světel, místnosti
- [x] Místnosti - ovládání po místnostech
- [x] Správa místností a pater: vytvořit, přejmenovat, přesunout, smazat
- [x] Zařízení - seznam po místnostech, detail, přejmenování, přiřazení
- [x] Přidání zařízení - nalezená zařízení a osm nejčastějších integrací
- [x] Scény a skripty - seznam, spuštění, mazání
- [x] Uložení aktuálního stavu místnosti jako scény
- [x] Automatizace - seznam, zapnutí, vypnutí, ruční spuštění, mazání
- [x] Šest šablon automatizací s průvodcem výběru zařízení
- [x] Nastavení aplikace
- [x] Ovládací panel: stmívání, teplota bílé, barva, poloha a natočení žaluzie,
      termostat, zámek, rychlost ventilátoru, hlasitost, číselné vstupy, výběry
- [x] Hluboké odkazy do HA přes `target="_top"` (aplikace běží v iframe)
- [x] Vlastní sada linkových ikon
- [x] Capability Engine na 20 doménách
- [x] Allowlist akcí s kontrolou typu a rozsahu hodnoty

---

## Neověřeno - čeká na reálný Home Assistant

Kód projde statickou kontrolou, ale funkce v0.2 nikdy neběžely.

- [ ] Navigace a přepínání sekcí
- [ ] Ovládací panel u světla, žaluzie, termostatu a zámku
- [ ] Vytvoření a přejmenování místnosti
- [ ] Přejmenování zařízení a přiřazení do místnosti
- [ ] Uložení scény ze stavu místnosti
- [ ] Vytvoření automatizace ze šablony
- [ ] Smazání automatizace a scény
- [ ] Hluboké odkazy do HA z iframe
- [ ] Nalezená zařízení v dialogu Přidat zařízení

### Nejpravděpodobnější místa problémů

1. **Config API pro automatizace a scény** - `POST /api/config/automation/config/{id}`
   není veřejně dokumentované. Pokud Supervisor token nemá dost práv, vrátí
   401 nebo 403 a vytváření automatizací nepůjde.
2. **Zápisy do registrů** - `config/area_registry/create` a spol. mohou mít
   jiný tvar parametrů.
3. **Odkazy z iframe** - `target="_top"` musí projít přes Ingress.

Všechna tři místa mají fallback a nemohou shodit aplikaci.

---

## Vědomě neuděláno

| Co chybí | Kdy |
|---|---|
| `icon.png` a `logo.png` aplikace | až dodá Pavel |
| Editor KDYŽ / POKUD / UDĚLEJ | v1.0 |
| Úprava existující automatizace | vede do HA, vlastní editor až v1.0 |
| Čtyři šablony dashboardu a oblíbené | v1.0 |
| SQLite datastore a migrace | v1.0 |
| Technický režim a role | v1.0, chybí ověření admin práv |
| Odebrání zařízení | vede do HA |
| Automatizované testy proti HA | v1.0 |
| Předpřipravené GHCR image | před v1.0 |
| Finální brand barvy | po auditu webu |

---

## Rozhodnutí, která už padla

| Rozhodnutí | Proč |
|---|---|
| Jeden repozitář místo dvou | Zákazník přidává jediný odkaz, méně údržby |
| Repozitář je veřejný | Supervisor ho klonuje bez přihlášení, jinak to nejde |
| Lokální build v HA místo GHCR | Do v1.0 odpadá CI, registry i podepisování |
| Python + aiohttp na backendu | Stejný stack jako HA Core |
| Čistý HTML/CSS/JS frontend | Žádný build krok, rychlé na levném tabletu |
| Bez průvodce po instalaci | Dashboard se generuje sám z místností |
| WebSocket do prohlížeče | Polling by zatěžoval slabé nástěnné tablety |
| Automatizace jen ze šablon | HA Automation API není stabilní smlouva |
| Úprava automatizace vede do HA | Nešlo by to udělat bezpečně a jednoduše zároveň |
| Odebrání zařízení vede do HA | Nevratná operace patří tam, kde je celý kontext |

---

## Co se čeká na Pavlovi

- [ ] Aktualizovat aplikaci v HA na 0.2.0 a projít seznam "Neověřeno"
- [ ] Poslat log ze záložky Log, pokud něco selže
- [ ] Ověřit kontaktní e-mail v `repository.yaml` (teď `info@smarthome4u.cz`)
- [ ] Dodat logo a ikonu (`logo.png` 250×100, `icon.png` 128×128)

---

## Další krok

Ověřit v0.2 na reálném Home Assistantu. Podle výsledku opravit config API
a zápisy do registrů.

Pak v1.0: editor KDYŽ / POKUD / UDĚLEJ, šablony dashboardu s oblíbenými,
technický režim, datastore a audit webu smarthome4u.cz pro finální barvy.
