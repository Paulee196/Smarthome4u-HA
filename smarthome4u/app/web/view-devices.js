/* Zařízení - seznam, detail, nastavení a přidání nového. */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  field,
  haLink,
  section,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

// Nejčastější způsoby, jak zákazník přidává zařízení.
const INTEGRATIONS = [
  { domain: "zha", key: "zha" },
  { domain: "matter", key: "matter" },
  { domain: "mqtt", key: "mqtt" },
  { domain: "esphome", key: "esphome" },
  { domain: "shelly", key: "shelly" },
  { domain: "hue", key: "hue" },
  { domain: "tuya", key: "tuya" },
  { domain: "knx", key: "knx" },
];

export async function renderDevices(root, ctx) {
  let data;
  try {
    data = await api.devices();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(
    h("div", { class: "row row--end" }, [
      button(t.devices.add, () => openAdd(), "button--ghost"),
    ]),
  );

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
      section(
        areaName,
        h(
          "div",
          { class: "stack" },
          devices.map((device) => deviceRow(ctx, device)),
        ),
      ),
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
        h("span", { class: "tile__mark" }),
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
    haLink(`/config/devices/device/${encodeURIComponent(detail.id)}`),
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

/* ------------------------------------------------------------------ */
/* Přidání zařízení                                                    */
/* ------------------------------------------------------------------ */

async function openAdd() {
  const body = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.devices.discoveredHint }),
    h("p", { class: "muted", text: "…" }),
  ]);

  dialog(t.devices.addTitle, body);

  let discovered = [];
  try {
    discovered = (await api.discovered()).discovered;
  } catch {
    discovered = [];
  }

  body.replaceChildren(
    section(
      t.devices.discovered,
      discovered.length
        ? h("div", { class: "stack" }, [
            h("p", { class: "muted", text: t.devices.discoveredHint }),
            ...discovered.map((flow) =>
              haLink(
                "/config/integrations/dashboard",
                flow.title,
                "button--wide",
              ),
            ),
          ])
        : emptyState(t.devices.noDiscovered),
    ),

    section(t.devices.add, [
      h("p", { class: "muted", text: t.devices.manualHint }),
      h(
        "div",
        { class: "grid-buttons" },
        INTEGRATIONS.map((item) =>
          haLink(
            `/config/integrations/dashboard/add?domain=${item.domain}`,
            t.addDevice[item.key],
          ),
        ),
      ),
      haLink(
        "/config/integrations/dashboard/add",
        t.addDevice.browse,
        "button--wide",
      ),
    ]),
  );
}
