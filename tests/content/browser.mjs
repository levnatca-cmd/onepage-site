import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { QUESTION_FLOW, ARCHETYPES } from "../../src/galaxy/js/data/quiz-data.js";

const runtime = process.env.QA_RUNTIME || "/private/tmp/onepage-uiux-qa-runtime";
const require = createRequire(resolve(runtime, "package.json"));
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const base = process.env.QA_BASE_URL || "http://127.0.0.1:4175";
const output = resolve(ROOT, "artifacts/qa/content-update-2026-11-05");
await mkdir(output, { recursive: true });
assert.ok(
  (await fetch(base + "/explore.html", { signal: AbortSignal.timeout(5000) })).ok,
  "Start the preview server before browser checks.",
);
const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROME || "/Applications/Google Chrome 4.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
const screenshot = (page, name) =>
  page.screenshot({ path: resolve(output, name + ".png"), animations: "disabled" });
function pixelColors(buffer) {
  const { data } = PNG.sync.read(buffer);
  const colors = new Set();
  for (let i = 0; i < data.length; i += 128)
    colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
  return colors.size;
}
async function check(name, action, options = {}) {
  if (process.env.QA_CONTENT_FILTER && !name.includes(process.env.QA_CONTENT_FILTER)) return;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      window.qaCopies = [];
      window.qaShares = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.qaCopies.push(value);
          },
        },
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.qaShares.push(data);
        },
      });
    });
    const details = await action(page);
    assert.deepEqual(errors, [], "Unexpected browser exception");
    results.push({ name, passed: true, details, errors });
    console.log(`PASS browser content: ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.stack, errors });
    await screenshot(page, name + "-failure").catch(() => {});
    console.error(`FAIL browser content: ${name}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await writeFile(
      resolve(output, process.env.QA_CONTENT_FILTER ? "followup-results.json" : "results.json"),
      JSON.stringify(results, null, 2),
    );
  }
}

try {
  for (const width of [320, 390, 1440]) {
    for (const [name, path] of [
      ["galaxy", "/explore.html"],
      ["starworld", "/starworld.html"],
    ]) {
      await check(
        `${name}-${width}`,
        async (page) => {
          await page.goto(base + path, { waitUntil: "networkidle" });
          await page.waitForTimeout(900);
          const state = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            heading: document.querySelector("h1").textContent.trim(),
            initError: window.__galaxyInitError || null,
            activeWebGL: document.querySelector(".galaxy-hero")?.classList.contains("webgl-ready"),
            fallbackHidden: document.querySelector("#fallback")?.hidden,
            clippedControls: [...document.querySelectorAll("button,a.btn")]
              .filter(
                (el) =>
                  el.getClientRects().length &&
                  getComputedStyle(el).visibility !== "hidden" &&
                  el.scrollWidth > el.clientWidth + 8,
              )
              .map((el) => el.textContent.trim()),
          }));
          assert.equal(state.overflow, 0);
          assert.match(state.heading, /websites\s*&\s*apps/i);
          assert.equal(state.initError, null);
          assert.equal(name === "galaxy" ? state.activeWebGL : state.fallbackHidden, true);
          assert.deepEqual(state.clippedControls, []);
          await screenshot(page, `${name}-${width}`);
          const canvas = page.locator("canvas").first();
          const colors = pixelColors(await canvas.screenshot());
          assert.ok(colors > 10, "Rendered canvas should contain visible visual detail");
          if (name === "galaxy") {
            assert.equal(
              (await page.locator("#contact-send").textContent()).trim(),
              "Open email draft",
            );
            assert.match(await page.locator("#mission-combo").textContent(), /0 of 5 answered/);
          } else {
            await page.locator("#nav-brief").click();
            await page.locator("#brief-notes").fill("A new website and hardware/software support.");
            const email = new URL(await page.locator("#email-draft").getAttribute("href"));
            assert.match(
              email.searchParams.get("body"),
              /new website and hardware\/software support/,
            );
            assert.equal(
              await page.locator("#brief-dialog").evaluate((el) => el.scrollWidth - el.clientWidth),
              0,
            );
            await screenshot(page, `starworld-brief-${width}`);
          }
          return { ...state, canvasSampledColors: colors };
        },
        { viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce" },
      );
    }
  }

  await check("galaxy-output-consistency", async (page) => {
    await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
    await page.locator("[data-share]").first().click();
    assert.doesNotMatch(
      await page.evaluate(() => window.qaShares[0].text),
      /I explored|scored|100\/100/,
    );
    const choices = ["firmware", "crossStack", "users", "patch", "map"];
    for (const [i, value] of choices.entries())
      await page.locator(`input[name="q${i + 1}"][value="${value}"]`).check();
    await page.waitForTimeout(2400);
    assert.equal(await page.locator("#archetype-name").innerText(), ARCHETYPES.ghost.name);
    assert.equal(await page.locator("#hero-combo").textContent(), "5");
    const notes = "A new website & portal.\nCaf\u00e9 \ud83d\ude80 and a device integration.";
    await page.locator("#contact-message").fill(notes);
    const summary = await page.locator("#slack-message").innerText();
    assert.ok(summary.includes(notes));
    for (const [i, value] of choices.entries()) {
      const choice = QUESTION_FLOW[i].choices.find((item) => item.value === value);
      assert.ok(summary.includes(QUESTION_FLOW[i].prompt));
      assert.ok(summary.includes(choice.label));
    }
    assert.match(summary, /5 \/ 5 answered \(completion only\)/);
    assert.doesNotMatch(summary, /Signal score|System stability|100\/100/);
    const emailBefore = await page.locator("#email-map").getAttribute("href");
    const email = new URL(emailBefore);
    assert.equal(email.pathname, "info@levnat.ca");
    assert.ok(email.searchParams.get("body").includes(summary));
    assert.match(email.searchParams.get("body"), /CAD \$500.*90 minutes/);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-download="md"]').click();
    const download = await downloadPromise;
    const downloadPath = resolve(output, "project-summary.md");
    await download.saveAs(downloadPath);
    assert.ok((await readFile(downloadPath, "utf8")).includes(summary));
    await page.locator("#contact-copy").click();
    assert.ok((await page.evaluate(() => window.qaCopies.at(-1))).includes(summary));
    await page.locator("[data-share]").first().click();
    const shared = await page.evaluate(() => window.qaShares.at(-1));
    assert.match(shared.text, /5 of 5 questions answered/);
    assert.doesNotMatch(shared.text, /scored|Legend|100\/100/);
    for (const id of ["firmwareFail", "apiLatency", "noMonitoring", "manualWorkflow"]) {
      await page.locator(`[data-scenario="${id}"]`).click();
      assert.equal(await page.locator("#archetype-name").innerText(), ARCHETYPES.ghost.name);
      assert.equal(await page.locator("#email-map").getAttribute("href"), emailBefore);
    }
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("Denied by QA")) },
      });
      document.execCommand = () => false;
    });
    await page.locator('[data-copy="slack"]').click();
    assert.match(await page.locator("#toast").innerText(), /Copy unavailable/);
    return {
      recommendation: ARCHETYPES.ghost.name,
      answers: choices.length,
      previewInvariant: true,
      download: download.suggestedFilename(),
      shared,
    };
  });

  await check(
    "galaxy-3d-wording",
    async (page) => {
      await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
      await page.locator(".hero-actions [data-start-3d]").click();
      await page.locator(".galaxy-hero.is-3d-mode").waitFor();
      await page.locator(".hero-copy").waitFor({ state: "hidden" });
      for (let i = 0; i < 2; i += 1) {
        const question = QUESTION_FLOW[i];
        assert.equal(await page.locator("#choice-question").innerText(), question.prompt);
        assert.deepEqual(
          await page.locator(".choice-option").allTextContents(),
          question.choices.map((c) => c.label),
        );
        if (!i) {
          await page.locator('[data-choice-index="0"]').click();
          await page.waitForFunction(
            () => document.querySelector("#choice-options").dataset.questionId === "q2",
          );
        }
      }
      await page.waitForTimeout(600);
      await screenshot(page, "galaxy-3d-wording");
      await page.locator("[data-exit-3d]").click();
      return { promptsMatch: true, labelsMatch: true };
    },
    { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
  );
} finally {
  await browser.close();
}
