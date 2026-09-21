/* Plocha složená z bloků.
 *
 * Tohle je jádro úprav dashboardu. Plocha není pevně daná obrazovka, ale
 * seznam bloků. Každý blok se dá přesunout, odebrat a přidat. Bloky, které
 * drží zařízení, se navíc skládají po jednotlivých dlaždicích.
 *
 * Když správce nic neupravil, použije se výchozí sestava pro zvolenou
 * podobu plochy. Každá podoba má svůj motiv, ne jen jiné pořadí.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { mrizkaZarizeni } from "./favorites.js";
import { icon } from "./icons.js";
import { h, button, closeDialog, dialog, emptyState, toast } from "./ui.js";

/* ------------------------------------------------------------------ */
/* Definice bloků                                                      */
/* ------------------------------------------------------------------ */

/* Každý blok umí vykreslit sebe. Když nemá co ukázat, vrátí null a na
   ploše po něm nezůstane prázdné místo - kromě režimu úprav, kde musí
   být vidět, aby se s ním dalo hnout. */
export const BLOKY = {
  clock: { glyf: "home", render: (ctx) => hodiny(ctx) },
  status: { glyf: "lighting", render: (ctx) => stavDomu(ctx) },
  alerts: { glyf: "security", render: (ctx) => upozorneni(ctx) },
  open: { glyf: "window", render: (ctx) => otevrene(ctx) },
  playing: { glyf: "media", render: (ctx) => prehravac(ctx) },
  lights: { glyf: "lighting", render: (ctx) => rozsvicena(ctx) },
  scenes: { glyf: "scenes", render: (ctx) => sceny(ctx) },
  rooms: { glyf: "rooms", render: (ctx) => mistnosti(ctx) },
  actions: { glyf: "home", render: (ctx) => rychleAkce(ctx) },
  entities: {
    glyf: "devices",
    render: (ctx, blok, ulozit) => zarizeni(ctx, blok, ulozit),
  },
};

/* Co jde přidat. Pořadí je pořadí v nabídce. */
export const NABIDKA = [
  "entities",
  "scenes",
  "rooms",
  "lights",
  "playing",
  "open",
  "alerts",
  "status",
  "clock",
  "actions",
];

/* Bloky, které mají smysl jen jednou. */
const JEDNOU = new Set(["clock", "status", "rooms", "actions"]);

/* ------------------------------------------------------------------ */
/* Výchozí sestavy                                                     */
/* ------------------------------------------------------------------ */

/**
 * Výchozí sestava pro danou podobu plochy.
 *
 * Každá podoba má jiný motiv, ne jen jiné pořadí bloků:
 * - prehled   velké dlaždice a rychlé akce, málo textu
 * - mistnosti hustší a technické, všechno na jedné ploše
 * - funkce    hodně prázdna, velké dlaždice po skupinách
 * - panel     hodiny a stav velkým písmem, čitelné z dálky
 */
export function vychozi(preset, model) {
  const oblibene = (model.favorites || []).map((e) => e.ref || e.id);

  if (preset === "panel") {
    return [
      { id: "b1", type: "clock" },
      { id: "b2", type: "alerts" },
      { id: "b3", type: "open" },
      { id: "b4", type: "playing" },
      { id: "b5", type: "lights" },
      { id: "b6", type: "entities", title: t.home.favorites, entities: oblibene },
      { id: "b7", type: "rooms" },
    ];
  }

  if (preset === "mistnosti" || preset === "funkce") {
    return [
      { id: "b1", type: "status" },
      { id: "b2", type: "alerts" },
      { id: "b3", type: "rooms" },
    ];
  }

  return [
    { id: "b1", type: "status" },
    { id: "b2", type: "alerts" },
    { id: "b3", type: "entities", title: t.home.favorites, entities: oblibene },
    { id: "b4", type: "scenes" },
    { id: "b5", type: "actions" },
  ];
}

/* ------------------------------------------------------------------ */
/* Vykreslení plochy                                                   */
/* ------------------------------------------------------------------ */

export function vykreslitPlochu(root, ctx) {
  const preset = ctx.model.preset || "prehled";
  const bloky = ctx.model.blocks?.length
    ? ctx.model.blocks
    : vychozi(preset, ctx.model);

  const plocha = h("div", { class: `plocha plocha--${preset}` });
  root.append(plocha);

  const ulozit = (nove) => ulozitBloky(ctx, nove);

  for (const blok of bloky) {
    const prvek = jedenBlok(ctx, blok, bloky, ulozit);
    if (prvek) plocha.append(prvek);
  }

  if (ctx.editing) {
    plocha.append(pridatBlok(ctx, bloky, ulozit));
    povolitPretahovani(plocha, (poradi) => {
      const podleId = new Map(bloky.map((b) => [b.id, b]));
      ulozit(poradi.map((id) => podleId.get(id)).filter(Boolean));
    });
  } else if (!plocha.children.length) {
    plocha.append(emptyState(t.editor.emptyBoard));
  }
}

function jedenBlok(ctx, blok, bloky, ulozit) {
  const definice = BLOKY[blok.type];
  if (!definice) return null;

  let obsah = null;
  try {
    obsah = definice.render(ctx, blok, (novy) =>
      ulozit(bloky.map((b) => (b.id === blok.id ? novy : b))),
    );
  } catch (error) {
    console.error("[Smarthome4u] Blok se nevykreslil:", blok.type, error);
    obsah = ctx.editing ? emptyState(t.editor.blockFailed) : null;
  }

  // Mimo úpravy nemá smysl ukazovat prázdný rámeček.
  if (!obsah && !ctx.editing) return null;

  if (!ctx.editing) return obsah;

  const obal = h("div", { class: "blok" }, [
    h("div", { class: "blok__lista" }, [
      h("span", { class: "dnd__uchyt", text: "⠿" }),
      h("span", { class: "blok__jmeno", text: blok.title || t.blocks[blok.type] }),
      h("button", {
        class: "blok__akce",
        type: "button",
        text: "✕",
        "aria-label": t.editor.removeBlock,
        onclick: () => ulozit(bloky.filter((b) => b.id !== blok.id)),
      }),
    ]),
    obsah || emptyState(t.editor.blockEmpty),
  ]);

  obal.setAttribute(ATRIBUT_KLICE, blok.id);
  obal.setAttribute("data-dnd-handle", "");
  return obal;
}

function pridatBlok(ctx, bloky, ulozit) {
  return h(
    "button",
    {
      class: "blok blok--pridat",
      type: "button",
      onclick: () => nabidnoutBloky(ctx, bloky, ulozit),
    },
    [
      h("span", { class: "card__plus", text: "+" }),
      h("span", { class: "card__name", text: t.editor.addBlock }),
    ],
  );
}

function nabidnoutBloky(ctx, bloky, ulozit) {
  const pouzite = new Set(bloky.map((b) => b.type));
  const seznam = h("div", { class: "stack" });

  for (const typ of NABIDKA) {
    if (JEDNOU.has(typ) && pouzite.has(typ)) continue;

    seznam.append(
      h(
        "button",
        {
          class: "tile tile--volba",
          type: "button",
          onclick: () => {
            closeDialog();
            ulozit([...bloky, novyBlok(typ)]);
          },
        },
        [
          h("span", { class: "tile__glyph" }, icon(BLOKY[typ].glyf)),
          h("span", { class: "tile__body" }, [
            h("span", { class: "tile__name", text: t.blocks[typ] }),
            h("span", { class: "tile__state", text: t.blocksHint[typ] || "" }),
          ]),
        ],
      ),
    );
  }

  if (!seznam.children.length) {
    seznam.append(emptyState(t.editor.allBlocksUsed));
  }

  dialog(t.editor.addBlock, seznam);
}

function novyBlok(typ) {
  const blok = { id: "b" + Date.now().toString(36), type: typ };
  if (typ === "entities") {
    blok.title = t.blocks.entities;
    blok.entities = [];
  }
  return blok;
}

async function ulozitBloky(ctx, bloky) {
  try {
    await api.saveDashboard(ctx.model.preset || "prehled", bloky);
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

/* ------------------------------------------------------------------ */
/* Společné                                                            */
/* ------------------------------------------------------------------ */

function ramec(nadpis, glyf, obsah, trida) {
  if (!obsah) return null;
  return h("section", { class: ("panel " + (trida || "")).trim() }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon(glyf)),
      h("h2", { class: "panel__title", text: nadpis }),
    ]),
    obsah,
  ]);
}

function mrizkaKaret(entities) {
  if (!entities || !entities.length) return null;
  return h("div", { class: "cards" }, entities.map((e) => card(e)));
}

/* ------------------------------------------------------------------ */
/* Jednotlivé bloky                                                    */
/* ------------------------------------------------------------------ */

function hodiny() {
  const cas = h("span", { class: "panelh__cas" });
  const datum = h("span", { class: "panelh__datum" });

  function prekreslit() {
    const ted = new Date();
    cas.textContent = ted.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
    datum.textContent = ted.toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  prekreslit();

  // Hodiny se samy zastaví, jakmile zmizí ze stránky.
  const tik = setInterval(() => {
    if (!cas.isConnected) {
      clearInterval(tik);
      return;
    }
    prekreslit();
  }, 15000);

  return h("section", { class: "panelh" }, [
    h("div", { class: "panelh__cas-blok" }, [cas, datum]),
  ]);
}

function stavDomu(ctx) {
  const souhrn = ctx.model.summary || {};

  return h("section", { class: "panel stav" }, [
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
  ]);
}

function veta(glyf, text, zvyraznit) {
  return h(
    "div",
    { class: "stav__radek" + (zvyraznit ? " stav__radek--on" : "") },
    [
      h("span", { class: "stav__glyf" }, icon(glyf)),
      h("span", { class: "stav__text", text }),
    ],
  );
}

function upozorneni(ctx) {
  return ramec(
    t.home.alerts,
    "security",
    mrizkaKaret(ctx.model.summary && ctx.model.summary.alerts),
    "panel--alert",
  );
}

function otevrene(ctx) {
  return ramec(
    t.panel.open,
    "window",
    mrizkaKaret(ctx.model.attention),
    "panel--warn",
  );
}

function prehravac(ctx) {
  const hrajici = ctx.model.nowPlaying || [];
  if (!hrajici.length) return null;

  return ramec(
    t.panel.nowPlaying,
    "media",
    h(
      "div",
      { class: "stack" },
      hrajici.map((entity) =>
        h("div", { class: "hraje" }, [
          h("span", { class: "hraje__jmeno", text: entity.name }),
          h("span", {
            class: "hraje__skladba",
            text: (entity.attributes && entity.attributes.media_title) || "",
          }),
        ]),
      ),
    ),
  );
}

function rozsvicenaSvetla(ctx) {
  return ctx
    .allEntities()
    .filter((e) => e.capability && e.capability.kind === "light" && e.state === "on");
}

function rozsvicena(ctx) {
  const svitici = rozsvicenaSvetla(ctx);
  if (!svitici.length) return null;

  return ramec(
    t.panel.lightsOn,
    "lighting",
    h("div", { class: "stack" }, [
      mrizkaKaret(svitici),
      h("div", { class: "row" }, [
        button(t.home.allLightsOff, () => zhasnoutVse(svitici)),
      ]),
    ]),
  );
}

async function zhasnoutVse(svetla) {
  if (!svetla.length) {
    toast(t.status.allLightsOff);
    return;
  }
  try {
    await Promise.all(svetla.map((e) => api.action(e.id, "turn_off")));
    toast(t.home.turnedOff(svetla.length));
  } catch (error) {
    toast(error.message, true);
  }
}

function sceny(ctx) {
  return ramec(t.scenes.scenes, "scenes", mrizkaKaret(ctx.model.scenes));
}

function mistnosti(ctx) {
  const souhrny = ctx.model.roomSummaries || [];
  if (!souhrny.length) return null;

  return ramec(
    t.nav.rooms,
    "rooms",
    h(
      "div",
      { class: "cards cards--rooms" },
      souhrny.map((souhrn) =>
        h(
          "button",
          {
            class: "card card--room" + (souhrn.lightsOn ? " card--on" : ""),
            type: "button",
            onclick: () => ctx.navigate("rooms"),
          },
          [
            h("span", { class: "card__icon" }, icon("rooms")),
            h("span", {
              class: "card__name",
              text: souhrn.name || t.rooms.unassigned,
            }),
            h("span", {
              class: "card__state",
              text:
                souhrn.temperature === null || souhrn.temperature === undefined
                  ? t.rooms.deviceTotal(souhrn.count)
                  : souhrn.temperature + " °C",
            }),
          ],
        ),
      ),
    ),
  );
}

function rychleAkce(ctx) {
  return ramec(
    t.home.quickActions,
    "home",
    h("div", { class: "row" }, [
      button(t.home.allLightsOff, () => zhasnoutVse(rozsvicenaSvetla(ctx))),
      button(t.nav.rooms, () => ctx.navigate("rooms"), "button--ghost"),
    ]),
  );
}

function zarizeni(ctx, blok, ulozitBlok) {
  const ids = blok.entities || [];
  if (!ids.length && !ctx.editing) return null;

  return ramec(
    blok.title || t.blocks.entities,
    "devices",
    h("div", { class: "stack" }, [
      ctx.editing && h("p", { class: "muted", text: t.favorites.hint }),
      mrizkaZarizeni(ctx, ids, (nove) =>
        ulozitBlok({ ...blok, entities: nove }),
      ),
    ]),
  );
}
