import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { extname, dirname, resolve, relative } from "node:path";
import { projectPath, ROOT } from "../../scripts/lib/paths.mjs";
import {
  readStarworldFile,
  readStarworldStyles,
  readStarworldSource,
} from "../../scripts/lib/starworld-source.mjs";

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    if ([".git", "node_modules"].includes(name)) return [];
    const full = resolve(directory, name);
    return statSync(full).isDirectory() ? filesIn(full) : [full];
  });
}
function checkReference(file, reference) {
  const clean = reference.split(/[?#]/)[0];
  if (!clean || /^(?:[a-z]+:|\/\/)/i.test(clean)) return;
  const target = clean.startsWith("/") ? projectPath(`.${clean}`) : resolve(dirname(file), clean);
  assert.ok(existsSync(target), `${relative(ROOT, file)} references missing ${reference}`);
}
for (const entry of ["index.html", "explore.html"]) {
  const index = projectPath(entry);
  for (const match of readFileSync(index, "utf8").matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    checkReference(index, match[1]);
  }
}
for (const file of [...filesIn(projectPath("src/galaxy")), ...filesIn(projectPath("src/studio"))]) {
  const source = readFileSync(file, "utf8");
  if (extname(file) === ".js") {
    for (const match of source.matchAll(
      /\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g,
    )) {
      if (match[1].startsWith(".") || match[1].startsWith("/")) checkReference(file, match[1]);
    }
  }
  if (extname(file) === ".css") {
    for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g))
      checkReference(file, match[1]);
  }
}
console.log("PASS repository paths: root entry, styles, browser modules and assets resolve.");

const html = readFileSync(projectPath("starworld.html"), "utf8");
assert.ok(html.includes(readStarworldStyles()), "Standalone CSS must match authored source order.");
assert.ok(
  html.includes(readStarworldSource()),
  "Standalone JavaScript must match authored source order.",
);
assert.ok(!/STARWORLD_(?:STYLES|ENGINE|APP)/.test(html));
for (const file of ["deploy/starworld/index.html", "deploy/starworld/dist/index.html"]) {
  assert.equal(
    readFileSync(projectPath(file), "utf8"),
    html,
    `${file} is stale; run npm run build.`,
  );
}
assert.ok(readStarworldFile("index.html").includes("/* STARWORLD_STYLES */"));
console.log("PASS build ownership: generated standalone and local deployment copies match source.");

const textExtensions = new Set([".html", ".js", ".mjs", ".css", ".md", ".json", ".txt", ".xml"]);
const violations = [];
for (const file of filesIn(ROOT)) {
  if (!textExtensions.has(extname(file)) && !/ignore$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (/\p{Script=Cyrillic}/u.test(text)) violations.push(relative(ROOT, file));
}
assert.deepEqual(violations, [], "Project documentation, comments and text must be English.");
console.log(
  "PASS project language: no Cyrillic remains outside immutable Git history/dependencies.",
);
