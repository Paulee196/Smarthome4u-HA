/* Půdorys bytu.
 *
 * Obrázek nahraje správce, zařízení se na něj rozmístí přetažením.
 * Souřadnice se ukládají v procentech plochy, takže plán funguje stejně
 * na telefonu i na nástěnném panelu.
 */

import { api } from "./api.js";
import { t, describeState } from "./i18n.js";
import { openControls, watch } from "./controls.js";
import { editAppearance, editBlockAppearance } from "./appearance.js";
import { vychozi } from "./blocks.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { mrizkaZarizeni } from "./favorites.js";
import { icon, iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  field,
  numberInput,
  selectInput,
  toast,
} from "./ui.js";

let selectedRoomId = null;

export async function renderFloorplan(root, ctx) {
  let plan;
  try {
    plan = await api.floorplan();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  const jeTechnik = ctx.jeTechnik;
  const rooms = floorplanRooms(ctx, plan);

  if (jeTechnik || ctx.editing) {
    root.append(
      h("div", { class: "row row--end floorplan-toolbar" }, [
        jeTechnik && !ctx.editing && plan.image &&
          button(t.floorplan.editPlan, () => ctx.startEditing()),
        jeTechnik && button(t.floorplan.upload, () => nahrat(ctx), "button--ghost"),
        ctx.editing && plan.image &&
          button(t.floorplan.addIcon, () => pridatBod(ctx, plan), "button--ghost"),
        ctx.editing && plan.image &&
          button(t.floorplan.addRoom, () => pridatMistnost(ctx, plan), "button--ghost"),
      ]),
    );
  }

  const board = floorplanBoard(ctx, Boolean(plan.image), rooms);
  const headline = board.find((block) => block.type === "headline");
  const intro = h("div", { class: "floorplan-intro dashboard-intro dashboard-block"
    + (plan.image ? " floorplan-intro--image" : "")
    + ` dashboard-block--${headline?.color || "default"}`
    + ` dashboard-block--${headline?.height || "normal"}` }, [
    h("span", { class: "experience__eyebrow", text: t.floorplan.eyebrow }),
    h("span", { class: "dashboard-intro__glyph" }, icon(headline?.icon || "home")),
    h("h2", { text: headline?.title || (plan.image
      ? t.floorplan.homePlan : t.floorplan.automaticPlan) }),
    h("p", { text: headline?.subtitle === undefined
      ? (plan.image ? t.floorplan.planHint : t.floorplan.automaticHint)
      : headline.subtitle }),
  ]);
  if (ctx.editing && headline) intro.append(button(t.editor.blockAppearance,
    () => editBlockAppearance(headline,
      (next) => saveFloorplanBoard(ctx, board.map((block) =>
        block.id === headline.id ? next : block)), ["headline"]), "button--ghost"));
  root.append(intro);

  const roomsView = prehledMistnosti(ctx, !plan.image, board, rooms);
  if (plan.image) root.append(platno(ctx, plan, rooms, roomsView.select));
  if (roomsView.element) root.append(roomsView.element);
}

function floorplanRooms(ctx, plan) {
  const byId = new Map((ctx.model.rooms || []).filter((room) => room.id)
    .map((room) => [String(room.id), room]));
  for (const area of plan.availableRooms || []) {
    if (!byId.has(String(area.id))) byId.set(String(area.id), {
      id: area.id, name: area.name, entities: [],
    });
  }
  return [...byId.values()];
}

function floorplanBoard(ctx, hasImage, allRooms) {
  const rooms = allRooms.slice(0, 29);
  const roomIds = new Set(rooms.map((room) => String(room.id)));
  const defaults = vychozi("pudorys", ctx.model).blocks;
  const stored = (ctx.model.board?.blocks || []).filter((block) =>
    block.type !== "room" || roomIds.has(String(block.roomId)));
  const savedRooms = new Set(stored.map((block) => String(block.roomId || "")));
  const defaultHeadline = defaults.find((block) => block.type === "headline");
  defaultHeadline.title = hasImage ? t.floorplan.homePlan : t.floorplan.automaticPlan;
  defaultHeadline.subtitle = hasImage ? t.floorplan.planHint : t.floorplan.automaticHint;
  const missingRooms = rooms.filter((room) => !savedRooms.has(String(room.id)))
    .map((room) => defaults.find((block) => block.type === "room"
      && String(block.roomId) === String(room.id)) || {
      id: `plan-${String(room.id).slice(0, 35)}`,
      type: "room", roomId: String(room.id), title: room.name || t.rooms.unassigned,
      entities: [],
    });
  return [
    ...(!stored.some((block) => block.type === "headline") ? [defaultHeadline] : []),
    ...stored, ...missingRooms,
  ].slice(0, 30);
}

async function saveFloorplanBoard(ctx, blocks) {
  try {
    await api.saveDashboard("pudorys", 2, blocks);
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

/* Plánek funguje hned po instalaci, i když uživatel nemá obrázek domu. */
function prehledMistnosti(ctx, schematic, blocks, allRooms) {
  const rooms = allRooms.slice(0, 29);
  const summaries = ctx.model.roomSummaries || [];
  if (!rooms.length) return {
    element: schematic || ctx.editing ? emptyState(t.rooms.empty) : null,
    select: () => {},
  };
  const blockFor = (room) => blocks.find((block) =>
    block.type === "room" && String(block.roomId) === String(room.id));
  const orderedRooms = [...rooms].sort((a, b) =>
    (blocks.indexOf(blockFor(a)) < 0 ? blocks.length : blocks.indexOf(blockFor(a)))
    - (blocks.indexOf(blockFor(b)) < 0 ? blocks.length : blocks.indexOf(blockFor(b))));

  const saveBlock = (changed) => saveFloorplanBoard(ctx, blocks.map((block) =>
    block.id === changed.id ? changed : block));

  const showMap = schematic || ctx.editing;
  const root = h("section", {
    class: "floorplan-rooms" + (schematic ? " floorplan-rooms--schematic" : "")
      + (!showMap ? " floorplan-rooms--detail-only" : ""),
    role: "region", "aria-label": t.floorplan.selectedRoom,
  });
  if (!showMap) root.hidden = true;
  const map = h("div", { class: "floorplan-rooms__map", role: "group", "aria-label": t.floorplan.roomsOnPlan });
  const detail = h("div", { class: "floorplan-rooms__detail" });
  let active = orderedRooms.some((room) => String(room.id) === selectedRoomId)
    ? selectedRoomId : String(orderedRooms[0].id);

  function draw() {
    const room = orderedRooms.find((r) => String(r.id) === active) || orderedRooms[0];
    const info = summaries.find((r) => r.id === room.id) || {};
    const block = blockFor(room);
    const title = block?.title || room.name || t.rooms.unassigned;
    detail.replaceChildren(
      h("div", { class: "floorplan-rooms__detail-head" }, [
        h("span", { class: "experience__eyebrow", text: t.floorplan.selectedRoom }),
        h("h3", { text: title }),
        h("p", { text: t.floorplan.roomState(info.lightsOn || 0, info.temperature) }),
        ctx.editing && block && button(t.editor.blockAppearance,
          () => editBlockAppearance(block, saveBlock, ["room"]), "button--ghost"),
        !schematic && !ctx.editing && button(t.action.close,
          () => { root.hidden = true; }, "button--ghost"),
      ]),
      block && (block.entities?.length || ctx.editing)
        ? mrizkaZarizeni(ctx, block, saveBlock)
        : h("p", { class: "muted", text: t.floorplan.noControls }),
    );
    for (const item of map.children) {
      const zone = item.classList.contains("floorplan-rooms__zone")
        ? item : item.querySelector(".floorplan-rooms__zone");
      zone?.setAttribute("aria-pressed", String(zone.dataset.room === active));
    }
  }

  for (const room of orderedRooms) {
    const info = summaries.find((r) => r.id === room.id) || {};
    const block = blockFor(room);
    const zone = h("button", {
      class: `floorplan-rooms__zone card card--tone-${block?.color || "default"}`
        + (block?.height === "large" ? " floorplan-rooms__zone--large" : ""),
      type: "button", dataset: { room: String(room.id) },
      onclick: () => { active = String(room.id); selectedRoomId = active; draw(); },
    }, [
      h("span", { class: "floorplan-rooms__zone-icon" }, icon(block?.icon || "rooms")),
      h("strong", { text: block?.title || room.name || t.rooms.unassigned }),
      h("small", { text: t.floorplan.roomState(info.lightsOn || 0, info.temperature) }),
    ]);
    if (ctx.editing && block) {
      const wrapper = h("div", { class: "floorplan-rooms__zone-wrap"
        + (block.height === "large" ? " floorplan-rooms__zone-wrap--large" : "") }, [
        zone,
        h("button", { class: "floorplan-rooms__drag", type: "button",
          "data-dnd-handle": "", "aria-label": `${t.editor.drag}: ${block.title || room.name}`,
          text: "⠿" }),
      ]);
      wrapper.setAttribute(ATRIBUT_KLICE, block.id);
      map.append(wrapper);
    } else map.append(zone);
  }
  if (ctx.editing) povolitPretahovani(map, (order) => {
    const byId = new Map(blocks.map((block) => [block.id, block]));
    saveFloorplanBoard(ctx, [...blocks.filter((block) => block.type === "headline"),
      ...order.map((id) => byId.get(id)).filter(Boolean),
      ...blocks.filter((block) => block.type !== "headline" && !order.includes(block.id))]);
  });
  if (showMap) root.append(map);
  root.append(detail);
  draw();
  return {
    element: root,
    select: (roomId) => {
      if (!orderedRooms.some((room) => String(room.id) === String(roomId))) return;
      active = String(roomId);
      selectedRoomId = active;
      draw();
      root.hidden = false;
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Plán s body                                                         */
/* ------------------------------------------------------------------ */

function platno(ctx, plan, rooms, selectRoom) {
  const vse = new Map(
    [...ctx.allEntities(), ...(plan.entities || [])].flatMap((e) => [
      [e.id, e],
      [e.ref || e.id, e],
    ]),
  );

  const obrazek = h("img", {
    class: "plan__obrazek",
    src: plan.image,
    alt: t.floorplan.title,
  });

  const vrstva = h("div", { class: "plan__vrstva" });
  const platno = h("div", { class: "plan" }, [obrazek, vrstva]);
  const stage = h("section", { class: "floorplan-stage" }, [platno]);

  // Souřadnice značek se vztahují k přesné ploše obrázku, bez okrajů.
  function fit() {
    if (!obrazek.naturalWidth || !stage.clientWidth) return;
    const ratio = obrazek.naturalWidth / obrazek.naturalHeight;
    const limitHeight = Math.min(680, Math.max(320, window.innerHeight * 0.7));
    const width = Math.min(stage.clientWidth - 24, 1120, limitHeight * ratio);
    platno.style.width = `${Math.round(width)}px`;
    platno.style.height = `${Math.round(width / ratio)}px`;
  }
  obrazek.addEventListener("load", fit);
  if (obrazek.complete) queueMicrotask(fit);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      if (!stage.isConnected) { observer.disconnect(); return; }
      fit();
    });
    observer.observe(stage);
  } else window.addEventListener("resize", fit, { once: true });

  if (ctx.editing) {
    stage.append(h("p", { class: "floorplan-stage__hint", text: t.floorplan.editHint }));
    vrstva.classList.add("plan__vrstva--edit");
    vrstva.addEventListener("click", (event) => {
      if (event.target !== vrstva) return;
      const rect = vrstva.getBoundingClientRect();
      const coords = {
        x: Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100)),
        y: Math.min(100, Math.max(0, (event.clientY - rect.top) / rect.height * 100)),
      };
      vybratUmisteni(ctx, plan, coords);
    });
  } else if (ctx.jeTechnik && !plan.points.length && !(plan.rooms || []).length) {
    stage.append(button(t.floorplan.addFirst, () => ctx.startEditing()));
  }

  for (const bod of plan.points) {
    const entity = vse.get(bod.entityRef || bod.entityId);
    if (!entity) continue;
    vrstva.append(znacka(ctx, plan, bod, entity, vse, platno));
  }

  const mistnosti = new Map(rooms.map((room) => [String(room.id), room]));
  for (const marker of plan.rooms || []) {
    const room = mistnosti.get(String(marker.roomId));
    if (room) vrstva.append(znackaMistnosti(ctx, plan, marker, room, vse, platno, selectRoom));
  }

  return stage;
}

function znackaMistnosti(ctx, plan, marker, room, vse, platno, selectRoom) {
  return znackaPlan(ctx, plan, marker, room, vse, platno, selectRoom, true);
}

function znacka(ctx, plan, marker, entity, vse, platno) {
  return znackaPlan(ctx, plan, marker, entity, vse, platno, () => {}, false);
}

function znackaPlan(ctx, plan, marker, owner, vse, platno, selectRoom, isRoom) {
  const color = ["mint", "blue", "violet", "amber", "rose"].includes(marker.color)
    ? marker.color : "default";
  const size = ["s", "m", "l", "xl"].includes(marker.size) ? marker.size : "m";
  const name = marker.label || owner.name || t.rooms.unassigned;
  const display = marker.display || "both";
  const hit = h("button", {
    class: "plan__bod-hit", type: "button", "aria-label": name,
  }, [
    display !== "label" && (marker.icon ? icon(marker.icon) :
      isRoom ? icon("rooms") : iconFor(owner)),
    display !== "icon" && h("span", { class: "plan__jmeno", text: name }),
  ]);
  const element = h("div", {
    class: `plan__bod${isRoom ? " plan__room" : ""} plan__bod--tone-${color} plan__bod--${size} plan__bod--display-${display}`,
  }, [
    hit,
    ctx.editing && h("button", {
      class: "plan__bod-edit", type: "button", text: "⋯",
      "aria-label": `${t.editor.editPoint}: ${name}`,
      onclick: () => editMarker(ctx, plan, marker, owner, isRoom),
    }),
  ]);
  element.style.left = `${marker.x}%`;
  element.style.top = `${marker.y}%`;
  element.style.setProperty("--plan-scale", String((marker.scale || 100) / 100));
  if (ctx.editing) {
    element.classList.add("plan__bod--edit");
    element.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".plan__bod-edit")) return;
      zacitTahat(event, element, marker, plan, platno);
    });
  } else {
    installGestures(hit, (gesture) => {
      const fallback = gesture === "single"
        ? isRoom ? { mode: "none" } : { mode: "details", entityRef: owner.ref || owner.id }
        : { mode: "none" };
      const action = marker.actions?.[gesture] || fallback;
      if (action.mode === "room") return selectRoom(owner.id);
      if (action.mode === "none") return;
      const target = vse.get(action.entityRef || owner.ref || owner.id);
      if (!target) return toast(t.floorplan.targetMissing, true);
      if (action.mode === "details") return openControls(target);
      return api.action(target.id, action.mode).catch((error) => toast(error.message, true));
    }, Boolean(marker.actions?.double && marker.actions.double.mode !== "none"),
    Boolean(marker.actions?.hold && marker.actions.hold.mode !== "none"));
  }

  const feedbackRef = marker.feedbackRef || (!isRoom ? owner.ref || owner.id : null);
  const source = vse.get(feedbackRef);
  function updateFeedback(entity) {
    const feedback = marker.feedback || (isRoom ? "none" : "state");
    const active = feedback !== "none" && entity.state === "on";
    element.classList.toggle("plan__bod--on", active);
    element.classList.remove("plan__bod--live-color");
    element.style.removeProperty("--plan-live-color");
    if (active && feedback === "light_color") {
      const rgb = entity.attributes?.rgb_color;
      if (Array.isArray(rgb) && rgb.length === 3 && rgb.every((n) =>
        Number.isInteger(n) && n >= 0 && n <= 255)) {
        element.style.setProperty("--plan-live-color", `rgb(${rgb.join(",")})`);
        element.classList.add("plan__bod--live-color");
      }
    }
  }
  if (source) {
    updateFeedback(source);
    watch(source.id, (next) => { if (element.isConnected) updateFeedback(next); });
  }
  return element;
}

function installGestures(hit, run, hasDouble, hasHold) {
  let tapTimer = null;
  let holdTimer = null;
  let held = false;
  let origin = null;
  hit.addEventListener("pointerdown", (event) => {
    if (!hasHold || event.button !== 0) return;
    held = false;
    origin = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => { held = true; run("hold"); }, 600);
  });
  hit.addEventListener("pointermove", (event) => {
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) {
      clearTimeout(holdTimer);
      origin = null;
    }
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    hit.addEventListener(eventName, () => { clearTimeout(holdTimer); origin = null; });
  }
  hit.addEventListener("contextmenu", (event) => {
    if (!hasHold) return;
    event.preventDefault();
    clearTimeout(holdTimer);
    if (held) return;
    held = true;
    run("hold");
  });
  hit.addEventListener("click", () => {
    if (held) { held = false; return; }
    if (!hasDouble) { run("single"); return; }
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      run("double");
    } else tapTimer = setTimeout(() => {
      tapTimer = null;
      run("single");
    }, 300);
  });
}

const ACTIONS_BY_KIND = {
  light: ["toggle", "turn_on", "turn_off"],
  switch: ["toggle", "turn_on", "turn_off"],
  fan: ["toggle", "turn_on", "turn_off"],
  automation: ["toggle", "turn_on", "turn_off", "run"],
  scene: ["activate"], script: ["run"], button: ["press"],
  counter: ["increment", "decrement", "reset"],
  timer: ["start", "pause", "cancel"],
  cover: ["open", "close", "stop"],
  lock: ["open"],
};

function targetPicker(entities, initial, onChange = () => {}) {
  let value = initial || "";
  const selected = () => entities.find((entity) => (entity.ref || entity.id) === value);
  const trigger = button(selected()?.name || t.floorplan.chooseTarget, () => {
    search.hidden = !search.hidden;
    list.hidden = search.hidden;
    if (!search.hidden) { draw(); search.focus(); }
  }, "button--ghost");
  const search = h("input", { class: "input", type: "search",
    placeholder: t.picker.search, "aria-label": t.picker.search });
  const list = h("div", { class: "floorplan-target-picker__list" });
  search.hidden = true;
  list.hidden = true;
  function draw() {
    const query = search.value.trim().toLocaleLowerCase();
    const found = entities.filter((entity) =>
      !query || `${entity.name} ${entity.domain}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(...found.slice(0, 40).map((entity) => button(
      `${entity.name} · ${entity.domain}`, () => {
        value = entity.ref || entity.id;
        trigger.textContent = entity.name;
        search.hidden = true;
        list.hidden = true;
        onChange(entity);
      }, "floorplan-target-picker__item")));
    if (!found.length) list.append(emptyState(t.picker.nothing));
  }
  search.addEventListener("input", draw);
  return { element: h("div", { class: "floorplan-target-picker" }, [trigger, search, list]),
    get value() { return value; }, get entity() { return selected(); } };
}

function setOptions(select, options, preferred) {
  select.replaceChildren(...options.map(([value, label]) =>
    h("option", { value, text: label })));
  select.value = options.some(([value]) => value === preferred) ? preferred : options[0][0];
}

async function editMarker(ctx, plan, marker, owner, isRoom, addOnSave = false) {
  let entities;
  try {
    entities = (await api.floorplanTargets()).entities || [];
  } catch (error) {
    toast(error.message, true);
    return;
  }
  const name = marker.label || owner.name;
  const appearance = h("div", { class: "stack" });
  const display = selectInput([
    { value: "both", label: t.floorplan.displayBoth },
    { value: "icon", label: t.floorplan.displayIcon },
    { value: "label", label: t.floorplan.displayLabel },
  ], marker.display || "both");
  appearance.append(field(t.floorplan.display, display));
  const scale = numberInput(marker.scale || 100, 50, 250, 10);
  const x = numberInput(marker.x, 0, 100, 0.1);
  const y = numberInput(marker.y, 0, 100, 0.1);
  appearance.append(field(t.floorplan.scale, scale),
    field(t.floorplan.positionX, x), field(t.floorplan.positionY, y));

  const feedback = selectInput([], marker.feedback || (isRoom ? "none" : "state"));
  const feedbackTarget = targetPicker(entities,
    marker.feedbackRef || (!isRoom ? owner.ref || owner.id : ""), refreshFeedback);
  function refreshFeedback() {
    const options = [["none", t.floorplan.feedbackNone]];
    if (feedbackTarget.entity) options.push(["state", t.floorplan.feedbackState]);
    if (feedbackTarget.entity?.domain === "light") {
      options.push(["light_color", t.floorplan.feedbackLightColor]);
    }
    setOptions(feedback, options, feedback.value || marker.feedback || "none");
  }
  refreshFeedback();
  appearance.append(field(t.floorplan.feedback, feedback),
    field(t.floorplan.feedbackTarget, feedbackTarget.element));

  const gestureRows = {};
  for (const gesture of ["single", "double", "hold"]) {
    const current = marker.actions?.[gesture] || (gesture === "single"
      ? { mode: isRoom ? "none" : "details", entityRef: owner.ref || owner.id }
      : { mode: "none" });
    const mode = selectInput([], current.mode);
    const picker = targetPicker(entities,
      current.entityRef || (!isRoom ? owner.ref || owner.id : ""), refreshMode);
    const targetField = field(t.floorplan.actionTarget, picker.element);
    function refreshMode() {
      const options = [["none", t.floorplan.actionModes.none]];
      if (isRoom) options.push(["room", t.floorplan.actionModes.room]);
      if (picker.entity) {
        options.push(["details", t.floorplan.actionModes.details]);
        for (const action of ACTIONS_BY_KIND[picker.entity.capability?.kind] || []) {
          options.push([action, t.floorplan.actionModes[action]]);
        }
      }
      setOptions(mode, options, mode.value || current.mode);
    }
    mode.addEventListener("change", refreshMode);
    refreshMode();
    appearance.append(h("div", { class: "floorplan-action-row" }, [
      field(t.floorplan.gestures[gesture], mode), targetField,
    ]));
    gestureRows[gesture] = { mode, picker };
  }

  if (!isRoom) {
    const anchor = targetPicker(entities, marker.entityRef || owner.ref || owner.id);
    appearance.prepend(field(t.floorplan.iconEntity, anchor.element));
    appearance.anchor = anchor;
  }
  if (!addOnSave) appearance.append(button(t.favorites.remove, async () => {
    closeDialog();
    if (isRoom) plan.rooms = plan.rooms.filter((item) => item !== marker);
    else plan.points = plan.points.filter((item) => item !== marker);
    await ulozitBody(ctx, plan);
  }, "button--ghost"));

  editAppearance(name, marker, async (style) => {
    Object.assign(marker, style);
    marker.display = display.value;
    marker.scale = Math.min(250, Math.max(50, Number(scale.value) || 100));
    marker.x = Math.min(100, Math.max(0, Number(x.value) || 0));
    marker.y = Math.min(100, Math.max(0, Number(y.value) || 0));
    marker.feedback = feedback.value;
    if (marker.feedback === "none") delete marker.feedbackRef;
    else marker.feedbackRef = feedbackTarget.value;
    if (!isRoom) marker.entityRef = appearance.anchor.value;
    marker.actions = Object.fromEntries(Object.entries(gestureRows).map(([key, row]) =>
      [key, row.mode.value === "none" || row.mode.value === "room"
        ? { mode: row.mode.value }
        : { mode: row.mode.value, entityRef: row.picker.value }]));
    if (addOnSave) {
      if (isRoom) plan.rooms.push(marker);
      else plan.points.push(marker);
    }
    await ulozitBody(ctx, plan);
  }, { extra: appearance });
}

async function ulozitBody(ctx, plan) {
  try {
    await api.saveFloorplan({ points: plan.points, rooms: plan.rooms || [] });
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

function zacitTahat(udalost, prvek, bod, plan, platno) {
  udalost.preventDefault();
  prvek.setPointerCapture?.(udalost.pointerId);
  let moved = false;

  function pohyb(dalsi) {
    const misto = platno.getBoundingClientRect();
    if (!misto.width || !misto.height) return;
    moved = true;

    bod.x = Math.min(
      100,
      Math.max(0, ((dalsi.clientX - misto.left) / misto.width) * 100),
    );
    bod.y = Math.min(
      100,
      Math.max(0, ((dalsi.clientY - misto.top) / misto.height) * 100),
    );

    prvek.style.left = `${bod.x}%`;
    prvek.style.top = `${bod.y}%`;
  }

  async function konec() {
    window.removeEventListener("pointermove", pohyb);
    window.removeEventListener("pointerup", konec);
    if (!moved) return;

    try {
      await api.saveFloorplan({ points: plan.points, rooms: plan.rooms || [] });
      toast(t.editor.saved);
    } catch (error) {
      toast(error.message, true);
    }
  }

  window.addEventListener("pointermove", pohyb, { passive: false });
  window.addEventListener("pointerup", konec);
}

/* ------------------------------------------------------------------ */
/* Nahrání obrázku                                                     */
/* ------------------------------------------------------------------ */

function nahrat(ctx) {
  const vstup = h("input", {
    class: "input",
    type: "file",
    accept: "image/png,image/jpeg,image/webp",
  });
  const hledat = h("input", {
    class: "input", type: "search", placeholder: t.floorplan.haSearch,
    "aria-label": t.floorplan.haSearch,
  });
  const seznam = h("div", { class: "floorplan-file-list" },
    h("p", { class: "muted", text: t.floorplan.haLoading }));
  const haPanel = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.floorplan.haHint }), hledat, seznam,
  ]);
  const computerPanel = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.floorplan.uploadHint }), vstup,
  ]);
  computerPanel.hidden = true;
  let source = "ha";
  let selected = null;
  let files = [];

  const haTab = button(t.floorplan.fromHa, () => show("ha"), "floorplan-file-tab");
  const computerTab = button(t.floorplan.fromComputer,
    () => show("computer"), "floorplan-file-tab");
  function show(next) {
    source = next;
    haPanel.hidden = next !== "ha";
    computerPanel.hidden = next !== "computer";
    haTab.setAttribute("aria-pressed", String(next === "ha"));
    computerTab.setAttribute("aria-pressed", String(next === "computer"));
  }

  function drawFiles() {
    const query = hledat.value.trim().toLocaleLowerCase();
    const visible = files.filter((file) =>
      `${file.source} ${file.path}`.toLocaleLowerCase().includes(query));
    seznam.replaceChildren();
    if (!visible.length) {
      seznam.append(h("p", { class: "muted", text: t.floorplan.haEmpty }));
      return;
    }
    for (const file of visible) {
      const item = button("", () => {
        selected = file;
        drawFiles();
      }, "floorplan-file-item");
      item.setAttribute("aria-pressed", String(selected?.source === file.source
        && selected?.path === file.path));
      item.replaceChildren(
        h("strong", { text: file.name }),
        h("small", { text: `${file.source === "www" ? "www" : `Média / ${file.source.slice(6)}`}${file.folder ? ` / ${file.folder}` : ""} · ${Math.ceil(file.size / 1024)} KB` }),
      );
      seznam.append(item);
    }
  }
  hledat.addEventListener("input", drawFiles);
  show("ha");

  dialog(
    t.floorplan.upload,
    h("div", { class: "stack" }, [
      h("div", { class: "floorplan-file-tabs" }, [haTab, computerTab]),
      haPanel, computerPanel,
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, async () => {
        try {
          if (source === "ha") {
            if (!selected) return toast(t.floorplan.haPickFile, true);
            await api.selectFloorplanFile({ source: selected.source, path: selected.path });
          } else {
            const soubor = vstup.files?.[0];
            if (!soubor) return toast(t.floorplan.pickFile, true);
            const data = await precist(soubor);
            await api.uploadFloorplan(data);
          }
          closeDialog();
          toast(t.notice.saved);
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  );

  api.floorplanFiles().then((result) => {
    if (!seznam.isConnected) return;
    files = result.files || [];
    drawFiles();
  }).catch((error) => {
    if (seznam.isConnected) seznam.replaceChildren(
      h("p", { class: "muted", text: `${t.floorplan.haLoadFailed} ${error.message}` }));
  });
}

function precist(soubor) {
  return new Promise((hotovo, chyba) => {
    const ctecka = new FileReader();
    ctecka.onload = () => hotovo(ctecka.result);
    ctecka.onerror = () => chyba(new Error(t.floorplan.readFailed));
    ctecka.readAsDataURL(soubor);
  });
}

/* ------------------------------------------------------------------ */
/* Přidání zařízení na plán                                            */
/* ------------------------------------------------------------------ */

function vybratUmisteni(ctx, plan, coords) {
  dialog(t.floorplan.placeTitle, h("p", { class: "muted", text: t.floorplan.placeHint }),
    h("div", { class: "row" }, [
      button(t.floorplan.addRoom, () => { closeDialog(); pridatMistnost(ctx, plan, coords); }),
      button(t.floorplan.addIcon, () => { closeDialog(); pridatBod(ctx, plan, coords); }, "button--ghost"),
    ]));
}

function pridatMistnost(ctx, plan, coords = { x: 50, y: 50 }) {
  const existing = new Set((plan.rooms || []).map((marker) => String(marker.roomId)));
  const available = (plan.availableRooms || ctx.model.rooms || [])
    .filter((room) => room.id && !existing.has(String(room.id)));
  if (!available.length) {
    toast(t.floorplan.noRoomsToAdd, true);
    return;
  }
  const choice = selectInput(available.map((room) => ({
    value: String(room.id), label: room.name,
  })), String(available[0].id));
  dialog(t.floorplan.addRoom, h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.floorplan.roomAddHint }), choice,
  ]), h("div", { class: "row" }, [
    button(t.action.cancel, closeDialog, "button--ghost"),
    button(t.action.add, async () => {
      const room = available.find((item) => String(item.id) === choice.value);
      closeDialog();
      await editMarker(ctx, plan, { roomId: choice.value, ...coords }, room, true, true);
    }),
  ]));
}

async function pridatBod(ctx, plan, coords = { x: 50, y: 50 }) {
  let entities;
  try {
    entities = (await api.floorplanTargets()).entities || [];
  } catch (error) {
    toast(error.message, true);
    return;
  }
  const jiz = new Set(plan.points.map((b) => b.entityRef || b.entityId));
  const available = entities.some((entity) => !jiz.has(entity.ref || entity.id));
  if (!available) {
    toast(t.floorplan.nothingToAdd, true);
    return;
  }
  vybratZarizeni(ctx, {
    nadpis: t.floorplan.addIcon,
    entities,
    filtr: (entity) => !jiz.has(entity.ref || entity.id),
    onVyber: async (ref) => {
      const owner = entities.find((entity) => (entity.ref || entity.id) === ref);
      await editMarker(ctx, plan, { entityRef: ref, ...coords }, owner, false, true);
    },
  });
}
