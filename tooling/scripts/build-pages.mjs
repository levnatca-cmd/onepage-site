import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectPath } from "./lib/paths.mjs";
import { buildPublicSite } from "./lib/public-site.mjs";

const buildDirectory = projectPath("artifacts/build");
const destination = process.argv[2];
mkdirSync(buildDirectory, { recursive: true });
const output = destination ? resolve(destination) : mkdtempSync(join(buildDirectory, "pages-"));
if (destination) mkdirSync(output);

buildPublicSite(output);
writeFileSync(join(output, ".nojekyll"), "");
console.log(`PAGES_OUTPUT=${output}`);
