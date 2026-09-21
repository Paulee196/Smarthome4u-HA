/* Často používané - editovatelná mřížka.
 *
 * Tohle je jediná plocha, kterou si správce skládá sám. Místnosti a funkce
 * vychází z Home Assistantu, takže tam se nic „nevyměňuje" - tam se jen
 * skrývá. Tady se naopak každé místo dá nahradit čímkoliv jiným.
 *
 * V režimu úprav se klepnutím na dlaždici otevře výběr s vyhledáváním
 * a zařízení se na tom místě prostě vymění. Pořadí se mění přetažením.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import { h, toast } from "./ui.js";

/**
 * Mřížka oblíbených.
 *
 * Mimo režim úprav se chová jako běžné dlaždice. V úpravách se z nich
 * stanou vyměnitelná místa.
 */
export function mrizkaOblibenych(ctx) {
  const oblibene = ctx.model.favorites || [];

  if (!ctx.editing) {
    return h(
      "div",
      { class: "cards" },
      oblibene.map((entity) => card(entity)),
    );
  }

  const mrizka = h("div", { class: "cards" });

  for (const entity of oblibene) {
    mrizka.append(misto(ctx, entity, oblibene));
  }
  mrizka.append(prazdneMisto(ctx, oblibene));

  povolitPretahovani(mrizka, (poradi) => {
    // Prázdné místo klíč nemá, takže se do pořadí nedostane.
    ulozit(ctx, poradi);
  });

  return mrizka;
}

/* ------------------------------------------------------------------ */
/* Jedno místo                                                         */
/* ------------------------------------------------------------------ */

function misto(ctx, entity, oblibene) {
  const obal = h("div", { class: "card card--edit", "data-dnd-handle": "" }, [
    h("span", { class: "dnd__uchyt", text: "⠿" }),
    h(
      "button",
      {
        class: "card__hit",
        type: "button",
        "aria-label": `${entity.name} - ${t.favorites.replace}`,
        onclick: () => vymenit(ctx, entity, oblibene),
      },
      [
        h("span", { class: "card__icon" }, iconFor(entity, "icon icon--lg")),
        h("span", { class: "card__name", text: entity.name }),
        h("span", { class: "card__state", text: t.favorites.tapToReplace }),
      ],
    ),
    h("button", {
      class: "card__more card__more--danger",
      type: "button",
      "aria-label": t.favorites.remove,
      text: "✕",
      onclick: () =>
        ulozit(
          ctx,
          oblibene.filter((e) => e.id !== entity.id).map((e) => e.id),
        ),
    }),
  ]);

  obal.setAttribute(ATRIBUT_KLICE, entity.id);
  return obal;
}

function prazdneMisto(ctx, oblibene) {
  return h(
    "button",
    {
      class: "card card--prazdne",
      type: "button",
      onclick: () => pridat(ctx, oblibene),
    },
    [
      h("span", { class: "card__plus", text: "+" }),
      h("span", { class: "card__name", text: t.favorites.add }),
    ],
  );
}

/* ------------------------------------------------------------------ */
/* Akce                                                                */
/* ------------------------------------------------------------------ */

function vymenit(ctx, entity, oblibene) {
  vybratZarizeni(ctx, {
    nadpis: t.favorites.replace,
    vybrane: entity.id,
    onVyber: (novy) => {
      const seznam = oblibene.map((e) => (e.id === entity.id ? novy : e.id));
      ulozit(ctx, seznam);
    },
  });
}

function pridat(ctx, oblibene) {
  const uz = new Set(oblibene.map((e) => e.id));

  vybratZarizeni(ctx, {
    nadpis: t.favorites.add,
    filtr: (entity) =>
      !uz.has(entity.id) && entity.capability?.kind !== "unsupported",
    onVyber: (novy) => ulozit(ctx, [...uz, novy]),
  });
}

async function ulozit(ctx, seznam) {
  try {
    await api.saveFavorites([...seznam]);
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}
