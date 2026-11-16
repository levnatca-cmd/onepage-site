import { copyFileSync, lstatSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { pages } from "../../../website/src/studio/pages.js";
import { buildStudio } from "../build-studio.mjs";
import { publicPath } from "./paths.mjs";

function copyPublicFile(output, name) {
  const source = publicPath(name);
  if (!lstatSync(source).isFile()) throw new Error(`Expected a regular public file: ${name}.`);
  const destination = join(output, name);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyPublicTree(output, folder, extensions) {
  for (const entry of readdirSync(publicPath(folder), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const name = `${folder}/${entry.name}`;
    if (entry.isDirectory()) copyPublicTree(output, name, extensions);
    if (entry.isFile() && extensions.includes(extname(name))) copyPublicFile(output, name);
  }
}

export function buildPublicSite(output) {
  buildStudio();

  for (const name of [
    "index.html",
    "home/index.html",
    "explore.html",
    "starworld.html",
    "robots.txt",
    "sitemap.xml",
    "assets/images/favicon.png",
    "assets/images/galaxy-core-plasma.webp",
    "vendor/lucide/icons.js",
    "vendor/lucide-LICENSE.txt",
    "vendor/three/three.module.min.js",
    ...pages.map((page) => `${page.path.slice(1)}index.html`),
  ]) {
    copyPublicFile(output, name);
  }
  copyPublicTree(output, "assets/fonts", [".woff2", ".txt"]);
  copyPublicTree(output, "assets/images/galaxy-services", [".svg"]);
  for (const folder of ["src/galaxy/js", "src/galaxy/styles", "src/studio", "src/shared"]) {
    copyPublicTree(output, folder, [".js", ".css"]);
  }
}
