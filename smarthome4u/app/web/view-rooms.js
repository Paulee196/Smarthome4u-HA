/* Místnosti - ovládání po místnostech a správa struktury. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import {
  h,
  button,
  closeDialog,
  confirmDialog,
  dialog,
  emptyState,
  field,
  numberInput,
  section,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

export function renderRooms(root, ctx) {
  const model = ctx.model;

  root.append(
    h("div", { class: "row row--end" }, [
      button(t.rooms.manage, () => openManager(ctx), "button--ghost"),
    ]),
  );

  if (!model.rooms.length) {
    root.append(emptyState(t.rooms.empty));
    return;
  }

  const grid = h("div", { class: "view" });
  for (const room of model.rooms) {
    grid.append(
      h("section", { class: "panel" }, [
        h("div", { class: "panel__head" }, [
          h("h2", { class: "panel__title", text: room.name || t.rooms.unassigned }),
          room.floorName && h("span", { class: "panel__sub", text: room.floorName }),
        ]),
        h(
          "div",
          { class: "cards" },
          room.entities.map((entity) => card(entity)),
        ),
      ]),
    );
  }
  root.append(grid);
}

/* ------------------------------------------------------------------ */
/* Správa pater a místností                                            */
/* ------------------------------------------------------------------ */

async function openManager(ctx) {
  let structure;
  try {
    structure = await api.structure();
  } catch (error) {
    toast(error.message, true);
    return;
  }

  const body = h("div", { class: "stack" });

  const floorOptions = () => [
    { value: "", label: t.rooms.noFloor },
    ...structure.floors.map((floor) => ({ value: floor.id, label: floor.name })),
  ];

  body.append(
    section(
      t.rooms.title,
      [
        structure.areas.length
          ? h(
              "div",
              { class: "stack" },
              structure.areas.map((area) =>
                manageRow(
                  area.name,
                  `${area.deviceCount} ${t.rooms.deviceCount}`,
                  () => editArea(ctx, area, floorOptions()),
                  () => removeArea(ctx, area),
                ),
              ),
            )
          : emptyState(t.rooms.empty),
        h("p", { class: "muted", text: t.rooms.deleteRoomHint }),
      ],
      button(t.rooms.addRoom, () => createArea(ctx, floorOptions()), "button--ghost"),
    ),
  );

  body.append(
    section(
      t.rooms.floor,
      structure.floors.length
        ? h(
            "div",
            { class: "stack" },
            structure.floors.map((floor) =>
              manageRow(
                floor.name,
                `${t.rooms.level} ${floor.level}`,
                () => editFloor(ctx, floor),
                () => removeFloor(ctx, floor),
              ),
            ),
          )
        : emptyState(t.rooms.noFloor),
      button(t.rooms.addFloor, () => createFloor(ctx), "button--ghost"),
    ),
  );

  dialog(t.rooms.manage, body);
}

function manageRow(title, subtitle, onEdit, onDelete) {
  return h("div", { class: "tile" }, [
    h("div", { class: "tile__main tile__main--static" }, [
      h("span", { class: "tile__body" }, [
        h("span", { class: "tile__name", text: title }),
        h("span", { class: "tile__state", text: subtitle }),
      ]),
    ]),
    h("button", {
      class: "tile__more",
      type: "button",
      "aria-label": t.action.rename,
      text: "✎",
      onclick: onEdit,
    }),
    h("button", {
      class: "tile__more tile__more--danger",
      type: "button",
      "aria-label": t.action.delete,
      text: "🗑",
      onclick: onDelete,
    }),
  ]);
}

function createArea(ctx, floors) {
  const name = textInput("", t.rooms.roomName);
  const floor = selectInput(floors, "");

  dialog(
    t.rooms.addRoom,
    h("div", { class: "stack" }, [
      field(t.rooms.roomName, name),
      field(t.rooms.floor, floor),
    ]),
    saveRow(async () => {
      await api.createArea({ name: name.value, floorId: floor.value || null });
      await done(ctx);
    }),
  );
}

function editArea(ctx, area, floors) {
  const name = textInput(area.name);
  const floor = selectInput(floors, area.floorId || "");

  dialog(
    area.name,
    h("div", { class: "stack" }, [
      field(t.rooms.roomName, name),
      field(t.rooms.floor, floor),
    ]),
    saveRow(async () => {
      await api.updateArea(area.id, {
        name: name.value,
        floorId: floor.value || null,
      });
      await done(ctx);
    }),
  );
}

function removeArea(ctx, area) {
  confirmDialog(area.name, t.rooms.deleteRoomHint, async () => {
    try {
      await api.deleteArea(area.id);
      await done(ctx);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

function createFloor(ctx) {
  const name = textInput("", t.rooms.floorName);
  const level = numberInput(0, -10, 50);

  dialog(
    t.rooms.addFloor,
    h("div", { class: "stack" }, [
      field(t.rooms.floorName, name),
      field(t.rooms.level, level),
    ]),
    saveRow(async () => {
      await api.createFloor({ name: name.value, level: Number(level.value) });
      await done(ctx);
    }),
  );
}

function editFloor(ctx, floor) {
  const name = textInput(floor.name);
  const level = numberInput(floor.level, -10, 50);

  dialog(
    floor.name,
    h("div", { class: "stack" }, [
      field(t.rooms.floorName, name),
      field(t.rooms.level, level),
    ]),
    saveRow(async () => {
      await api.updateFloor(floor.id, {
        name: name.value,
        level: Number(level.value),
      });
      await done(ctx);
    }),
  );
}

function removeFloor(ctx, floor) {
  confirmDialog(floor.name, t.action.confirmDelete, async () => {
    try {
      await api.deleteFloor(floor.id);
      await done(ctx);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

function saveRow(save) {
  return h("div", { class: "row" }, [
    button(t.action.cancel, closeDialog, "button--ghost"),
    button(t.action.save, async () => {
      try {
        await save();
      } catch (error) {
        toast(error.message, true);
      }
    }),
  ]);
}

async function done(ctx) {
  closeDialog();
  toast(t.notice.saved);
  await ctx.refresh();
}
