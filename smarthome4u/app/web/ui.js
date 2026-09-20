/* Sdílené stavební prvky rozhraní.
 *
 * Dialogy nesmí opustit viewport, dotykové cíle mají alespoň 44 px
 * a každá akce jde udělat dotykem i klávesnicí.
 */

import { t } from "./i18n.js";

/** Vytvoří prvek. children může být text, prvek nebo pole. */
export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Odkaz do Home Assistantu. Musí opustit iframe, proto target _top. */
export function haLink(path, label, extraClass = "") {
  return h("a", {
    class: `button button--ghost ${extraClass}`.trim(),
    href: path,
    target: "_top",
    rel: "noopener",
    text: label || t.action.openInHa,
  });
}

export function button(label, onClick, variant = "") {
  return h(
    "button",
    { class: `button ${variant}`.trim(), type: "button", onclick: onClick },
    label,
  );
}

export function section(title, children, actions = null) {
  return h("section", { class: "block" }, [
    h("div", { class: "block__head" }, [
      h("h2", { class: "block__title", text: title }),
      actions,
    ]),
    ...[].concat(children),
  ]);
}

export function emptyState(text) {
  return h("p", { class: "muted", text });
}

/* ------------------------------------------------------------------ */
/* Hlášky                                                              */
/* ------------------------------------------------------------------ */

let toastTimer = null;

export function toast(message, isError = false) {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.className = `toast ${isError ? "toast--error" : "toast--ok"} toast--shown`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.className = "toast";
  }, 4000);
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

let openDialog = null;

/** Otevře panel. Na telefonu zespodu, na desktopu uprostřed. */
export function dialog(title, content, footer = null) {
  closeDialog();

  const panel = h("div", { class: "dialog", role: "dialog", "aria-modal": "true" }, [
    h("div", { class: "dialog__head" }, [
      h("h2", { class: "dialog__title", text: title }),
      h("button", {
        class: "dialog__close",
        type: "button",
        "aria-label": t.action.close,
        text: "✕",
        onclick: closeDialog,
      }),
    ]),
    h("div", { class: "dialog__body" }, content),
    footer && h("div", { class: "dialog__foot" }, footer),
  ]);

  const backdrop = h(
    "div",
    {
      class: "backdrop",
      onclick: (event) => {
        if (event.target === backdrop) closeDialog();
      },
    },
    panel,
  );

  document.body.append(backdrop);
  document.body.classList.add("no-scroll");
  openDialog = backdrop;

  const focusable = panel.querySelector("input, select, button");
  if (focusable) focusable.focus();

  return { close: closeDialog, panel };
}

export function closeDialog() {
  if (!openDialog) return;
  openDialog.remove();
  openDialog = null;
  document.body.classList.remove("no-scroll");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDialog();
});

/* ------------------------------------------------------------------ */
/* Formulářové prvky                                                   */
/* ------------------------------------------------------------------ */

export function field(label, control) {
  const id = `f${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  return h("div", { class: "field" }, [
    h("label", { class: "field__label", for: id, text: label }),
    control,
  ]);
}

export function textInput(value = "", placeholder = "") {
  return h("input", {
    class: "input",
    type: "text",
    value,
    placeholder,
    maxlength: "80",
  });
}

export function numberInput(value, min, max, step = 1) {
  return h("input", {
    class: "input",
    type: "number",
    value: String(value),
    min: String(min),
    max: String(max),
    step: String(step),
  });
}

export function timeInput(value) {
  return h("input", { class: "input", type: "time", value: value.slice(0, 5) });
}

export function selectInput(options, value = "") {
  const node = h(
    "select",
    { class: "input" },
    options.map((option) =>
      h("option", { value: option.value, selected: option.value === value }, option.label),
    ),
  );
  node.value = value;
  return node;
}

export function slider(value, min, max, step, onInput) {
  const input = h("input", {
    class: "slider",
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  input.addEventListener("change", () => onInput(Number(input.value)));
  return input;
}

/** Potvrzení nebezpečné akce. Nikdy nemaže bez zeptání. */
export function confirmDialog(title, message, onConfirm) {
  dialog(
    title,
    h("p", { class: "muted", text: message }),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(
        t.action.delete,
        async () => {
          closeDialog();
          await onConfirm();
        },
        "button--danger",
      ),
    ]),
  );
}
