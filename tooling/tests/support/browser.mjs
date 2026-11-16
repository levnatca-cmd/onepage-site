import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export const qaBaseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
export const requireQa = createRequire(
  resolve(process.env.QA_RUNTIME || "/private/tmp/onepage-uiux-qa-runtime", "package.json"),
);
export const { PNG } = requireQa("pngjs");

export function launchQaBrowser() {
  const { chromium } = requireQa("playwright");
  return chromium.launch({
    executablePath:
      process.env.QA_CHROME || "/Applications/Google Chrome 4.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
}

export function changedPixels(first, second) {
  const before = PNG.sync.read(first);
  const after = PNG.sync.read(second);
  assert.equal(before.width, after.width);
  assert.equal(before.height, after.height);
  let changed = 0;
  let samples = 0;
  for (let i = 0; i < before.data.length; i += 64) {
    const difference =
      Math.abs(before.data[i] - after.data[i]) +
      Math.abs(before.data[i + 1] - after.data[i + 1]) +
      Math.abs(before.data[i + 2] - after.data[i + 2]);
    if (difference > 25) changed += 1;
    samples += 1;
  }
  return changed / samples;
}
