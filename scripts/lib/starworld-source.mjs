import { readFileSync } from "node:fs";
import { projectPath } from "./paths.mjs";

// These fragments share one private closure in the offline HTML output.
export const STARWORLD_MODULES = [
  "data/services.js",
  "domain/project-brief.js",
  "scene/label-layout.js",
  "scene/geometry.js",
  "scene/glyph-field.js",
  "scene/service-map.js",
  "app.js",
];
export const STARWORLD_STYLES = ["base.css", "theme.css", "services.css", "layout.css"];
export const readStarworldFile = (name) => readFileSync(projectPath("src/starworld", name), "utf8");
export const readStarworldSource = () =>
  STARWORLD_MODULES.map(
    (name) => `// Source: src/starworld/${name}\n${readStarworldFile(name)}`,
  ).join("\n");
export const readStarworldStyles = () =>
  STARWORLD_STYLES.map((name) => readStarworldFile(`styles/${name}`)).join("\n");
