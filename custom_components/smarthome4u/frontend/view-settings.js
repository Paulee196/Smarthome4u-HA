/* Nastavení aplikace.
 *
 * Nikde tu není odkaz do Home Assistantu. Všechno se spravuje odsud.
 */

import { t } from "./i18n.js";
import { h, button, section } from "./ui.js";
import { APP_VERSION } from "./version.js";

export function renderSettings(root, ctx) {
  const model = ctx.model;
  const user = model.user || {};

  root.append(
    section(
      t.settings.account,
      h("p", { class: "lead", text: user.name || t.settings.unknownUser }),
    ),
  );

  root.append(
    section(
      t.settings.system,
      h("dl", { class: "facts" }, [
        h("dt", { text: t.settings.appVersion }),
        h("dd", { text: APP_VERSION }),
        h("dt", { text: t.settings.haVersion }),
        h("dd", { text: model.haVersion || "-" }),
        h("dt", { text: t.settings.devices }),
        h("dd", { text: String(model.summary?.deviceCount ?? 0) }),
      ]),
    ),
  );

  root.append(
    section(t.settings.manage, [
      h("p", { class: "muted", text: t.settings.manageHint }),
      h("div", { class: "grid-buttons" }, [
        button(t.nav.rooms, () => ctx.navigate("rooms"), "button--ghost"),
        button(t.nav.devices, () => ctx.navigate("devices"), "button--ghost"),
        button(t.nav.automations, () => ctx.navigate("automations"), "button--ghost"),
      ]),
    ]),
  );
}
