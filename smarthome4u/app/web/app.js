/* Smarthome4u - frontend.
 *
 * Mluví výhradně s interním Smarthome4u API. Nikdy přímo s Home Assistantem
 * a nikdy nevidí Supervisor token.
 *
 * Všechny cesty jsou relativní, protože aplikace běží pod Ingress prefixem.
 */

import { cs as t, describeState } from "./i18n.js";

const el = {
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  notice: document.getElementById("notice"),
  rooms: document.getElementById("rooms"),
  version: document.getElementById("version"),
};

/** entity_id -> prvek dlaždice, aby šlo překreslit jen to, co se změnilo. */
const tiles = new Map();

let reconnectDelay = 1000;

// --------------------------------------------------------------------
// Komunikace
// --------------------------------------------------------------------

function url(path) {
  return new URL(path, document.baseURI).toString();
}

async function loadModel() {
  try {
    const response = await fetch(url("api/model"));
    if (!response.ok) throw new Error(String(response.status));
    render(await response.json());
  } catch {
    setStatus("offline");
    showNotice(t.notice.offline, true);
  }
}

function connectStream() {
  const target = new URL("api/stream", document.baseURI);
  target.protocol = target.protocol === "https:" ? "wss:" : "ws:";

  const socket = new WebSocket(target.toString());

  socket.addEventListener("open", () => {
    reconnectDelay = 1000;
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "reload") {
      loadModel();
    } else if (message.type === "states") {
      message.entities.forEach(updateTile);
    }
  });

  socket.addEventListener("close", () => {
    setStatus("offline");
    setTimeout(connectStream, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });
}

async function sendAction(entityId, action) {
  const response = await fetch(url("api/action"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, action }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || t.notice.actionFailed);
  }
}

// --------------------------------------------------------------------
// Vykreslení
// --------------------------------------------------------------------

function render(model) {
  setStatus(model.connected ? "online" : "offline");
  el.version.textContent = model.haVersion
    ? `${t.footer.version} ${model.haVersion}`
    : "";

  if (!model.loaded) {
    showNotice(t.notice.connecting, false);
    return;
  }

  if (!model.connected) {
    showNotice(t.notice.offline, true);
  } else {
    hideNotice();
  }

  tiles.clear();
  el.rooms.replaceChildren();

  if (model.rooms.length === 0) {
    el.rooms.append(buildEmpty());
    return;
  }

  model.rooms.forEach((room) => el.rooms.append(buildRoom(room)));
}

function buildRoom(room) {
  const section = document.createElement("section");
  section.className = "room";

  const head = document.createElement("div");
  head.className = "room__head";

  const name = document.createElement("h2");
  name.className = "room__name";
  name.textContent = room.name || t.room.unassigned;
  head.append(name);

  if (room.floorName) {
    const floor = document.createElement("span");
    floor.className = "room__floor";
    floor.textContent = room.floorName;
    head.append(floor);
  }

  const items = document.createElement("div");
  items.className = "room__items";
  room.entities.forEach((entity) => {
    const tile = buildTile(entity);
    tiles.set(entity.id, tile);
    items.append(tile);
  });

  section.append(head, items);
  return section;
}

function buildTile(entity) {
  const controllable = entity.capability?.controllable === true;
  const tile = document.createElement(controllable ? "button" : "div");
  tile.className = "tile";

  if (controllable) {
    tile.type = "button";
    tile.addEventListener("click", () => toggle(entity.id, tile));
  }

  const mark = document.createElement("span");
  mark.className = "tile__mark";

  const body = document.createElement("span");
  body.className = "tile__body";

  const name = document.createElement("span");
  name.className = "tile__name";
  name.textContent = entity.name;

  const state = document.createElement("span");
  state.className = "tile__state";

  body.append(name, state);
  tile.append(mark, body);

  paint(tile, entity);
  return tile;
}

function paint(tile, entity) {
  const { text, tone } = describeState(entity, t);

  const state = tile.querySelector(".tile__state");
  state.textContent = text;
  state.className = `tile__state tile__state--${tone}`;

  const mark = tile.querySelector(".tile__mark");
  mark.className = `tile__mark${tone === "on" || tone === "alert" ? ` tile__mark--${tone}` : ""}`;

  if (tile.tagName === "BUTTON") {
    tile.setAttribute("aria-pressed", String(entity.state === "on"));
    tile.disabled = !entity.available;
  }
}

function updateTile(entity) {
  const tile = tiles.get(entity.id);
  if (tile) paint(tile, entity);
}

function buildEmpty() {
  const box = document.createElement("div");
  box.className = "empty";

  const title = document.createElement("h2");
  title.textContent = t.empty.title;

  const text = document.createElement("p");
  text.textContent = t.empty.text;

  box.append(title, text);
  return box;
}

// --------------------------------------------------------------------
// Akce
// --------------------------------------------------------------------

async function toggle(entityId, tile) {
  tile.classList.add("tile--busy");
  try {
    await sendAction(entityId, "toggle");
    hideNotice();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    tile.classList.remove("tile--busy");
  }
}

// --------------------------------------------------------------------
// Stavové prvky
// --------------------------------------------------------------------

function setStatus(kind) {
  el.status.className = `status status--${kind}`;
  el.statusText.textContent =
    kind === "online" ? t.status.online : t.status.offline;
}

function showNotice(message, isError) {
  el.notice.textContent = message;
  el.notice.className = isError ? "notice notice--error" : "notice";
  el.notice.hidden = false;
}

function hideNotice() {
  el.notice.hidden = true;
}

// --------------------------------------------------------------------
// Start
// --------------------------------------------------------------------

document.title = t.appName;
setStatus("offline");
el.statusText.textContent = t.status.connecting;
loadModel();
connectStream();
