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
import { card } from "./controls.js";
import { editAppearance } from "./appearance.js";
import { povolitPretahovani, ATRIBUT_KLICE } from "./dnd.js";
import { icon, iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import { h, closeDialog } from "./ui.js";

/**
 * @param {object} ctx kontext aplikace
 * @param {object} blok blok s poli entities (refs) a sizes (ref -> s|m|l)
 * @param {(blok: object) => void} ulozitBlok zavolá se s upraveným blokem
 */
export function mrizkaZarizeni(ctx, blok, ulozitBlok) {
  const seznam = blok.entities || [];
  const velikosti = blok.sizes || {};
  const styly = blok.tileStyles || {};

  const zarizeni = seznam
    .map((ref) => ctx.entityByRef(ref))
    .filter(Boolean);

  const velikost = (entity) => velikosti[ctx.entityRef(entity)] || "m";

  if (!ctx.editing) {
    return h(
      "div",
      { class: "cards" },
      zarizeni.map((e) => card(e, {
        size: velikost(e), appearance: styly[ctx.entityRef(e)] || {},
      })),
    );
  }

  const uloz = (zmena) => ulozitBlok({ ...blok, ...zmena });

  const mrizka = h("div", { class: "cards" });
  for (const entity of zarizeni) {
    mrizka.append(misto(ctx, entity, velikost(entity), seznam, velikosti, styly, uloz));
  }
  mrizka.append(prazdneMisto(ctx, seznam, uloz));

  // Prázdné místo klíč nemá, takže se do pořadí nedostane.
  povolitPretahovani(mrizka, (poradi) => uloz({ entities: poradi }));

  return mrizka;
}

/* ------------------------------------------------------------------ */
/* Jedno místo                                                         */
/* ------------------------------------------------------------------ */

function misto(ctx, entity, velikost, seznam, velikosti, styly, uloz) {
  const ref = ctx.entityRef(entity);
  const vzhled = styly[ref] || {};

  const obal = h(
    "div",
    { class: `card card--edit card--${velikost} card--tone-${vzhled.color || "default"}` },
    [
      h(
        "button",
        {
          class: "card__hit",
          type: "button",
          "aria-label": entity.name + " - " + t.editor.tileMenu,
          onclick: () => nabidka(ctx, entity, velikost, seznam, velikosti, styly, uloz),
        },
        [
          h("span", { class: "card__icon" }, vzhled.icon ? icon(vzhled.icon, "icon icon--lg") : iconFor(entity, "icon icon--lg")),
          h("span", { class: "card__name", text: vzhled.label || entity.name }),
          h("span", {
            class: "card__state",
            text: t.editor.sizes[velikost] + " · " + t.favorites.tapToEdit,
          }),
        ],
      ),
      h("button", {
        class: "dnd__uchyt",
        type: "button",
        "data-dnd-handle": "",
        "aria-label": `${t.editor.drag}: ${vzhled.label || entity.name}`,
        text: "⠿",
      }),
      h("button", {
        class: "card__more card__more--danger",
        type: "button",
        "aria-label": t.favorites.remove,
        text: "✕",
        onclick: () => odebrat(ref, seznam, velikosti, styly, uloz),
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
function nabidka(ctx, entity, velikost, seznam, velikosti, styly, uloz) {
  const ref = ctx.entityRef(entity);
  const vzhled = styly[ref] || {};
  const extra = h("div", { class: "row" }, [
    h("button", {
      class: "button button--ghost", type: "button", text: t.favorites.replace,
      onclick: () => {
        closeDialog();
        vymenit(ctx, entity, seznam, velikosti, styly, uloz);
      },
    }),
    h("button", {
      class: "button button--ghost", type: "button", text: t.favorites.remove,
      onclick: () => {
        closeDialog();
        odebrat(ref, seznam, velikosti, styly, uloz);
      },
    }),
  ]);
  editAppearance(vzhled.label || entity.name, { ...vzhled, size: velikost }, (next) => {
    const noveStyly = { ...styly, [ref]: {
      label: next.label, icon: next.icon, color: next.color,
    } };
    const noveVelikosti = { ...velikosti, [ref]: next.size };
    uloz({ tileStyles: noveStyly, sizes: noveVelikosti });
  }, { extra });
}

/* ------------------------------------------------------------------ */
/* Akce                                                                */
/* ------------------------------------------------------------------ */

function vymenit(ctx, entity, seznam, velikosti, styly, uloz) {
  const puvodni = ctx.entityRef(entity);

  vybratZarizeni(ctx, {
    nadpis: t.favorites.replace,
    vybrane: puvodni,
    onVyber: (novy) => {
      const sizes = { ...velikosti };
      const tileStyles = { ...styly };
      if (sizes[puvodni]) {
        sizes[novy] = sizes[puvodni];
        delete sizes[puvodni];
      }
      if (tileStyles[puvodni]) {
        tileStyles[novy] = tileStyles[puvodni];
        delete tileStyles[puvodni];
      }
      uloz({
        entities: seznam.map((ref) => (ref === puvodni ? novy : ref)),
        sizes, tileStyles,
      });
    },
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

function odebrat(ref, seznam, velikosti, styly, uloz) {
  const nove = { ...velikosti };
  const noveStyly = { ...styly };
  delete nove[ref];
  delete noveStyly[ref];
  uloz({ entities: seznam.filter((id) => id !== ref), sizes: nove, tileStyles: noveStyly });
}
