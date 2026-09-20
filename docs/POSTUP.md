# Postup prací

Tento soubor je zdroj pravdy o stavu projektu. Aktualizuje se po každé dokončené
části, aby se dalo navázat z jakéhokoliv počítače.

**Poslední aktualizace:** 20. 9. 2026
**Aktuální verze:** 0.1.0
**Aktuální fáze:** v0.1 spike

---

## Kde se to dělá

| Co | Kde |
|---|---|
| Repozitář | https://github.com/Paulee196/Smarthome4u-HA |
| Lokální složka | `C:\Users\Pavel\Desktop\Claude\Smarthome4u-HA` |
| Závazné zadání | `docs/ZADANI.md` |
| Pravidla pro vývoj | `CLAUDE.md` |

---

## Stav v0.1 spike

### Hotovo

- [x] Založen repozitář a struktura
- [x] `repository.yaml` - repozitář funguje jako Home Assistant App repository
- [x] Zjednodušené zadání `docs/ZADANI.md`
- [x] Pravidla pro vývoj `CLAUDE.md`
- [x] Licence, README, CHANGELOG

### Dělá se

- [ ] Manifest aplikace `smarthome4u/config.yaml`
- [ ] Dockerfile a spouštěcí skript
- [ ] AppArmor profil
- [ ] Home Assistant Adapter - WebSocket klient, přihlášení Supervisor tokenem
- [ ] Načtení registrů: floor, area, device, entity
- [ ] Načtení stavů a realtime subscription
- [ ] Normalizovaný interní model
- [ ] Capability Engine pro light, switch, sensor, binary_sensor
- [ ] Interní API pro frontend
- [ ] Jednoduchá stránka místností
- [ ] Ovládání světel a zásuvek

### Ověřit na reálném Home Assistantu

- [ ] Aplikace se nainstaluje z repozitáře
- [ ] Ingress funguje, aplikace je v postranním panelu
- [ ] Načtou se místnosti a zařízení
- [ ] Světlo ovládané ve Smarthome4u se změní i v HA
- [ ] Změna v HA se realtime projeví ve Smarthome4u
- [ ] Restart aplikace neovlivní HA automatizace
- [ ] Reconnect po restartu Home Assistantu funguje

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
| Blokový editor automatizací odložen | HA Automation API není stabilní smlouva |
| 3 šablony dashboardu místo 13 | Pokryjí většinu zákazníků, násobně méně údržby |

---

## Co se čeká na Pavlovi

- [ ] Ověřit kontaktní e-mail v `repository.yaml` (teď `info@smarthome4u.cz`)
- [ ] Dodat logo a ikonu pro aplikaci (`logo.png` 250×100, `icon.png` 128×128)
- [ ] Potvrdit, na jaké verzi Home Assistantu se bude testovat

---

## Další krok

Dokončit v0.1 spike a nainstalovat ho na testovací Home Assistant.
Teprve po úspěšném spike se staví design systém a další moduly.

Před designem je povinný audit webu smarthome4u.cz podle `docs/ZADANI.md` kap. 20.
Do té doby jsou barvy v `tokens.css` označené jako dočasné.
