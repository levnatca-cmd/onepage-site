import { copyFileSync, mkdirSync } from "node:fs";
import { projectPath, isMain } from "./lib/paths.mjs";

// Synchronize local packaging files only. Upload/deployment is a separate action.
export function packageStarworld() {
  const output = projectPath("deploy/starworld");
  mkdirSync(`${output}/dist`, { recursive: true });
  for (const target of ["index.html", "dist/index.html"]) {
    copyFileSync(projectPath("starworld.html"), `${output}/${target}`);
  }
  console.log("Synchronized deploy/starworld local HTML copies.");
}
if (isMain(import.meta.url)) packageStarworld();
