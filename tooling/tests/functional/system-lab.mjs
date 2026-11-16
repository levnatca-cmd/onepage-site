import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { DRAFT_KEY } from "../../../website/src/studio/inquiry.js";
import { LAB_SLOTS, deriveLab, publicLabConfig } from "../../../website/src/studio/lab/state.js";
import { changedPixels, launchQaBrowser, PNG, qaBaseUrl, requireQa } from "../support/browser.mjs";
import { DAYBOOK_DEMO_PATH } from "../support/studio-routes.mjs";

const AxeBuilder = requireQa("@axe-core/playwright").default;
const base = new URL(qaBaseUrl);
const output = resolve(
  process.env.QA_LAB_OUTPUT || resolve(ROOT, "artifacts/qa/living-system-2026-11-06"),
);
const filter = process.env.QA_LAB_FILTER;
const results = [];
const privateName = "Zo\u00eb Privatemarker";
const publicKeys = ["lab", "mode", "theme", "built", "api", "fault", "sample"];
const url = (route = DAYBOOK_DEMO_PATH) => new URL(route, base).href;
await mkdir(output, { recursive: true });
assert.ok(
  (await fetch(url(), { signal: AbortSignal.timeout(5000) })).ok,
  "Build and start the main preview before System Lab browser QA.",
);
const browser = await launchQaBrowser();

async function capture(page, name, fullPage = true) {
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage, animations: "disabled" });
}
async function open(page, route = DAYBOOK_DEMO_PATH) {
  const response = await page.goto(url(route), { waitUntil: "load" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => Boolean(window.__systemLab));
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 3000))]);
  });
  assert.equal(await page.locator("[data-system-lab]").count(), 1);
}
const stateOf = (page) => page.evaluate(() => window.__systemLab);
async function stateAndDOM(page) {
  const state = await stateOf(page);
  const derived = deriveLab(state);
  for (const key of ["requests", "pending", "delivered"])
    assert.equal(
      Number(await page.locator(`[data-lab-count="${key}"]`).textContent()),
      derived[key],
      `Visible ${key} must match actual records`,
    );
  assert.equal(await page.locator("[data-system-lab]").getAttribute("data-status"), derived.status);
  assert.equal(await page.locator('[data-scene-mode][aria-pressed="true"]').count(), 1);
  assert.equal(
    await page.locator('[data-scene-mode][aria-pressed="true"]').getAttribute("data-scene-mode"),
    state.mode,
  );
  const records = page.locator("[data-lab-records] [data-record-id]");
  assert.equal(await records.count(), state.records.length);
  for (const record of state.records) {
    const item = page.locator(`[data-lab-records] [data-record-id="${record.id}"]`);
    assert.equal(await item.getAttribute("data-status"), record.status);
    const copy = await item.textContent();
    assert.ok(copy.includes(record.name), "The booking must be inspectable, not only a counter");
    assert.ok(copy.includes(record.slot));
    assert.match(copy, record.status === "queued" ? /queue|pending/i : /delivered once/i);
    assert.equal(record.deliveries, record.status === "queued" ? 0 : 1);
  }
  for (const [key, status] of Object.entries(derived.nodes))
    assert.equal(
      await page.locator(`[data-lab-node="${key}"]`).getAttribute("data-status"),
      status,
    );
  for (const slot of LAB_SLOTS)
    assert.equal(
      await page.locator(`[data-lab-slot="${slot}"]`).isDisabled(),
      !state.built || !derived.availableSlots.includes(slot),
    );
  const events = await page.locator("[data-lab-events]").textContent();
  if (state.events.length) assert.ok(events.includes(state.events.at(-1).code));
  return {
    state,
    counts: { requests: derived.requests, pending: derived.pending, delivered: derived.delivered },
  };
}
async function expectCounts(page, expected) {
  await page.waitForFunction(
    (counts) =>
      Object.entries(counts).every(
        ([key, value]) =>
          Number(document.querySelector(`[data-lab-count="${key}"]`)?.textContent) === value,
      ),
    expected,
  );
  const snapshot = await stateAndDOM(page);
  assert.deepEqual(snapshot.counts, expected);
  return snapshot.state;
}
async function action(page, label) {
  const button = page.locator("[data-lab-action]");
  assert.match(await button.textContent(), label);
  assert.equal(await button.isDisabled(), false);
  await button.click();
}
async function mode(page, value) {
  await page.locator(`[data-scene-mode="${value}"]`).click();
  assert.equal((await stateOf(page)).mode, value);
}
async function build(page) {
  await action(page, /build app/i);
  assert.equal((await stateOf(page)).built, true);
  assert.equal(await page.locator("#lab-guest").isDisabled(), false);
}
async function book(page, index, name = "Zo\u00eb Moreno") {
  await page.locator("#lab-guest").fill(name);
  await page.locator(`[data-lab-slot="${LAB_SLOTS[index]}"]`).click();
  await page.locator("[data-lab-submit]").click();
  return stateAndDOM(page);
}
async function connect(page) {
  await mode(page, "connect");
  await action(page, /^\s*connect api/i);
  assert.equal((await stateOf(page)).connected, true);
}
async function fault(page, value) {
  await mode(page, "care");
  await page.locator("#lab-fault-type").selectOption(value);
  await action(page, /simulate (?:outage|fault)/i);
  assert.equal((await stateOf(page)).fault, value);
}
async function repair(page) {
  await action(page, /repair.*replay/i);
  assert.equal((await stateOf(page)).fault, null);
}
async function layout(page) {
  const result = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== "hidden" &&
      !element.classList.contains("sr-only");
    const clipped = [
      ...document.querySelectorAll("button, a.button, h1, h2, h3, p, label, input, select"),
    ]
      .filter(
        (element) =>
          visible(element) &&
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 2 &&
          !(element.matches("input") && element.readOnly),
      )
      .map((element) => ({
        text: (element.textContent || element.getAttribute("aria-label") || element.id)
          .trim()
          .slice(0, 90),
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
      }));
    return {
      overflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      clipped,
    };
  });
  assert.ok(result.overflow <= 1, `Horizontal overflow: ${JSON.stringify(result)}`);
  assert.deepEqual(result.clipped, [], "Product copy and controls must fit without clipping");
  return result;
}
async function accessible(page, name) {
  const axe = await new AxeBuilder({ page }).analyze();
  await writeFile(resolve(output, `axe-${name}.json`), JSON.stringify(axe.violations, null, 2));
  const violations = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact));
  assert.deepEqual(
    violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      targets: item.nodes.map((node) => node.target),
    })),
    [],
    "No serious/critical Axe violations",
  );
  return { serious: violations.length, other: axe.violations.length - violations.length };
}
function imageStats(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let min = 255,
    max = 0;
  for (let index = 0; index < png.data.length; index += 64) {
    const [r, g, b] = png.data.subarray(index, index + 3);
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
    min = Math.min(min, (r + g + b) / 3);
    max = Math.max(max, (r + g + b) / 3);
  }
  assert.ok(
    colors.size > 12 && max - min > 35,
    "Image drawing buffer is blank or indistinguishable",
  );
  return {
    width: png.width,
    height: png.height,
    colors: colors.size,
    luminanceRange: max - min,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}
async function readyScene(page) {
  await page.waitForFunction(
    () =>
      window.__studioScene?.ready === true &&
      document.querySelector("#engineering-scene")?.dataset.ready === "true",
  );
}
async function rawCanvas(page) {
  const uri = await page.evaluate(() => {
    // Repaint and sample in one task: WebGL does not preserve its buffer between frames.
    document.querySelector(`[data-scene-mode="${window.__systemLab.mode}"]`).click();
    return document.querySelector("#engineering-scene canvas").toDataURL("image/png");
  });
  return Buffer.from(uri.split(",")[1], "base64");
}
async function check(name, execute, options = {}) {
  if (filter && !name.includes(filter)) return;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    acceptDownloads: true,
    ...options,
  });
  const errors = [],
    failedResponses = [],
    submissions = [],
    externalRequests = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) {
      submissions.push({ method: request.method(), url: request.url() });
      await route.abort();
    } else if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base.origin) {
      externalRequests.push(request.url());
      await route.abort();
    } else await route.continue();
  });
  await context.addInitScript(() => {
    window.__labQa = { copies: [], drawnText: [] };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__labQa.copies.push(value);
        },
      },
    });
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      window.__labQa.drawnText.push(String(value));
      return fillText.call(this, value, ...args);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("page", (newPage) => newPage.on("pageerror", (error) => errors.push(error.message)));
  page.on("response", (response) => {
    if (new URL(response.url()).origin === base.origin && response.status() >= 400)
      failedResponses.push({ status: response.status(), url: response.url() });
  });
  try {
    const details = await execute(page, context);
    assert.deepEqual(errors, [], "Unexpected browser exceptions");
    assert.deepEqual(failedResponses, [], "Local route or asset failed");
    assert.deepEqual(submissions, [], "The local prototype attempted a real submission");
    assert.deepEqual(externalRequests, [], "The simulated API must not make external requests");
    results.push({
      name,
      passed: true,
      details,
      errors,
      failedResponses,
      submissions,
      externalRequests,
    });
    console.log(`PASS browser system lab: ${name}`);
  } catch (error) {
    process.exitCode = 1;
    results.push({
      name,
      passed: false,
      error: error.stack,
      errors,
      failedResponses,
      submissions,
      externalRequests,
    });
    console.error(`FAIL browser system lab: ${name}: ${error.message}`);
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
  await check("interactive-3d-nodes-and-inline-event-inspection", async (page) => {
    await open(page);
    await readyScene(page);
    const canvas = page.locator("#engineering-scene canvas");
    async function clickModule(label) {
      const area = await page.evaluate(() => {
        const copy = document.querySelector(".hero-content").getBoundingClientRect();
        const hero = document.querySelector(".living-hero").getBoundingClientRect();
        return {
          left: copy.left,
          right: copy.right,
          top: copy.bottom + 16,
          bottom: Math.min(hero.bottom - 70, innerHeight - 10),
        };
      });
      for (let y = area.top; y < area.bottom; y += 18)
        for (let x = area.left + 12; x < area.right; x += 18) {
          await page.mouse.move(x, y);
          if ((await canvas.getAttribute("title")) === label) {
            await page.mouse.click(x, y);
            return { x, y, label };
          }
        }
      assert.fail(`No unobstructed 3D target for ${label}`);
    }
    const targets = [await clickModule("Build Daybook")];
    assert.equal((await stateOf(page)).built, true);
    targets.push(await clickModule("Connect the API"));
    assert.equal((await stateOf(page)).connected, true);
    await book(page, 0);
    await page.locator("[data-lab-inspect]").click();
    assert.equal(await page.locator("#lab-inspection").isVisible(), true);
    assert.match(
      await page.locator("[data-lab-inspection-events]").textContent(),
      /REQUEST_DELIVERED/,
    );
    await page.locator("[data-lab-inspect]").click();
    targets.push(await clickModule("Simulate a device outage"));
    assert.equal((await stateOf(page)).fault, "device");
    await book(page, 1);
    await expectCounts(page, { requests: 2, pending: 1, delivered: 1 });
    targets.push(await clickModule("Repair and replay pending requests"));
    const state = await expectCounts(page, { requests: 2, pending: 0, delivered: 2 });
    assert.ok(state.records.every((record) => record.deliveries === 1));
    await page.locator("[data-lab-inspect]").click();
    await layout(page);
    await capture(page, "interactive-3d-and-events", false);
    return { targets, inlineEvents: true, duplicateDeliveries: false };
  });

  for (const width of [1440, 390]) {
    await check(
      `booking-queue-fault-replay-${width}`,
      async (page) => {
        await open(page);
        await expectCounts(page, { requests: 0, pending: 0, delivered: 0 });
        assert.equal(await page.locator("#lab-guest").isDisabled(), true);
        assert.deepEqual(
          await page
            .locator("[data-lab-slot]")
            .evaluateAll((items) => items.map((item) => item.dataset.labSlot)),
          LAB_SLOTS,
        );
        assert.match(await page.locator('[data-scene-mode="care"]').textContent(), /debug/i);
        await build(page);
        await book(page, 0, "Zoe\u0308 Moreno");
        let state = await expectCounts(page, { requests: 1, pending: 1, delivered: 0 });
        assert.equal(state.records[0].name, "Zo\u00eb Moreno");
        await connect(page);
        await expectCounts(page, { requests: 1, pending: 0, delivered: 1 });
        for (const [index, faultType] of [
          [1, "api"],
          [2, "device"],
        ]) {
          await fault(page, faultType);
          await book(page, index, index === 1 ? "\u5c71\u7530" : "Ren\u00e9 Example");
          await expectCounts(page, { requests: index + 1, pending: 1, delivered: index });
          await layout(page);
          await capture(page, `lab-${width}-${faultType}-queued`);
          await repair(page);
          state = await expectCounts(page, {
            requests: index + 1,
            pending: 0,
            delivered: index + 1,
          });
          assert.ok(state.records.every((record) => record.deliveries === 1));
        }
        assert.equal(await page.locator("[data-lab-submit]").isDisabled(), true);
        await page.locator("#lab-booking-form").evaluate((form) => form.requestSubmit());
        await expectCounts(page, { requests: 3, pending: 0, delivered: 3 });
        await layout(page);
        const axe = await accessible(page, `complete-${width}`);
        await capture(page, `lab-${width}-delivered`);
        return {
          records: state.records,
          axe,
          deliveryEvents: state.events.filter((event) =>
            /REQUEST_(?:DELIVERED|REPLAYED)/.test(event.code),
          ),
        };
      },
      { viewport: { width, height: width === 390 ? 844 : 1000 } },
    );
  }

  await check("validation-injection-readonly-hook-and-reset", async (page) => {
    await open(page);
    await build(page);
    for (const value of ["", " ", "A"]) {
      await page.locator("#lab-guest").fill(value);
      await page.locator("[data-lab-submit]").click();
      await expectCounts(page, { requests: 0, pending: 0, delivered: 0 });
    }
    await page.evaluate(() => {
      window.__labInjected = false;
    });
    const maliciousName = '<img src=x onerror="__labInjected=1">';
    await book(page, 0, maliciousName);
    assert.equal(
      await page.locator("[data-lab-records] img, [data-lab-records] script").count(),
      0,
    );
    assert.equal(await page.evaluate(() => window.__labInjected), false);
    assert.ok((await page.locator("[data-lab-records]").textContent()).includes(maliciousName));
    const before = await stateOf(page);
    await page.evaluate(() => {
      const snapshot = window.__systemLab;
      snapshot.built = false;
      snapshot.records.splice(0);
    });
    assert.deepEqual(await stateOf(page), before, "The QA getter must not permit state mutation");
    await page.locator('[data-lab-theme="rose"]').click();
    const inquiry = {
      name: "PRIVATE_INQUIRY",
      email: "qa-private@example.test",
      description: "PRIVATE_NOTES_NOT_FOR_LAB",
    };
    await page.evaluate(({ key, inquiry }) => localStorage.setItem(key, JSON.stringify(inquiry)), {
      key: DRAFT_KEY,
      inquiry,
    });
    await page.locator("[data-lab-reset]").click();
    const reset = await expectCounts(page, { requests: 0, pending: 0, delivered: 0 });
    assert.equal(reset.built, false);
    assert.equal(reset.connected, false);
    assert.equal(reset.fault, null);
    assert.equal(reset.mode, "build");
    assert.equal(reset.theme, "rose");
    assert.deepEqual(reset.events, []);
    assert.equal(reset.nextId, 1);
    assert.equal(await page.locator("#lab-guest").inputValue(), "Sample guest");
    assert.equal(await page.locator("#lab-inspection").isVisible(), false);
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY),
      inquiry,
    );
    await build(page);
    await book(page, 0, "Fresh sample");
    await expectCounts(page, { requests: 1, pending: 1, delivered: 0 });
    await capture(page, "lab-validation-reset");
    return {
      maliciousNameRenderedAsText: true,
      getterIsClone: true,
      contactDraftUntouched: true,
      startsFresh: true,
    };
  });

  await check("private-share-roundtrip-and-public-png", async (page, context) => {
    await open(page);
    await build(page);
    await connect(page);
    await fault(page, "device");
    await book(page, 0, privateName);
    await page.locator('[data-lab-theme="citrus"]').click();
    const state = await stateOf(page);
    await page.locator("[data-lab-share]").click();
    await page.waitForFunction(() => window.__labQa.copies.length > 0);
    const shared = new URL(await page.evaluate(() => window.__labQa.copies.at(-1)));
    assert.equal(shared.origin, base.origin);
    assert.equal(shared.pathname, DAYBOOK_DEMO_PATH);
    assert.deepEqual([...shared.searchParams.keys()].sort(), [...publicKeys].sort());
    assert.deepEqual(Object.fromEntries(shared.searchParams), publicLabConfig(state));
    assert.doesNotMatch(
      decodeURIComponent(shared.href),
      /Privatemarker|guest|name|notes|email|logs|events|records/i,
    );
    await page.evaluate(() => {
      window.__labQa.drawnText = [];
    });
    const pendingDownload = page.waitForEvent("download");
    await page.locator("[data-lab-download]").click();
    const download = await pendingDownload;
    assert.match(download.suggestedFilename(), /\.png$/i);
    const filename = resolve(output, "public-build-card.png");
    await download.saveAs(filename);
    const buffer = await readFile(filename);
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const card = imageStats(buffer);
    assert.deepEqual([card.width, card.height], [1440, 960]);
    const paintedText = await page.evaluate(() => window.__labQa.drawnText);
    assert.ok(
      paintedText.some((value) => /LEVNAT/.test(value)),
      "Card privacy inspection must observe the actual painted text",
    );
    assert.doesNotMatch(paintedText.join("\n"), /Privatemarker|PRIVATE_|qa-private|Zo\u00eb/i);
    assert.equal(buffer.includes(Buffer.from(privateName)), false);
    const restoredPage = await context.newPage();
    try {
      await open(restoredPage, shared.href);
      const restored = (await stateAndDOM(restoredPage)).state;
      assert.deepEqual(publicLabConfig(restored), publicLabConfig(state));
      assert.equal(restored.records.length, 1);
      assert.equal(restored.records[0].name, "Sample guest");
      assert.equal(restored.records[0].deliveries, 0);
      assert.doesNotMatch(await restoredPage.locator("main").textContent(), /Privatemarker/);
      await repair(restoredPage);
      await expectCounts(restoredPage, { requests: 1, pending: 0, delivered: 1 });
      await capture(restoredPage, "lab-restored-public-setup");
    } finally {
      await restoredPage.close();
    }
    return {
      query: Object.fromEntries(shared.searchParams),
      syntheticRestore: true,
      card,
      paintedText,
    };
  });

  await check(
    "share-clipboard-denied-fallback",
    async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new DOMException("Clipboard denied by QA", "NotAllowedError");
            },
          },
        });
      });
      await open(page);
      await build(page);
      await book(page, 0, privateName);
      await page.locator("[data-lab-share]").click();
      const field = page.locator("#lab-share-link");
      await field.waitFor({ state: "visible" });
      assert.equal(await field.getAttribute("readonly"), "");
      assert.ok(await field.evaluate((element) => element === document.activeElement));
      const shared = new URL(await field.inputValue());
      assert.deepEqual([...shared.searchParams.keys()].sort(), [...publicKeys].sort());
      assert.doesNotMatch(decodeURIComponent(shared.href), /Privatemarker/);
      assert.match(
        await page.locator("#lab-status").textContent(),
        /unavailable.*(?:ready|select)/i,
      );
      await layout(page);
      await capture(page, "lab-share-fallback");
      return { readonlyFallback: true, focus: true, privateNameExcluded: true };
    },
    { viewport: { width: 390, height: 844 } },
  );

  await check(
    "no-webgl-complete-product-flow",
    async (page) => {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return /^(?:experimental-)?webgl/.test(kind) ? null : original.call(this, kind, ...args);
        };
      });
      await open(page);
      await page.waitForFunction(
        () => document.querySelector("#engineering-scene")?.dataset.ready === "false",
      );
      assert.ok(await page.locator(".scene-fallback").isVisible());
      assert.ok(await page.locator("[data-scene-pause]").isDisabled());
      for (const button of await page.locator("[data-scene-mode]").all())
        assert.equal(await button.isDisabled(), false);
      await build(page);
      await book(page, 0);
      await expectCounts(page, { requests: 1, pending: 1, delivered: 0 });
      await connect(page);
      await expectCounts(page, { requests: 1, pending: 0, delivered: 1 });
      await fault(page, "api");
      await book(page, 1, "Second sample");
      await expectCounts(page, { requests: 2, pending: 1, delivered: 1 });
      await repair(page);
      await expectCounts(page, { requests: 2, pending: 0, delivered: 2 });
      assert.ok(await page.locator('header a[href="/contact/"]').isVisible());
      await layout(page);
      const axe = await accessible(page, "no-webgl");
      await capture(page, "lab-no-webgl");
      return { completeProductFlow: true, contactIndependent: true, axe };
    },
    { viewport: { width: 390, height: 844 } },
  );

  await check(
    "context-loss-preserves-live-records-and-replay",
    async (page) => {
      await open(page);
      await readyScene(page);
      await build(page);
      await connect(page);
      await fault(page, "api");
      await book(page, 0, privateName);
      await page.locator("[data-scene-pause]").click();
      const before = await stateOf(page);
      assert.equal(await page.evaluate(() => window.__studioScene.paused), true);
      const supported = await page.evaluate(() => {
        window.__qaNoReload = "preserve-this-document";
        const canvas = document.querySelector("#engineering-scene canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        window.__qaLoseContext = gl.getExtension("WEBGL_lose_context");
        if (!window.__qaLoseContext) return false;
        window.__qaLoseContext.loseContext();
        return true;
      });
      assert.ok(supported, "QA Chrome must expose the context-loss extension");
      await page.waitForFunction(() => window.__studioScene.ready === false);
      await stateAndDOM(page);
      assert.deepEqual(await stateOf(page), before);
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__qaLoseContext.restoreContext());
      await readyScene(page);
      assert.equal(await page.evaluate(() => window.__qaNoReload), "preserve-this-document");
      assert.deepEqual(await stateOf(page), before);
      const recovered = await page.evaluate(() => window.__studioScene);
      assert.equal(recovered.mode, "care");
      assert.equal(recovered.paused, true);
      const pixels = imageStats(await rawCanvas(page));
      await repair(page);
      await expectCounts(page, { requests: 1, pending: 0, delivered: 1 });
      await capture(page, "lab-context-recovered");
      return {
        recordsPreserved: true,
        noReload: true,
        replayAfterRecovery: true,
        recovered,
        pixels,
      };
    },
    { reducedMotion: "no-preference" },
  );

  for (const width of [1440, 390]) {
    await check(
      `scene-product-state-pixels-${width}`,
      async (page) => {
        await open(page);
        await readyScene(page);
        const buffers = [],
          samples = [];
        for (const stage of ["unbuilt", "built", "connected", "api-fault", "repaired"]) {
          if (stage === "built") await build(page);
          if (stage === "connected") {
            await connect(page);
            await book(page, 0);
          }
          if (stage === "api-fault") {
            await fault(page, "api");
            await book(page, 1, "Pending sample");
          }
          if (stage === "repaired") await repair(page);
          await page.waitForTimeout(150);
          const buffer = await rawCanvas(page);
          await writeFile(resolve(output, `raw-system-${width}-${stage}.png`), buffer);
          buffers.push(buffer);
          const snapshot = await stateAndDOM(page);
          samples.push({
            stage,
            config: publicLabConfig(snapshot.state),
            counts: snapshot.counts,
            pixels: imageStats(buffer),
          });
        }
        const differences = buffers
          .slice(1)
          .map((buffer, index) => changedPixels(buffers[index], buffer));
        assert.ok(
          differences.every((difference) => difference > 0.0005),
          `Actual canvas must react to product transitions, including repair without changing mode: ${differences}`,
        );
        return { samples, differences, rawDrawingBuffer: true };
      },
      { viewport: { width, height: width === 390 ? 844 : 1000 } },
    );
  }

  await check("keyboard-booking-and-mode-controls", async (page) => {
    await open(page);
    await page.locator("[data-lab-action]").focus();
    await page.keyboard.press("Enter");
    assert.equal((await stateOf(page)).built, true);
    await page.locator('[data-lab-slot="11:00"]').focus();
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator('[data-lab-slot="11:00"]').getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#lab-guest").fill("Keyboard guest");
    await page.locator("[data-lab-submit]").focus();
    await page.keyboard.press("Enter");
    await expectCounts(page, { requests: 1, pending: 1, delivered: 0 });
    assert.equal((await stateOf(page)).records[0].slot, "11:00");
    await page.locator('[data-scene-mode="connect"]').focus();
    await page.keyboard.press("Enter");
    await page.locator("[data-lab-action]").focus();
    await page.keyboard.press("Enter");
    await expectCounts(page, { requests: 1, pending: 0, delivered: 1 });
    assert.equal(await page.locator("#lab-status").getAttribute("role"), "status");
    return { keyboardOnlyActivation: true, selectedSlotRetained: true };
  });
} finally {
  await browser.close();
}

assert.ok(results.length, `No browser checks matched ${filter || "the suite"}`);
console.log(
  `${results.filter((item) => item.passed).length}/${results.length} System Lab browser checks passed. Evidence: ${output}`,
);
