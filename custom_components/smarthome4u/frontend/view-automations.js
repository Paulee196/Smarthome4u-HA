/* Automatizace - seznam, ruční spuštění a vytvoření ze šablony. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { row } from "./controls.js";
import { otevritEditor, upravitAutomatizaci } from "./view-builder.js";
import {
  h,
  button,
  closeDialog,
  confirmDialog,
  dialog,
  emptyState,
  field,
  numberInput,
  selectInput,
  textInput,
  timeInput,
  toast,
} from "./ui.js";

export async function renderAutomations(root, ctx) {
  let data;
  try {
    data = await api.section("automations");
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(
    h("div", { class: "row row--end" }, [
      button(t.automations.create, () => vybratZpusob(ctx), ""),
    ]),
  );

  if (!data.automations.length) {
    root.append(emptyState(t.automations.empty));
  } else {
    root.append(
      h(
        "div",
        { class: "stack" },
        data.automations.map((automation) => automationRow(ctx, automation)),
      ),
    );
  }

}

function automationRow(ctx, automation) {
  const id = automation.capability?.automationId;
  const extras = [
    h("button", {
      class: "tile__more",
      type: "button",
      "aria-label": t.automations.runNow,
      text: "▶",
      onclick: async () => {
        try {
          await api.action(automation.id, "run");
          toast(t.automations.runNow);
        } catch (error) {
          toast(error.message, true);
        }
      },
    }),
  ];

  if (id) {
    extras.push(
      h("button", {
        class: "tile__more",
        type: "button",
        "aria-label": t.action.rename,
        text: "✎",
        onclick: () => upravitAutomatizaci(ctx, id),
      }),
    );
    extras.push(
      h("button", {
        class: "tile__more tile__more--danger",
        type: "button",
        "aria-label": t.action.delete,
        text: "✕",
        onclick: () =>
          confirmDialog(automation.name, t.action.confirmDelete, async () => {
            try {
              await api.deleteAutomation(id);
              toast(t.notice.saved);
              await ctx.refresh();
            } catch (error) {
              toast(error.message, true);
            }
          }),
      }),
    );
  }

  return row(automation, extras);
}

/* ------------------------------------------------------------------ */
/* Průvodce vytvořením                                                 */
/* ------------------------------------------------------------------ */

function vybratZpusob(ctx) {
  const volba = (nadpis, popis, akce) =>
    h("button", { class: "picker", type: "button", onclick: akce }, [
      h("span", { class: "picker__name", text: nadpis }),
      h("span", { class: "picker__desc", text: popis }),
    ]);

  dialog(
    t.builder.pickWay,
    h("div", { class: "stack" }, [
      volba(t.builder.waySimple.name, t.builder.waySimple.description, () => {
        closeDialog();
        otevritEditor(ctx);
      }),
      volba(t.builder.wayBlocks.name, t.builder.wayBlocks.description, () => {
        closeDialog();
        otevritEditor(ctx, null, "blocks");
      }),
      volba(t.builder.wayTemplate.name, t.builder.wayTemplate.description, () => {
        closeDialog();
        pickTemplate(ctx);
      }),
    ]),
  );
}

async function pickTemplate(ctx) {
  let data;
  try {
    data = await api.templates();
  } catch (error) {
    toast(error.message, true);
    return;
  }

  const list = h(
    "div",
    { class: "stack" },
    data.templates.map((template) => {
      const text = t.templates[template.id] || { name: template.id, description: "" };
      return h(
        "button",
        {
          class: "picker",
          type: "button",
          onclick: () => fillTemplate(ctx, template),
        },
        [
          h("span", { class: "picker__name", text: text.name }),
          h("span", { class: "picker__desc", text: text.description }),
        ],
      );
    }),
  );

  dialog(t.automations.pickTemplate, list);
}

function fillTemplate(ctx, template) {
  const text = t.templates[template.id] || {};
  const entities = ctx.allEntities();
  const controls = {};
  const fields = [];

  for (const input of template.inputs) {
    const label = text[input.key] || input.key;

    if (input.type === "entity") {
      const candidates = entities.filter(
        (entity) =>
          entity.capability?.kind === input.kind &&
          (!input.classes.length || input.classes.includes(entity.deviceClass)),
      );

      if (!candidates.length) {
        fields.push(
          h("p", { class: "muted", text: `${label}: žádné vhodné zařízení` }),
        );
        controls[input.key] = null;
        continue;
      }

      if (input.multiple) {
        const box = checkboxList(candidates);
        controls[input.key] = box;
        fields.push(field(label, box.node));
      } else {
        const select = selectInput(
          candidates.map((entity) => ({ value: entity.id, label: entity.name })),
          candidates[0].id,
        );
        controls[input.key] = select;
        fields.push(field(label, select));
      }
    } else if (input.type === "number") {
      const control = numberInput(input.default, input.min, input.max);
      controls[input.key] = control;
      fields.push(field(label, control));
    } else if (input.type === "time") {
      const control = timeInput(input.default);
      controls[input.key] = control;
      fields.push(field(label, control));
    }
  }

  const name = textInput(text.name || "", t.automations.name);

  dialog(
    text.name || template.id,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: text.description || "" }),
      field(t.automations.name, name),
      ...fields,
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.create, async () => {
        const data = {};
        for (const [key, control] of Object.entries(controls)) {
          if (control === null) {
            toast("Chybí vhodné zařízení pro tuhle šablonu.", true);
            return;
          }
          data[key] =
            typeof control.value === "string"
              ? control.type === "number"
                ? Number(control.value)
                : control.type === "time"
                  ? `${control.value}:00`
                  : control.value
              : control.selected();
        }

        try {
          await api.createAutomation({
            templateId: template.id,
            name: name.value,
            data,
          });
          closeDialog();
          toast(t.notice.saved);
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  );
}

function checkboxList(candidates) {
  const inputs = [];

  const node = h(
    "div",
    { class: "checklist" },
    candidates.map((entity) => {
      const input = h("input", { type: "checkbox", value: entity.id });
      inputs.push(input);
      return h("label", { class: "checklist__item" }, [
        input,
        h("span", { text: entity.name }),
      ]);
    }),
  );

  return {
    node,
    selected: () => inputs.filter((i) => i.checked).map((i) => i.value),
  };
}
