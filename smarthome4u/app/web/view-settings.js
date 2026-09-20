/* Nastavení aplikace. */

import { t } from "./i18n.js";
import { h, haLink, section } from "./ui.js";
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
      ]),
    ),
  );

  root.append(
    section(t.settings.openHaSettings, [
      h("p", {
        class: "muted",
        text:
          "Pokročilá nastavení, uživatele, zálohy a integrace spravujete " +
          "v Home Assistantu.",
      }),
      h("div", { class: "grid-buttons" }, [
        haLink("/config/dashboard", t.settings.openHaSettings),
        haLink("/config/integrations/dashboard", t.devices.integration),
        haLink("/config/areas/dashboard", t.settings.structure),
      ]),
    ]),
  );
}
