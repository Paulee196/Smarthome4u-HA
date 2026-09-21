/* Sdílené stavební prvky rozhraní.
 *
 * Dialogy nesmí opustit viewport, dotykové cíle mají alespoň 44 px
 * a každá akce jde udělat dotykem i klávesnicí.
 */

import { t } from "./i18n.js";

/* Kam se vkládají dialogy a hlášky. Nastaví ho panel při startu. */
let host = null;

export function setHost(root) {
  host = root;
  root.addEventListener("keydown", (event) => {
    try {
      if (event.key === "Escape") closeDialog();
    } catch {
      /* Zavírání dialogu nesmí shodit obsluhu klávesnice. */
    }
  });
}

function shell() {
  return host?.querySelector(".shell") || host;
}

/** Vytvoří prvek. children může být text, prvek nebo pole. */
export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on"))
      node.addEventListener(key.slice(2), obalit(value));
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    if (child === "") continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* Každá akce v aplikaci projde tudy. Když se něco nepovede, uživatel to
   musí vidět - jinak mačká tlačítko znovu a zdánlivě se nic neděje.
   Stejně tak se nesmí stát, že chyba v jednom tlačítku zastaví zbytek. */
function obalit(handler) {
  if (typeof handler !== "function") return handler;

  return function (event) {
    try {
      const vysledek = handler.call(this, event);
      if (vysledek && typeof vysledek.catch === "function") {
        vysledek.catch(ohlasit);
      }
    } catch (error) {
      ohlasit(error);
    }
  };
}

function ohlasit(error) {
  console.error("[Smarthome4u]", error);
  toast(error?.message || t.error.generic, true);
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
  const box = host?.getElementById("toast");
  if (!box) return;
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

  shell().append(backdrop);
  shell().classList.add("no-scroll");
  openDialog = backdrop;

  const focusable = panel.querySelector("input, select, button");
  if (focusable) focusable.focus();

  return { close: closeDialog, panel };
}

export function closeDialog() {
  if (!openDialog) return;
  openDialog.remove();
  openDialog = null;
  shell()?.classList.remove("no-scroll");
}

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
