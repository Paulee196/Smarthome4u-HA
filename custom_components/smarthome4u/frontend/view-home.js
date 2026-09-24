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
import { renderFloorplan } from "./view-floorplan.js";
import { vykreslitPlochu } from "./blocks.js";
import { renderHomeExperience, renderOverviewExperience, renderTuyaExperience } from "./dashboard-experiences.js";
import { h, button } from "./ui.js";

export async function renderHome(root, ctx) {
  const preset = ctx.model.preset || "tuya";

  root.append(prepinacPloch(ctx, preset));

  if (ctx.editing) {
    root.append(listaUprav(ctx));
  }

  if (preset === "pudorys") {
    await renderFloorplan(root, ctx);
    return;
  }

  const experiences = {
    tuya: renderTuyaExperience,
    home: renderHomeExperience,
    prehled: renderOverviewExperience,
  };
  root.append((experiences[preset] || renderTuyaExperience)(ctx));

  const personal = h("section", { class: "personal-board" }, [
    h("div", { class: "personal-board__head" }, [
      h("span", { class: "experience__eyebrow", text: "PŘIZPŮSOBENÁ PLOCHA" }),
      h("h2", { text: "Moje bloky" }),
      h("p", { text: "Přesuňte, změňte nebo odeberte je tlačítkem Upravit plochu." }),
    ]),
  ]);
  vykreslitPlochu(personal, ctx);
  root.append(personal);
}

function prepinacPloch(ctx, active) {
  return h("nav", { class: "dashboard-switch", "aria-label": t.settings.dashboard },
    ["tuya", "home", "pudorys", "prehled"].map((preset) =>
      h("button", {
        class: "dashboard-switch__item" + (active === preset ? " dashboard-switch__item--active" : ""),
        type: "button",
        text: t.presets[preset].name,
        "aria-current": active === preset ? "page" : null,
        onclick: async () => {
          if (active === preset) return;
          await api.setPreset(preset);
          if (ctx.editing) ctx.stopEditing();
          await ctx.refresh();
        },
      }),
    ));
}

/* ------------------------------------------------------------------ */
/* Režim úprav                                                         */
/* ------------------------------------------------------------------ */

function listaUprav(ctx) {
  return h("section", { class: "editbar" }, [
    h("div", { class: "editbar__text" }, [
      h("span", { class: "editbar__title", text: t.editor.title }),
      h("span", { class: "editbar__hint", text: t.editor.hint }),
    ]),
    button(t.editor.done, () => ctx.stopEditing()),
  ]);
}
