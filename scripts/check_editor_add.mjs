import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { api } from "../custom_components/smarthome4u/frontend/api.js";
import { renderHome } from "../custom_components/smarthome4u/frontend/view-home.js";
import { setHost } from "../custom_components/smarthome4u/frontend/ui.js";

const { document, window } = parseHTML("<html><body><main class='shell'></main></body></html>");
globalThis.document = document;
globalThis.window = window;
window.innerWidth = 1200;
setHost(document);

const saved = [];
api.dashboardHistory = async () => ({ undo: false, redo: false });
api.saveDashboard = async (...args) => { saved.push(args); };
const ctx = {
  editing: true,
  model: { preset: "test-board", dashboardTemplate: "blank",
    dashboards: [{ id: "test-board", name: "Test" }],
    board: { columns: 4, blocks: [] }, rooms: [], scenes: [] },
  allEntities: () => [],
  entityByRef: () => null,
  entityRef: (entity) => entity.ref,
  refresh: async () => {},
};

await renderHome(document.querySelector(".shell"), ctx);
assert.equal(document.querySelectorAll(".editbar__add, .dashboard-stage__add").length, 0,
  "editor must not show redundant add buttons");
assert.equal(document.querySelectorAll(".dashboard-studio__tab--active").length, 1);
assert.equal(document.querySelector(".dashboard-studio__tab--active").textContent, "Přidat");
assert.ok(document.querySelector(".dashboard-stage__empty")?.textContent.includes("Přidat"));
const type = [...document.querySelectorAll(".dashboard-studio__type")]
  .find((item) => item.textContent.includes("Úvod plochy"));
assert.ok(type, "card catalog must be visible on an empty dashboard");
type.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(saved.length, 1);
assert.equal(saved[0][0], "test-board");
assert.equal(saved[0][2][0].type, "headline");
assert.deepEqual(saved[0][2][0].position, { x: 0, y: 20, w: 400, h: 220 });

document.querySelector(".shell").replaceChildren();
window.innerWidth = 350;
await renderHome(document.querySelector(".shell"), { ...ctx, editing: false });
document.querySelector(".shell").replaceChildren();
await renderHome(document.querySelector(".shell"), ctx);
const panel = document.querySelector(".dashboard-editor__panel");
assert.ok(document.querySelector(".dashboard-stage--phone"));
assert.ok(panel.classList.contains("dashboard-editor__panel--collapsed"));
const toggle = panel.querySelector(".dashboard-editor__panel-toggle");
assert.ok(toggle.textContent.includes("Přidat prvek"));
toggle.click();
assert.ok(!panel.classList.contains("dashboard-editor__panel--collapsed"));
assert.ok(panel.querySelector(".dashboard-studio__type"),
  "phone editor must expose the same card catalog");
console.log("Editor add panel and dashboard save: OK");
