import { readFileSync } from "node:fs";
import { GALAXY_SERVICE_BY_ID } from "../../src/shared/service-catalog.js";
import { projectPath } from "./paths.mjs";

// These fragments share one private closure in the offline HTML output.
export const STARWORLD_MODULES = [
  "data/services.js",
  "domain/project-brief.js",
  "scene/label-layout.js",
  "scene/geometry.js",
  "scene/glyph-field.js",
  "scene/service-map.js",
  "ui/holograms.js",
  "ui/collapsible-panels.js",
  "app.js",
];
export const STARWORLD_STYLES = ["base.css", "panels.css", "holograms.css"];
export function readStarworldFile(name) {
  const source = readFileSync(projectPath("src/starworld", name), "utf8");
  if (name !== "data/services.js") return source;
  return `const GALAXY_SERVICE_BY_ID = ${JSON.stringify(GALAXY_SERVICE_BY_ID)};\n${source}`;
}
export const readStarworldSource = () =>
  STARWORLD_MODULES.map(
    (name) => `// Source: src/starworld/${name}\n${readStarworldFile(name)}`,
  ).join("\n");
export const readStarworldStyles = () =>
  STARWORLD_STYLES.map((name) => readStarworldFile(`styles/${name}`)).join("\n");
