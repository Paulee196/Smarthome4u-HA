/* Zařízení a integrace.
 *
 * Dvě záložky nad stejnou sekcí. Nikde odkaz do Home Assistantu.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { icon } from "./icons.js";
import { renderIntegrations } from "./view-integrations.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  field,
  section,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

const TAB_KEY = "sh4u.devices.tab";

export async function renderDevices(root, ctx) {
  const body = h("div", { class: "view" });

  const show = async (tab) => {
    writeTab(tab);
    body.replaceChildren();
    if (tab === "integrations") await renderIntegrations(body, ctx);
    else await renderDeviceList(body, ctx);
  };

  root.append(tabs(readTab(), show));
  root.append(body);

  await show(readTab());
}

function readTab() {
  try {
    return localStorage.getItem(TAB_KEY) === "integrations"
      ? "integrations"
      : "devices";
  } catch {
    return "devices";
  }
}

function writeTab(tab) {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* Soukromé okno - jen se to nezapamatuje. */
  }
}

function tabs(active, onChange) {
  const wrap = h("div", { class: "segmented", role: "tablist" });

  for (const [key, label] of [
    ["devices", t.integrations.tabDevices],
    ["integrations", t.integrations.tabIntegrations],
  ]) {
    const item = h("button", {
      class: `segmented__item${active === key ? " segmented__item--active" : ""}`,
      type: "button",
      role: "tab",
      "aria-selected": String(active === key),
      text: label,
      onclick: () => {
        wrap.querySelectorAll(".segmented__item").forEach((node) => {
          node.classList.remove("segmented__item--active");
          node.setAttribute("aria-selected", "false");
        });
        item.classList.add("segmented__item--active");
        item.setAttribute("aria-selected", "true");
        onChange(key);
      },
    });
    wrap.append(item);
  }
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Seznam zařízení                                                     */
/* ------------------------------------------------------------------ */

async function renderDeviceList(root, ctx) {
  let data;
  try {
    data = await api.devices();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  if (!data.devices.length) {
    root.append(emptyState(t.devices.empty));
    return;
  }

  const grouped = new Map();
  for (const device of data.devices) {
    const key = device.areaName || t.rooms.unassigned;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(device);
  }

  for (const [areaName, devices] of grouped) {
    root.append(
      h("section", { class: "panel" }, [
        h("div", { class: "panel__head" }, [
          h("span", { class: "panel__glyph" }, icon("rooms")),
          h("h2", { class: "panel__title", text: areaName }),
        ]),
        h(
          "div",
          { class: "stack" },
          devices.map((device) => deviceRow(ctx, device)),
        ),
      ]),
    );
  }
}

function deviceRow(ctx, device) {
  const subtitle = [device.manufacturer, device.model].filter(Boolean).join(" · ");

  return h("div", { class: "tile" }, [
    h(
      "button",
      {
        class: "tile__main",
        type: "button",
        onclick: () => openDetail(ctx, device.id),
      },
      [
        h("span", { class: "tile__glyph" }, icon("devices")),
        h("span", { class: "tile__body" }, [
          h("span", { class: "tile__name", text: device.name }),
          h("span", {
            class: "tile__state",
            text: subtitle || device.integration || "",
          }),
        ]),
      ],
    ),
  ]);
}

/* ------------------------------------------------------------------ */
/* Detail zařízení                                                     */
/* ------------------------------------------------------------------ */

async function openDetail(ctx, deviceId) {
  let detail;
  let structure;
  try {
    [detail, structure] = await Promise.all([api.device(deviceId), api.structure()]);
  } catch (error) {
    toast(error.message, true);
    return;
  }

  const name = textInput(detail.name, t.devices.deviceName);
  const area = selectInput(
    [
      { value: "", label: t.rooms.unassigned },
      ...structure.areas.map((a) => ({ value: a.id, label: a.name })),
    ],
    detail.areaId || "",
  );

  const facts = [
    [t.devices.manufacturer, detail.manufacturer],
    [t.devices.model, detail.model],
    [t.devices.integration, detail.integration],
  ].filter(([, value]) => Boolean(value));

  const body = h("div", { class: "stack" }, [
    field(t.devices.deviceName, name),
    field(t.devices.room, area),
    h("p", { class: "muted", text: t.devices.renameHint }),

    facts.length &&
      h(
        "dl",
        { class: "facts" },
        facts.flatMap(([label, value]) => [
          h("dt", { text: label }),
          h("dd", { text: value }),
        ]),
      ),

    detail.entities.length &&
      section(
        t.devices.functions,
        h(
          "div",
          { class: "cards" },
          detail.entities.map((entity) => card(entity)),
        ),
      ),

    h("p", { class: "muted", text: t.devices.removeHint }),
  ]);

  dialog(
    detail.name,
    body,
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, async () => {
        try {
          await api.updateDevice(detail.id, {
            name: name.value,
            areaId: area.value || null,
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
