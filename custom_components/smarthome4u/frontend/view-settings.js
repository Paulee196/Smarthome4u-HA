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
import { VOLBY as MOTIVY, zvolenyMotiv, nastavitMotiv } from "./theme.js";
import {
  h,
  button,
  confirmDialog,
  closeDialog,
  dialog,
  emptyState,
  field,
  selectInput,
  textInput,
  toast,
} from "./ui.js";

export async function renderSettings(root, ctx) {
  const jeSpravce = ctx.model?.user?.role === "admin";
  const jeTechnik = ctx.model?.user?.role === "technician";
  const muzeNastavovat = jeSpravce || jeTechnik;

  root.append(karta(t.settings.account, "settings", [
    h("p", { class: "lead", text: ctx.model?.user?.name || t.settings.unknownUser }),
    h("p", {
      class: "muted",
      text: jeSpravce ? t.settings.youAreAdmin : jeTechnik ? t.settings.youAreTechnician : t.settings.youAreUser,
    }),
    h("p", { class: "muted", text: `${t.settings.appVersion} ${ctx.model?.version || ""}` }),
    muzeNastavovat &&
      prepinac(
        t.settings.technician,
        ctx.jeTechnik,
        () => ctx.prepnoutRezim(),
        t.settings.technicianHint,
      ),
  ]));

  // Vzhled si volí každý sám, i kdo není správce.
  root.append(sekceMotiv());

  let nastaveni;
  try {
    nastaveni = await api.settings();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  root.append(sekceDashboard(ctx, nastaveni));
  if (!muzeNastavovat) return;
  root.append(sekceVzhled(ctx, nastaveni));
  if (!ctx.jeTechnik) return;
  root.append(sekceSvetla(ctx, nastaveni));
  if (jeSpravce) {
    root.append(sekceSpravce(ctx, nastaveni));
    root.append(sekceRole(nastaveni));
  }
  root.append(await sekceSystem(jeSpravce));
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
  vstup.addEventListener("change", async () => {
    if (await onChange(vstup.checked) === false) vstup.checked = !vstup.checked;
  });

  return h("div", { class: "stack" }, [
    h("label", { class: "checklist__item" }, [
      vstup,
      h("span", { text: popis }),
    ]),
    napoveda && h("p", { class: "muted", text: napoveda }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Motiv                                                               */
/* ------------------------------------------------------------------ */

/* Světlý, tmavý, nebo podle Home Assistanta. Ukládá se do prohlížeče,
   ne k účtu - tablet na zdi a telefon v ruce chtějí každý něco jiného. */
function sekceMotiv() {
  const aktualni = zvolenyMotiv();
  const mrizka = h("div", { class: "grid-buttons" });

  for (const volba of MOTIVY) {
    const vybrany = volba === aktualni;
    mrizka.append(
      h(
        "button",
        {
          class: "picker" + (vybrany ? " picker--active" : ""),
          type: "button",
          "aria-pressed": String(vybrany),
          onclick: () => {
            nastavitMotiv(volba);
            for (const tlacitko of mrizka.children) {
              const je = tlacitko === mrizka.children[MOTIVY.indexOf(volba)];
              tlacitko.classList.toggle("picker--active", je);
              tlacitko.setAttribute("aria-pressed", String(je));
            }
          },
        },
        [
          h("span", { class: "picker__name", text: t.settings.themes[volba] }),
          h("span", { class: "picker__desc", text: t.settings.themesHint[volba] }),
        ],
      ),
    );
  }

  return karta(t.settings.theme, "rooms", [
    h("p", { class: "muted", text: t.settings.themeHint }),
    mrizka,
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
      if ("kiosk" in zmena) {
        window.dispatchEvent(new CustomEvent("sh4u-kiosk-changed", {
          detail: { kiosk: zmena.kiosk },
        }));
      }
      if ("bigControls" in zmena) await ctx.refresh();
      return true;
    } catch (error) {
      toast(error.message, true);
      return false;
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
/* Co je světlo                                                        */
/* ------------------------------------------------------------------ */

/* Home Assistant hlásí jako světlo i relé v prodlužce, zásuvku u televize
   nebo kontrolku na ESP čidle. Rozhodujeme podle schopností - co umí jen
   zapnout a vypnout, bereme jako spínač. Někdy se to netrefí, a tohle je
   místo, kde se to opraví hromadně, ne po jedné dlaždici. */
function sekceSvetla(ctx, nastaveni) {
  const seznam = nastaveni.lights || [];

  if (!seznam.length) {
    return karta(t.settings.whatIsLight, "lighting", [
      emptyState(t.settings.noLights),
    ]);
  }

  const radky = h("div", { class: "stack" });

  for (const polozka of seznam) {
    radky.append(radekSvetla(ctx, polozka));
  }

  return karta(t.settings.whatIsLight, "lighting", [
    h("p", { class: "muted", text: t.settings.whatIsLightHint }),
    radky,
  ]);
}

function radekSvetla(ctx, polozka) {
  const jeSvetlo = polozka.kind === "light";

  const prepinac = h("input", { class: "switch", type: "checkbox" });
  prepinac.checked = jeSvetlo;

  prepinac.addEventListener("change", async () => {
    const kind = prepinac.checked ? "light" : "switch";
    try {
      await api.classify(polozka.id, { kind });
      polozka.kind = kind;
      popis.textContent = popisek(polozka);
      const entity = ctx.allEntities().find((item) => item.id === polozka.id);
      if (entity?.capability) entity.capability.kind = kind;
      toast(t.notice.saved);
    } catch (error) {
      // Zpátky, ať přepínač neukazuje něco, co se neuložilo.
      prepinac.checked = polozka.kind === "light";
      toast(error.message, true);
    }
  });

  const popis = h("span", { class: "tile__state", text: popisek(polozka) });

  return h("label", { class: "tile tile--radek" }, [
    prepinac,
    h("span", { class: "tile__body" }, [
      h("span", {
        class: "tile__name",
        text: [polozka.room, polozka.name].filter(Boolean).join(" · "),
      }),
      popis,
    ]),
  ]);
}

function popisek(polozka) {
  if (polozka.kind === "light") {
    return polozka.dimmable ? t.settings.lightDimmable : t.settings.lightOnOff;
  }
  return t.settings.notLight;
}

/* ------------------------------------------------------------------ */
/* Podoba dashboardu                                                   */
/* ------------------------------------------------------------------ */

function sekceDashboard(ctx, nastaveni) {
  const mrizka = h("div", { class: "grid-buttons" });
  const jeSpravce = ctx.model?.user?.role === "admin";
  const dashboards = nastaveni.dashboards || [];
  async function change(body) {
    try {
      await api.dashboardCatalog(body);
      closeDialog();
      toast(t.notice.saved);
      await ctx.refresh();
      if (body.action === "create") ctx.startEditing();
      else ctx.navigate("settings");
    } catch (error) { toast(error.message, true); }
  }
  for (const dashboard of dashboards) {
    const vybrany = ctx.model.preset === dashboard.id;
    const choose = button(dashboard.name, async () => {
      try {
        await api.setPreset(dashboard.id);
        await ctx.refresh();
        ctx.navigate("settings");
      } catch (error) { toast(error.message, true); }
    }, vybrany ? "button" : "button--ghost");
    const actions = [choose];
    if (jeSpravce || dashboard.ownerId === ctx.model?.user?.id) {
      actions.push(button(t.action.rename, () => {
        const name = textInput(dashboard.name);
        dialog(t.dashboardManager.rename, field(t.dashboardManager.name, name),
          button(t.action.save, () => change({ action: "rename", id: dashboard.id,
            name: name.value.trim() })));
      }, "button--ghost"));
      actions.push(button(t.action.delete, () => confirmDialog(
        t.dashboardManager.delete, t.dashboardManager.deleteHint,
        () => change({ action: "delete", id: dashboard.id })), "button--ghost"));
    }
    mrizka.append(h("div", { class: "row dashboard-manager__item" }, actions));
  }

  const extra = [];
  extra.push(button(t.dashboardManager.create, () => {
      const name = textInput("", t.dashboardManager.name);
      const template = selectInput([
        { value: "blank", label: t.dashboardManager.blank },
        { value: "overview", label: t.dashboardManager.overview },
        ...["tuya", "home", "pudorys", "prehled"].map((id) => ({
          value: id, label: t.presets[id].name,
        })),
      ], "blank");
      dialog(t.dashboardManager.create, h("div", { class: "stack" }, [
        field(t.dashboardManager.name, name), field(t.dashboardManager.template, template),
        h("p", { class: "muted", text: t.dashboardManager.templateHint }),
      ]), button(t.action.create, () => change({ action: "create",
        name: name.value.trim(), template: template.value })));
  }));
  if (jeSpravce) {
    if (!dashboards.some((item) => item.id === "overview")) {
      extra.push(button(t.dashboardManager.restoreOverview,
        () => change({ action: "restoreOverview" }), "button--ghost"));
    }
    for (const user of dashboards.length ? nastaveni.users || [] : []) {
      if (user.id === nastaveni.adminUserId) continue;
      const assigned = nastaveni.dashboardAssignments?.[user.id] || dashboards[0]?.id;
      const picker = selectInput(dashboards.map((item) => ({
        value: item.id, label: item.name,
      })), assigned);
      picker.addEventListener("change", () => change({ action: "assign",
        id: picker.value, userId: user.id }));
      extra.push(field(t.dashboardManager.assignedTo(user.name), picker));
    }
  }

  return karta(t.settings.dashboard, "home", [
    h("p", { class: "muted", text: t.dashboardManager.hint }),
    mrizka,
    ...extra,
    h("div", { class: "stack" }, t.dashboardManager.examples.map((example) =>
      h("p", { class: "muted", text: example }))),
    h("div", { class: "row" }, [
      ctx.muzeUpravitPlochu && button(t.settings.editDashboard,
        () => ctx.startEditing(), "button--ghost"),
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

function sekceRole(nastaveni) {
  const obsah = [h("p", { class: "muted", text: t.settings.rolesHint })];
  for (const user of nastaveni.users.filter((u) => u.id !== nastaveni.adminUserId)) {
    const vyber = selectInput([
      { value: "user", label: t.settings.roleUser },
      { value: "technician", label: t.settings.roleTechnician },
    ], nastaveni.roles?.[user.id] || "technician");
    obsah.push(field(user.name || t.settings.unknownUser, vyber));
    obsah.push(button(t.action.save, async () => {
      try {
        await api.setRole(user.id, vyber.value);
        toast(t.settings.roleChanged);
      } catch (error) {
        toast(error.message, true);
      }
    }));
  }
  return karta(t.settings.roles, "devices", obsah);
}

/* ------------------------------------------------------------------ */
/* Systém                                                              */
/* ------------------------------------------------------------------ */

async function sekceSystem(muzeInstalovat) {
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
      obsah.push(radekAktualizace(aktualizace, muzeInstalovat));
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

function radekAktualizace(aktualizace, muzeInstalovat) {
  const popis = aktualizace.latest
    ? `${aktualizace.installed || "?"} → ${aktualizace.latest}`
    : "";

  const tlacitko = aktualizace.canInstall && muzeInstalovat
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
