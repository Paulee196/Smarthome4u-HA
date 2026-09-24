/* Přetahování pro úpravu rozvržení.
 *
 * Postavené na Pointer Events, ne na HTML5 drag and drop. Ten na dotykových
 * zařízeních nefunguje a Smarthome4u musí jít upravit i na tabletu.
 *
 * Tahá se za samostatný úchyt na dlaždici nebo bloku.
 *
 * Postup: přetahovaný prvek se vyjme z toku a plave nad stránkou, na jeho
 * místě zůstane zástupce stejné velikosti. Zástupce se přesouvá mezi
 * sousedy podle toho, kde je prst. Po puštění se prvek vrátí na místo
 * zástupce.
 */

/** Prvek, za který se tahá. Musí mít v CSS touch-action: none. */
export const ATRIBUT_UCHYTU = "data-dnd-handle";

/** Prvek, který se přesouvá. Jeho hodnota je klíč do uloženého pořadí. */
export const ATRIBUT_KLICE = "data-dnd-key";

/**
 * Co je pod prstem.
 *
 * Aplikace běží ve stínovém stromu a document.elementFromPoint tam vrací
 * jen obal celého panelu. Hledat se musí od kořene stínového stromu,
 * jinak se soused nikdy nenajde a nic se nepřeskládá.
 */
function podPrstem(kontejner, udalost) {
  const koren = kontejner.getRootNode();
  const hledat = koren?.elementFromPoint ? koren : document;
  const prvek = hledat.elementFromPoint(udalost.clientX, udalost.clientY);
  for (let kandidat = prvek; kandidat && kandidat !== kontejner; kandidat = kandidat.parentElement) {
    if (kandidat.parentElement === kontejner && kandidat.hasAttribute(ATRIBUT_KLICE)) {
      return kandidat;
    }
  }
  return null;
}

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
  let uchyt = null;
  let pointerId = null;
  let zacatek = { x: 0, y: 0 };
  let puvodniPoradi = [];

  function poradi() {
    return [...kontejner.children]
      .map((prvek) => prvek.getAttribute(ATRIBUT_KLICE))
      .filter(Boolean);
  }

  function zvednout(prvek, udalost) {
    const misto = prvek.getBoundingClientRect();

    zastupce = document.createElement("div");
    zastupce.className = "dnd__zastupce";
    zastupce.style.width = `${misto.width}px`;
    zastupce.style.height = `${misto.height}px`;
    zastupce.style.gridColumn = getComputedStyle(prvek).gridColumn;
    prvek.after(zastupce);

    // Prvek vyjmeme z toku, aby se mřížka pod rukou nepřeskládala.
    prvek.classList.add("dnd--taheny");
    prvek.style.position = "fixed";
    prvek.style.left = `${misto.left}px`;
    prvek.style.top = `${misto.top}px`;
    prvek.style.width = `${misto.width}px`;
    prvek.style.height = `${misto.height}px`;
    // Bez tohohle by elementFromPoint vracel pořád jen jeho samotného.
    prvek.style.pointerEvents = "none";

    kontejner.classList.add("dnd--aktivni");
    tazeny = prvek;
    zacatek = { x: udalost.clientX, y: udalost.clientY };

    if (navigator.vibrate) navigator.vibrate(10);
  }

  function presunout(udalost) {
    const dx = udalost.clientX - zacatek.x;
    const dy = udalost.clientY - zacatek.y;
    tazeny.style.transform = `translate(${dx}px, ${dy}px)`;

    const pod = podPrstem(kontejner, udalost);

    if (!pod || pod === tazeny || pod.parentElement !== kontejner) return;

    // Podle toho, jestli je prst v horní nebo dolní polovině souseda,
    // se zástupce vloží před něj nebo za něj.
    const misto = pod.getBoundingClientRect();
    const mistoZastupce = zastupce.getBoundingClientRect();
    const stejnyRadek = Math.abs(mistoZastupce.top - misto.top) <
      Math.min(mistoZastupce.height, misto.height) / 2;
    const zaPolovinou = stejnyRadek
      ? udalost.clientX > misto.left + misto.width / 2
      : udalost.clientY > misto.top + misto.height / 2;

    if (zaPolovinou) pod.after(zastupce);
    else pod.before(zastupce);
  }

  function uklidit() {
    if (tazeny) {
      tazeny.classList.remove("dnd--taheny");
      tazeny.removeAttribute("style");
    }
    zastupce?.remove();
    kontejner.classList.remove("dnd--aktivni");

    if (uchyt && pointerId !== null) {
      try {
        uchyt.releasePointerCapture(pointerId);
      } catch {
        /* Ukazatel už mohl být uvolněný. */
      }
    }

    tazeny = null;
    zastupce = null;
    uchyt = null;
    pointerId = null;
  }

  function pustit() {
    if (!tazeny || !zastupce) {
      uklidit();
      return;
    }

    // Prvek se vrátí do toku přesně na místo zástupce.
    zastupce.replaceWith(tazeny);

    const nove = poradi();
    uklidit();
    if (nove.join("\u0000") !== puvodniPoradi.join("\u0000")) onZmena(nove);
  }

  function naStisk(udalost) {
    if (udalost.button !== undefined && udalost.button !== 0) return;

    // Klepnutí na tlačítko uvnitř dlaždice není tažení.
    const tlacitko = udalost.target.closest("button");
    if (tlacitko && !tlacitko.hasAttribute(ATRIBUT_UCHYTU)) return;

    const u = udalost.target.closest(`[${ATRIBUT_UCHYTU}]`);
    if (!u) return;

    const prvek = u.closest(`[${ATRIBUT_KLICE}]`);
    if (!prvek || prvek.parentElement !== kontejner) return;

    udalost.preventDefault();

    uchyt = u;
    pointerId = udalost.pointerId;
    puvodniPoradi = poradi();
    try {
      u.setPointerCapture(pointerId);
    } catch {
      /* Starší prohlížeč. Poslouchání na okně to zachytí taky. */
    }

    zvednout(prvek, udalost);
  }

  function naPohyb(udalost) {
    if (!tazeny) return;
    udalost.preventDefault();
    presunout(udalost);
  }

  function naPusteni() {
    if (tazeny) pustit();
  }

  kontejner.addEventListener("pointerdown", naStisk);
  window.addEventListener("pointermove", naPohyb, { passive: false });
  window.addEventListener("pointerup", naPusteni);
  window.addEventListener("pointercancel", uklidit);

  return () => {
    uklidit();
    kontejner.removeEventListener("pointerdown", naStisk);
    window.removeEventListener("pointermove", naPohyb);
    window.removeEventListener("pointerup", naPusteni);
    window.removeEventListener("pointercancel", uklidit);
  };
}
