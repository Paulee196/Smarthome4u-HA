/* Scény, skripty a automatizace sdílejí jeden bod navigace. Jejich
 * stávající editory a HA API zůstávají beze změny. */

import { t } from "./i18n.js";
import { h } from "./ui.js";
import { renderScenes } from "./view-scenes.js";
import { renderAutomations } from "./view-automations.js";

let activeTab = "scenes";

export async function renderActivities(root, ctx, requestedTab = null) {
  if (requestedTab) activeTab = requestedTab;
  if (!ctx.jeTechnik) activeTab = "scenes";

  const content = h("div");
  if (ctx.jeTechnik) {
    const nav = h("nav", { class: "segmented", "aria-label": t.nav.scenes },
      [["scenes", t.scenes.title], ["automations", t.automations.title]].map(
        ([key, label]) => h("button", {
          class: "segmented__item" + (activeTab === key ? " segmented__item--active" : ""),
          type: "button", text: label, "aria-current": activeTab === key ? "page" : null,
          onclick: () => {
            activeTab = key;
            renderActivities(root, ctx).catch((error) => {
              content.replaceChildren(h("p", { class: "muted", text: error.message }));
            });
          },
        }),
      ));
    root.replaceChildren(nav, content);
  } else root.replaceChildren(content);

  if (activeTab === "automations") await renderAutomations(content, ctx);
  else await renderScenes(content, ctx);
}
