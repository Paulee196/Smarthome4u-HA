# Postup prací

Zdroj pravdy o stavu projektu. Aktualizuje se po každé dokončené části, aby se
dalo navázat z jakéhokoliv počítače.

**Poslední aktualizace:** 24. 9. 2026
**Aktuální verze v kódu:** 0.12.3

## Oprava 0.12.3 – mezipaměť frontendu

- [x] Po instalaci 0.12.2 byl na serveru nový `version.js`, ale prohlížeč
  stále zobrazoval 0.12.0. Cesta ke skriptům a stylům teď obsahuje verzi,
  takže prohlížeč načte celý nový balík.
- [ ] V živém HA ověřit zobrazenou verzi 0.12.3 a kliknutí na levé záložky.

## Oprava 0.12.2 – levá navigace v kiosk režimu

- [x] V HA 2026.9.3 reprodukováno: záložky jsou vidět, ale klikání
  zachytává průhledná vrstva `.sidebar-shell` nad panelem.
- [x] Kiosk schová tento obal uvnitř stínového stromu `ha-drawer` a při
  vypnutí režimu vrátí původní rozvržení.
- [ ] Po instalaci 0.12.3 ověřit kliknutí myší a dotykem v živém HA.

## Oprava 0.12.1 – interakce editoru a osobní nastavení

- [x] V HA 2026.9.3 otevřena nainstalovaná 0.12.0 a prověřen kiosk režim.
- [x] Přesouvání dlaždic ověřeno v prohlížeči po opravě úchytů a výběru cíle.
- [x] Každý účet má výchozí plné zobrazení, osobní nastavení kiosku a vlastní
  přepnutí na základní ovládání.
- [x] Automatické seznamy scén, světel a upozornění lze upravit jako vlastní
  výběr; lze změnit i typ bloku.
- [ ] Po instalaci vydání 0.12.1 ověřit chování v živém HA pro další účet.

## Návrh 0.12.0 – čtyři upravitelné plochy

- [x] Ověřen vzhled nainstalované verze 0.11.0 v Home Assistantu 2026.9.3.
- [x] Chytrá domácnost, Domov, Půdorys a Přehled HA se přepínají na hlavní ploše.
- [x] Volba plochy a její rozvržení jsou osobní pro účet.
- [x] Editor jednotlivých vybraných entit a bodů plánku mění text, ikonu,
  barvu, entitu a velikost. Editor bloku mění text, ikonu, barvu a rozměry.
- [x] Větší dlaždice rozbalují dostupné ovládání; kamera využívá náhled z HA.
- [x] Vydanou verzi 0.12.0 otevřít v reálném HA a prověřit její rozhraní.
- [ ] Dopracovat individuální úpravy řádků stavu a dlaždic místností.
  Scény a další automatické seznamy lze od 0.12.1 převést na vlastní výběr.
**Fáze:** připravená oprava 0.12.1; po instalaci zbývá ověřit další účet

---

## Oprava 0.11.1

- [x] Osobní oblíbené, bloky, pořadí a body půdorysu se ukládají podle HA user ID.
- [x] Původní společná plocha zůstává výchozí, dokud si uživatel neuloží vlastní.
- [x] Správce přiděluje technickou roli; backend rozlišuje uživatele, technika a správce.
- [x] Běžný uživatel může měnit jen vlastní prezentaci, ne registry ani integrace.
- [x] V dokumentaci je vyjasněno, že Smarthome4u panel se do Lovelace nesynchronizuje.
- [x] Integrační testy v CI pro první commit opravy.
- [ ] Ověření na skutečné instalaci Home Assistantu.

Další krok: dokončit integrační ověření a potom postupně uzavírat ostatní
neověřené cesty ze seznamu níže. Export plochy do Lovelace (`lovelace_export`)
je samostatný budoucí úkol; nesmí zapisovat přímo do `.storage/lovelace*`.

---

## Kde se to dělá

| Co | Kde |
|---|---|
| Repozitář | https://github.com/Paulee196/Smarthome4u-HA |
| Lokální složka | `C:\Users\Pavel\Desktop\Claude\Smarthome4u-HA` |
| Závazné zadání | `docs/ZADANI.md` |
| Pravidla pro vývoj | `CLAUDE.md` |
| Napojení na HA | `docs/HA_COMPATIBILITY.md` |
| Aktuální kritická oprava | `docs/CLAUDE_DASHBOARD_FIX.md` |

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

### Vzhled a ovládání (v0.5 - v0.9)

- [x] Designové proměnné v `tokens.css`, deklarované i na `:host` a `.shell`
      (na samotném `:root` se ve stínovém stromu nechytnou)
- [x] Pět předvoleb plochy: Přehled, Místnosti, Funkce, Nástěnný panel, Půdorys
- [x] Přehled mluví větami o stavu domu, ne jen mřížkou entit
- [x] Nástěnný panel je kontextový - karta se ukáže, jen když je co ukázat
- [x] Půdorys s vlastním obrázkem a body, které se umísťují přetažením
- [x] Režim technika a režim uživatele, přepínač v horní liště
- [x] Role správce podle vzoru Loxone: nastavuje jeden účet, ostatní jen ovládají
- [x] Režim úprav: přetahování prstem i myší, změna velikosti dlaždic
- [x] Často používané - vlastní plocha správce, skládá se po jednotlivých místech
- [x] Výběr zařízení s vyhledáváním podle názvu i místnosti
- [x] Editor automatizací KDYŽ / A ZÁROVEŇ / PAK
- [x] Skládačka automatizací v blocích
- [x] Kiosk režim: skrytí obou lišt Home Assistantu a roztažení do celé šířky
- [x] Nastavení aplikace včetně stavu Home Assistantu - verze, paměť, úložiště
- [x] Vydání na GitHubu se tvoří samo z tagu, HACS podle něj nabídne aktualizaci

### Plocha z bloků a motivy (v0.10 - v0.11)

- [x] Plocha je mřížka bloků: přetažení, odebrání, přidání z nabídky deseti druhů
- [x] Sloupce 1-4 a šířka bloku, na telefonu vždy jeden sloupec
- [x] Přejmenování bloku klepnutím na název
- [x] Dlaždice ve třech velikostech, velká s ovládáním uvnitř
- [x] Nabídka nad dlaždicí: velikost, vyměnit, odebrat
- [x] Uložené rozvržení drží registry ID, přežije přejmenování entity
- [x] Tři motivy: tmavý, světlý, podle Home Assistanta; barvy z webu smarthome4u.cz
- [x] Technický režim v Nastavení / Účet, řízený účtem

---

## Vyřešené potíže

**Invalid handler specified (0.4.0)** - Home Assistant importuje `__init__.py`
dřív než `config_flow.py`. Když import spadne, uživatel vidí jen tuhle hlášku
bez vysvětlení a v logu nemusí být nic užitečného.

Opraveno v 0.4.1: oba soubory na začátku importují jen jistoty, zbytek se
načítá až za běhu v `async_setup_entry`. Chybějící složka `frontend/` se hlásí
srozumitelně místo pádu. Každý krok spuštění píše do logu.

Testy v CI od té doby tenhle scénář ověřují na skutečném Home Assistantu.

**Proměnné vzhledu se nechytly (0.5.0)** - byly deklarované jen na `:root`.
Ve stínovém stromu `:root` neodpovídá ničemu, takže každá barva i rozměr
spadly na výchozí hodnotu prohlížeče. Proto rozhraní vypadalo špatně, i když
styly existovaly. Opraveno deklarací na `:root, :host, .shell`.

**Chybějící modul voluptuous_serialize (0.4.5)** - nejde s Home Assistantem
automaticky. Doplněno do `requirements` v manifestu a do CI přibyla kontrola,
která hlásí každý nedeklarovaný cizí import.

**Přetahování nefungovalo (0.8.1)** - `document.elementFromPoint()` vrací
ve stínovém stromu jen hostitelský prvek, takže se nikdy nenašlo místo pod
prstem. Opraveno přes `getRootNode().elementFromPoint()`.

**Kiosk režim nechával pruh vlevo (0.8.2)** - lišta zmizela, ale panel se
do uvolněného místa neroztáhl. Hádání proměnných Home Assistantu nikam
nevedlo. Opraveno měřením: panel si zjistí `getBoundingClientRect().left`
a o tu hodnotu se posune záporným okrajem, šířku vezme z `window.innerWidth`.
Přeměří se po 100, 400 a 1200 ms a při změně velikosti okna.

**HACS ukazoval hash commitu (0.4.4)** - HACS čte čísla verzí z vydání, ne
z tagů. Přidán `release.yml`, který z tagu `v*` vytvoří vydání.

**Hláška o JSON místo chyby (0.9.3)** - když Home Assistant odpověděl
něčím jiným než našimi daty, spadlo to na `JSON.parse` a zákazník viděl
anglický výpis z prohlížeče. Odpověď se teď rozebírá opatrně a každý stav
má svoji českou větu. Vypršelý token se navíc obnoví a požadavek zopakuje,
po výpadku se aplikace vrací sama.

**Posuvník u navigace (0.9.4)** - postranní pruh měl `height: 100vh`,
ale panel nedrží celé okno. Pruh přetekl svou plochu a dostal vlastní
posuvník. Vypadalo to jako chyba kiosk režimu, byla to chyba ve vzhledu.
Opraveno přes `align-self: stretch` a `max-height`.

**Kiosk podruhé (0.9.4)** - měření a záporný okraj panel sice srovnaly,
ale tím trčel ven ze své plochy a hostitel kolem něj vykreslil vodorovný
posuvník. Teď je panel v kiosku `position: fixed; inset: 0`, takže na
rozvržení Home Assistantu nezáleží. Měření zůstalo jako pojistka pro
případ, že by předek vytvořil vlastní vztažný rámec.

**Odznak spojení (0.9.3)** - ukazoval „Připojeno / Bez spojení" a nikomu
neřekl, s čím se aplikace spojuje. Odstraněn. Aplikace běží v prohlížeči,
Home Assistant doma na krabičce, ven z domu nejde nic - odznak k tomu nic
nepřidal. Když něco nehraje, řekne se to větou.

## Ověřeno na reálném Home Assistantu

Pavel má nadstavbu nainstalovanou přes HACS a hlásí zpět. Potvrzené věci:

- [x] Integrace se přidá a panel se objeví v nabídce
- [x] Lišta Home Assistantu se schová
- [x] Po přihlášení se otevře Smarthome4u
- [ ] Vypnutí voleb v Možnostech vrátí lištu zpět
- [x] Načtení místností, zařízení a stavů
- [x] Realtime - fyzický vypínač na zdi se projeví v rozhraní
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

| Co chybí | Proč / kdy |
|---|---|
| Pomocníci typu `input_boolean`, `input_number`, `input_select` | Home Assistant je neumí založit přes průvodce, jen přes svoje rozhraní. Jediná věc ze zadání, která zatím nejde. |
| Úprava složité automatizace | Čte se, spouští a vypíná. Přepsat ji editorem by ji zjednodušilo a o něco přišla. |
| Volné propojování bloků drátem | Skládačka jde zatím shora dolů. Dráty jako v Node-RED až bude jasné, že jsou potřeba. |
| Odebrání jednotlivého zařízení | Jen celá integrace - nevratná operace patří tam, kde je celý kontext. |
| Logo a ikona | Čeká na Pavla. |
| Role user / technician / admin a rozdělení oprávnění | Zadání v docs/CLAUDE_DASHBOARD_FIX.md, body 5. Zatím jen správce a ostatní. |

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

- [ ] Projít pět předvoleb plochy a říct, která je pro zákazníky výchozí
- [ ] Vyzkoušet režim úprav - výměnu zařízení a pořadí dlaždic
- [ ] Dodat logo a ikonu
- [ ] Rozhodnout, jestli chceme Smarthome4u zveřejnit v HACS

---

## Další krok

Nejdřív opravit kritickou produktovou smlouvu v
`docs/CLAUDE_DASHBOARD_FIX.md`: stabilní reference místo `entity_id`, rozdělení
rolí uživatel/technik/admin a jasnou navaznost Smarthome4u dashboardu na Home
Assistant. Teprve potom doladit vzhled podle zpětné vazby a pak v1.0: audit
webu smarthome4u.cz pro finální barvy, logo a ikona.
