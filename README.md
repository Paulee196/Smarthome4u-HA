# Smarthome4u

Jednoduché rozhraní pro Home Assistant. Instaluje se jako aplikace, po startu
se dashboard vytvoří sám z místností a zařízení. Žádné nastavování, žádný token.

**Smarthome4u není nová smart-home platforma.** Je to uživatelské a instalační
rozhraní nad standardním Home Assistantem. Home Assistant zůstává jediným
zdrojem pravdy a výkonným jádrem. Když Smarthome4u vypnete, domácnost běží dál.

---

## Stav vývoje

| Verze | Stav | Obsah |
|---|---|---|
| v0.1 | ve vývoji | Spike - instalace, Ingress, načtení místností a zařízení, ovládání světel a zásuvek |
| v1.0 | plánováno | Automatický dashboard, klima, žaluzie, senzory, šablony automatizací, technický režim |

Aktuální postup a další kroky: [docs/POSTUP.md](docs/POSTUP.md)

---

## Instalace

Podporováno je **Home Assistant OS** na architektuře amd64 nebo aarch64
(Home Assistant Green, Raspberry Pi 4/5, mini PC, virtuální stroj).

1. Přidejte repozitář do Home Assistantu:

   [![Přidat repozitář do Home Assistantu](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FPaulee196%2FSmarthome4u-HA)

   Ručně: **Nastavení → Doplňky → Obchod s doplňky → ⋮ → Repozitáře** a vložte
   `https://github.com/Paulee196/Smarthome4u-HA`

2. V obchodu najděte **Smarthome4u** a dejte **Instalovat**.

3. Zapněte **Zobrazit v postranním panelu** a dejte **Spustit**.

4. Otevřete Smarthome4u v levém menu.

První instalace trvá několik minut, protože se aplikace sestavuje přímo
v Home Assistantu. Další aktualizace jsou rychlejší.

---

## Dokumentace

| Dokument | Obsah |
|---|---|
| [docs/ZADANI.md](docs/ZADANI.md) | Závazné produktové a architektonické zadání |
| [docs/POSTUP.md](docs/POSTUP.md) | Co je hotové, co se dělá, co je další krok |
| [docs/HA_COMPATIBILITY.md](docs/HA_COMPATIBILITY.md) | Každý použitý Home Assistant command a jeho stabilita |
| [CHANGELOG.md](CHANGELOG.md) | Historie verzí |

---

## Struktura repozitáře

```
repository.yaml        definice App repository pro Home Assistant
smarthome4u/           samotná aplikace (Home Assistant App)
  config.yaml          manifest aplikace
  Dockerfile           sestavení
  app/                 Python backend
    ha/                Home Assistant Adapter - jediný modul znající HA API
    web/               frontend
docs/                  dokumentace a zadání
```

---

Copyright (c) 2026 Smarthome4u. Všechna práva vyhrazena. Viz [LICENSE](LICENSE).
