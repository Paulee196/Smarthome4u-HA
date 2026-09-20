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

Toto je nejdůležitější produktový požadavek a má přednost před bohatostí funkcí.

- Instalace jsou **dva kroky**: přidat repozitář, dát Instalovat.
- Po startu **není žádný průvodce ani nastavení**. Dashboard se vygeneruje sám.
- Uživatel nikdy nevytváří Long-Lived Access Token.
- Uživatel nikdy nevidí `entity_id`, pokud si nezapne pokročilé informace.
- Každá obrazovka, která by vyžadovala vysvětlení, patří do technického režimu
  nebo do fallbacku "Otevřít v Home Assistantu".

Když je na výběr mezi funkcí navíc a menším počtem kroků, vyhrává menší počet
kroků.

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

Pouze **Home Assistant OS**, architektury **amd64** a **aarch64**.

Typicky Home Assistant Green, Raspberry Pi 4/5 s HA OS, x86-64 mini PC s HA OS,
HA OS ve virtuálním stroji.

Oficiálně nepodporováno: Home Assistant Container, Core, Supervised, 32bit.

---

## 4. Distribuce

Smarthome4u se distribuuje jako **Home Assistant App** (dříve add-on) z tohoto
repozitáře. Repozitář je zároveň App repository i zdrojový kód, aby zákazník
přidával jediný odkaz.

Zákaznický postup:

1. Přidat repozitář přes My Home Assistant odkaz.
2. Instalovat Smarthome4u.
3. Zapnout v postranním panelu a spustit.

### 4.1 Build

Do verze 1.0 se aplikace sestavuje lokálně v Home Assistantu z Dockerfile.
Odpadá tím CI, registry i podepisování a lze testovat hned po pushi.

Před verzí 1.0 se přechází na předpřipravené multi-arch image v GHCR, protože
lokální build zdržuje instalaci u zákazníka. Do té doby se `image:` v
`config.yaml` nepoužívá.

### 4.2 Release kanál

Jeden kanál - Stable. Beta kanál se zavede, až budou existovat zákazníci, na
kterých nelze testovat.

---

## 5. Architektura

Aplikace má čtyři oddělené moduly.

### 5.1 Home Assistant Adapter (`app/ha/`)

**Jediný modul produktu, který smí znát konkrétní HA API a WebSocket commandy.**

Úkoly: přihlášení přes Supervisor token, čtení HA verze, čtení registrů
(floor / area / device / entity), čtení stavů, realtime subscription, volání
akcí, normalizace rozdílů mezi HA verzemi.

Když HA změní formát, mění se adaptér, ne třicet obrazovek.

### 5.2 Capability Engine (`app/capability.py`)

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

### 5.3 Backend (`app/`)

Interní API pro frontend, autorizace podle role, normalizovaný model, datastore,
diagnostika. Frontend nikdy nemluví přímo s Home Assistantem.

### 5.4 Frontend (`app/web/`)

UI, dashboardy, formuláře. Komunikuje výhradně s interním Smarthome4u API.

### 5.5 Datastore

SQLite v perzistentním `/data`, které je automaticky součástí HA zálohy.
Ukládá pouze Smarthome4u specifická data. Schema má číslo verze a migrace.

---

## 6. Komunikace s Home Assistantem

### 6.1 Pořadí preferencí

1. Dokumentované veřejné HA API.
2. Dokumentované WebSocket a REST mechanismy.
3. Interní frontend WebSocket command - pouze v adaptéru a pouze zapsaný
   v `HA_COMPATIBILITY.md`.
4. **Žádný přímý zápis do interních storage souborů.**

### 6.2 Realtime

Povinně WebSocket subscription na `state_changed`. Žádný periodický polling
celého stavu.

Změny, na které musí UI reagovat: světlo zapnuté fyzickým vypínačem, změna
teploty, změna entity v HA UI, přidání zařízení, změna místnosti, přejmenování.

### 6.3 Token

Aplikace používá `SUPERVISOR_TOKEN` z prostředí. Uživatel nikdy nevytváří
Long-Lived Access Token. Token existuje pouze v backendu.

---

## 7. Ingress a role

Přístup výhradně přes **Home Assistant Ingress**. Uživatel je už přihlášený přes
HA, žádné druhé heslo, žádný otevřený port, žádné vlastní HTTPS.

Identita se čte z Ingress hlaviček (`X-Remote-User-Id`, `X-Remote-User-Name`).

### Role

| Role | Vidí |
|---|---|
| **Uživatel** | Domov, místnosti, oblíbené, jednoduché automatizace, upozornění |
| **Technik** | Navíc zařízení, entity, integrace, diagnostiku, odkazy do HA |
| **Admin** | Navíc nastavení Smarthome4u, role, diagnostický balíček |

Role je navázaná na HA user ID. Skrytí tlačítka ve frontendu nestačí - backend
musí oprávnění ověřovat.

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

**v0.1:** `light`, `switch`, `sensor`, `binary_sensor`

**v1.0:** navíc `cover`, `climate`, `lock`, `fan`, `scene`, `script`,
`automation`, `media_player`, `button`, `input_boolean`

**Později:** `valve`, `humidifier`, `water_heater`, `vacuum`, `lawn_mower`,
`camera`, `alarm_control_panel`, `number`, `select`, `person`, `device_tracker`

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

## 11. Dashboard

Dashboard **není** konfigurace domácnosti. Odstranění karty nesmí odstranit
zařízení, entitu ani automatizaci.

### 11.1 Automatické generování

Dashboard se po instalaci vygeneruje sám z HA místností a rozpoznaných
schopností. Uživatel nemusí nic nastavovat, aby viděl funkční dům.

Ruční úpravy layoutu se ukládají do Smarthome4u datastore a mají přednost před
automatickým rozvržením.

### 11.2 Šablony

Jen tři, ostatní jsou odložené.

| Šablona | Pro koho |
|---|---|
| **Simple** | Stav domu, oblíbené, rychlé akce, upozornění |
| **Rooms** | Seznam místností a jejich souhrnných stavů |
| **Wall** | Nástěnný panel - velké cíle, čas, souhrn domu, scény |

Odložené: Functions, Mobile, Tablet, Energy, Security, Technical, Senior, Guest,
2D a 3D půdorys.

---

## 12. Automatizace

### 12.1 Vykonává je Home Assistant

Automatizace vytvořená Smarthome4u musí běžet v Home Assistantu. Smarthome4u
nesmí být výkonným jádrem domácnosti. Když se aplikace zastaví, automatizace
běží dál.

### 12.2 Rozsah

Knihovna hotových šablon a tlačítko **"Otevřít v Home Assistantu"**.

Vizuální blokový editor je **odložený**. Zadání 1.0 samo varuje, že HA Automation
API není stabilní smlouva - vlastní editor je nejrizikovější část projektu
a nejmenší přínos pro laika.

### 12.3 Šablony

Pohybové osvětlení, noční chodba, zhasnutí po nepřítomnosti, odchod z domu,
příchod domů, dobré ráno, dobrou noc, otevřené okno a vypnutí topení, únik vody,
nízká baterie, praní dokončeno, simulace přítomnosti.

Šablona generuje normální HA logiku. Před vytvořením se srozumitelně zobrazí,
co vznikne. Šablona nesmí předpokládat konkrétní `entity_id` - pracuje
s požadovanými schopnostmi a uživatel mapuje reálná zařízení.

### 12.4 Automatizace, které editor nerozumí

Označit jako **"Pokročilá - upravit v Home Assistantu"**. Nikdy ji destruktivně
nezjednodušovat.

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

Cíl je maximální rozumné HA App security score.

**Zakázáno bez prokazatelné potřeby:** `full_access`, `privileged`, `docker_api`,
`host_network`, mapování HA config adresáře pro zápis.

**Povinné:** protection mode zapnutý, vlastní AppArmor profil, backend validuje
všechny vstupy, Supervisor token pouze v backendu.

**Do logu nikdy nejdou** tokeny, hesla, OAuth secrets ani API klíče.
Diagnostický export secrets rediguje. Frontend neukládá privilegovaný token do
`localStorage`.

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
Zkusit znovu, tlačítko Otevřít v Home Assistantu a skrytý technický detail
s error ID pro log.

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

1. Ručně zapisovat do `.storage`.
2. Být hlavním výkonným jádrem domácnosti.
3. Držet druhý pravdivý stav zařízení.
4. Vyžadovat Long-Lived Token od běžného uživatele.
5. Mít Supervisor token ve frontendu.
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

---

## 25. Roadmapa

### v0.1 - spike

Prokázat architekturu, ne stavět produkt.

Aplikace se nainstaluje, běží přes Ingress, identifikuje přihlášeného HA
uživatele, připojí se k HA Core, načte verzi, načte floor / area / device /
entity registry, načte stavy, naváže realtime subscription, normalizuje data do
interního modelu, zobrazí jednoduchou stránku místností a ovládá světla a
zásuvky.

**Kritéria přijetí:**

- Světlo ovládané ve Smarthome4u se okamžitě změní i v HA.
- Změna v HA se realtime projeví ve Smarthome4u.
- Restart Smarthome4u neovlivní HA automatizace.
- Běžný uživatel nepotřebuje znát `entity_id`.
- Všechny použité HA commandy jsou v `HA_COMPATIBILITY.md`.

### v1.0 - použitelný produkt

Automaticky generovaný dashboard ve třech šablonách, klima, žaluzie, zámky,
senzory, scény, šablony automatizací, technický inspektor, role, design systém
podle auditu webu, kompletní čeština, SQLite datastore s migracemi, diagnostika,
předpřipravené GHCR image.

### Později

2D půdorys, blokový editor automatizací, Energy a Security šablony, KNX workflow,
ZHA diagnostika, branding partnerů, import/export šablon, audit log,
3D půdorys, samostatná PWA.

---

## 26. Definition of Done pro 1.0

- Instalace na amd64 i aarch64 je opakovatelná.
- Aktualizace nesmaže data.
- Záloha a obnova je otestovaná.
- Aplikace má odpovídající bezpečnostní profil.
- Klasické HA UI funguje souběžně.
- Výpadek Smarthome4u nevyřadí automatizace.
- Žádný přímý zápis do `.storage`.
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

- Home Assistant Apps: https://developers.home-assistant.io/docs/apps/
- Konfigurace: https://developers.home-assistant.io/docs/apps/configuration/
- Komunikace: https://developers.home-assistant.io/docs/apps/communication/
- Ingress: https://developers.home-assistant.io/docs/apps/presentation/
- Bezpečnost: https://developers.home-assistant.io/docs/apps/security/
- Repository: https://developers.home-assistant.io/docs/apps/repository/
- REST API: https://developers.home-assistant.io/docs/api/rest/
- WebSocket API: https://developers.home-assistant.io/docs/api/websocket/
- Device Registry: https://developers.home-assistant.io/docs/device_registry_index/
- Entity Registry: https://developers.home-assistant.io/docs/entity_registry_index/
- Area Registry: https://developers.home-assistant.io/docs/area_registry_index/

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
