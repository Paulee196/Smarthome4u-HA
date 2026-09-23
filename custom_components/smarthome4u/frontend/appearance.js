/* One appearance editor shared by dashboard tiles and floorplan points. */

import { t } from "./i18n.js";
import { h, button, closeDialog, dialog, field, selectInput, textInput } from "./ui.js";

export const COLORS = ["default", "mint", "blue", "violet", "amber", "rose"];
export const ICONS = Object.keys(t.editor.icons);
export const SIZES = ["s", "m", "l", "xl"];

const options = (keys, names, automatic = false) => [
  ...(automatic ? [{ value: "", label: t.editor.automatic }] : []),
  ...keys.map((value) => ({ value, label: names[value] || value })),
];

export function editAppearance(title, current, save, config = {}) {
  const name = textInput(current.label || "", title);
  name.maxLength = 80;
  const glyph = selectInput(options(ICONS, t.editor.icons, true), current.icon || "");
  const color = selectInput(options(COLORS, t.editor.colors), current.color || "default");
  const size = selectInput(options(SIZES, t.editor.sizes), current.size || "m");

  const fields = [
    field(t.editor.label, name),
    h("p", { class: "muted", text: t.editor.labelHint }),
    field(t.editor.icon, glyph),
    field(t.editor.color, color),
    field(t.editor.size, size),
  ];
  if (config.extra) fields.push(config.extra);
  fields.push(h("div", { class: "row" }, [
    button(t.action.cancel, closeDialog, "button--ghost"),
    button(t.action.save, () => {
      const next = {
        label: name.value.trim(),
        icon: glyph.value,
        color: color.value,
        size: size.value,
      };
      closeDialog();
      save(next);
    }),
  ]));
  dialog(title, h("div", { class: "stack appearance-editor" }, fields));
}

export function editBlockAppearance(block, save) {
  const name = textInput(block.title || "", t.blocks[block.type]);
  name.maxLength = 60;
  const glyph = selectInput(options(ICONS, t.editor.icons, true), block.icon || "");
  const color = selectInput(options(COLORS, t.editor.colors), block.color || "default");
  const height = selectInput([
    { value: "compact", label: t.editor.heightCompact },
    { value: "normal", label: t.editor.heightNormal },
    { value: "large", label: t.editor.heightLarge },
  ], block.height || "normal");
  dialog(t.editor.blockAppearance, h("div", { class: "stack appearance-editor" }, [
    field(t.editor.label, name),
    field(t.editor.icon, glyph),
    field(t.editor.color, color),
    field(t.editor.blockHeight, height),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, () => {
        closeDialog();
        save({
          ...block,
          title: name.value.trim() || undefined,
          icon: glyph.value || undefined,
          color: color.value,
          height: height.value,
        });
      }),
    ]),
  ]));
}
