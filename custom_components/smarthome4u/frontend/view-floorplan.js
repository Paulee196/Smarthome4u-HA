/* Půdorys bytu.
 *
 * Obrázek nahraje správce, zařízení se na něj rozmístí přetažením.
 * Souřadnice se ukládají v procentech plochy, takže plán funguje stejně
 * na telefonu i na nástěnném panelu.
 */

import { api } from "./api.js";
import { t, describeState } from "./i18n.js";
import { openControls } from "./controls.js";
import { editAppearance } from "./appearance.js";
import { icon, iconFor } from "./icons.js";
import { vybratZarizeni } from "./picker.js";
import {
  h,
  button,
  closeDialog,
  dialog,
  emptyState,
  selectInput,
  toast,
} from "./ui.js";

export async function renderFloorplan(root, ctx) {
  let plan;
  try {
    plan = await api.floorplan();
  } catch (error) {
    root.append(emptyState(error.message));
    return;
  }

  const jeTechnik = ["admin", "technician"].includes(ctx.model?.user?.role);

  if (jeTechnik || ctx.editing) {
    root.append(
      h("div", { class: "row row--end" }, [
        jeTechnik && button(t.floorplan.upload, () => nahrat(ctx), "button--ghost"),
        ctx.editing &&
          button(t.floorplan.addDevice, () => pridatBod(ctx, plan), "button--ghost"),
      ]),
    );
  }

  if (!plan.image) {
    root.append(emptyState(jeTechnik ? t.floorplan.empty : t.floorplan.emptyUser));
    return;
  }

  root.append(platno(ctx, plan));
}

/* ------------------------------------------------------------------ */
/* Plán s body                                                         */
/* ------------------------------------------------------------------ */

function platno(ctx, plan) {
  const vse = new Map(
    ctx.allEntities().flatMap((e) => [
      [e.id, e],
      [e.ref || e.id, e],
    ]),
  );

  const obrazek = h("img", {
    class: "plan__obrazek",
    src: plan.image,
    alt: t.floorplan.title,
  });

  const vrstva = h("div", { class: "plan__vrstva" });
  const platno = h("div", { class: "plan" }, [obrazek, vrstva]);

  for (const bod of plan.points) {
    const entity = vse.get(bod.entityRef || bod.entityId);
    if (!entity) continue;
    vrstva.append(znacka(ctx, plan, bod, entity, platno));
  }

  return platno;
}

function znacka(ctx, plan, bod, entity, platno) {
  const { tone } = describeState(entity);
  const color = ["mint", "blue", "violet", "amber", "rose"].includes(bod.color)
    ? bod.color : "default";
  const size = ["s", "m", "l", "xl"].includes(bod.size) ? bod.size : "m";
  const prvek = h("div", {
    class: `plan__bod plan__bod--${tone} plan__bod--tone-${color} plan__bod--${size}`,
  }, [
    h("button", {
      class: "plan__bod-hit", type: "button",
      "aria-label": bod.label || entity.name,
      onclick: () => { if (!ctx.editing) openControls(entity); },
    }, [
      bod.icon ? icon(bod.icon, "icon") : iconFor(entity, "icon"),
      h("span", { class: "plan__jmeno", text: bod.label || entity.name }),
    ]),
    ctx.editing && h("button", {
      class: "plan__bod-edit", type: "button", text: "⋯",
      "aria-label": t.editor.editPoint,
      onclick: () => upravitBod(ctx, plan, bod, entity),
    }),
  ]);

  prvek.style.left = `${bod.x}%`;
  prvek.style.top = `${bod.y}%`;

  if (ctx.editing) {
    prvek.classList.add("plan__bod--edit");
    prvek.addEventListener("pointerdown", (udalost) => {
      if (udalost.target.closest(".plan__bod-edit")) return;
      zacitTahat(udalost, prvek, bod, plan, platno);
    });
  }

  return prvek;
}

function upravitBod(ctx, plan, bod, entity) {
  const extra = h("div", { class: "row" }, [
    button(t.favorites.replace, () => {
      closeDialog();
      vybratZarizeni(ctx, {
        nadpis: t.favorites.replace,
        onVyber: async (ref) => {
          bod.entityRef = ref;
          await ulozitBody(ctx, plan);
        },
      });
    }, "button--ghost"),
    button(t.favorites.remove, async () => {
      closeDialog();
      plan.points = plan.points.filter((p) => p !== bod);
      await ulozitBody(ctx, plan);
    }, "button--ghost"),
  ]);
  editAppearance(bod.label || entity.name, bod, async (appearance) => {
    Object.assign(bod, appearance);
    await ulozitBody(ctx, plan);
  }, { extra });
}

async function ulozitBody(ctx, plan) {
  try {
    await api.saveFloorplan({ points: plan.points });
    toast(t.notice.saved);
    await ctx.refresh();
  } catch (error) {
    toast(error.message, true);
  }
}

function zacitTahat(udalost, prvek, bod, plan, platno) {
  udalost.preventDefault();
  prvek.setPointerCapture?.(udalost.pointerId);

  function pohyb(dalsi) {
    const misto = platno.getBoundingClientRect();
    if (!misto.width || !misto.height) return;

    bod.x = Math.min(
      100,
      Math.max(0, ((dalsi.clientX - misto.left) / misto.width) * 100),
    );
    bod.y = Math.min(
      100,
      Math.max(0, ((dalsi.clientY - misto.top) / misto.height) * 100),
    );

    prvek.style.left = `${bod.x}%`;
    prvek.style.top = `${bod.y}%`;
  }

  async function konec() {
    window.removeEventListener("pointermove", pohyb);
    window.removeEventListener("pointerup", konec);

    try {
      await api.saveFloorplan({ points: plan.points });
      toast(t.editor.saved);
    } catch (error) {
      toast(error.message, true);
    }
  }

  window.addEventListener("pointermove", pohyb, { passive: false });
  window.addEventListener("pointerup", konec);
}

/* ------------------------------------------------------------------ */
/* Nahrání obrázku                                                     */
/* ------------------------------------------------------------------ */

function nahrat(ctx) {
  const vstup = h("input", {
    class: "input",
    type: "file",
    accept: "image/png,image/jpeg,image/webp",
  });

  dialog(
    t.floorplan.upload,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.floorplan.uploadHint }),
      vstup,
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.save, async () => {
        const soubor = vstup.files?.[0];
        if (!soubor) {
          toast(t.floorplan.pickFile, true);
          return;
        }

        try {
          const data = await precist(soubor);
          await api.uploadFloorplan(data);
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

function precist(soubor) {
  return new Promise((hotovo, chyba) => {
    const ctecka = new FileReader();
    ctecka.onload = () => hotovo(ctecka.result);
    ctecka.onerror = () => chyba(new Error(t.floorplan.readFailed));
    ctecka.readAsDataURL(soubor);
  });
}

/* ------------------------------------------------------------------ */
/* Přidání zařízení na plán                                            */
/* ------------------------------------------------------------------ */

function pridatBod(ctx, plan) {
  const jiz = new Set(plan.points.map((b) => b.entityRef || b.entityId));
  const nabidka = ctx
    .allEntities()
    .filter((e) => e.capability?.controllable && !jiz.has(e.ref || e.id))
    .map((e) => ({ value: e.ref || e.id, label: e.name }));

  if (!nabidka.length) {
    toast(t.floorplan.nothingToAdd, true);
    return;
  }

  const vyber = selectInput(nabidka, nabidka[0].value);

  dialog(
    t.floorplan.addDevice,
    h("div", { class: "stack" }, [
      h("p", { class: "muted", text: t.floorplan.addHint }),
      vyber,
    ]),
    h("div", { class: "row" }, [
      button(t.action.cancel, closeDialog, "button--ghost"),
      button(t.action.add, async () => {
        // Nové zařízení přistane uprostřed, správce ho pak přetáhne.
        plan.points.push({ entityRef: vyber.value, x: 50, y: 50 });

        try {
          await api.saveFloorplan({ points: plan.points });
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
