# Historie verzí

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).

## [0.5.0]

### Opraveno

- Design tokeny byly deklarované jen na :root. Uvnitř stínového stromu, kde
  panel běží, :root neodpovídá ničemu - takže se nepoužila jediná barva ani
  rozměr a všechno padalo na výchozí hodnoty prohlížeče. Odtud ten vzhled.
  Tokeny jsou teď i na :host a .shell.

### Změněno

- Vzhled: tmavší a chladnější základ, tři úrovně ploch, čistší modrofialový
  accent. Aktivní položku navigace značí tenká lišta místo výplně.
- Dlaždice mají zaoblené podložky pod ikonou, která u zapnutého zařízení
  zežloutne. Zapnutý stav je jemný odstín, ne svítící plocha.
- Typografie: tabulkové číslice u hodnot, verzálková mikropísmena u popisků,
  sevřenější nadpisy, větší mezery mezi sekcemi.
- Mřížka dlaždic drží dva sloupce i na 360px telefonu.
- Přejezd myší je ve @media (hover: hover), aby na dotykovém panelu
  nezůstávaly zaseknuté stavy.

### Přidáno

- Role podle Loxone: jeden účet je správce a nastavuje, ostatní dům ovládají.
  Kontroluje to backend u každé zapisující operace.
- Správcem se stane první administrátor, který rozhraní otevře. Jde předat.
- Vlastní nastavení se ukládá přes úložiště Home Assistantu, je v záloze.
- Volba podoby dashboardu: Přehled, Místnosti, Funkce. Půdorys se připravuje.
- Ruční přeřazení entity. Home Assistant hlásí jako světlo i kontrolky
  a podle názvu to rozpoznávat nesmíme, takže to musí jít opravit ručně.
- Schování entity, která do rozhraní nepatří.

## [0.4.5]

### Opraveno

- Integrace se nespustila kvůli chybějícímu balíčku voluptuous-serialize.
  Považoval jsem ho za součást Home Assistantu, ale není. Teď je uvedený
  v manifestu jako požadavek, takže si ho Home Assistant doinstaluje sám.
- Balíček se navíc načítá až ve chvíli, kdy je potřeba. Kdyby přesto chyběl,
  průvodce přidáním integrace ukáže krok bez polí místo pádu celé integrace.

## [0.4.4]

### Opraveno

- Spuštění integrace selhávalo a v rozhraní se ukázalo jen "Nastavení se
  nezdařilo". Každý krok je teď v try/except a do logu píše přesný důvod.
- Registrace panelu se opakovaně nezhroutí. Kdyby po neúspěšném pokusu zůstal
  panel viset, nejdřív se odebere a pak zaregistruje znovu.
- Starší Home Assistant bez StaticPathConfig použije původní způsob
  servírování souborů.
- Opakovaná registrace cest a API už nevypne integraci. Při druhém spuštění
  v rámci jednoho běhu Home Assistantu je to očekávaný stav, ne chyba.

### Změněno

- Když se nepodaří schovat lištu Home Assistantu, rozhraní se už kvůli tomu
  nevypne. Jen se do logu zapíše varování.

### Přidáno

- Testy volají panel_custom doopravdy a odchytávají až poslední krok
  v Home Assistantu. Dřív mock zakrýval, že registrace panelu nefunguje.
- Test, že znovunačtení integrace nespadne

## [0.4.3]

### Opraveno

- README uváděl Home Assistant 2026.8, správně je 2024.8 stejně jako hacs.json
- Tabulka stavu vývoje ukazovala verzi 0.4 jako rozpracovanou

## [0.4.2]

První vydaná verze integrace. Verze 0.4.0 a 0.4.1 se nikdy nevydaly.

### Přidáno

- Označení verze tagem vytvoří vydání na GitHubu automaticky, takže HACS
  ukazuje skutečné číslo verze místo názvu větve
- Kontrola, že se číslo v tagu shoduje s manifestem, const.py i rozhraním

## [0.4.1]

### Opraveno

- Chyba "Invalid handler specified" při přidávání integrace. Home Assistant
  importuje __init__.py dřív než config_flow.py, takže pád importu shodil
  celou integraci ještě před tím, než se stihlo cokoliv zapsat do logu.
  Oba soubory teď nahoře importují jen jistoty a zbytek se načítá za běhu.
- Chybějící složka frontend se hlásí srozumitelně místo tichého pádu
- Každý krok spuštění se zapisuje do logu

### Změněno

- websocket_api odebráno ze závislostí, už se nepoužívá
- Minimální verze Home Assistantu snížena na 2024.8

### Přidáno

- Testy spouští skutečný Home Assistant: otevřou průvodce, přidají integraci,
  ověří registraci panelu, zavolají API a zkusí zakázanou akci
- Kontrola vypisuje skutečnou chybu místo pouhého návratového kódu

## [0.4.0]

Smarthome4u přestal být doplněk a stal se vlastní integrací. Tím se z něj
stala skutečná nadstavba - žádný iframe, žádná lišta Home Assistantu.

### Změněno

- Distribuce: z Home Assistant App na integraci v custom_components
- Panel se registruje přes panel_custom a běží ve stínovém stromu
- Registry, služby i config flow se čtou přes Python API Home Assistantu
  místo nedokumentovaných WebSocket commandů
- Realtime změny jdou přes spojení, které frontend Home Assistantu už má
- Automatizace a scény se zapisují do automations.yaml a scenes.yaml
  se standardním reloadem

### Přidáno

- Schování postranní lišty Home Assistantu, když běží Smarthome4u
- Přistání ve Smarthome4u hned po přihlášení
- Možnosti integrace pro vypnutí obojího
- Kontrola proti skutečnému Home Assistantu v CI včetně hassfest

### Odebráno

- Celá vrstva doplňku: Dockerfile, AppArmor profil, Ingress, Supervisor token
- Vlastní WebSocket klient a cache modelu - Home Assistant se ptá přímo

## [0.3.0]

Smarthome4u přestal být rozcestník. Uživatel se už nikdy nepřesune do
rozhraní Home Assistantu.

### Přidáno

- Vlastní sekce Integrace se seznamem připojených systémů
- Vlastní průvodce přidáním integrace - formuláře, nabídky, chyby i průběh
  se vykreslují ve Smarthome4u z dat Home Assistantu
- Vyhledávání v katalogu integrací, nejčastější nahoře
- Nalezená zařízení jdou dokončit přímo v aplikaci
- Odebrání integrace i s jejími zařízeními
- Popisky polí průvodce se berou z českých překladů Home Assistantu
- Záložky Zařízení / Integrace v sekci Zařízení

### Odebráno

- Všechna tlačítka "Otevřít v Home Assistantu"
- Odkaz na historii entity, na editor automatizací, scén a na nastavení HA
- Pomocná funkce haLink, aby se odkazy nemohly vrátit

## [0.2.1]

### Opraveno

- Prohlížeč si držel staré skripty, chyběla hlavička no-store
- Při selhání načtení dat se nevykreslila navigace
- Verze nebyla nikde vidět, teď je v hlavičce a hlídá ji CI

### Změněno

- Dlaždice v mřížce místo seznamu řádků
- 30 vlastních linkových ikon podle schopnosti a device_class
- Proužek úrovně pod dlaždicí
- Přepínač Podle místností / Podle funkcí
- Uvítací karta pro první spuštění

## [0.2.0]

Z prohlížečky se stalo rozhraní. Přibyla navigace a všechno, co uživatel
potřebuje, aby nemusel otevírat Home Assistant.

### Přidáno

- Navigace s pěti sekcemi: Domů, Místnosti, Scény, Automatizace, Zařízení
- Nastavení aplikace v hlavičce
- Domovská obrazovka se souhrnem domu, upozorněními a rychlou akcí
- Panel s plným ovládáním: stmívání, teplota bílé, barva, poloha žaluzie,
  natočení lamel, termostat, zámek, rychlost ventilátoru, hlasitost
- Správa místností a pater - vytvořit, přejmenovat, přesunout, smazat
- Seznam zařízení po místnostech, detail, přejmenování, přiřazení do místnosti
- Přidání zařízení - nalezená zařízení a nejčastější integrace
- Scény a skripty: seznam, spuštění, uložení stavu místnosti jako scény, mazání
- Automatizace: seznam, zapnutí a vypnutí, ruční spuštění, mazání
- Šest šablon automatizací s průvodcem výběru zařízení
- Hluboké odkazy "Otevřít v Home Assistantu" na přesnou obrazovku
- Vlastní sada linkových ikon

### Rozšířeno

- Capability Engine zná žaluzie, termostaty, zámky, ventilátory, scény,
  skripty, automatizace, tlačítka, číselné vstupy, výběry, média a přítomnost
- Adaptér umí zapisovat do registrů a pracovat s config API

## [0.1.0]

První technický spike. Prokázal architekturu.

### Přidáno

- Instalace jako Home Assistant App z tohoto repozitáře
- Přístup přes Ingress, bez druhého hesla a bez otevřeného portu
- Home Assistant Adapter - WebSocket klient přihlášený Supervisor tokenem
- Načtení pater, místností, zařízení a entit
- Realtime sledování změn stavů
- Capability Engine pro světla, zásuvky, senzory a binární senzory
- Jednoduchý přehled místností
- Ovládání světel a zásuvek
