/* Scény ukládají aktuální stav vybraných zařízení; skripty spouštějí kroky v HA. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { row } from "./controls.js";
import {
  h, button, closeDialog, confirmDialog, dialog, emptyState, field,
  section, selectInput, textInput, toast,
} from "./ui.js";

const SCENE_KINDS = new Set(["light", "switch", "cover", "climate", "fan"]);
const SCRIPT_ACTIONS = {
  light: ["turn_on", "turn_off"], switch: ["turn_on", "turn_off"],
  cover: ["open", "close"], fan: ["turn_on", "turn_off"],
  climate: ["turn_on", "turn_off"], lock: ["lock", "unlock"],
  scene: ["activate"], script: ["run"], button: ["press"],
  media_player: ["play_pause", "stop"],
};

export async function renderScenes(root, ctx) {
  let data;
  try {
    data = await api.section("scenes");
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }
  if (!root.isConnected) return;

  root.append(h("div", { class: "row row--end" }, [
    button(t.scenes.create, () => openCreateScene(ctx), "button--ghost"),
    button(t.scenes.createScript, () => openCreateScript(ctx, data), "button--ghost"),
  ]));
  root.append(section(t.scenes.scenes,
    data.scenes.length
      ? h("div", { class: "stack" }, data.scenes.map((scene) => sceneRow(ctx, scene)))
      : emptyState(t.scenes.empty)));
  root.append(section(t.scenes.scripts,
    data.scripts.length
      ? h("div", { class: "stack" }, data.scripts.map((script) => scriptRow(ctx, script)))
      : emptyState(t.scenes.emptyScripts)));
}

function deleteControl(name, onDelete) {
  return h("button", {
    class: "tile__more tile__more--danger", type: "button",
    "aria-label": t.action.delete, text: "✕",
    onclick: () => confirmDialog(name, t.action.confirmDelete, async () => {
      try {
        await onDelete();
        toast(t.notice.saved);
      } catch (error) {
        toast(error.message, true);
      }
    }),
  });
}

function sceneRow(ctx, scene) {
  const sceneId = scene.capability?.sceneId;
  return row(scene, sceneId
    ? [deleteControl(scene.name, async () => {
      await api.deleteScene(sceneId);
      await ctx.refresh();
    })]
    : []);
}

function scriptRow(ctx, script) {
  const scriptId = script.id?.startsWith("script.sh4u_") ? script.id.slice(7) : null;
  return row(script, scriptId
    ? [deleteControl(script.name, async () => {
      await api.deleteScript(scriptId);
      await ctx.refresh();
    })]
    : []);
}

function openCreateScene(ctx) {
  const rooms = new Map((ctx.model.rooms || []).map((room) => [room.id, room.name]));
  const candidates = ctx.allEntities().filter((entity) =>
    entity.available && SCENE_KINDS.has(entity.capability?.kind));
  if (!candidates.length) return toast(t.scenes.noDevices, true);

  const selected = new Set();
  const name = textInput("", t.scenes.sceneName);
  const search = h("input", {
    class: "input", type: "search", placeholder: t.scenes.searchDevices,
    "aria-label": t.scenes.searchDevices,
  });
  const list = h("div", { class: "scene-pick-list" });

  function draw() {
    const query = search.value.trim().toLocaleLowerCase();
    list.replaceChildren();
    for (const entity of candidates) {
      const room = rooms.get(entity.areaId) || t.rooms.unassigned;
      if (!`${entity.name} ${room}`.toLocaleLowerCase().includes(query)) continue;
      const ref = entity.ref || entity.id;
      const check = h("input", {
        type: "checkbox", checked: selected.has(ref),
        onchange: () => check.checked ? selected.add(ref) : selected.delete(ref),
      });
      list.append(h("label", { class: "scene-pick-item" }, [
        check,
        h("span", { class: "scene-pick-item__text" }, [
          h("strong", { text: entity.name }), h("small", { text: room }),
        ]),
      ]));
    }
    if (!list.children.length) list.append(emptyState(t.scenes.noMatches));
  }
  search.addEventListener("input", draw);
  draw();

  dialog(t.scenes.create, h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.scenes.hint }),
    field(t.scenes.sceneName, name),
    h("strong", { text: t.scenes.pickDevices }), search, list,
  ]), h("div", { class: "row" }, [
    button(t.action.cancel, closeDialog, "button--ghost"),
    button(t.action.create, async () => {
      if (!selected.size) return toast(t.scenes.pickAtLeastOne, true);
      try {
        const result = await api.createScene({ name: name.value, entityRefs: [...selected] });
        closeDialog();
        toast(t.scenes.createdWith(result.count));
        await ctx.refresh();
      } catch (error) {
        toast(error.message, true);
      }
    }),
  ]));
}

function openCreateScript(ctx, data) {
  const entities = [
    ...ctx.allEntities(), ...data.scenes, ...data.scripts,
  ].filter((entity) => SCRIPT_ACTIONS[entity.capability?.kind]?.length);
  if (!entities.length) return toast(t.scenes.noScriptDevices, true);

  const byRef = new Map(entities.map((entity) => [entity.ref || entity.id, entity]));
  const options = entities.map((entity) => ({ value: entity.ref || entity.id, label: entity.name }));
  const name = textInput("", t.scenes.scriptName);
  const steps = [];
  const list = h("div", { class: "stack" });

  function redraw() {
    list.replaceChildren();
    steps.forEach((step, index) => {
      const entity = byRef.get(step.entityRef) || entities[0];
      const choices = SCRIPT_ACTIONS[entity.capability.kind];
      if (!choices.includes(step.action)) step.action = choices[0];
      const pickedEntity = selectInput(options, step.entityRef);
      const pickedAction = selectInput(choices.map((action) => ({
        value: action, label: t.scenes.scriptActions[action],
      })), step.action);
      pickedEntity.addEventListener("change", () => {
        step.entityRef = pickedEntity.value;
        redraw();
      });
      pickedAction.addEventListener("change", () => { step.action = pickedAction.value; });
      const up = button(t.scenes.moveUp, () => {
        [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
        redraw();
      }, "button--ghost");
      up.disabled = index === 0;
      const down = button(t.scenes.moveDown, () => {
        [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
        redraw();
      }, "button--ghost");
      down.disabled = index === steps.length - 1;
      list.append(h("div", { class: "scene-script-step" }, [
        h("strong", { text: t.scenes.step(index + 1) }),
        field(t.scenes.device, pickedEntity), field(t.scenes.action, pickedAction),
        h("div", { class: "row" }, [up, down,
          button(t.action.delete, () => { steps.splice(index, 1); redraw(); }, "button--ghost")]),
      ]));
    });
  }
  steps.push({ entityRef: options[0].value, action: SCRIPT_ACTIONS[entities[0].capability.kind][0] });
  redraw();

  dialog(t.scenes.createScript, h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.scenes.scriptHint }),
    field(t.scenes.scriptName, name), list,
    button(t.scenes.addStep, () => {
      if (steps.length >= 20) return toast(t.scenes.tooManySteps, true);
      steps.push({ entityRef: options[0].value, action: SCRIPT_ACTIONS[entities[0].capability.kind][0] });
      redraw();
    }, "button--ghost"),
  ]), h("div", { class: "row" }, [
    button(t.action.cancel, closeDialog, "button--ghost"),
    button(t.action.create, async () => {
      try {
        await api.createScript({ name: name.value, steps });
        closeDialog();
        toast(t.notice.saved);
        await ctx.refresh();
      } catch (error) {
        toast(error.message, true);
      }
    }),
  ]));
}
