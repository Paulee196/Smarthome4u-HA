/* Scény a skripty. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { tile } from "./controls.js";
import {
  h,
  button,
  closeDialog,
  confirmDialog,
  dialog,
  emptyState,
  field,
  haLink,
  section,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

export async function renderScenes(root, ctx) {
  let data;
  try {
    data = await api.section("scenes");
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(
    h("div", { class: "row row--end" }, [
      button(t.scenes.create, () => openCreate(ctx), "button--ghost"),
    ]),
  );

  root.append(
    section(
      t.scenes.scenes,
      data.scenes.length
        ? h(
            "div",
            { class: "stack" },
            data.scenes.map((scene) => sceneRow(ctx, scene)),
          )
        : emptyState(t.scenes.empty),
    ),
  );

  if (data.scripts.length) {
    root.append(
      section(
        t.scenes.scripts,
        h(
          "div",
          { class: "stack" },
          data.scripts.map((script) => tile(script)),
        ),
      ),
    );
  }
}

function sceneRow(ctx, scene) {
  const row = tile(scene);
  const sceneId = scene.capability?.sceneId;

  // Smazat jde jen scéna vytvořená přes editor. Scény z YAML patří do HA.
  if (sceneId) {
    row.append(
      h("button", {
        class: "tile__more tile__more--danger",
        type: "button",
        "aria-label": t.action.delete,
        text: "🗑",
        onclick: () =>
          confirmDialog(scene.name, t.action.confirmDelete, async () => {
            try {
              await api.deleteScene(sceneId);
              toast(t.notice.saved);
              await ctx.refresh();
            } catch (error) {
              toast(error.message, true);
            }
          }),
      }),
    );
  }
  return row;
}

async function openCreate(ctx) {
  let structure;
  try {
    structure = await api.structure();
  } catch (error) {
    toast(error.message, true);
    return;
  }

  if (!structure.areas.length) {
    toast(t.rooms.empty, true);
    return;
  }

  const name = textInput("", t.scenes.sceneName);
  const area = selectInput(
    structure.areas.map((a) => ({ value: a.id, label: a.name })),
    structure.areas[0].id,
  );

  dialog(
    t.scenes.create,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.scenes.hint }),
      field(t.scenes.sceneName, name),
      field(t.scenes.pickRoom, area),
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.create, async () => {
        try {
          const result = await api.createScene({
            name: name.value,
            areaId: area.value,
          });
          closeDialog();
          toast(t.scenes.createdWith(result.count));
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  );
}

export function scenesFooter() {
  return haLink("/config/scene/dashboard", t.action.openInHa);
}
