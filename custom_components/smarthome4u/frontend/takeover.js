/* Převzetí rozhraní.
 *
 * Tenhle modul běží uvnitř frontendu Home Assistantu, ne v našem panelu.
 * Dělá dvě věci: schová postranní lištu, když je otevřené Smarthome4u,
 * a po přihlášení otevře Smarthome4u místo výchozího dashboardu.
 *
 * Sahá do cizího DOM, který se může kdykoliv změnit. Proto je všechno
 * v try/catch a při jakékoliv nejistotě modul radši neudělá nic.
 * Nikdy nesmí rozbít Home Assistant.
 */

const PANEL = "smarthome4u";
const LANDED = "sh4u.landed";
const STYLE_ID = "sh4u-hide-sidebar";

const CSS = `
  ha-sidebar { display: none !important; }
  .mdc-drawer, ha-drawer > .mdc-drawer { width: 0 !important; }
  :host { --mdc-drawer-width: 0px !important; --app-drawer-width: 0px !important; }
  [slot="appContent"], .content { margin-inline-start: 0 !important; }
`;

function root() {
  return document.querySelector("home-assistant")?.shadowRoot || null;
}

function main() {
  return root()?.querySelector("home-assistant-main")?.shadowRoot || null;
}

function onPanel() {
  return window.location.pathname.startsWith(`/${PANEL}`);
}

/* ------------------------------------------------------------------ */
/* Schování lišty                                                      */
/* ------------------------------------------------------------------ */

function apply() {
  try {
    const host = main();
    if (!host) return;

    const existing = host.getElementById?.(STYLE_ID);

    if (onPanel()) {
      if (existing) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      host.appendChild(style);
    } else if (existing) {
      existing.remove();
    }
  } catch {
    /* Home Assistant změnil strukturu. Necháme lištu být. */
  }
}

/* ------------------------------------------------------------------ */
/* Přistání po přihlášení                                              */
/* ------------------------------------------------------------------ */

function land() {
  try {
    if (sessionStorage.getItem(LANDED)) return;

    // Jen z kořene. Když uživatel míří jinam, nepřesměrováváme ho.
    if (window.location.pathname !== "/") return;

    sessionStorage.setItem(LANDED, "1");
    window.history.replaceState(null, "", `/${PANEL}`);
    window.dispatchEvent(new CustomEvent("location-changed"));
  } catch {
    /* Bez session storage se jen nepřistane. Nic se nerozbije. */
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function watch() {
  apply();

  window.addEventListener("location-changed", apply);
  window.addEventListener("popstate", apply);

  // Home Assistant překresluje skořápku i bez změny adresy.
  const observer = new MutationObserver(apply);
  const host = root();
  if (host) observer.observe(host, { childList: true, subtree: false });
}

function boot(attempt = 0) {
  if (main()) {
    land();
    watch();
    return;
  }
  // Skořápka ještě není hotová. Zkusíme to chvíli, pak to vzdáme.
  if (attempt < 50) setTimeout(() => boot(attempt + 1), 200);
}

boot();
