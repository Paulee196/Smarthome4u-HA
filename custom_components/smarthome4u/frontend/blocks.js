/* Plocha složená z bloků.
 *
 * Tohle je jádro úprav dashboardu. Plocha není pevně daná obrazovka, ale
 * mřížka o několika sloupcích a v ní bloky. Každý blok se dá přesunout,
 * odebrat, přejmenovat a roztáhnout přes víc sloupců. Bloky, které drží
 * zařízení, se navíc skládají po jednotlivých dlaždicích.
 *
 * Když správce nic neupravil, použije se výchozí sestava pro zvolenou
 * podobu plochy.
 */

import { api } from "./api.js";
import { editBlockAppearance } from "./appearance.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { mrizkaZarizeni } from "./favorites.js";
import { icon } from "./icons.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  toast,
} from "./ui.js";

/* Sloupce plochy. Víc než čtyři se nevejdou ani na velkou obrazovku. */
export const MAX_SLOUPCU = 4;

/* ------------------------------------------------------------------ */
/* Definice bloků                                                      */
/* ------------------------------------------------------------------ */

/* Každý blok umí vykreslit sebe. Když nemá co ukázat, vrátí null a na
   ploše po něm nezůstane prázdné místo - kromě režimu úprav, kde musí
   být vidět, aby se s ním dalo hnout. */
export const BLOKY = {
  headline: { glyf: "home", render: (ctx, blok) => nadpisPlochy(ctx, blok) },
  clock: { glyf: "home", render: (ctx) => hodiny(ctx) },
  status: { glyf: "lighting", render: (ctx) => stavDomu(ctx) },
  metric: { glyf: "lighting", render: (ctx, blok) => metrika(ctx, blok) },
  alerts: { glyf: "security", render: (ctx, blok, ulozit) => upozorneni(ctx, blok, ulozit) },
  open: { glyf: "window", render: (ctx, blok, ulozit) => otevrene(ctx, blok, ulozit) },
  playing: { glyf: "media", render: (ctx) => prehravac(ctx) },
  lights: { glyf: "lighting", render: (ctx, blok, ulozit) => rozsvicena(ctx, blok, ulozit) },
  scenes: { glyf: "scenes", render: (ctx, blok, ulozit) => sceny(ctx, blok, ulozit) },
  rooms: { glyf: "rooms", render: (ctx) => mistnosti(ctx) },
  actions: { glyf: "home", render: (ctx) => rychleAkce(ctx) },
  entities: {
    glyf: "devices",
    render: (ctx, blok, ulozit) => zarizeni(ctx, blok, ulozit),
  },
  room: {
    glyf: "rooms",
    render: (ctx, blok, ulozit) => zarizeni(ctx, blok, ulozit),
  },
};

/* Co jde přidat. Pořadí je pořadí v nabídce. */
export const NABIDKA = [
  "headline",
  "entities",
  "room",
  "metric",
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
 * - prehled  dva sloupce, stav domu a vlastní zařízení přes celou šířku,
 *            scény a rychlé akce vedle sebe
 * - panel    hodiny přes celou šířku, pod nimi co se právě děje,
 *            velké písmo, čitelné z dálky
 */
export function vychozi(preset, model) {
  const oblibene = (model.favorites || []).map((e) => e.ref || e.id);
  const druhy = new Set(["light", "switch", "cover", "climate", "lock", "camera", "fan", "media_player"]);
  const navrh = (model.rooms || []).flatMap((room) => room.entities || [])
    .filter((e) => druhy.has(e.capability?.kind) && e.available)
    .slice(0, 8).map((e) => e.ref || e.id);
  const vybrane = oblibene.length ? oblibene : navrh;

  if (preset === "tuya") {
    return {
      columns: 3,
      blocks: [
        { id: "tuya-headline", type: "headline", cols: 3,
          title: t.dashboardIntro.tuya.title,
          subtitle: t.dashboardIntro.tuya.description, icon: "home" },
        { id: "tuya-scenes", type: "scenes", cols: 3 },
        { id: "tuya-devices", type: "entities", title: t.blocks.entities,
          entities: vybrane, cols: 3 },
      ],
    };
  }

  if (preset === "home") {
    const rooms = (model.rooms || []).filter((room) => room.entities?.length).slice(0, 20);
    return {
      columns: 2,
      blocks: [
        { id: "home-headline", type: "headline", cols: 2,
          title: t.dashboardIntro.home.title,
          subtitle: t.dashboardIntro.home.description, icon: "rooms" },
        ...rooms.map((room, index) => ({
          id: `home-room-${index}`, type: "room", title: room.name || t.rooms.unassigned,
          entities: (room.entities || []).filter((e) =>
            (e.capability?.controllable || e.capability?.kind === "camera") && e.available)
            .slice(0, 12).map((e) => e.ref || e.id),
          cols: 1,
        })),
        ...(!rooms.length ? [{ id: "home-devices", type: "room", title: t.home.favorites,
          entities: vybrane, cols: 2 }] : []),
      ],
    };
  }

  if (preset === "pudorys") {
    return {
      columns: 2,
      blocks: [
        { id: "plan-headline", type: "headline", title: t.dashboardIntro.pudorys.title,
          subtitle: t.dashboardIntro.pudorys.description, icon: "home", cols: 2 },
        ...(model.rooms || []).filter((room) => room.entities?.length)
        .slice(0, 29).map((room) => ({
          id: `plan-${String(room.id).slice(0, 35)}`, type: "room", roomId: String(room.id),
          title: room.name || t.rooms.unassigned,
          entities: (room.entities || []).filter((entity) =>
            entity.capability?.controllable || entity.capability?.kind === "camera")
            .slice(0, 16).map((entity) => entity.ref || entity.id),
        })),
      ],
    };
  }

  return {
    columns: 3,
    blocks: [
      { id: "overview-headline", type: "headline", cols: 3,
        title: t.dashboardIntro.prehled.title,
        subtitle: t.dashboardIntro.prehled.description, icon: "home" },
      { id: "overview-lights-count", type: "metric", metric: "lightsOn",
        title: t.metrics.lightsOn, icon: "lighting", color: "amber" },
      { id: "overview-open-count", type: "metric", metric: "openCount",
        title: t.metrics.openCount, icon: "window", color: "blue" },
      { id: "overview-lock-count", type: "metric", metric: "unlockedCount",
        title: t.metrics.unlockedCount, icon: "lock", color: "mint" },
      { id: "overview-alerts", type: "alerts", cols: 2 },
      { id: "overview-open", type: "open" },
      { id: "overview-lights", type: "lights", cols: 2 },
      { id: "overview-clock", type: "clock" },
      { id: "overview-actions", type: "actions", cols: 3 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Vykreslení plochy                                                   */
/* ------------------------------------------------------------------ */

export function vykreslitPlochu(root, ctx) {
  const preset = ctx.model.preset || "tuya";
  const sestava = ctx.model.board?.blocks
    ? ctx.model.board
    : vychozi(preset, ctx.model);

  const sloupce = Math.min(MAX_SLOUPCU, Math.max(1, sestava.columns || 1));
  const bloky = sestava.blocks;

  const ulozit = (nove) =>
    ulozitSestavu(ctx, { columns: sloupce, ...nove, blocks: nove.blocks || bloky });

  if (ctx.editing) {
    root.append(listaSloupcu(sloupce, (n) => ulozit({ columns: n })));
  }

  const plocha = h("div", { class: "plocha plocha--" + preset });
  plocha.style.setProperty("--sloupce", String(sloupce));
  root.append(plocha);

  for (const blok of bloky) {
    const prvek = jedenBlok(ctx, blok, bloky, sloupce, (b) => ulozit({ blocks: b }));
    if (prvek) plocha.append(prvek);
  }

  if (ctx.editing) {
    plocha.append(pridatBlok(ctx, bloky, (b) => ulozit({ blocks: b })));
    povolitPretahovani(plocha, (poradi) => {
      const podleId = new Map(bloky.map((b) => [b.id, b]));
      ulozit({ blocks: poradi.map((id) => podleId.get(id)).filter(Boolean) });
    });
  } else if (!plocha.children.length) {
    plocha.append(emptyState(t.editor.emptyBoard));
  }
}

/* Přepínač počtu sloupců. Na telefonu je vždy jeden, tohle platí od
   šířky tabletu. */
function listaSloupcu(sloupce, onZmena) {
  return h("section", { class: "editbar editbar--tichy" }, [
    h("div", { class: "editbar__text" }, [
      h("span", { class: "editbar__title", text: t.editor.columns }),
      h("span", { class: "editbar__hint", text: t.editor.columnsHint }),
    ]),
    h(
      "div",
      { class: "segmented" },
      [1, 2, 3, 4].map((n) =>
        h("button", {
          class: "segmented__item" + (n === sloupce ? " segmented__item--active" : ""),
          type: "button",
          text: String(n),
          "aria-pressed": String(n === sloupce),
          onclick: () => n !== sloupce && onZmena(n),
        }),
      ),
    ),
  ]);
}

function jedenBlok(ctx, blok, bloky, sloupce, ulozit) {
  const definice = BLOKY[blok.type];
  if (!definice) return null;

  const sirka = Math.min(sloupce, Math.max(1, blok.cols || 1));
  const nahradit = (novy) => ulozit(bloky.map((b) => (b.id === blok.id ? novy : b)));

  let obsah = null;
  try {
    obsah = definice.render(ctx, blok, nahradit);
  } catch (error) {
    console.error("[Smarthome4u] Blok se nevykreslil:", blok.type, error);
    obsah = ctx.editing ? emptyState(t.editor.blockFailed) : null;
  }

  // Mimo úpravy nemá smysl ukazovat prázdný rámeček.
  if (!obsah && !ctx.editing) return null;

  if (obsah) {
    const tone = ["mint", "blue", "violet", "amber", "rose"].includes(blok.color)
      ? blok.color : "default";
    obsah.classList.add("dashboard-block", "dashboard-block--" + tone,
      "dashboard-block--" + (blok.height || "normal"),
      "dashboard-block--type-" + blok.type);
    const title = obsah.querySelector(".panel__title");
    if (title && blok.title) title.textContent = blok.title;
    const glyph = obsah.querySelector(".panel__glyph");
    if (glyph && blok.icon) glyph.replaceChildren(icon(blok.icon));
  }

  if (!ctx.editing) {
    obsah.style.setProperty("--sirka", String(sirka));
    obsah.classList.add("plocha__blok");
    return obsah;
  }

  const obal = h("div", { class: "blok plocha__blok" }, [
    h("div", { class: "blok__lista" }, [
      h("button", {
        class: "dnd__uchyt", type: "button", "data-dnd-handle": "",
        "aria-label": `${t.editor.drag}: ${blok.title || t.blocks[blok.type]}`,
        text: "⠿",
      }),
      h("button", {
        class: "blok__jmeno",
        type: "button",
        text: blok.title || t.blocks[blok.type],
        title: t.editor.blockAppearance,
        onclick: () => editBlockAppearance(blok, nahradit, NABIDKA),
      }),
      h("button", {
        class: "blok__akce",
        type: "button",
        text: t.editor.width(sirka, sloupce),
        title: t.editor.widthHint,
        // Cyklí 1 → 2 → … → sloupce → 1.
        onclick: () => nahradit({ ...blok, cols: (sirka % sloupce) + 1 }),
      }),
      h("button", {
        class: "blok__akce blok__akce--danger",
        type: "button",
        text: "✕",
        "aria-label": t.editor.removeBlock,
        onclick: () => ulozit(bloky.filter((b) => b.id !== blok.id)),
      }),
    ]),
    obsah || emptyState(t.editor.blockEmpty),
  ]);

  obal.style.setProperty("--sirka", String(sirka));
  obal.setAttribute(ATRIBUT_KLICE, blok.id);
  return obal;
}

function pridatBlok(ctx, bloky, ulozit) {
  return h(
    "button",
    {
      class: "blok blok--pridat plocha__blok",
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
  if (typ === "entities" || typ === "room") {
    blok.title = t.blocks[typ];
    blok.entities = [];
  }
  if (typ === "metric") {
    blok.metric = "lightsOn";
    blok.title = t.metrics.lightsOn;
  }
  return blok;
}

async function ulozitSestavu(ctx, sestava) {
  try {
    await api.saveDashboard(
      ctx.model.preset || "tuya",
      sestava.columns,
      sestava.blocks,
    );
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

function mrizkaKaret(entities, ctx, blok, ulozit) {
  if (!entities || !entities.length) return null;
  if (ctx?.editing && blok && ulozit) {
    const vyber = { ...blok, entities: entities.map((e) => ctx.entityRef(e)) };
    return h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.editor.automaticTilesHint }),
      mrizkaZarizeni(ctx, vyber, (zmena) => ulozit({
        ...zmena, type: "entities", title: blok.title || t.blocks[blok.type],
      })),
    ]);
  }
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
    h("h2", { class: "panel__title", text: t.blocks.clock }),
    h("div", { class: "panelh__cas-blok" }, [cas, datum]),
  ]);
}

function nadpisPlochy(ctx, blok) {
  const preset = ctx.model.preset || "tuya";
  const defaults = t.dashboardIntro[preset] || t.dashboardIntro.tuya;
  return h("header", { class: `dashboard-intro dashboard-intro--${preset}` }, [
    h("span", { class: "experience__eyebrow", text: defaults.eyebrow }),
    h("span", { class: "dashboard-intro__glyph panel__glyph" }, icon(blok.icon || "home")),
    h("h2", { class: "panel__title", text: blok.title || defaults.title }),
    h("p", { text: blok.subtitle === undefined ? defaults.description : blok.subtitle }),
  ]);
}

function stavDomu(ctx) {
  const souhrn = ctx.model.summary || {};

  return ramec(t.blocks.status, "home", h("div", { class: "stav" }, [
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
  ]));
}

function metrika(ctx, blok) {
  const summary = ctx.model.summary || {};
  const values = {
    lightsOn: summary.lightsOn || 0,
    openCount: summary.openCount || 0,
    unlockedCount: summary.unlockedCount || 0,
    rooms: (ctx.model.roomSummaries || []).length,
    devices: ctx.allEntities().length,
  };
  const metric = Object.hasOwn(values, blok.metric) ? blok.metric : "lightsOn";
  return h("section", { class: "metric-card" }, [
    h("span", { class: "metric-card__icon panel__glyph" }, icon(blok.icon || "lighting")),
    h("strong", { class: "metric-card__value", text: String(values[metric]) }),
    h("span", { class: "metric-card__label panel__title", text: blok.title || t.metrics[metric] }),
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

function upozorneni(ctx, blok, ulozit) {
  return ramec(
    t.home.alerts,
    "security",
    mrizkaKaret(ctx.model.summary && ctx.model.summary.alerts, ctx, blok, ulozit),
    "panel--alert",
  );
}

function otevrene(ctx, blok, ulozit) {
  return ramec(
    t.panel.open,
    "window",
    mrizkaKaret(ctx.model.attention, ctx, blok, ulozit),
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

function rozsvicena(ctx, blok, ulozit) {
  const svitici = rozsvicenaSvetla(ctx);
  if (!svitici.length) return null;

  return ramec(
    t.panel.lightsOn,
    "lighting",
    h("div", { class: "stack" }, [
      mrizkaKaret(svitici, ctx, blok, ulozit),
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

function sceny(ctx, blok, ulozit) {
  return ramec(t.scenes.scenes, "scenes", mrizkaKaret(ctx.model.scenes, ctx, blok, ulozit));
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

  const grid = mrizkaZarizeni(ctx, blok, ulozitBlok);
  const catalog = (ctx.model.preset === "tuya" && !ctx.editing)
    ? katalogZarizeni(ctx, blok, grid) : grid;

  return ramec(
    blok.title || t.blocks.entities,
    blok.type === "room" ? "rooms" : "devices",
    h("div", { class: "stack" }, [
      ctx.editing && h("p", { class: "muted", text: t.favorites.hint }),
      catalog,
    ]),
  );
}

function katalogZarizeni(ctx, blok, grid) {
  const entityCards = [...grid.children];
  const displayed = (blok.entities || []).map((ref) => ctx.entityByRef(ref)).filter(Boolean);
  for (let index = 0; index < entityCards.length; index++) {
    const entity = displayed[index];
    entityCards[index].dataset.kind = entity?.capability?.kind || "other";
    entityCards[index].dataset.name = (blok.tileStyles?.[ctx.entityRef(entity)]?.label
      || entity?.name || "").toLocaleLowerCase("cs");
  }
  const types = [...new Set(entityCards.map((item) => item.dataset.kind))];
  const filters = h("div", { class: "catalog__filters", role: "group", "aria-label": t.studio.categories });
  const search = h("input", { class: "catalog__search", type: "search",
    placeholder: t.studio.searchBoard, "aria-label": t.studio.searchBoard });
  let active = "";
  function draw() {
    const query = search.value.trim().toLocaleLowerCase("cs");
    for (const item of entityCards) item.hidden = Boolean(
      (active && item.dataset.kind !== active) || (query && !item.dataset.name.includes(query)));
    for (const button of filters.children) button.setAttribute("aria-pressed",
      String(button.dataset.kind === active));
  }
  for (const [kind, label] of [["", t.studio.all], ...types.map((kind) =>
    [kind, t.editor.kinds[kind] || kind])]) {
    filters.append(h("button", { class: "catalog__chip", type: "button", text: label,
      dataset: { kind }, onclick: () => { active = kind; draw(); } }));
  }
  search.addEventListener("input", draw);
  draw();
  return h("div", { class: "stack" }, [
    h("div", { class: "catalog__controls" }, [filters, search]), grid,
  ]);
}
