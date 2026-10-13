/* Půdorys bytu.
 *
 * Obrázek nahraje správce, zařízení se na něj rozmístí přetažením.
 * Souřadnice se ukládají v procentech plochy, takže plán funguje stejně
 * na telefonu i na nástěnném panelu.
 */

import { api } from "./api.js";
import { t, describeState } from "./i18n.js";
import { openControls } from "./controls.js";
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
          button(t.floorplan.addDevice, () => pridatBod(ctx, plan), "button--ghost"),
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
  root.append(roomsView.element);
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
  const extra = defaults.filter((block) =>
    block.type === "headline"
      ? !stored.some((saved) => saved.type === "headline")
      : !savedRooms.has(block.roomId));
  return [...extra.filter((block) => block.type === "headline"), ...stored,
    ...extra.filter((block) => block.type === "room")].slice(0, 30);
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
  if (!rooms.length) return { element: emptyState(t.rooms.empty), select: () => {} };
  const blockFor = (room) => blocks.find((block) =>
    block.type === "room" && String(block.roomId) === String(room.id));
  const orderedRooms = [...rooms].sort((a, b) =>
    (blocks.indexOf(blockFor(a)) < 0 ? blocks.length : blocks.indexOf(blockFor(a)))
    - (blocks.indexOf(blockFor(b)) < 0 ? blocks.length : blocks.indexOf(blockFor(b))));

  const saveBlock = (changed) => saveFloorplanBoard(ctx, blocks.map((block) =>
    block.id === changed.id ? changed : block));

  const root = h("section", { class: "floorplan-rooms" + (schematic ? " floorplan-rooms--schematic" : "") });
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
  root.append(map, detail);
  draw();
  return {
    element: root,
    select: (roomId) => {
      if (!orderedRooms.some((room) => String(room.id) === String(roomId))) return;
      active = String(roomId);
      selectedRoomId = active;
      draw();
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Plán s body                                                         */
/* ------------------------------------------------------------------ */

function platno(ctx, plan, rooms, selectRoom) {
  const vse = new Map(
    ctx.allEntities().flatMap((e) => [
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
    vrstva.append(znacka(ctx, plan, bod, entity, platno));
  }

  const mistnosti = new Map(rooms.map((room) => [String(room.id), room]));
  for (const marker of plan.rooms || []) {
    const room = mistnosti.get(String(marker.roomId));
    if (room) vrstva.append(znackaMistnosti(ctx, plan, marker, room, platno, selectRoom));
  }

  return stage;
}

function znackaMistnosti(ctx, plan, marker, room, platno, selectRoom) {
  const color = ["mint", "blue", "violet", "amber", "rose"].includes(marker.color)
    ? marker.color : "default";
  const size = ["s", "m", "l", "xl"].includes(marker.size) ? marker.size : "m";
  const name = marker.label || room.name || t.rooms.unassigned;
  const element = h("div", {
    class: `plan__bod plan__room plan__bod--tone-${color} plan__bod--${size}`,
  }, [
    h("button", {
      class: "plan__bod-hit", type: "button",
      "aria-label": `${t.floorplan.selectedRoom}: ${name}`,
      onclick: () => { if (!ctx.editing) selectRoom(room.id); },
    }, [marker.icon ? icon(marker.icon) : icon("rooms"), h("span", { text: name })]),
    ctx.editing && h("button", {
      class: "plan__bod-edit", type: "button", text: "⋯",
      "aria-label": `${t.floorplan.editRoom}: ${name}`,
      onclick: () => upravitMistnost(ctx, plan, marker, room),
    }),
  ]);
  element.style.left = `${marker.x}%`;
  element.style.top = `${marker.y}%`;
  if (ctx.editing) {
    element.classList.add("plan__bod--edit");
    element.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".plan__bod-edit")) return;
      zacitTahat(event, element, marker, plan, platno);
    });
  }
  return element;
}

function upravitMistnost(ctx, plan, marker, room) {
  const extra = button(t.favorites.remove, async () => {
    closeDialog();
    plan.rooms = plan.rooms.filter((item) => item !== marker);
    await ulozitBody(ctx, plan);
  }, "button--ghost");
  editAppearance(marker.label || room.name, marker, async (appearance) => {
    Object.assign(marker, appearance);
    await ulozitBody(ctx, plan);
  }, { extra });
}

function znacka(ctx, plan, bod, entity, platno) {
  const { tone } = describeState(entity);
  const color = ["mint", "blue", "violet", "amber", "rose"].includes(bod.color)
    ? bod.color : "default";
  const size = ["s", "m", "l", "xl"].includes(bod.size) ? bod.size : "m";
  const prvek = h("div", {
    class: `plan__bod plan__bod--${tone} plan__bod--tone-${color} plan__bod--${size}`,
  }, [
    h("button", {
      class: "plan__bod-hit", type: "button",
      "aria-label": bod.label || entity.name,
      onclick: () => { if (!ctx.editing) openControls(entity); },
    }, [
      bod.icon ? icon(bod.icon, "icon") : iconFor(entity, "icon"),
      h("span", { class: "plan__jmeno", text: bod.label || entity.name }),
    ]),
    ctx.editing && h("button", {
      class: "plan__bod-edit", type: "button", text: "⋯",
      "aria-label": t.editor.editPoint,
      onclick: () => upravitBod(ctx, plan, bod, entity),
    }),
  ]);

  prvek.style.left = `${bod.x}%`;
  prvek.style.top = `${bod.y}%`;

  if (ctx.editing) {
    prvek.classList.add("plan__bod--edit");
    prvek.addEventListener("pointerdown", (udalost) => {
      if (udalost.target.closest(".plan__bod-edit")) return;
      zacitTahat(udalost, prvek, bod, plan, platno);
    });
  }

  return prvek;
}

function upravitBod(ctx, plan, bod, entity) {
  const extra = h("div", { class: "row" }, [
    button(t.favorites.replace, () => {
      closeDialog();
      vybratZarizeni(ctx, {
        nadpis: t.favorites.replace,
        onVyber: async (ref) => {
          bod.entityRef = ref;
          await ulozitBody(ctx, plan);
        },
      });
    }, "button--ghost"),
    button(t.favorites.remove, async () => {
      closeDialog();
      plan.points = plan.points.filter((p) => p !== bod);
      await ulozitBody(ctx, plan);
    }, "button--ghost"),
  ]);
  editAppearance(bod.label || entity.name, bod, async (appearance) => {
    Object.assign(bod, appearance);
    await ulozitBody(ctx, plan);
  }, { extra });
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
      button(t.floorplan.addDevice, () => { closeDialog(); pridatBod(ctx, plan, coords); }, "button--ghost"),
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
      plan.rooms = [...(plan.rooms || []), { roomId: choice.value, ...coords }];
      closeDialog();
      await ulozitBody(ctx, plan);
    }),
  ]));
}

function pridatBod(ctx, plan, coords = { x: 50, y: 50 }) {
  const jiz = new Set(plan.points.map((b) => b.entityRef || b.entityId));
  const available = ctx.allEntities().some((entity) =>
    entity.capability?.controllable && !jiz.has(entity.ref || entity.id));
  if (!available) {
    toast(t.floorplan.nothingToAdd, true);
    return;
  }
  vybratZarizeni(ctx, {
    nadpis: t.floorplan.addDevice,
    filtr: (entity) => entity.capability?.controllable && !jiz.has(entity.ref || entity.id),
    onVyber: async (ref) => {
      plan.points.push({ entityRef: ref, ...coords });
      await ulozitBody(ctx, plan);
    },
  });
}
