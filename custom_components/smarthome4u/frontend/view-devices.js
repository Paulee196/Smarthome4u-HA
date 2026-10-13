/* Zařízení a integrace.
 *
 * Dvě záložky nad stejnou sekcí. Nikde odkaz do Home Assistantu.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { icon } from "./icons.js";
import { renderIntegrations, renderHelpers } from "./view-integrations.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  field,
  loadingState,
  section,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

let activeTab = "devices";

export function resetDevicesTab() {
  activeTab = "devices";
}

export async function renderDevices(root, ctx) {
  const body = h("div", { class: "view" });

  const show = async (tab) => {
    activeTab = tab;
    const current = h("div", { class: "view" });
    body.replaceChildren(current);
    if (tab === "integrations") await renderIntegrations(current, ctx);
    else if (tab === "helpers") await renderHelpers(current, ctx);
    else await renderDeviceList(current, ctx);
  };

  root.append(tabs(activeTab, show));
  root.append(body);

  await show(activeTab);
}

function tabs(active, onChange) {
  const wrap = h("div", { class: "segmented", role: "tablist" });

  for (const [key, label] of [
    ["devices", t.integrations.tabDevices],
    ["integrations", t.integrations.tabIntegrations],
    ["helpers", t.integrations.tabHelpers],
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
  const loading = loadingState(t.devices.loading);
  root.append(loading);
  let data;
  try {
    data = await api.devices();
  } catch (error) {
    loading.remove();
    root.append(emptyState(error.message));
    return;
  }
  loading.remove();
  if (!root.isConnected) return;

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

  // První položky se ukážou hned; další várky neblokují kreslení prohlížeče.
  let rendered = 0;
  for (const [areaName, devices] of grouped) {
    const rows = h("div", { class: "stack" });
    root.append(h("section", { class: "panel" }, [
        h("div", { class: "panel__head" }, [
          h("span", { class: "panel__glyph" }, icon("rooms")),
          h("h2", { class: "panel__title", text: areaName }),
        ]),
        rows,
      ]));
    for (let start = 0; start < devices.length; start += 40) {
      rows.append(...devices.slice(start, start + 40).map((device) => deviceRow(ctx, device)));
      rendered += 40;
      if (rendered >= 40) {
        rendered = 0;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!root.isConnected) return;
      }
    }
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
