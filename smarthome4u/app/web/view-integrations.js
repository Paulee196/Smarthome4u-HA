/* Integrace - vlastní seznam a vlastní přidávání.
 *
 * Nikde tu není odkaz do Home Assistantu. Všechno se děje ve Smarthome4u.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";
import { startFlow, resumeFlow } from "./flow.js";
import {
  h,
  button,
  closeDialog,
  confirmDialog,
  dialog,
  emptyState,
  textInput,
  toast,
} from "./ui.js";

export async function renderIntegrations(root, ctx) {
  let data;
  try {
    data = await api.integrations();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(
    h("div", { class: "row row--end" }, [
      button(t.integrations.add, () => openCatalog(ctx), ""),
    ]),
  );

  if (data.discovered.length) {
    root.append(
      panel(
        t.integrations.discovered,
        [
          h("p", { class: "muted", text: t.integrations.discoveredHint }),
          h(
            "div",
            { class: "stack" },
            data.discovered.map((flow) => discoveredRow(ctx, flow)),
          ),
        ],
      ),
    );
  }

  root.append(
    panel(
      t.integrations.configured,
      data.configured.length
        ? h(
            "div",
            { class: "stack" },
            data.configured.map((entry) => entryRow(ctx, entry)),
          )
        : emptyState(t.integrations.empty),
    ),
  );
}

function panel(title, content) {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon("devices")),
      h("h2", { class: "panel__title", text: title }),
    ]),
    ...[].concat(content),
  ]);
}

function discoveredRow(ctx, flow) {
  const label = flow.title ? `${flow.name} · ${flow.title}` : flow.name;

  return h("div", { class: "tile" }, [
    h(
      "button",
      {
        class: "tile__main",
        type: "button",
        onclick: () => resumeFlow(flow.flowId, ctx.refresh),
      },
      [
        h("span", { class: "tile__glyph" }, icon("devices")),
        h("span", { class: "tile__body" }, [
          h("span", { class: "tile__name", text: label }),
          h("span", {
            class: "tile__state tile__state--on",
            text: t.integrations.finishSetup,
          }),
        ]),
      ],
    ),
  ]);
}

function entryRow(ctx, entry) {
  const broken = entry.state && entry.state !== "loaded";
  const subtitle = broken
    ? t.integrations.problem
    : `${entry.deviceCount} ${t.rooms.deviceCount}`;

  return h("div", { class: "tile" }, [
    h("div", { class: "tile__main tile__main--static" }, [
      h("span", { class: "tile__glyph" }, icon("devices")),
      h("span", { class: "tile__body" }, [
        h("span", { class: "tile__name", text: entry.title || entry.name }),
        h("span", {
          class: `tile__state${broken ? " tile__state--alert" : ""}`,
          text: `${entry.name} · ${subtitle}`,
        }),
      ]),
    ]),
    h("button", {
      class: "tile__more tile__more--danger",
      type: "button",
      "aria-label": t.integrations.remove,
      text: "✕",
      onclick: () =>
        confirmDialog(
          entry.title || entry.name,
          t.integrations.removeHint,
          async () => {
            try {
              await api.deleteIntegration(entry.entryId);
              toast(t.notice.saved);
              await ctx.refresh();
            } catch (error) {
              toast(error.message, true);
            }
          },
        ),
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Katalog integrací                                                   */
/* ------------------------------------------------------------------ */

// Co lidé přidávají nejčastěji. Ukáže se nahoře, ať to nemusí hledat.
const POPULAR = [
  "zha",
  "matter",
  "mqtt",
  "esphome",
  "shelly",
  "hue",
  "tuya",
  "knx",
  "tado",
  "sonoff",
];

async function openCatalog(ctx) {
  const body = h("div", { class: "stack" }, [
    h("p", { class: "muted", text: t.integrations.loading }),
  ]);
  dialog(t.integrations.add, body);

  let available;
  try {
    available = (await api.availableIntegrations()).available;
  } catch (error) {
    body.replaceChildren(h("p", { class: "form-error", text: error.message }));
    return;
  }

  const search = textInput("", t.integrations.search);
  const list = h("div", { class: "stack" });

  const draw = (query) => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? available.filter((item) => item.name.toLowerCase().includes(needle))
      : sortPopularFirst(available);

    list.replaceChildren(
      ...matches.slice(0, 60).map((item) =>
        h(
          "button",
          {
            class: "picker",
            type: "button",
            onclick: () => {
              closeDialog();
              startFlow(item.domain, ctx.refresh);
            },
          },
          [h("span", { class: "picker__name", text: item.name })],
        ),
      ),
    );

    if (!matches.length) {
      list.replaceChildren(emptyState(t.integrations.noMatch));
    }
  };

  search.addEventListener("input", () => draw(search.value));

  body.replaceChildren(
    h("p", { class: "muted", text: t.integrations.addHint }),
    search,
    list,
  );
  draw("");
  search.focus();
}

function sortPopularFirst(available) {
  const rank = new Map(POPULAR.map((domain, index) => [domain, index]));
  return [...available].sort((a, b) => {
    const ra = rank.has(a.domain) ? rank.get(a.domain) : 999;
    const rb = rank.has(b.domain) ? rank.get(b.domain) : 999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "cs");
  });
}
