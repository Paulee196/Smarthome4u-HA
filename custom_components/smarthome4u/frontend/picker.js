/* Výběr zařízení s vyhledáváním.
 *
 * Běžná domácnost má stovky entit. Rozbalovací seznam je v takové situaci
 * k ničemu - než se v něm člověk doscrolluje, zapomene, co hledal.
 * Proto se píše a filtruje.
 *
 * U každé položky je vidět, co to je a kde to je, protože samotný název
 * často nestačí: "Světlo" může být v každé místnosti jiné.
 */

import { t } from "./i18n.js";
import { iconFor } from "./icons.js";
import { h, closeDialog, dialog, emptyState, textInput } from "./ui.js";

/* Kolik položek se vykreslí najednou. Víc stejně nikdo neprojde očima
   a na slabém tabletu by to zbytečně brzdilo. */
const MAX_VYSLEDKU = 60;

/**
 * Otevře výběr zařízení.
 *
 * @param {object} ctx kontext aplikace
 * @param {object} volby
 * @param {string} [volby.nadpis]
 * @param {string} [volby.vybrane] entity_id, které je vybrané teď
 * @param {(entity: object) => boolean} [volby.filtr] co se smí nabídnout
 * @param {(entityId: string) => void} volby.onVyber
 */
export function vybratZarizeni(ctx, volby) {
  const { nadpis, vybrane, filtr, onVyber } = volby;

  const vse = ctx
    .allEntities()
    .filter(filtr || ((entity) => entity.capability?.kind !== "unsupported"));

  const mistnosti = new Map(
    (ctx.model.rooms || []).flatMap((room) =>
      room.entities.map((entity) => [entity.id, room.name]),
    ),
  );

  const hledani = textInput("", t.picker.search);
  const seznam = h("div", { class: "stack" });

  function vykreslit(dotaz) {
    const hledane = dotaz.trim().toLowerCase();

    const nalezene = hledane
      ? vse.filter((entity) => {
          const mistnost = mistnosti.get(entity.id) || "";
          return (
            entity.name.toLowerCase().includes(hledane) ||
            mistnost.toLowerCase().includes(hledane)
          );
        })
      : vse;

    if (!nalezene.length) {
      seznam.replaceChildren(emptyState(t.picker.nothing));
      return;
    }

    seznam.replaceChildren(
      ...nalezene.slice(0, MAX_VYSLEDKU).map((entity) => polozka(entity)),
    );

    if (nalezene.length > MAX_VYSLEDKU) {
      seznam.append(
        h("p", {
          class: "muted",
          text: t.picker.more(nalezene.length - MAX_VYSLEDKU),
        }),
      );
    }
  }

  function polozka(entity) {
    const mistnost = mistnosti.get(entity.id);
    const typ = t.editor.kinds[entity.capability?.kind] || "";
    const popis = [typ, mistnost].filter(Boolean).join(" · ");

    return h(
      "button",
      {
        class: `tile tile--volba${entity.id === vybrane ? " tile--active" : ""}`,
        type: "button",
        onclick: () => {
          closeDialog();
          onVyber(entity.id);
        },
      },
      [
        h("span", { class: "tile__glyph" }, iconFor(entity)),
        h("span", { class: "tile__body" }, [
          h("span", { class: "tile__name", text: entity.name }),
          h("span", { class: "tile__state", text: popis }),
        ]),
      ],
    );
  }

  hledani.addEventListener("input", () => vykreslit(hledani.value));
  vykreslit("");

  dialog(
    nadpis || t.picker.title,
    h("div", { class: "stack" }, [
      hledani,
      h("div", { class: "picker__seznam" }, seznam),
    ]),
  );

  hledani.focus();
}
