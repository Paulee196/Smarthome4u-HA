/* Čtyři plochy používají stejný model HA, ale každá řeší jiný úkol.
 * Automatické části se odvozují z živých dat; osobní bloky pod nimi
 * zůstávají upravitelné v editoru dashboardu.
 */

import { card, openControls } from "./controls.js";
import { describeState, t } from "./i18n.js";
import { icon } from "./icons.js";
import { h } from "./ui.js";

const KATEGORIE = [
  ["all", "Vše"], ["light", "Světla"], ["climate", "Klima"],
  ["cover", "Stínění"], ["switch", "Spínače"], ["camera", "Kamery"],
  ["security", "Zabezpečení"], ["media_player", "Média"], ["other", "Ostatní"],
];

const druh = (e) => e.capability?.kind || "other";
const kategorie = (e) => ["lock", "alarm_control_panel"].includes(druh(e))
  ? "security" : druh(e) === "fan" ? "climate"
    : KATEGORIE.some(([id]) => id === druh(e)) ? druh(e) : "other";

function vyberZarizeni(ctx) {
  const refs = new Set((ctx.model.favorites || []).map((e) => e.ref || e.id));
  return (ctx.model.rooms || []).flatMap((room) => (room.entities || [])
    .map((e) => ({ ...e, roomName: room.name || "" })))
    .filter((e) => e.capability?.controllable || druh(e) === "camera")
    .sort((a, b) => Number(refs.has(b.ref || b.id)) - Number(refs.has(a.ref || a.id))
      || a.name.localeCompare(b.name, "cs"));
}

function titul(nadpis, popis) {
  return h("div", { class: "experience__heading" }, [
    h("h2", { text: nadpis }), h("p", { text: popis }),
  ]);
}

export function renderTuyaExperience(ctx) {
  const entities = vyberZarizeni(ctx);
  const summary = ctx.model.summary || {};
  const root = h("section", { class: "experience experience--tuya" });
  root.append(h("div", { class: "tuya-hero" }, [
    h("div", {}, [
      h("span", { class: "experience__eyebrow", text: "RYCHLÉ OVLÁDÁNÍ" }),
      h("h2", { text: "Chytrá domácnost" }),
      h("p", { text: `${entities.length} zařízení k ovládání · ${summary.lightsOn || 0} světel svítí` }),
    ]),
    h("span", { class: "tuya-hero__icon" }, icon("home")),
  ]));

  const controls = h("div", { class: "catalog__controls" });
  const filters = h("div", { class: "catalog__filters", role: "group", "aria-label": "Kategorie zařízení" });
  const search = h("input", { class: "catalog__search", type: "search", placeholder: "Hledat zařízení nebo místnost", "aria-label": "Hledat zařízení nebo místnost" });
  const grid = h("div", { class: "cards catalog__grid" });
  const count = h("p", { class: "catalog__count" });
  const more = h("button", { class: "button button--ghost", type: "button", text: "Zobrazit další" });
  let active = "all";
  let limit = 18;

  function draw() {
    const query = search.value.trim().toLocaleLowerCase("cs");
    const matched = entities.filter((e) =>
      (active === "all" || kategorie(e) === active)
      && (!query || `${e.name} ${e.roomName || ""}`.toLocaleLowerCase("cs").includes(query)));
    grid.replaceChildren(...matched.slice(0, limit).map((e) => card(e, { size: druh(e) === "camera" ? "l" : "m" })));
    if (!matched.length) grid.append(h("p", { class: "muted", text: "V této kategorii nic není." }));
    count.textContent = `Zobrazeno ${Math.min(limit, matched.length)} z ${matched.length}`;
    more.hidden = matched.length <= limit;
    for (const chip of filters.children) chip.setAttribute("aria-pressed", String(chip.dataset.kind === active));
  }
  for (const [kind, label] of KATEGORIE) {
    filters.append(h("button", {
      class: "catalog__chip", type: "button", text: label, dataset: { kind },
      onclick: () => { active = kind; limit = 18; draw(); },
    }));
  }
  search.addEventListener("input", () => { limit = 18; draw(); });
  more.addEventListener("click", () => { limit += 18; draw(); });
  controls.append(filters, search);
  root.append(titul("Zařízení", "Najděte zařízení podle typu, názvu nebo místnosti."), controls, grid,
    h("div", { class: "catalog__footer" }, [count, more]));
  draw();
  return root;
}

export function renderHomeExperience(ctx) {
  const rooms = (ctx.model.rooms || []).filter((r) => r.entities?.length);
  const summaries = ctx.model.roomSummaries || [];
  const summary = ctx.model.summary || {};
  const hour = new Date().getHours();
  const greeting = hour < 10 ? "Dobré ráno" : hour < 18 ? "Dobrý den" : "Dobrý večer";
  const root = h("section", { class: "experience experience--home" });
  root.append(h("div", { class: "home-hero" }, [
    h("span", { class: "experience__eyebrow", text: "VÁŠ DOMOV" }),
    h("h2", { text: `${greeting}.` }),
    h("p", { text: "Vyberte místnost a ovládejte to, co právě potřebujete." }),
    h("div", { class: "home-hero__facts" }, [
      h("span", { text: `${summary.lightsOn || 0} světel svítí` }),
      h("span", { text: `${summary.openCount || 0} otevřeno` }),
      h("span", { text: `${rooms.length} místností` }),
    ]),
  ]));
  if (!rooms.length) {
    root.append(h("p", { class: "muted", text: t.rooms.empty }));
    return root;
  }

  const picker = h("div", { class: "home-rooms", role: "group", "aria-label": "Vybrat místnost" });
  const body = h("div", { class: "home-room" });
  let selected = String(rooms[0].id);
  function draw() {
    const room = rooms.find((r) => String(r.id) === selected) || rooms[0];
    const info = summaries.find((r) => r.id === room.id) || {};
    const devices = (room.entities || []).filter((e) => e.capability?.controllable || druh(e) === "camera");
    body.replaceChildren(...[
      h("div", { class: "home-room__head" }, [
        h("div", {}, [h("span", { class: "experience__eyebrow", text: info.floorName || "MÍSTNOST" }),
          h("h3", { text: room.name || t.rooms.unassigned })]),
        h("span", { class: "home-room__meta", text: `${info.lightsOn || 0} světel svítí${info.temperature == null ? "" : ` · ${info.temperature} °C`}` }),
      ]),
      devices.length
        ? h("div", { class: "cards home-room__devices" }, devices.slice(0, 12)
          .map((e) => card(e, { size: ["climate", "cover", "media_player"].includes(druh(e)) ? "l" : "m" })))
        : h("p", { class: "muted", text: "V této místnosti nejsou ovladatelná zařízení." }),
      devices.length > 12 && h("button", { class: "button button--ghost", type: "button", text: "Všechna zařízení v místnosti", onclick: () => ctx.navigate("rooms") }),
    ].filter(Boolean));
    for (const chip of picker.children) chip.setAttribute("aria-pressed", String(chip.dataset.room === selected));
  }
  for (const room of rooms) {
    picker.append(h("button", { class: "home-rooms__item", type: "button", text: room.name || t.rooms.unassigned,
      dataset: { room: String(room.id) }, onclick: () => { selected = String(room.id); draw(); } }));
  }
  root.append(titul("Místnosti", "Každá místnost má své ovládání přímo tady."), picker, body);
  draw();
  return root;
}

export function renderOverviewExperience(ctx) {
  const model = ctx.model;
  const summary = model.summary || {};
  const entities = ctx.allEntities();
  const attention = [...(summary.alerts || []), ...(model.attention || [])]
    .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);
  const root = h("section", { class: "experience experience--overview" });
  root.append(h("div", { class: "overview-head" }, [
    h("div", {}, [h("span", { class: "experience__eyebrow", text: "ŽIVÁ DATA Z HOME ASSISTANTA" }),
      h("h2", { text: "Přehled domácnosti" }),
      h("p", { text: "Stav, upozornění a počty zařízení na jednom místě." })]),
    h("span", { class: "overview-head__time", text: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) }),
  ]));
  root.append(h("div", { class: "overview-metrics" }, [
    metric("Svítí", summary.lightsOn || 0, "lighting"),
    metric("Otevřeno", summary.openCount || 0, "window"),
    metric("Odemčeno", summary.unlockedCount || 0, "lock"),
    metric("Místnosti", (model.roomSummaries || []).length, "rooms"),
  ]));

  const issues = h("section", { class: "overview-section" }, [titul("Potřebuje pozornost", "Otevřené prvky a aktivní upozornění.")]);
  if (attention.length) {
    const list = h("div", { class: "overview-list" });
    for (const e of attention.slice(0, 12)) {
      list.append(h("button", { class: "overview-list__row", type: "button", onclick: () => openControls(e) }, [
        h("span", { class: "overview-list__icon" }, icon(kategorie(e) === "security" ? "security" : "devices")),
        h("span", { class: "overview-list__name", text: e.name }),
        h("span", { class: "overview-list__state", text: describeState(e).text }),
      ]));
    }
    issues.append(list);
  } else {
    issues.append(h("p", { class: "overview-ok", text: "Žádné otevřené prvky ani aktivní upozornění." }));
  }
  root.append(issues);

  const counts = new Map();
  for (const e of entities) counts.set(kategorie(e), (counts.get(kategorie(e)) || 0) + 1);
  root.append(h("section", { class: "overview-section" }, [
    titul("Zařízení podle typu", "Celkový inventář připojený v Home Assistantu."),
    h("div", { class: "overview-inventory" }, KATEGORIE.filter(([id]) => id !== "all")
      .map(([id, label]) => h("div", { class: "overview-inventory__item" }, [
        h("span", { text: label }), h("strong", { text: String(counts.get(id) || 0) }),
      ]))),
  ]));
  return root;
}

function metric(label, value, glyph) {
  return h("div", { class: "overview-metric" }, [
    h("span", { class: "overview-metric__icon" }, icon(glyph)),
    h("strong", { text: String(value) }),
    h("span", { text: label }),
  ]);
}
