/* Převzetí rozhraní - kiosk režim.
 *
 * Běží uvnitř frontendu Home Assistantu, ne v našem panelu.
 *
 * Schovat lištu nestačí. Zásuvka, ve které lišta sedí, si drží šířku a obsah
 * zůstane odsunutý. Šířka se počítá ze dvou proměnných a obě se musí
 * vynulovat - na skořápce i na samotné zásuvce. Navíc se musí sáhnout
 * i dovnitř zásuvky, protože odsazení obsahu je v jejím vlastním stínovém
 * stromu, kam zvenčí žádný selektor nedosáhne.
 *
 * Sahá do cizího DOM, který se může kdykoliv změnit. Proto je všechno
 * v try/catch a při jakékoliv nejistotě modul radši neudělá nic.
 * Nikdy nesmí rozbít Home Assistant.
 */

const PANEL = "smarthome4u";
const LANDED = "sh4u.landed";
const STYLE_ID = "sh4u-kiosk";
const STYLE_ZASUVKA_ID = "sh4u-kiosk-drawer";

/* Styl pro skořápku Home Assistantu. */
const CSS_SKORAPKA = `
  :host {
    --app-drawer-width: 0px !important;
    --mdc-drawer-width: 0px !important;
  }
  ha-drawer {
    --app-drawer-width: 0px !important;
    --mdc-drawer-width: 0px !important;
  }
  ha-sidebar { display: none !important; }
  ha-menu-button { display: none !important; }
`;

/* Styl dovnitř zásuvky. Odsazení obsahu je v jejím vlastním stínu. */
const CSS_ZASUVKA = `
  .mdc-drawer { display: none !important; width: 0 !important; }
  .mdc-drawer-app-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    margin-inline-start: 0 !important;
    margin-inline-end: 0 !important;
  }
`;

let nastaveni = { kiosk: true, landing: true };

/* Co je právě uplatněné. Bez toho by pozorovatel DOM točil dokola. */
let uplatneno = null;

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

function zasuvka() {
  const host = skorapka();
  return host?.querySelector("ha-drawer") || host?.getElementById?.("drawer") || null;
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
/* Vkládání a odebírání stylů                                          */
/* ------------------------------------------------------------------ */

function vlozit(kam, id, css) {
  if (!kam || kam.getElementById?.(id) || kam.querySelector?.(`#${id}`)) return;

  const styl = document.createElement("style");
  styl.id = id;
  styl.textContent = css;
  kam.appendChild(styl);
}

function odebrat(kde, id) {
  const styl = kde?.getElementById?.(id) || kde?.querySelector?.(`#${id}`);
  styl?.remove();
}

function uplatnit() {
  try {
    const host = skorapka();
    if (!host) return;

    const prvek = zasuvka();
    const zapnout = nastaveni.kiosk && naPanelu();

    // Zásuvka se objeví až po prvním vykreslení, proto se pokus opakuje,
    // dokud ji nenajdeme.
    if (uplatneno === zapnout && (prvek || !zapnout)) return;
    uplatneno = prvek || !zapnout ? zapnout : null;

    if (zapnout) {
      vlozit(host, STYLE_ID, CSS_SKORAPKA);

      if (prvek) {
        // Zásuvka si šířku drží na sobě, takže zvenčí ji přebije jen
        // hodnota zapsaná přímo na její prvek.
        prvek.style.setProperty("--mdc-drawer-width", "0px", "important");
        prvek.style.setProperty("--app-drawer-width", "0px", "important");
        vlozit(prvek.shadowRoot, STYLE_ZASUVKA_ID, CSS_ZASUVKA);
      }
    } else {
      odebrat(host, STYLE_ID);

      if (prvek) {
        prvek.style.removeProperty("--mdc-drawer-width");
        prvek.style.removeProperty("--app-drawer-width");
        odebrat(prvek.shadowRoot, STYLE_ZASUVKA_ID);
      }
    }

    // Home Assistant si šířku obsahu počítá při změně velikosti okna.
    window.dispatchEvent(new Event("resize"));
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

  // Home Assistant překresluje skořápku i bez změny adresy. Sleduje se
  // i vnitřek, protože zásuvka vzniká až po prvním vykreslení.
  const pozorovatel = new MutationObserver(uplatnit);
  const host = skorapka();
  if (host) pozorovatel.observe(host, { childList: true, subtree: true });

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
