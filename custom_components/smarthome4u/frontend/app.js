/* Smarthome4u - kostra aplikace a přepínání sekcí.
 *
 * Panel nám předá svůj stínový strom. Frontend mluví výhradně s interním
 * Smarthome4u API.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";
import { applyStates, clearWatchers } from "./controls.js";
import { closeDialog, h } from "./ui.js";
import { APP_VERSION } from "./version.js";
import { renderHome } from "./view-home.js";
import { renderRooms } from "./view-rooms.js";
import { renderScenes } from "./view-scenes.js";
import { renderAutomations } from "./view-automations.js";
import { renderDevices } from "./view-devices.js";
import { renderSettings } from "./view-settings.js";

const ROUTES = {
  home: { label: t.nav.home, render: renderHome },
  rooms: { label: t.nav.rooms, render: renderRooms },
  scenes: { label: t.nav.scenes, render: renderScenes },
  automations: { label: t.nav.automations, render: renderAutomations },
  devices: { label: t.nav.devices, render: renderDevices },
  settings: { label: t.nav.settings, render: renderSettings, hidden: true },
};

const state = { model: null, route: "home" };
let el = null;

const ctx = {
  get model() {
    return state.model;
  },
  refresh: loadModel,
  navigate,
  allEntities: () => (state.model?.rooms || []).flatMap((room) => room.entities),
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
  return ROUTES[hash] ? hash : "home";
}

function onRouteChange() {
  const next = readRoute();
  if (next === state.route) return;
  state.route = next;
  closeDialog();
  draw();
}

function navigate(route) {
  if (!ROUTES[route]) route = "home";
  closeDialog();
  state.route = route;

  const target = `${window.location.pathname}#/${route}`;
  window.history.replaceState(null, "", target);
  draw();
}

function paintNav() {
  el.nav.replaceChildren();

  for (const [key, route] of Object.entries(ROUTES)) {
    if (route.hidden) continue;

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
