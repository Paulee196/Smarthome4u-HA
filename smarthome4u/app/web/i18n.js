/* Překlady.
 *
 * Žádný text nesmí být napsaný přímo v komponentě. Rozpoznávání typu
 * zařízení NIKDY nezávisí na překladu - backend posílá jen strojové klíče.
 *
 * První jazyk čeština, ve vykání. Angličtina se doplní později.
 */

export const cs = {
  appName: "Smarthome4u",

  status: {
    connecting: "Připojuji se",
    online: "Připojeno",
    offline: "Bez spojení",
  },

  notice: {
    connecting:
      "Načítám vaši domácnost z Home Assistantu. Chvíli to potrvá.",
    offline:
      "Home Assistant teď není dostupný. Vaše domácnost funguje dál, " +
      "jen ji odsud nejde ovládat. Zkouším se připojit znovu.",
    actionFailed: "Příkaz se nepodařilo provést.",
  },

  empty: {
    title: "Zatím tu nic není",
    text:
      "V Home Assistantu nejsou žádná zařízení, která by Smarthome4u " +
      "umělo zobrazit.",
  },

  room: {
    unassigned: "Nezařazeno",
    floor: "Patro",
  },

  footer: {
    version: "Home Assistant",
  },

  /* Stavy zařízení. Klíč je domain nebo device_class od backendu. */
  state: {
    on: "Zapnuto",
    off: "Vypnuto",
    unavailable: "Nedostupné",
    unknown: "Neznámý stav",
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

/** Vrátí slovní popis stavu entity. */
export function describeState(entity, t = cs) {
  if (!entity.available) {
    return { text: t.state.unavailable, tone: "offline" };
  }

  const kind = entity.capability?.kind;

  if (kind === "light" || kind === "switch") {
    const on = entity.state === "on";
    return { text: on ? t.state.on : t.state.off, tone: on ? "on" : "off" };
  }

  if (kind === "binary_sensor") {
    const labels = t.binary[entity.deviceClass] || t.binary.default;
    const active = entity.state === "on";
    const alert = active && entity.capability?.safety === true;
    return {
      text: labels[active ? 1 : 0],
      tone: alert ? "alert" : active ? "on" : "off",
    };
  }

  if (kind === "sensor") {
    const unit = entity.attributes?.unit_of_measurement;
    return {
      text: unit ? `${entity.state} ${unit}` : entity.state,
      tone: "off",
    };
  }

  return { text: entity.state, tone: "off" };
}
