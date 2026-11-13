import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { launchQaBrowser, PNG, qaBaseUrl as base } from "../support/browser.mjs";

const output = resolve(ROOT, "artifacts/qa/content-update-2026-11-05");
await mkdir(output, { recursive: true });
assert.ok(
  (await fetch(base + "/explore.html", { signal: AbortSignal.timeout(5000) })).ok,
  "Start the preview server before browser checks.",
);
const browser = await launchQaBrowser();
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
async function assertQuizInactive(page) {
  assert.equal(
    await page.locator("[data-start-3d], #quiz-console, #fingerprint-form, #result-title").count(),
    0,
  );
  assert.equal(await page.locator(".is-3d-mode, .is-quiz-transitioning").count(), 0);
}

async function check(name, action, options = {}) {
  if (process.env.QA_CONTENT_FILTER && !name.includes(process.env.QA_CONTENT_FILTER)) return;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  try {
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
              "Send inquiry",
            );
            assert.equal(await page.locator("#services a[data-galaxy-service-link]").count(), 7);
            await assertQuizInactive(page);
          } else {
            await page.locator("#nav-brief").click();
            await page.locator("#brief-notes").fill("A new website and hardware/software support.");
            assert.equal(
              await page.locator("#brief-form").getAttribute("action"),
              "/api/inquiries",
            );
            if (new URL(base).protocol === "http:") {
              assert.ok(await page.locator("#brief-send").isDisabled());
            }
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

  await check("galaxy-contact-submits-only-entered-notes", async (page) => {
    const origin = "https://galaxy.test";
    const notes = "A new website & portal.\nCafé 🚀 and a device integration.";
    const email = "qa@example.test";
    await page.route(origin + "/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/inquiries/ready") {
        await route.fulfill({
          status: 204,
          headers: { "X-Inquiry-Transport": "strict-pqc-v1" },
        });
        return;
      }
      if (url.pathname === "/api/inquiries") {
        await route.fulfill({ status: 201, json: { id: request.headers()["idempotency-key"] } });
        return;
      }
      const response = await route.fetch({ url: new URL(url.pathname + url.search, base).href });
      await route.fulfill({ response });
    });

    await page.goto(origin + "/explore.html?forceFallback=1#contact");
    const form = page.locator("#contact-form");
    const submit = form.locator('button[type="submit"]');
    const hint = await page.locator("#contact-hint").innerText();
    assert.doesNotMatch(hint, /quiz|questionnaire|answers/i);
    assert.equal(await form.getAttribute("action"), "/api/inquiries");
    await form.locator('[name="email"]').fill(email);
    await form.locator('[name="description"]').fill(notes);
    const [request] = await Promise.all([
      page.waitForRequest(
        (candidate) =>
          candidate.url() === origin + "/api/inquiries" && candidate.method() === "POST",
      ),
      submit.click(),
    ]);
    const body = request.postDataJSON();
    assert.equal(body.email, email);
    assert.equal(body.description, notes);
    assert.equal(body.service, "unsure");
    await page.locator("#contact-status").filter({ hasText: "Inquiry received." }).waitFor();
    return { protectedEndpoint: true, exactDescription: true, defaultService: body.service };
  });

  await check(
    "galaxy-mobile-render-lifecycle",
    async (page) => {
      await page.goto(base + "/explore.html?layout=planets", { waitUntil: "load" });
      await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
      await page.evaluate(async () => {
        const entry = [...document.scripts].find((script) =>
          script.src.includes("/galaxy/js/main.js"),
        );
        const version = new URL(entry.src).searchParams.get("v");
        const { galaxy } = await import("/src/galaxy/js/state.js?v=" + version);
        const sample = { galaxy, renders: 0 };
        const render = galaxy.renderer.render;
        galaxy.renderer.render = function (...args) {
          sample.renders += 1;
          return render.apply(this, args);
        };
        window.__sceneLifecycleQa = sample;
        document.querySelector(".galaxy-stage").style.minHeight = "460px";
      });
      await page.waitForFunction(() => {
        const { renderer, camera } = window.__sceneLifecycleQa.galaxy;
        const canvas = renderer.domElement;
        const ratio = renderer.getPixelRatio();
        return (
          canvas.clientHeight === 460 &&
          Math.abs(canvas.width - canvas.clientWidth * ratio) <= 1 &&
          Math.abs(canvas.height - canvas.clientHeight * ratio) <= 1 &&
          Math.abs(camera.aspect - canvas.clientWidth / canvas.clientHeight) < 0.001
        );
      });
      await page.evaluate(() => {
        document.querySelector(".galaxy-stage").style.removeProperty("min-height");
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
      });
      await page.waitForFunction(() => !window.__sceneLifecycleQa.galaxy.clock.running);
      const suspended = await page.evaluate(() => ({
        renders: window.__sceneLifecycleQa.renders,
        elapsed: window.__sceneLifecycleQa.galaxy.clock.elapsedTime,
      }));
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() => ({
          renders: window.__sceneLifecycleQa.renders,
          elapsed: window.__sceneLifecycleQa.galaxy.clock.elapsedTime,
        })),
        suspended,
        "The offscreen scene must stop rendering and preserve animation time",
      );
      await page.locator("#galaxy-canvas").scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (previous) =>
          window.__sceneLifecycleQa.galaxy.clock.running &&
          window.__sceneLifecycleQa.renders > previous,
        suspended.renders,
      );
      return { resizedWithoutWindowEvent: true, suspendedOffscreen: true, resumed: true };
    },
    {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    },
  );

  await check(
    "galaxy-mobile-text-zoom",
    async (page) => {
      await page.goto(base + "/explore.html?layout=planets", { waitUntil: "load" });
      await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
      await page.evaluate(() => {
        const records = [...document.querySelectorAll("body *")]
          .filter(
            (element) =>
              !["SCRIPT", "STYLE", "SVG", "PATH", "I", "CANVAS"].includes(element.tagName) &&
              ([...element.childNodes].some(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
              ) ||
                element.matches("button, input, textarea, select")),
          )
          .map((element) => ({
            element,
            size: parseFloat(getComputedStyle(element).fontSize),
            lineHeight: parseFloat(getComputedStyle(element).lineHeight),
          }));
        for (const { element, size, lineHeight } of records) {
          element.style.setProperty("font-size", `${size * 2}px`, "important");
          if (Number.isFinite(lineHeight))
            element.style.setProperty("line-height", `${lineHeight * 2}px`, "important");
        }
      });
      await page.locator("#galaxy-orbit-toggle").click();
      await page.locator("#galaxy-orbit-done").waitFor({ state: "visible" });
      const clipped = await page.evaluate(() => {
        const selectors =
          ".galaxy-service-links a, .immersion-label, #galaxy-orbit-controls button";
        return [...document.querySelectorAll(selectors)].flatMap((element) => {
          const bounds = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const clippedText = text.left < bounds.left - 1 || text.right > bounds.right + 1;
          return clippedText || bounds.right > innerWidth + 1 || bounds.left < -1
            ? [element.textContent.trim()]
            : [];
        });
      });
      assert.deepEqual(clipped, [], "Enlarged labels and controls must fit their containers");
      await page.locator("#galaxy-orbit-done").click();
      return { textScale: 2, wrappedLabels: true, rotationControlsReachable: true };
    },
    { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  );

  await check(
    "galaxy-quiz-off-keeps-services-accessible",
    async (page) => {
      await page.goto(base + "/explore.html?layout=planets&focus=pqc#fingerprint", {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
      await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
      await page.waitForURL((url) => url.hash === "#services");
      const url = new URL(page.url());
      assert.equal(url.searchParams.get("layout"), "planets");
      assert.equal(url.searchParams.get("focus"), "pqc");
      assert.equal(await page.locator("#services a[data-galaxy-service-link]").count(), 7);
      assert.ok(await page.locator("#service-preview").isVisible());
      await assertQuizInactive(page);
      const service = page.locator('#services a[data-galaxy-service-link="pqc"]');
      const path = new URL(await service.getAttribute("href"), base).pathname;
      await service.click();
      await page.waitForURL((destination) => destination.pathname === path);
      return { servicePath: path, legacyQuizRedirect: url.hash };
    },
    { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
  );
} finally {
  await browser.close();
}
