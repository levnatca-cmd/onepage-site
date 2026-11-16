import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const projectPath = (...parts) => resolve(ROOT, ...parts);
export const WEBSITE_ROOT = projectPath("website");
export const websitePath = (...parts) => resolve(WEBSITE_ROOT, ...parts);
export const PAGES_ROOT = websitePath("pages");
export const pagePath = (...parts) => resolve(PAGES_ROOT, ...parts);

const websiteDirectories = new Set(["src", "assets", "vendor", "prototypes"]);

export function publicPath(pathname) {
  const parts = pathname.replace(/^\/+/, "").split("/");
  const [directory, ...rest] = parts;
  if (websiteDirectories.has(directory)) return websitePath(...parts);
  if (directory === "deepbook") return projectPath("projects", "deepbook", ...rest);
  if (directory === "artifacts") return projectPath(...parts);
  return pagePath(...parts);
}

export const isMain = (url) =>
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
