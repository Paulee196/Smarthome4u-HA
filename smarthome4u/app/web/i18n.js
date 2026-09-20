/* Překlady.
 *
 * Žádný text nesmí být napsaný přímo v komponentě. Rozpoznávání typu
 * zařízení NIKDY nezávisí na překladu - backend posílá jen strojové klíče.
 *
 * Čeština ve vykání. Krátké věty, akční kroky.
 */

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

  status: {
    connecting: "Připojuji se",
    online: "Připojeno",
    offline: "Bez spojení",
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
    openInHa: "Otevřít v Home Assistantu",
    confirmDelete: "Opravdu smazat?",
  },

  home: {
    title: "Domů",
    lightsOn: "Svítí",
    devices: "Zařízení",
    rooms: "Místnosti",
    allQuiet: "Vše je v pořádku",
    alerts: "Vyžaduje pozornost",
    allLightsOff: "Zhasnout vše",
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
    step1: "Zařízení → Přidat zařízení, pokud chcete něco nového.",
    step2: "Místnosti → Spravovat, pokud chcete uklidit, co kde je.",
    step3: "Automatizace → Nová, pokud má dům něco dělat sám.",
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
    advancedHint:
      "Složitější automatizace s větvením a čekáním vytvoříte v Home Assistantu.",
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

  devices: {
    title: "Zařízení",
    empty: "Zatím nemáte žádná zařízení.",
    add: "Přidat zařízení",
    addTitle: "Přidat zařízení",
    discovered: "Nalezená zařízení",
    discoveredHint:
      "Tahle zařízení Home Assistant našel sám. Klepnutím dokončíte nastavení.",
    noDiscovered: "Teď nic nového nenašel.",
    manualHint:
      "Zařízení se přidává přes integraci, která ho umí. Vyberte si, co " +
      "přidáváte, a Home Assistant vás provede.",
    detailTitle: "Detail zařízení",
    manufacturer: "Výrobce",
    model: "Model",
    integration: "Integrace",
    room: "Místnost",
    functions: "Funkce zařízení",
    deviceName: "Název zařízení",
    renameHint: "Název uvidíte všude, kde se zařízení objeví.",
    removeHint: "Zařízení se odebírá v Home Assistantu u jeho integrace.",
  },

  addDevice: {
    zha: "Zigbee",
    matter: "Matter",
    mqtt: "MQTT",
    esphome: "ESPHome",
    shelly: "Shelly",
    hue: "Philips Hue",
    tuya: "Tuya",
    knx: "KNX",
    browse: "Procházet všechny integrace",
  },

  settings: {
    title: "Nastavení",
    account: "Přihlášený uživatel",
    system: "Systém",
    haVersion: "Home Assistant",
    appVersion: "Smarthome4u",
    structure: "Patra a místnosti",
    openHaSettings: "Nastavení Home Assistantu",
    unknownUser: "Neznámý uživatel",
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
  },

  state: {
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
