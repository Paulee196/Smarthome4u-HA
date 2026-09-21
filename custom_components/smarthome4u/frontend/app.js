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
      localStorage.setItem(REZIM_KLIC, state.rezim);
    } catch {
      /* Soukromé okno. Režim se jen nezapamatuje. */
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
    draw();
  },
};

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export function mount(root) {
  el = {
    status: root.getElementById("status"),
    statusText: root.getElementById("status-text"),
    notice: root.getElementById("notice"),
    view: root.getElementById("view"),
    title: root.getElementById("view-title"),
    nav: root.getElementById("nav"),
    version: root.getElementById("app-version"),
    settings: root.getElementById("settings-button"),
  };

  el.version.textContent = APP_VERSION;
  el.settings.textContent = t.nav.settings;
  el.settings.addEventListener("click", () => navigate("settings"));

  try {
    if (localStorage.getItem(REZIM_KLIC) === "technician") {
      state.rezim = "technician";
    }
  } catch {
    /* Soukromé okno. Zůstane uživatelský režim. */
  }

  state.route = readRoute();
  paintNav();
  el.title.textContent = ROUTES[state.route].label;

  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);

  loadModel();
}

/** Změny stavů, které přišly z připojení Home Assistantu přes panel. */
export function applyIncoming(entities) {
  applyStates(entities || []);
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
  draw();
}

/** Přepínač Uživatel / Technik. Vidí ho jen správce. */
function paintRezim() {
  const jeSpravce = state.model?.user?.role === "admin";
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

function navigate(route) {
  if (!ROUTES[route]) route = "home";
  if (route !== "home") state.editing = false;
  closeDialog();
  state.route = route;

  const target = `${window.location.pathname}#/${route}`;
  window.history.replaceState(null, "", target);
  draw();
}

function paintNav() {
  el.nav.replaceChildren();
  paintRezim();

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

    // Kdo není správce, technický režim nikdy nevidí.
    const jeSpravce = state.model.user?.role === "admin";
    if (!jeSpravce) state.rezim = "user";

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
    setStatus(true);
    await draw();
  } catch (error) {
    setStatus(false);
    showNotice(error.message || t.notice.offline, true);
    paintNav();
  }
}

async function draw() {
  const route = ROUTES[state.route] || ROUTES.home;

  clearWatchers();
  el.view.replaceChildren();
  el.title.textContent = route.label;
  paintNav();

  if (!state.model) return;
  await route.render(el.view, ctx);
}

/* ------------------------------------------------------------------ */
/* Stavové prvky                                                       */
/* ------------------------------------------------------------------ */

function setStatus(online) {
  el.status.className = `status status--${online ? "online" : "offline"}`;
  el.statusText.textContent = online ? t.status.online : t.status.offline;
}

function showNotice(message, isError) {
  el.notice.textContent = message;
  el.notice.className = isError ? "notice notice--error" : "notice";
  el.notice.hidden = false;
}

function hideNotice() {
  el.notice.hidden = true;
}
