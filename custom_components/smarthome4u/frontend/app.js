/* Smarthome4u - kostra aplikace a přepínání sekcí.
 *
 * Panel nám předá svůj stínový strom. Frontend mluví výhradně s interním
 * Smarthome4u API.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";
import { applyStates, clearWatchers, nastavitOblibene } from "./controls.js";
import { closeDialog, h } from "./ui.js";
import { APP_VERSION } from "./version.js";
import { renderHome } from "./view-home.js";
import { renderRooms } from "./view-rooms.js";
import { renderScenes } from "./view-scenes.js";
import { renderAutomations } from "./view-automations.js";
import { renderDevices } from "./view-devices.js";
import { renderSettings } from "./view-settings.js";

/* Uživatel vidí jen to, co denně používá. Automatizace, zařízení
   a integrace patří technikovi - jinak z toho je nepřehledná hromada. */
const ROUTES = {
  home: { label: t.nav.home, render: renderHome },
  rooms: { label: t.nav.rooms, render: renderRooms },
  scenes: { label: t.nav.scenes, render: renderScenes },
  automations: {
    label: t.nav.automations,
    render: renderAutomations,
    technik: true,
  },
  devices: { label: t.nav.devices, render: renderDevices, technik: true },
  settings: {
    label: t.nav.settings,
    render: renderSettings,
    hidden: true,
    technik: true,
  },
};

/* Režim se neukládá natrvalo. Vychází z toho, kdo je přihlášený:
   správce domácnosti začíná v technickém režimu, ostatní v uživatelském.
   Přepnutí platí do konce sezení, po dalším přihlášení se zase řídí účtem. */
const REZIM_KLIC = "sh4u.rezim";

const state = { model: null, route: "home", editing: false, rezim: "user" };
let el = null;

const ctx = {
  get model() {
    return state.model;
  },
  refresh: loadModel,
  navigate,
  allEntities: () => (state.model?.rooms || []).flatMap((room) => room.entities),

  get editing() {
    return state.editing;
  },

  get rezim() {
    return state.rezim;
  },
  get jeTechnik() {
    return state.rezim === "technician";
  },
  prepnoutRezim() {
    state.rezim = state.rezim === "technician" ? "user" : "technician";
    try {
      sessionStorage.setItem(REZIM_KLIC, state.rezim);
    } catch {
      /* Soukromé okno. Režim vydrží jen do překreslení. */
    }
    state.editing = false;
    navigate("home");
  },
  startEditing() {
    state.editing = true;
    navigate("home");
  },
  stopEditing() {
    state.editing = false;
    bezpecne(draw());
  },
};

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export function mount(root) {
  el = {
    notice: root.getElementById("notice"),
    view: root.getElementById("view"),
    title: root.getElementById("view-title"),
    nav: root.getElementById("nav"),
    version: root.getElementById("app-version"),
    settings: root.getElementById("settings-button"),
  };

  // Kdyby některý prvek chyběl, nesmí to shodit celý start. Radši ať
  // chybí jeden popisek než aby zůstala prázdná obrazovka.
  if (el.version) el.version.textContent = APP_VERSION;
  if (el.settings) {
    el.settings.textContent = t.nav.settings;
    el.settings.addEventListener("click", () => navigate("settings"));
  }

  state.route = readRoute();
  paintNav();
  if (el.title) el.title.textContent = ROUTES[state.route].label;

  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);

  loadModel();
}

/** Změny stavů, které přišly z připojení Home Assistantu přes panel.
 *
 * Chodí sem cokoliv, co se v domě hne. Jedna divná entita nesmí zastavit
 * překreslování všech ostatních.
 */
export function applyIncoming(entities) {
  try {
    applyStates(entities || []);
  } catch (error) {
    console.warn("[Smarthome4u] Změnu stavu se nepodařilo promítnout:", error);
  }
}

/** Co si správce přepnul v tomhle sezení. Jinak technický režim. */
function zapamatovanyRezim() {
  try {
    const ulozeny = sessionStorage.getItem(REZIM_KLIC);
    if (ulozeny === "user" || ulozeny === "technician") return ulozeny;
  } catch {
    /* Soukromé okno. */
  }
  return "technician";
}

/* ------------------------------------------------------------------ */
/* Navigace                                                            */
/* ------------------------------------------------------------------ */

function readRoute() {
  const hash = (window.location.hash || "").replace(/^#\//, "");
  const route = ROUTES[hash];
  if (!route) return "home";
  if (route.technik && state.rezim !== "technician") return "home";
  return hash;
}

function onRouteChange() {
  const next = readRoute();
  if (next === state.route) return;
  state.route = next;
  closeDialog();
  bezpecne(draw());
}

/** Slib, který nikdo nečeká. Bez tohohle skončí chyba v konzoli a nikde jinde. */
function bezpecne(slib) {
  Promise.resolve(slib).catch((error) => {
    console.error("[Smarthome4u]", error);
  });
}

/** Přepínač Uživatel / Technik. Vidí ho jen správce. */
function paintRezim() {
  const jeSpravce = state.model?.user?.role === "admin";
  if (!el.settings) return;
  el.settings.hidden = !jeSpravce;

  const koren = el.settings.getRootNode?.();
  let tlacitko = koren?.getElementById?.("rezim-button");
  if (!jeSpravce) {
    tlacitko?.remove();
    return;
  }

  if (!tlacitko) {
    tlacitko = h("button", {
      class: "button button--ghost",
      type: "button",
      id: "rezim-button",
      onclick: () => ctx.prepnoutRezim(),
    });
    el.settings.parentElement?.insertBefore(tlacitko, el.settings);
  }

  tlacitko.textContent =
    state.rezim === "technician" ? t.mode.toUser : t.mode.toTechnician;
}

/** Úprava plochy. Patří do hlavičky, ne zahrabaná v nastavení. */
function paintUpravit() {
  if (!el.settings) return;

  const koren = el.settings.getRootNode?.();
  let tlacitko = koren?.getElementById?.("uprava-button");

  const jeSpravce = state.model?.user?.role === "admin";
  const jdeUpravit = state.route === "home" && jeSpravce;

  if (!jdeUpravit) {
    tlacitko?.remove();
    return;
  }

  if (!tlacitko) {
    tlacitko = h("button", {
      class: "button",
      type: "button",
      id: "uprava-button",
      onclick: () => (state.editing ? ctx.stopEditing() : ctx.startEditing()),
    });
    const prvni = koren?.getElementById?.("rezim-button") || el.settings;
    prvni.parentElement?.insertBefore(tlacitko, prvni);
  }

  tlacitko.textContent = state.editing ? t.editor.done : t.editor.edit;
  tlacitko.className = state.editing ? "button" : "button button--ghost";
}

function navigate(route) {
  if (!ROUTES[route]) route = "home";
  if (route !== "home") state.editing = false;
  closeDialog();
  state.route = route;

  try {
    const target = `${window.location.pathname}#/${route}`;
    window.history.replaceState(null, "", target);
  } catch {
    /* Někde je historie zamčená. Adresa se jen nezmění, sekce se otevře. */
  }

  bezpecne(draw());
}

function paintNav() {
  if (!el.nav) return;
  el.nav.replaceChildren();
  paintRezim();
  paintUpravit();

  for (const [key, route] of Object.entries(ROUTES)) {
    if (route.hidden) continue;
    if (route.technik && state.rezim !== "technician") continue;

    const active = key === state.route;
    el.nav.append(
      h(
        "button",
        {
          class: `nav__item${active ? " nav__item--active" : ""}`,
          type: "button",
          "aria-current": active ? "page" : null,
          onclick: () => navigate(key),
        },
        [icon(key), h("span", { class: "nav__label", text: route.label })],
      ),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Data a vykreslení                                                   */
/* ------------------------------------------------------------------ */

async function loadModel() {
  try {
    state.model = await api.model();

    // Režim se řídí přihlášeným účtem. Správce domácnosti nastavuje,
    // takže začíná v technickém režimu. Kdo není správce, technický
    // režim nevidí vůbec - a to ani když si ho někdo zkusil uložit.
    const jeSpravce = state.model.user?.role === "admin";
    state.rezim = jeSpravce ? zapamatovanyRezim() : "user";

    nastavitOblibene(
      (state.model.favorites || []).map((e) => e.id),
      jeSpravce,
      loadModel,
    );

    // Zvětšené ovládání pro starší uživatele a nástěnné panely.
    el.view
      ?.getRootNode?.()
      ?.querySelector?.(".shell")
      ?.classList.toggle("shell--velke", Boolean(state.model.bigControls));
    hideNotice();
    zrusitOpakovani();
    await draw();
  } catch (error) {
    showNotice(error.message || t.notice.offline, true);
    paintNav();
    naplanovatOpakovani();
  }
}

/* ------------------------------------------------------------------ */
/* Opakování po výpadku                                                */
/* ------------------------------------------------------------------ */

/* Home Assistant se po aktualizaci restartuje a je minutu nedostupný.
   Nutit uživatele, aby v tu chvíli ručně načítal stránku, je zbytečné -
   aplikace se zkusí vrátit sama. Odstup roste, ať to zbytečně neťuká. */
const ODSTUPY = [3000, 5000, 10000, 20000, 30000];
let pokus = 0;
let cekani = null;

function naplanovatOpakovani() {
  if (cekani) return;
  const za = ODSTUPY[Math.min(pokus, ODSTUPY.length - 1)];
  pokus += 1;
  cekani = setTimeout(() => {
    cekani = null;
    loadModel();
  }, za);
}

function zrusitOpakovani() {
  clearTimeout(cekani);
  cekani = null;
  pokus = 0;
}

async function draw() {
  if (!el?.view) return;

  const route = ROUTES[state.route] || ROUTES.home;

  try {
    clearWatchers();
  } catch (error) {
    console.warn("[Smarthome4u] Úklid předchozí obrazovky:", error);
  }

  el.view.replaceChildren();
  if (el.title) el.title.textContent = route.label;
  paintNav();

  if (!state.model) return;

  // Když se jedna sekce nevykreslí, zbytek aplikace musí zůstat ovladatelný.
  // Prázdná obrazovka bez vysvětlení je to nejhorší, co může nastat.
  try {
    await route.render(el.view, ctx);
  } catch (error) {
    console.error("[Smarthome4u] Sekce se nevykreslila:", error);
    el.view.replaceChildren(
      h("div", { class: "stack" }, [
        h("p", { class: "muted", text: t.error.view }),
        h("div", { class: "row" }, [
          h("button", {
            class: "button",
            type: "button",
            text: t.error.retry,
            onclick: () => loadModel(),
          }),
        ]),
      ]),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Stavové prvky                                                       */
/* ------------------------------------------------------------------ */

function showNotice(message, isError) {
  if (!el.notice) return;
  el.notice.textContent = message;
  el.notice.className = isError ? "notice notice--error" : "notice";
  el.notice.hidden = false;
}

function hideNotice() {
  if (el.notice) el.notice.hidden = true;
}
