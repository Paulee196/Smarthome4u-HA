/* Dlaždice zařízení a panel s ovládáním.
 *
 * Co se dá s entitou dělat, určuje Capability Engine na backendu.
 * Frontend si nikdy nic nedomýšlí podle názvu.
 */

import { api } from "./api.js";
import { t, describeState } from "./i18n.js";
import { iconFor } from "./icons.js";
import {
  h,
  button,
  dialog,
  field,
  numberInput,
  selectInput,
  slider,
  toast,
} from "./ui.js";

/* ------------------------------------------------------------------ */
/* Sledování změn stavu                                                */
/* ------------------------------------------------------------------ */

const watchers = new Map();

export function watch(entityId, update) {
  if (!watchers.has(entityId)) watchers.set(entityId, new Set());
  watchers.get(entityId).add(update);
}

export function clearWatchers() {
  watchers.clear();
}

export function applyStates(entities) {
  for (const entity of entities) {
    const set = watchers.get(entity.id);
    if (set) set.forEach((update) => update(entity));
  }
}

/* ------------------------------------------------------------------ */
/* Co dlaždice udělá po klepnutí                                       */
/* ------------------------------------------------------------------ */

const PRIMARY = {
  light: (e) => ["toggle"],
  switch: () => ["toggle"],
  fan: () => ["toggle"],
  automation: () => ["toggle"],
  scene: () => ["activate"],
  script: () => ["run"],
  button: () => ["press"],
  lock: (e) => [e.state === "locked" ? "unlock" : "lock"],
};

const HAS_DETAIL = new Set([
  "light",
  "cover",
  "climate",
  "fan",
  "lock",
  "number",
  "select",
  "media_player",
]);

function hasExtraControls(entity) {
  const c = entity.capability || {};
  if (!HAS_DETAIL.has(c.kind)) return false;
  if (c.kind === "light") return Boolean(c.dimmable || c.colorTemp || c.color);
  if (c.kind === "fan") return Boolean(c.speed);
  return true;
}

async function send(entity, action, value) {
  try {
    await api.action(entity.id, action, value);
  } catch (error) {
    toast(error.message, true);
  }
}

/* ------------------------------------------------------------------ */
/* Dlaždice                                                            */
/* ------------------------------------------------------------------ */

/** Kolik procent ukázat na proužku pod dlaždicí. Null = bez proužku. */
function levelOf(entity) {
  const c = entity.capability || {};
  const a = entity.attributes || {};

  if (c.kind === "light" && c.dimmable && entity.state === "on") {
    return a.brightness ? Math.round((a.brightness / 255) * 100) : 100;
  }
  if (c.kind === "cover" && typeof a.current_position === "number") {
    return a.current_position;
  }
  if (c.kind === "fan" && typeof a.percentage === "number") return a.percentage;
  return null;
}

/** Dlaždice do mřížky. Ikona, název, stav a případný proužek úrovně. */
export function card(entity) {
  const kind = entity.capability?.kind;
  const primary = PRIMARY[kind];
  const detail = hasExtraControls(entity);
  const interactive = Boolean(primary) || detail;

  const glyph = h("span", { class: "card__icon" }, iconFor(entity, "icon icon--lg"));
  const name = h("span", { class: "card__name", text: entity.name });
  const state = h("span", { class: "card__state" });
  const level = h("span", { class: "card__level" });

  let current = entity;

  const hit = h(
    interactive ? "button" : "div",
    {
      class: "card__hit",
      type: interactive ? "button" : null,
      onclick: interactive
        ? () => {
            if (primary) send(current, ...primary(current));
            else openControls(current);
          }
        : null,
    },
    [glyph, name, state],
  );

  const children = [hit, level];

  if (detail && primary) {
    children.push(
      h("button", {
        class: "card__more",
        type: "button",
        "aria-label": `${entity.name} – ${t.control.value}`,
        text: "⋯",
        onclick: () => openControls(current),
      }),
    );
  }

  const root = h("div", { class: "card" }, children);

  function paint(next) {
    current = next;
    const { text, tone } = describeState(next);

    name.textContent = next.name;
    state.textContent = text;
    root.className = `card card--${tone}`;

    const pct = levelOf(next);
    level.style.width = pct === null ? "0" : `${pct}%`;
    level.hidden = pct === null;

    if (hit.tagName === "BUTTON") {
      hit.disabled = !next.available;
      if (primary) hit.setAttribute("aria-pressed", String(next.state === "on"));
    }
  }

  paint(entity);
  watch(entity.id, paint);
  return root;
}

/** Řádek do seznamu. Používají ho scény, automatizace a správa. */
export function row(entity, extras = []) {
  const kind = entity.capability?.kind;
  const primary = PRIMARY[kind];

  const name = h("span", { class: "tile__name", text: entity.name });
  const state = h("span", { class: "tile__state" });

  let current = entity;

  const main = h(
    primary ? "button" : "div",
    {
      class: "tile__main",
      type: primary ? "button" : null,
      onclick: primary ? () => send(current, ...primary(current)) : null,
    },
    [
      h("span", { class: "tile__glyph" }, iconFor(entity)),
      h("span", { class: "tile__body" }, [name, state]),
    ],
  );

  const root = h("div", { class: "tile" }, [main, ...extras]);

  function paint(next) {
    current = next;
    const { text, tone } = describeState(next);
    name.textContent = next.name;
    state.textContent = text;
    state.className = `tile__state tile__state--${tone}`;
    root.classList.toggle("tile--active", tone === "on");
    if (main.tagName === "BUTTON") main.disabled = !next.available;
  }

  paint(entity);
  watch(entity.id, paint);
  return root;
}

/* ------------------------------------------------------------------ */
/* Panel s ovládáním                                                   */
/* ------------------------------------------------------------------ */

export function openControls(entity) {
  const body = h("div", { class: "controls" });
  const handle = dialog(entity.name, body);

  function render(current) {
    body.replaceChildren(...buildControls(current));
  }

  render(entity);
  watch(entity.id, (next) => {
    if (handle.panel.isConnected) render(next);
  });
}

function buildControls(entity) {
  const c = entity.capability || {};
  const attrs = entity.attributes || {};
  const { text } = describeState(entity);

  const parts = [h("p", { class: "controls__state", text })];

  switch (c.kind) {
    case "light":
      parts.push(onOffRow(entity));
      if (c.dimmable) {
        const pct = attrs.brightness ? Math.round((attrs.brightness / 255) * 100) : 0;
        parts.push(
          labelled(
            t.control.brightness,
            `${pct} %`,
            slider(pct, 1, 100, 1, (v) => send(entity, "brightness", v)),
          ),
        );
      }
      if (c.colorTemp && c.minKelvin && c.maxKelvin) {
        parts.push(
          labelled(
            t.control.colorTemp,
            attrs.color_temp_kelvin ? `${attrs.color_temp_kelvin} K` : "",
            slider(
              attrs.color_temp_kelvin || c.minKelvin,
              c.minKelvin,
              c.maxKelvin,
              50,
              (v) => send(entity, "color_temp", v),
            ),
          ),
        );
      }
      if (c.color) parts.push(colorRow(entity));
      break;

    case "switch":
    case "fan":
      parts.push(onOffRow(entity));
      if (c.speed) {
        parts.push(
          labelled(
            t.control.speed,
            `${attrs.percentage ?? 0} %`,
            slider(attrs.percentage ?? 0, 0, 100, 1, (v) => send(entity, "speed", v)),
          ),
        );
      }
      break;

    case "cover":
      parts.push(
        h("div", { class: "row" }, [
          button(t.control.open, () => send(entity, "open")),
          c.stop && button(t.control.stop, () => send(entity, "stop"), "button--ghost"),
          button(t.control.close, () => send(entity, "close")),
        ]),
      );
      if (c.position) {
        parts.push(
          labelled(
            t.control.position,
            `${attrs.current_position ?? 0} %`,
            slider(attrs.current_position ?? 0, 0, 100, 1, (v) =>
              send(entity, "position", v),
            ),
          ),
        );
      }
      if (c.tilt) {
        parts.push(
          labelled(
            t.control.tilt,
            `${attrs.current_tilt_position ?? 0} %`,
            slider(attrs.current_tilt_position ?? 0, 0, 100, 1, (v) =>
              send(entity, "tilt", v),
            ),
          ),
        );
      }
      break;

    case "climate":
      parts.push(climateRow(entity));
      if (c.hvacModes?.length) {
        const select = selectInput(
          c.hvacModes.map((m) => ({ value: m, label: t.hvac[m] || m })),
          entity.state,
        );
        select.addEventListener("change", () =>
          send(entity, "hvac_mode", select.value),
        );
        parts.push(field(t.control.mode, select));
      }
      if (c.presets?.length) {
        const select = selectInput(
          c.presets.map((p) => ({ value: p, label: p })),
          attrs.preset_mode || "",
        );
        select.addEventListener("change", () => send(entity, "preset", select.value));
        parts.push(field(t.control.preset, select));
      }
      break;

    case "lock":
      parts.push(
        h("div", { class: "row" }, [
          button(t.control.lock, () => send(entity, "lock")),
          button(t.control.unlock, () => send(entity, "unlock"), "button--ghost"),
          c.canOpen &&
            button(t.control.unlatch, () => send(entity, "open"), "button--ghost"),
        ]),
      );
      break;

    case "number": {
      const input = numberInput(
        Number(entity.state) || 0,
        c.min ?? 0,
        c.max ?? 100,
        c.step ?? 1,
      );
      input.addEventListener("change", () =>
        send(entity, "set", Number(input.value)),
      );
      parts.push(field(t.control.value, input));
      break;
    }

    case "select": {
      const select = selectInput(
        (c.options || []).map((o) => ({ value: o, label: o })),
        entity.state,
      );
      select.addEventListener("change", () => send(entity, "set", select.value));
      parts.push(field(t.control.option, select));
      break;
    }

    case "media_player":
      parts.push(
        h("div", { class: "row" }, [
          c.canPlay && button(t.control.playPause, () => send(entity, "play_pause")),
          button(t.control.stop, () => send(entity, "stop"), "button--ghost"),
        ]),
      );
      if (c.volume) {
        parts.push(
          labelled(
            t.control.volume,
            `${Math.round((attrs.volume_level ?? 0) * 100)} %`,
            slider(Math.round((attrs.volume_level ?? 0) * 100), 0, 100, 1, (v) =>
              send(entity, "volume", v / 100),
            ),
          ),
        );
      }
      break;

    default:
      break;
  }

  return parts;
}

function onOffRow(entity) {
  return h("div", { class: "row" }, [
    button(t.state.on, () => send(entity, "turn_on")),
    button(t.state.off, () => send(entity, "turn_off"), "button--ghost"),
  ]);
}

function climateRow(entity) {
  const c = entity.capability;
  const step = c.step || 0.5;
  const target = entity.attributes?.temperature;
  const value = typeof target === "number" ? target : (c.minTemp ?? 20);

  const readout = h("span", { class: "stepper__value", text: `${value} °C` });

  const change = (delta) => {
    const next = Math.min(
      c.maxTemp ?? 35,
      Math.max(c.minTemp ?? 5, Number((value + delta).toFixed(1))),
    );
    send(entity, "temperature", next);
  };

  return h("div", { class: "stepper" }, [
    button("−", () => change(-step), "button--round"),
    readout,
    button("+", () => change(step), "button--round"),
  ]);
}

const PALETTE = [
  [255, 255, 255],
  [255, 214, 170],
  [255, 170, 100],
  [255, 90, 90],
  [255, 170, 220],
  [150, 120, 255],
  [110, 190, 255],
  [120, 230, 170],
];

function colorRow(entity) {
  return h(
    "div",
    { class: "swatches" },
    PALETTE.map((rgb) =>
      h("button", {
        class: "swatch",
        type: "button",
        style: `background: rgb(${rgb.join(",")})`,
        "aria-label": t.control.color,
        onclick: () => send(entity, "color", rgb),
      }),
    ),
  );
}

function labelled(label, value, control) {
  return h("div", { class: "field" }, [
    h("div", { class: "field__row" }, [
      h("span", { class: "field__label", text: label }),
      h("span", { class: "field__value", text: value }),
    ]),
    control,
  ]);
}
