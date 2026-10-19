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
import { COLORS, ICONS } from "./appearance.js";
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
  field,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

/* Sloupce plochy. Víc než čtyři se nevejdou ani na velkou obrazovku. */
export const MAX_SLOUPCU = 4;
const EDIT_COMMON = ["title", "icon", "color", "height", "cols"];
let selectedBlock = null;
let saveQueue = Promise.resolve();
let saveRevision = 0;

/* ------------------------------------------------------------------ */
/* Definice bloků                                                      */
/* ------------------------------------------------------------------ */

/* Každý blok umí vykreslit sebe. Když nemá co ukázat, vrátí null a na
   ploše po něm nezůstane prázdné místo - kromě režimu úprav, kde musí
   být vidět, aby se s ním dalo hnout. */
export const BLOKY = {
  headline: { glyf: "home", fields: [...EDIT_COMMON, "subtitle"], render: (ctx, blok) => nadpisPlochy(ctx, blok) },
  clock: { glyf: "home", fields: EDIT_COMMON, render: (ctx) => hodiny(ctx) },
  status: { glyf: "lighting", fields: EDIT_COMMON, render: (ctx) => stavDomu(ctx) },
  metric: { glyf: "lighting", fields: [...EDIT_COMMON, "metric"], render: (ctx, blok) => metrika(ctx, blok) },
  alerts: { glyf: "security", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => upozorneni(ctx, blok, ulozit) },
  open: { glyf: "window", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => otevrene(ctx, blok, ulozit) },
  playing: { glyf: "media", fields: EDIT_COMMON, render: (ctx) => prehravac(ctx) },
  lights: { glyf: "lighting", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => rozsvicena(ctx, blok, ulozit) },
  scenes: { glyf: "scenes", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => sceny(ctx, blok, ulozit) },
  rooms: { glyf: "rooms", fields: EDIT_COMMON, render: (ctx) => mistnosti(ctx) },
  auto_rooms: { glyf: "rooms", fields: EDIT_COMMON,
    render: (ctx, blok, ulozit) => automatickeMistnosti(ctx, blok, ulozit) },
  floorplan: { glyf: "home", fields: EDIT_COMMON,
    render: (ctx, blok) => vlozenyPlanek(ctx, blok) },
  actions: { glyf: "home", fields: EDIT_COMMON, render: (ctx) => rychleAkce(ctx) },
  entities: {
    glyf: "devices",
    fields: EDIT_COMMON,
    render: (ctx, blok, ulozit) => zarizeni(ctx, blok, ulozit),
  },
  room: {
    glyf: "rooms",
    fields: EDIT_COMMON,
    render: (ctx, blok, ulozit) => zarizeni(ctx, blok, ulozit),
  },
};

/* Co jde přidat. Pořadí je pořadí v nabídce. */
export const NABIDKA = [
  "headline",
  "entities",
  "room",
  "auto_rooms",
  "floorplan",
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
const JEDNOU = new Set(["clock", "status", "rooms", "auto_rooms", "floorplan", "actions"]);

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
  if (preset === "overview") return {
    columns: 2,
    blocks: [
      { id: "overview-headline", type: "headline", cols: 2,
        title: t.dashboardIntro.overview.title,
        subtitle: t.dashboardIntro.overview.description },
      { id: "overview-status", type: "status", cols: 2 },
      { id: "auto-rooms", type: "auto_rooms", cols: 2 },
    ],
  };
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
  const preset = ctx.model.preset || "overview";
  const sestava = ctx.model.board?.blocks
    ? ctx.model.board
    : vychozi(ctx.model.dashboardTemplate || preset, ctx.model);

  const sloupce = Math.min(MAX_SLOUPCU, Math.max(1, sestava.columns || 1));
  const bloky = sestava.blocks;

  const ulozit = (nove) =>
    ulozitSestavu(ctx, { columns: sloupce, ...nove, blocks: nove.blocks || bloky });

  if (ctx.editing) {
    root.append(listaSloupcu(sloupce, (n) => ulozit({ columns: n })));
  }

  const workspace = ctx.editing ? h("div", { class: "dashboard-editor" }) : root;
  if (ctx.editing) root.append(workspace);
  const plocha = h("div", { class: "plocha plocha--" + (ctx.model.dashboardTemplate || preset) });
  plocha.style.setProperty("--sloupce", String(sloupce));
  workspace.append(plocha);
  const panel = ctx.editing ? h("aside", {
    class: "dashboard-editor__panel", "aria-label": t.editor.properties,
  }) : null;
  if (ctx.editing && (!selectedBlock || selectedBlock.preset !== preset
    || !bloky.some((block) => block.id === selectedBlock.id))) {
    selectedBlock = { preset, id: bloky[0]?.id || null };
  }
  const selectBlock = (id) => {
    selectedBlock = { preset, id };
    for (const child of plocha.children) {
      child.classList.toggle("blok--vybrany", Boolean(id)
        && child.getAttribute(ATRIBUT_KLICE) === id);
    }
    panel?.replaceChildren(renderBlockPanel(ctx, bloky, sloupce,
      bloky.find((block) => block.id === id), (next) => ulozit({ blocks: next })));
  };

  for (const blok of bloky) {
    const prvek = jedenBlok(ctx, blok, bloky, sloupce,
      (b) => ulozit({ blocks: b }), () => selectBlock(blok.id),
      selectedBlock?.preset === preset && selectedBlock.id === blok.id);
    if (prvek) plocha.append(prvek);
  }

  if (ctx.editing) {
    plocha.append(pridatBlok(ctx, bloky, (b) => ulozit({ blocks: b })));
    povolitPretahovani(plocha, (poradi) => {
      const podleId = new Map(bloky.map((b) => [b.id, b]));
      ulozit({ blocks: poradi.map((id) => podleId.get(id)).filter(Boolean) });
    });
    workspace.append(panel);
    selectBlock(selectedBlock?.id || null);
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

function jedenBlok(ctx, blok, bloky, sloupce, ulozit, onSelect, selected) {
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

  const obal = h("div", {
    class: "blok plocha__blok" + (selected ? " blok--vybrany" : ""),
    onclick: (event) => {
      if (!event.target.closest("button, input, select, textarea")) onSelect();
    },
  }, [
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
        onclick: onSelect,
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
      h("button", {
        class: "blok__akce blok__resize", type: "button", text: "↘",
        "aria-label": `${t.editor.size}: ${blok.title || t.blocks[blok.type]}`,
        title: t.editor.snapHint,
        onpointerdown: (event) => resizeBlock(event, blok, sloupce, obal, nahradit),
      }),
    ]),
    obsah || emptyState(t.editor.blockEmpty),
  ]);

  obal.style.setProperty("--sirka", String(sirka));
  obal.setAttribute(ATRIBUT_KLICE, blok.id);
  return obal;
}

function renderBlockPanel(ctx, blocks, columns, block, save) {
  const panel = h("div", { class: "dashboard-editor__fields" });
  panel.append(h("h2", { text: t.editor.properties }));
  if (!block) {
    panel.append(emptyState(t.editor.chooseBlock));
    return panel;
  }
  panel.append(h("p", { class: "muted", text: t.blocksHint[block.type] || "" }));
  let draft = { ...block };
  const update = (patch) => {
    draft = { ...draft, ...patch };
    save(blocks.map((item) => item.id === block.id ? draft : item));
  };
  const select = (choices, current, key, label) => {
    const input = selectInput(choices, current);
    input.addEventListener("change", () => update({ [key]: input.value }));
    return field(label, input);
  };
  const fields = {
    title: () => {
      const input = textInput(block.title || "", t.blocks[block.type]);
      input.maxLength = 60;
      input.addEventListener("change", () => update({ title: input.value.trim() }));
      return field(t.editor.label, input);
    },
    subtitle: () => {
      const input = textInput(block.subtitle || "", t.editor.subtitle);
      input.maxLength = 120;
      input.addEventListener("change", () => update({ subtitle: input.value.trim() }));
      return field(t.editor.subtitle, input);
    },
    icon: () => select([{ value: "", label: t.editor.automatic },
      ...ICONS.map((value) => ({ value, label: t.editor.icons[value] }))],
    block.icon || "", "icon", t.editor.icon),
    color: () => select(COLORS.map((value) => ({ value, label: t.editor.colors[value] })),
      block.color || "default", "color", t.editor.color),
    height: () => select([
      { value: "compact", label: t.editor.heightCompact },
      { value: "normal", label: t.editor.heightNormal },
      { value: "large", label: t.editor.heightLarge },
    ], block.height || "normal", "height", t.editor.blockHeight),
    cols: () => {
      const input = selectInput(Array.from({ length: columns }, (_, index) => ({
        value: String(index + 1), label: t.editor.width(index + 1, columns),
      })), String(Math.min(columns, Math.max(1, block.cols || 1))));
      input.addEventListener("change", () => update({ cols: Number(input.value) }));
      return field(t.editor.columns, input);
    },
    metric: () => select(Object.keys(t.metrics).map((value) => ({
      value, label: t.metrics[value],
    })), block.metric || "lightsOn", "metric", t.editor.metricSource),
  };
  for (const key of BLOKY[block.type]?.fields || []) panel.append(fields[key]());
  if (block.type === "entities" || block.type === "room") {
    panel.append(h("p", { class: "muted", text: t.editor.contentOnCanvas }));
  }
  panel.append(h("div", { class: "stack" }, [
    button(t.editor.duplicate, () => {
      const copy = { ...structuredClone(block),
        id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
      selectedBlock = { preset: ctx.model.preset || "overview", id: copy.id };
      const index = blocks.findIndex((item) => item.id === block.id);
      save([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
    }, "button--ghost"),
    button(t.editor.removeBlock, () => save(blocks.filter((item) => item.id !== block.id)),
      "button--ghost"),
  ]));
  return panel;
}

function resizeBlock(event, block, columns, element, save) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const handle = event.currentTarget;
  const pointerId = event.pointerId;
  handle.setPointerCapture?.(pointerId);
  const initialColumns = Math.min(columns, Math.max(1, block.cols || 1));
  const heights = ["compact", "normal", "large"];
  const initialHeight = heights.indexOf(block.height || "normal");
  const bounds = element.parentElement.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(element.parentElement).columnGap) || 0;
  const unit = (bounds.width + gap) / columns;
  let nextColumns = initialColumns;
  let nextHeight = heights[Math.max(0, initialHeight)];
  const content = element.querySelector(".dashboard-block");
  function move(next) {
    if (next.pointerId !== pointerId) return;
    nextColumns = window.matchMedia("(min-width: 900px)").matches
      ? Math.min(columns, Math.max(1,
        initialColumns + Math.round((next.clientX - event.clientX) / unit)))
      : initialColumns;
    nextHeight = heights[Math.min(2, Math.max(0,
      initialHeight + Math.round((next.clientY - event.clientY) / 70)))];
    element.style.setProperty("--sirka", String(nextColumns));
    if (content) {
      content.classList.remove(...heights.map((value) => `dashboard-block--${value}`));
      content.classList.add(`dashboard-block--${nextHeight}`);
    }
  }
  function end(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    if (nextColumns !== initialColumns || nextHeight !== (block.height || "normal")) {
      save({ ...block, cols: nextColumns, height: nextHeight });
    }
  }
  function cancel(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    element.style.setProperty("--sirka", String(initialColumns));
    if (content) {
      content.classList.remove(...heights.map((value) => `dashboard-block--${value}`));
      content.classList.add(`dashboard-block--${block.height || "normal"}`);
    }
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
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
  const revision = ++saveRevision;
  const preset = ctx.model.preset || "overview";
  const task = saveQueue.catch(() => {}).then(async () => {
    await api.saveDashboard(preset, sestava.columns, sestava.blocks);
    if (revision === saveRevision) {
      toast(t.notice.saved);
      await ctx.refresh();
    }
  }).catch((error) => toast(error.message, true));
  saveQueue = task;
  await task;
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
  const preset = ctx.model.dashboardTemplate || "overview";
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

function automatickeMistnosti(ctx, blok, ulozit) {
  const rooms = ctx.model.rooms || [];
  if (!rooms.length) return ramec(blok.title || t.blocks.auto_rooms,
    "rooms", emptyState(t.rooms.empty));
  const layouts = blok.roomLayouts || {};
  return ramec(blok.title || t.blocks.auto_rooms, "rooms",
    h("div", { class: "auto-rooms" }, rooms.map((room) => {
    const key = String(room.id || "unassigned");
    const entities = room.entities || [];
    const refs = entities.map((entity) => ctx.entityRef(entity));
    const saved = layouts[key] || {};
    const ordered = (saved.entities || []).filter((ref) => refs.includes(ref));
    const excluded = new Set(saved.excluded || []);
    const visible = [...ordered, ...refs.filter((ref) =>
      !ordered.includes(ref) && !excluded.has(ref))];
    const tileBlock = { id: `auto-${key}`, type: "entities", entities: visible,
      sizes: saved.sizes || {}, tileStyles: saved.tileStyles || {} };
    const roomCtx = { ...ctx, model: { ...ctx.model, scenes: [] },
      allEntities: () => entities };
    const saveRoom = (next) => ulozit({ ...blok, roomLayouts: {
      ...layouts, [key]: {
        entities: next.entities || [],
        excluded: refs.filter((ref) => !(next.entities || []).includes(ref)),
        sizes: next.sizes || {}, tileStyles: next.tileStyles || {},
      },
    } });
    const shown = ctx.editing ? tileBlock : { ...tileBlock, entities: visible.slice(0, 8) };
    const cards = h("div", { class: "auto-rooms__tiles" },
      mrizkaZarizeni(roomCtx, shown, saveRoom));
    const more = !ctx.editing && visible.length > 8
      ? button(t.dashboardManager.showMore(visible.length - 8), () => {
        cards.replaceChildren(mrizkaZarizeni(roomCtx, tileBlock, saveRoom));
        more.remove();
      }, "button--ghost") : null;
    return h("section", { class: "panel auto-rooms__room" }, [
      h("div", { class: "panel__head" }, [
        h("span", { class: "panel__glyph" }, icon("rooms")),
        h("h2", { class: "panel__title", text: room.name || t.rooms.unassigned }),
        h("span", { class: "muted", text: t.rooms.deviceCount + ": " + entities.length }),
      ]),
      cards,
      more,
    ]);
    })));
}

function vlozenyPlanek(ctx, blok) {
  const root = h("div", { class: "embedded-floorplan" });
  import("./view-floorplan.js").then(({ renderFloorplan }) =>
    renderFloorplan(root, ctx, { embedded: true })).catch((error) =>
      root.replaceChildren(emptyState(error.message)));
  return ramec(blok.title || t.blocks.floorplan, "home", root);
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
  const catalog = (ctx.model.dashboardTemplate === "tuya" && !ctx.editing)
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
