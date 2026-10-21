import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { api } from "../custom_components/smarthome4u/frontend/api.js";
import { BLOKY } from "../custom_components/smarthome4u/frontend/blocks.js";
import { card, clearWatchers, openControls, applyStates } from "../custom_components/smarthome4u/frontend/controls.js";
import { setHost, closeDialog } from "../custom_components/smarthome4u/frontend/ui.js";

const { document, window } = parseHTML("<html><body><main class='shell'></main></body></html>");
globalThis.document = document;
globalThis.window = window;
// linkedom does not implement the browser's writable HTMLSelectElement.value.
Object.defineProperty(Object.getPrototypeOf(document.createElement("select")), "value", {
  configurable: true,
  get() { return this.getAttribute("data-test-value") || this.querySelector("option")?.getAttribute("value") || ""; },
  set(value) { this.setAttribute("data-test-value", value); },
});
setHost(document.body);
const actions = [];
api.action = async (...args) => { actions.push(args); };
const click = (element) => {
  assert.ok(element, "missing clickable control");
  assert.equal(element.disabled, false, "control must be enabled");
  element.dispatchEvent(new window.Event("click", { bubbles: true }));
};
const entity = (kind, state = "on", capability = {}, attributes = {}) => ({
  id: `${kind}.test`, ref: `${kind}.test`, name: `Test ${kind}`, available: true,
  state, capability: { kind, ...capability }, attributes,
});
const light = entity("light", "on", { dimmable: true }, { brightness: 128 });
const cover = entity("cover", "open", { open: true, close: true, stop: true, position: true },
  { current_position: 45 });
const player = entity("media_player", "playing",
  { canPlay: true, canPause: true, canStop: true, canPrevious: true, canNext: true, volume: true },
  { media_title: "Skladba", volume_level: 0.5 });
const scene = entity("scene", "scening");
const room = { id: "living", name: "Obývák", entities: [light, cover, player] };
const ctx = {
  editing: false,
  model: { rooms: [room], roomSummaries: [{ id: room.id, name: room.name, count: 3,
    temperature: null, lightsOn: 1 }], scenes: [scene], attention: [cover],
  summary: { lightsOn: 1, lightNames: [light.name], openCount: 1,
    openNames: [cover.name], unlockedCount: 0, unlockedNames: [], alerts: [cover] } },
  allEntities: () => room.entities,
  entityByRef: (ref) => [...room.entities, scene].find((item) => item.ref === ref),
  entityRef: (item) => item.ref,
  navigate: () => { throw Error("Room card opened a generic page"); },
};

for (const kind of ["light", "switch", "fan", "cover", "climate", "lock",
  "number", "select", "text", "datetime", "counter", "timer", "media_player",
  "camera", "scene", "script", "automation", "button", "sensor", "binary_sensor"]) {
  const sample = kind === "light" ? light : kind === "cover" ? cover
    : kind === "media_player" ? player : entity(kind);
  for (const size of ["m", "xl"]) {
    const tile = card(sample, { size });
    assert.ok(tile.textContent.includes(sample.name), `${kind} name missing`);
    assert.ok(!tile.textContent.includes("null"), `${kind} renders null`);
    assert.ok(!tile.textContent.includes("undefined"), `${kind} renders undefined`);
  }
}

const mediaTile = card(player, { size: "xl" });
assert.ok(mediaTile.textContent.includes("Skladba"));
document.body.append(mediaTile);
click(mediaTile.querySelector(".card__hit"));
assert.ok(document.querySelector(".dialog"), "media tile must open controls");
closeDialog();

const closeOnlyCover = entity("cover", "open", { open: false, close: true, stop: false });
openControls(closeOnlyCover);
assert.deepEqual([...document.querySelectorAll(".dialog .row button")]
  .map((item) => item.textContent), ["Zavřít"]);
closeDialog();

const thermostat = entity("climate", "heat", { targetTemperature: true,
  minTemp: 16, maxTemp: 28, step: 0.5 }, { temperature: 20 });
openControls(thermostat);
const plus = document.querySelector(".dialog .stepper button:last-child");
click(plus);
click(plus);
assert.deepEqual(actions.slice(-2), [
  [thermostat.id, "temperature", 20.5],
  [thermostat.id, "temperature", 21],
]);
closeDialog();
openControls({ ...thermostat, capability: { kind: "climate", targetTemperature: false } });
assert.equal(document.querySelector(".dialog .stepper"), null);
closeDialog();
const mediaButtons = [...mediaTile.querySelectorAll(".card__ovladani button")];
assert.deepEqual(mediaButtons.map((item) => item.textContent),
  ["Předchozí", "Pozastavit", "Zastavit", "Další"]);
click(mediaButtons[1]);
assert.deepEqual(actions.pop(), [player.id, "pause", undefined]);
const paused = { ...player, state: "paused" };
applyStates([paused]);
click([...mediaTile.querySelectorAll(".card__ovladani button")][1]);
assert.deepEqual(actions.pop(), [player.id, "play", undefined]);

const unavailable = { ...player, available: false };
const unavailableTile = card(unavailable, { size: "xl" });
assert.ok([...unavailableTile.querySelectorAll("button, input")]
  .every((item) => item.disabled), "unavailable media controls must be disabled");
openControls(unavailable);
assert.ok([...document.querySelectorAll(".dialog button, .dialog input")]
  .filter((item) => !item.classList.contains("dialog__close"))
  .every((item) => item.disabled), "unavailable detail controls must be disabled");
closeDialog();
const television = entity("media_player", "off", { canTurnOn: true, canTurnOff: true });
openControls(television);
click([...document.querySelectorAll(".dialog .row button")]
  .find((item) => item.textContent === "Zapnout"));
assert.deepEqual(actions.pop(), [television.id, "turn_on", undefined]);
closeDialog();
openControls(entity("media_player", "idle"));
assert.ok(document.querySelector(".dialog")?.textContent.includes("neposkytuje"));
closeDialog();

const roomCard = BLOKY.rooms.render(ctx).querySelector(".card--room");
click(roomCard);
assert.ok(document.querySelector(".dialog")?.textContent.includes(light.name),
  "overview room must open its own devices");
closeDialog();

const playing = BLOKY.playing.render(ctx, { type: "playing", mediaRef: player.ref });
assert.ok(playing.textContent.includes("Skladba"));
click(playing.querySelector(".card__hit"));
assert.ok(document.querySelector(".dialog"), "now playing must open media controls");
closeDialog();
const quickPlay = BLOKY.playing.render(ctx, { type: "playing", mediaRef: player.ref,
  tapAction: "play_pause" });
click(quickPlay.querySelector(".card__hit"));
assert.deepEqual(actions.pop(), [player.id, "pause"]);
assert.ok(BLOKY.entity.render(ctx, { type: "entity", entityRef: "missing.device" })
  .textContent.includes("dostupná"), "missing configured entity must remain visible");

for (const [type, definition] of Object.entries(BLOKY)) {
  if (type === "floorplan" || type === "clock") continue;
  const block = { id: `test-${type}`, type, entityRef: light.ref, mediaRef: player.ref,
    entities: [light.ref, cover.ref], metric: "lightsOn" };
  const result = definition.render(ctx, block, () => {}, () => {});
  if (result) {
    assert.ok(!result.textContent.includes("undefined"), `${type} renders undefined`);
    assert.ok(!result.textContent.includes("null"), `${type} renders null`);
  }
}

clearWatchers();
console.log("Cards, controls, media actions and room detail: OK");
