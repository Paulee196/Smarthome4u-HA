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
import { card, openControls } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { knihovnaBloku, mrizkaZarizeni } from "./favorites.js";
import { icon } from "./icons.js";
import { VOLBY as MOTIVY, nastavitMotiv, zvolenyMotiv } from "./theme.js";
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
let editorTab = "card";
let editorDevice = null;
let cardSection = "content";
let mobilePanelOpen = false;
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
  entity: { glyf: "devices", fields: [...EDIT_COMMON, "entityRef"],
    render: (ctx, blok) => jednaEntita(ctx, blok) },
  clock: { glyf: "home", fields: EDIT_COMMON, render: (ctx) => hodiny(ctx) },
  status: { glyf: "lighting", fields: EDIT_COMMON, render: (ctx) => stavDomu(ctx) },
  metric: { glyf: "lighting", fields: [...EDIT_COMMON, "metric"], render: (ctx, blok) => metrika(ctx, blok) },
  alerts: { glyf: "security", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => upozorneni(ctx, blok, ulozit) },
  open: { glyf: "window", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => otevrene(ctx, blok, ulozit) },
  playing: { glyf: "media", fields: [...EDIT_COMMON, "mediaRef"],
    render: (ctx, blok) => prehravac(ctx, blok) },
  lights: { glyf: "lighting", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => rozsvicena(ctx, blok, ulozit) },
  scenes: { glyf: "scenes", fields: EDIT_COMMON, render: (ctx, blok, ulozit) => sceny(ctx, blok, ulozit) },
  rooms: { glyf: "rooms", fields: EDIT_COMMON, render: (ctx) => mistnosti(ctx) },
  auto_rooms: { glyf: "rooms", fields: EDIT_COMMON,
    render: (ctx, blok, ulozit, selectRoom) =>
      automatickeMistnosti(ctx, blok, ulozit, selectRoom) },
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
  "entity",
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
    columns: 4,
    blocks: [
      { id: "overview-headline", type: "headline", cols: 4,
        title: t.dashboardIntro.overview.title,
        subtitle: t.dashboardIntro.overview.description },
      { id: "overview-status", type: "status", cols: 4 },
      { id: "auto-rooms", type: "auto_rooms", cols: 4 },
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
  if (!ctx.editing) {
    editorDevice = null;
    mobilePanelOpen = false;
  }
  const preset = ctx.model.preset || "overview";
  let sestava = ctx.model.board?.blocks
    ? ctx.model.board
    : vychozi(ctx.model.dashboardTemplate || preset, ctx.model);
  if (preset === "overview" && sestava.columns === 2) {
    sestava = { columns: 4, blocks: sestava.blocks.map((block) => ({
      ...block, cols: Math.min(4, Math.max(1, block.cols || 1) * 2),
    })) };
  }

  const sloupce = Math.min(MAX_SLOUPCU, Math.max(1, sestava.columns || 1));
  const bloky = sestava.blocks;

  const screenKey = window.innerWidth < 700 ? "positionPhone"
    : window.innerWidth >= 1450 ? "positionDesktop" : "position";
  const hasFreeLayout = bloky.length && bloky.every((block) =>
    block[screenKey] || (screenKey === "positionDesktop" && block.position));
  if (ctx.editing || hasFreeLayout) {
    vykreslitVolnouPlochu(root, ctx, bloky, sloupce);
    return;
  }

  const ulozit = (nove) =>
    ulozitSestavu(ctx, { columns: sloupce, ...nove, blocks: nove.blocks || bloky });

  if (ctx.editing) {
    root.append(listaSloupcu(sloupce, (n) => ulozit({ columns: n,
      blocks: bloky.map((block) => ({ ...block,
        cols: Math.min(n, Math.max(1, Math.round((block.cols || 1) * n / sloupce))),
      })) })));
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
  const selectBlock = (id, roomId = null) => {
    selectedBlock = { preset, id, roomId };
    for (const child of plocha.children) {
      child.classList.toggle("blok--vybrany", Boolean(id)
        && child.getAttribute(ATRIBUT_KLICE) === id);
    }
    for (const room of plocha.querySelectorAll(".auto-rooms__room")) {
      room.classList.toggle("auto-rooms__room--selected", Boolean(roomId)
        && room.getAttribute(ATRIBUT_KLICE) === roomId);
    }
    const preview = [...plocha.children].find((child) =>
      child.getAttribute(ATRIBUT_KLICE) === id);
    const block = bloky.find((item) => item.id === id);
    panel?.replaceChildren(...[
      renderBlockPanel(ctx, bloky, sloupce, block,
        (next) => ulozit({ blocks: next }), preview, roomId),
      knihovnaProPanel(ctx, bloky, block, (next) => ulozit({ blocks: next }), roomId),
    ].filter(Boolean));
  };

  for (const blok of bloky) {
    const prvek = jedenBlok(ctx, blok, bloky, sloupce,
      (b) => ulozit({ blocks: b }), () => selectBlock(blok.id),
      (roomId) => selectBlock(blok.id, roomId),
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
    selectBlock(selectedBlock?.id || null, selectedBlock?.roomId || null);
  } else if (!plocha.children.length) {
    plocha.append(emptyState(t.editor.noVisibleBlocks));
  }
}

/* Volné plátno ukládá polohu v tisícinách šířky a výšku v pixelech.
 * Staré pořadí a sloupce se při první úpravě pouze promítnou do plátna;
 * do Store se zapíšou až při skutečné změně. Telefon používá jednořadé
 * uspořádání podle pořadí karet. */
function vykreslitVolnouPlochu(root, ctx, blocks, columns) {
  const preset = ctx.model.preset || "overview";
  if (ctx.editing && !editorDevice) {
    editorDevice = window.innerWidth <= 600 ? "phone" : "tablet";
  }
  const device = ctx.editing ? editorDevice : window.innerWidth < 700 ? "phone"
    : window.innerWidth >= 1450 ? "desktop" : "tablet";
  const positionKey = device === "phone" ? "positionPhone"
    : device === "desktop" ? "positionDesktop" : "position";
  const workspace = ctx.editing ? h("div", { class: "dashboard-editor dashboard-editor--free" }) : root;
  if (ctx.editing) root.append(workspace);
  const stage = h("div", { class: `dashboard-stage dashboard-stage--${device}`
    + (device === "phone" && blocks.every((block) => block.positionPhone)
      ? " dashboard-stage--phone-custom" : "")
    + (ctx.editing ? " dashboard-stage--editing" : "") });
  workspace.append(stage);
  const positions = new Map();
  const elements = new Map();
  const panel = ctx.editing ? h("aside", { class: "dashboard-editor__panel" }) : null;
  const save = (next) => {
    for (const block of next) {
      if (positions.has(block.id)) continue;
      const bottom = Math.max(0, ...[...positions.values()].map((p) => p.y + p.h));
      positions.set(block.id, { x: 0, y: bottom + 20,
        w: block[positionKey]?.w || 400, h: block[positionKey]?.h || 220 });
    }
    return ulozitSestavu(ctx, { columns, blocks: next.map((block) => ({
      ...block, [positionKey]: positions.get(block.id),
    })) });
  };
  const select = (id, roomId = null, tab = "card") => {
    selectedBlock = { preset, id, roomId };
    editorTab = tab;
    for (const [key, element] of elements) {
      element.classList.toggle("blok--vybrany", key === id);
    }
    if (panel) setEditorPanel(panel,
      renderStudioPanel(ctx, blocks, columns, id, roomId,
        editorTab, save, elements, positions, select),
      blocks.find((block) => block.id === id)?.title
        || (editorTab === "add" ? t.editor.addBlock : t.editor.properties));
  };
  const openAdd = () => {
    mobilePanelOpen = true;
    select(null, null, "add");
    if (window.matchMedia("(min-width: 601px) and (max-width: 1100px)").matches) {
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  for (const block of blocks) {
    const element = jedenBlok(ctx, block, blocks, columns, save,
      () => { mobilePanelOpen = true; select(block.id); },
      (roomId) => { mobilePanelOpen = true; select(block.id, roomId); },
      selectedBlock?.preset === preset && selectedBlock.id === block.id);
    if (!element) continue;
    element.classList.add("dashboard-stage__card");
    if (ctx.editing) {
      element.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, input, select, textarea, [data-resize]")) return;
        if (event.pointerType !== "mouse" && window.innerWidth <= 600) {
          mobilePanelOpen = true;
          select(block.id);
          return;
        }
        moveFreeCard(event, block.id, element, stage, positions, () => select(block.id),
          () => save(blocks));
      });
      element.append(h("button", {
        class: "dashboard-stage__move", type: "button",
        "aria-label": `${t.editor.drag}: ${block.title || t.blocks[block.type]}`,
        title: t.editor.drag, text: "⠿",
        onpointerdown: (event) => moveFreeCard(event, block.id, element,
          stage, positions, () => select(block.id), () => save(blocks)),
      }));
      for (const edge of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
        element.append(h("button", { class: `dashboard-stage__handle dashboard-stage__handle--${edge}`,
          type: "button", "data-resize": edge, "aria-label": `${t.editor.size}: ${block.title || t.blocks[block.type]}`,
          onpointerdown: (event) => resizeFreeCard(event, block.id, edge, element,
            stage, positions, () => select(block.id), () => save(blocks)) }));
      }
    }
    elements.set(block.id, element);
    stage.append(element);
  }

  // U existujících dashboardů převeď starou mřížku bez zásahu do dat.
  let rowX = 0, rowY = 0, rowHeight = 0;
  const savedBottom = Math.max(0, ...blocks.map((block) => {
    const place = block[positionKey] || (device === "desktop" ? block.position : null);
    return place ? place.y + place.h + 20 : 0;
  }));
  rowY = savedBottom;
  for (const block of blocks) {
    const element = elements.get(block.id);
    if (!element) continue;
    let place = block[positionKey] || (device === "desktop" ? block.position : null);
    if (!place) {
      const w = device === "phone" ? 1000 : Math.min(1000, Math.max(200,
        Math.round((block.cols || 1) / columns * 1000 / 10) * 10));
      if (rowX && rowX + w > 1000) {
        rowX = 0; rowY += rowHeight + 20; rowHeight = 0;
      }
      element.style.width = `${w / 10}%`;
      const content = element.querySelector(".dashboard-block") || element;
      const h = Math.min(2000, Math.max(140,
        Math.ceil((content.scrollHeight + (ctx.editing ? 20 : 0)) / 10) * 10));
      place = { x: rowX, y: rowY, w, h };
      rowX += w;
      rowHeight = Math.max(rowHeight, h);
    }
    positions.set(block.id, place);
    applyFreePosition(element, place);
  }
  stage.style.minHeight = `${Math.max(500, ...[...positions.values()]
    .map((place) => place.y + place.h + 160))}px`;

  if (ctx.editing) {
    root.addEventListener("sh4u-add-block", openAdd);
    stage.append(button(`+ ${t.editor.addBlock}`,
      openAdd, "dashboard-stage__add"));
    workspace.append(panel);
    const current = selectedBlock?.preset === preset && elements.has(selectedBlock.id)
      ? selectedBlock : { id: blocks[0]?.id || null, roomId: null };
    select(current.id, current.roomId, blocks.length ? editorTab : "add");
  } else if (!elements.size) {
    stage.append(h("div", { class: "dashboard-stage__empty" },
      emptyState(blocks.length ? t.editor.noVisibleBlocks : t.editor.emptyBoard)));
  }
}

function applyFreePosition(element, place) {
  element.style.left = `${place.x / 10}%`;
  element.style.top = `${place.y}px`;
  element.style.width = `${place.w / 10}%`;
  element.style.height = `${place.h}px`;
}

function freePointer(event, id, element, positions, select, save, move) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  select();
  const pointerId = event.pointerId;
  const initial = { ...positions.get(id) };
  let changed = false;
  function onMove(next) {
    if (next.pointerId !== pointerId) return;
    const place = move(initial, next.clientX - event.clientX, next.clientY - event.clientY);
    if (!place) return;
    changed = true;
    positions.set(id, place);
    applyFreePosition(element, place);
  }
  function end(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    if (changed) save();
  }
  function cancel(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    positions.set(id, initial);
    applyFreePosition(element, initial);
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
}

function moveFreeCard(event, id, element, stage, positions, select, save) {
  const width = stage.getBoundingClientRect().width || 1;
  freePointer(event, id, element, positions, select, save, (start, dx, dy) => {
    let x = Math.round((start.x + dx / width * 1000) / 10) * 10;
    let y = Math.round((start.y + dy) / 10) * 10;
    const nearX = Math.max(10, Math.round(12 / width * 1000));
    const gap = Math.round(20 / width * 1000);
    for (const [key, other] of positions) {
      if (key === id) continue;
      const xTargets = [other.x, other.x + other.w, other.x - start.w,
        other.x + other.w + gap];
      const yTargets = [other.y, other.y + other.h, other.y - start.h,
        other.y + other.h + 20];
      const snapX = xTargets.find((target) => Math.abs(x - target) <= nearX);
      const snapY = yTargets.find((target) => Math.abs(y - target) <= 12);
      if (snapX !== undefined) x = snapX;
      if (snapY !== undefined) y = snapY;
    }
    return { ...start, x: Math.max(0, Math.min(1000 - start.w, x)),
      y: Math.max(0, Math.min(10000, y)) };
  });
}

function resizeFreeCard(event, id, edge, element, stage, positions, select, save) {
  const width = stage.getBoundingClientRect().width || 1;
  freePointer(event, id, element, positions, select, save, (start, dx, dy) => {
    const changeX = Math.round(dx / width * 1000 / 10) * 10;
    const changeY = Math.round(dy / 10) * 10;
    let { x, y, w, h } = start;
    if (edge.includes("e")) w = Math.max(100, Math.min(1000 - x, w + changeX));
    if (edge.includes("s")) h = Math.max(120, Math.min(2000, h + changeY));
    if (edge.includes("w")) {
      x = Math.max(0, Math.min(start.x + start.w - 100, start.x + changeX));
      w = start.w + start.x - x;
    }
    if (edge.includes("n")) {
      y = Math.max(0, Math.min(start.y + start.h - 120, start.y + changeY));
      h = start.h + start.y - y;
    }
    return { x, y, w, h };
  });
}

function renderStudioPanel(ctx, blocks, columns, id, roomId, tab, save, elements, positions, select) {
  const root = h("div", { class: "dashboard-studio" });
  const selected = blocks.find((item) => item.id === id);
  const tabs = [["add", t.editor.addTab], ["card", t.editor.properties],
    ["layout", t.editor.layoutTab], ["views", t.editor.viewsTab],
    ["theme", t.settings.theme]];
  root.append(h("nav", { class: "dashboard-studio__tabs" }, tabs.map(([key, label]) =>
    h("button", { class: key === tab ? "dashboard-studio__tab dashboard-studio__tab--active"
      : "dashboard-studio__tab", type: "button", text: label,
      onclick: () => select(id, roomId, key) }))));
  const content = h("div", { class: "dashboard-studio__content" });
  root.append(content);
  if (tab === "card") {
    content.append(h("nav", { class: "dashboard-studio__sections" }, [
      ["content", t.editor.contentTab], ["style", t.editor.styleTab],
      ["actions", t.editor.actionsTab], ["size", t.editor.sizeTab],
    ].map(([key, label]) => h("button", {
      class: "dashboard-studio__section" + (cardSection === key ? " dashboard-studio__section--active" : ""),
      type: "button", text: label, onclick: () => {
        cardSection = key;
        select(id, roomId, "card");
      },
    }))));
    const block = selected;
    content.append(renderBlockPanel(ctx, blocks, columns,
      block, save, elements.get(id), roomId, cardSection));
    if (cardSection === "size" && block) {
      const place = positions.get(id);
      if (place) for (const [key, label, max] of [
        ["x", t.editor.positionX, 900], ["y", t.editor.positionY, 10000],
        ["w", t.editor.positionW, 1000], ["h", t.editor.positionH, 2000],
      ]) {
        const input = h("input", { class: "input", type: "number",
          min: key === "w" ? 100 : key === "h" ? 120 : 0,
          max, value: place[key] });
        input.addEventListener("change", () => {
          const next = { ...positions.get(id), [key]: Number(input.value) };
          if (next.x < 0 || next.y < 0 || next.w < 100 || next.h < 120
              || next.x + next.w > 1000 || next.h > 2000) return;
          positions.set(id, next);
          applyFreePosition(elements.get(id), next);
          save(blocks);
        });
        content.append(field(label, input));
      }
    }
  } else if (tab === "add") {
    const used = new Set(blocks.map((block) => block.type));
    content.append(h("p", { class: "muted", text: t.editor.addBlockHint }));
    for (const type of NABIDKA) {
      if (JEDNOU.has(type) && used.has(type)) continue;
      content.append(h("button", { class: "dashboard-studio__type", type: "button",
        onclick: () => {
          const block = novyBlok(type);
          const bottom = Math.max(0, ...[...positions.values()].map((p) => p.y + p.h));
          positions.set(block.id, { x: 0, y: bottom + 20, w: 400,
            h: type === "playing" ? 380 : 220 });
          selectedBlock = { preset: ctx.model.preset, id: block.id };
          editorTab = "card";
          save([...blocks, block]);
        } }, [icon(BLOKY[type].glyf), h("span", { class: "dashboard-studio__type-copy" }, [
        h("strong", { text: t.blocks[type] }),
        h("small", { text: t.blocksHint[type] || "" }),
      ])]));
    }
  } else if (tab === "layout") {
    content.append(h("div", { class: "segmented" }, [
      ["tablet", t.editor.deviceTablet],
      ["phone", t.editor.devicePhone],
      ["desktop", t.editor.deviceDesktop],
    ].map(([key, label]) => h("button", {
      class: "segmented__item" + (editorDevice === key ? " segmented__item--active" : ""),
      type: "button", text: label, "aria-pressed": String(editorDevice === key),
      onclick: () => { editorDevice = key; ctx.refresh(); },
    }))));
    content.append(h("p", { class: "muted", text: t.editor.freeLayoutHint }));
    content.append(h("p", { class: "muted", text: t.editor.deviceLayoutHint }));
  } else if (tab === "views") {
    for (const board of ctx.model.dashboards || []) {
      content.append(button(board.name, async () => {
        await api.setPreset(board.id);
        await ctx.refresh();
      }, "button--ghost dashboard-studio__add"));
    }
    const name = textInput("", t.dashboardManager.name);
    const template = selectInput([
      { value: "blank", label: t.dashboardManager.blank },
      { value: "overview", label: t.dashboardManager.overview },
      ...["pudorys", "tuya", "home", "prehled"].map((key) => ({
        value: key, label: t.presets[key].name,
      })),
    ], "blank");
    content.append(field(t.dashboardManager.name, name));
    content.append(field(t.dashboardManager.template, template));
    content.append(button(t.dashboardManager.create, async () => {
      const title = name.value.trim();
      if (!title) { toast(t.dashboardManager.name, true); return; }
      await api.dashboardCatalog({ action: "create", name: title, template: template.value });
      editorTab = "add";
      await ctx.refresh();
    }));
  } else {
    content.append(h("p", { class: "muted", text: t.settings.themeHint }));
    for (const theme of MOTIVY) {
      content.append(button(t.settings.themes[theme], () => {
        nastavitMotiv(theme);
        select(id, roomId, "theme");
      }, theme === zvolenyMotiv() ? "dashboard-studio__add" :
        "button--ghost dashboard-studio__add"));
    }
  }
  if (tab === "card" || tab === "layout") {
    const library = knihovnaProPanel(ctx, blocks, selected, save, roomId);
    if (library) root.append(library);
  }
  return root;
}

function setEditorPanel(panel, content, label) {
  const action = h("span");
  const toggle = h("button", { class: "dashboard-editor__panel-toggle", type: "button" }, [
    h("span", { class: "dashboard-editor__panel-label", text: label }), action,
  ]);
  const sync = () => {
    panel.classList.toggle("dashboard-editor__panel--collapsed", !mobilePanelOpen);
    toggle.setAttribute("aria-expanded", String(mobilePanelOpen));
    action.textContent = mobilePanelOpen ? t.editor.hideSettings : t.editor.showSettings;
  };
  toggle.addEventListener("click", () => { mobilePanelOpen = !mobilePanelOpen; sync(); });
  panel.replaceChildren(toggle,
    h("div", { class: "dashboard-editor__panel-body" }, content));
  sync();
}

function knihovnaProPanel(ctx, blocks, block, save, roomId = null) {
  if (!block) return null;
  if (block.type === "auto_rooms" && roomId) {
    const room = (ctx.model.rooms || []).find((item) =>
      String(item.id || "unassigned") === roomId);
    if (!room) return null;
    const saved = block.roomLayouts?.[roomId] || {};
    const refs = (room.entities || []).map((entity) => ctx.entityRef(entity));
    const ordered = (saved.entities || []).filter((ref) => refs.includes(ref));
    const excluded = new Set(saved.excluded || []);
    const visible = [...ordered, ...refs.filter((ref) =>
      !ordered.includes(ref) && !excluded.has(ref))];
    const roomCtx = { ...ctx, model: { ...ctx.model, scenes: [] },
      allEntities: () => room.entities || [] };
    return h("div", { class: "dashboard-studio__library" },
      knihovnaBloku(roomCtx, { entities: visible }, (next) =>
        save(blocks.map((item) => item.id === block.id ? { ...block,
          roomLayouts: { ...block.roomLayouts, [roomId]: {
            ...saved, entities: next.entities,
            excluded: refs.filter((ref) => !next.entities.includes(ref)),
          } },
        } : item))));
  }
  if (!["entities", "room"].includes(block.type)) return null;
  return h("div", { class: "dashboard-studio__library" },
    knihovnaBloku(ctx, block, (next) => save(blocks.map((item) =>
      item.id === block.id ? next : item))));
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

function jedenBlok(ctx, blok, bloky, sloupce, ulozit, onSelect, onSelectRoom, selected) {
  const definice = BLOKY[blok.type];
  if (!definice) return null;

  const sirka = Math.min(sloupce, Math.max(1, blok.cols || 1));
  const nahradit = (novy) => ulozit(bloky.map((b) => (b.id === blok.id ? novy : b)));

  let obsah = null;
  try {
    obsah = definice.render(ctx, blok, nahradit, onSelectRoom);
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
    if (Number.isInteger(blok.minHeight)) obsah.style.minHeight = `${blok.minHeight}px`;
    if (Number.isInteger(blok.fontSize)) {
      obsah.classList.add("dashboard-block--text-custom");
      obsah.style.setProperty("--block-font-size", `${blok.fontSize}px`);
    }
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
    ]),
    obsah || emptyState(t.editor.blockEmpty),
    h("button", {
      class: "blok__akce blok__resize", type: "button", text: "↘",
      "aria-label": `${t.editor.size}: ${blok.title || t.blocks[blok.type]}`,
      title: t.editor.snapHint,
      onpointerdown: (event) => {
        onSelect();
        resizeBlock(event, blok, sloupce, obal, nahradit);
      },
    }),
  ]);

  obal.style.setProperty("--sirka", String(sirka));
  obal.setAttribute(ATRIBUT_KLICE, blok.id);
  return obal;
}

function renderBlockPanel(ctx, blocks, columns, block, save, preview, roomId,
                          section = "all") {
  const panel = h("div", { class: "dashboard-editor__fields" });
  panel.append(h("h2", { text: roomId ? t.editor.roomProperties : t.editor.properties }));
  if (!block) {
    panel.append(emptyState(t.editor.chooseBlock));
    return panel;
  }
  if (roomId && block.type === "auto_rooms") {
    const room = (ctx.model.rooms || []).find((item) => String(item.id || "unassigned") === roomId);
    if (room) {
      let layout = { ...(block.roomLayouts?.[roomId] || {}) };
      const updateRoom = (patch) => {
        layout = { ...layout, ...patch };
        save(blocks.map((item) => item.id === block.id ? { ...block,
          roomLayouts: { ...block.roomLayouts, [roomId]: layout } } : item));
      };
      const name = textInput(layout.title || "", room.name || t.rooms.unassigned);
      name.maxLength = 60;
      name.addEventListener("change", () => updateRoom({ title: name.value.trim() }));
      panel.append(field(t.editor.label, name));
      const width = selectInput([
        { value: "1", label: t.editor.width(1, 2) },
        { value: "2", label: t.editor.width(2, 2) },
      ], String(layout.cols || 1));
      width.addEventListener("change", () => updateRoom({ cols: Number(width.value) }));
      panel.append(field(t.editor.columns, width));
      const font = h("input", { type: "range", min: 12, max: 48, step: 1,
        value: layout.fontSize || 20 });
      const value = h("output", { text: `${layout.fontSize || 20} px` });
      font.addEventListener("input", () => {
        value.textContent = `${font.value} px`;
        const target = [...(preview?.querySelectorAll(".auto-rooms__room") || [])]
          .find((item) => item.getAttribute(ATRIBUT_KLICE) === roomId);
        target?.style.setProperty("--block-font-size", `${font.value}px`);
        target?.classList.add("auto-rooms__room--text-custom");
      });
      font.addEventListener("change", () => updateRoom({ fontSize: Number(font.value) }));
      panel.append(h("div", { class: "dashboard-editor__range" },
        [field(t.editor.fontSize, font), value]));
      return panel;
    }
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
    entityRef: () => {
      const entities = [...ctx.allEntities(), ...(ctx.model.scenes || [])];
      const choices = [{ value: "", label: t.editor.chooseEntity },
        ...entities.map((entity) => ({ value: ctx.entityRef(entity),
          label: `${entity.name} · ${entity.id}` }))];
      return select(choices, block.entityRef || "", "entityRef", t.editor.entitySource);
    },
    mediaRef: () => {
      const players = ctx.allEntities().filter((entity) =>
        entity.capability?.kind === "media_player");
      const choices = [{ value: "", label: t.editor.mediaAutomatic },
        ...players.map((entity) => ({ value: ctx.entityRef(entity),
          label: `${entity.name} · ${entity.id}` }))];
      if (block.mediaRef && !choices.some((item) => item.value === block.mediaRef)) {
        choices.push({ value: block.mediaRef, label: t.panel.playerMissing });
      }
      return select(choices, block.mediaRef || "", "mediaRef", t.editor.mediaSource);
    },
  };
  const keys = BLOKY[block.type]?.fields || [];
  const sections = { content: ["title", "subtitle", "metric", "entityRef", "mediaRef"],
    style: ["icon", "color"], size: ["height", "cols"] };
  for (const key of keys) {
    if (section === "all" || (sections[section] || []).includes(key)) {
      panel.append(fields[key]());
    }
  }
  if (section === "actions") {
    if (block.type === "entity") {
      panel.append(select([
        { value: "default", label: t.editor.actionDefault },
        { value: "details", label: t.editor.actionDetails },
        { value: "none", label: t.editor.actionNone },
      ], block.tapAction || "default", "tapAction", t.editor.singleTap));
    } else if (block.type === "playing") {
      panel.append(select([
        { value: "details", label: t.editor.actionDetails },
        { value: "play_pause", label: t.editor.actionPlayPause },
      ], block.tapAction || "details", "tapAction", t.editor.singleTap));
    } else panel.append(h("p", { class: "muted", text: t.editor.actionEntityHint }));
  }
  if (section === "content" || section === "all") {
    if (block.type === "entities" || block.type === "room") {
      panel.append(h("p", { class: "muted", text: t.editor.contentOnCanvas }));
    }
  }
  if (section === "content") {
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
  if (section === "actions") return panel;
  if (section === "style" || section === "all") {
  const size = h("input", { type: "range", min: 12, max: 72, step: 1,
    value: block.fontSize || 20 });
  const sizeValue = h("output", { text: `${block.fontSize || 20} px` });
  size.addEventListener("input", () => {
    sizeValue.textContent = `${size.value} px`;
    const content = preview?.querySelector(".dashboard-block");
    content?.classList.add("dashboard-block--text-custom");
    content?.style.setProperty("--block-font-size", `${size.value}px`);
  });
  size.addEventListener("change", () => update({ fontSize: Number(size.value) }));
  panel.append(h("div", { class: "dashboard-editor__range" },
    [field(t.editor.fontSize, size), sizeValue]));
  }
  if (section === "style") return panel;
  const minHeight = h("input", { type: "range", min: 120, max: 900, step: 10,
    value: block.minHeight || 120 });
  const heightValue = h("output", { text: `${block.minHeight || 120} px` });
  minHeight.addEventListener("input", () => {
    heightValue.textContent = `${minHeight.value} px`;
    const content = preview?.querySelector(".dashboard-block");
    if (content) content.style.minHeight = `${minHeight.value}px`;
  });
  minHeight.addEventListener("change", () => update({ minHeight: Number(minHeight.value) }));
  panel.append(h("div", { class: "dashboard-editor__range" },
    [field(t.editor.pixelHeight, minHeight), heightValue]));
  if (section === "size") return panel;
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
  const content = element.querySelector(".dashboard-block");
  const initialHeight = block.minHeight || Math.round(content?.getBoundingClientRect().height || 120);
  const bounds = element.parentElement.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(element.parentElement).columnGap) || 0;
  const unit = (bounds.width + gap) / columns;
  let nextColumns = initialColumns;
  let nextHeight = initialHeight;
  function move(next) {
    if (next.pointerId !== pointerId) return;
    nextColumns = window.matchMedia("(min-width: 900px)").matches
      ? Math.min(columns, Math.max(1,
        initialColumns + Math.round((next.clientX - event.clientX) / unit)))
      : initialColumns;
    nextHeight = Math.min(900, Math.max(120,
      Math.round((initialHeight + next.clientY - event.clientY) / 10) * 10));
    element.style.setProperty("--sirka", String(nextColumns));
    if (content) content.style.minHeight = `${nextHeight}px`;
  }
  function end(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    if (nextColumns !== initialColumns || nextHeight !== initialHeight) {
      save({ ...block, cols: nextColumns, minHeight: nextHeight });
    }
  }
  function cancel(next) {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    element.style.setProperty("--sirka", String(initialColumns));
    if (content) content.style.minHeight = block.minHeight ? `${block.minHeight}px` : "";
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

function jednaEntita(ctx, block) {
  const entity = ctx.entityByRef(block.entityRef);
  if (!entity) return ctx.editing ? emptyState(t.editor.chooseEntity) : null;
  const onClick = block.tapAction === "details" ? openControls
    : block.tapAction === "none" ? () => {} : undefined;
  const tile = card(entity, { size: "xl", editing: ctx.editing, onClick });
  if (ctx.editing) for (const control of tile.querySelectorAll("button, input, select")) {
    control.disabled = true;
  }
  return ramec(block.title || entity.name, "devices",
    h("div", { class: "cards" }, [tile]));
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

function prehravac(ctx, blok) {
  const players = ctx.allEntities().filter((entity) =>
    entity.capability?.kind === "media_player");
  const selected = blok.mediaRef ? ctx.entityByRef(blok.mediaRef) : null;
  const active = players.filter((entity) =>
    entity.state === "playing" || entity.state === "paused");
  const shown = blok.mediaRef
    ? selected?.capability?.kind === "media_player" ? [selected] : []
    : active.length ? active : players;
  const hint = blok.mediaRef && !shown.length ? t.panel.playerMissing
    : !players.length ? t.panel.noPlayers
    : !active.length && !blok.mediaRef ? t.panel.nonePlaying : "";
  const onClick = blok.tapAction === "play_pause" ? (entity) => {
    if (!entity.capability?.canPlay) { openControls(entity); return; }
    api.action(entity.id, "play_pause").catch((error) => toast(error.message, true));
  } : undefined;
  return ramec(blok.title || t.panel.nowPlaying, "media",
    h("div", { class: "stack" }, [
      hint && h("p", { class: "muted", text: hint }),
      shown.length > 0 && h("div", { class: "cards" },
        shown.map((entity) => card(entity, { size: "xl", editing: ctx.editing, onClick }))),
    ]));
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

function automatickeMistnosti(ctx, blok, ulozit, selectRoom) {
  const rooms = ctx.model.rooms || [];
  if (!rooms.length) return ramec(blok.title || t.blocks.auto_rooms,
    "rooms", emptyState(t.rooms.empty));
  const layouts = blok.roomLayouts || {};
  const orderedRooms = [...rooms].sort((a, b) =>
    (layouts[String(a.id || "unassigned")]?.order ?? rooms.indexOf(a))
    - (layouts[String(b.id || "unassigned")]?.order ?? rooms.indexOf(b)));
  const grid = h("div", { class: "auto-rooms" }, orderedRooms.map((room) => {
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
        ...saved,
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
    const roomView = h("section", { class: "panel auto-rooms__room"
      + (saved.cols === 2 ? " auto-rooms__room--wide" : "")
      + (saved.fontSize ? " auto-rooms__room--text-custom" : ""),
      onclick: (event) => {
        if (ctx.editing && !event.target.closest("button, input, select, textarea")) {
          event.stopPropagation();
          selectRoom?.(key);
        }
      },
    }, [
      h("div", { class: "panel__head" }, [
        h("span", { class: "panel__glyph" }, icon("rooms")),
        h("h2", { class: "panel__title", text: saved.title || room.name || t.rooms.unassigned }),
        h("span", { class: "muted", text: t.rooms.deviceCount + ": " + entities.length }),
        ctx.editing && h("button", { class: "button button--ghost", type: "button",
          text: t.editor.roomProperties, onclick: () => selectRoom?.(key) }),
        ctx.editing && h("button", { class: "dnd__uchyt", type: "button",
          "data-dnd-handle": "", "aria-label": `${t.editor.drag}: ${room.name}`,
          text: "⠿" }),
      ]),
      cards,
      more,
    ]);
    roomView.setAttribute(ATRIBUT_KLICE, key);
    if (saved.fontSize) roomView.style.setProperty("--block-font-size", `${saved.fontSize}px`);
    return roomView;
  }));
  if (ctx.editing) povolitPretahovani(grid, (order) => ulozit({ ...blok,
    roomLayouts: Object.fromEntries(order.map((key, index) => [key, {
      ...(layouts[key] || {}), order: index,
    }])) }));
  return ramec(blok.title || t.blocks.auto_rooms, "rooms", grid);
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
  const resolved = ids.some((ref) => ctx.entityByRef(ref));
  const title = blok.title || t.blocks.entities;
  const glyph = blok.type === "room" ? "rooms" : "devices";
  if (!ctx.editing && !resolved) {
    return ramec(title, glyph, emptyState(ids.length
      ? t.favorites.unavailableInBlock : t.favorites.emptyBlock));
  }

  const grid = mrizkaZarizeni(ctx, blok, ulozitBlok);
  const catalog = (ctx.model.dashboardTemplate === "tuya" && !ctx.editing)
    ? katalogZarizeni(ctx, blok, grid) : grid;

  return ramec(
    title,
    glyph,
    h("div", { class: "stack" }, [
      ctx.editing && !ids.length && h("p", { class: "muted", text: t.favorites.emptyBlockHint }),
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
