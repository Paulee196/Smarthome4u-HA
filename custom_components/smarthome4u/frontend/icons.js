/* Vlastní sada ikon.
 *
 * Jedna rodina - stejná tloušťka tahu, stejné zakončení, mřížka 24×24.
 * Žádné převzaté ikony Apple, Google, Tuya ani Loxone.
 *
 * Která ikona se použije, se určuje podle schopnosti a device_class.
 * NIKDY podle názvu entity.
 */

const PATHS = {
  /* Navigace */
  home: "M3 10.6 12 3.5l9 7.1V20a1 1 0 0 1-1 1h-4.5v-6.5h-7V21H4a1 1 0 0 1-1-1z",
  rooms: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  scenes: "M12 3.5 14.2 9l5.8.6-4.4 4 1.3 5.7L12 16.4 7.1 19.3l1.3-5.7-4.4-4L9.8 9z",
  automations: "M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z",
  devices: "M9 2.5v4M15 2.5v4M5.5 6.5h13v7.5a6.5 6.5 0 0 1-13 0zM12 20.5v3",
  settings: "M4 7h6M14 7h6M4 17h2M10 17h10M12 4.5v5M8 14.5v5",

  /* Kategorie funkcí */
  lighting: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.5.5.8 1.2.8 1.9V17h6v-1.5c0-.7.3-1.4.8-1.9A6 6 0 0 0 12 3z",
  shading: "M3 4h18M5 4v7.5h14V4M7.5 8h9M12 11.5V19M9.5 19h5",
  comfort: "M14 14.3V5.5a2 2 0 1 0-4 0v8.8a4 4 0 1 0 4 0zM12 8.5v6.5",
  security: "M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6z",
  sockets: "M9 2.5v4M15 2.5v4M5.5 6.5h13v7.5a6.5 6.5 0 0 1-13 0zM12 20.5v3",
  media: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  camera: "M3 7h4l2-2h6l2 2h4v13H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",

  /* Zařízení */
  light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.5.5.8 1.2.8 1.9V17h6v-1.5c0-.7.3-1.4.8-1.9A6 6 0 0 0 12 3z",
  switch: "M9 2.5v4M15 2.5v4M5.5 6.5h13v7.5a6.5 6.5 0 0 1-13 0zM12 20.5v3",
  cover: "M3 4h18M5 4v7.5h14V4M7.5 8h9M12 11.5V19M9.5 19h5",
  climate: "M14 14.3V5.5a2 2 0 1 0-4 0v8.8a4 4 0 1 0 4 0zM12 8.5v6.5",
  lock: "M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3M5 10.5h14v10.5H5zM12 14.5v3",
  fan: "M12 3.5a4.2 4.2 0 0 1 0 8.4 4.2 4.2 0 0 0 0 8.4M3.5 12a4.2 4.2 0 0 1 8.4 0 4.2 4.2 0 0 0 8.4 0",
  button: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8.5v4",
  number: "M5 9h14M5 15h14M10 4 8 20M16 4l-2 16",
  select: "M7 9.5 12 5l5 4.5M7 14.5 12 19l5-4.5",
  script: "M6.5 3h8l3.5 3.5V21h-11zM9.5 10h5M9.5 14h5M9.5 18h3",
  person: "M12 3.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM5 21v-1.6a5.4 5.4 0 0 1 5.4-5.4h3.2a5.4 5.4 0 0 1 5.4 5.4V21",

  /* Senzory */
  temperature: "M14 14.3V5.5a2 2 0 1 0-4 0v8.8a4 4 0 1 0 4 0z",
  humidity: "M12 3.5s6 6.4 6 10.3a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z",
  illuminance: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19",
  power: "M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z",
  battery: "M3.5 8h14v8h-14zM17.5 11h3v2h-3z",
  sensor: "M4 18a8 8 0 1 1 16 0M12 18l4.5-5.5",

  /* Binární senzory */
  motion: "M12 3.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM5 21v-1.6a5.4 5.4 0 0 1 5.4-5.4h3.2a5.4 5.4 0 0 1 5.4 5.4V21",
  door: "M5 3h11v18H5zM16 3l3 1.5v15L16 21M12.5 12h1",
  window: "M4 4h16v16H4zM12 4v16M4 12h16",
  water: "M12 3.5s6 6.4 6 10.3a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z",
  smoke: "M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l2 3h-15zM10 22.5h4",
};

/* Názvy schopností se liší od názvů sekcí - sjednotíme je. */
PATHS.scene = PATHS.scenes;
PATHS.automation = PATHS.automations;
PATHS.media_player = PATHS.media;
PATHS.presence = PATHS.person;
PATHS.binary_sensor = PATHS.sensor;

/* Ikona podle device_class. Klíč je vždy strojový, nikdy překlad. */
const BY_DEVICE_CLASS = {
  motion: "motion",
  occupancy: "motion",
  presence: "motion",
  door: "door",
  garage_door: "door",
  opening: "door",
  window: "window",
  moisture: "water",
  smoke: "smoke",
  gas: "smoke",
  carbon_monoxide: "smoke",
  safety: "security",
  problem: "security",
  battery: "battery",
  temperature: "temperature",
  humidity: "humidity",
  illuminance: "illuminance",
  power: "power",
  energy: "power",
  outlet: "switch",
};

export function icon(name, className = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", PATHS[name] || PATHS.sensor);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  svg.append(path);
  return svg;
}

/** Vybere ikonu pro entitu podle schopnosti a device_class. */
export function iconFor(entity, className) {
  const kind = entity.capability?.kind;
  const byClass = BY_DEVICE_CLASS[entity.deviceClass];

  if (kind === "sensor" || kind === "binary_sensor") {
    return icon(byClass || "sensor", className);
  }
  if (kind === "switch" && byClass) return icon(byClass, className);

  return icon(PATHS[kind] ? kind : "sensor", className);
}
