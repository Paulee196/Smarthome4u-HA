/* Vlastní ikony.
 *
 * Jednoduché linkové ikony jedné rodiny - stejná tloušťka, stejné zakončení.
 * Žádné převzaté ikony Apple, Google ani Tuya.
 */

const PATHS = {
  home: "M3 10.6 12 3.5l9 7.1V20a1 1 0 0 1-1 1h-4.5v-6.5h-7V21H4a1 1 0 0 1-1-1z",
  rooms: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  scenes: "M12 3.5 14.2 9l5.8.6-4.4 4 1.3 5.7L12 16.4 7.1 19.3l1.3-5.7-4.4-4L9.8 9z",
  automations: "M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z",
  devices: "M9 2.5v4M15 2.5v4M5.5 6.5h13v7.5a6.5 6.5 0 0 1-13 0zM12 20.5v3",
  settings:
    "M4 7h6M14 7h6M4 17h2M10 17h10M12 4.5v5M8 14.5v5",
};

export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", PATHS[name] || PATHS.home);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.7");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  svg.append(path);
  return svg;
}
