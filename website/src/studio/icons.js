import { iconNodes } from "/vendor/lucide/icons.js";

export function refreshIcons(root = document) {
  for (const placeholder of root.querySelectorAll("i[data-lucide]")) {
    const name = placeholder.dataset.lucide;
    if (!iconNodes[name]) continue;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const attributes = {
      width: "24",
      height: "24",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.7",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      "data-lucide": name,
      class: `lucide lucide-${name} ${placeholder.className || ""}`,
    };
    for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
    for (const [tag, properties] of iconNodes[name]) {
      const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(properties)) element.setAttribute(key, value);
      svg.append(element);
    }
    placeholder.replaceWith(svg);
  }
}
