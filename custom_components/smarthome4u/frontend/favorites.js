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
import { iconFor } from "./icons.js";
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

  const mrizka = h("div", { class: "cards cards--studio", "aria-label": t.studio.layout });
  for (const entity of zarizeni) {
    mrizka.append(misto(ctx, entity, velikost(entity), seznam, velikosti, styly, uloz));
  }
  mrizka.append(prazdneMisto(ctx, seznam, uloz));

  // Knihovna je použitelná i dotykem; na počítači lze zařízení pustit
  // přímo na vybranou dlaždici nebo na prázdné místo na konci mřížky.
  mrizka.addEventListener("dragover", (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes("application/x-smarthome4u-ref")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  mrizka.addEventListener("drop", (event) => {
    const ref = event.dataTransfer?.getData("application/x-smarthome4u-ref");
    if (!ref || seznam.includes(ref)) return;
    event.preventDefault();
    const target = event.target.closest?.(`[${ATRIBUT_KLICE}]`);
    const position = target ? seznam.indexOf(target.getAttribute(ATRIBUT_KLICE)) : seznam.length;
    const next = [...seznam];
    next.splice(Math.max(0, position), 0, ref);
    uloz({ entities: next });
  });

  // Prázdné místo klíč nemá, takže se do pořadí nedostane.
  povolitPretahovani(mrizka, (poradi) => uloz({ entities: poradi }));

  return h("div", { class: "studio" }, [knihovna(ctx, seznam, uloz), mrizka]);
}

/* ------------------------------------------------------------------ */
/* Jedno místo                                                         */
/* ------------------------------------------------------------------ */

function misto(ctx, entity, velikost, seznam, velikosti, styly, uloz) {
  const ref = ctx.entityRef(entity);
  const vzhled = styly[ref] || {};
  const obal = card(entity, { size: velikost, appearance: vzhled, editing: true });
  // Editor kreslí stejnou kartu jako ovládací režim. Během úprav jsou
  // skutečné akce zablokované, aby tažení nespouštělo zařízení.
  for (const control of obal.querySelectorAll("button, input, select")) {
    control.disabled = true;
    control.tabIndex = -1;
  }
  obal.append(h("div", { class: "card__edit-actions" }, [
    h("button", {
      class: "card__edit-button card__edit-button--drag", type: "button",
      "data-dnd-handle": "", "aria-label": `${t.editor.drag}: ${vzhled.label || entity.name}`,
      title: t.editor.drag, text: "⠿",
    }),
    h("button", {
      class: "card__edit-button", type: "button", text: "⋯",
      "aria-label": entity.name + " - " + t.editor.tileMenu,
      onclick: () => nabidka(ctx, entity, velikost, seznam, velikosti, styly, uloz),
    }),
    h("button", {
      class: "card__edit-button", type: "button", text: "↔",
      "aria-label": `${t.editor.size}: ${t.editor.sizes[velikost]}`,
      onclick: () => {
        const sizes = ["s", "m", "l", "xl"];
        uloz({ sizes: { ...velikosti, [ref]: sizes[(sizes.indexOf(velikost) + 1) % sizes.length] } });
      },
    }),
    h("button", {
      class: "card__edit-button card__edit-button--danger", type: "button",
      "aria-label": t.favorites.remove, text: "✕",
      onclick: () => odebrat(ref, seznam, velikosti, styly, uloz),
    }),
  ]));

  obal.setAttribute(ATRIBUT_KLICE, ref);
  return obal;
}

function knihovna(ctx, seznam, uloz) {
  const roomById = new Map((ctx.model.rooms || []).flatMap((room) =>
    (room.entities || []).map((entity) => [entity.id, room.name || ""])));
  const entities = [...ctx.allEntities(), ...(ctx.model.scenes || [])].filter((entity) =>
    entity.capability?.kind !== "unsupported" && !seznam.includes(ctx.entityRef(entity)));
  const search = h("input", { class: "studio__search", type: "search",
    placeholder: t.studio.search, "aria-label": t.studio.search });
  const kind = h("select", { class: "studio__filter", "aria-label": t.studio.filter });
  const kinds = [...new Set(entities.map((entity) => entity.capability?.kind || "other"))].sort();
  kind.append(h("option", { value: "", text: t.studio.allKinds }));
  for (const value of kinds) kind.append(h("option", { value,
    text: t.editor.kinds[value] || value }));
  const list = h("div", { class: "studio__library-list" });
  function draw() {
    const query = search.value.trim().toLocaleLowerCase("cs");
    const matched = entities.filter((entity) =>
      (!kind.value || (entity.capability?.kind || "other") === kind.value)
      && (!query || `${entity.name} ${roomById.get(entity.id) || ""}`
        .toLocaleLowerCase("cs").includes(query)));
    list.replaceChildren(...matched.slice(0, 40).map((entity) => {
      const ref = ctx.entityRef(entity);
      const item = h("button", { class: "studio__library-item", type: "button",
        draggable: "true", title: t.studio.dragHint,
        onclick: () => uloz({ entities: [...seznam, ref] }) }, [
        h("span", { class: "studio__library-icon" }, iconFor(entity)),
        h("span", { class: "studio__library-name", text: entity.name }),
        h("small", { text: roomById.get(entity.id) || "" }),
      ]);
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("application/x-smarthome4u-ref", ref);
        event.dataTransfer.effectAllowed = "copy";
      });
      return item;
    }));
    if (!matched.length) list.append(h("p", { class: "muted", text: t.studio.empty }));
  }
  search.addEventListener("input", draw);
  kind.addEventListener("change", draw);
  draw();
  return h("aside", { class: "studio__library" }, [
    h("strong", { text: t.studio.library }),
    h("p", { class: "muted", text: t.studio.hint }),
    search, kind, list,
  ]);
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
