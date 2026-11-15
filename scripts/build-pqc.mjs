import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { pages } from "../src/studio/pages.js";
import { buildStudio } from "./build-studio.mjs";
import { buildStarworld } from "./build-starworld.mjs";
import { projectPath } from "./lib/paths.mjs";

// The web root is a fresh directory and contains public files only.
const output = process.argv[2]
  ? resolve(process.argv[2])
  : mkdtempSync(join(tmpdir(), "levnat-pqc-web-"));
if (process.argv[2]) mkdirSync(output);
buildStudio();
buildStarworld();

function copyPublicFile(name) {
  const source = projectPath(name);
  if (!lstatSync(source).isFile()) throw new Error(`Expected a regular public file: ${name}`);
  const destination = join(output, name);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyPublicTree(folder, extensions) {
  for (const entry of readdirSync(projectPath(folder), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const name = `${folder}/${entry.name}`;
    if (entry.isDirectory()) copyPublicTree(name, extensions);
    if (entry.isFile() && extensions.includes(extname(name))) copyPublicFile(name);
  }
}

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
])
  copyPublicFile(name);
copyPublicTree("assets/fonts", [".woff2", ".txt"]);
copyPublicTree("assets/images/galaxy-services", [".svg"]);
for (const folder of ["src/galaxy/js", "src/galaxy/styles", "src/studio", "src/shared"])
  copyPublicTree(folder, [".js", ".css"]);

console.log(`PQC_WEB_ROOT=${output}`);
