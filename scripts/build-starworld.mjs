import { readFileSync, writeFileSync } from "node:fs";
import { projectPath, isMain } from "./lib/paths.mjs";
import {
  readStarworldFile,
  readStarworldSource,
  readStarworldStyles,
} from "./lib/starworld-source.mjs";

export function buildStarworld() {
  const vendor = readFileSync(projectPath("vendor/three/three.module.min.js"), "utf8");
  const match = vendor.match(/export\{([^}]+)\};?\s*$/);
  if (!match) throw new Error("Expected the retained Three.js ESM export block.");
  const exports = match[1]
    .split(",")
    .map((part) => {
      const [local, alias] = part.trim().split(/\s+as\s+/);
      return `${alias || local}:${local}`;
    })
    .join(",");
  const engine = `<script>\nwindow.STARWORLD_THREE=(()=>{\n${vendor.slice(0, match.index)}\nreturn {${exports}};\n})();\n</script>`;
  const app = `/* Systems Engineering service map. Built by scripts/build-starworld.mjs. */\n(() => {\n"use strict";\n${readStarworldSource()}\n})();`;
  const html = readStarworldFile("index.html")
    .replace("/* STARWORLD_STYLES */", () => readStarworldStyles())
    .replace("<!-- STARWORLD_ENGINE -->", () => engine)
    .replace("<!-- STARWORLD_APP -->", () => `<script>\n${app}\n</script>`);
  if (/STARWORLD_(?:STYLES|ENGINE|APP)/.test(html)) throw new Error("Unresolved build marker.");
  writeFileSync(projectPath("starworld.html"), html);
  console.log(
    `Built standalone starworld.html (${Math.round(Buffer.byteLength(html) / 1024)} KB).`,
  );
}
if (isMain(import.meta.url)) buildStarworld();
