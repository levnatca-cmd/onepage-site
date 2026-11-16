// This publishing checkout can build on its own, from any working directory.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(directory, "dist"), { recursive: true });
copyFileSync(resolve(directory, "index.html"), resolve(directory, "dist/index.html"));
