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
    scenes: "Scény",
    automations: "Automatizace",
    devices: "Zařízení",
    settings: "Nastavení",
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
    create: "Uložit stav místnosti jako scénu",
    sceneName: "Název scény",
    pickRoom: "Místnost, jejíž stav se uloží",
    createdWith: (n) => `Scéna uložena. Zapsáno zařízení: ${n}.`,
    hint:
      "Scéna si zapamatuje, jak jsou právě nastavená světla, zásuvky, " +
      "žaluzie a topení ve vybrané místnosti.",
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
    youAreTechnician: "Jste technik domácnosti. Můžete nastavovat dům.",
    technician: "Technický režim",
    technicianHint:
      "Ukáže automatizace, zařízení a integrace. Vypnutím uvidíte " +
      "aplikaci tak, jak ji vidí ostatní členové domácnosti.",
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
    onlyAdmin: "Nastavení může měnit jen správce domácnosti.",

    appearance: "Vzhled",
    kiosk: "Kiosk režim",
    kioskHint:
      "Schová postranní lištu a horní pruh Home Assistantu, když je otevřené " +
      "Smarthome4u. Vypnutím se Home Assistant vrátí do původní podoby.",
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
    resetLayout: "Vrátit výchozí rozvržení",
    resetLayoutHint:
      "Zahodí se vaše pořadí a vše se vrátí podle Home Assistantu. " +
      "Nic se nesmaže.",

    admin: "Správce domácnosti",
    adminHint:
      "Správce nastavuje vše. Ostatní účty dům ovládají, ale nic nemění. " +
      "Správcem může být jen administrátor Home Assistantu.",
    adminAccount: "Účet správce",
    adminChanged: "Správce změněn.",
    roles: "Přístup techniků",
    rolesHint: "Technik může nastavovat zařízení a automatizace. Správce může měnit role a systém.",
    roleUser: "Uživatel",
    roleTechnician: "Technik",
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
    upload: "Nahrát plánek",
    uploadHint:
      "Vyberte obrázek půdorysu bytu nebo domu. PNG, JPG nebo WEBP, " +
      "nejvýš 8 MB.",
    pickFile: "Vyberte prosím soubor.",
    readFailed: "Soubor se nepodařilo přečíst.",
    empty: "Zatím tu není žádný plánek. Nahrajte ho tlačítkem nahoře.",
    emptyUser: "Správce zatím nenahrál plánek bytu.",
    addDevice: "Přidat zařízení na plán",
    addHint:
      "Zařízení se objeví uprostřed plánu. Pak ho přetáhněte tam, kam patří.",
    nothingToAdd: "Všechna zařízení už na plánu jsou.",
  },

  panel: {
    open: "Otevřeno a odemčeno",
    nowPlaying: "Právě hraje",
    lightsOn: "Rozsvícená světla",
  },

  picker: {
    title: "Vyberte zařízení",
    search: "Začněte psát název nebo místnost…",
    nothing: "Nic takového jsme nenašli.",
    more: (pocet) => `A dalších ${pocet}. Upřesněte hledání.`,
  },

  favorites: {
    replace: "Vyměnit zařízení",
    tapToReplace: "Klepnutím vyměníte",
    tapToEdit: "klepnutím upravíte",
    replaceHint: "Na tomhle místě bude jiné zařízení",
    removeHint: "Zařízení zůstane, jen zmizí z plochy",
    add: "Přidat zařízení",
    remove: "Odebrat z plochy",
    hint:
      "Klepnutím na dlaždici změníte velikost nebo vyměníte zařízení. " +
      "Přetažením změníte pořadí, křížkem dlaždici odeberete.",
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

  /* Názvy bloků. Musí říct, co blok ukazuje, ne jak se jmenuje uvnitř. */
  blocks: {
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
  },

  blocksHint: {
    clock: "Velké hodiny a datum",
    status: "Svítí, zamčeno, zavřeno - třemi větami",
    alerts: "Kouř, voda, plyn. Ukáže se, jen když je co hlásit",
    open: "Co je právě otevřené nebo odemčené",
    playing: "Co se přehrává a kde",
    lights: "Kde svítí, s tlačítkem zhasnout vše",
    scenes: "Scény z Home Assistanta",
    rooms: "Dlaždice místností s teplotou",
    actions: "Zhasnout vše a přechod do místností",
    entities: "Zařízení, která si vyberete sám",
  },

  editor: {
    title: "Úprava plochy",
    hint:
      "Chytněte blok za ⠿ a přetáhněte. Klepnutím na název ho přejmenujete, " +
      "tlačítkem se šířkou roztáhnete, křížkem odeberete.",
    edit: "Upravit plochu",
    addBlock: "Přidat blok",
    removeBlock: "Odebrat blok",
    blockEmpty: "Tenhle blok teď nemá co ukázat. Až bude, objeví se sám.",
    blockFailed: "Blok se nepodařilo vykreslit.",
    allBlocksUsed: "Všechny bloky už na ploše máte.",
    emptyBoard:
      "Plocha je prázdná. Klepněte na Upravit plochu a přidejte bloky.",
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
    labelHint: "Prázdné pole použije název z Home Assistantu.",
    icon: "Ikona",
    color: "Barva",
    automatic: "Automaticky",
    blockAppearance: "Vzhled bloku",
    blockHeight: "Výška bloku",
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
