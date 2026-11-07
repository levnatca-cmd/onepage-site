// Audit-only browser harness. Dependencies may live outside the product repository.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "./lib/paths.mjs";

const runtime = process.env.QA_RUNTIME || "/private/tmp/onepage-uiux-qa-runtime";
const require = createRequire(resolve(runtime, "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const { PNG } = require("pngjs");
const base = process.env.QA_BASE_URL || "http://127.0.0.1:4173";
const output = resolve(ROOT, "artifacts/qa/uiux-2026-11-05");
const resultFile = process.env.QA_FLOW_FILTER
  ? `flows-${process.env.QA_FLOW_FILTER.replace(/[^a-z0-9-]/gi, "")}.json`
  : process.env.QA_FLOWS_ONLY
    ? "flows.json"
    : "results.json";
const preflight = await fetch(base, { signal: AbortSignal.timeout(5000) });
if (!preflight.ok) throw new Error(`QA server unavailable: ${preflight.status} at ${base}`);
await mkdir(output, { recursive: true });
const results = {
  date: "2026-11-05",
  base,
  rendering: "Chromium, software WebGL, emulated viewports",
  pages: [],
  flows: [],
};
const { QUESTION_FLOW, SCORE_MAP } = await import(resolve(ROOT, "src/galaxy/js/data/quiz-data.js"));
const outcomeCounts = { handoff: 0, ghost: 0, spreadsheet: 0, bench: 0, hardware: 0, ops: 0 };
function countOutcomes(index, answers) {
  if (index < QUESTION_FLOW.length) {
    for (const choice of QUESTION_FLOW[index].choices)
      countOutcomes(index + 1, [...answers, choice.value]);
    return;
  }
  const scores = Object.fromEntries(Object.keys(outcomeCounts).map((key) => [key, 0]));
  for (const answer of answers)
    for (const [key, score] of Object.entries(SCORE_MAP[answer] || {})) scores[key] += score;
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  outcomeCounts[winner] += 1;
}
countOutcomes(0, []);
results.classification = {
  combinations: Object.values(outcomeCounts).reduce((a, b) => a + b, 0),
  outcomeCounts,
};
const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROME || "/Applications/Google Chrome 4.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

function pixelSummary(buffer) {
  const { data, width, height } = PNG.sync.read(buffer);
  const colors = new Set();
  let nonDark = 0;
  for (let i = 0; i < data.length; i += 64) {
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 45) nonDark += 1;
    colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
  }
  return {
    width,
    height,
    sampledColors: colors.size,
    nonDarkFraction: nonDark / (data.length / 64),
  };
}

try {
  if (!process.env.QA_FLOWS_ONLY) {
    for (const [name, path] of [
      ["galaxy", "/explore.html"],
      ["starworld", "/starworld.html"],
    ]) {
      for (const width of [320, 390, 768, 1440]) {
        const context = await browser.newContext({
          viewport: { width, height: width < 600 ? 844 : 1000 },
          deviceScaleFactor: 1,
          acceptDownloads: true,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const errors = [],
          warnings = [],
          failedRequests = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
          if (m.type() === "warning") warnings.push(m.text());
        });
        page.on("requestfailed", (r) =>
          failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }),
        );
        await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1200);
        const state = await page.evaluate(() => {
          const rect = (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          };
          const visible = (el) => {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el);
            return (
              r.width > 0 &&
              r.height > 0 &&
              s.visibility !== "hidden" &&
              s.display !== "none" &&
              Number(s.opacity) !== 0
            );
          };
          return {
            title: document.title,
            viewport: { width: innerWidth, height: innerHeight },
            overflow: document.documentElement.scrollWidth - innerWidth,
            initError: window.__galaxyInitError || null,
            heroClass: document.querySelector(".galaxy-hero")?.className,
            ctas: [
              ...document.querySelectorAll(".hero-actions button,#add-button,#review-button"),
            ].map((el) => ({ text: el.textContent.trim(), rect: rect(el), visible: visible(el) })),
            smallTargets: [...document.querySelectorAll("button,a,input,select,textarea")]
              .filter(visible)
              .map((el) => ({
                text: (el.getAttribute("aria-label") || el.textContent || el.name)
                  .trim()
                  .slice(0, 80),
                tag: el.tagName,
                ...rect(el),
              }))
              .filter((r) => r.w < 24 || r.h < 24)
              .slice(0, 40),
            clippedText: [...document.querySelectorAll("h1,h2,h3,button,p,label")]
              .filter(visible)
              .filter((el) => el.scrollWidth > el.clientWidth + 2)
              .map((el) => ({
                tag: el.tagName,
                text: el.textContent.trim().slice(0, 100),
                width: el.clientWidth,
                scrollWidth: el.scrollWidth,
              }))
              .slice(0, 30),
            firstViewportText: [...document.querySelectorAll("h1,h2,p")]
              .filter(
                (el) =>
                  visible(el) &&
                  el.getBoundingClientRect().y < innerHeight &&
                  el.getBoundingClientRect().bottom > 0,
              )
              .map((el) => el.textContent.trim()),
            navigation: performance.getEntriesByType("navigation")[0]?.toJSON(),
          };
        });
        await page.screenshot({
          path: resolve(output, `${name}-${width}.png`),
          animations: "disabled",
        });
        let canvasPixels = null;
        const canvas = page.locator("canvas").first();
        if (await canvas.count()) {
          canvasPixels = pixelSummary(await canvas.screenshot({ timeout: 15000 }));
          await page.waitForTimeout(300);
          canvasPixels.secondFrame = pixelSummary(await canvas.screenshot({ timeout: 15000 }));
        }
        let accessibility = null;
        if (width === 390 || width === 1440) {
          const scan = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          accessibility = {
            violations: scan.violations.map(({ id, impact, description, help, nodes }) => ({
              id,
              impact,
              description,
              help,
              nodes: nodes.map(({ target, html, failureSummary }) => ({
                target,
                html,
                failureSummary,
              })),
            })),
            incomplete: scan.incomplete.map(({ id, nodes }) => ({ id, count: nodes.length })),
            passes: scan.passes.length,
          };
        }
        const record = {
          name,
          path,
          width,
          state,
          canvasPixels,
          errors,
          warnings,
          failedRequests,
          accessibility,
        };
        results.pages.push(record);
        await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
        console.log(
          JSON.stringify({
            name,
            width,
            overflow: state.overflow,
            errors: errors.length,
            violations: accessibility?.violations.map((v) => `${v.id}:${v.nodes.length}`),
            pixels: canvasPixels?.sampledColors,
          }),
        );
        await context.close();
      }
    }
  }
  async function flow(name, action, options = {}) {
    if (process.env.QA_FLOW_FILTER && !name.includes(process.env.QA_FLOW_FILTER)) return;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      acceptDownloads: true,
      ...options,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      const data = await action(page, context);
      results.flows.push({ name, completed: true, data, errors });
    } catch (error) {
      results.flows.push({ name, completed: false, error: error.message, errors });
      await page.screenshot({ path: resolve(output, `${name}-failure.png`) }).catch(() => {});
    } finally {
      await context.close();
      await writeFile(resolve(output, resultFile), JSON.stringify(results, null, 2));
      console.log(JSON.stringify(results.flows.at(-1)));
    }
  }
  const active = (page) =>
    page.evaluate(() => ({
      id: document.activeElement?.id,
      text: document.activeElement?.textContent?.trim().slice(0, 120),
      top: document.activeElement?.getBoundingClientRect().top,
      scrollY,
    }));
  const webglPixels = (page) =>
    page.evaluate(
      () =>
        new Promise((resolvePixels) =>
          requestAnimationFrame(() => {
            const canvas = document.querySelector("canvas");
            const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
            if (!gl) return resolvePixels({ available: false });
            const sample = new Uint8Array(4),
              colors = new Set();
            let visible = 0;
            for (let y = 1; y < 12; y += 1)
              for (let x = 1; x < 20; x += 1) {
                gl.readPixels(
                  Math.floor((canvas.width * x) / 20),
                  Math.floor((canvas.height * y) / 12),
                  1,
                  1,
                  gl.RGBA,
                  gl.UNSIGNED_BYTE,
                  sample,
                );
                colors.add([...sample].join(","));
                if (sample[3] && Math.max(sample[0], sample[1], sample[2]) > 20) visible += 1;
              }
            resolvePixels({
              available: true,
              distinctSamples: colors.size,
              visibleSamples: visible,
              totalSamples: 209,
            });
          }),
        ),
    );

  await flow("galaxy-3d", async (page) => {
    await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
    const pixels = await webglPixels(page);
    await page.locator(".hero-actions [data-start-3d]").click();
    const duringLaunch = await page.locator(".galaxy-hero").getAttribute("class");
    await page.locator(".galaxy-hero.is-3d-mode").waitFor();
    await page.locator(".hero-copy").waitFor({ state: "hidden" });
    await page.waitForTimeout(1000);
    const startFocus = await active(page);
    await page.screenshot({ path: resolve(output, "galaxy-3d-question.png") });
    await page.locator('[data-choice-index="3"]').click();
    await page.waitForFunction(
      () => document.querySelector("#choice-options").dataset.questionId === "q2",
    );
    await page.locator("#choice-back").click();
    const backFocus = await active(page);
    const previousQuestion = await page.locator("#choice-question").innerText();
    const selections = [3, 0, 1, 0, 3];
    for (let i = 0; i < selections.length; i += 1) {
      await page.waitForFunction(
        (q) => document.querySelector("#choice-options").dataset.questionId === q,
        "q" + (i + 1),
      );
      await page.locator(`[data-choice-index="${selections[i]}"]`).click();
      if (i < 4)
        await page.waitForFunction(
          (q) => document.querySelector("#choice-options").dataset.questionId === q,
          "q" + (i + 2),
        );
    }
    await page.waitForTimeout(4200);
    const finish = await page.evaluate(() => ({
      hero: document.querySelector(".galaxy-hero").className,
      name: document.querySelector("#archetype-name").textContent,
      score: document.querySelector("#hero-score").textContent,
      badge: document.querySelector("#badge-code").textContent,
      resultTop: document.querySelector("#result").getBoundingClientRect().top,
      activeId: document.activeElement?.id,
      activeText: document.activeElement?.textContent.slice(0, 100),
      activeTop: document.activeElement?.getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    await page.screenshot({ path: resolve(output, "galaxy-3d-result.png") });
    await page.locator("[data-exit-3d]").click();
    await page.waitForTimeout(150);
    return {
      pixels,
      duringLaunch,
      startFocus,
      previousQuestion,
      backFocus,
      finish,
      exitFocus: await active(page),
    };
  });

  await flow("settled-questions", async (page) => {
    const records = [];
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
      await page.locator(".hero-actions [data-start-3d]").click();
      await page.locator(".galaxy-hero.is-3d-mode").waitFor();
      await page.locator(".hero-copy").waitFor({ state: "hidden" });
      await page.waitForTimeout(1300);
      await page.screenshot({
        path: resolve(output, `galaxy-question-settled-${width}.png`),
        animations: "disabled",
      });
      const snapshot = await page.evaluate(() => ({
        heroVisibility: getComputedStyle(document.querySelector(".hero-copy")).visibility,
        hud: document.querySelector("#choice-hud").getBoundingClientRect().toJSON(),
        focus: document.activeElement?.textContent.trim(),
        options: [...document.querySelectorAll(".choice-option")].map((b) => ({
          text: b.textContent,
          rect: b.getBoundingClientRect().toJSON(),
          topElement: document
            .elementFromPoint(b.getBoundingClientRect().x + 10, b.getBoundingClientRect().y + 10)
            ?.closest("button")?.textContent,
        })),
      }));
      const scan = await new AxeBuilder({ page }).analyze();
      records.push({
        width,
        snapshot,
        violations: scan.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map((n) => n.target),
        })),
      });
    }
    return records;
  });

  await flow("galaxy-form", async (page) => {
    await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
    const choices = ["hardware", "hardwareFirmware", "devices", "logs", "hardwareCare"];
    for (let i = 0; i < choices.length; i += 1)
      await page.locator(`input[name="q${i + 1}"][value="${choices[i]}"]`).check();
    const complete = await page.locator("#completion-status").innerText();
    const email = new URL(await page.locator("#email-map").getAttribute("href"));
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-download="md"]').click();
    const download = await downloadPromise;
    const downloadPath = resolve(output, "galaxy-result.md");
    await download.saveAs(downloadPath);
    await page.locator("[data-scroll-result]").click();
    await page.waitForTimeout(2600);
    const revealed = await page.locator("#reveal-score").innerText();
    const beforeReload = await page.locator("#archetype-name").innerText();
    await page.reload({ waitUntil: "networkidle" });
    const afterReload = {
      completion: await page.locator("#completion-status").innerText(),
      name: await page.locator("#archetype-name").innerText(),
      checked: await page.locator("input[type=radio]:checked").count(),
    };
    for (let i = 0; i < choices.length; i += 1)
      await page.locator(`input[name="q${i + 1}"][value="${choices[i]}"]`).check();
    page.once("dialog", (d) => d.dismiss());
    await page.locator("[data-reset]").click();
    const cancelReset = await page.locator("#completion-status").innerText();
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-reset]").click();
    return {
      complete,
      emailRecipient: email.pathname,
      emailBody: email.searchParams.get("body"),
      download: download.suggestedFilename(),
      revealed,
      beforeReload,
      afterReload,
      cancelReset,
      afterReset: await page.locator("#completion-status").innerText(),
    };
  });

  await flow("galaxy-recommendation-integrity", async (page) => {
    await page.goto(base + "/explore.html", { waitUntil: "networkidle" });
    for (const [q, value] of [
      ["q1", "automation"],
      ["q2", "businessAutomation"],
      ["q3", "manual"],
      ["q4", "retry"],
      ["q5", "manualOps"],
    ])
      await page.locator(`input[name="${q}"][value="${value}"]`).check();
    const snapshot = () =>
      page.evaluate(() => ({
        name: document.querySelector("#archetype-name").textContent,
        email: document.querySelector("#email-map").getAttribute("href"),
        checked: [...document.querySelectorAll("input[type=radio]:checked")].map((e) => e.value),
        score: document.querySelector("#hero-score").textContent,
      }));
    const before = await snapshot();
    await page.locator('[data-scenario="manualWorkflow"]').click();
    const after = await snapshot();
    await page.screenshot({ path: resolve(output, "galaxy-preview-result-mismatch.png") });
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("QA permission denied")) },
        configurable: true,
      }),
    );
    await page.evaluate(() => {
      document.execCommand = () => false;
    });
    await page.locator('[data-copy="slack"]').click();
    const copyFailureFeedback = await page.locator("#toast").innerText();
    await page.locator("#contact-message").fill("");
    await page.locator('#contact-form button[type="submit"]').click();
    const validation = await page.locator("#contact-message").evaluate((el) => ({
      required: el.required,
      invalid: el.getAttribute("aria-invalid"),
      describedBy: el.getAttribute("aria-describedby"),
      active: document.activeElement === el,
    }));
    return { before, after, copyFailureFeedback, validation };
  });

  await flow("starworld-brief", async (page) => {
    await page.goto(base + "/starworld.html", { waitUntil: "networkidle" });
    const pixels = await webglPixels(page);
    for (const index of [1, 5, 6]) {
      await page.locator(".world-button").nth(index).click();
      await page.locator("#add-button").click();
    }
    await page.locator("#nav-brief").click();
    const notes =
      "QA draft: existing app & API.\nNative iOS + security review. Caf\u00e9 \ud83d\ude80";
    await page.locator("#brief-notes").fill(notes);
    const email = new URL(await page.locator("#email-draft").getAttribute("href"));
    const items = await page.locator("#brief-items strong").allTextContents();
    const keyboardFocus = [];
    await page.locator("#brief-dialog [data-close]").focus();
    await page.keyboard.press("Shift+Tab");
    keyboardFocus.push(await active(page));
    await page.keyboard.press("Tab");
    keyboardFocus.push(await active(page));
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#download-brief").click();
    const download = await downloadPromise;
    await download.saveAs(resolve(output, "starworld-brief.txt"));
    await page.screenshot({ path: resolve(output, "starworld-brief-dialog.png") });
    const axe = await new AxeBuilder({ page }).analyze();
    await page.keyboard.press("Escape");
    const restoredFocus = await active(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-brief").click();
    const restored = {
      items: await page.locator("#brief-items strong").allTextContents(),
      notes: await page.locator("#brief-notes").inputValue(),
    };
    await page.locator("#brief-items button").first().click();
    const afterRemove = {
      items: await page.locator("#brief-items strong").allTextContents(),
      notes: await page.locator("#brief-notes").inputValue(),
      focus: await active(page),
    };
    return {
      pixels,
      items,
      notes,
      emailRecipient: email.pathname,
      emailBody: email.searchParams.get("body"),
      download: download.suggestedFilename(),
      keyboardFocus,
      restoredFocus,
      restored,
      afterRemove,
      dialogViolations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target),
      })),
    };
  });

  await flow("starworld-resilience-followup", async (page) => {
    await page.goto(base + "/starworld.html", { waitUntil: "networkidle" });
    await page.locator("#settings-button").click();
    await page.locator("#motion-setting").check();
    await page.locator("#rain-setting").uncheck();
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    const refreshedSettings = await page.evaluate(() => ({
      reduced: document.querySelector("#motion-setting").checked,
      rain: document.querySelector("#rain-setting").checked,
    }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(200);
    const systemMotionChange = await page.locator("#motion-setting").isChecked();
    await page.locator(".world-button").nth(5).click();
    await page.locator("#add-button").click();
    await page.evaluate(() => {
      const c = document.querySelector("canvas"),
        gl = c.getContext("webgl2") || c.getContext("webgl");
      window.qaLossExtension = gl.getExtension("WEBGL_lose_context");
      window.qaLossExtension.loseContext();
    });
    await page.waitForTimeout(350);
    await page.evaluate(() => window.qaLossExtension.restoreContext());
    await page.waitForTimeout(1600);
    await page.locator("#nav-map").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(output, "starworld-restored.png") });
    const restoredPixels = pixelSummary(await page.locator("canvas").screenshot());
    return {
      refreshedSettings,
      systemMotionChange,
      restoredBriefCount: await page.locator("#nav-brief-count").innerText(),
      restoredPixels,
    };
  });

  for (const [name, path, canvasId] of [
    ["galaxy", "/explore.html", "galaxy-canvas"],
    ["starworld", "/starworld.html", "universe"],
  ]) {
    await flow(
      `${name}-fallback`,
      async (page) => {
        await page.addInitScript(() => {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
          };
        });
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.screenshot({ path: resolve(output, `${name}-fallback.png`) });
        if (name === "galaxy") {
          await page.locator(".hero-actions [data-start-3d]").click();
          await page.waitForTimeout(1200);
          await page.locator('input[name="q1"][value="hardware"]').check();
          return {
            focus: await active(page),
            completion: await page.locator("#completion-status").innerText(),
            hero: await page.locator(".galaxy-hero").getAttribute("class"),
          };
        }
        await page.locator(".world-button").nth(5).click();
        await page.locator("#add-button").click();
        await page.locator("#nav-brief").click();
        return {
          fallbackVisible: await page.locator("#fallback").isVisible(),
          items: await page.locator("#brief-items strong").allTextContents(),
          disabledMapTools: await page.locator(".map-tools button:disabled").count(),
        };
      },
      { viewport: { width: 390, height: 844 } },
    );

    await flow(`${name}-context-loss`, async (page) => {
      await page.goto(base + path, { waitUntil: "networkidle" });
      if (name === "galaxy") await page.locator('input[name="q1"][value="hardware"]').check();
      const progressBefore =
        name === "galaxy" ? await page.locator("#completion-status").innerText() : null;
      const supported = await page.evaluate((id) => {
        const canvas = document.getElementById(id),
          gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        window.qaLossExtension = gl?.getExtension("WEBGL_lose_context");
        window.qaLossExtension?.loseContext();
        return Boolean(window.qaLossExtension);
      }, canvasId);
      await page.waitForTimeout(500);
      const lost = await page.evaluate(() => ({
        hero: document.querySelector(".galaxy-hero")?.className,
        fallbackHidden: document.querySelector("#fallback")?.hidden,
        disabled: document.querySelector("#zoom-in")?.disabled,
      }));
      await page.evaluate(() => window.qaLossExtension?.restoreContext());
      await page.waitForTimeout(1800);
      return {
        supported,
        lost,
        progressBefore,
        progressAfter:
          name === "galaxy" ? await page.locator("#completion-status").innerText() : null,
        restored: await webglPixels(page),
        restoredState: await page.evaluate(() => ({
          hero: document.querySelector(".galaxy-hero")?.className,
          fallbackHidden: document.querySelector("#fallback")?.hidden,
          disabled: document.querySelector("#zoom-in")?.disabled,
        })),
      };
    });

    await flow(
      `${name}-text-motion`,
      async (page) => {
        await page.goto(base + path, { waitUntil: "networkidle" });
        const originalHeading = await page
          .locator("h1")
          .evaluate((e) => getComputedStyle(e).fontSize);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "32px";
        });
        await page.screenshot({ path: resolve(output, `${name}-text-200.png`) });
        const enlarged = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          heading: getComputedStyle(document.querySelector("h1")).fontSize,
          clipped: [...document.querySelectorAll("h1,h2,p,button,label")]
            .filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 5)
            .map((e) => e.textContent.trim().slice(0, 80)),
        }));
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "";
        });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const livePreference = await page.evaluate(() => ({
          matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
          checked: document.querySelector("#motion-setting")?.checked,
          runningAnimations: document.getAnimations().filter((a) => a.playState === "running")
            .length,
        }));
        return { originalHeading, enlarged, livePreference };
      },
      { viewport: { width: 320, height: 844 } },
    );
  }
} finally {
  await writeFile(resolve(output, resultFile), JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.flows.some((f) => !f.completed)) process.exitCode = 1;
