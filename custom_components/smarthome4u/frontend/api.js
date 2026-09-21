/* Komunikace s vlastním backendem.
 *
 * "Backend" je Home Assistant ve vašem domě, nic venku. Aplikace běží
 * v prohlížeči, Home Assistant běží na krabičce. Tahle dvě místa spolu
 * musí mluvit, a tohle je ta linka.
 *
 * Token dostáváme od panelu. Nikde se neukládá a nikam se neposílá dál.
 * Platí jen omezenou dobu, proto se bere vždy čerstvý těsně před odesláním
 * a při odmítnutí se jednou obnoví.
 */

import { t } from "./i18n.js";

const BASE = "/api/smarthome4u/";

let ziskatToken = () => null;
let obnovitToken = null;

/**
 * Nastaví zdroj přihlašovacího tokenu.
 *
 * @param {(() => string|null)|string|null} zdroj funkce nebo rovnou token
 * @param {(() => Promise<void>)|null} obnova zavolá se, když token vyprší
 */
export function setAuth(zdroj, obnova) {
  ziskatToken = typeof zdroj === "function" ? zdroj : () => zdroj;
  obnovitToken = typeof obnova === "function" ? obnova : null;
}

/** Chyba, která umí říct, co se stalo, aniž by to znělo jako výpis z konzole. */
class ApiError extends Error {
  constructor(zprava, stav, kod) {
    super(zprava);
    this.status = stav;
    this.code = kod;
  }
}

async function poslat(method, path, payload) {
  const headers = {};
  const token = ziskatToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload) headers["Content-Type"] = "application/json";

  return fetch(BASE + path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
    // Kdyby token chyběl, vezme Home Assistant aspoň přihlášení z prohlížeče.
    credentials: "same-origin",
    // Odpověď nikdy z mezipaměti. Stav domu musí být čerstvý.
    cache: "no-store",
  });
}

async function request(method, path, payload) {
  let response;
  try {
    response = await poslat(method, path, payload);
  } catch {
    // Sem se dostaneme, když Home Assistant neodpovídá vůbec - typicky
    // při restartu nebo při výpadku sítě.
    throw new ApiError(t.error.network, 0);
  }

  // Vypršelé přihlášení jde spravit potichu: obnovit token a zkusit znovu.
  if (response.status === 401 && obnovitToken) {
    try {
      await obnovitToken();
      response = await poslat(method, path, payload);
    } catch {
      /* Když ani obnova nepomůže, spadne to o kus níž se srozumitelnou hláškou. */
    }
  }

  const text = await response.text();
  const data = rozebrat(text);

  if (!response.ok) {
    throw new ApiError(
      data?.message || popisStavu(response.status),
      response.status,
      data?.error,
    );
  }

  if (data === null) {
    // Odpověď přišla, ale není to naše data. Nejčastěji když mezi prohlížeč
    // a Home Assistant vleze proxy nebo přihlašovací stránka.
    console.warn("[Smarthome4u] Neočekávaná odpověď:", text.slice(0, 200));
    throw new ApiError(t.error.badResponse, response.status);
  }

  return data;
}

/** Vrátí data, nebo null. Nikdy nespadne - rozbitá odpověď není výjimka. */
function rozebrat(text) {
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** Kódy stavů přeložené do řeči, které zákazník rozumí. */
function popisStavu(stav) {
  if (stav === 401) return t.error.session;
  if (stav === 403) return t.error.forbidden;
  if (stav === 404) return t.error.missing;
  if (stav >= 500) return t.error.server;
  return t.error.generic;
}

const enc = encodeURIComponent;

export const api = {
  model: () => request("GET", "model"),
  section: (kind) => request("GET", `sections/${enc(kind)}`),
  entitiesBatch: (ids) => request("POST", "entities/batch", { ids }),

  devices: () => request("GET", "devices"),
  device: (id) => request("GET", `devices/${enc(id)}`),
  updateDevice: (id, body) => request("POST", `devices/${enc(id)}`, body),
  updateEntity: (id, body) => request("POST", `entities/${enc(id)}`, body),

  structure: () => request("GET", "structure"),
  createArea: (body) => request("POST", "structure/areas", body),
  updateArea: (id, body) => request("POST", `structure/areas/${enc(id)}`, body),
  deleteArea: (id) => request("POST", `structure/areas/${enc(id)}/delete`, {}),
  createFloor: (body) => request("POST", "structure/floors", body),
  updateFloor: (id, body) => request("POST", `structure/floors/${enc(id)}`, body),
  deleteFloor: (id) => request("POST", `structure/floors/${enc(id)}/delete`, {}),

  integrations: () => request("GET", "integrations"),
  availableIntegrations: () => request("GET", "integrations/available"),
  flowStart: (handler) => request("POST", "integrations/flow", { handler }),
  flowRead: (id) => request("GET", `integrations/flow/${enc(id)}`),
  flowSubmit: (id, data) => request("POST", `integrations/flow/${enc(id)}`, { data }),
  flowAbort: (id) => request("POST", `integrations/flow/${enc(id)}/abort`, {}),
  deleteIntegration: (id) => request("POST", `integrations/${enc(id)}/delete`, {}),

  kiosk: () => request("GET", "kiosk"),
  floorplan: () => request("GET", "floorplan"),
  saveFloorplan: (body) => request("POST", "floorplan", body),
  uploadFloorplan: (data) => request("POST", "floorplan/image", { data }),
  settings: () => request("GET", "settings"),
  saveSettings: (body) => request("POST", "settings", body),
  system: () => request("GET", "system"),
  installUpdate: (id) => request("POST", `system/update/${enc(id)}`, {}),
  saveLayout: (body) => request("POST", "layout", body),
  classify: (id, body) => request("POST", `entities/${enc(id)}/classify`, body),
  toggleFavorite: (id) => request("POST", `favorites/${enc(id)}`, {}),
  saveFavorites: (entities) => request("POST", "favorites", { entities }),
  saveDashboard: (preset, blocks) =>
    request("POST", "dashboard", { preset, blocks }),

  templates: () => request("GET", "templates"),
  createAutomation: (body) => request("POST", "automations", body),
  buildAutomation: (model) => request("POST", "automations/build", { model }),
  automationModel: (id) =>
    request("GET", `automations/${enc(id)}/model`),
  deleteAutomation: (id) => request("POST", `automations/${enc(id)}/delete`, {}),
  createScene: (body) => request("POST", "scenes", body),
  deleteScene: (id) => request("POST", `scenes/${enc(id)}/delete`, {}),

  action: (entityId, action, value) =>
    request("POST", "action", { entityId, action, value }),
};
