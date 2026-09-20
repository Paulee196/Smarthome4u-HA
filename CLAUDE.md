# Smarthome4u - pravidla pro vývoj

Závazné zadání je `docs/ZADANI.md`. Při konfliktu s čímkoliv jiným vyhrává zadání.
Aktuální stav prací je `docs/POSTUP.md` - po každé dokončené části ho aktualizuj.

## Hlavní věta projektu

Smarthome4u není smart-home platforma. Je to uživatelské a instalační rozhraní
nad Home Assistantem. Home Assistant je jediný zdroj pravdy a výkonné jádro.

## Nepřekročitelná pravidla

1. **HA je zdroj pravdy.** Smarthome4u nedrží druhou kopii stavu domácnosti.
   Vlastní jen to, co HA nemá - layout, pozice ikon, oblíbené, vlastní šablony.
2. **Žádný zápis do `.storage`.** Nikdy, za žádných okolností.
3. **HA API výhradně přes `smarthome4u/app/ha/`.** Žádný jiný modul nesmí znát
   konkrétní HA commandy. Když se HA změní, mění se adaptér, ne celá aplikace.
4. **Supervisor token nikdy neopustí backend.** Frontend ho nesmí vidět.
5. **Typová logika podle `domain` / `device_class` / `supported_features`.**
   Nikdy podle názvu entity. "Dveře kuchyň" není informace o typu.
6. **Persistentní identita = registry ID.** `entity_id` se ukládá jen jako
   měnitelný atribut. Uživatel ho může kdykoliv přejmenovat.
7. **Každý nový HA command zapiš do `docs/HA_COMPATIBILITY.md`** - účel, zda je
   veřejný nebo interní, od které verze ověřený, jaký test ho kryje, fallback.
8. **Responzivita je součást hotové funkce**, ne závěrečné QA. Mobil, tablet,
   desktop a nástěnný panel.
9. **Žádné hardcoded texty.** Vše přes i18n, první jazyk čeština.
10. **Žádný odkaz ven z aplikace.** Uživatel nikdy neskončí v rozhraní
    Home Assistantu. Viz sekce níže.
11. **Žádné barvy mimo `app/web/tokens.css`.** Finální brand barvy se doplní
    až po auditu webu smarthome4u.cz. Do té doby jsou označené jako dočasné.

## Bezpečnost aplikace

Zakázáno bez prokazatelné potřeby: `full_access`, `privileged`, `docker_api`,
`host_network`, mapování HA config adresáře pro zápis. Protection mode zůstává
zapnutý. Backend validuje všechny vstupy. Do logu nikdy nejdou tokeny, hesla
ani API klíče.

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
3. Pokud se mění chování pro uživatele, aktualizuj `CHANGELOG.md` a verzi
   v `smarthome4u/config.yaml`.
4. Commit a push, ať je postup dostupný z jiného počítače.
