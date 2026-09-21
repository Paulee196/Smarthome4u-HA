/* Domů - co se děje v domě právě teď.
 *
 * Záměrně tu NENÍ výpis všech zařízení. Nejčastější chyba v podobných
 * rozhraních je, že každá entita skončí jako karta a za měsíc je z toho
 * jedna nekonečná stránka, ve které se nedá nic najít.
 *
 * Běžný člen domácnosti potřebuje jen pár věcí: svítí někde, je zamčeno,
 * je něco otevřené, a rychle sáhnout na to, co používá denně. Zbytek se
 * hledá v místnostech.
 *
 * Původní popis:
 *
 * Podobu volí správce v nastavení. Rozvržení jde upravit přetažením.
 * Členění na funkce je princip převzatý z instalačních systémů, ne jejich
 * vizuální kopie.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { renderFloorplan } from "./view-floorplan.js";
import { renderPanel } from "./view-panel.js";
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

export async function renderHome(root, ctx) {
  const model = ctx.model;
  const preset = model.preset || "prehled";

  if (preset === "pudorys") {
    if (ctx.editing) pridat(root, listaUprav(ctx));
    await renderFloorplan(root, ctx);
    return;
  }

  if (ctx.editing) {
    pridat(root, listaUprav(ctx));
  }

  if (preset === "panel" && !ctx.editing) {
    renderPanel(root, ctx);
    return;
  }

  if (preset === "prehled" && !ctx.editing) {
    prehled(root, ctx);
    return;
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
  // V úpravách je úchytem celá dlaždice, jako ikona na telefonu.
  const obal = h("div", { class: "card card--edit", "data-dnd-handle": "" }, [
    h("span", {
      class: "dnd__uchyt",
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

/* ------------------------------------------------------------------ */
/* Přehled                                                             */
/* ------------------------------------------------------------------ */

function prehled(root, ctx) {
  const model = ctx.model;
  const souhrn = model.summary || {};

  pridat(root, stavDomu(souhrn), upozorneni(souhrn));

  const oblibene = model.favorites || [];
  if (oblibene.length) {
    root.append(
      blok(t.home.favorites, "scenes", mrizkaKaret(oblibene)),
    );
  } else if (ctx.jeTechnik) {
    root.append(blok(t.home.favorites, "scenes", emptyState(t.home.noFavorites)));
  }

  const sceny = model.scenes || [];
  if (sceny.length) {
    root.append(blok(t.scenes.scenes, "scenes", mrizkaKaret(sceny)));
  }

  root.append(
    blok(
      t.home.quickActions,
      "home",
      h("div", { class: "row" }, [
        button(t.home.allLightsOff, () => zhasnoutVse(model)),
        button(t.nav.rooms, () => ctx.navigate("rooms"), "button--ghost"),
      ]),
    ),
  );
}

function mrizkaKaret(entity) {
  return h("div", { class: "cards" }, entity.map((e) => card(e)));
}

/** Stav domu větami, ne čísly bez kontextu. */
function stavDomu(souhrn) {
  const radky = [
    veta(
      "lighting",
      souhrn.lightsOn
        ? t.status.lightsOn(souhrn.lightsOn, souhrn.lightNames)
        : t.status.allLightsOff,
      Boolean(souhrn.lightsOn),
    ),
    veta(
      "lock",
      souhrn.unlockedCount
        ? t.status.unlocked(souhrn.unlockedCount, souhrn.unlockedNames)
        : t.status.allLocked,
      Boolean(souhrn.unlockedCount),
    ),
    veta(
      "window",
      souhrn.openCount
        ? t.status.open(souhrn.openCount, souhrn.openNames)
        : t.status.allClosed,
      Boolean(souhrn.openCount),
    ),
  ];

  return h("section", { class: "panel stav" }, radky);
}

function veta(glyf, text, zvyraznit) {
  return h(
    "div",
    { class: `stav__radek${zvyraznit ? " stav__radek--on" : ""}` },
    [
      h("span", { class: "stav__glyf" }, icon(glyf)),
      h("span", { class: "stav__text", text }),
    ],
  );
}

function upozorneni(souhrn) {
  if (!souhrn.alerts?.length) return null;

  return h("section", { class: "panel panel--alert" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon("security")),
      h("h2", { class: "panel__title", text: t.home.alerts }),
    ]),
    mrizkaKaret(souhrn.alerts),
  ]);
}

function blok(nadpis, glyf, obsah) {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon(glyf)),
      h("h2", { class: "panel__title", text: nadpis }),
    ]),
    obsah,
  ]);
}
async function zhasnoutVse(model) {
  const lights = model.rooms
    .flatMap((room) => room.entities)
    .filter((entity) => entity.capability?.kind === "light" && entity.state === "on");

  if (!lights.length) {
    toast(t.status.allLightsOff);
    return;
  }

  try {
    await Promise.all(lights.map((entity) => api.action(entity.id, "turn_off")));
    toast(t.home.turnedOff(lights.length));
  } catch (error) {
    toast(error.message, true);
  }
}
