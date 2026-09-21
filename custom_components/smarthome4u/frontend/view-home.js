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
import { renderFloorplan } from "./view-floorplan.js";
import { vykreslitPlochu } from "./blocks.js";
import { h, button } from "./ui.js";

export async function renderHome(root, ctx) {
  const preset = ctx.model.preset || "prehled";

  if (ctx.editing) {
    root.append(listaUprav(ctx));
  }

  if (preset === "pudorys") {
    await renderFloorplan(root, ctx);
    return;
  }

  vykreslitPlochu(root, ctx);
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
