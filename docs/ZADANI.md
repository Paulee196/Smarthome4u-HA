# Smarthome4u - zadání

**Verze:** 2.0 (zjednodušená)
**Datum:** 20. 9. 2026
**Nahrazuje:** Master zadání 1.0

Tento dokument je závazný. Vychází z Master zadání 1.0, ale je zúžený na to,
co je potřeba pro jednoduchý produkt s jednou instalací.

---

## 0. Hlavní věta

> Smarthome4u není platforma pro domácí automatizaci. Smarthome4u je uživatelské
> a instalační rozhraní pro Home Assistant. Home Assistant zůstává jediným
> zdrojem pravdy a výkonným jádrem.

Toto pravidlo má přednost před každým jiným požadavkem.

Smarthome4u nesmí vytvořit paralelní systém, který by vlastnil zařízení, jejich
stavy, místnosti, automatizace nebo logiku domácnosti. Když je Smarthome4u
vypnuté, poškozené nebo odinstalované, domácnost musí fungovat dál přes
Home Assistant.

---

## 1. Cíl produktu

Umožnit používat Home Assistant i úplným laikům, kteří nechtějí znát pojmy jako
entita, integrace, helper, blueprint nebo YAML.

Zároveň nabídnout technický režim pro instalační firmy.

Klasické Home Assistant UI zůstává vždy dostupné. Smarthome4u běží vedle něj nad
stejnou instalací.

### 1.1 Zásada jednoduchosti

Jednoduchost znamená **jednoduché ovládání, ne málo funkcí.**

Smarthome4u musí umět všechno, co uživatel od svého domu potřebuje - přidat
zařízení, nastavit ho, vytvořit automatizaci, scénu, upravit dashboard, spravovat
místnosti. Rozdíl oproti Home Assistantu není v rozsahu, ale v tom, že se to dá
udělat bez znalosti pojmů entita, integrace, helper nebo YAML.

- Instalace je pár kroků: přidat repozitář do HACS, Install, restart, přidat
  integraci. Pak už nikdy nic.
- Po startu **není žádný průvodce**. Dashboard se vygeneruje sám a hned funguje.
- Uživatel nikdy nevytváří Long-Lived Access Token.
- Uživatel nikdy nevidí `entity_id`, pokud si nezapne pokročilé informace.
- Každá funkce má cestu na maximálně tři klepnutí z domovské obrazovky.

Když je na výběr mezi funkcí navíc a menším počtem kroků k ní, vyhrává menší
počet kroků. **Nikdy se nevyhrává vynecháním funkce.**

### 1.2 Co musí jít udělat ze Smarthome4u

Tohle je minimální seznam. Bez něj to není rozhraní, ale prohlížečka.

| Oblast | Uživatel musí umět |
|---|---|
| Zařízení | Přidat nové, pojmenovat, přiřadit do místnosti, otevřít detail, odebrat |
| Místnosti | Vytvořit, přejmenovat, smazat, přiřadit do patra |
| Patra | Vytvořit, přejmenovat, smazat |
| Ovládání | Zapnout, vypnout, stmívat, nastavit barvu, polohu žaluzie, teplotu |
| Scény | Zobrazit, spustit, vytvořit z aktuálního stavu, upravit, smazat |
| Automatizace | Zobrazit, zapnout, vypnout, spustit ručně, vytvořit, upravit, smazat |
| Dashboard | Vybrat šablonu, změnit pořadí, skrýt prvek, přidat do oblíbených |
| Nastavení | Účet, jazyk, režim zobrazení, informace o systému |

### 1.3 Žádné předávání do Home Assistantu

**Smarthome4u nikdy nepřesune uživatele do rozhraní Home Assistantu.**
Žádné tlačítko "Otevřít v Home Assistantu", žádný odkaz do nastavení HA,
žádné vyskočení z aplikace.

Týká se to i přidávání integrací a zařízení. Průvodce config flow se vykresluje
ve Smarthome4u z dat, která Home Assistant posílá - formuláře, nabídky, chyby
i průběh.

Jediná povolená výjimka je odkaz na **poskytovatele služby** při přihlášení přes
jeho účet (například Google nebo Spotify). To není Home Assistant.

Když Smarthome4u nějaký krok neumí zobrazit, řekne to srozumitelně a nabídne
zrušení. Nikdy nepošle uživatele jinam.

### 1.4 Nadstavba, ne doplněk

Smarthome4u je nad Home Assistantem to, co je One UI nad Androidem u Samsungu
nebo HyperOS u Xiaomi. Uživatel vidí Smarthome4u, ne hostitele.

Z toho plyne:

- Po přihlášení uživatel přistane rovnou ve Smarthome4u.
- Postranní lišta a hlavička Home Assistantu se schovají.
- Home Assistant zůstává plně funkční pod povrchem a jde se k němu dostat,
  ale není to výchozí ani navrhovaná cesta.

---

## 2. Vlastnictví dat

### Home Assistant vlastní

Zařízení, entity, patra, místnosti, integrace, stavy, scény, skripty,
automatizace, helpery, historii, energetická data, uživatele a autentizaci,
Zigbee, Matter, KNX, MQTT, ESPHome a všechny ostatní integrace.

### Smarthome4u vlastní pouze to, co HA nemá

Zvolenou šablonu dashboardu, rozmístění karet, oblíbené prvky, uživatelské
zobrazení, Smarthome4u roli navázanou na HA user ID a cache, kterou lze kdykoliv
znovu sestavit z HA.

### Odinstalování bez vendor lock-inu

Po odstranění Smarthome4u zůstává zákazníkovi plně funkční Home Assistant se
všemi zařízeními, místnostmi a automatizacemi.

---

## 3. Podporované prostředí

Home Assistant **2026.8 a novější**, jakýkoliv způsob instalace - OS, Container,
Core i Supervised. Jako integrace nejsme vázaní na Supervisor.

Doporučeno: Home Assistant Green, Raspberry Pi 4/5, mini PC, virtuální stroj.

---

## 4. Distribuce

Smarthome4u je **vlastní integrace** v `custom_components/smarthome4u`.

Důvod je v kapitole 1.4. Doplněk běží v iframu uvnitř skořápky Home Assistantu
a z iframu nejde schovat postranní lištu ani se stát první obrazovkou po
přihlášení. Integrace běží přímo ve frontendu Home Assistantu, takže to umí.

Druhý důvod je stabilita. Integrace sahá na registry a config flow přes
dokumentované Python API Home Assistantu, ne přes nedokumentované WebSocket
commandy.

### 4.1 Instalace u zákazníka

**Přes HACS:** přidat repozitář jako vlastní, dát Install, restartovat
Home Assistant, přidat integraci v Nastavení.

**Ručně:** stáhnout ZIP, rozbalit složku `smarthome4u` do
`config/custom_components/`, restartovat, přidat integraci.

### 4.2 Release kanál

Jeden kanál - Stable. Beta se zavede, až budou existovat zákazníci, na kterých
nelze testovat.

---

## 5. Architektura

Aplikace má čtyři oddělené moduly.

### 5.1 Přístup k Home Assistantu (`home.py`, `api.py`)

Jako integrace čteme registry přímo přes pomocníky Home Assistantu -
`area_registry`, `device_registry`, `entity_registry`, `floor_registry`
a `hass.states`. Zápisy jdou přes jejich `async_update` a `async_create`.

Průvodce přidáním integrace běží přes `hass.config_entries.flow`.
Akce přes `hass.services.async_call`.

Žádné vlastní WebSocket spojení, žádné hádání interních commandů. Model se
nikde necachuje - Home Assistant je jediný zdroj pravdy a ptáme se ho při
každém požadavku.

### 5.2 Capability Engine (`capability.py`)

Převádí technický HA objekt na funkci srozumitelnou uživateli.

Rozhoduje **výhradně** podle `domain`, `device_class`, `state_class`,
`supported_features`, `entity_category` a metadat registru.

**Nikdy podle názvu entity.**

Příklady:

- `light` + brightness → světlo se stmíváním
- `light` + color_temp → světlo s teplotou bílé
- `cover` + position → roleta s pozicí
- `climate` → termostat
- `binary_sensor` + `device_class=door` → dveře
- `binary_sensor` + `device_class=moisture` → únik vody
- `sensor` + `device_class=temperature` → teplota

### 5.3 Backend (`api.py`, `home.py`, `flows.py`, `templates.py`)

Interní HTTP API pro frontend, allowlist povolených akcí, pohled na domácnost,
překlad config flow a šablony automatizací. Frontend nikdy nemluví přímo
s Home Assistantem.

### 5.4 Frontend (`frontend/`)

Vlastní panel registrovaný přes `panel_custom`. Běží ve stínovém stromu, takže
se styly Home Assistantu a naše navzájem neovlivňují. Komunikuje výhradně
s interním Smarthome4u API.

`takeover.js` je samostatný modul vkládaný do frontendu Home Assistantu. Schová
postranní lištu a po přihlášení otevře Smarthome4u. Sahá do cizího DOM, proto
je celý v try/catch a při nejistotě radši neudělá nic.

### 5.5 Datastore

Vlastní data (layout dashboardu, oblíbené) se ukládají přes `helpers.storage.Store`
do `.storage` Home Assistantu, což je standardní cesta pro integrace a je
automaticky součástí zálohy. Zápis provádí výhradně Store, nikdy ne ruční
sahání do souborů.

---

## 6. Komunikace s Home Assistantem

### 6.1 Pořadí preferencí

1. Pomocníci a registry Home Assistantu v Pythonu.
2. Dokumentované služby a config entries API.
3. Konfigurační soubory `automations.yaml` a `scenes.yaml` přes standardní
   reload, protože pro ně Home Assistant veřejné Python API nemá.
4. **Žádný zápis do `.storage` mimo vlastní `Store`.**

### 6.2 Realtime

Panel dostává změny z WebSocket připojení, které Home Assistant frontend už má
otevřené. Žádné druhé spojení, žádný polling.

Změněné entity si frontend doptá našeho API jednou dávkou.

### 6.3 Přihlášení

Uživatel je přihlášený přes Home Assistant. Panel předá svůj token našemu API,
které ho ověřuje standardním způsobem pro integrace. Žádný Long-Lived Access
Token, žádné druhé heslo.

---

## 7. Přístup a role

Smarthome4u je panel Home Assistantu. Uživatel je přihlášený přes Home Assistant,
žádné druhé heslo, žádný otevřený port, žádné vlastní HTTPS.

Panel dostává od Home Assistantu objekt `hass` a z něj token, kterým se naše
API autorizuje. Token nikde neukládáme.

### Role

| Role | Vidí |
|---|---|
| **Uživatel** | Domů, místnosti, oblíbené, scény, jednoduché automatizace |
| **Technik** | Navíc zařízení, entity, integrace, diagnostiku |
| **Admin** | Navíc nastavení Smarthome4u, role, diagnostický balíček |

Role vychází z toho, zda je uživatel v Home Assistantu administrátor. Skrytí
tlačítka ve frontendu nestačí - backend musí oprávnění ověřovat.

---

## 8. Mapování objektů

| Smarthome4u | Home Assistant |
|---|---|
| domácnost | HA instance |
| patro | Floor |
| místnost | Area |
| zařízení | Device |
| funkce zařízení | Entity / Action |
| automatizace | HA Automation |
| scéna | HA Scene |
| uživatel | HA User + Smarthome4u role |

Pokud má HA nativní reprezentaci, nestaví se druhá paralelní.

---

## 9. Registry - kritická pravidla

### 9.1 Device Registry (změny 2026)

- Běžné zařízení patří **právě jedné** config entry (od HA 2026.8).
- HA podporuje **child devices** (od HA 2026.9) přes `via_device_id`.
- Child device nemusí být samostatný fyzický hardware.
- Stejné fyzické zařízení dostupné z více integrací může existovat jako více
  HA device záznamů.

Smarthome4u **nesmí** slučovat zařízení podle názvu, výrobce nebo modelu.
Případné seskupení v UI je prezentační vrstva a nepřepisuje HA ownership.

### 9.2 Entity Registry - stabilita identity

`entity_id` **není** dlouhodobý identifikátor. Uživatel ho může změnit.

Persistentní vazby se ukládají přes registry ID. Aktuální `entity_id` je jen
měnitelný atribut.

Po přejmenování entity v HA se Smarthome4u nesmí rozbít ani vytvořit duplicitní
objekt - jen aktualizuje mapování.

### 9.3 Entity Category

Běžný uživatel vidí ovládací a relevantní senzorové entity.
Diagnostické a konfigurační entity patří do technického režimu.
Disabled a hidden entity se uživateli nezobrazují.

---

## 10. Rozsah Capability Engine

**Povinné:** `light`, `switch`, `cover`, `climate`, `lock`, `fan`, `sensor`,
`binary_sensor`, `scene`, `script`, `automation`, `button`, `input_boolean`,
`input_number`, `input_select`, `media_player`, `number`, `select`, `person`,
`device_tracker`

**Později:** `valve`, `humidifier`, `water_heater`, `vacuum`, `lawn_mower`,
`camera`, `alarm_control_panel`, `text`, `date`, `time`, `datetime`

Architektura nesmí rozšíření znemožnit. Každá doména je samostatný modul.

### 10.1 Device class mění UI

U stejné domény se ikona, slovní stav, priorita a případné bezpečnostní
upozornění mění podle `device_class`.

`binary_sensor` může být motion, occupancy, presence, door, window, garage_door,
moisture, smoke, gas, problem, safety, vibration, battery.

### 10.2 Neznámé entity se nesmí ztratit

Entita, jejíž doménu Smarthome4u nezná, se zobrazí v technickém režimu v sekci
**Ostatní** s odkazem do HA. Uživatelský dashboard ji může skrýt.

---

## 10.3 Navigace aplikace

Aplikace má pět stálých sekcí. Na telefonu spodní lišta, na tabletu a desktopu
levá navigace. Každá funkce ze seznamu 1.2 patří právě do jedné z nich.

| Sekce | Obsah |
|---|---|
| **Domů** | Vybraná šablona dashboardu, oblíbené, rychlé akce, upozornění |
| **Místnosti** | Místnosti a patra, ovládání po místnostech, správa místností |
| **Scény** | Seznam scén a skriptů, spuštění, vytvoření, úprava |
| **Automatizace** | Seznam, zapnutí a vypnutí, ruční spuštění, vytvoření, úprava |
| **Zařízení** | Seznam zařízení, detail, nastavení, přidání nového |

Nastavení aplikace je dostupné z hlavičky, ne jako šestá záložka.

Hlubší obrazovky se otevírají jako panel nebo dialog, ne jako nová stránka bez
cesty zpět. Tlačítko zpět v prohlížeči i systému musí fungovat.

---

## 11. Dashboard

Dashboard **není** konfigurace domácnosti. Odstranění karty nesmí odstranit
zařízení, entitu ani automatizaci.

### 11.1 Automatické generování

Dashboard se po instalaci vygeneruje sám z HA místností a rozpoznaných
schopností. Uživatel nemusí nic nastavovat, aby viděl funkční dům.

Ruční úpravy layoutu se ukládají do Smarthome4u datastore a mají přednost před
automatickým rozvržením.

### 11.2 Úpravy uživatelem

Dashboard musí jít upravit bez editoru s plátnem a bez drag & drop na telefonu.
Stačí:

- vybrat šablonu,
- označit prvek jako oblíbený,
- změnit pořadí místností a karet,
- skrýt prvek, který uživatel nechce vidět.

Odstranění karty nikdy nesmaže zařízení. Výchozí akce je vždy jen skrytí.

### 11.3 Šablony

| Šablona | Pro koho | Kdy |
|---|---|---|
| **Domů** | Souhrn domu, oblíbené, rychlé akce, upozornění | povinné |
| **Místnosti** | Seznam místností a jejich souhrnných stavů | povinné |
| **Funkce** | Osvětlení, klima, stínění, bezpečnost, média | povinné |
| **Nástěnný panel** | Velké cíle, čas, souhrn, scény | povinné |
| **Energie** | Energetický přehled nad HA daty | později |
| **2D půdorys** | Interaktivní plán bytu | později |
| **3D půdorys** | - | později |

---

## 12. Automatizace

### 12.1 Vykonává je Home Assistant

Automatizace vytvořená Smarthome4u musí běžet v Home Assistantu. Smarthome4u
nesmí být výkonným jádrem domácnosti. Když se aplikace zastaví, automatizace
běží dál.

### 12.2 Rozsah

Uživatel musí ze Smarthome4u umět:

- zobrazit seznam svých automatizací se srozumitelným popisem,
- zapnout a vypnout automatizaci,
- spustit ji ručně,
- vytvořit novou z šablony,
- vytvořit jednoduchou vlastní v modelu **KDYŽ / POKUD / UDĚLEJ**,
- smazat ji,
- u pokročilé, které editor nerozumí, ji alespoň zapnout, vypnout a spustit.

Jednoduchý editor KDYŽ / POKUD / UDĚLEJ je **povinný**. Vizuální blokový editor
pro větvení, čekání a smyčky je odložený. Do té doby se složitá automatizace
zobrazuje jen ke čtení, nikam se neodkazuje.

Protože HA Automation API není stabilní smlouva, veškeré vytváření a editace
automatizací je izolované v Home Assistant Adapteru, má vlastní testy a při
nekompatibilitě se zakáže jen ono - ne celá aplikace.

### 12.3 Šablony

Pohybové osvětlení, noční chodba, zhasnutí po nepřítomnosti, odchod z domu,
příchod domů, dobré ráno, dobrou noc, otevřené okno a vypnutí topení, únik vody,
nízká baterie, praní dokončeno, simulace přítomnosti.

Šablona generuje normální HA logiku. Před vytvořením se srozumitelně zobrazí,
co vznikne. Šablona nesmí předpokládat konkrétní `entity_id` - pracuje
s požadovanými schopnostmi a uživatel mapuje reálná zařízení.

### 12.4 Automatizace, které editor nerozumí

Označit jako **"Pokročilá"** a nabídnout jen zapnutí, vypnutí a ruční spuštění.
Nikdy ji destruktivně nezjednodušovat a nikdy kvůli ní neposílat uživatele pryč.

---

## 13. Responzivita

Responzivita je součástí hotové funkce, ne závěrečné kosmetiky.

### 13.1 Cílové třídy

Telefon, tablet, notebook, nástěnný panel. Komponenty reagují na dostupný prostor
svého kontejneru, ne na pevné breakpointy podle typu zařízení.

### 13.2 Povinné adaptace

- **Mobil:** jedna obsahová osa, ergonomická navigace pro palec
- **Tablet:** jeden až dva panely podle kontextu
- **Desktop:** master/detail, persistentní navigace
- **Nástěnný panel:** velké cíle, čitelnost ze vzdálenosti 1-3 metry

Desktop layout nesmí být jen zmenšený na telefon a mobilní layout nesmí být jen
roztažený na 4K.

### 13.3 Vstupní režimy

Dotyk, myš, touchpad, klávesnice. **Nikdy nespoléhat na hover** jako jediný
způsob zobrazení důležité akce. Dotykové cíle minimálně 44×44 CSS px, u
nástěnného panelu více.

### 13.4 Testovací matice

Povinné viewporty: 360×800 telefon, 1024×768 tablet, 1366×768 notebook,
1920×1080 nástěnný panel. Plus zoom 150 %.

### 13.5 Hotovo neznamená

Funkce není hotová, pokud funguje jen na desktopu, vyžaduje horizontální scroll
celé stránky, zásadní akce existuje jen na hoveru, dialog opouští viewport,
změna orientace ztratí rozpracovaná data nebo je dotykový cíl příliš malý.

---

## 14. Přístupnost

Ovládací cíle 44 px a větší, klávesová navigace na desktopu, viditelné focus
stavy, smysluplné ARIA labely, dostatečný kontrast, respektovat
`prefers-reduced-motion`. Barva nesmí být jediným nositelem stavu. Text se nesmí
rozpadnout při zvětšení.

---

## 15. Bezpečnost

**Povinné:** backend validuje všechny vstupy. Frontend nesmí zavolat libovolnou
službu - povolené dvojice schopnost a akce jsou v `capability.py` a hodnoty se
ověřují na typ i rozsah.

Každý pohled v `api.py` vyžaduje přihlášení Home Assistantu.

**Do logu nikdy nejdou** tokeny, hesla, OAuth secrets ani API klíče.
Diagnostický export secrets rediguje. Frontend neukládá token do `localStorage`.

`takeover.js` běží v cizím DOM. Nikdy nesmí shodit Home Assistant - všechno
je v try/catch a při jakékoliv nejistotě modul neudělá nic.

---

## 16. Záloha a obnova

Data se ukládají do perzistentního `/data`, které je automaticky součástí HA
zálohy.

Testovaný scénář: vytvořit dashboard → provést HA zálohu → obnovit na čisté
HA OS → Smarthome4u obnoví UI konfiguraci a naváže na HA objekty.

Při chybějící entitě po obnově zobrazit **"vazba chybí"**. Nikdy nevytvářet
náhodnou náhradu.

---

## 17. Kompatibilita s verzemi HA

Home Assistant se mění každý měsíc. Interní frontend API není stabilní navždy.

### 17.1 Podporovaná matice

Aktuální stable HA a předchozí stable měsíční vydání.

### 17.2 Version gate

Při startu zjistit HA verzi a ověřit rozsah. U neznámé novější verze
**neblokovat vše** - čtení stavů a ovládání pokračuje, rizikové zápisové operace
se označí jako neověřené.

### 17.3 Detekce schopností

Runtime feature detection má přednost před větvením podle čísla verze.

### 17.4 Incident režim

Pokud HA release rozbije interní API: zakázat pouze postiženou funkci, nechat
čtení a ovládání běžet, upozornit admina, vydat opravu. Nikdy nevytvářet
poškozenou konfiguraci.

---

## 18. Výkon

Cílová instalace není jen malý byt. Testovat na 50 zařízení / 300 entit,
200 zařízení / 1 500 entit a 500 zařízení jako zátěžový test.

Virtualizovat dlouhé seznamy, lazy-load těžkých modulů, neanimovat prvky mimo
viewport, respektovat `prefers-reduced-motion`, žádné N+1 dotazy.

Dashboard musí být použitelný i na levném Android nástěnném tabletu.

---

## 19. Lokalizace

i18n od prvního commitu. První jazyk čeština, připravená angličtina.
Texty nesmí být hardcoded v komponentách. Rozpoznávání schopností nesmí záviset
na přeloženém názvu.

Uživatelské texty česky, ve vykání, krátké věty.

---

## 20. Vizuální identita

### 20.1 Povinný audit před finálním designem

UI musí navazovat na **https://www.smarthome4u.cz**.

**Nevymýšlet finální brand barvy ani font naslepo.** Před implementací design
systému se z produkčního webu vyčtou skutečné computed CSS hodnoty a assety a
vytvoří se jediný soubor design tokenů.

Ověřit: primární brand barvu, accent, pozadí, surface, barvy textu, font family
a weights, border radius, styl stínů, styl tlačítek, varianty loga.

### 20.2 Předběžný směr

Do doby auditu platí jako dočasné: dark-first, velmi tmavá základna, bílé
primární texty, šedé sekundární, modrofialový accent, čisté karty, minimum
dekorací, vysoká čitelnost. Žádné přehnané gradienty ani glassmorphism.

### 20.3 Sémantické barvy

Brand accent se nepoužívá na všechno. Samostatné tokeny pro success, warning,
error, info, offline, disabled. Jejich význam se nemění podle šablony dashboardu.

---

## 21. Chybové stavy

Uživatel nikdy nevidí raw stack trace.

Chybová zpráva obsahuje: co se nepovedlo, zda domácnost dál funguje, tlačítko
Zkusit znovu a skrytý technický detail s error ID pro log. Nikdy odkaz pryč
z aplikace.

Při nekompatibilitě HA API zablokovat pouze postiženou funkci, ne celý dashboard.

---

## 22. Start a sesouhlasení

Startovní sekvence: načíst vlastní DB → ověřit schema a migrace → zjistit HA
spojení a verzi → načíst registry → vytvořit normalizovaný model → navázat
realtime subscription → sesouhlasit uložené reference → označit chybějící →
zpřístupnit UI.

Pokud HA Core ještě neběží, opakovat s narůstající prodlevou. Nikdy nespadnout
do crash loopu.

Smarthome4u musí zvládnout změny provedené mimo něj: přejmenování entity,
přesun zařízení, přidání integrace, smazání zařízení, obnovu zálohy.

---

## 23. Mazání

Mazání má úrovně, které se nesmí zaměňovat:

1. odstranit z dashboardu (výchozí akce z UI),
2. odebrat z místnosti,
3. deaktivovat,
4. skutečně odstranit zařízení nebo integraci.

Skutečné smazání HA zařízení je pouze v technickém nebo admin kontextu,
s potvrzením.

---

## 24. Co Smarthome4u NESMÍ

1. Ručně zapisovat do `.storage` mimo vlastní `Store`.
2. Být hlavním výkonným jádrem domácnosti.
3. Držet druhý pravdivý stav zařízení.
4. Vyžadovat Long-Lived Token od běžného uživatele.
5. Ukládat přihlašovací token do localStorage nebo ho posílat dál.
6. Používat název entity pro typovou logiku.
7. Používat `entity_id` jako persistentní identitu.
8. Předpokládat, že každý Device je fyzický hardware.
9. Předpokládat starý multi-config-entry device model.
10. Kopírovat UI Apple, Google, Tuya nebo Loxone 1:1.
11. Blokovat domácnost při vlastní chybě.
12. Přidávat zbytečná privilegovaná oprávnění.
13. Genericky hádat neznámé kroky Config Flow.
14. Automaticky mazat HA objekty kvůli změně dashboardu.
15. Záviset na HACS.
16. Přesunout uživatele do rozhraní Home Assistantu.
17. Nechat viditelnou postranní lištu Home Assistantu, když aplikace běží.

---

## 25. Roadmapa

### v0.1 az v0.3 - hotovo

Základ, rozhraní s pěti sekcemi, plné ovládání, správa místností, scény,
automatizace ze šablon a vlastní průvodce přidáním integrace.

### v0.4 - nadstavba

Přechod z doplňku na vlastní integraci. Vlastní panel bez iframu, schovaná
postranní lišta Home Assistantu, přistání ve Smarthome4u po přihlášení,
přímý přístup k registrům a config flow místo nedokumentovaných commandů.

**Kritéria přijetí:**

- Po přihlášení uživatel vidí Smarthome4u, ne dashboard Home Assistantu.
- Postranní lišta Home Assistantu není vidět.
- Uživatel projde celý seznam 1.2, aniž by opustil Smarthome4u.
- Vypnutí integrace vrátí Home Assistant do původního stavu.

### v1.0 - produkt pro zákazníky

Editor KDYŽ / POKUD / UDĚLEJ, čtyři šablony dashboardu s oblíbenými a pořadím,
technický režim a role, vlastní datastore, design systém podle auditu webu,
kompletní čeština, diagnostika, otestovaná záloha a obnova.

### Později

2D půdorys, blokový editor automatizací, Energie a Bezpečnost jako šablony,
KNX workflow, ZHA diagnostika, branding partnerů, import a export šablon,
audit log, 3D půdorys.

---

## 26. Definition of Done pro 1.0

- Instalace přes HACS i ručně je opakovatelná.
- Aktualizace nesmaže data.
- Záloha a obnova je otestovaná.
- Vypnutí integrace vrátí Home Assistant do původního stavu.
- Klasické HA UI funguje souběžně.
- Výpadek Smarthome4u nevyřadí automatizace ani nerozbije Home Assistant.
- Žádný zápis do `.storage` mimo vlastní `Store`.
- Realtime synchronizace funguje oběma směry.
- Model zvládá registry model 2026.
- Design odpovídá ověřené identitě webu.
- Mobil, tablet, desktop a nástěnný panel jsou otestované.
- Čeština je kompletní.
- Diagnostika dokáže technikovi vysvětlit chybu.
- Nepodporované scénáře mají fallback do HA.

---

## 27. Reference

Používat aktuální dokumentaci, ne staré návody z fór.

- Integrace: https://developers.home-assistant.io/docs/creating_component_index/
- Config Flow: https://developers.home-assistant.io/docs/config_entries_config_flow_handler/
- Device Registry: https://developers.home-assistant.io/docs/device_registry_index/
- Entity Registry: https://developers.home-assistant.io/docs/entity_registry_index/
- Area Registry: https://developers.home-assistant.io/docs/area_registry_index/
- Vlastní panely: https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/
- HTTP pohledy: https://developers.home-assistant.io/docs/api/native-app-integration/
- Data Entry Flow: https://developers.home-assistant.io/docs/data_entry_flow_index/

Průběžně sledovat Home Assistant Developer Blog, hlavně breaking changes.

---

## 28. Známé HA změny k datu zadání

- Zařízení omezená na jednu config entry od HA 2026.8.
- Child devices od HA 2026.9.
- Související změny Device Registry WebSocket API.
- Zpřísnění deprecated device registry properties v 2026.10.
- Deprecation Configuratoru - nový kód na něm nesmí záviset.
- Terminologie "App" místo "add-on" v aktuální dokumentaci.

Před každým vydáním zkontrolovat Developer Blog od posledního podporovaného
HA release.

---

## 29. Finální architektonická zásada

Když stojíš před rozhodnutím:

**A)** implementovat část funkce sám ve Smarthome4u, nebo
**B)** využít existující Home Assistant objekt a postavit nad ním lepší UX,

vyber téměř vždy **B**.

Vývojový čas patří do UX, instalace, vizualizace, mapování schopností, šablon,
diagnostiky a stability integrační vrstvy. Ne do znovupostavení toho, co
Home Assistant už umí.
