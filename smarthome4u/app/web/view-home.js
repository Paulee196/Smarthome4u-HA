/* Domů - dashboard domácnosti.
 *
 * Dvě podoby stejných dat: podle místností a podle funkcí.
 * Členění na funkce je princip převzatý z instalačních systémů, ne jejich
 * vizuální kopie.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { icon } from "./icons.js";
import { h, button, emptyState, toast } from "./ui.js";

const CATEGORIES = [
  { key: "lighting", kinds: ["light"] },
  { key: "shading", kinds: ["cover"] },
  { key: "comfort", kinds: ["climate", "fan"] },
  { key: "sockets", kinds: ["switch"] },
  { key: "security", kinds: ["lock"], safetyClasses: true },
  { key: "media", kinds: ["media_player"] },
];

const SECURITY_CLASSES = new Set([
  "door",
  "window",
  "garage_door",
  "opening",
  "motion",
  "occupancy",
  "smoke",
  "gas",
  "moisture",
  "safety",
  "problem",
]);

const VIEW_KEY = "sh4u.home.view";

export function renderHome(root, ctx) {
  const model = ctx.model;
  const summary = model.summary || {};

  root.append(introCard());
  root.append(statsRow(summary));

  if (summary.alerts?.length) {
    root.append(
      block(
        t.home.alerts,
        h(
          "div",
          { class: "cards" },
          summary.alerts.map((entity) => card(entity)),
        ),
      ),
    );
  }

  root.append(
    h("div", { class: "row" }, [
      button(t.home.allLightsOff, () => turnAllLightsOff(model), "button--ghost"),
    ]),
  );

  if (!model.rooms.length) {
    root.append(emptyState(t.empty.text));
    return;
  }

  const body = h("div", { class: "view" });
  const mode = readMode();

  root.append(modeSwitch(mode, (next) => {
    writeMode(next);
    body.replaceChildren(...buildSections(model, next));
  }));
  root.append(body);

  body.replaceChildren(...buildSections(model, mode));
}

/* ------------------------------------------------------------------ */
/* Přepínač zobrazení                                                  */
/* ------------------------------------------------------------------ */

function readMode() {
  try {
    return localStorage.getItem(VIEW_KEY) === "functions" ? "functions" : "rooms";
  } catch {
    return "rooms";
  }
}

function writeMode(mode) {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    /* Soukromé okno nebo zakázané úložiště - jen se to nezapamatuje. */
  }
}

function modeSwitch(mode, onChange) {
  const wrap = h("div", { class: "segmented", role: "tablist" });

  for (const [key, label] of [
    ["rooms", t.functions.byRooms],
    ["functions", t.functions.byFunctions],
  ]) {
    const item = h("button", {
      class: `segmented__item${mode === key ? " segmented__item--active" : ""}`,
      type: "button",
      role: "tab",
      "aria-selected": String(mode === key),
      text: label,
      onclick: () => {
        if (readMode() === key) return;
        wrap.querySelectorAll(".segmented__item").forEach((node) => {
          node.classList.remove("segmented__item--active");
          node.setAttribute("aria-selected", "false");
        });
        item.classList.add("segmented__item--active");
        item.setAttribute("aria-selected", "true");
        onChange(key);
      },
    });
    wrap.append(item);
  }
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Obsah                                                               */
/* ------------------------------------------------------------------ */

function buildSections(model, mode) {
  return mode === "functions" ? byFunctions(model) : byRooms(model);
}

function byRooms(model) {
  return model.rooms.map((room) =>
    panel(
      room.name || t.rooms.unassigned,
      room.floorName,
      icon("rooms"),
      room.entities,
    ),
  );
}

function byFunctions(model) {
  const all = model.rooms.flatMap((room) => room.entities);
  const sections = [];

  for (const category of CATEGORIES) {
    const items = all.filter((entity) => {
      const kind = entity.capability?.kind;
      if (category.kinds.includes(kind)) return true;
      if (category.safetyClasses && kind === "binary_sensor") {
        return SECURITY_CLASSES.has(entity.deviceClass);
      }
      return false;
    });

    if (items.length) {
      sections.push(
        panel(t.functions[category.key], null, icon(category.key), items),
      );
    }
  }

  return sections.length ? sections : [emptyState(t.empty.text)];
}

function panel(title, subtitle, glyph, entities) {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, glyph),
      h("h2", { class: "panel__title", text: title }),
      subtitle && h("span", { class: "panel__sub", text: subtitle }),
    ]),
    h(
      "div",
      { class: "cards" },
      entities.map((entity) => card(entity)),
    ),
  ]);
}

function block(title, content) {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      h("h2", { class: "panel__title", text: title }),
    ]),
    content,
  ]);
}

/* ------------------------------------------------------------------ */
/* Souhrn a uvítání                                                    */
/* ------------------------------------------------------------------ */

function statsRow(summary) {
  return h("div", { class: "stats" }, [
    stat(summary.lightsOn ?? 0, t.home.lightsOn),
    stat(summary.deviceCount ?? 0, t.home.devices),
    stat(summary.areaCount ?? 0, t.home.rooms),
  ]);
}

function stat(value, label) {
  return h("div", { class: "stat" }, [
    h("span", { class: "stat__value", text: String(value) }),
    h("span", { class: "stat__label", text: label }),
  ]);
}

const INTRO_KEY = "sh4u.intro.done";

function introCard() {
  let done = false;
  try {
    done = localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    done = false;
  }
  if (done) return null;

  const box = h("section", { class: "intro" }, [
    h("h2", { class: "intro__title", text: t.intro.title }),
    h("p", { class: "muted", text: t.intro.text }),
    h("ul", { class: "intro__list" }, [
      h("li", { text: t.intro.step1 }),
      h("li", { text: t.intro.step2 }),
      h("li", { text: t.intro.step3 }),
    ]),
    button(t.intro.dismiss, () => {
      try {
        localStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* nevadí, jen se to příště ukáže znovu */
      }
      box.remove();
    }),
  ]);

  return box;
}

async function turnAllLightsOff(model) {
  const lights = model.rooms
    .flatMap((room) => room.entities)
    .filter((entity) => entity.capability?.kind === "light" && entity.state === "on");

  if (!lights.length) return;

  try {
    await Promise.all(lights.map((entity) => api.action(entity.id, "turn_off")));
  } catch (error) {
    toast(error.message, true);
  }
}
