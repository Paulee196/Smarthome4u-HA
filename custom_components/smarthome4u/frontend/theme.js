/* Motiv: světlý, tmavý, nebo podle Home Assistanta.
 *
 * Volba je na prohlížeč, ne na účet. Tablet na zdi má být tmavý, telefon
 * v ruce klidně světlý - stejně jako si to Home Assistant drží na každém
 * zařízení zvlášť.
 *
 *   auto   barvy Smarthome4u, světlé nebo tmavé podle Home Assistanta
 *   light  barvy Smarthome4u, vždy světlé
 *   dark   barvy Smarthome4u, vždy tmavé
 *   ha     barvy převzaté z motivu Home Assistanta
 */

const KLIC = "sh4u.theme";
export const VOLBY = ["auto", "light", "dark", "ha"];
export const UDALOST = "sh4u-theme-changed";

export function zvolenyMotiv() {
  try {
    const ulozeny = localStorage.getItem(KLIC);
    if (VOLBY.includes(ulozeny)) return ulozeny;
  } catch {
    /* Soukromé okno. */
  }
  return "auto";
}

export function nastavitMotiv(volba) {
  if (!VOLBY.includes(volba)) return;
  try {
    localStorage.setItem(KLIC, volba);
  } catch {
    /* Soukromé okno. Motiv vydrží jen do obnovení. */
  }
  window.dispatchEvent(new CustomEvent(UDALOST));
}

/**
 * Co se má doopravdy vykreslit.
 *
 * Home Assistant si drží, jestli běží ve tmě, na objektu hass.themes.
 * Když ho nemáme, rozhodne nastavení systému.
 */
export function ucinnyMotiv(hass) {
  const volba = zvolenyMotiv();
  if (volba !== "auto") return volba;

  const tma = hass?.themes?.darkMode;
  if (typeof tma === "boolean") return tma ? "dark" : "light";

  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
