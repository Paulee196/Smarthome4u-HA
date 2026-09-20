# Postup prací

Tento soubor je zdroj pravdy o stavu projektu. Aktualizuje se po každé dokončené
části, aby se dalo navázat z jakéhokoliv počítače.

**Poslední aktualizace:** 20. 9. 2026
**Aktuální verze:** 0.1.0
**Aktuální fáze:** v0.1 spike - hotový kód, čeká na ověření na reálném HA

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

## Hotovo

### Repozitář a dokumentace

- [x] Struktura repozitáře, který je zároveň App repository i zdrojový kód
- [x] `repository.yaml` - Home Assistant pozná repozitář jako obchod
- [x] Zjednodušené zadání `docs/ZADANI.md` (z 83 kapitol na 29)
- [x] Pravidla pro vývoj `CLAUDE.md`
- [x] Evidence HA commandů `docs/HA_COMPATIBILITY.md`
- [x] Licence, README, CHANGELOG, dokumentace aplikace `smarthome4u/DOCS.md`

### Aplikace

- [x] Manifest `config.yaml` - Ingress zapnutý, žádný otevřený port,
      žádné privilegované oprávnění
- [x] Dockerfile, spouštěcí skript, AppArmor profil
- [x] Home Assistant Adapter (`app/ha/client.py`) - WebSocket klient,
      přihlášení Supervisor tokenem, automatický reconnect s narůstající prodlevou
- [x] Version gate (`app/ha/version.py`) - neznámá verze HA neblokuje čtení
      ani ovládání, jen označí zápisy jako neověřené
- [x] Načtení pater, místností, zařízení a entit
- [x] Selhání jednoho registru neshodí aplikaci, každý má fallback
- [x] Realtime subscription na `state_changed`
- [x] Capability Engine (`app/capability.py`) - light, switch, sensor,
      binary_sensor, rozhoduje podle domain a device_class
- [x] Normalizovaný model (`app/model.py`) - persistentní identita přes
      registry ID, entity_id jen jako měnitelný atribut
- [x] Entity bez záznamu v registru se neztratí
- [x] Diagnostické a konfigurační entity skryté běžnému uživateli
- [x] Interní API (`app/server.py`) - frontend nemluví přímo s HA
- [x] Allowlist akcí - frontend nemůže zavolat libovolnou HA službu
- [x] Realtime přenos do prohlížeče (`app/broadcast.py`) se slučováním do dávek
- [x] Frontend bez build kroku - dark-first, dotykové cíle 44 px,
      více sloupců podle místa, zvětšení pro nástěnný panel
- [x] Překlady oddělené od kódu (`app/web/i18n.js`), čeština ve vykání
- [x] Design tokeny na jednom místě, barvy označené jako dočasné

### Kontrola

- [x] GitHub Actions - syntaxe, načtení všech modulů, ruff, kontrola manifestu
- [x] Kontrola zakázaných oprávnění v manifestu je součástí CI
- [x] Poslední běh: zelený

---

## Neověřeno - čeká na reálný Home Assistant

Kód je napsaný a projde statickou kontrolou, ale **nikdy neběžel**.
Tohle se musí projít ručně po instalaci:

- [ ] Aplikace se nainstaluje z repozitáře a sestaví se
- [ ] Ingress funguje, aplikace je v postranním panelu
- [ ] Načtou se místnosti a zařízení
- [ ] Světlo ovládané ve Smarthome4u se okamžitě změní i v HA
- [ ] Změna v HA se realtime projeví ve Smarthome4u
- [ ] Fyzický vypínač na zdi se projeví v rozhraní
- [ ] Restart aplikace neovlivní HA automatizace
- [ ] Reconnect po restartu Home Assistantu funguje
- [ ] AppArmor profil aplikaci neblokuje
- [ ] Base image tagy v `build.yaml` existují

---

## Vědomě neuděláno v v0.1

Není to opomenutí, je to rozsah.

| Co chybí | Kdy |
|---|---|
| `icon.png` a `logo.png` aplikace | až dodá Pavel |
| SQLite datastore a migrace | v1.0, v0.1 nemá co ukládat |
| Technický režim a role | v1.0, chybí ověření admin práv |
| Žaluzie, termostaty, zámky, scény | v1.0 |
| Tři šablony dashboardu | v1.0, teď je jen seznam místností |
| Šablony automatizací | v1.0 |
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
| Python + aiohttp na backendu | Stejný stack jako HA Core, ověřené WebSocket chování |
| Čistý HTML/CSS/JS frontend | Žádný build krok, malý image, rychlé na levném tabletu |
| Žádný `image:` v config.yaml | Bez něj Supervisor staví lokálně z Dockerfile |
| Bez průvodce po instalaci | Dashboard se generuje sám z místností |
| WebSocket do prohlížeče | Polling by zatěžoval slabé nástěnné tablety |
| Blokový editor automatizací odložen | HA Automation API není stabilní smlouva |
| 3 šablony dashboardu místo 13 | Pokryjí většinu zákazníků, násobně méně údržby |

---

## Co se čeká na Pavlovi

- [ ] Nainstalovat aplikaci na testovací Home Assistant a projít seznam výše
- [ ] Ověřit kontaktní e-mail v `repository.yaml` (teď `info@smarthome4u.cz`)
- [ ] Dodat logo a ikonu (`logo.png` 250×100, `icon.png` 128×128)
- [ ] Sdělit verzi Home Assistantu, na které se testuje

---

## Další krok

Instalace na reálný Home Assistant a projití seznamu "Neověřeno" výše.

Teprve po úspěšném spike se staví design systém a další moduly. Před designem
je povinný audit webu smarthome4u.cz podle `docs/ZADANI.md` kap. 20.
