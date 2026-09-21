/* Nástěnný panel.
 *
 * Postavené pro zeď, ne do kapsy. Velké písmo, velké cíle, čitelnost
 * z několika metrů.
 *
 * Hlavní myšlenka je kontextovost: karta se objeví, jen když je co ukázat.
 * Zavřený dům nepotřebuje kartu, která říká, že je zavřený - to už stojí
 * ve stavu nahoře. Když nic nehraje, není tu přehrávač. Když je všude
 * zhasnuto, není tu seznam světel.
 *
 * Díky tomu panel neroste do nekonečna a na zdi je vidět jen to, co se
 * právě děje.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import { card } from "./controls.js";
import { icon } from "./icons.js";
import { mrizkaOblibenych } from "./favorites.js";
import { h, button, emptyState, toast } from "./ui.js";

export function renderPanel(root, ctx) {
  const model = ctx.model;
  const souhrn = model.summary || {};

  root.append(hlavicka(souhrn));

  // Pořadí je dané naléhavostí: nejdřív co hoří, pak co je otevřené,
  // pak co hraje, a teprve nakonec běžné ovládání.
  pridat(root, kartaUpozorneni(souhrn));
  pridat(root, kartaPozornost(model.attention || []));
  pridat(root, kartaPrehravac(model.nowPlaying || []));
  pridat(root, kartaSvetla(model, souhrn));

  const sceny = model.scenes || [];
  if (sceny.length) {
    root.append(
      blok(t.scenes.scenes, "scenes", h(
        "div",
        { class: "cards" },
        sceny.map((entity) => card(entity)),
      )),
    );
  }

  const oblibene = model.favorites || [];
  if (oblibene.length || ctx.editing) {
    root.append(
      blok(t.home.favorites, "home", h("div", { class: "stack" }, [
        ctx.editing &&
          h("p", { class: "muted", text: t.favorites.hint }),
        mrizkaOblibenych(ctx),
      ])),
    );
  }

  const mistnosti = model.roomSummaries || [];
  if (mistnosti.length) {
    root.append(blok(t.nav.rooms, "rooms", pruhMistnosti(mistnosti, ctx)));
  }

  if (!sceny.length && !oblibene.length && !mistnosti.length) {
    root.append(emptyState(t.empty.text));
  }
}

function pridat(root, prvek) {
  if (prvek) root.append(prvek);
}

/* ------------------------------------------------------------------ */
/* Hlavička s časem                                                    */
/* ------------------------------------------------------------------ */

function hlavicka(souhrn) {
  const cas = h("span", { class: "panelh__cas" });
  const datum = h("span", { class: "panelh__datum" });

  function prekreslit() {
    const ted = new Date();
    cas.textContent = ted.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
    datum.textContent = ted.toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  prekreslit();

  // Hodiny se samy zastaví, jakmile panel zmizí ze stránky.
  const tik = setInterval(() => {
    if (!cas.isConnected) {
      clearInterval(tik);
      return;
    }
    prekreslit();
  }, 15000);

  return h("section", { class: "panelh" }, [
    h("div", { class: "panelh__cas-blok" }, [cas, datum]),
    h("p", { class: "panelh__stav", text: stavVetou(souhrn) }),
  ]);
}

/** Stav domu jednou větou, jak se dá přečíst z dálky. */
function stavVetou(souhrn) {
  const casti = [];

  casti.push(
    souhrn.lightsOn
      ? t.status.lightsOn(souhrn.lightsOn, souhrn.lightNames)
      : t.status.allLightsOff,
  );

  if (!souhrn.openCount && !souhrn.unlockedCount) {
    casti.push(t.status.allClosed);
  }

  return casti.join(" ");
}

/* ------------------------------------------------------------------ */
/* Kontextové karty                                                    */
/* ------------------------------------------------------------------ */

function kartaUpozorneni(souhrn) {
  if (!souhrn.alerts?.length) return null;

  return blok(
    t.home.alerts,
    "security",
    h(
      "div",
      { class: "cards" },
      souhrn.alerts.map((entity) => card(entity)),
    ),
    "panel--alert",
  );
}

function kartaPozornost(otevrene) {
  if (!otevrene.length) return null;

  return blok(
    t.panel.open,
    "window",
    h(
      "div",
      { class: "cards" },
      otevrene.map((entity) => card(entity)),
    ),
    "panel--warn",
  );
}

function kartaPrehravac(hrajici) {
  if (!hrajici.length) return null;

  return blok(
    t.panel.nowPlaying,
    "media",
    h(
      "div",
      { class: "stack" },
      hrajici.map((entity) =>
        h("div", { class: "hraje" }, [
          h("span", { class: "hraje__jmeno", text: entity.name }),
          h("span", {
            class: "hraje__skladba",
            text: entity.attributes?.media_title || "",
          }),
        ]),
      ),
    ),
  );
}

/** Seznam rozsvícených světel. Když nikde nesvítí, karta se neukáže. */
function kartaSvetla(model, souhrn) {
  if (!souhrn.lightsOn) return null;

  const svitici = (model.rooms || [])
    .flatMap((room) => room.entities)
    .filter((e) => e.capability?.kind === "light" && e.state === "on");

  if (!svitici.length) return null;

  const obsah = h("div", { class: "stack" }, [
    h(
      "div",
      { class: "cards" },
      svitici.map((entity) => card(entity)),
    ),
    h("div", { class: "row" }, [
      button(t.home.allLightsOff, () => zhasnoutVse(svitici)),
    ]),
  ]);

  return blok(t.panel.lightsOn, "lighting", obsah);
}

async function zhasnoutVse(svetla) {
  try {
    await Promise.all(svetla.map((e) => api.action(e.id, "turn_off")));
    toast(t.home.turnedOff(svetla.length));
  } catch (error) {
    toast(error.message, true);
  }
}

/* ------------------------------------------------------------------ */
/* Místnosti                                                           */
/* ------------------------------------------------------------------ */

function pruhMistnosti(mistnosti, ctx) {
  return h(
    "div",
    { class: "cards cards--rooms" },
    mistnosti.map((souhrn) =>
      h(
        "button",
        {
          class: `card card--room${souhrn.lightsOn ? " card--on" : ""}`,
          type: "button",
          onclick: () => ctx.navigate("rooms"),
        },
        [
          h("span", { class: "card__icon" }, icon("rooms")),
          h("span", {
            class: "card__name",
            text: souhrn.name || t.rooms.unassigned,
          }),
          h("span", {
            class: "card__state",
            text:
              souhrn.temperature !== null && souhrn.temperature !== undefined
                ? `${souhrn.temperature} °C`
                : t.rooms.deviceTotal(souhrn.count),
          }),
        ],
      ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Společné                                                            */
/* ------------------------------------------------------------------ */

function blok(nadpis, glyf, obsah, trida = "") {
  return h("section", { class: `panel ${trida}`.trim() }, [
    h("div", { class: "panel__head" }, [
      h("span", { class: "panel__glyph" }, icon(glyf)),
      h("h2", { class: "panel__title", text: nadpis }),
    ]),
    obsah,
  ]);
}
