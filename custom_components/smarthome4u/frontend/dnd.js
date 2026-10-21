/* Přetahování pro úpravu rozvržení.
 *
 * Postavené na Pointer Events, ne na HTML5 drag and drop. Ten na dotykových
 * zařízeních nefunguje a Smarthome4u musí jít upravit i na tabletu.
 *
 * Tahá se za samostatný úchyt na dlaždici nebo bloku.
 *
 * Postup: přetahovaný prvek se vyjme z toku a plave nad stránkou, na jeho
 * místě zůstane zástupce stejné velikosti. Zástupce se přesouvá mezi
 * sousedy podle toho, kde je prst. Dlaždici lze navíc předat do jiné
 * mřížky stejné skupiny.
 */

/** Prvek, za který se tahá. Musí mít v CSS touch-action: none. */
export const ATRIBUT_UCHYTU = "data-dnd-handle";

/** Prvek, který se přesouvá. Jeho hodnota je klíč do uloženého pořadí. */
export const ATRIBUT_KLICE = "data-dnd-key";

const skupiny = new WeakMap();

function cilovaMrizka(kontejner, udalost, skupina) {
  if (!skupina) return null;
  const koren = kontejner.getRootNode();
  const hledat = koren?.elementFromPoint ? koren : document;
  const hit = hledat.elementFromPoint(udalost.clientX, udalost.clientY);
  const cil = hit?.closest?.("[data-dnd-group]");
  const info = cil && skupiny.get(cil);
  return cil !== kontejner && info?.group === skupina ? { cil, info } : null;
}

function poziceVMrizce(cil, udalost) {
  const prvky = [...cil.children].filter((prvek) => prvek.hasAttribute(ATRIBUT_KLICE));
  const koren = cil.getRootNode();
  const hledat = koren?.elementFromPoint ? koren : document;
  const hit = hledat.elementFromPoint(udalost.clientX, udalost.clientY);
  const pod = hit?.closest?.(`[${ATRIBUT_KLICE}]`);
  if (pod?.parentElement !== cil) return prvky.length;
  const misto = pod.getBoundingClientRect();
  const za = udalost.clientX > misto.left + misto.width / 2;
  return prvky.indexOf(pod) + (za ? 1 : 0);
}

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
 * @param {{group?: string, id?: string, onTransfer?: Function}} moznosti
 * @returns {() => void} funkce, která přetahování vypne
 */
export function povolitPretahovani(kontejner, onZmena, moznosti = {}) {
  let tazeny = null;
  let zastupce = null;
  let uchyt = null;
  let pointerId = null;
  let zacatek = { x: 0, y: 0 };
  let puvodniPoradi = [];
  let zvyraznenyCil = null;
  let posledniBod = null;
  let scrollTimer = null;

  if (moznosti.group && moznosti.id && moznosti.onTransfer) {
    kontejner.setAttribute("data-dnd-group", moznosti.group);
    skupiny.set(kontejner, moznosti);
  }

  function zvyraznitCil(udalost) {
    const dalsi = cilovaMrizka(kontejner, udalost, moznosti.group)?.cil || null;
    if (zvyraznenyCil === dalsi) return;
    zvyraznenyCil?.classList.remove("dnd--cil");
    zvyraznenyCil = dalsi;
    zvyraznenyCil?.classList.add("dnd--cil");
  }

  function posunoutStranku() {
    if (!tazeny || !posledniBod) return;
    const karta = kontejner.closest(".dashboard-block");
    const obdelnik = karta?.getBoundingClientRect();
    if (karta && karta.scrollHeight > karta.clientHeight + 2
      && posledniBod.x >= obdelnik.left && posledniBod.x <= obdelnik.right
      && posledniBod.y >= obdelnik.top - 20
      && posledniBod.y <= obdelnik.bottom + 20) {
      const krokKarty = posledniBod.y < obdelnik.top + 48 ? -18
        : posledniBod.y > obdelnik.bottom - 48 ? 18 : 0;
      const puvodniPosun = karta.scrollTop;
      if (krokKarty) karta.scrollBy(0, krokKarty);
      if (karta.scrollTop !== puvodniPosun) {
        zvyraznitCil({ clientX: posledniBod.x, clientY: posledniBod.y });
        return;
      }
    }
    const okraj = 64;
    const krok = posledniBod.y < okraj ? -18
      : posledniBod.y > window.innerHeight - okraj ? 18 : 0;
    if (!krok) return;
    const shell = kontejner.getRootNode().querySelector?.(".shell");
    if (shell && shell.scrollHeight > shell.clientHeight + 2) shell.scrollBy(0, krok);
    else window.scrollBy(0, krok);
    zvyraznitCil({ clientX: posledniBod.x, clientY: posledniBod.y });
  }

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
    scrollTimer = window.setInterval(posunoutStranku, 40);

    if (navigator.vibrate) navigator.vibrate(10);
  }

  function presunout(udalost) {
    const dx = udalost.clientX - zacatek.x;
    const dy = udalost.clientY - zacatek.y;
    tazeny.style.transform = `translate(${dx}px, ${dy}px)`;
    zvyraznitCil(udalost);

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
    window.removeEventListener("pointermove", naPohyb);
    window.removeEventListener("pointerup", naPusteni);
    window.removeEventListener("pointercancel", uklidit);
    if (scrollTimer) window.clearInterval(scrollTimer);
    scrollTimer = null;
    zvyraznenyCil?.classList.remove("dnd--cil");
    zvyraznenyCil = null;
    posledniBod = null;
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

  function pustit(udalost) {
    if (!tazeny || !zastupce) {
      uklidit();
      return;
    }

    const cil = cilovaMrizka(kontejner, udalost, moznosti.group);
    const key = tazeny.getAttribute(ATRIBUT_KLICE);
    const index = cil ? poziceVMrizce(cil.cil, udalost) : -1;
    // Prvek se vrátí do toku přesně na místo zástupce.
    zastupce.replaceWith(tazeny);

    const nove = poradi();
    uklidit();
    if (cil && key) {
      moznosti.onTransfer(cil.info.id, key, index);
      return;
    }
    if (nove.join("\u0000") !== puvodniPoradi.join("\u0000")) onZmena(nove);
  }

  function naStisk(udalost) {
    if (tazeny) return;
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
    posledniBod = { x: udalost.clientX, y: udalost.clientY };
    try {
      u.setPointerCapture(pointerId);
    } catch {
      /* Starší prohlížeč. Poslouchání na okně to zachytí taky. */
    }

    zvednout(prvek, udalost);
    window.addEventListener("pointermove", naPohyb, { passive: false });
    window.addEventListener("pointerup", naPusteni);
    window.addEventListener("pointercancel", uklidit);
  }

  function naPohyb(udalost) {
    if (!tazeny) return;
    udalost.preventDefault();
    posledniBod = { x: udalost.clientX, y: udalost.clientY };
    presunout(udalost);
  }

  function naPusteni(udalost) {
    if (tazeny) pustit(udalost);
  }

  kontejner.addEventListener("pointerdown", naStisk);

  return () => {
    uklidit();
    skupiny.delete(kontejner);
    kontejner.removeEventListener("pointerdown", naStisk);
  };
}
