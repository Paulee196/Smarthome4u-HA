/* Editor automatizací KDYŽ / A ZÁROVEŇ / PAK.
 *
 * Tři sloupce, žádné čáry. Model je stejný, jaký používá skládačka,
 * takže obě cesty vyrobí v Home Assistantu totéž.
 *
 * Frontend si nic nedomýšlí - co jde nastavit, určuje backend v builder.py
 * a on to taky ověřuje.
 */

import { api } from "./api.js";
import { t } from "./i18n.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  field,
  numberInput,
  selectInput,
  textInput,
  timeInput,
  toast,
} from "./ui.js";

/* Která pole patří ke kterému typu kroku. Musí sedět s builder.py. */
const POLE = {
  when: {
    state: ["entity", "to"],
    state_for: ["entity", "to", "minutes"],
    time: ["at"],
    sun: ["event", "offset"],
    numeric: ["entity", "direction", "value"],
  },
  and: {
    state: ["entity", "is"],
    time_range: ["after", "before"],
    numeric: ["entity", "direction", "value"],
  },
  then: {
    device: ["entity", "command"],
    value: ["entity", "command", "value"],
    scene: ["entity"],
    script: ["entity"],
    wait: ["minutes"],
    notify: ["message"],
  },
};

/* Jaké entity dává smysl nabídnout u kterého typu. */
const FILTRY = {
  scene: (e) => e.capability?.kind === "scene",
  script: (e) => e.capability?.kind === "script",
  numeric: (e) => e.capability?.kind === "sensor",
  value: (e) => ["light", "cover", "climate"].includes(e.capability?.kind),
};

const PREKLAD_SEKCE = { when: "triggers", and: "conditions", then: "actions" };

/* ------------------------------------------------------------------ */
/* Otevření                                                            */
/* ------------------------------------------------------------------ */

export function otevritEditor(ctx, model = null) {
  const data = model || {
    alias: "",
    description: "",
    mode: "single",
    when: [],
    and: [],
    then: [],
  };

  const jmeno = textInput(data.alias, t.builder.namePlaceholder);
  const rezim = selectInput(
    Object.entries(t.builder.modes).map(([value, label]) => ({ value, label })),
    data.mode || "single",
  );

  const telo = h("div", { class: "stack" }, [
    field(t.builder.name, jmeno),
    sekce(ctx, data, "when"),
    sekce(ctx, data, "and"),
    sekce(ctx, data, "then"),
    field(t.builder.mode, rezim),
  ]);

  dialog(
    data.id ? t.builder.editTitle : t.builder.title,
    telo,
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, async () => {
        data.alias = jmeno.value;
        data.mode = rezim.value;

        try {
          await api.buildAutomation(data);
          closeDialog();
          toast(t.notice.saved);
          await ctx.refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Sekce                                                               */
/* ------------------------------------------------------------------ */

function sekce(ctx, data, klic) {
  const seznam = h("div", { class: "stack" });
  const nadpisy = {
    when: [t.builder.when, t.builder.whenHint, t.builder.addWhen],
    and: [t.builder.and, t.builder.andHint, t.builder.addAnd],
    then: [t.builder.then, t.builder.thenHint, t.builder.addThen],
  }[klic];

  function prekreslit() {
    seznam.replaceChildren();

    if (!data[klic].length) {
      seznam.append(h("p", { class: "muted", text: t.builder.empty }));
    }

    data[klic].forEach((krok, index) => {
      seznam.append(radek(ctx, data, klic, krok, index, prekreslit));
    });
  }

  prekreslit();

  return h("section", { class: "builder__sekce" }, [
    h("div", { class: "builder__hlava" }, [
      h("span", { class: "builder__stitek", text: nadpisy[0] }),
      h("span", { class: "builder__napoveda", text: nadpisy[1] }),
    ]),
    seznam,
    button(
      nadpisy[2],
      () => {
        const typ = Object.keys(POLE[klic])[0];
        data[klic].push(vychoziKrok(klic, typ));
        prekreslit();
      },
      "button--ghost",
    ),
  ]);
}

function vychoziKrok(klic, typ) {
  const krok = { type: typ };
  if (klic === "when" && typ === "state") krok.to = "on";
  if (klic === "and" && typ === "state") krok.is = "on";
  if (klic === "then" && typ === "device") krok.command = "turn_on";
  return krok;
}

/* ------------------------------------------------------------------ */
/* Jeden krok                                                          */
/* ------------------------------------------------------------------ */

function radek(ctx, data, klic, krok, index, prekreslit) {
  const typy = Object.keys(POLE[klic]).map((value) => ({
    value,
    label: t.builder[PREKLAD_SEKCE[klic]][value],
  }));

  const vyberTypu = selectInput(typy, krok.type);
  vyberTypu.addEventListener("change", () => {
    data[klic][index] = vychoziKrok(klic, vyberTypu.value);
    prekreslit();
  });

  const pole = h("div", { class: "builder__pole" });
  for (const nazev of POLE[klic][krok.type] || []) {
    pole.append(policko(ctx, krok, nazev));
  }

  return h("div", { class: "builder__krok" }, [
    h("div", { class: "builder__krok-hlava" }, [
      vyberTypu,
      h("button", {
        class: "tile__more tile__more--danger",
        type: "button",
        "aria-label": t.builder.remove,
        text: "✕",
        onclick: () => {
          data[klic].splice(index, 1);
          prekreslit();
        },
      }),
    ]),
    pole,
  ]);
}

function policko(ctx, krok, nazev) {
  const popis = t.builder.fields[nazev];

  switch (nazev) {
    case "entity": {
      const filtr = FILTRY[krok.type] || ((e) => e.capability?.controllable);
      const nabidka = ctx
        .allEntities()
        .filter(filtr)
        .map((e) => ({ value: e.id, label: e.name }));

      if (!nabidka.length) {
        return h("p", { class: "form-error", text: `${popis}: nic vhodného` });
      }

      const vyber = selectInput(nabidka, krok.entity || nabidka[0].value);
      krok.entity = vyber.value;
      vyber.addEventListener("change", () => {
        krok.entity = vyber.value;
      });
      return field(popis, vyber);
    }

    case "to":
    case "is": {
      const stavy = Object.entries(t.builder.states).map(([value, label]) => ({
        value,
        label,
      }));
      const vyber = selectInput(stavy, krok[nazev] || "on");
      krok[nazev] = vyber.value;
      vyber.addEventListener("change", () => {
        krok[nazev] = vyber.value;
      });
      return field(popis, vyber);
    }

    case "command": {
      const volby =
        krok.type === "value"
          ? ["brightness", "position", "temperature"]
          : ["turn_on", "turn_off", "toggle"];
      const vyber = selectInput(
        volby.map((value) => ({ value, label: t.builder.commands[value] })),
        krok.command || volby[0],
      );
      krok.command = vyber.value;
      vyber.addEventListener("change", () => {
        krok.command = vyber.value;
      });
      return field(popis, vyber);
    }

    case "direction": {
      const vyber = selectInput(
        Object.entries(t.builder.directions).map(([value, label]) => ({
          value,
          label,
        })),
        krok.direction || "above",
      );
      krok.direction = vyber.value;
      vyber.addEventListener("change", () => {
        krok.direction = vyber.value;
      });
      return field(popis, vyber);
    }

    case "event": {
      const vyber = selectInput(
        Object.entries(t.builder.sunEvents).map(([value, label]) => ({
          value,
          label,
        })),
        krok.event || "sunset",
      );
      krok.event = vyber.value;
      vyber.addEventListener("change", () => {
        krok.event = vyber.value;
      });
      return field(popis, vyber);
    }

    case "minutes":
    case "offset":
    case "value": {
      const vychozi = krok[nazev] ?? (nazev === "minutes" ? 5 : 0);
      const vstup = numberInput(vychozi, nazev === "offset" ? -720 : 0, 1440);
      krok[nazev] = Number(vstup.value);
      vstup.addEventListener("change", () => {
        krok[nazev] = Number(vstup.value);
      });
      return field(popis, vstup);
    }

    case "at":
    case "after":
    case "before": {
      const vstup = timeInput(krok[nazev] || "20:00:00");
      krok[nazev] = `${vstup.value}:00`;
      vstup.addEventListener("change", () => {
        krok[nazev] = `${vstup.value}:00`;
      });
      return field(popis, vstup);
    }

    case "message": {
      const vstup = textInput(krok.message || "");
      krok.message = vstup.value;
      vstup.addEventListener("input", () => {
        krok.message = vstup.value;
      });
      return field(popis, vstup);
    }

    default:
      return h("span", { class: "muted", text: popis });
  }
}

/* ------------------------------------------------------------------ */
/* Úprava existující                                                   */
/* ------------------------------------------------------------------ */

export async function upravitAutomatizaci(ctx, automationId) {
  let odpoved;
  try {
    odpoved = await api.automationModel(automationId);
  } catch (error) {
    toast(error.message, true);
    return;
  }

  if (odpoved.advanced) {
    dialog(
      odpoved.alias || t.builder.advanced,
      h("p", { class: "muted", text: t.builder.advancedHint }),
      h("div", { class: "row" }, [button(t.action.close, closeDialog)]),
    );
    return;
  }

  otevritEditor(ctx, odpoved.model);
}
