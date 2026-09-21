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
import { ucinnyMotiv, UDALOST as MOTIV_ZMENEN } from "./theme.js";
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

    // Token se nebere teď, ale až v okamžiku odeslání - platí jen chvíli
    // a mezitím ho Home Assistant několikrát vymění.
    setAuth(
      () => {
        const auth = this._hass?.auth;
        return auth?.data?.access_token || auth?.accessToken || null;
      },
      async () => {
        await this._hass?.auth?.refreshAccessToken?.();
      },
    );

    if (this._ready) this._uplatnitMotiv();

    if (!this._ready) {
      this._ready = true;
      // Panel žije uvnitř Home Assistanta. Když se nám něco nepovede,
      // nesmí to vzít s sebou celou stránku.
      try {
        this._build();
      } catch (error) {
        console.error("[Smarthome4u] Rozhraní se nepodařilo postavit:", error);
      }
      try {
        this._subscribe();
      } catch (error) {
        console.warn("[Smarthome4u] Živé změny stavů nejedou:", error);
      }
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

    if (this._naZmenu) {
      window.removeEventListener("resize", this._naZmenu);
      this._naZmenu = null;
    }
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

    this._shell = shell;
    setHost(root);
    mount(root);

    this._uplatnitMotiv();
    window.addEventListener(MOTIV_ZMENEN, () => this._uplatnitMotiv());

    this._uplatnitKiosk();
    window.addEventListener("sh4u-kiosk-changed", () => this._uplatnitKiosk());

    // Zásuvka Home Assistantu se dosouvá se zpožděním. Než se dosune,
    // nemá smysl kontrolovat, jestli panel sedí.
    for (const za of [100, 400, 1200]) {
      setTimeout(() => this._zkontrolovat(), za);
    }

    this._naZmenu = () => this._zkontrolovat();
    window.addEventListener("resize", this._naZmenu);
  }

  /* ---------------------------------------------------------------- */

  /**
   * Motiv se nese atributem na hostiteli - na něj míří :host([data-theme])
   * v tokens.css. Třída na kostře je pojistka pro prohlížeče, které
   * :host s atributem v odkazovaném souboru neuplatní.
   */
  _uplatnitMotiv() {
    try {
      const motiv = ucinnyMotiv(this._hass);
      if (this.dataset.theme === motiv) return;

      this.dataset.theme = motiv;
      if (this._shell) {
        this._shell.classList.remove("shell--light", "shell--dark", "shell--ha");
        this._shell.classList.add("shell--" + motiv);
      }
    } catch (error) {
      console.warn("[Smarthome4u] Motiv:", error);
    }
  }

  /**
   * Kiosk režim: panel zabere celé okno.
   *
   * Dřív se to řešilo měřením a záporným okrajem. Panel pak trčel ven
   * ze své plochy a hostitel kolem něj vykreslil posuvníky. Tohle je
   * jednodušší: panel se z rozvržení Home Assistantu vytrhne úplně
   * a přilepí se na okno. Pak nezáleží na tom, jak široká je zásuvka.
   */
  async _uplatnitKiosk() {
    try {
      const nastaveni = await api.kiosk();
      this._kiosk = nastaveni.kiosk !== false;
    } catch {
      // Nepodařilo se zeptat. Kiosk je ve výchozím stavu zapnutý, ale
      // hádat se tu nebudeme - zůstane, co platilo.
      if (this._kiosk === undefined) return;
    }

    this.classList.toggle("sh4u-kiosk", this._kiosk);
    this._shell?.classList.toggle("shell--kiosk", this._kiosk);
    if (!this._kiosk) this._nouzoveSrovnani(false);

    this._zkontrolovat();
  }

  /**
   * Ověří, že panel opravdu drží celé okno.
   *
   * `position: fixed` selže, když má některý předek transform, filter
   * nebo contain - pak se počítá od něj, ne od okna. Je to vzácné, ale
   * pozná se to jedině změřením. Proto se neptáme, ale měříme.
   */
  _zkontrolovat() {
    try {
      if (!this._shell || !this._kiosk) return;

      const misto = this.getBoundingClientRect();
      const sedi = misto.left <= 2 && misto.width >= window.innerWidth - 2;

      if (sedi) {
        this._nouzoveSrovnani(false);
        return;
      }

      console.info(
        "[Smarthome4u] kiosk: panel začíná na",
        Math.round(misto.left),
        "px a je široký",
        Math.round(misto.width),
        "z",
        window.innerWidth,
        "- sahám po náhradním řešení",
      );
      this._nouzoveSrovnani(true, misto.left);
    } catch (error) {
      console.warn("[Smarthome4u] Kontrola kiosku:", error);
    }
  }

  /** Náhrada pro případ, že se panel na okno přilepit nedá. */
  _nouzoveSrovnani(zapnout, odsazeni = 0) {
    if (!zapnout) {
      this.style.marginInlineStart = "";
      this.style.width = "";
      return;
    }
    if (odsazeni > 2) {
      this.style.marginInlineStart = `${-odsazeni}px`;
      this.style.width = `${window.innerWidth}px`;
    }
  }

  _subscribe() {
    const connection = this._hass?.connection;
    if (!connection?.subscribeEvents) return;

    this._unsubscribe = connection.subscribeEvents((event) => {
      try {
        const entityId = event?.data?.entity_id;
        if (!entityId) return;

        this._pending.add(entityId);
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._flush(), BATCH_MS);
      } catch (error) {
        console.warn("[Smarthome4u] Změna stavu:", error);
      }
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
