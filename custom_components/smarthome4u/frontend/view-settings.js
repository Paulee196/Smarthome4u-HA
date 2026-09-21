/* Nastavení aplikace.
 *
 * Skutečné nastavení, ne výpis verzí. Vzhled, kiosk režim, dashboard,
 * správce a stav systému včetně aktualizací a místa na disku.
 *
 * Nikde tu není odkaz do Home Assistantu.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";
import {
  h,
  button,
  confirmDialog,
  emptyState,
  field,
  selectInput,
  toast,
} from "./ui.js";

const PRESET_POPIS = {
  prehled: "prehled",
  mistnosti: "mistnosti",
  funkce: "funkce",
  pudorys: "pudorys",
};

export async function renderSettings(root, ctx) {
  const jeSpravce = ctx.model?.user?.role === "admin";

  root.append(karta(t.settings.account, "settings", [
    h("p", { class: "lead", text: ctx.model?.user?.name || t.settings.unknownUser }),
    h("p", {
      class: "muted",
      text: jeSpravce ? t.settings.youAreAdmin : t.settings.youAreUser,
    }),
  ]));

  if (!jeSpravce) {
    root.append(emptyState(t.settings.onlyAdmin));
    return;
  }

  let nastaveni;
  try {
    nastaveni = await api.settings();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(sekceVzhled(ctx, nastaveni));
  root.append(sekceDashboard(ctx, nastaveni));
  root.append(sekceSpravce(ctx, nastaveni));
  root.append(await sekceSystem());
}

function karta(nadpis, glyf, obsah) {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon(glyf)),
      h("h2", { class: "panel__title", text: nadpis }),
    ]),
    h("div", { class: "stack" }, obsah),
  ]);
}

function prepinac(popis, hodnota, onChange, napoveda) {
  const vstup = h("input", { class: "switch", type: "checkbox" });
  vstup.checked = Boolean(hodnota);
  vstup.addEventListener("change", () => onChange(vstup.checked));

  return h("div", { class: "stack" }, [
    h("label", { class: "checklist__item" }, [
      vstup,
      h("span", { text: popis }),
    ]),
    napoveda && h("p", { class: "muted", text: napoveda }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Vzhled a kiosk režim                                                */
/* ------------------------------------------------------------------ */

function sekceVzhled(ctx, nastaveni) {
  const uloz = async (zmena) => {
    try {
      await api.saveSettings(zmena);
      toast(t.notice.saved);
      // Aby se lišta schovala hned, bez obnovení stránky.
      window.dispatchEvent(new CustomEvent("sh4u-kiosk-changed"));
    } catch (error) {
      toast(error.message, true);
    }
  };

  return karta(t.settings.appearance, "rooms", [
    prepinac(
      t.settings.kiosk,
      nastaveni.kiosk,
      (zapnuto) => uloz({ kiosk: zapnuto }),
      t.settings.kioskHint,
    ),
    prepinac(
      t.settings.bigControls,
      nastaveni.bigControls,
      (zapnuto) => uloz({ bigControls: zapnuto }),
      t.settings.bigControlsHint,
    ),
    prepinac(
      t.settings.landing,
      nastaveni.landing,
      (zapnuto) => uloz({ landing: zapnuto }),
      t.settings.landingHint,
    ),
  ]);
}

/* ------------------------------------------------------------------ */
/* Podoba dashboardu                                                   */
/* ------------------------------------------------------------------ */

function sekceDashboard(ctx, nastaveni) {
  const mrizka = h("div", { class: "grid-buttons" });

  for (const klic of nastaveni.presets) {
    const nedostupny = nastaveni.unavailable.includes(klic);
    const vybrany = nastaveni.preset === klic;
    const popis = t.presets[PRESET_POPIS[klic]] || { name: klic, description: "" };

    mrizka.append(
      h(
        "button",
        {
          class: `picker${vybrany ? " picker--active" : ""}`,
          type: "button",
          disabled: nedostupny,
          "aria-pressed": String(vybrany),
          onclick: async () => {
            try {
              await api.saveSettings({ preset: klic });
              toast(t.notice.saved);
              await ctx.refresh();
              ctx.navigate("settings");
            } catch (error) {
              toast(error.message, true);
            }
          },
        },
        [
          h("span", { class: "picker__name", text: popis.name }),
          h("span", {
            class: "picker__desc",
            text: nedostupny ? t.presets.comingSoon : popis.description,
          }),
        ],
      ),
    );
  }

  return karta(t.settings.dashboard, "home", [
    h("p", { class: "muted", text: t.settings.dashboardHint }),
    mrizka,
    h("div", { class: "row" }, [
      button(t.settings.editDashboard, () => ctx.startEditing(), "button--ghost"),
      nastaveni.hasLayout &&
        button(
          t.settings.resetLayout,
          () =>
            confirmDialog(
              t.settings.resetLayout,
              t.settings.resetLayoutHint,
              async () => {
                try {
                  await api.saveLayout({ reset: true });
                  toast(t.notice.saved);
                  await ctx.refresh();
                } catch (error) {
                  toast(error.message, true);
                }
              },
            ),
          "button--ghost",
        ),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Správce                                                             */
/* ------------------------------------------------------------------ */

function sekceSpravce(ctx, nastaveni) {
  const volby = nastaveni.users.map((u) => ({ value: u.id, label: u.name }));
  const vyber = selectInput(volby, nastaveni.adminUserId || "");

  return karta(t.settings.admin, "devices", [
    h("p", { class: "muted", text: t.settings.adminHint }),
    field(t.settings.adminAccount, vyber),
    h("div", { class: "row" }, [
      button(t.action.save, async () => {
        try {
          await api.saveSettings({ adminUserId: vyber.value });
          toast(t.settings.adminChanged);
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Systém                                                              */
/* ------------------------------------------------------------------ */

async function sekceSystem() {
  let info;
  try {
    info = await api.system();
  } catch (error) {
    return karta(t.settings.system, "automations", [
      emptyState(error.message),
    ]);
  }

  const obsah = [];

  if (info.updates.length) {
    obsah.push(
      h("p", {
        class: "form-error",
        text: t.settings.updatesWaiting(info.updates.length),
      }),
    );
    for (const aktualizace of info.updates) {
      obsah.push(radekAktualizace(aktualizace));
    }
  } else {
    obsah.push(h("p", { class: "muted", text: t.settings.allUpToDate }));
  }

  const fakta = [
    [t.settings.appVersion, info.appVersion],
    [t.settings.haVersion, info.haVersion],
    info.host?.system && [t.settings.os, info.host.system],
    info.host?.hostname && [t.settings.hostname, info.host.hostname],
    [t.settings.devices, String(info.counts.devices)],
    [t.settings.entities, String(info.counts.entities)],
    [t.settings.integrations, String(info.counts.integrations)],
    [t.settings.automations, String(info.counts.automations)],
  ].filter(Boolean);

  obsah.push(
    h(
      "dl",
      { class: "facts" },
      fakta.flatMap(([popis, hodnota]) => [
        h("dt", { text: popis }),
        h("dd", { text: hodnota ?? "-" }),
      ]),
    ),
  );

  if (info.host?.diskPercent !== null && info.host?.diskPercent !== undefined) {
    obsah.push(disk(info.host));
  }

  if (info.stats) {
    if (info.stats.cpuPercent !== null && info.stats.cpuPercent !== undefined) {
      obsah.push(mira(t.settings.cpu, info.stats.cpuPercent));
    }
    if (
      info.stats.memoryPercent !== null &&
      info.stats.memoryPercent !== undefined
    ) {
      obsah.push(mira(t.settings.memory, info.stats.memoryPercent));
    }
  }

  return karta(t.settings.system, "automations", obsah);
}

function radekAktualizace(aktualizace) {
  const popis = aktualizace.latest
    ? `${aktualizace.installed || "?"} → ${aktualizace.latest}`
    : "";

  const tlacitko = aktualizace.canInstall
    ? h("button", {
        class: "tile__more",
        type: "button",
        "aria-label": t.settings.install,
        text: "↑",
        onclick: async (event) => {
          event.currentTarget.disabled = true;
          try {
            await api.installUpdate(aktualizace.id);
            toast(t.settings.installStarted);
          } catch (error) {
            toast(error.message, true);
          }
        },
      })
    : null;

  return h("div", { class: "tile" }, [
    h("div", { class: "tile__main tile__main--static" }, [
      h("span", { class: "tile__glyph" }, icon("automations")),
      h("span", { class: "tile__body" }, [
        h("span", { class: "tile__name", text: aktualizace.name }),
        h("span", {
          class: "tile__state",
          text: aktualizace.inProgress ? t.settings.installing : popis,
        }),
      ]),
    ]),
    tlacitko,
  ]);
}

/** Jednoduchý ukazatel v procentech. */
function mira(popis, procenta) {
  const pruh = h("span", { class: "progress__bar progress__bar--static" });
  pruh.style.width = procenta + "%";

  return h("div", { class: "field" }, [
    h("div", { class: "field__row" }, [
      h("span", { class: "field__label", text: popis }),
      h("span", { class: "field__value", text: procenta + " %" }),
    ]),
    h("div", { class: "progress" }, pruh),
  ]);
}

function disk(host) {
  const pruh = h("span", { class: "progress__bar progress__bar--static" });
  pruh.style.width = `${host.diskPercent}%`;

  return h("div", { class: "field" }, [
    h("div", { class: "field__row" }, [
      h("span", { class: "field__label", text: t.settings.disk }),
      h("span", {
        class: "field__value",
        text: `${host.diskUsed} / ${host.diskTotal} GB`,
      }),
    ]),
    h("div", { class: "progress" }, pruh),
    h("p", {
      class: host.diskPercent > 85 ? "form-error" : "muted",
      text: t.settings.diskFree(host.diskFree),
    }),
  ]);
}
