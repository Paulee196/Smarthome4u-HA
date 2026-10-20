# Panalume: architektonické srovnání a převzaté principy

Prověřeno 19. 10. 2026 na commitu
[`f3926a1`](https://github.com/leacho73/panalume/tree/f3926a144451bc9461467c23d514be481e5b0070).
Panalume je inspirace pro způsob editace, nikoli závislost Smarthome4u.

**Licence:** V kořeni ani podsložkách Panalume není soubor LICENSE/COPYING/NOTICE,
GitHub API u repozitáře vrací `license: null` a `/license` vrací 404.
Licence balíčků v `package-lock.json` se týkají jejich závislostí, nikoli
vlastního zdrojového kódu Panalume. Do Smarthome4u se proto nepřebírá žádný
zdrojový kód, styl ani asset Panalume. Níže popsané postupy jsou vlastní
implementace obecně známých principů rozhraní.

| Oblast | Panalume | Smarthome4u a rozhodnutí |
|---|---|---|
| Rozložení | [`Stage.svelte`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/components/Stage.svelte) drží volné souřadnice a rozměry, vodítka, magnety a skupiny. | Od 0.19.4 mají bloky volné souřadnice, osm úchytů, mřížku po 10 px a přichycení k sousedním hranám. Automatický posun sousedů ještě chybí. Staré sestavy se načtou bez změny dat. |
| Editor | [`Editor.svelte`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/components/Editor.svelte) má plátno a postranní formulář. | Konfigurační panel vedle plátna nyní nabízí Přidat/Karta/Rozložení/Plochy/Motiv a sekce Obsah/Vzhled/Akce/Velikost. Na menší obrazovce je panel pod plochou. |
| Responzivita | [`reflow.js`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/lib/reflow.js) přestavuje tabletový návrh pro mobil, další zařízení mohou mít vlastní layout. | Obsah karet je společný, ale tablet, telefon a počítač mohou mít vlastní pozice. Telefon bez úprav používá jeden sloupec. |
| Karty | [`registry.js`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/lib/registry.js) načítá komponenty a metadata ze souborů karet. | Stávající registr `BLOKY` je rozšířen o pole editoru. Nový typ se přidává do stejného registru, vykresluje se nad modelem HA a potřebná data zůstávají v `home.py`. |
| Konfigurace a historie | [`config.svelte.js`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/lib/config.svelte.js) autosavuje JSON a drží klientské undo. | Stávající per-user `Store` HA ukládá pouze prezentaci. Historie posledních 20 změn na dashboard a účet je trvalá, obsahuje Zpět/Znovu a zahrnuje rozložení značek půdorysu. Duplicitní blok lze vytvořit v editoru. |
| HA integrace | [`ha.svelte.js`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/lib/ha.svelte.js) otevírá vlastní WebSocket a odebírá entity a šablony; [`live.js`](https://github.com/leacho73/panalume/blob/f3926a144451bc9461467c23d514be481e5b0070/panalume/app/src/lib/live.js) propojuje více obrazovek. | Smarthome4u používá HA frontend pro události, vlastní autentizované Python API pro data a povolené akce v `capability.py`. Změna plochy se oznamuje na existující HA sběrnici událostí a další obrazovky téhož účtu se obnoví. Nevzniká druhé spojení ani druhý správce zařízení. |
| Zobrazení | Panalume nabízí kiosk, pop-up a libovolné HA šablony. | Zůstává osobní kiosk režim, stávající detaily zařízení a uživatelsky vytvořené dashboardy. Volné Jinja/JSON služby v kartách se nepřidávají: obcházely by validaci schopností a zhoršily ovladatelnost pro začátečníky. |

## Technické hranice

- Volné pozice jsou volitelné. Pouhé otevření starého dashboardu jej nepřepíše;
  souřadnice se uloží až po úpravě. Obsah zařízení, místností a akcí dál řídí HA.
- Půdorys už používá volné umístění tam, kde souřadnice odpovídají skutečné
  poloze v domě. Jeho editor a akce značek zůstávají zachované.
- Historie obsahuje jen nastavení prezentace, nikoli kopii stavů zařízení.
  Zařízení, scény, skripty, místnosti a automatizace dál vlastní Home Assistant.
- Úložiště HA je součástí běžné zálohy instalace. Historie obrázků plánku se
  nezachovává, protože starší nahrané soubory aplikace uklízí; Zpět/Znovu
  pokrývá rozmístění značek a bloky detailů.
- Více obrazovek téhož účtu obnoví otevřenou plochu po oznámení změny
  přes existující HA připojení. Editor se během místních úprav nepřekreslí.
  Samostatný synchronizační server ani libovolné HA šablony nejsou součástí integrace.
