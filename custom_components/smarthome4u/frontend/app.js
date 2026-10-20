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
import { renderHome } from "./view-home.js";
import { renderRooms } from "./view-rooms.js";
import { renderActivities } from "./view-activities.js";
import { renderDevices, resetDevicesTab } from "./view-devices.js";
import { renderSettings } from "./view-settings.js";

/* Uživatel vidí jen to, co denně používá. Automatizace, zařízení
   a integrace patří technikovi - jinak z toho je nepřehledná hromada. */
const ROUTES = {
  home: { label: t.nav.home, render: renderHome },
  rooms: { label: t.nav.rooms, render: renderRooms },
  scenes: { label: t.nav.scenes, render: renderActivities },
  automations: {
    label: t.nav.scenes,
    render: (root, ctx) => renderActivities(root, ctx, "automations"),
    technik: true,
    hidden: true,
  },
  devices: { label: t.nav.devices, render: renderDevices, technik: true },
  // Nastavení vidí každý - kvůli volbě vzhledu. Co smí měnit jen
  // správce, si hlídá obrazovka sama.
  settings: {
    label: t.nav.settings,
    render: renderSettings,
  },
};

/* Režim se neukládá natrvalo. Vychází z toho, kdo je přihlášený:
   správce domácnosti začíná v technickém režimu, ostatní v uživatelském.
   Přepnutí platí do konce sezení, po dalším přihlášení se zase řídí účtem. */
const REZIM_KLIC = "sh4u.rezim.013";
const rezimKlic = () => `${REZIM_KLIC}.${state.model?.user?.id || "anonymous"}`;

const state = { model: null, route: "home", editing: false, rezim: "user" };
let el = null;
let structureRefresh = null;
let initialModelLoad = true;
let cachedForecast = null;
let forecastRequest = null;

const ctx = {
  get model() {
    return state.model;
  },
  refresh: loadModel,
  navigate,
  allEntities: () => (state.model?.rooms || []).flatMap((room) => room.entities),

  entityRef: (entity) => entity?.ref || entity?.id,

  /* Bloky a další uložené rozvržení drží stabilní ref. Aktuální entity_id
     se dohledá v modelu až při vykreslení a ovládání. */
  entityByRef: (ref) =>
    [
      ...(state.model?.rooms || []).flatMap((room) => room.entities || []),
      ...(state.model?.scenes || []),
      ...(state.model?.attention || []),
      ...(state.model?.summary?.alerts || []),
      ...(state.model?.nowPlaying || []),
    ]
      .find((entity) => entity.ref === ref || entity.id === ref) || null,

  get editing() {
    return state.editing;
  },

  get rezim() {
    return state.rezim;
  },
  get jeTechnik() {
    return state.rezim === "technician";
  },
  get muzeUpravitPlochu() {
    return Boolean(state.model?.canEditDashboard);
  },
  get muzeUpravitPlanek() {
    return state.model?.user?.role === "admin";
  },
  prepnoutRezim() {
    state.rezim = state.rezim === "technician" ? "user" : "technician";
    try {
      sessionStorage.setItem(rezimKlic(), state.rezim);
    } catch {
      /* Soukromé okno. Režim vydrží jen do překreslení. */
    }
    state.editing = false;
    // Přepíná se z nastavení, tak v něm člověk zůstane.
    bezpecne(draw());
  },
  startEditing() {
    if (!state.model?.canEditDashboard) return;
    state.editing = true;
    navigate("home");
  },
  stopEditing() {
    state.editing = false;
    bezpecne(loadModel());
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
    picker: root.getElementById("dashboard-picker"),
    weather: root.getElementById("header-weather"),
    edit: root.getElementById("uprava-button"),
  };

  // Kdyby některý prvek chyběl, nesmí to shodit celý start. Radši ať
  // chybí jeden popisek než aby zůstala prázdná obrazovka.
  if (el.picker) el.picker.addEventListener("change", () => {
    bezpecne(selectDashboard(el.picker.value));
  });
  if (el.edit) {
    el.edit.addEventListener("click", () => state.editing
      ? ctx.stopEditing() : ctx.startEditing());
  }

  state.route = readRoute();
  paintNav();
  if (el.title) el.title.textContent = ROUTES[state.route].label;

  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);
  window.addEventListener("sh4u-layout-changed", (event) => {
    if (state.editing || state.route !== "home" || !state.model) return;
    if (event.detail?.preset && event.detail.preset !== state.model.preset) return;
    if (event.detail?.user_id && event.detail.user_id !== state.model.user?.id) return;
    bezpecne(loadModel());
  });
  window.addEventListener("sh4u-structure-changed", () => {
    clearTimeout(structureRefresh);
    structureRefresh = setTimeout(() => bezpecne(loadModel()), 1200);
  });

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
    const ulozeny = sessionStorage.getItem(rezimKlic());
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
  if (next === "devices") resetDevicesTab();
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

/** Úprava plochy. Patří do hlavičky, ne zahrabaná v nastavení. */
function paintUpravit() {
  if (!el.edit) return;
  el.edit.hidden = state.route !== "home" || !state.model?.canEditDashboard;
  const label = state.editing ? t.editor.done : t.editor.edit;
  el.edit.replaceChildren(icon(state.editing ? "check" : "edit"));
  el.edit.title = label;
  el.edit.setAttribute("aria-label", label);
  el.edit.className = state.editing ? "button header__edit" :
    "button button--ghost header__edit";
}

function navigate(route) {
  if (!ROUTES[route]) route = "home";
  if (route === "devices") resetDevicesTab();
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

async function selectDashboard(id) {
  if (!state.model?.dashboards?.some((board) => board.id === id)) return;
  try {
    if (id !== state.model.preset) await api.setPreset(id);
    state.editing = false;
    state.route = "home";
    window.history.replaceState(null, "", `${window.location.pathname}#/home`);
    await loadModel();
  } catch (error) {
    showNotice(error.message || t.notice.offline, true);
  }
}

function paintNav() {
  if (!el.nav) return;
  el.nav.replaceChildren();
  paintUpravit();

  for (const [key, route] of Object.entries(ROUTES)) {
    if (route.technik && state.rezim !== "technician") continue;
    if (route.hidden) continue;

    const active = key === state.route ||
      (key === "scenes" && state.route === "automations");
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
    if (key === "home") {
      const dashboards = state.model?.dashboards || [];
      if (dashboards.length) {
        el.nav.append(h("div", { class: "nav__dashboard-list" }, dashboards.map((board) =>
          h("button", {
            class: "nav__dashboard" + (state.route === "home" &&
              state.model?.preset === board.id ? " nav__dashboard--active" : ""),
            type: "button", text: board.name,
            "aria-current": state.route === "home" && state.model?.preset === board.id
              ? "page" : null,
            onclick: () => bezpecne(selectDashboard(board.id)),
          }))));
      }
    }
  }
  if (el.picker) {
    const dashboards = state.model?.dashboards || [];
    el.picker.replaceChildren(...dashboards.map((board) =>
      h("option", { value: board.id, text: board.name })));
    el.picker.value = state.model?.preset || "";
    el.picker.hidden = state.route !== "home" || dashboards.length < 2;
  }
}

/* ------------------------------------------------------------------ */
/* Data a vykreslení                                                   */
/* ------------------------------------------------------------------ */

async function loadModel() {
  try {
    state.model = await api.model(initialModelLoad);
    initialModelLoad = false;

    // Režim se řídí přihlášeným účtem. Správce domácnosti nastavuje,
    // takže začíná v technickém režimu. Kdo není správce, technický
    // režim nevidí vůbec - a to ani když si ho někdo zkusil uložit.
    const jeTechnik = ["admin", "technician"].includes(state.model.user?.role);
    state.rezim = jeTechnik ? zapamatovanyRezim() : "user";

    nastavitOblibene(
      (state.model.favorites || []).map((e) => e.ref || e.id),
      true,
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
  if (el.title) el.title.textContent = state.route === "home"
    ? state.model?.dashboards?.find((board) => board.id === state.model.preset)?.name
      || route.label : route.label;
  paintWeather();
  updateForecast();
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

function paintWeather() {
  if (!el.weather) return;
  const weather = state.model?.weather;
  el.weather.hidden = !weather;
  if (!weather) return;
  const condition = t.weather.conditions[weather.condition] || weather.condition;
  const current = [condition, weather.temperature == null ? ""
    : `${weather.temperature} ${weather.unit || "°C"}`].filter(Boolean).join(" · ");
  const nextCondition = t.weather.conditions[weather.nextCondition] || weather.nextCondition;
  const next = weather.nextTemperature == null ? nextCondition :
    [nextCondition, `${weather.nextTemperature} ${weather.unit || "°C"}`]
      .filter(Boolean).join(" · ");
  el.weather.replaceChildren(
    h("strong", { text: weather.location || t.weather.title }),
    h("span", { text: current }),
    ...(next ? [h("small", { text: `${t.weather.forecast}: ${next}` })] : []),
  );
}

function updateForecast() {
  const entityId = state.model?.weather?.entityId;
  if (!entityId) return;
  if (cachedForecast?.id === entityId && cachedForecast.expires > Date.now()) {
    state.model.weather = { ...state.model.weather, ...cachedForecast.data };
    paintWeather();
    return;
  }
  if (forecastRequest) return;
  forecastRequest = api.weather().then((weather) => {
    if (!weather?.entityId) return;
    const data = { nextCondition: weather.nextCondition,
      nextTemperature: weather.nextTemperature };
    cachedForecast = { id: weather.entityId, data, expires: Date.now() + 30 * 60 * 1000 };
    if (state.model?.weather?.entityId === weather.entityId) {
      state.model.weather = { ...state.model.weather, ...data };
      paintWeather();
    }
  }).catch(() => {}).finally(() => { forecastRequest = null; });
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
