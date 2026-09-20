/* Domů - dashboard domácnosti. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { tile } from "./controls.js";
import { h, button, emptyState, section, toast } from "./ui.js";

export function renderHome(root, ctx) {
  const model = ctx.model;
  const summary = model.summary || {};

  root.append(statsRow(summary));

  if (summary.alerts?.length) {
    root.append(
      section(
        t.home.alerts,
        h(
          "div",
          { class: "stack" },
          summary.alerts.map((entity) => tile(entity)),
        ),
      ),
    );
  }

  root.append(
    section(
      t.home.title,
      h("div", { class: "row" }, [
        button(t.home.allLightsOff, () => turnAllLightsOff(model)),
      ]),
    ),
  );

  if (!model.rooms.length) {
    root.append(emptyState(t.empty.text));
    return;
  }

  const grid = h("div", { class: "rooms" });
  for (const room of model.rooms) {
    grid.append(roomCard(room));
  }
  root.append(grid);
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

function roomCard(room) {
  return h("section", { class: "room" }, [
    h("div", { class: "room__head" }, [
      h("h2", { class: "room__name", text: room.name || t.rooms.unassigned }),
      room.floorName && h("span", { class: "room__floor", text: room.floorName }),
    ]),
    h(
      "div",
      { class: "stack" },
      room.entities.map((entity) => tile(entity)),
    ),
  ]);
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
