/* Převzetí rozhraní - kiosk režim.
 *
 * Tenhle modul běží uvnitř frontendu Home Assistantu, ne v našem panelu.
 * Schová postranní lištu i horní pruh, když je otevřené Smarthome4u,
 * a po přihlášení otevře Smarthome4u místo výchozího dashboardu.
 *
 * Zapnutí a vypnutí se čte z našeho nastavení, aby se to dalo přepnout
 * přímo v aplikaci bez restartu Home Assistantu.
 *
 * Sahá do cizího DOM, který se může kdykoliv změnit. Proto je všechno
 * v try/catch a při jakékoliv nejistotě modul radši neudělá nic.
 * Nikdy nesmí rozbít Home Assistant.
 */

const PANEL = "smarthome4u";
const LANDED = "sh4u.landed";
const STYLE_ID = "sh4u-kiosk";

const CSS = `
  ha-sidebar { display: none !important; }
  .mdc-drawer, ha-drawer > .mdc-drawer { width: 0 !important; }
  :host { --mdc-drawer-width: 0px !important; --app-drawer-width: 0px !important; }
  [slot="appContent"], .content { margin-inline-start: 0 !important; }
  ha-menu-button, .header, app-header, app-toolbar { display: none !important; }
`;

let nastaveni = { kiosk: true, landing: true };

/* ------------------------------------------------------------------ */
/* Přístup do skořápky Home Assistantu                                 */
/* ------------------------------------------------------------------ */

function korenovyPrvek() {
  return document.querySelector("home-assistant") || null;
}

function koren() {
  return korenovyPrvek()?.shadowRoot || null;
}

function skorapka() {
  return koren()?.querySelector("home-assistant-main")?.shadowRoot || null;
}

function naPanelu() {
  return window.location.pathname.startsWith(`/${PANEL}`);
}

/* ------------------------------------------------------------------ */
/* Načtení nastavení                                                   */
/* ------------------------------------------------------------------ */

async function nacistNastaveni() {
  try {
    const hass = korenovyPrvek()?.hass;
    const token = hass?.auth?.data?.access_token;
    if (!token) return;

    const odpoved = await fetch("/api/smarthome4u/kiosk", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!odpoved.ok) return;

    const data = await odpoved.json();
    nastaveni = {
      kiosk: data.kiosk !== false,
      landing: data.landing !== false,
    };
  } catch {
    /* Nepodařilo se zeptat. Zůstanou výchozí hodnoty. */
  }
}

/* ------------------------------------------------------------------ */
/* Schování lišty                                                      */
/* ------------------------------------------------------------------ */

function zasuvka() {
  return skorapka()?.querySelector("ha-drawer") || null;
}

function uplatnit() {
  try {
    const host = skorapka();
    if (!host) return;

    const stavajici = host.getElementById?.(STYLE_ID);
    const zapnout = nastaveni.kiosk && naPanelu();

    if (zapnout && !stavajici) {
      const styl = document.createElement("style");
      styl.id = STYLE_ID;
      styl.textContent = CSS;
      host.appendChild(styl);
    } else if (!zapnout && stavajici) {
      stavajici.remove();
    }

    // Samotné schování lišty nestačí - zásuvka si drží šířku a obsah
    // zůstane odsunutý. Šířku má v proměnné na svém vlastním prvku, takže
    // se musí přepsat přímo tam. Zvenčí přes selektor to neprojde.
    const prvek = zasuvka();
    if (!prvek) return;

    if (zapnout) {
      prvek.style.setProperty("--mdc-drawer-width", "0px", "important");
      prvek.style.setProperty("--app-drawer-width", "0px", "important");
    } else {
      prvek.style.removeProperty("--mdc-drawer-width");
      prvek.style.removeProperty("--app-drawer-width");
    }
  } catch {
    /* Home Assistant změnil strukturu. Necháme lištu být. */
  }
}

/* ------------------------------------------------------------------ */
/* Přistání po přihlášení                                              */
/* ------------------------------------------------------------------ */

function pristani() {
  try {
    if (!nastaveni.landing) return;
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

function sledovat() {
  uplatnit();

  window.addEventListener("location-changed", uplatnit);
  window.addEventListener("popstate", uplatnit);

  // Home Assistant překresluje skořápku i bez změny adresy.
  const pozorovatel = new MutationObserver(uplatnit);
  const host = koren();
  if (host) pozorovatel.observe(host, { childList: true, subtree: false });

  // Změnu nastavení v aplikaci chceme poznat bez obnovení stránky.
  window.addEventListener("sh4u-kiosk-changed", async () => {
    await nacistNastaveni();
    uplatnit();
  });
}

async function start(pokus = 0) {
  if (skorapka()) {
    await nacistNastaveni();
    pristani();
    sledovat();
    return;
  }
  // Skořápka ještě není hotová. Zkusíme to chvíli, pak to vzdáme.
  if (pokus < 50) setTimeout(() => start(pokus + 1), 200);
}

start();
