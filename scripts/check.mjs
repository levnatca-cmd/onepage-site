import { spawnSync } from "node:child_process";
import { projectPath, ROOT } from "./lib/paths.mjs";

for (const file of [
  "tests/repository.mjs",
  "tests/galaxy/scene-contract-check.mjs",
  "tests/starworld/check.mjs",
  "tests/content/check.mjs",
  "tests/studio/check.mjs",
  "tests/system-lab/check.mjs",
]) {
  const result = spawnSync(process.execPath, [projectPath(file)], { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
