import { spawnSync } from "node:child_process";
import { projectPath, ROOT } from "../scripts/lib/paths.mjs";

for (const file of [
  "tests/verification/repository.mjs",
  "tests/verification/galaxy.mjs",
  "tests/verification/starworld.mjs",
  "tests/verification/content.mjs",
  "tests/unit/start.test.mjs",
  "tests/verification/studio.mjs",
  "tests/unit/system-lab.mjs",
]) {
  const result = spawnSync(process.execPath, [projectPath(file)], { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
