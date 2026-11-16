import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { extname, dirname, resolve, relative } from "node:path";
import { pagePath, publicPath, ROOT, websitePath } from "../../scripts/lib/paths.mjs";

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    if ([".git", "node_modules"].includes(name)) return [];
    const full = resolve(directory, name);
    return statSync(full).isDirectory() ? filesIn(full) : [full];
  });
}
function checkReference(file, reference, pageUrl) {
  const clean = reference.split(/[?#]/)[0];
  if (!clean || /^(?:[a-z]+:|\/\/)/i.test(clean)) return;
  const target = pageUrl
    ? publicPath(decodeURIComponent(new URL(clean, pageUrl).pathname))
    : clean.startsWith("/")
      ? publicPath(clean)
      : resolve(dirname(file), clean);
  assert.ok(existsSync(target), `${relative(ROOT, file)} references missing ${reference}`);
}
for (const entry of ["index.html", "explore.html", "starworld.html"]) {
  const index = pagePath(entry);
  const pageUrl = new URL(entry, "https://levnat.test/");
  for (const match of readFileSync(index, "utf8").matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    checkReference(index, match[1], pageUrl);
  }
}
for (const file of [...filesIn(websitePath("src/galaxy")), ...filesIn(websitePath("src/studio"))]) {
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
