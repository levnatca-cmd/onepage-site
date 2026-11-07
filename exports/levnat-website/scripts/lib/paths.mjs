import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const projectPath = (...parts) => resolve(ROOT, ...parts);
export const isMain = (url) =>
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
