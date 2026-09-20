/* Komunikace s vlastním backendem.
 *
 * Všechny cesty jsou relativní, protože aplikace běží pod Ingress prefixem.
 * Frontend nikdy nemluví přímo s Home Assistantem.
 */

function url(path) {
  return new URL(path, document.baseURI).toString();
}

async function request(method, path, payload) {
  const response = await fetch(url(path), {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
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

export const api = {
  model: () => request("GET", "api/model"),
  health: () => request("GET", "api/health"),
  section: (kind) => request("GET", `api/sections/${kind}`),
  devices: () => request("GET", "api/devices"),
  device: (id) => request("GET", `api/devices/${encodeURIComponent(id)}`),
  updateDevice: (id, body) =>
    request("POST", `api/devices/${encodeURIComponent(id)}`, body),
  updateEntity: (id, body) =>
    request("POST", `api/entities/${encodeURIComponent(id)}`, body),
  structure: () => request("GET", "api/structure"),
  createArea: (body) => request("POST", "api/structure/areas", body),
  updateArea: (id, body) =>
    request("POST", `api/structure/areas/${encodeURIComponent(id)}`, body),
  deleteArea: (id) =>
    request("POST", `api/structure/areas/${encodeURIComponent(id)}/delete`, {}),
  createFloor: (body) => request("POST", "api/structure/floors", body),
  updateFloor: (id, body) =>
    request("POST", `api/structure/floors/${encodeURIComponent(id)}`, body),
  deleteFloor: (id) =>
    request("POST", `api/structure/floors/${encodeURIComponent(id)}/delete`, {}),
  discovered: () => request("GET", "api/discovered"),
  templates: () => request("GET", "api/templates"),
  createAutomation: (body) => request("POST", "api/automations", body),
  deleteAutomation: (id) =>
    request("POST", `api/automations/${encodeURIComponent(id)}/delete`, {}),
  createScene: (body) => request("POST", "api/scenes", body),
  deleteScene: (id) =>
    request("POST", `api/scenes/${encodeURIComponent(id)}/delete`, {}),
  action: (entityId, action, value) =>
    request("POST", "api/action", { entityId, action, value }),
};

/** Otevře WebSocket pro realtime změny. Sám se znovu připojí. */
export function openStream({ onStates, onReload, onStatus }) {
  let delay = 1000;

  function connect() {
    const target = new URL("api/stream", document.baseURI);
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(target.toString());

    socket.addEventListener("open", () => {
      delay = 1000;
      onStatus(true);
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "reload") onReload();
      else if (message.type === "states") onStates(message.entities);
    });

    socket.addEventListener("close", () => {
      onStatus(false);
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30000);
    });
  }

  connect();
}
