/* Domů - dashboard domácnosti.
 *
 * Podobu volí správce v nastavení. Rozvržení jde upravit přetažením.
 * Členění na funkce je princip převzatý z instalačních systémů, ne jejich
 * vizuální kopie.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { icon, iconFor } from "./icons.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  field,
  selectInput,
  toast,
} from "./ui.js";

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

/** append(null) by do stránky vložil text "null". */
function pridat(root, ...prvky) {
  for (const prvek of prvky) {
    if (prvek) root.append(prvek);
  }
}

export function renderHome(root, ctx) {
  const model = ctx.model;
  const preset = model.preset || "prehled";

  if (ctx.editing) {
    pridat(root, listaUprav(ctx));
  }

  if (!ctx.editing && preset === "prehled") {
    pridat(
      root,
      introCard(),
      statsRow(model.summary || {}),
      upozorneni(model.summary || {}),
      rychleAkce(model),
    );
  }

  if (!model.rooms.length) {
    root.append(emptyState(t.empty.text));
    return;
  }

  const telo = h("div", { class: "view" });
  root.append(telo);

  const sekce =
    preset === "funkce" ? podleFunkci(model, ctx) : podleMistnosti(model, ctx);

  telo.replaceChildren(...sekce);

  if (ctx.editing) {
    zapnoutPretahovaniMistnosti(telo, ctx);
  }
}

/* ------------------------------------------------------------------ */
/* Režim úprav                                                         */
/* ------------------------------------------------------------------ */

function listaUprav(ctx) {
  return h("section", { class: "editbar" }, [
    h("div", { class: "editbar__text" }, [
      h("span", { class: "editbar__title", text: t.editor.title }),
      h("span", { class: "editbar__hint", text: t.editor.hint }),
    ]),
    button(t.editor.done, () => ctx.stopEditing()),
  ]);
}

function zapnoutPretahovaniMistnosti(telo, ctx) {
  povolitPretahovani(telo, async (poradi) => {
    try {
      await api.saveLayout({ rooms: poradi });
      toast(t.editor.saved);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

/** Dlaždice v režimu úprav - nespíná, jen se přetahuje a schovává. */
function upravitelnaDlazdice(entity, ctx) {
  const obal = h("div", { class: "card card--edit" }, [
    h("span", {
      class: "dnd__uchyt",
      "data-dnd-handle": "",
      "aria-label": t.editor.drag,
      text: "⠿",
    }),
    h("div", { class: "card__hit" }, [
      h("span", { class: "card__icon" }, iconFor(entity, "icon icon--lg")),
      h("span", { class: "card__name", text: entity.name }),
      h("span", {
        class: "card__state",
        text: t.editor.kinds[entity.capability?.kind] || "",
      }),
    ]),
    h("button", {
      class: "card__more card__more--danger",
      type: "button",
      "aria-label": t.editor.hide,
      text: "✕",
      onclick: () => schovat(entity, ctx),
    }),
    h("button", {
      class: "card__more card__more--left",
      type: "button",
      "aria-label": t.editor.reclassify,
      text: "⇄",
      onclick: () => zmenitTyp(entity, ctx),
    }),
    h("button", {
      class: "card__more card__more--mid",
      type: "button",
      "aria-label": t.editor.size,
      text: "⤢",
      onclick: () => zmenitVelikost(entity, ctx),
    }),
  ]);

  obal.setAttribute(ATRIBUT_KLICE, entity.id);
  return obal;
}

/* Velikost se přepíná dokola, ať se nemusí otevírat další dialog. */
const VELIKOSTI = ["", "wide", "tall", "big"];

async function zmenitVelikost(entity, ctx) {
  const dalsi =
    VELIKOSTI[(VELIKOSTI.indexOf(entity.size || "") + 1) % VELIKOSTI.length];

  try {
    await api.saveLayout({ entityId: entity.id, size: dalsi });
    toast(t.editor.sizes[dalsi || "normal"]);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

async function schovat(entity, ctx) {
  try {
    await api.classify(entity.id, { hidden: true });
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

function zmenitTyp(entity, ctx) {
  const volby = [
    { value: "", label: t.editor.keepAsIs },
    ...Object.entries(t.editor.kinds).map(([value, label]) => ({
      value,
      label,
    })),
  ];
  const vyber = selectInput(volby, entity.overridden ? entity.capability.kind : "");

  dialog(
    entity.name,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.editor.reclassifyHint }),
      field(t.editor.kind, vyber),
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, async () => {
        try {
          await api.classify(entity.id, { kind: vyber.value || null });
          closeDialog();
          toast(t.notice.saved);
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Obsah                                                               */
/* ------------------------------------------------------------------ */

function podleMistnosti(model, ctx) {
  return model.rooms.map((room) =>
    panel(
      room.id,
      room.name || t.rooms.unassigned,
      room.floorName,
      icon("rooms"),
      room.entities,
      ctx,
    ),
  );
}

function podleFunkci(model, ctx) {
  const vse = model.rooms.flatMap((room) => room.entities);
  const sekce = [];

  for (const category of CATEGORIES) {
    const items = vse.filter((entity) => {
      const kind = entity.capability?.kind;
      if (category.kinds.includes(kind)) return true;
      if (category.safetyClasses && kind === "binary_sensor") {
        return SECURITY_CLASSES.has(entity.deviceClass);
      }
      return false;
    });

    if (items.length) {
      sekce.push(
        panel(
          category.key,
          t.functions[category.key],
          null,
          icon(category.key),
          items,
          ctx,
        ),
      );
    }
  }

  return sekce.length ? sekce : [emptyState(t.empty.text)];
}

function panel(klic, title, subtitle, glyph, entities, ctx) {
  const mrizka = h(
    "div",
    { class: "cards" },
    entities.map((entity) =>
      ctx.editing ? upravitelnaDlazdice(entity, ctx) : card(entity),
    ),
  );

  const sekce = h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      ctx.editing &&
        h("span", {
          class: "dnd__uchyt",
          "data-dnd-handle": "",
          "aria-label": t.editor.drag,
          text: "⠿",
        }),
      h("span", { class: "panel__glyph" }, glyph),
      h("h2", { class: "panel__title", text: title }),
      subtitle && h("span", { class: "panel__sub", text: subtitle }),
    ]),
    mrizka,
  ]);

  if (klic) sekce.setAttribute(ATRIBUT_KLICE, klic);

  if (ctx.editing) {
    povolitPretahovani(mrizka, async (poradi) => {
      try {
        await api.saveLayout({ areaId: klic || "", entities: poradi });
        toast(t.editor.saved);
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  return sekce;
}

/* ------------------------------------------------------------------ */
/* Souhrn, upozornění a rychlé akce                                    */
/* ------------------------------------------------------------------ */

function upozorneni(summary) {
  if (!summary.alerts?.length) return null;

  return h("section", { class: "panel panel--alert" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon("security")),
      h("h2", { class: "panel__title", text: t.home.alerts }),
    ]),
    h(
      "div",
      { class: "cards" },
      summary.alerts.map((entity) => card(entity)),
    ),
  ]);
}

function rychleAkce(model) {
  return h("div", { class: "row" }, [
    button(t.home.allLightsOff, () => zhasnoutVse(model), "button--ghost"),
  ]);
}

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

async function zhasnoutVse(model) {
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
