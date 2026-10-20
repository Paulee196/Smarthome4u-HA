import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const frontend = "custom_components/smarthome4u/frontend";
const source = readFileSync(join(frontend, "i18n.js"));
const { t } = await import(`data:text/javascript;base64,${source.toString("base64")}`);
const missing = [];

for (const file of readdirSync(frontend).filter((name) => name.endsWith(".js") && name !== "i18n.js")) {
  const text = readFileSync(join(frontend, file), "utf8");
  for (const match of text.matchAll(/\bt\.([A-Za-z_]+)\.([A-Za-z_]+)\b/g)) {
    const [, group, key] = match;
    if (!Object.hasOwn(t, group) || !Object.hasOwn(t[group], key)) {
      missing.push(`${file}: t.${group}.${key}`);
    }
  }
  for (const match of text.matchAll(/\bt\.([A-Za-z_]+)\.([A-Za-z_]+)\.([A-Za-z_]+)\b/g)) {
    const [, group, section, key] = match;
    if (!Object.hasOwn(t, group) || !Object.hasOwn(t[group], section)
        || (!Object.hasOwn(t[group][section], key)
          && !(Array.isArray(t[group][section]) && key in Array.prototype))) {
      missing.push(`${file}: t.${group}.${section}.${key}`);
    }
  }
}

const blocks = readFileSync(join(frontend, "blocks.js"), "utf8");
const menu = blocks.match(/export const NABIDKA = \[([\s\S]*?)\];/);
if (!menu) {
  missing.push("blocks.js: nenalezena nabídka typů prvků");
} else {
  for (const [, type] of menu[1].matchAll(/"([A-Za-z_]+)"/g)) {
    if (!t.blocks[type]) missing.push(`blocks.js: název prvku ${type}`);
    if (!t.blocksHint[type]) missing.push(`blocks.js: popis prvku ${type}`);
  }
}

if (missing.length) {
  console.error("Chybějící popisky rozhraní:\n" + [...new Set(missing)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("Všechny přímé odkazy na překlady mají text.");
}
