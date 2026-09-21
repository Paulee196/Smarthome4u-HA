/* Přetahování pro úpravu rozvržení.
 *
 * Postavené na Pointer Events, ne na HTML5 drag and drop. Ten na dotykových
 * zařízeních nefunguje a Smarthome4u musí jít upravit i na tabletu.
 *
 * Princip: po chvíli držení se prvek zvedne, ostatní se před ním rozestoupí
 * a po puštění se uloží nové pořadí.
 */

// Jak dlouho se musí držet, než se přetahování spustí. Kratší doba by
// brala klepnutí, delší by působila zaseknutě.
const DRZENI_MS = 220;

// O kolik se smí prst pohnout, než se držení zruší jako posouvání stránky.
const TOLERANCE_PX = 10;

/**
 * Zapne přetahování v kontejneru.
 *
 * @param {HTMLElement} kontejner prvek, jehož přímé děti se řadí
 * @param {(poradi: string[]) => void} onZmena dostane nové pořadí klíčů
 * @returns {() => void} funkce, která přetahování vypne
 */
export function povolitPretahovani(kontejner, onZmena) {
  let tazeny = null;
  let zastupce = null;
  let casovac = null;
  let start = null;
  let posunY = 0;
  let posunX = 0;

  function klic(prvek) {
    return prvek?.dataset?.dndKey || null;
  }

  function poradi() {
    return [...kontejner.children]
      .map(klic)
      .filter((hodnota) => hodnota !== null);
  }

  function zrusit() {
    clearTimeout(casovac);
    casovac = null;

    if (tazeny) {
      tazeny.classList.remove("dnd--taheny");
      tazeny.style.transform = "";
      tazeny = null;
    }
    if (zastupce) {
      zastupce.remove();
      zastupce = null;
    }
    kontejner.classList.remove("dnd--aktivni");
    start = null;
  }

  function zvednout(prvek, udalost) {
    tazeny = prvek;
    kontejner.classList.add("dnd--aktivni");
    prvek.classList.add("dnd--taheny");

    // Zástupce drží místo, aby se mřížka nepřeskládala pod rukou.
    zastupce = document.createElement("div");
    zastupce.className = "dnd__zastupce";
    zastupce.style.height = `${prvek.offsetHeight}px`;

    posunX = udalost.clientX;
    posunY = udalost.clientY;

    if (navigator.vibrate) navigator.vibrate(10);
  }

  function presunout(udalost) {
    if (!tazeny) return;

    const dx = udalost.clientX - posunX;
    const dy = udalost.clientY - posunY;
    tazeny.style.transform = `translate(${dx}px, ${dy}px)`;

    // Který sourozenec je právě pod prstem.
    const pod = document
      .elementFromPoint(udalost.clientX, udalost.clientY)
      ?.closest("[data-dnd-key]");

    if (!pod || pod === tazeny || pod.parentElement !== kontejner) return;

    const deti = [...kontejner.children];
    const kamIndex = deti.indexOf(pod);
    const odkudIndex = deti.indexOf(tazeny);

    if (kamIndex === odkudIndex) return;

    // Vložíme před nebo za podle směru pohybu.
    if (kamIndex > odkudIndex) {
      pod.after(tazeny);
    } else {
      pod.before(tazeny);
    }

    // Posun se počítá od nové pozice, jinak prvek odskočí.
    posunX = udalost.clientX;
    posunY = udalost.clientY;
    tazeny.style.transform = "";
  }

  function pustit() {
    if (!tazeny) {
      zrusit();
      return;
    }
    const nove = poradi();
    zrusit();
    onZmena(nove);
  }

  function naStisk(udalost) {
    // Jen hlavní tlačítko myši nebo dotyk.
    if (udalost.button !== undefined && udalost.button !== 0) return;

    const prvek = udalost.target.closest("[data-dnd-key]");
    if (!prvek || prvek.parentElement !== kontejner) return;

    start = { x: udalost.clientX, y: udalost.clientY, prvek };
    casovac = setTimeout(() => {
      if (start) zvednout(start.prvek, udalost);
    }, DRZENI_MS);
  }

  function naPohyb(udalost) {
    if (tazeny) {
      udalost.preventDefault();
      presunout(udalost);
      return;
    }

    if (!start) return;

    // Uživatel posouvá stránku, ne přetahuje.
    const vzdalenost =
      Math.abs(udalost.clientX - start.x) + Math.abs(udalost.clientY - start.y);
    if (vzdalenost > TOLERANCE_PX) zrusit();
  }

  function naPusteni() {
    if (tazeny) pustit();
    else zrusit();
  }

  kontejner.addEventListener("pointerdown", naStisk);
  window.addEventListener("pointermove", naPohyb, { passive: false });
  window.addEventListener("pointerup", naPusteni);
  window.addEventListener("pointercancel", zrusit);

  return () => {
    zrusit();
    kontejner.removeEventListener("pointerdown", naStisk);
    window.removeEventListener("pointermove", naPohyb);
    window.removeEventListener("pointerup", naPusteni);
    window.removeEventListener("pointercancel", zrusit);
  };
}
