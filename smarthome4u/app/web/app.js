/* Smarthome4u - kostra aplikace a přepínání sekcí.
 *
 * Frontend mluví výhradně s interním Smarthome4u API a nikdy nevidí
 * Supervisor token. Všechny cesty jsou relativní kvůli Ingress prefixu.
 */

import { api, openStream } from "./api.js";
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

const el = {
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  notice: document.getElementById("notice"),
  view: document.getElementById("view"),
  title: document.getElementById("view-title"),
  nav: document.getElementById("nav"),
  version: document.getElementById("app-version"),
  settings: document.getElementById("settings-button"),
};

const state = { model: null, route: "home" };

const ctx = {
  get model() {
    return state.model;
  },
  refresh: loadModel,
  navigate,
  allEntities: () => (state.model?.rooms || []).flatMap((room) => room.entities),
};

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function loadModel() {
  try {
    state.model = await api.model();
    setStatus(state.model.connected);
    updateNotice();
    await draw();
  } catch {
    setStatus(false);
    showNotice(t.notice.offline, true);
    // Navigace musí zůstat i když se data nenačtou. Jinak uživatel
    // kouká na prázdnou stránku a nemá kam klepnout.
    paintNav();
  }
}

function updateNotice() {
  if (!state.model) return;
  if (!state.model.loaded) showNotice(t.notice.connecting, false);
  else if (!state.model.connected) showNotice(t.notice.offline, true);
  else hideNotice();
}

/* ------------------------------------------------------------------ */
/* Vykreslení                                                          */
/* ------------------------------------------------------------------ */

async function draw() {
  const route = ROUTES[state.route] || ROUTES.home;

  clearWatchers();
  el.view.replaceChildren();
  el.title.textContent = route.label;
  document.title = `${route.label} · ${t.appName}`;
  paintNav();

  if (!state.model) return;
  await route.render(el.view, ctx);
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

function navigate(route) {
  if (!ROUTES[route]) route = "home";
  closeDialog();
  state.route = route;
  if (location.hash !== `#/${route}`) location.hash = `#/${route}`;
  else draw();
}

window.addEventListener("hashchange", () => {
  const route = location.hash.replace(/^#\//, "") || "home";
  state.route = ROUTES[route] ? route : "home";
  closeDialog();
  draw();
});

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

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

el.version.textContent = APP_VERSION;
el.settings.textContent = t.nav.settings;
el.settings.addEventListener("click", () => navigate("settings"));
el.statusText.textContent = t.status.connecting;

state.route = location.hash.replace(/^#\//, "") || "home";
if (!ROUTES[state.route]) state.route = "home";

// Navigace se vykreslí hned, ještě než dorazí data.
paintNav();
el.title.textContent = ROUTES[state.route].label;

loadModel();

openStream({
  onStates: applyStates,
  onReload: loadModel,
  onStatus: (online) => {
    setStatus(online);
    if (online) loadModel();
  },
});
