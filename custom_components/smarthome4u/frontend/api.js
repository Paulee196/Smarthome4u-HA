/* Komunikace s vlastním backendem.
 *
 * Frontend nikdy nemluví přímo s Home Assistantem. Token dostáváme od panelu,
 * nikde se neukládá a nikam se neposílá dál.
 */

const BASE = "/api/smarthome4u/";

let token = null;

export function setAuth(value) {
  token = value;
}

async function request(method, path, payload) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload) headers["Content-Type"] = "application/json";

  const response = await fetch(BASE + path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.message || "Něco se nepovedlo.");
    error.code = data.error;
    throw error;
  }
  return data;
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
  settings: () => request("GET", "settings"),
  saveSettings: (body) => request("POST", "settings", body),
  system: () => request("GET", "system"),
  installUpdate: (id) => request("POST", `system/update/${enc(id)}`, {}),
  saveLayout: (body) => request("POST", "layout", body),
  classify: (id, body) => request("POST", `entities/${enc(id)}/classify`, body),
  toggleFavorite: (id) => request("POST", `favorites/${enc(id)}`, {}),

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
