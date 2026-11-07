import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { DRAFT_KEY, buildInquiry } from "../../src/studio/inquiry.js";

const runtime = process.env.QA_RUNTIME || "/private/tmp/onepage-uiux-qa-runtime";
const require = createRequire(resolve(runtime, "package.json"));
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const AxeBuilder = require("@axe-core/playwright").default;
const base = new URL(process.env.QA_BASE_URL || "http://127.0.0.1:4177");
const output = resolve(
  process.env.QA_STUDIO_OUTPUT || resolve(ROOT, "artifacts/qa/living-system-2026-11-06/studio"),
);
const filter = process.env.QA_STUDIO_FILTER;
const routes = [
  "/",
  "/services/",
  "/services/websites-apps/",
  "/services/integrations/",
  "/services/support/",
  "/work/",
  "/work/daybook/",
  "/approach/",
  "/contact/",
];
const results = [];
const routeName = (route) =>
  route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replaceAll("/", "-");
const url = (route) => new URL(route, base).href;
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");
const currentPath = (page) => new URL(page.url()).pathname;
await mkdir(output, { recursive: true });
assert.ok(
  (await fetch(url("/"), { signal: AbortSignal.timeout(5000) })).ok,
  "Start the local preview and main build before Studio browser QA.",
);
const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROME || "/Applications/Google Chrome 4.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function capture(page, name, fullPage = true) {
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage, animations: "disabled" });
}
async function open(page, route) {
  const response = await page.goto(url(route), { waitUntil: "load" });
  assert.equal(response?.status(), 200, `${route}: direct route response`);
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 3000))]);
  });
}
async function layout(page, { assertValid = true } = {}) {
  const state = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== "hidden" &&
      !element.classList.contains("sr-only");
    const clipped = [...document.querySelectorAll("button, a.button")]
      .filter(
        (element) =>
          visible(element) &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 2,
      )
      .map((element) => ({
        text: element.textContent.trim() || element.getAttribute("aria-label"),
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
      }));
    const clippedText = [...document.querySelectorAll("h1, h2, h3, p, label, .text-link")]
      .filter(
        (element) =>
          visible(element) &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 2,
      )
      .map((element) => ({
        text: element.textContent.trim().slice(0, 100),
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
      }));
    return {
      width: innerWidth,
      overflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      clipped,
      clippedText,
      unloadedImages: [...document.images]
        .filter((image) => visible(image) && (!image.complete || image.naturalWidth === 0))
        .map((image) => image.currentSrc),
    };
  });
  if (assertValid) assertLayout(state);
  return state;
}
function assertLayout(state) {
  assert.ok(state.overflow <= 1, `Horizontal overflow: ${JSON.stringify(state)}`);
  assert.deepEqual(state.clipped, [], "Visible controls clip their labels");
  assert.deepEqual(state.clippedText, [], "Visible copy overflows its available width");
  assert.deepEqual(state.unloadedImages, [], "Visible image asset failed to load");
}
async function primaryAction(page, { firstViewport = false } = {}) {
  const action = page
    .locator('main a[href^="/contact/"], #project-form button[type="submit"]')
    .first();
  assert.equal(await action.count(), 1, "Main content needs a project inquiry action");
  assert.ok(await action.isVisible(), "Project inquiry action must be rendered");
  const box = await action.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.width > 0 && box.height >= 24);
  if (firstViewport) {
    assert.ok(
      box.x >= -1 && box.x + box.width <= viewport.width + 1,
      "Primary action must fit horizontally",
    );
    assert.ok(
      box.y >= 0 && box.y + box.height <= viewport.height + 1,
      `Home primary action is below the first viewport: ${JSON.stringify(box)}`,
    );
  }
  return { label: (await action.textContent()).trim(), box };
}
async function sceneState(page) {
  return page.evaluate(() => window.__studioScene || null);
}
async function nextSectionHint(page) {
  const box = await page.locator(".home-hero + .section .eyebrow").boundingBox();
  assert.ok(
    box && box.y >= 0 && box.y + box.height <= page.viewportSize().height,
    "The first viewport must reveal the next section's content",
  );
  return box;
}
async function readyScene(page) {
  await page.waitForFunction(
    () =>
      window.__studioScene?.ready === true &&
      document.querySelector("#engineering-scene")?.dataset.ready === "true",
  );
  await page.locator("#engineering-scene canvas").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
}
function canvasStats(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let min = 255;
  let max = 0;
  let visible = 0;
  for (let i = 0; i < png.data.length; i += 64) {
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
    min = Math.min(min, (r + g + b) / 3);
    max = Math.max(max, (r + g + b) / 3);
    if (a > 0) visible += 1;
  }
  const result = {
    width: png.width,
    height: png.height,
    colors: colors.size,
    luminanceRange: max - min,
    visibleSamples: visible,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
  assert.ok(result.width >= 200 && result.height >= 180, "Canvas has no useful visual area");
  assert.ok(
    result.colors > 12 && result.luminanceRange > 35 && visible > 100,
    `Canvas appears blank: ${JSON.stringify(result)}`,
  );
  return result;
}
function changedPixels(first, second) {
  const a = PNG.sync.read(first);
  const b = PNG.sync.read(second);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let changed = 0;
  let samples = 0;
  for (let i = 0; i < a.data.length; i += 64) {
    const difference =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (difference > 25) changed += 1;
    samples += 1;
  }
  return changed / samples;
}
async function stableFrames(page, reason) {
  await page.waitForTimeout(250);
  const before = await sceneState(page);
  await page.waitForTimeout(650);
  const after = await sceneState(page);
  assert.equal(after.frames, before.frames, `${reason}: actual render count must stop`);
  return { before: before.frames, after: after.frames };
}
async function check(name, action, options = {}) {
  if (filter && !name.includes(filter)) return;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    acceptDownloads: true,
    ...options,
  });
  const errors = [];
  const failedResponses = [];
  const blockedSubmissions = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) {
      blockedSubmissions.push({ url: request.url(), method: request.method() });
      await route.abort();
    } else await route.continue();
  });
  await context.addInitScript(() => {
    window.__studioQa = { copies: [], shares: [] };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__studioQa.copies.push(value);
        },
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (value) => {
        window.__studioQa.shares.push(value);
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (new URL(response.url()).origin === base.origin && response.status() >= 400)
      failedResponses.push({ status: response.status(), url: response.url() });
  });
  try {
    const details = await action(page, context);
    assert.deepEqual(errors, [], "Unexpected browser exception");
    assert.deepEqual(failedResponses, [], "Local page or asset request failed");
    assert.deepEqual(blockedSubmissions, [], "A local demo or draft attempted a real submission");
    results.push({ name, passed: true, details, errors, failedResponses, blockedSubmissions });
    console.log(`PASS browser studio: ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error.stack,
      errors,
      failedResponses,
      blockedSubmissions,
    });
    process.exitCode = 1;
    console.error(`FAIL browser studio: ${name}: ${error.message}`);
    await capture(page, `${name}-failure`, false).catch(() => {});
  } finally {
    await context.close();
    await writeFile(
      resolve(
        output,
        filter ? `results-${filter.replace(/[^a-z0-9_-]/gi, "-")}.json` : "results.json",
      ),
      JSON.stringify(results, null, 2),
    );
  }
}

try {
  const identities = new Map();
  for (const width of [1440, 390]) {
    for (const route of routes) {
      await check(
        `route-${routeName(route)}-${width}`,
        async (page) => {
          await open(page, route);
          assert.equal(currentPath(page), route);
          assert.equal(await page.locator("main").count(), 1);
          assert.equal(await page.locator("h1").count(), 1);
          assert.ok(await page.locator("h1").isVisible());
          const identity = {
            title: await page.title(),
            heading: (await page.locator("h1").textContent()).replace(/\s+/g, " ").trim(),
          };
          assert.ok(identity.title && identity.heading);
          assert.match(identity.title, /LEVNAT/);
          if (identities.has(route)) assert.deepEqual(identity, identities.get(route));
          else identities.set(route, identity);
          const bounds = await layout(page, { assertValid: false });
          const action = await primaryAction(page, { firstViewport: route === "/" });
          if (route === "/") {
            await readyScene(page);
            await nextSectionHint(page);
            canvasStats(await page.locator("#engineering-scene canvas").screenshot());
          }
          const axe = await new AxeBuilder({ page }).analyze();
          const violations = axe.violations.filter((item) =>
            ["serious", "critical"].includes(item.impact),
          );
          await writeFile(
            resolve(output, `axe-${routeName(route)}-${width}.json`),
            JSON.stringify(axe.violations, null, 2),
          );
          if (["/", "/services/", "/work/", "/work/daybook/", "/contact/"].includes(route)) {
            await capture(page, `${routeName(route)}-${width}`);
            await capture(page, `${routeName(route)}-${width}-viewport`, false);
          }
          assertLayout(bounds);
          assert.deepEqual(
            violations.map((item) => ({
              id: item.id,
              impact: item.impact,
              description: item.description,
              nodes: item.nodes.map((node) => ({
                target: node.target,
                summary: node.failureSummary,
              })),
            })),
            [],
            "Serious/critical automated accessibility violations",
          );
          return {
            ...identity,
            ...bounds,
            action,
            axe: { serious: violations.length, other: axe.violations.length - violations.length },
          };
        },
        { viewport: { width, height: width === 390 ? 844 : 1000 } },
      );
    }
  }
  if (!filter) {
    await check("route-identities", async () => {
      assert.equal(identities.size, routes.length);
      assert.equal(new Set([...identities.values()].map((item) => item.title)).size, routes.length);
      assert.equal(
        new Set([...identities.values()].map((item) => item.heading)).size,
        routes.length,
      );
      return Object.fromEntries(identities);
    });
  }

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1920, height: 1080 },
  ]) {
    await check(
      `home-responsive-${viewport.width}`,
      async (page) => {
        await open(page, "/");
        const bounds = await layout(page);
        const action = await primaryAction(page, { firstViewport: true });
        await readyScene(page);
        await nextSectionHint(page);
        const pixels = canvasStats(await page.locator("#engineering-scene canvas").screenshot());
        await capture(page, `home-${viewport.width}`);
        return { ...bounds, action, pixels };
      },
      { viewport },
    );
  }

  for (const width of [390, 1440]) {
    await check(
      `text-200-percent-${width}`,
      async (page) => {
        await open(page, "/");
        const scaled = await page.evaluate(() => {
          const records = [...document.querySelectorAll("body *")]
            .filter(
              (element) =>
                !["SCRIPT", "STYLE", "SVG", "PATH", "I", "CANVAS"].includes(element.tagName) &&
                ([...element.childNodes].some(
                  (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
                ) ||
                  element.matches("button, input, textarea, select")),
            )
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                element,
                size: parseFloat(style.fontSize),
                lineHeight: parseFloat(style.lineHeight),
              };
            });
          for (const { element, size, lineHeight } of records) {
            element.style.setProperty("font-size", `${size * 2}px`, "important");
            if (Number.isFinite(lineHeight))
              element.style.setProperty("line-height", `${lineHeight * 2}px`, "important");
          }
          return records.length;
        });
        assert.ok(scaled > 10, "The 200% text stress test must actually enlarge text");
        await page.waitForTimeout(350);
        const bounds = await layout(page);
        await primaryAction(page);
        await capture(page, `home-text-200-${width}`);
        return {
          ...bounds,
          scaledElements: scaled,
          method:
            "Computed text sizes and line heights doubled; not a browser zoom or WCAG certification.",
        };
      },
      { viewport: { width, height: width === 390 ? 844 : 1000 } },
    );
  }

  await check(
    "mobile-menu-and-navigation",
    async (page) => {
      await open(page, "/");
      const toggle = page.locator("[data-menu-toggle]");
      const navigation = page.locator("#primary-navigation");
      assert.ok(await toggle.isVisible());
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await navigation.isVisible(), false);
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.ok(await navigation.isVisible());
      await navigation.locator("a").first().focus();
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await navigation.isVisible(), false);
      assert.ok(
        await toggle.evaluate((element) => element === document.activeElement),
        "Escape returns focus to the menu trigger",
      );
      await toggle.click();
      await navigation.locator('a[href="/services/"]').click();
      await page.waitForURL(url("/services/"));
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(
        await navigation.locator('[aria-current="page"]').getAttribute("href"),
        "/services/",
      );
      await page.goBack({ waitUntil: "load" });
      assert.equal(currentPath(page), "/");
      await page.goForward({ waitUntil: "load" });
      assert.equal(currentPath(page), "/services/");
      await capture(page, "services-mobile-navigation");
      return { escapeRestoresFocus: true, realNavigation: true, history: true };
    },
    { viewport: { width: 390, height: 844 } },
  );

  await check("work-filters-and-local-demos", async (page) => {
    await open(page, "/work/");
    const categories = await page
      .locator("[data-category]")
      .evaluateAll((items) => items.map((item) => item.dataset.category));
    const counts = {};
    for (const value of ["interface", "systems", "all"]) {
      const button = page.locator(`[data-filter="${value}"]`);
      await button.click();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-filter][aria-pressed="true"]').count(), 1);
      const states = await page.locator("[data-category]").evaluateAll((items) =>
        items.map((item) => ({
          category: item.dataset.category,
          hidden: item.hidden,
          displayed: Boolean(item.getClientRects().length),
        })),
      );
      for (const item of states) {
        const shown = value === "all" || item.category === value;
        assert.equal(item.hidden, !shown);
        assert.equal(item.displayed, shown);
      }
      counts[value] = states.filter((item) => item.displayed).length;
    }
    assert.ok(categories.includes("interface") && categories.includes("systems"));
    const request = page.locator("[data-demo-request]");
    const initialCount = Number(await page.locator("[data-demo-count]").textContent());
    assert.ok(Number.isFinite(initialCount));
    for (let i = initialCount; i < 10; i += 1) await request.click();
    assert.equal(Number(await page.locator("[data-demo-count]").textContent()), 10);
    assert.ok(await request.isDisabled(), "The local request demo must stay bounded");
    assert.ok(
      await page
        .locator("[data-demo-requests]")
        .evaluate((element) => element.children.length <= 4),
    );
    assert.match(await page.locator("[data-demo-requests]").textContent(), /Sample request 10/);
    const run = page.locator("[data-demo-run]");
    await run.click();
    await page.waitForFunction(() => {
      const stages = [...document.querySelector("[data-demo-pipeline]").children];
      return stages.length > 0 && stages.every((stage) => stage.dataset.state === "complete");
    });
    assert.match(
      await page.locator("[data-pipeline-status]").textContent(),
      /complete.*no external data sent/i,
    );
    assert.equal(await run.isDisabled(), false);
    await layout(page);
    await capture(page, "work-demos-complete");
    return {
      counts,
      boundedRequests: 10,
      pipeline: await page.locator("[data-pipeline-status]").textContent(),
    };
  });

  await check("daybook-discovery-case-and-contextual-inquiry", async (page) => {
    await open(page, "/work/");
    await page.locator('main a[href="/work/daybook/"]').first().click();
    await page.waitForURL(url("/work/daybook/"));
    assert.equal(
      await page.locator('#primary-navigation [aria-current="page"]').getAttribute("href"),
      "/work/",
    );
    const copy = await page.locator("main").textContent();
    assert.match(copy, /independent/i);
    assert.match(copy, /no backend|no (?:real|production)|local simulation/i);
    assert.match(copy, /(?:scope|limit|constraint|decision)/i);
    const playable = page.locator('main a[href^="/#"]');
    assert.ok(await playable.count(), "The case must link directly to the usable product");
    await layout(page);
    await capture(page, "daybook-case");
    const inquiry = page.locator('main a[href^="/contact/"]').first();
    const href = await inquiry.getAttribute("href");
    await inquiry.click();
    await page.waitForURL((value) => value.pathname === "/contact/");
    const service = new URL(href, base).searchParams.get("service");
    if (service)
      assert.equal(await page.locator('#project-form [name="service"]').inputValue(), service);
    return {
      discoverableCase: true,
      scopedPrototype: true,
      productDeepLink: true,
      inquiryService: service,
    };
  });

  await check("contact-validation-persistence-and-unicode-handoff", async (page) => {
    await open(page, "/contact/?service=support");
    const form = page.locator("#project-form");
    const field = (name) => form.locator(`[name="${name}"]`);
    assert.equal(await field("service").inputValue(), "support");
    assert.equal(
      new URL(page.url()).searchParams.has("service"),
      false,
      "Service preselection is consumed once",
    );
    await field("service").selectOption("integrations");
    await page.reload({ waitUntil: "load" });
    assert.equal(
      await field("service").inputValue(),
      "integrations",
      "A consumed URL selection must not override a later manual choice",
    );
    await field("service").selectOption("support");
    const emailLink = page.locator("#email-draft-link");
    assert.equal(await emailLink.isVisible(), false);
    await field("email").fill("not-an-email");
    await field("description").fill("Too short");
    await form.locator('button[type="submit"]').click();
    assert.equal(await form.evaluate((element) => element.checkValidity()), false);
    assert.equal(await emailLink.isVisible(), false);
    assert.equal(currentPath(page), "/contact/");
    const value = {
      name: "Zo\u00eb Example",
      email: "qa+studio@example.test",
      service: "support",
      description:
        "Build a portal for Caf\u00e9 & Co. \ud83d\ude80\nConnect <device logs> to an API and investigate missing events.",
      budget: "",
      timeline: "",
    };
    for (const name of ["name", "email", "description"]) await field(name).fill(value[name]);
    for (const name of ["budget", "timeline"]) {
      const control = field(name);
      if (await control.evaluate((element) => element.tagName === "SELECT")) {
        const option = await control
          .locator("option")
          .evaluateAll((items) => items.find((item) => item.value && !item.disabled)?.value || "");
        if (option) await control.selectOption(option);
      } else await control.fill(name === "budget" ? "CAD $4,000-$8,000" : "After scope review");
      value[name] = await control.inputValue();
    }
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
    assert.deepEqual(stored, value);
    await page.reload({ waitUntil: "load" });
    for (const [name, expected] of Object.entries(value))
      assert.equal(await field(name).inputValue(), expected, `${name} survives reload`);
    assert.match(await page.locator("#inquiry-status").textContent(), /(?:restored|saved)/i);
    await form.locator('button[type="submit"]').click();
    await emailLink.waitFor({ state: "visible" });
    assert.ok(
      await emailLink.evaluate((element) => element === document.activeElement),
      "Prepared email link receives focus",
    );
    assert.equal(
      currentPath(page),
      "/contact/",
      "Preparing a draft must not navigate to an email client",
    );
    const email = new URL(await emailLink.getAttribute("href"));
    assert.equal(email.protocol, "mailto:");
    assert.equal(email.pathname, "info@levnat.ca");
    const summary = buildInquiry(value);
    assert.equal(email.searchParams.get("body"), summary);
    assert.match(await page.locator("#inquiry-status").textContent(), /nothing has been sent/i);
    await page.locator("[data-copy-inquiry]").click();
    await page.waitForFunction(() => window.__studioQa.copies.length > 0);
    assert.equal(await page.evaluate(() => window.__studioQa.copies.at(-1)), summary);
    const pendingDownload = page.waitForEvent("download");
    await page.locator("[data-download-inquiry]").click();
    const download = await pendingDownload;
    const filename = resolve(output, "unicode-project-inquiry.txt");
    await download.saveAs(filename);
    assert.equal(normalizeNewlines(await readFile(filename, "utf8")), normalizeNewlines(summary));
    await page.locator('header a[href="/services/"]').click();
    await page.waitForURL(url("/services/"));
    await page.locator('header a[href="/contact/"]').click();
    await page.waitForURL(url("/contact/"));
    for (const [name, expected] of Object.entries(value))
      assert.equal(
        await field(name).inputValue(),
        expected,
        `${name} survives cross-page navigation`,
      );
    await page.locator("[data-clear-draft]").click();
    for (const name of ["name", "email", "description"])
      assert.equal(await field(name).inputValue(), "");
    assert.equal(await emailLink.isVisible(), false);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY), null);
    assert.match(await page.locator("#inquiry-status").textContent(), /cleared/i);
    await page.reload({ waitUntil: "load" });
    assert.equal(await field("description").inputValue(), "");
    await capture(page, "contact-cleared");
    return {
      preselectedService: value.service,
      persistedFields: Object.keys(value),
      emailCopyDownloadMatch: true,
      download: download.suggestedFilename(),
      noAutomaticSend: true,
      cleared: true,
    };
  });

  await check("contact-storage-and-clipboard-unavailable", async (page) => {
    await page.addInitScript(() => {
      for (const name of ["getItem", "setItem", "removeItem"])
        Object.defineProperty(Storage.prototype, name, {
          configurable: true,
          value() {
            throw new DOMException("Storage disabled by QA", "SecurityError");
          },
        });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Clipboard disabled by QA", "NotAllowedError");
          },
        },
      });
    });
    await open(page, "/contact/");
    assert.match(await page.locator("#inquiry-status").textContent(), /storage.*unavailable/i);
    await page.locator('#project-form [name="email"]').fill("qa@example.test");
    await page
      .locator('#project-form [name="description"]')
      .fill("Please investigate the app and connected device logs.");
    await page.locator('#project-form button[type="submit"]').click();
    assert.ok(await page.locator("#email-draft-link").isVisible());
    await page.locator("[data-copy-inquiry]").click();
    assert.match(
      await page.locator("#inquiry-status").textContent(),
      /copy unavailable.*download/i,
    );
    await page.locator("[data-clear-draft]").click();
    assert.equal(await page.locator('#project-form [name="description"]').inputValue(), "");
    return { draftStillAvailable: true, honestClipboardFailure: true, clearWithoutStorage: true };
  });

  await check(
    "scene-motion-modes-pause-and-offscreen",
    async (page) => {
      await open(page, "/");
      await readyScene(page);
      const initial = await sceneState(page);
      assert.equal(initial.reducedMotion, false);
      await page.waitForFunction(
        (frames) => window.__studioScene.frames >= frames + 2,
        initial.frames,
      );
      const canvas = page.locator("#engineering-scene canvas");
      const movingImage = await canvas.screenshot();
      const pixels = canvasStats(movingImage);
      const movingFrames = (await sceneState(page)).frames;
      await page.waitForFunction(
        (frames) => window.__studioScene.frames >= frames + 6,
        movingFrames,
      );
      const motionDifference = changedPixels(movingImage, await canvas.screenshot());
      assert.ok(
        motionDifference > 0.0005,
        `Rendered frames must visibly move, not just increment a counter: ${motionDifference}`,
      );
      const pause = page.locator("[data-scene-pause]");
      await pause.click();
      assert.equal((await sceneState(page)).paused, true);
      assert.equal(await pause.getAttribute("aria-pressed"), "true");
      const pausedFrames = await stableFrames(page, "User pause");
      const modeImages = [];
      const modes = [];
      for (const mode of ["build", "connect", "care"]) {
        const button = page.locator(`[data-scene-mode="${mode}"]`);
        await button.click();
        await page.waitForFunction((expected) => window.__studioScene.mode === expected, mode);
        assert.equal(await button.getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator('[data-scene-mode][aria-pressed="true"]').count(), 1);
        const buffer = await canvas.screenshot({ path: resolve(output, `scene-${mode}.png`) });
        modeImages.push(buffer);
        modes.push({ mode, ...canvasStats(buffer) });
        await stableFrames(page, `${mode} remains paused after one requested render`);
      }
      const differences = [
        changedPixels(modeImages[0], modeImages[1]),
        changedPixels(modeImages[1], modeImages[2]),
      ];
      assert.ok(
        differences.every((difference) => difference > 0.003),
        `Mode changes must alter the actual scene: ${differences}`,
      );
      await pause.click();
      assert.equal((await sceneState(page)).paused, false);
      const resumed = await sceneState(page);
      await page.waitForFunction((frames) => window.__studioScene.frames > frames, resumed.frames);
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => window.__studioScene.inView === false);
      const offscreenFrames = await stableFrames(page, "Offscreen scene");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(() => window.__studioScene.inView === true);
      await page.waitForFunction(
        (frames) => window.__studioScene.frames > frames,
        offscreenFrames.after,
      );
      await capture(page, "home-motion", false);
      return {
        pixels,
        motionDifference,
        modes,
        differences,
        pausedFrames,
        offscreenFrames,
        resumesInView: true,
      };
    },
    { reducedMotion: "no-preference" },
  );

  await check("scene-raw-canvas-pixels", async (page) => {
    const samples = [];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
      await open(page, "/");
      await readyScene(page);
      for (const mode of ["build", "connect", "care"]) {
        const uri = await page.evaluate((selected) => {
          document.querySelector(`[data-scene-mode="${selected}"]`).click();
          return document.querySelector("#engineering-scene canvas").toDataURL("image/png");
        }, mode);
        const buffer = Buffer.from(uri.split(",")[1], "base64");
        const pixels = canvasStats(buffer);
        await writeFile(resolve(output, `raw-canvas-${width}-${mode}.png`), buffer);
        samples.push({ width, mode, pixels });
      }
    }
    return { source: "Actual WebGL drawing buffer, not a screenshot of overlapping HTML", samples };
  });

  await check("scene-reduced-motion", async (page) => {
    await open(page, "/");
    await readyScene(page);
    assert.equal((await sceneState(page)).reducedMotion, true);
    assert.ok(
      await page.locator("[data-scene-pause]").isDisabled(),
      "Reduced motion must not offer a misleading play/pause action",
    );
    assert.match(
      await page.locator("[data-scene-pause]").getAttribute("aria-label"),
      /disabled.*preference/i,
    );
    for (const button of await page.locator("[data-scene-mode]").all())
      assert.equal(await button.isDisabled(), false, "Still-scene mode controls remain usable");
    const frames = await stableFrames(page, "Reduced motion");
    const pixels = canvasStats(await page.locator("#engineering-scene canvas").screenshot());
    await page.locator('[data-scene-mode="care"]').click();
    assert.equal((await sceneState(page)).mode, "care");
    await stableFrames(page, "Reduced motion after a manual mode change");
    return { frames, pixels, manualModeWorks: true };
  });

  await check(
    "scene-context-recovery-preserves-mode-and-pause",
    async (page) => {
      await open(page, "/");
      await readyScene(page);
      await page.locator('[data-scene-mode="connect"]').click();
      await page.locator("[data-scene-pause]").click();
      const supported = await page.evaluate(() => {
        const canvas = document.querySelector("#engineering-scene canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        window.qaContextLoss = gl.getExtension("WEBGL_lose_context");
        if (!window.qaContextLoss) return false;
        window.qaContextLoss.loseContext();
        return true;
      });
      assert.ok(supported, "Software Chrome must expose the context-loss extension");
      await page.waitForFunction(() => window.__studioScene.ready === false);
      assert.ok(await page.locator(".scene-fallback").isVisible());
      await page.waitForTimeout(250);
      await page.evaluate(() => window.qaContextLoss.restoreContext());
      await readyScene(page);
      const recovered = await sceneState(page);
      assert.equal(recovered.mode, "connect");
      assert.equal(recovered.paused, true);
      await stableFrames(page, "Recovered paused context");
      const pixels = canvasStats(await page.locator("#engineering-scene canvas").screenshot());
      await capture(page, "scene-context-recovered", false);
      return { recovered, pixels, noReload: true };
    },
    { reducedMotion: "no-preference" },
  );

  await check("scene-no-webgl-business-fallback", async (page) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /^(?:experimental-)?webgl/.test(kind) ? null : original.call(this, kind, ...args);
      };
    });
    await open(page, "/");
    await page.waitForFunction(
      () => document.querySelector("#engineering-scene")?.dataset.ready === "false",
    );
    assert.ok(await page.locator("h1").isVisible());
    await primaryAction(page, { firstViewport: true });
    await layout(page);
    const fallback = page.locator("#engineering-scene .scene-fallback");
    assert.ok(
      await fallback.isVisible(),
      "The unavailable canvas needs a visible static composition",
    );
    assert.notEqual(await fallback.evaluate((element) => getComputedStyle(element).opacity), "0");
    assert.ok(await page.locator("[data-scene-pause]").isDisabled());
    for (const button of await page.locator("[data-scene-mode]").all()) {
      assert.equal(
        await button.isDisabled(),
        false,
        "Build/Connect/Debug select the usable DOM product even without WebGL",
      );
      const mode = await button.getAttribute("data-scene-mode");
      await button.click();
      assert.equal(
        await page.evaluate(() => window.__systemLab.mode),
        mode,
        "A no-WebGL mode control must still change the actual product state",
      );
      assert.equal(await button.getAttribute("aria-pressed"), "true");
    }
    const businessCopy = await page.locator("main").textContent();
    assert.match(businessCopy, /website|app|development/i);
    assert.ok(await page.locator('header a[href="/services/"]').isVisible());
    assert.ok(await page.locator('header a[href="/contact/"]').isVisible());
    await capture(page, "home-no-webgl");
    return {
      businessContentAvailable: true,
      disabledUnavailableMotion: true,
      usableProductModes: true,
      scene: await sceneState(page),
    };
  });

  await check(
    "no-javascript-direct-content-and-navigation",
    async (page) => {
      const details = [];
      for (const route of routes) {
        await open(page, route);
        assert.ok(await page.locator("h1").isVisible(), `${route}: heading available without JS`);
        assert.ok(
          await page.locator('#primary-navigation a[href="/services/"]').isVisible(),
          `${route}: navigation must not require JS`,
        );
        assert.ok(await page.locator('header a[href="/contact/"]').isVisible());
        if (route === "/contact/")
          assert.ok(
            await page.locator('main a[href="mailto:info@levnat.ca"]').first().isVisible(),
            "No-JS visitors need a working direct email action",
          );
        const bounds = await layout(page);
        details.push({ route, overflow: bounds.overflow });
      }
      await capture(page, "contact-no-javascript-mobile");
      return { routes: details, directContactAvailable: true };
    },
    { javaScriptEnabled: false, viewport: { width: 390, height: 844 } },
  );
} finally {
  await browser.close();
}

assert.ok(results.length, `No browser checks matched ${filter || "the suite"}`);
const passed = results.filter((item) => item.passed).length;
console.log(`${passed}/${results.length} Studio browser checks passed. Evidence: ${output}`);
