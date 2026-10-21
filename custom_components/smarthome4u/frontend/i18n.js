/* Překlady.
 *
 * Žádný text nesmí být napsaný přímo v komponentě. Rozpoznávání typu
 * zařízení NIKDY nezávisí na překladu - backend posílá jen strojové klíče.
 *
 * Čeština ve vykání. Krátké věty, akční kroky.
 */

/* Výčet, který se dá přečíst z dálky. Deset jmen za sebou už nikdo nečte
   a na nástěnném panelu z toho je odstavec přes půl obrazovky. */
const MAX_JMEN = 3;

function vyjmenovat(jmena) {
  const seznam = jmena || [];
  if (seznam.length <= MAX_JMEN) return seznam.join(", ") + ".";

  const zbytek = seznam.length - MAX_JMEN;
  return `${seznam.slice(0, MAX_JMEN).join(", ")} a dalších ${zbytek}.`;
}

export const t = {
  appName: "Smarthome4u",

  nav: {
    home: "Domů",
    rooms: "Místnosti",
    scenes: "Scény a automatizace",
    automations: "Automatizace",
    devices: "Zařízení",
    settings: "Nastavení",
  },

  weather: {
    title: "Počasí",
    forecast: "Předpověď",
    conditions: {
      "clear-night": "Jasná noc", cloudy: "Zataženo", fog: "Mlha",
      hail: "Kroupy", lightning: "Bouřka", "lightning-rainy": "Bouřky s deštěm",
      partlycloudy: "Polojasno", pouring: "Silný déšť", rainy: "Déšť",
      snowy: "Sněžení", "snowy-rainy": "Déšť se sněhem", sunny: "Slunečno",
      windy: "Větrno", "windy-variant": "Větrno", exceptional: "Výstraha",
    },
  },

  mode: {
    toTechnician: "Režim technika",
    toUser: "Režim uživatele",
  },

  status: {
    // Stav domu se píše větou. Číslo bez kontextu nikomu nic neřekne.
    allLightsOff: "Nikde nesvítí.",
    lightsOn: (pocet, jmena) =>
      pocet === 1
        ? `Svítí ${jmena[0]}.`
        : `Svítí ${pocet === 2 || pocet === 3 || pocet === 4 ? pocet + " světla" : pocet + " světel"}. ${vyjmenovat(jmena)}`,
    allLocked: "Vše je zamčené.",
    unlocked: (pocet, jmena) =>
      pocet === 1
        ? `Odemčeno: ${jmena[0]}`
        : `Odemčeno na ${pocet} místech. ${vyjmenovat(jmena)}`,
    allClosed: "Vše je zavřené.",
    open: (pocet, jmena) =>
      pocet === 1
        ? `Otevřeno: ${jmena[0]}`
        : `Otevřeno je ${pocet} věcí. ${vyjmenovat(jmena)}`,
  },

  error: {
    network:
      "Home Assistant neodpovídá. Nejspíš se restartuje po aktualizaci. " +
      "Počkejte chvíli a načtěte stránku znovu.",
    session:
      "Přihlášení vypršelo. Načtěte stránku znovu, Home Assistant vás " +
      "přihlásí sám.",
    forbidden: "Tohle smí měnit jen účet správce.",
    missing:
      "Tuhle část aplikace váš Home Assistant nezná. Aktualizujte " +
      "Smarthome4u v HACS a restartujte Home Assistant.",
    server:
      "Home Assistant narazil na chybu. Podrobnosti jsou v jeho protokolu " +
      "v Nastavení / Systém / Protokoly.",
    badResponse:
      "Odpověď z Home Assistantu nedává smysl. Bývá to proxy nebo " +
      "přihlašovací stránka mezi prohlížečem a domem.",
    generic: "Něco se nepovedlo.",
    view:
      "Tuhle část se nepodařilo vykreslit. Zbytek aplikace funguje dál - " +
      "vlevo se dá přepnout jinam.",
    retry: "Zkusit znovu",
  },

  notice: {
    connecting: "Načítám vaši domácnost z Home Assistantu. Chvíli to potrvá.",
    offline:
      "Home Assistant teď není dostupný. Vaše domácnost funguje dál, jen ji " +
      "odsud nejde ovládat. Zkouším se připojit znovu.",
    saved: "Uloženo.",
  },

  action: {
    save: "Uložit",
    cancel: "Zrušit",
    delete: "Smazat",
    rename: "Přejmenovat",
    add: "Přidat",
    create: "Vytvořit",
    close: "Zavřít",
    back: "Zpět",
    run: "Spustit",
    activate: "Spustit",
    confirmDelete: "Opravdu smazat?",
  },

  home: {
    title: "Domů",
    lightsOn: "Svítí",
    devices: "Zařízení",
    rooms: "Místnosti",
    alerts: "Vyžaduje pozornost",
    allLightsOff: "Zhasnout všechna světla",
    quickActions: "Rychlé akce",
    favorites: "Často používané",
    noFavorites:
      "Zatím tu nic není. V ovládání zařízení klepněte na hvězdičku " +
      "a objeví se tady.",
    turnedOff: (pocet) =>
      pocet === 1 ? `Zhasnuto 1 světlo.` : `Zhasnuto ${pocet} světel.`,
  },

  functions: {
    byRooms: "Podle místností",
    byFunctions: "Podle funkcí",
    lighting: "Osvětlení",
    shading: "Stínění",
    comfort: "Klima",
    security: "Bezpečnost",
    sockets: "Zásuvky",
    media: "Média",
  },

  intro: {
    title: "Vítejte ve Smarthome4u",
    text:
      "Tady ovládáte celý dům. Dole najdete místnosti, scény, automatizace " +
      "a zařízení.",
    step1: "Zařízení → Integrace, když chcete připojit nová zařízení.",
    step2: "Místnosti → Spravovat, když chcete uklidit, co kde je.",
    step3: "Automatizace → Nová, když má dům něco dělat sám.",
    dismiss: "Rozumím",
  },

  rooms: {
    title: "Místnosti",
    manage: "Spravovat místnosti",
    unassigned: "Nezařazeno",
    empty: "Zatím nemáte žádné místnosti.",
    addRoom: "Nová místnost",
    addFloor: "Nové patro",
    roomName: "Název místnosti",
    floorName: "Název patra",
    floor: "Patro",
    noFloor: "Bez patra",
    level: "Podlaží",
    deviceCount: "zařízení",
    openRoom: "Otevřít místnost",
    lightsOn: (pocet) => (pocet === 1 ? `Svítí 1 světlo` : `Svítí ${pocet}`),
    nothingOn: "Nikde nesvítí",
    deviceTotal: (pocet) =>
      pocet === 1 ? `1 zařízení` : `${pocet} zařízení`,
    deleteRoomHint:
      "Smazáním místnosti se nic nesmaže. Zařízení jen zůstanou nezařazená.",
  },

  scenes: {
    title: "Scény",
    scenes: "Scény",
    scripts: "Skripty",
    empty: "Zatím nemáte žádné scény.",
    create: "Nová scéna",
    createScript: "Nový skript",
    sceneName: "Název scény",
    pickDevices: "Zařízení ve scéně",
    searchDevices: "Hledat zařízení",
    pickAtLeastOne: "Vyberte alespoň jedno zařízení.",
    noDevices: "Nemáte dostupné zařízení, jehož stav lze uložit do scény.",
    noMatches: "Žádné zařízení neodpovídá hledání.",
    emptyScripts: "Zatím nemáte žádné skripty.",
    noScriptDevices: "Nemáte zařízení ani scénu, které může skript ovládat.",
    scriptName: "Název skriptu",
    scriptHint: "Skript vykoná vybrané kroky v uvedeném pořadí.",
    device: "Zařízení nebo scéna",
    action: "Co se má stát",
    addStep: "Přidat krok",
    tooManySteps: "Skript může mít nejvýš 20 kroků.",
    step: (number) => `Krok ${number}`,
    moveUp: "Nahoru",
    moveDown: "Dolů",
    scriptActions: {
      turn_on: "Zapnout", turn_off: "Vypnout", open: "Otevřít",
      close: "Zavřít", lock: "Zamknout", unlock: "Odemknout",
      activate: "Aktivovat scénu", run: "Spustit skript", press: "Stisknout",
      play_pause: "Přehrát nebo pozastavit", stop: "Zastavit",
    },
    createdWith: (n) => `Scéna uložena. Zapsáno zařízení: ${n}.`,
    hint:
      "Vyberte zařízení. Scéna si zapamatuje jejich aktuální nastavení.",
  },

  automations: {
    title: "Automatizace",
    empty: "Zatím nemáte žádné automatizace.",
    create: "Nová automatizace",
    enabled: "Zapnuto",
    disabled: "Vypnuto",
    runNow: "Spustit teď",
    lastTriggered: "Naposledy",
    never: "Zatím nikdy",
    pickTemplate: "Co má automatizace dělat?",
    name: "Název automatizace",
    readOnly: "Složitou automatizaci zatím neumíme upravit, jen zapnout a spustit.",
  },

  builder: {
    title: "Nová automatizace",
    editTitle: "Úprava automatizace",
    name: "Název",
    namePlaceholder: "Třeba Světlo na chodbě",
    description: "Popis",
    mode: "Když se spustí znovu, než dojede",
    modes: {
      single: "Nic nedělat",
      restart: "Začít znovu",
      queued: "Zařadit do fronty",
    },

    when: "KDYŽ",
    whenHint: "Co automatizaci spustí. Stačí jedna z věcí.",
    and: "A ZÁROVEŇ",
    andHint: "Nepovinné. Musí platit všechno, jinak se nic nestane.",
    then: "PAK",
    thenHint: "Co se má stát. Provede se po pořadě.",

    addWhen: "Přidat spouštěč",
    addAnd: "Přidat podmínku",
    addThen: "Přidat akci",
    remove: "Odebrat",
    empty: "Zatím nic",

    advanced: "Pokročilá automatizace",
    advancedHint:
      "Tahle automatizace obsahuje věci, které náš editor neumí zobrazit. " +
      "Nebudeme do ní zasahovat, aby se nepoškodila. Můžete ji zapnout, " +
      "vypnout a ručně spustit.",

    triggers: {
      state: "Zařízení se přepne do stavu",
      state_for: "Zařízení je ve stavu po dobu",
      time: "V zadaný čas",
      sun: "Při východu nebo západu slunce",
      numeric: "Hodnota překročí mez",
    },
    conditions: {
      state: "Zařízení je ve stavu",
      time_range: "Je mezi časy",
      numeric: "Hodnota je nad nebo pod mezí",
    },
    actions: {
      device: "Zapnout, vypnout nebo přepnout",
      value: "Nastavit hodnotu",
      scene: "Spustit scénu",
      script: "Spustit skript",
      wait: "Počkat",
      notify: "Poslat upozornění",
    },

    fields: {
      entity: "Zařízení",
      to: "Na stav",
      is: "Je ve stavu",
      minutes: "Minut",
      at: "Čas",
      after: "Od",
      before: "Do",
      event: "Událost",
      offset: "Posun v minutách",
      direction: "Kde",
      value: "Hodnota",
      command: "Co udělat",
      message: "Text upozornění",
    },

    states: {
      on: "Zapnuto",
      off: "Vypnuto",
      open: "Otevřeno",
      closed: "Zavřeno",
      home: "Doma",
      not_home: "Pryč",
      locked: "Zamčeno",
      unlocked: "Odemčeno",
    },
    directions: { above: "Nad mezí", below: "Pod mezí" },
    sunEvents: { sunrise: "Východ slunce", sunset: "Západ slunce" },
    commands: {
      turn_on: "Zapnout",
      turn_off: "Vypnout",
      toggle: "Přepnout",
      brightness: "Jas v procentech",
      position: "Otevření žaluzie v procentech",
      temperature: "Teplota ve stupních",
    },

    pickWay: "Jak chcete automatizaci vytvořit?",
    waySimple: {
      name: "Jednoduše",
      description: "KDYŽ se něco stane, PAK udělej tohle",
    },
    wayBlocks: {
      name: "Skládačka",
      description: "Bloky pod sebou, s větvením a čekáním",
    },
    wayTemplate: {
      name: "Ze šablony",
      description: "Hotové recepty, stačí vybrat zařízení",
    },
  },

  templates: {
    motion_light: {
      name: "Světlo na pohyb",
      description: "Rozsvítí, když se něco pohne. Po klidu zhasne.",
      sensor: "Čidlo pohybu",
      light: "Světla, která se rozsvítí",
      minutes: "Zhasnout po (minut)",
    },
    window_heating: {
      name: "Otevřené okno vypne topení",
      description: "Když je okno otevřené, topení se vypne. Po zavření se zapne.",
      window: "Okno nebo dveře",
      climate: "Topení",
      minutes: "Vypnout až po (minut)",
    },
    water_leak: {
      name: "Upozornění na únik vody",
      description: "Když čidlo najde vodu, přijde upozornění.",
      sensor: "Čidlo úniku vody",
    },
    leaving_home: {
      name: "Odchod z domu",
      description: "Když odejdete, zhasnou vybraná světla.",
      person: "Osoba",
      light: "Světla, která zhasnou",
    },
    arriving_home: {
      name: "Příchod domů",
      description: "Když přijdete, rozsvítí se vybraná světla.",
      person: "Osoba",
      light: "Světla, která se rozsvítí",
    },
    good_night: {
      name: "Dobrou noc",
      description: "V zadaný čas zhasnou vybraná světla.",
      at: "Čas",
      light: "Světla, která zhasnou",
    },
  },

  integrations: {
    title: "Integrace",
    tabDevices: "Zařízení",
    tabIntegrations: "Integrace",
    tabHelpers: "Pomocníci",
    configured: "Připojené systémy",
    discovered: "Nalezeno ve vaší síti",
    discoveredHint:
      "Tohle se našlo samo. Klepnutím dokončíte nastavení, zabere to chvilku.",
    finishSetup: "Klepnutím dokončíte",
    empty: "Zatím nemáte připojený žádný systém.",
    add: "Připojit nový systém",
    addHint:
      "Vyberte, co chcete připojit. Vyplníte pár údajů a zařízení se " +
      "objeví sama.",
    search: "Hledat…",
    loading: "Načítám seznam…",
    noMatch: "Nic takového jsme nenašli.",
    remove: "Odebrat",
    removeHint:
      "Odebráním zmizí i všechna zařízení, která tenhle systém přinesl. " +
      "Opravdu pokračovat?",
    problem: "Nefunguje správně",
    helpers: "Pomocníci",
    helpersHint:
      "Pomocník je hodnota, kterou si dům pamatuje - cílová teplota, " +
      "práh jasu, přepínač režimu. Použijete ji pak v automatizacích.",
    addHelper: "Vytvořit pomocníka",
    loadingHelpers: "Načítám pomocníky…",
    noHelpers: "Zatím nemáte žádné pomocníky.",
    editHelper: "Upravit pomocníka",
    helperName: "Název pomocníka",
    helperCatalogHint: "Vyberte typ pomocníka, který Home Assistant dovoluje založit průvodcem.",
    noHelperFlows: "Tato instalace nenabízí pomocníka, kterého lze založit průvodcem.",
    helperTypes: {
      input_boolean: "Přepínač", input_number: "Číslo",
      input_select: "Výběr", input_text: "Text",
      input_datetime: "Datum a čas", counter: "Počítadlo",
      timer: "Časovač", schedule: "Plán",
    },
  },

  flow: {
    next: "Pokračovat",
    done: "Hotovo",
    working: "Pracuji na tom…",
    addedTitle: "Přidáno",
    addedHint: "Zařízení najdete v sekci Zařízení. Můžete jim přiřadit místnost.",
    stopped: "Nastavení se nedokončilo",
    stoppedHint: "Zkuste to prosím znovu.",
    fillRequired: "Vyplňte prosím všechna povinná pole.",
    externalHint:
      "Přihlaste se u poskytovatele služby. Až budete hotovi, vraťte se sem " +
      "a klepněte na Hotovo.",
    openProvider: "Přihlásit se u poskytovatele",
    unsupported:
      "Tenhle krok zatím neumíme zobrazit. Napište nám prosím, o jaký " +
      "systém jde, a doplníme ho.",
    unsupportedField:
      "Část nastavení jsme nedokázali zobrazit. Zkuste pokračovat, obvykle " +
      "stačí výchozí hodnoty.",
  },

  devices: {
    title: "Zařízení",
    loading: "Načítám zařízení…",
    empty: "Zatím nemáte žádná zařízení.",
    manufacturer: "Výrobce",
    model: "Model",
    integration: "Integrace",
    room: "Místnost",
    functions: "Funkce zařízení",
    deviceName: "Název zařízení",
    renameHint: "Název uvidíte všude, kde se zařízení objeví.",
    removeHint:
      "Zařízení odeberete v záložce Integrace - odebráním systému, který ho přinesl.",
  },

  settings: {
    whatIsLight: "Co je světlo",
    whatIsLightHint:
      "Home Assistant hlásí jako světlo i relé v prodlužce, zásuvku " +
      "u televize nebo kontrolku na čidle. Co umí jen zapnout a vypnout, " +
      "bereme jako spínač. Tady to můžete vrátit zpátky na světlo.",
    noLights: "Home Assistant zatím nehlásí žádná světla.",
    lightDimmable: "Světlo, umí se stmívat",
    lightOnOff: "Světlo, jen zapnout a vypnout",
    notLight: "Spínač, do světel se nepočítá",
    title: "Nastavení",

    account: "Účet",
    unknownUser: "Neznámý uživatel",
    youAreAdmin: "Jste správce domácnosti. Můžete měnit vše.",
    youAreTechnician: "Máte plné ovládání a vlastní upravitelnou plochu.",
    technician: "Plné zobrazení a úpravy",
    technicianHint:
      "Výchozí pro každý účet. Vypnutím zobrazíte jen základní ovládání; " +
      "znovu ho zapnete tady v nastavení.",
    theme: "Vzhled",
    themeHint:
      "Platí pro tohle zařízení. Tablet na zdi může být tmavý a telefon " +
      "světlý.",
    themes: {
      auto: "Podle Home Assistanta",
      light: "Světlý",
      dark: "Tmavý",
      ha: "Motiv Home Assistanta",
    },
    themesHint: {
      auto: "Barvy Smarthome4u, světlé nebo tmavé podle nastavení HA",
      light: "Barvy Smarthome4u, vždy světlé",
      dark: "Barvy Smarthome4u, vždy tmavé",
      ha: "Převezme barvy z motivu, který máte v Home Assistantu",
    },
    youAreUser: "Můžete ovládat dům a upravit si vlastní plochu.",
    onlyAdmin: "Tento účet má omezený přístup nastavený správcem domácnosti.",

    appearance: "Vzhled",
    kiosk: "Kiosk režim",
    kioskHint:
      "Schová postranní lištu a horní pruh Home Assistantu, když je otevřené " +
      "Smarthome4u. Platí pro tento účet; vypnutím se lišty HA vrátí.",
    bigControls: "Zvětšené ovládání",
    bigControlsHint:
      "Větší tlačítka a písmo. Hodí se pro starší uživatele a pro panel " +
      "na zdi, na který se dívá z dálky.",
    landing: "Po přihlášení otevřít Smarthome4u",
    landingHint:
      "Místo výchozího dashboardu Home Assistantu se rovnou otevře Smarthome4u.",

    dashboard: "Dashboard",
    dashboardHint:
      "Vyberte podobu. Každá má vlastní sestavu bloků, kterou upravíte " +
      "tlačítkem Upravit plochu na obrazovce Domů.",
    editDashboard: "Upravit rozvržení",
    editFloorplan: "Nastavit plánek",
    resetLayout: "Vrátit výchozí rozvržení",
    resetLayoutHint:
      "Zahodí se vaše pořadí a vše se vrátí podle Home Assistantu. " +
      "Nic se nesmaže.",

    admin: "Správce domácnosti",
    adminHint:
      "Tento účet spravuje systémové aktualizace a role. Ostatní účty " +
      "mají ve výchozím stavu plné úpravy své plochy a domácnosti.",
    adminAccount: "Účet správce",
    adminChanged: "Správce změněn.",
    roles: "Přístup techniků",
    rolesHint: "Plný přístup je výchozí. Omezený účet může jen ovládat a upravit svou plochu.",
    roleUser: "Omezený účet",
    roleTechnician: "Plný přístup",
    roleChanged: "Přístup účtu byl uložen.",

    system: "Systém",
    appVersion: "Smarthome4u",
    haVersion: "Home Assistant",
    os: "Systém",
    hostname: "Název zařízení",
    devices: "Zařízení",
    entities: "Funkce zařízení",
    integrations: "Připojené systémy",
    automations: "Automatizace",
    allUpToDate: "Vše je aktuální.",
    updatesWaiting: (n) =>
      n === 1 ? "Čeká 1 aktualizace" : `Čekají aktualizace: ${n}`,
    install: "Nainstalovat",
    installStarted: "Aktualizace se spustila.",
    installing: "Instaluje se…",
    disk: "Místo na disku",
    cpu: "Zatížení procesoru",
    memory: "Paměť",
    diskFree: (gb) => `Volno ${gb} GB`,
  },

  floorplan: {
    title: "Půdorys",
    eyebrow: "OVLÁDÁNÍ NA PLÁNKU",
    homePlan: "Plánek domácnosti",
    automaticPlan: "Automatický plánek místností",
    planHint: "Klepněte na značku. Detail místnosti se zobrazí jen tehdy, když jej značce nastavíte jako akci.",
    automaticHint: "Místnosti jsme poskládali z Home Assistanta. Vlastní půdorys vyberete tlačítkem nahoře.",
    roomsOnPlan: "Místnosti v plánku",
    selectedRoom: "VYBRANÁ MÍSTNOST",
    noControls: "V této místnosti nejsou vybraná zařízení.",
    roomState: (lights, temperature) =>
      `${lights} světel svítí${temperature == null ? "" : ` · ${temperature} °C`}`,
    upload: "Vybrat plánek",
    editPlan: "Upravit plánek",
    addFirst: "Přidat první značku na plánek",
    editHint: "Klepněte na místo v plánku a vyberte místnost nebo zařízení. Značky pak přetáhněte na správné místo.",
    placeTitle: "Co sem umístit?",
    placeHint: "Vyberte, co chcete na označené místo přidat.",
    addRoom: "Přidat místnost",
    addIcon: "Přidat ikonu nebo ovládání",
    iconEntity: "Ikona představuje",
    display: "Na plánku zobrazit",
    displayBoth: "Ikonu i název",
    displayIcon: "Jen ikonu",
    displayLabel: "Jen název",
    scale: "Velikost značky (%)",
    positionX: "Poloha zleva (%)",
    positionY: "Poloha shora (%)",
    feedback: "Zvýraznění značky",
    feedbackTarget: "Stav sledovat podle",
    feedbackNone: "Bez zvýraznění",
    feedbackState: "Rozsvítit při zapnutí",
    feedbackLightColor: "Převzít barvu světla",
    chooseTarget: "Vybrat zařízení, scénu nebo pomocníka",
    actionTarget: "Cíl akce",
    targetMissing: "Cíl této akce už v Home Assistantu není.",
    gestures: { single: "Jedno klepnutí", double: "Dvojklepnutí", hold: "Podržení" },
    actionModes: {
      none: "Nedělat nic", room: "Otevřít místnost", details: "Otevřít ovládání",
      toggle: "Přepnout", turn_on: "Zapnout", turn_off: "Vypnout",
      activate: "Spustit scénu", run: "Spustit skript nebo automatizaci",
      increment: "Zvýšit počítadlo", decrement: "Snížit počítadlo",
      reset: "Vynulovat počítadlo", start: "Spustit časovač",
      pause: "Pozastavit časovač", cancel: "Zrušit časovač",
      press: "Stisknout tlačítko", open: "Otevřít", close: "Zavřít",
      stop: "Zastavit",
    },
    editRoom: "Upravit místnost na plánku",
    roomAddHint: "Vyberte místnost z Home Assistanta. Její značku pak můžete přetáhnout a upravit.",
    noRoomsToAdd: "Všechny dostupné místnosti už jsou na plánku.",
    fromHa: "Ze souborů HA",
    fromComputer: "Z počítače",
    haHint: "Vyberte obrázek z knihovny Média nebo ze složky www v Home Assistantu.",
    haEmpty: "V Home Assistantu nejsou žádné vhodné obrázky. Můžete nahrát soubor z počítače.",
    haSearch: "Hledat obrázek",
    haLoading: "Načítám obrázky…",
    haLoadFailed: "Seznam souborů se nepodařilo načíst.",
    haPickFile: "Vyberte obrázek ze souborů Home Assistanta.",
    uploadHint:
      "Vyberte obrázek půdorysu bytu nebo domu. PNG, JPG nebo WEBP, " +
      "nejvýš 8 MB.",
    pickFile: "Vyberte prosím soubor.",
    readFailed: "Soubor se nepodařilo přečíst.",
    empty: "Zatím tu není žádný plánek. Nahrajte ho tlačítkem nahoře.",
    emptyUser: "Správce zatím nenahrál plánek bytu.",
    addDevice: "Přidat zařízení na plán",
    addHint:
      "Vyberte zařízení. Značku pak můžete přetáhnout na správné místo.",
    nothingToAdd: "Všechna dostupná zařízení, scény a pomocníci už na plánu jsou.",
  },

  panel: {
    open: "Otevřeno a odemčeno",
    nowPlaying: "Právě hraje",
    noPlayers: "V Home Assistantu zatím není dostupný žádný přehrávač.",
    nonePlaying: "Nic se právě nepřehrává. Klepnutím na přehrávač otevřete ovládání.",
    playerMissing: "Vybraný přehrávač už není dostupný. Vyberte jiný v úpravách karty.",
    lightsOn: "Rozsvícená světla",
  },

  picker: {
    title: "Vyberte zařízení",
    search: "Začněte psát název nebo místnost…",
    nothing: "Nic takového jsme nenašli.",
    more: (pocet) => `A dalších ${pocet}. Upřesněte hledání.`,
  },

  favorites: {
    emptyBlock: "V tomto bloku zatím není žádné zařízení.",
    emptyBlockHint: "V této kartě zatím nejsou zařízení. Vyberte je v knihovně v bočním panelu.",
    unavailableInBlock: "Vybraná zařízení teď nejsou v Home Assistantu dostupná.",
    replace: "Vyměnit zařízení",
    tapToReplace: "Klepnutím vyměníte",
    tapToEdit: "klepnutím upravíte",
    replaceHint: "Na tomhle místě bude jiné zařízení",
    removeHint: "Zařízení zůstane, jen zmizí z plochy",
    add: "Přidat zařízení",
    remove: "Odebrat z plochy",
    hint:
      "Dlaždici upravíte tlačítkem ⋯, velikost změníte ↔ a za ⠿ ji přetáhnete. " +
      "Zařízení lze přidat z knihovny vedle mřížky.",
  },

  presets: {
    comingSoon: "Připravuje se",
    tuya: {
      name: "Chytrá domácnost",
      description: "Kompaktní ovládání ve stylu předlohy.",
    },
    home: {
      name: "Domov",
      description: "Klidná kombinace Google Home a Apple Home.",
    },
    prehled: {
      name: "Přehled HA",
      description: "Souhrn domácnosti a zařízení podle Home Assistantu.",
    },
    pudorys: {
      name: "Půdorys",
      description: "Plánek bytu s ovládáním",
    },
  },

  dashboardIntro: {
    overview: { eyebrow: "MOJE DOMÁCNOST", title: "Přehled domácnosti",
      description: "Místnosti a zařízení se aktualizují podle Home Assistanta." },
    tuya: { eyebrow: "MOJE DOMÁCNOST", title: "Rychlé ovládání",
      description: "Oblíbená zařízení a scény na dosah." },
    home: { eyebrow: "MÍSTNOSTI", title: "Domov",
      description: "Přehled podle místností a každodenních činností." },
    prehled: { eyebrow: "HOME ASSISTANT", title: "Stav domácnosti",
      description: "Důležité stavy a události pohromadě." },
    pudorys: { eyebrow: "OVLÁDÁNÍ NA PLÁNKU", title: "Plánek domácnosti",
      description: "Místnosti a zařízení na jednom plánku." },
    lights: (count) => `${count} světel svítí`,
    open: (count) => `${count} otevřeno`,
  },
  studio: {
    layout: "Rozvržení dlaždic",
    library: "Knihovna zařízení",
    hint: "Klepněte na zařízení nebo ho přetáhněte do mřížky.",
    dragHint: "Klepněte pro přidání nebo přetáhněte na plochu",
    search: "Hledat zařízení nebo místnost",
    filter: "Typ zařízení",
    allKinds: "Všechny typy",
    empty: "Žádné další zařízení.",
    all: "Vše",
    categories: "Kategorie zařízení",
    searchBoard: "Hledat na ploše",
  },
  metrics: {
    lightsOn: "Rozsvícená světla",
    openCount: "Otevřená okna a dveře",
    unlockedCount: "Odemčené zámky",
    rooms: "Místnosti",
    devices: "Zařízení",
  },

  /* Názvy bloků. Musí říct, co blok ukazuje, ne jak se jmenuje uvnitř. */
  blocks: {
    auto_rooms: "Místnosti a zařízení automaticky",
    floorplan: "Plánek domácnosti",
    headline: "Úvod plochy",
    entity: "Jedno zařízení",
    clock: "Hodiny",
    status: "Stav domu",
    alerts: "Upozornění",
    open: "Otevřená okna a dveře",
    playing: "Právě hraje",
    lights: "Rozsvícená světla",
    scenes: "Scény",
    rooms: "Místnosti",
    actions: "Rychlé akce",
    entities: "Vybraná zařízení",
    room: "Skupina zařízení",
    metric: "Číselný přehled",
  },

  blocksHint: {
    auto_rooms: "Nové místnosti a zařízení se přidají samy podle Home Assistanta",
    floorplan: "Interaktivní plánek s ikonami a detaily místností",
    headline: "Název a krátký popis plochy",
    entity: "Samostatná karta zařízení nebo entity Home Assistanta",
    clock: "Velké hodiny a datum",
    status: "Svítí, zamčeno, zavřeno - třemi větami",
    alerts: "Kouř, voda, plyn. Ukáže se, jen když je co hlásit",
    open: "Zobrazí se, když je něco otevřené nebo odemčené",
    playing: "Přehrávače s ovládáním. Vyberte jeden nebo nechte automaticky zobrazovat aktivní.",
    lights: "Zobrazí se, když svítí některé světlo. Nabídne i zhasnutí všech.",
    scenes: "Zobrazí scény dostupné v Home Assistantu",
    rooms: "Dlaždice dostupných místností s teplotou",
    actions: "Zhasnout vše a přechod do místností",
    entities: "Zařízení, která si vyberete sám",
    room: "Samostatná skupina s vlastním názvem a zařízeními",
    metric: "Jedna hodnota ze stavu domácnosti",
  },

  dashboardManager: {
    hint: "Vytvořte si vlastní plochu ze šablony a upravte ji přetažením. Správce může plochy přiřadit dalším účtům.",
    create: "Nový dashboard",
    rename: "Přejmenovat dashboard",
    delete: "Smazat dashboard",
    deleteHint: "Dashboard a jeho rozvržení se smažou. Účty s touto plochou přejdou na první dostupnou. Pokud žádná nezůstane, vytvoříte novou v Nastavení.",
    noDashboards: "Zatím nemáte žádný dashboard.",
    noDashboardsHint: "Novou plochu vytvoříte v Nastavení. Automatický přehled tam můžete kdykoliv obnovit.",
    name: "Název dashboardu",
    template: "Výchozí podoba",
    blank: "Prázdná plocha",
    overview: "Automatický přehled místností",
    templateHint: "Začněte prázdnou plochou nebo si vyberte základ. Každý blok pak můžete přesunout, zvětšit a nastavit v pravém panelu.",
    examples: [
      "Energie: přidejte samostatné karty senzorů spotřeby z Home Assistanta.",
      "Kamery: přidejte kartu kamery a zvolte její velikost podle počtu náhledů.",
      "Vysavač: přidejte kartu jeho entity a nastavte dostupné ovládání.",
      "Půdorys: při tvorbě vyberte šablonu Půdorys a potom umístěte značky na plánek.",
    ],
    restoreOverview: "Obnovit automatický přehled",
    assignedTo: (name) => `Dashboard pro ${name}`,
    showMore: (count) => `Zobrazit dalších ${count} zařízení`,
  },

  editor: {
    title: "Úprava plochy",
    properties: "Karta",
    chooseBlock: "Vyberte prvek na ploše a upravte ho zde.",
    duplicate: "Zkopírovat prvek",
    snapHint: "Karta se při přesouvání přichytává po 10 pixelech.",
    contentOnCanvas: "Zařízení přidáte z knihovny níže. Jejich vzhled a pořadí upravíte na pracovní ploše.",
    hint:
      "Kartu přetáhněte po ploše a její velikost změňte pomocí bodů na okraji. " +
      "Klepnutím otevřete nastavení vpravo. Změny se ukládají automaticky.",
    edit: "Upravit plochu",
    undo: "Zpět",
    redo: "Znovu",
    addBlock: "Přidat prvek",
    addTab: "Přidat",
    addBlockHint: "Vyberte, co chcete na plochu přidat. Nový prvek se objeví pod ostatními a můžete ho přesunout i upravit.",
    removeBlock: "Odebrat blok",
    blockEmpty: "Tenhle blok teď nemá co ukázat. Až bude, objeví se sám.",
    blockFailed: "Blok se nepodařilo vykreslit.",
    allBlocksUsed: "Všechny bloky už na ploše máte.",
    emptyBoard:
      "Plocha je prázdná. Klepněte na Upravit plochu a přidejte bloky.",
    noVisibleBlocks: "Na této ploše se teď nic nezobrazuje. Otevřete úpravy a zkontrolujte nastavení prvků.",
    done: "Hotovo",
    hide: "Schovat",
    drag: "Přetáhnout",
    size: "Velikost",
    sizes: {
      normal: "Normální",
      wide: "Široká",
      tall: "Vysoká",
      big: "Velká",
      s: "Malá",
      m: "Střední",
      l: "Velká s ovládáním",
      xl: "Extra velká",
    },
    sizeHint:
      "Malá ukáže jen ikonu a název. Velká má ovládání přímo v dlaždici - " +
      "stmívání, polohu žaluzie nebo teplotu bez otevírání detailu.",
    tileMenu: "Upravit dlaždici",
    label: "Vlastní název",
    subtitle: "Krátký popis",
    labelHint: "Prázdné pole použije název z Home Assistantu.",
    icon: "Ikona",
    color: "Barva",
    automatic: "Automaticky",
    blockAppearance: "Vzhled bloku",
    metricSource: "Zobrazovaná hodnota",
    blockType: "Obsah bloku",
    automaticTilesHint: "Úpravou této dlaždice se blok změní na vlastní výběr zařízení.",
    blockHeight: "Výška bloku",
    roomProperties: "Upravit pokoj",
    pixelHeight: "Přesná výška bloku",
    fontSize: "Velikost textu",
    chooseEntity: "Vyberte zařízení",
    entitySource: "Zařízení nebo entita",
    mediaSource: "Přehrávač",
    mediaAutomatic: "Automaticky: právě aktivní přehrávače",
    layoutTab: "Rozložení",
    viewsTab: "Plochy",
    contentTab: "Obsah",
    styleTab: "Vzhled",
    actionsTab: "Akce",
    sizeTab: "Velikost",
    positionX: "Poloha zleva (‰)",
    positionY: "Poloha shora (px)",
    positionW: "Šířka (‰)",
    positionH: "Výška (px)",
    singleTap: "Jedno klepnutí",
    actionDefault: "Výchozí ovládání",
    actionDetails: "Otevřít detail",
    actionPlayPause: "Přehrát nebo pozastavit",
    actionNone: "Bez akce",
    actionEntityHint: "Akce při klepnutí se nastavuje u karty jedné entity.",
    freeLayoutHint: "Karty přesuňte tažením a velikost změňte za modré body na okraji. Poloha se přichytává po 10 px. Změny se ukládají automaticky.",
    mobileLayoutHint: "Na telefonu se karty řadí pod sebe, aby zůstaly ovladatelné.",
    deviceTablet: "Tablet",
    devicePhone: "Telefon",
    deviceDesktop: "Počítač",
    deviceLayoutHint: "Tablet je základ. Telefon se bez vlastních úprav skládá do jednoho sloupce; počítač přebírá tablet. Přetažením na vybraném zařízení vytvoříte jeho vlastní rozložení.",
    heightCompact: "Kompaktní",
    heightNormal: "Normální",
    heightLarge: "Vysoký",
    sizeXL: "Extra velká",
    editPoint: "Upravit bod na plánku",
    colors: {
      default: "Výchozí",
      mint: "Tyrkysová",
      blue: "Modrá",
      violet: "Fialová",
      amber: "Žlutá",
      rose: "Růžová",
    },
    icons: {
      home: "Dům", rooms: "Místnosti", lighting: "Světlo", switch: "Vypínač",
      cover: "Žaluzie", climate: "Teplota", lock: "Zámek", fan: "Ventilátor",
      media: "Hudba", security: "Zabezpečení", camera: "Kamera",
      temperature: "Teploměr", humidity: "Vlhkost", power: "Energie",
      door: "Dveře", window: "Okno", water: "Voda", smoke: "Kouř",
      sensor: "Senzor", person: "Osoba", scenes: "Scéna", devices: "Zařízení",
      automations: "Automatizace",
    },
    columns: "Sloupce",
    columnsHint: "Kolik bloků vedle sebe. Na telefonu je vždy jeden.",
    rename: "Přejmenovat blok",
    renameHint: "Prázdný název vrátí původní.",
    width: (sirka, sloupce) => `Šířka ${sirka}/${sloupce}`,
    widthHint: "Přes kolik sloupců blok sahá. Klepnutím se mění.",
    reclassify: "Změnit typ",
    reclassifyHint:
      "Home Assistant hlásí jako světlo i kontrolky. Tady to můžete opravit.",
    kind: "Typ zařízení",
    keepAsIs: "Nechat, jak hlásí Home Assistant",
    saved: "Rozvržení uloženo.",
    kinds: {
      light: "Světlo",
      switch: "Zásuvka nebo vypínač",
      cover: "Žaluzie nebo roleta",
      climate: "Topení nebo klimatizace",
      lock: "Zámek",
      fan: "Ventilátor",
      sensor: "Senzor s hodnotou",
      binary_sensor: "Čidlo zapnuto/vypnuto",
      media_player: "Přehrávač",
      number: "Číselná hodnota",
      select: "Výběr z možností",
      button: "Tlačítko",
      presence: "Přítomnost osoby",
      camera: "Kamera",
      scene: "Scéna",
      script: "Skript",
      automation: "Automatizace",
      text: "Text",
      datetime: "Datum a čas",
      counter: "Počítadlo",
      timer: "Odpočet",
      schedule: "Týdenní rozvrh",
    },
  },

  empty: {
    title: "Zatím tu nic není",
    text: "V Home Assistantu nejsou žádná zařízení, která by Smarthome4u umělo zobrazit.",
  },

  control: {
    brightness: "Jas",
    colorTemp: "Teplota bílé",
    color: "Barva",
    position: "Otevření",
    tilt: "Natočení lamel",
    temperature: "Teplota",
    currentTemperature: "Teď je",
    mode: "Režim",
    preset: "Program",
    speed: "Rychlost",
    volume: "Hlasitost",
    open: "Otevřít",
    close: "Zavřít",
    stop: "Zastavit",
    lock: "Zamknout",
    unlock: "Odemknout",
    unlatch: "Otevřít",
    press: "Stisknout",
    playPause: "Přehrát nebo pozastavit",
    value: "Hodnota",
    option: "Volba",
    date: "Datum",
    time: "Čas",
    plus: "Přidat",
    minus: "Ubrat",
    reset: "Vynulovat",
    start: "Spustit",
    pause: "Pozastavit",
    cancel: "Zrušit",
    addFavorite: "Přidat mezi často používané",
    removeFavorite: "Odebrat z často používaných",
  },

  state: {
    running: "Běží",
    nowOn: "Právě platí",
    nowOff: "Teď neplatí",
    on: "Zapnuto",
    off: "Vypnuto",
    unavailable: "Nedostupné",
    unknown: "Neznámý stav",
    open: "Otevřeno",
    closed: "Zavřeno",
    opening: "Otevírá se",
    closing: "Zavírá se",
    locked: "Zamčeno",
    unlocked: "Odemčeno",
    home: "Doma",
    notHome: "Pryč",
    idle: "Nečinné",
    playing: "Přehrává",
    paused: "Pozastaveno",
  },

  hvac: {
    off: "Vypnuto",
    heat: "Topení",
    cool: "Chlazení",
    heat_cool: "Topení i chlazení",
    auto: "Automaticky",
    dry: "Odvlhčování",
    fan_only: "Jen ventilátor",
  },

  /* Binární senzory. Význam se mění podle device_class, ne podle názvu. */
  binary: {
    door: ["Zavřeno", "Otevřeno"],
    window: ["Zavřeno", "Otevřeno"],
    garage_door: ["Zavřeno", "Otevřeno"],
    opening: ["Zavřeno", "Otevřeno"],
    lock: ["Zamčeno", "Odemčeno"],
    motion: ["Klid", "Pohyb"],
    occupancy: ["Prázdno", "Obsazeno"],
    presence: ["Nikdo doma", "Někdo doma"],
    moisture: ["Sucho", "Voda"],
    smoke: ["V pořádku", "Kouř"],
    gas: ["V pořádku", "Plyn"],
    carbon_monoxide: ["V pořádku", "Oxid uhelnatý"],
    problem: ["V pořádku", "Problém"],
    safety: ["Bezpečné", "Nebezpečí"],
    vibration: ["Klid", "Otřesy"],
    battery: ["Baterie v pořádku", "Slabá baterie"],
    connectivity: ["Odpojeno", "Připojeno"],
    running: ["Stojí", "Běží"],
    default: ["Neaktivní", "Aktivní"],
  },
};

/** Vrátí slovní popis stavu entity a tón pro obarvení. */
export function describeState(entity) {
  if (!entity.available) return { text: t.state.unavailable, tone: "offline" };

  const kind = entity.capability?.kind;
  const attrs = entity.attributes || {};

  switch (kind) {
    case "light": {
      if (entity.state !== "on") return { text: t.state.off, tone: "off" };
      const pct = attrs.brightness
        ? Math.round((attrs.brightness / 255) * 100)
        : null;
      return { text: pct ? `${t.state.on} · ${pct} %` : t.state.on, tone: "on" };
    }

    case "switch":
    case "fan":
      return entity.state === "on"
        ? { text: t.state.on, tone: "on" }
        : { text: t.state.off, tone: "off" };

    case "cover": {
      const pos = attrs.current_position;
      if (typeof pos === "number") {
        if (pos === 0) return { text: t.state.closed, tone: "off" };
        if (pos === 100) return { text: t.state.open, tone: "on" };
        return { text: `${t.state.open} · ${pos} %`, tone: "on" };
      }
      return { text: t.state[entity.state] || entity.state, tone: "off" };
    }

    case "climate": {
      const mode = t.hvac[entity.state] || entity.state;
      const now = attrs.current_temperature;
      const target = attrs.temperature;
      const parts = [mode];
      if (typeof now === "number") parts.push(`${now} °C`);
      if (typeof target === "number") parts.push(`→ ${target} °C`);
      return { text: parts.join(" · "), tone: entity.state === "off" ? "off" : "on" };
    }

    case "lock":
      return entity.state === "locked"
        ? { text: t.state.locked, tone: "off" }
        : { text: t.state.unlocked, tone: "alert" };

    case "binary_sensor": {
      const labels = t.binary[entity.deviceClass] || t.binary.default;
      const active = entity.state === "on";
      const alert = active && entity.capability?.safety === true;
      return {
        text: labels[active ? 1 : 0],
        tone: alert ? "alert" : active ? "on" : "off",
      };
    }

    case "sensor":
    case "number": {
      const unit = attrs.unit_of_measurement || entity.capability?.unit;
      return { text: unit ? `${entity.state} ${unit}` : entity.state, tone: "off" };
    }

    case "counter":
      return { text: entity.state, tone: "off" };

    case "timer":
      if (entity.state === "active") {
        return { text: t.state.running, tone: "on" };
      }
      if (entity.state === "paused") {
        return { text: t.state.paused, tone: "off" };
      }
      return { text: t.state.idle, tone: "off" };

    case "schedule":
      return entity.state === "on"
        ? { text: t.state.nowOn, tone: "on" }
        : { text: t.state.nowOff, tone: "off" };

    case "text":
      return { text: entity.capability?.password ? "••••" : entity.state, tone: "off" };

    case "datetime":
      return { text: String(entity.state || "").replace("T", " "), tone: "off" };

    case "presence":
      return entity.state === "home"
        ? { text: t.state.home, tone: "on" }
        : { text: t.state.notHome, tone: "off" };

    case "media_player":
      return { text: t.state[entity.state] || entity.state, tone: "off" };

    case "automation":
      return entity.state === "on"
        ? { text: t.automations.enabled, tone: "on" }
        : { text: t.automations.disabled, tone: "off" };

    case "scene":
    case "script":
    case "button":
      return { text: "", tone: "off" };

    default:
      return { text: entity.state, tone: "off" };
  }
}
