import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildPublicSite } from "./lib/public-site.mjs";

// The web root is a fresh directory and contains public files only.
const output = process.argv[2]
  ? resolve(process.argv[2])
  : mkdtempSync(join(tmpdir(), "levnat-pqc-web-"));
if (process.argv[2]) mkdirSync(output);
buildPublicSite(output);
console.log(`PQC_WEB_ROOT=${output}`);
