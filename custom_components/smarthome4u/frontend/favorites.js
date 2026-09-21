/* Mřížka zařízení, kterou si správce skládá sám.
 *
 * Používá ji každý blok, který drží vlastní seznam zařízení. Mimo režim
 * úprav se chová jako běžné dlaždice. V úpravách se z nich stanou
 * vyměnitelná místa: klepnutí otevře výběr s vyhledáváním, přetažení
 * změní pořadí, křížek místo odebere, poslední místo je prázdné a přidá
 * další.
 */

import { t } from "./i18n.js";
import { card } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import { h } from "./ui.js";

/**
 * @param {object} ctx kontext aplikace
 * @param {string[]} ids stabilní entity refs v pořadí, jak mají být
 * @param {(ids: string[]) => void} onZmena zavolá se s novým seznamem
 */
export function mrizkaZarizeni(ctx, ids, onZmena) {
  const seznam = ids || [];
  const zarizeni = seznam
    .map((id) => ctx.entityByRef(id))
    .filter(Boolean);

  if (!ctx.editing) {
    return h("div", { class: "cards" }, zarizeni.map((e) => card(e)));
  }

  const mrizka = h("div", { class: "cards" });

  for (const entity of zarizeni) {
    mrizka.append(misto(ctx, entity, seznam, onZmena));
  }
  mrizka.append(prazdneMisto(ctx, seznam, onZmena));

  // Prázdné místo klíč nemá, takže se do pořadí nedostane.
  povolitPretahovani(mrizka, (poradi) => onZmena(poradi));

  return mrizka;
}

/* ------------------------------------------------------------------ */
/* Jedno místo                                                         */
/* ------------------------------------------------------------------ */

function misto(ctx, entity, seznam, onZmena) {
  const obal = h("div", { class: "card card--edit", "data-dnd-handle": "" }, [
    h("span", { class: "dnd__uchyt", text: "⠿" }),
    h(
      "button",
      {
        class: "card__hit",
        type: "button",
        "aria-label": `${entity.name} - ${t.favorites.replace}`,
        onclick: () => vymenit(ctx, entity, seznam, onZmena),
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
        onZmena(seznam.filter((id) => id !== (entity.ref || entity.id))),
    }),
  ]);

  obal.setAttribute(ATRIBUT_KLICE, entity.ref || entity.id);
  return obal;
}

function prazdneMisto(ctx, seznam, onZmena) {
  return h(
    "button",
    {
      class: "card card--prazdne",
      type: "button",
      onclick: () => pridat(ctx, seznam, onZmena),
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

function vymenit(ctx, entity, seznam, onZmena) {
  vybratZarizeni(ctx, {
    nadpis: t.favorites.replace,
    vybrane: entity.ref || entity.id,
    onVyber: (novy) =>
      onZmena(seznam.map((id) => (id === (entity.ref || entity.id) ? novy : id))),
  });
}

function pridat(ctx, seznam, onZmena) {
  const uz = new Set(seznam);

  vybratZarizeni(ctx, {
    nadpis: t.favorites.add,
    filtr: (entity) =>
      !uz.has(entity.ref || entity.id) && entity.capability?.kind !== "unsupported",
    onVyber: (novy) => onZmena([...seznam, novy]),
  });
}
