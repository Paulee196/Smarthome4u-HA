/* Mřížka zařízení, kterou si správce skládá sám.
 *
 * Používá ji každý blok, který drží vlastní seznam zařízení. Mimo režim
 * úprav se chová jako běžné dlaždice. V úpravách se z každé dlaždice
 * stane místo, se kterým jde něco udělat: vyměnit zařízení, změnit
 * velikost, odebrat. Přetažením se mění pořadí, poslední místo je
 * prázdné a přidá další.
 *
 * Velikost není jen kosmetika. Velká dlaždice ukazuje rovnou ovládání -
 * stmívání, polohu žaluzie, teplotu - bez otevírání detailu.
 */

import { t } from "./i18n.js";
import { card, VELIKOSTI_DLAZDIC } from "./controls.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import { h, closeDialog, dialog } from "./ui.js";

/**
 * @param {object} ctx kontext aplikace
 * @param {object} blok blok s poli entities (refs) a sizes (ref -> s|m|l)
 * @param {(blok: object) => void} ulozitBlok zavolá se s upraveným blokem
 */
export function mrizkaZarizeni(ctx, blok, ulozitBlok) {
  const seznam = blok.entities || [];
  const velikosti = blok.sizes || {};

  const zarizeni = seznam
    .map((ref) => ctx.entityByRef(ref))
    .filter(Boolean);

  const velikost = (entity) => velikosti[ctx.entityRef(entity)] || "m";

  if (!ctx.editing) {
    return h(
      "div",
      { class: "cards" },
      zarizeni.map((e) => card(e, { size: velikost(e) })),
    );
  }

  const uloz = (zmena) => ulozitBlok({ ...blok, ...zmena });

  const mrizka = h("div", { class: "cards" });
  for (const entity of zarizeni) {
    mrizka.append(misto(ctx, entity, velikost(entity), seznam, velikosti, uloz));
  }
  mrizka.append(prazdneMisto(ctx, seznam, uloz));

  // Prázdné místo klíč nemá, takže se do pořadí nedostane.
  povolitPretahovani(mrizka, (poradi) => uloz({ entities: poradi }));

  return mrizka;
}

/* ------------------------------------------------------------------ */
/* Jedno místo                                                         */
/* ------------------------------------------------------------------ */

function misto(ctx, entity, velikost, seznam, velikosti, uloz) {
  const ref = ctx.entityRef(entity);

  const obal = h(
    "div",
    { class: "card card--edit card--" + velikost, "data-dnd-handle": "" },
    [
      h("span", { class: "dnd__uchyt", text: "⠿" }),
      h(
        "button",
        {
          class: "card__hit",
          type: "button",
          "aria-label": entity.name + " - " + t.editor.tileMenu,
          onclick: () => nabidka(ctx, entity, velikost, seznam, velikosti, uloz),
        },
        [
          h("span", { class: "card__icon" }, iconFor(entity, "icon icon--lg")),
          h("span", { class: "card__name", text: entity.name }),
          h("span", {
            class: "card__state",
            text: t.editor.sizes[velikost] + " · " + t.favorites.tapToEdit,
          }),
        ],
      ),
      h("button", {
        class: "card__more card__more--danger",
        type: "button",
        "aria-label": t.favorites.remove,
        text: "✕",
        onclick: () => odebrat(ref, seznam, velikosti, uloz),
      }),
    ],
  );

  obal.setAttribute(ATRIBUT_KLICE, ref);
  return obal;
}

function prazdneMisto(ctx, seznam, uloz) {
  return h(
    "button",
    {
      class: "card card--prazdne",
      type: "button",
      onclick: () => pridat(ctx, seznam, uloz),
    },
    [
      h("span", { class: "card__plus", text: "+" }),
      h("span", { class: "card__name", text: t.favorites.add }),
    ],
  );
}

/* ------------------------------------------------------------------ */
/* Nabídka nad dlaždicí                                                */
/* ------------------------------------------------------------------ */

/* Jedno klepnutí, tři možnosti. Nic z toho se neschovává do gesta,
   které by člověk musel znát předem. */
function nabidka(ctx, entity, velikost, seznam, velikosti, uloz) {
  const ref = ctx.entityRef(entity);

  const volbaVelikosti = h(
    "div",
    { class: "segmented" },
    VELIKOSTI_DLAZDIC.map((v) =>
      h("button", {
        class: "segmented__item" + (v === velikost ? " segmented__item--active" : ""),
        type: "button",
        text: t.editor.sizes[v],
        "aria-pressed": String(v === velikost),
        onclick: () => {
          closeDialog();
          const nove = { ...velikosti };
          if (v === "m") delete nove[ref];
          else nove[ref] = v;
          uloz({ sizes: nove });
        },
      }),
    ),
  );

  dialog(
    entity.name,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.editor.sizeHint }),
      volbaVelikosti,
      h(
        "button",
        {
          class: "tile tile--volba",
          type: "button",
          onclick: () => {
            closeDialog();
            vymenit(ctx, entity, seznam, uloz);
          },
        },
        [
          h("span", { class: "tile__body" }, [
            h("span", { class: "tile__name", text: t.favorites.replace }),
            h("span", { class: "tile__state", text: t.favorites.replaceHint }),
          ]),
        ],
      ),
      h(
        "button",
        {
          class: "tile tile--volba tile--danger",
          type: "button",
          onclick: () => {
            closeDialog();
            odebrat(ref, seznam, velikosti, uloz);
          },
        },
        [
          h("span", { class: "tile__body" }, [
            h("span", { class: "tile__name", text: t.favorites.remove }),
            h("span", { class: "tile__state", text: t.favorites.removeHint }),
          ]),
        ],
      ),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Akce                                                                */
/* ------------------------------------------------------------------ */

function vymenit(ctx, entity, seznam, uloz) {
  const puvodni = ctx.entityRef(entity);

  vybratZarizeni(ctx, {
    nadpis: t.favorites.replace,
    vybrane: puvodni,
    onVyber: (novy) =>
      uloz({ entities: seznam.map((ref) => (ref === puvodni ? novy : ref)) }),
  });
}

function pridat(ctx, seznam, uloz) {
  const uz = new Set(seznam);

  vybratZarizeni(ctx, {
    nadpis: t.favorites.add,
    filtr: (entity) =>
      !uz.has(ctx.entityRef(entity)) &&
      entity.capability?.kind !== "unsupported",
    onVyber: (novy) => uloz({ entities: [...seznam, novy] }),
  });
}

function odebrat(ref, seznam, velikosti, uloz) {
  const nove = { ...velikosti };
  delete nove[ref];
  uloz({ entities: seznam.filter((id) => id !== ref), sizes: nove });
}
