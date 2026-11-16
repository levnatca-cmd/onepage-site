import { spawnSync } from "node:child_process";
import { projectPath, ROOT } from "../scripts/lib/paths.mjs";

for (const file of [
  "tooling/tests/verification/repository.mjs",
  "tooling/tests/verification/galaxy.mjs",
  "tooling/tests/verification/content.mjs",
  "tooling/tests/unit/start.test.mjs",
  "tooling/tests/verification/studio.mjs",
  "tooling/tests/unit/system-lab.mjs",
]) {
  const result = spawnSync(process.execPath, [projectPath(file)], { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
