// Audit-only browser harness. Dependencies may live outside the product repository.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { launchQaBrowser, PNG, qaBaseUrl as base, requireQa } from "../support/browser.mjs";

const { default: AxeBuilder } = requireQa("@axe-core/playwright");
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
const browser = await launchQaBrowser();

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

  await flow("galaxy-direct-services", async (page) => {
    const start = new URL("/explore.html?layout=planets&focus=hardware#project-quiz", base);
    await page.goto(start.href, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
    await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
    await page.waitForURL((url) => url.hash === "#services");
    const serviceLinks = page.locator(".galaxy-service-links [data-galaxy-service-link]");
    assert.equal(await serviceLinks.count(), 7);
    assert.equal(await page.locator(".galaxy-hero.is-3d-mode, .is-quiz-transitioning").count(), 0);
    assert.equal(
      await page
        .locator("[data-start-3d], #quiz-console, #fingerprint-form, #result-title")
        .count(),
      0,
    );
    const hardware = serviceLinks.filter({ hasText: "Hardware" });
    await hardware.click();
    await page.waitForURL((url) => url.pathname === "/services/hardware/");
    await page.locator("[data-galaxy-return]").first().click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/explore.html" &&
        url.searchParams.get("layout") === "planets" &&
        url.searchParams.get("focus") === "hardware",
    );
    await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
    return { services: 7, preservedLayout: true, preservedFocus: true };
  });

  await flow("galaxy-service-preview", async (page) => {
    const records = [];
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(base + "/explore.html#service-preview", { waitUntil: "domcontentloaded" });
      const preview = page.locator("#service-preview");
      const scenario = preview.locator('[data-scenario="apiLatency"]');
      await scenario.click();
      assert.equal(await scenario.getAttribute("aria-pressed"), "true");
      const scale = preview.locator("#scale-slider");
      await scale.press("End");
      assert.equal(await scale.inputValue(), "3");
      assert.equal(await preview.locator("#scale-readout").innerText(), "Launch");
      await preview.locator("[data-reset]").click();
      assert.equal(await scenario.getAttribute("aria-pressed"), "false");
      assert.equal(await scale.inputValue(), "0");
      assert.equal(new URL(page.url()).hash, "#service-preview");
      await page.screenshot({
        path: resolve(output, `galaxy-service-preview-${width}.png`),
        animations: "disabled",
      });
      const scan = await new AxeBuilder({ page }).include("#service-preview").analyze();
      records.push({
        width,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        violations: scan.violations.map((violation) => violation.id),
      });
    }
    return records;
  });

  await flow("galaxy-contact", async (page) => {
    await page.goto(base + "/explore.html?layout=planets&focus=hardware#contact");
    const notes = "Synthetic QA note about an existing project and the help it needs.";
    await page.locator("#contact-message").fill(notes);
    const validation = await page.locator("#contact-message").evaluate((field) => ({
      required: field.required,
      minLength: field.minLength,
      describedBy: field.getAttribute("aria-describedby"),
      formAction: field.form.getAttribute("action"),
      emailRequired: field.form.elements.email.required,
    }));
    const protectedSubmitEnabled = await page.locator("#contact-send").isEnabled();
    assert.equal(validation.formAction, "/api/inquiries");
    assert.equal(validation.required, true);
    assert.equal(validation.emailRequired, true);
    assert.ok(validation.minLength >= 20);
    assert.ok(validation.describedBy);
    assert.doesNotMatch(await page.locator("#contact-hint").innerText(), /quiz|questionnaire/i);
    if (base.startsWith("http:")) assert.equal(protectedSubmitEnabled, false);
    assert.equal(await page.locator("#contact-message").inputValue(), notes);
    return { validation, protectedSubmitEnabled };
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
    await page.locator("#brief-email").fill("qa@example.test");
    const formTarget = await page.locator("#brief-form").getAttribute("action");
    const protectedSubmitEnabled = await page.locator("#brief-send").isEnabled();
    if (formTarget !== "/api/inquiries" || (base.startsWith("http:") && protectedSubmitEnabled))
      throw new Error("Starworld inquiry must use the protected same-origin endpoint");
    const legacyKey = "systems-project-brief:v1";
    if (await page.evaluate((key) => sessionStorage.getItem(key) !== null, legacyKey))
      throw new Error("Starworld persisted a plaintext draft");
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
    await page.locator("#brief-items button").first().click();
    const afterRemove = {
      items: await page.locator("#brief-items strong").allTextContents(),
      notes: await page.locator("#brief-notes").inputValue(),
      focus: await active(page),
    };
    await page.keyboard.press("Escape");
    const restoredFocus = await active(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-brief").click();
    const reopened = {
      items: await page.locator("#brief-items strong").allTextContents(),
      notes: await page.locator("#brief-notes").inputValue(),
    };
    if (reopened.items.length || reopened.notes)
      throw new Error("Starworld unexpectedly restored a new plaintext draft");
    await page.evaluate(
      ({ key, notes }) =>
        sessionStorage.setItem(key, JSON.stringify({ services: [1, 5, 6], notes })),
      { key: legacyKey, notes },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-brief").click();
    const migrated = {
      items: await page.locator("#brief-items strong").allTextContents(),
      notes: await page.locator("#brief-notes").inputValue(),
      stored: await page.evaluate((key) => sessionStorage.getItem(key) !== null, legacyKey),
    };
    if (migrated.items.length !== 3 || migrated.notes !== notes || migrated.stored)
      throw new Error("Starworld did not clear the legacy draft after loading it");
    return {
      pixels,
      items,
      notes,
      formTarget,
      protectedSubmitEnabled,
      download: download.suggestedFilename(),
      keyboardFocus,
      restoredFocus,
      reopened,
      migrated,
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
        if (name === "galaxy") {
          await page.locator(".galaxy-hero.webgl-failed").waitFor();
          const services = page.locator(".galaxy-service-links [data-galaxy-service-link]");
          assert.equal(await services.count(), 7);
          assert.equal(await page.locator("[data-start-3d], #fingerprint-form").count(), 0);
          await page.screenshot({ path: resolve(output, `${name}-fallback.png`), timeout: 30000 });
          await services.filter({ hasText: "Hardware" }).click();
          await page.waitForURL((url) => url.pathname === "/services/hardware/");
          return { services: 7, destination: new URL(page.url()).pathname };
        }
        await page.screenshot({ path: resolve(output, `${name}-fallback.png`) });
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
      if (name === "galaxy") {
        await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
        await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
      }
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
