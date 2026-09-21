# Smarthome4u - pravidla pro vývoj

Závazné zadání je `docs/ZADANI.md`. Při konfliktu s čímkoliv jiným vyhrává zadání.
Aktuální stav prací je `docs/POSTUP.md` - po každé dokončené části ho aktualizuj.

## Hlavní věta projektu

Smarthome4u není smart-home platforma. Je to uživatelské a instalační rozhraní
nad Home Assistantem. Home Assistant je jediný zdroj pravdy a výkonné jádro.

## Nepřekročitelná pravidla

1. **HA je zdroj pravdy.** Smarthome4u nedrží druhou kopii stavu domácnosti.
   Vlastní jen to, co HA nemá - layout, pozice ikon, oblíbené, vlastní šablony.
2. **Žádný zápis do `.storage` mimo vlastní `Store`.** Nikdy ručně do souborů.
3. **Přístup k Home Assistantu jen přes `home.py` a `api.py`.** Registry, stavy,
   služby a config flow přes dokumentované Python API, ne přes vlastní
   WebSocket spojení.
4. **Token z panelu se nikam neukládá.** Ani do localStorage, ani do logu.
5. **Typová logika podle `domain` / `device_class` / `supported_features`.**
   Nikdy podle názvu entity. "Dveře kuchyň" není informace o typu.
6. **Persistentní identita = registry ID.** `entity_id` se ukládá jen jako
   měnitelný atribut. Uživatel ho může kdykoliv přejmenovat.
7. **Každé nové napojení na HA zapiš do `docs/HA_COMPATIBILITY.md`** - účel,
   zda je veřejné nebo interní, od které verze ověřené, fallback.
8. **Responzivita je součást hotové funkce**, ne závěrečné QA. Mobil, tablet,
   desktop a nástěnný panel.
9. **Žádné hardcoded texty.** Vše přes i18n, první jazyk čeština.
10. **Žádný odkaz ven z aplikace.** Uživatel nikdy neskončí v rozhraní
    Home Assistantu. Viz sekce níže.
11. **Žádné barvy mimo `frontend/tokens.css`.** Brand barvy jsou z auditu
    webu smarthome4u.cz (21. 9. 2026): tyrkysová `#09e1c0`, fialová
    `#7272ff`, text `#353740`. Každá barva existuje ve třech motivech:
    tmavém, světlém a "podle Home Assistanta". Nová barva = tři hodnoty.

## Bezpečnost aplikace

Backend validuje všechny vstupy. Frontend nesmí zavolat libovolnou službu -
povolené akce jsou v `capability.py`. Do logu nikdy nejdou tokeny, hesla ani
API klíče.

`takeover.js` běží v cizím DOM Home Assistantu. Nikdy ho nesmí rozbít - vše
v try/catch, při nejistotě neudělat nic.

## Nikdy neposílej uživatele do Home Assistantu

Smarthome4u je nadstavba, ne rozcestník. Žádné tlačítko "Otevřít v Home
Assistantu", žádný odkaz do nastavení HA, žádné vyskočení z aplikace ani
z iframe přes target=_top.

Config flow pro přidání integrace se vykresluje ve Smarthome4u z dat, která
Home Assistant posílá. Když nějaký krok neumíme zobrazit, řekneme to
srozumitelně a nabídneme zrušení.

Jediná výjimka je odkaz na poskytovatele služby při přihlášení přes jeho účet.
To není Home Assistant.

Automatizaci, které editor nerozumí, nikdy destruktivně nezjednodušuj - nabídni
u ní jen zapnutí, vypnutí a ruční spuštění.

## Rozhodovací pravidlo

Když stojíš před volbou "napsat to sám" nebo "použít existující HA objekt a
udělat nad ním lepší UX", vyber druhé. Vývojový čas patří do UX, instalace,
vizualizace, mapování schopností, šablon a diagnostiky.

## Jazyk

Veškeré texty pro uživatele jsou česky, ve vykání. Krátké věty, akční kroky.
Kód, názvy proměnných a technické komentáře anglicky nebo česky bez diakritiky
podle okolí souboru.

## Po každé změně

1. Aktualizuj `docs/POSTUP.md`.
2. Pokud přibyl HA command, aktualizuj `docs/HA_COMPATIBILITY.md`.
3. Pokud se mění chování pro uživatele, aktualizuj `CHANGELOG.md` a verzi na
   všech třech místech: `manifest.json`, `const.py`, `frontend/version.js`.
4. Commit a push, ať je postup dostupný z jiného počítače.
5. Počkej, až je kontrola zelená. Teprve pak hlas hotovo.
6. Označ verzi tagem `vX.Y.Z` a pošli ho. Vydání na GitHubu se vytvoří samo
   a HACS podle něj nabídne aktualizaci.

Bez tagu zákazník aktualizaci nedostane. HACS čte čísla verzí z vydání, ne
z tagů ani z manifestu.
