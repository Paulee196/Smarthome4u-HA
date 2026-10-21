import assert from "node:assert/strict";
import { moveDashboardEntity, visibleRoomRefs } from
  "../custom_components/smarthome4u/frontend/dashboard-transfer.js";

const entityRef = (entity) => entity.ref;
const rooms = [
  { id: "kitchen", entities: [{ ref: "light.kitchen" }, { ref: "switch.kettle" }] },
  { id: "living", entities: [{ ref: "light.living" }] },
];
const blocks = [
  { id: "automatic", type: "auto_rooms", roomLayouts: {
    kitchen: { sizes: { "light.kitchen": "l" },
      tileStyles: { "light.kitchen": { label: "Linka" } } },
  } },
  { id: "favorites", type: "entities", entities: ["light.living"] },
];

const moved = moveDashboardEntity(blocks, rooms, "auto-kitchen", "auto-living",
  "light.kitchen", 0, entityRef);
assert.deepEqual(visibleRoomRefs(rooms[0], moved[0].roomLayouts.kitchen, entityRef),
  ["switch.kettle"]);
assert.deepEqual(visibleRoomRefs(rooms[1], moved[0].roomLayouts.living, entityRef),
  ["light.kitchen", "light.living"]);
assert.deepEqual(moved[0].roomLayouts.living.sizes, { "light.kitchen": "l" });
assert.equal(moved[0].roomLayouts.living.tileStyles["light.kitchen"].label, "Linka");
assert.deepEqual(visibleRoomRefs(rooms[0], blocks[0].roomLayouts.kitchen, entityRef),
  ["light.kitchen", "switch.kettle"]);

const toFavorites = moveDashboardEntity(moved, rooms, "auto-living", "favorites",
  "light.kitchen", 1, entityRef);
assert.deepEqual(toFavorites[1].entities, ["light.living", "light.kitchen"]);
assert.deepEqual(visibleRoomRefs(rooms[1], toFavorites[0].roomLayouts.living, entityRef),
  ["light.living"]);
assert.equal(moveDashboardEntity(blocks, rooms, "auto-kitchen", "missing",
  "light.kitchen", 0, entityRef), null);
console.log("Přesun mezi sekcemi zachovává pořadí i vzhled dlaždice.");
