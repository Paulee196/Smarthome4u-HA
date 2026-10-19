/* Domů - plocha, kterou si správce skládá sám.
 *
 * Záměrně tu NENÍ výpis všech zařízení. Nejčastější chyba v podobných
 * rozhraních je, že každá entita skončí jako karta a za měsíc je z toho
 * jedna nekonečná stránka, ve které se nedá nic najít.
 *
 * Plocha je mřížka bloků (blocks.js), nebo půdorys (view-floorplan.js).
 * Celý dům po místnostech je v navigaci vlevo - tady se nevypisuje.
 */

import { t } from "./i18n.js";
import { api } from "./api.js";
import { vykreslitPlochu } from "./blocks.js";
import { h, button, toast } from "./ui.js";

export async function renderHome(root, ctx) {
  const preset = ctx.model.preset || "overview";

  root.append(prepinacPloch(ctx, preset));
  root.append(h("div", { class: "row row--end" },
    button(t.dashboardManager.create, () => ctx.navigate("settings"), "button--ghost")));

  if (ctx.editing) {
    root.append(listaUprav(ctx, preset));
  }

  vykreslitPlochu(root, ctx);
}

function prepinacPloch(ctx, active) {
  return h("nav", { class: "dashboard-switch", "aria-label": t.settings.dashboard },
    (ctx.model.dashboards || []).map((dashboard) =>
      h("button", {
        class: "dashboard-switch__item" + (active === dashboard.id ? " dashboard-switch__item--active" : ""),
        type: "button",
        text: dashboard.name,
        "aria-current": active === dashboard.id ? "page" : null,
        onclick: async () => {
          if (active === dashboard.id) return;
          await api.setPreset(dashboard.id);
          if (ctx.editing) ctx.stopEditing();
          await ctx.refresh();
        },
      }),
    ));
}

/* ------------------------------------------------------------------ */
/* Režim úprav                                                         */
/* ------------------------------------------------------------------ */

function listaUprav(ctx, preset) {
  const undo = button(t.editor.undo, () => restore("undo"), "button--ghost");
  const redo = button(t.editor.redo, () => restore("redo"), "button--ghost");
  undo.disabled = true;
  redo.disabled = true;
  api.dashboardHistory(preset).then((state) => {
    undo.disabled = !state.undo;
    redo.disabled = !state.redo;
  }).catch(() => {});
  async function restore(direction) {
    undo.disabled = true;
    redo.disabled = true;
    try {
      await api.restoreDashboard(preset, direction);
      await ctx.refresh();
    } catch (error) {
      toast(error.message, true);
      const state = await api.dashboardHistory(preset).catch(() => ({}));
      undo.disabled = !state.undo;
      redo.disabled = !state.redo;
    }
  }
  return h("section", { class: "editbar" }, [
    h("div", { class: "editbar__text" }, [
      h("span", { class: "editbar__title", text: t.editor.title }),
      h("span", { class: "editbar__hint", text: t.editor.hint }),
    ]),
    h("div", { class: "row editbar__actions" }, [
      undo, redo, button(t.editor.done, () => ctx.stopEditing()),
    ]),
  ]);
}
