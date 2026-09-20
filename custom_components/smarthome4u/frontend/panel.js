/* Panel Smarthome4u.
 *
 * Home Assistant vytvoří tenhle prvek a nastaví mu `hass`. Uvnitř si stavíme
 * vlastní stínový strom, takže se styly Home Assistantu a naše navzájem
 * neovlivňují.
 *
 * Realtime změny bereme z připojení, které Home Assistant už má otevřené.
 * Detaily o entitách si pak doptáváme našeho backendu - frontend si nikdy
 * nedomýšlí, co která entita umí.
 */

import { setAuth, api } from "./api.js";
import { setHost } from "./ui.js";
import { mount, applyIncoming } from "./app.js";

const BASE = "/smarthome4u-files";
const BATCH_MS = 200;

class Smarthome4uPanel extends HTMLElement {
  constructor() {
    super();
    this._ready = false;
    this._pending = new Set();
    this._timer = null;
    this._unsubscribe = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!hass) return;

    setAuth(hass.auth?.data?.access_token || hass.auth?.accessToken || null);

    if (!this._ready) {
      this._ready = true;
      this._build();
      this._subscribe();
    }
  }

  get hass() {
    return this._hass;
  }

  disconnectedCallback() {
    if (this._unsubscribe) {
      Promise.resolve(this._unsubscribe)
        .then((off) => typeof off === "function" && off())
        .catch(() => {});
      this._unsubscribe = null;
    }
    clearTimeout(this._timer);
  }

  /* ---------------------------------------------------------------- */

  _build() {
    const root = this.attachShadow({ mode: "open" });

    for (const file of ["tokens.css", "style.css"]) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${BASE}/${file}`;
      root.append(link);
    }

    const shell = document.createElement("div");
    shell.className = "shell";
    shell.innerHTML = `
      <nav class="nav" id="nav" aria-label="Hlavní navigace"></nav>
      <div class="main">
        <header class="header">
          <div class="header__left">
            <span class="header__brand">Smarthome<span>4u</span>
              <em id="app-version"></em></span>
            <h1 class="header__title" id="view-title">Domů</h1>
          </div>
          <div class="header__right">
            <div class="status status--online" id="status">
              <span class="status__dot" aria-hidden="true"></span>
              <span id="status-text" role="status">Připojeno</span>
            </div>
            <button class="button button--ghost" type="button"
              id="settings-button">Nastavení</button>
          </div>
        </header>
        <p class="notice" id="notice" hidden></p>
        <main class="view" id="view"></main>
      </div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    `;
    root.append(shell);

    setHost(root);
    mount(root);
  }

  /* ---------------------------------------------------------------- */

  _subscribe() {
    const connection = this._hass?.connection;
    if (!connection?.subscribeEvents) return;

    this._unsubscribe = connection.subscribeEvents((event) => {
      const entityId = event?.data?.entity_id;
      if (!entityId) return;

      this._pending.add(entityId);
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._flush(), BATCH_MS);
    }, "state_changed");
  }

  async _flush() {
    const ids = [...this._pending];
    this._pending.clear();
    if (!ids.length) return;

    try {
      const result = await api.entitiesBatch(ids.slice(0, 500));
      applyIncoming(result.entities);
    } catch {
      /* Krátký výpadek. Příští změna to dožene. */
    }
  }
}

if (!customElements.get("smarthome4u-panel")) {
  customElements.define("smarthome4u-panel", Smarthome4uPanel);
}
