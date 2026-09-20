# Smarthome4u

Nadstavba pro Home Assistant. To, co je One UI nad Androidem u Samsungu nebo
HyperOS u Xiaomi - stejný základ, jiné a jednodušší rozhraní.

Po přihlášení uživatel vidí Smarthome4u. Lišta Home Assistantu se schová.
Zařízení, místnosti, scény i automatizace se spravují přímo tady, bez
vyskakování do nastavení Home Assistantu.

**Home Assistant zůstává jediným zdrojem pravdy a výkonným jádrem.** Když
Smarthome4u vypnete, domácnost běží dál.

---

## Stav vývoje

| Verze | Stav | Obsah |
|---|---|---|
| v0.1 - v0.3 | hotovo | Základ, pět sekcí, ovládání, správa místností, scény, automatizace, vlastní průvodce integracemi |
| v0.4 | **vydáno** | Přechod z doplňku na integraci, schovaná lišta, přistání po přihlášení |
| v1.0 | plánováno | Editor automatizací, šablony dashboardu, technický režim, finální design |

Aktuální postup: [docs/POSTUP.md](docs/POSTUP.md)

---

## Co aplikace umí

- **Domů** - souhrn domu, upozornění, přepínač Podle místností / Podle funkcí
- **Místnosti** - ovládání po místnostech, správa místností a pater
- **Scény** - spuštění, uložení aktuálního stavu místnosti jako scény
- **Automatizace** - zapnutí, ruční spuštění, tvorba ze šesti šablon
- **Zařízení** - seznam, detail, přejmenování, přiřazení do místnosti
- **Integrace** - vlastní katalog, průvodce přidáním, odebrání

Ovládání podle typu zařízení: stmívání, teplota bílé, barva, poloha a natočení
žaluzií, termostat, zámek, rychlost ventilátoru, hlasitost.

---

## Instalace

Potřebujete **Home Assistant 2024.8 nebo novější**. Funguje na OS, Container,
Core i Supervised.

### Přes HACS

1. HACS → ⋮ → **Vlastní repozitáře**
2. Vložte `https://github.com/Paulee196/Smarthome4u-HA`, typ **Integrace**
3. Najděte **Smarthome4u** a dejte **Stáhnout**
4. Restartujte Home Assistant
5. **Nastavení → Zařízení a služby → Přidat integraci → Smarthome4u**

### Ručně

1. Stáhněte repozitář jako ZIP
2. Složku `custom_components/smarthome4u` zkopírujte do
   `config/custom_components/`
3. Restartujte Home Assistant
4. **Nastavení → Zařízení a služby → Přidat integraci → Smarthome4u**

### Nastavení

V **Možnostech** integrace jde vypnout schování lišty Home Assistantu i
automatické přistání po přihlášení. Ve výchozím stavu je obojí zapnuté.

---

## Dokumentace

| Dokument | Obsah |
|---|---|
| [docs/ZADANI.md](docs/ZADANI.md) | Závazné produktové a architektonické zadání |
| [docs/POSTUP.md](docs/POSTUP.md) | Co je hotové, co neověřené, co je další krok |
| [docs/HA_COMPATIBILITY.md](docs/HA_COMPATIBILITY.md) | Napojení na Home Assistant a jeho stabilita |
| [CHANGELOG.md](CHANGELOG.md) | Historie verzí |

---

## Struktura repozitáře

```
custom_components/smarthome4u/
  __init__.py       registrace panelu, statických souborů a API
  config_flow.py    přidání integrace a její možnosti
  api.py            interní API pro frontend
  home.py           pohled na domácnost z registrů Home Assistantu
  capability.py     co které zařízení umí a co se s ním smí dělat
  flows.py          překlad config flow do našeho formuláře
  templates.py      šablony automatizací
  config_files.py   zápis automatizací a scén
  frontend/         panel, ikony, styly, překlady
    panel.js        vlastní prvek registrovaný v Home Assistantu
    takeover.js     schování lišty a přistání po přihlášení
docs/               dokumentace a zadání
```

---

Copyright (c) 2026 Smarthome4u. Všechna práva vyhrazena. Viz [LICENSE](LICENSE).
