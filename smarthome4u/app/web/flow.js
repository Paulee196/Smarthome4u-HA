/* Průvodce přidáním integrace.
 *
 * Celý běží ve Smarthome4u. Uživatele nikdy nepřesouváme do Home Assistantu.
 * Backend posílá hotový popis kroku, frontend si nedomýšlí nic o HA.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  field,
  numberInput,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

let pollTimer = null;

/** Spustí průvodce pro jednu integraci. */
export async function startFlow(handler, onFinished) {
  await runStep(() => api.flowStart(handler), onFinished);
}

/** Naváže na průvodce, který Home Assistant sám rozpracoval po nalezení. */
export async function resumeFlow(flowId, onFinished) {
  await runStep(() => api.flowRead(flowId), onFinished);
}

async function runStep(load, onFinished) {
  let step;
  try {
    step = await load();
  } catch (error) {
    toast(error.message, true);
    return;
  }
  render(step, onFinished);
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = null;
}

/* ------------------------------------------------------------------ */
/* Vykreslení kroku                                                    */
/* ------------------------------------------------------------------ */

function render(step, onFinished) {
  stopPolling();

  switch (step.type) {
    case "form":
      return renderForm(step, onFinished);
    case "menu":
      return renderMenu(step, onFinished);
    case "external":
      return renderExternal(step, onFinished);
    case "progress":
      return renderProgress(step, onFinished);
    case "done":
      return renderDone(step, onFinished);
    case "aborted":
      return renderAborted(step, onFinished);
    default:
      return renderAborted(
        { title: step.title, message: t.flow.unsupported },
        onFinished,
      );
  }
}

function renderForm(step, onFinished) {
  const controls = new Map();
  const body = h("div", { class: "stack" });

  if (step.message) body.append(h("p", { class: "muted", text: step.message }));

  const generalError = step.errors?.base;
  if (generalError) {
    body.append(h("p", { class: "form-error", text: generalError }));
  }

  for (const spec of step.fields) {
    const control = buildField(spec);
    controls.set(spec.name, { spec, control });

    const wrap = field(spec.label + (spec.required ? " *" : ""), control.node);
    if (spec.hint) wrap.append(h("span", { class: "field__hint", text: spec.hint }));
    if (step.errors?.[spec.name]) {
      wrap.append(h("span", { class: "form-error", text: step.errors[spec.name] }));
    }
    body.append(wrap);
  }

  if (step.unsupported?.length) {
    body.append(h("p", { class: "form-error", text: t.flow.unsupportedField }));
  }

  dialog(
    step.title,
    body,
    h("div", { class: "row" }, [
      button(t.action.cancel, () => cancel(step.flowId), "button--ghost"),
      button(t.flow.next, async () => {
        const data = {};
        for (const [name, entry] of controls) {
          const value = entry.control.value();
          if (entry.spec.required && (value === "" || value === null)) {
            toast(t.flow.fillRequired, true);
            return;
          }
          if (value !== "" && value !== null) data[name] = value;
        }
        await submit(step.flowId, data, onFinished);
      }),
    ]),
  );
}

function renderMenu(step, onFinished) {
  const body = h("div", { class: "stack" }, [
    step.message && h("p", { class: "muted", text: step.message }),
    ...step.options.map((option) =>
      h(
        "button",
        {
          class: "picker",
          type: "button",
          onclick: () =>
            submit(step.flowId, { next_step_id: option.value }, onFinished),
        },
        [h("span", { class: "picker__name", text: option.label })],
      ),
    ),
  ]);

  dialog(
    step.title,
    body,
    h("div", { class: "row" }, [
      button(t.action.cancel, () => cancel(step.flowId), "button--ghost"),
    ]),
  );
}

function renderExternal(step, onFinished) {
  // Odkaz vede k poskytovateli služby, ne do Home Assistantu.
  const body = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: step.message || t.flow.externalHint }),
    h("a", {
      class: "button button--wide",
      href: step.url,
      target: "_blank",
      rel: "noopener",
      text: t.flow.openProvider,
    }),
  ]);

  dialog(
    step.title,
    body,
    h("div", { class: "row" }, [
      button(t.action.cancel, () => cancel(step.flowId), "button--ghost"),
      button(t.flow.done, () => reload(step.flowId, onFinished)),
    ]),
  );
}

function renderProgress(step, onFinished) {
  const body = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: step.message || t.flow.working }),
    h("div", { class: "progress" }, h("span", { class: "progress__bar" })),
  ]);

  dialog(
    step.title,
    body,
    h("div", { class: "row" }, [
      button(t.action.cancel, () => cancel(step.flowId), "button--ghost"),
    ]),
  );

  pollTimer = setTimeout(() => reload(step.flowId, onFinished), 2000);
}

function renderDone(step, onFinished) {
  dialog(
    t.flow.addedTitle,
    h("div", { class: "stack" }, [
      h("p", { class: "lead", text: step.title }),
      h("p", { class: "muted", text: t.flow.addedHint }),
    ]),
    h("div", { class: "row" }, [
      button(t.action.close, () => {
        closeDialog();
        onFinished?.();
      }),
    ]),
  );
}

function renderAborted(step, onFinished) {
  dialog(
    step.title || t.flow.stopped,
    h("p", { class: "muted", text: step.message || t.flow.stoppedHint }),
    h("div", { class: "row" }, [
      button(t.action.close, () => {
        closeDialog();
        onFinished?.();
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Akce                                                                */
/* ------------------------------------------------------------------ */

async function submit(flowId, data, onFinished) {
  try {
    render(await api.flowSubmit(flowId, data), onFinished);
  } catch (error) {
    toast(error.message, true);
  }
}

async function reload(flowId, onFinished) {
  try {
    render(await api.flowRead(flowId), onFinished);
  } catch (error) {
    toast(error.message, true);
  }
}

async function cancel(flowId) {
  stopPolling();
  closeDialog();
  try {
    if (flowId) await api.flowAbort(flowId);
  } catch {
    /* Průvodce už mohl skončit sám. Uživateli to nic neříká. */
  }
}

/* ------------------------------------------------------------------ */
/* Pole formuláře                                                      */
/* ------------------------------------------------------------------ */

function buildField(spec) {
  switch (spec.type) {
    case "boolean": {
      const node = h("input", { class: "switch", type: "checkbox" });
      node.checked = Boolean(spec.default);
      return { node, value: () => node.checked };
    }

    case "number": {
      const node = numberInput(
        spec.default ?? spec.min ?? 0,
        spec.min ?? -1000000,
        spec.max ?? 1000000,
        spec.step ?? 1,
      );
      return { node, value: () => (node.value === "" ? null : Number(node.value)) };
    }

    case "select": {
      const options = spec.options || [];
      const node = selectInput(options, spec.default ?? options[0]?.value ?? "");
      return { node, value: () => node.value };
    }

    case "multi": {
      const inputs = [];
      const node = h(
        "div",
        { class: "checklist" },
        (spec.options || []).map((option) => {
          const box = h("input", { type: "checkbox", value: String(option.value) });
          inputs.push({ box, value: option.value });
          return h("label", { class: "checklist__item" }, [
            box,
            h("span", { text: option.label }),
          ]);
        }),
      );
      return {
        node,
        value: () => inputs.filter((i) => i.box.checked).map((i) => i.value),
      };
    }

    case "password": {
      const node = textInput(spec.default ?? "");
      node.type = "password";
      node.autocomplete = "new-password";
      return { node, value: () => node.value };
    }

    default: {
      const node = textInput(spec.default ?? "");
      return { node, value: () => node.value };
    }
  }
}
