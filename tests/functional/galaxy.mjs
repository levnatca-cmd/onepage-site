import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, test } from "node:test";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { PLANETS, PLANET_IDS } from "../../src/galaxy/js/data/quiz-data.js";
import { MAX_SERVICE_ORBIT_SCALE } from "../../src/galaxy/js/scene/service-spatial-grid.js";
import { launchQaBrowser, qaBaseUrl } from "../support/browser.mjs";
import { checkProtectedPacket } from "../support/galaxy-pqc.mjs";

const origin = new URL(qaBaseUrl).origin;
const artifacts = resolve(ROOT, "artifacts/qa/galaxy");
const tolerance = 0.0001;
const routes = {
  firmware: "websites-apps",
  backend: "backend-api",
  automation: "automation",
  pqc: "post-quantum-security",
  data: "data-logs",
  hardware: "hardware",
  ops: "monitoring",
};

assert.ok(
  (await fetch(new URL("/explore.html", qaBaseUrl), { signal: AbortSignal.timeout(5000) })).ok,
  "Start the site preview before running the Galaxy browser tests.",
);
const browser = await launchQaBrowser();
after(() => browser.close());

async function connectScene(page) {
  await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
  await page.evaluate(async () => {
    const entry = document.querySelector('script[src*="/galaxy/js/main.js"]');
    const version = new URL(entry.src).searchParams.get("v");
    const [{ galaxy, appState }, THREE] = await Promise.all([
      import("/src/galaxy/js/state.js?v=" + version),
      import("/vendor/three/three.module.min.js"),
    ]);
    window.galaxyTest = { galaxy, appState, THREE };
    galaxy.renderer.domElement.scrollIntoView({ block: "center", behavior: "instant" });
  });
}

async function sampleScene(page, phase) {
  return page.evaluate(async (phase) => {
    const { galaxy, appState, THREE } = window.galaxyTest;
    if (phase !== undefined) window.__sceneDebug.setTime(phase);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const world = (object) => object.getWorldPosition(new THREE.Vector3());
    const surfaceRadius = (object) =>
      object.userData.presentation.radius * object.getWorldScale(new THREE.Vector3()).x;
    const focused = galaxy.rescueRigObjects[appState.hoveredPlanet || appState.selectedPlanet];
    const center = world(focused);
    const core = world(galaxy.rescueRigCore);
    const coreProjection = core.clone().project(galaxy.camera);
    const focusBeam = galaxy.focusBeam;
    const beamEnd = focusBeam.localToWorld(
      new THREE.Vector3().fromBufferAttribute(focusBeam.geometry.attributes.position, 1),
    );
    const focusEdge = center
      .clone()
      .addScaledVector(core.clone().sub(center).normalize(), surfaceRadius(focused));
    const { firmware, backend } = galaxy.rescueRigObjects;
    const midpoint = world(firmware).lerp(world(backend), 0.5);
    const bridges = galaxy.bridges.filter((bridge) => bridge.visible);
    const pqcCable = galaxy.rescueRigCables.find((cable) => cable.userData.serviceId === "pqc");
    return {
      layout: galaxy.layout,
      selected: appState.selectedPlanet,
      simulation: appState.simulation,
      mode: document.querySelector("#galaxy-layout input:checked")?.value,
      overflow: document.documentElement.scrollWidth - innerWidth,
      coreOffset: Math.hypot(coreProjection.x, coreProjection.y),
      position: center.toArray(),
      orbit: { ...galaxy.orbitView },
      haloVisible: galaxy.focusHalo.visible,
      haloGap: world(galaxy.focusHalo).distanceTo(center),
      haloRatio: galaxy.focusHalo.getWorldScale(new THREE.Vector3()).x / surfaceRadius(focused),
      paddedColliders: galaxy.planetMeshes.filter(
        (collider) =>
          collider.geometry.parameters.radius >
          galaxy.rescueRigObjects[collider.userData.planetId].userData.presentation.radius,
      ).length,
      beamVisible: focusBeam.visible,
      beamGap: beamEnd.distanceTo(focusEdge),
      streams: galaxy.rescueRigCables.filter((cable) => cable.visible).length,
      packetHead: pqcCable.material.uniforms.uPacketHead.value,
      anomalyVisible: galaxy.blackHole.visible,
      anomalyGap: world(galaxy.blackHole).distanceTo(midpoint),
      outerRings: galaxy.accretionRings.filter((ring) => ring.visible).length,
      bridges: bridges.map((bridge) =>
        bridge.userData.pair.map((id, index) => {
          const sphere = galaxy.rescueRigObjects[id];
          const uniforms = bridge.material.uniforms;
          const endpoint = bridge.localToWorld(
            (index === 0 ? uniforms.uStart : uniforms.uEnd).value.clone(),
          );
          return Math.abs(endpoint.distanceTo(world(sphere)) - surfaceRadius(sphere));
        }),
      ),
      oldOrbits: Object.values(galaxy.orbits ?? {}).filter(
        (orbit) => orbit.visible && orbit.material.opacity > 0,
      ).length,
      oldTicks: (galaxy.orbitTicks ?? []).filter(
        (ticks) => ticks.visible && ticks.material.opacity > 0,
      ).length,
      ghost: galaxy.shell.visible && galaxy.shell.material.opacity > 0.01,
      debris:
        galaxy.debris.visible &&
        galaxy.debris.children.some((item) => item.material.opacity > 0.01),
      debrisGap: world(galaxy.debris).distanceTo(world(galaxy.rescueRigObjects.automation)),
    };
  }, phase);
}

function assertFocus(state, layout) {
  assert.equal(state.layout, layout);
  assert.equal(state.mode, layout, "The selected layout control must match the rendered scene");
  assert.equal(state.overflow, 0, "The overview must fit the viewport");
  assert.ok(state.coreOffset < tolerance, "Core must stay at the canvas center");
  assert.ok(
    state.haloVisible && state.haloGap < tolerance,
    "The focus ring must follow the visible sphere",
  );
  assert.ok(state.haloRatio > 1 && state.haloRatio < 1.15, "The focus ring must hug the sphere");
  assert.equal(state.paddedColliders, 0, "Invisible padding must not win over a visible sphere");
  assert.equal(state.streams, layout === "planets" ? Object.keys(routes).length : 0);
  assert.equal(
    state.oldOrbits + state.oldTicks,
    0,
    "Old orbit guides must not float behind the scene",
  );
  if (layout === "atom") assert.equal(state.beamVisible, false, "Atom must have no focus beam");
}

function assertIdle(state) {
  assert.equal(state.simulation, null);
  assert.equal(state.beamVisible, false, "The transient focus beam must expire");
  assert.equal(
    state.anomalyVisible,
    false,
    "The anomaly must be hidden outside the API simulation",
  );
  assert.equal(state.outerRings, 0, "The anomaly's outer rings must also be hidden");
  assert.equal(
    state.bridges.length,
    0,
    "Preview bridges must be hidden outside a running simulation",
  );
  assert.equal(state.ghost, false, "The planning shell must not leak into the overview");
  assert.equal(state.debris, false, "Automation debris must not leak into the overview");
}

async function sampleServiceDepths(page, time) {
  return page.evaluate(async (time) => {
    window.__sceneDebug.setTime(time);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { galaxy, appState, THREE } = window.galaxyTest;
    const { camera, rescueRigGrid: grid } = galaxy;
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const halfWidth = galaxy.renderer.domElement.clientWidth / 2;
    const spheres = Object.entries(galaxy.rescueRigObjects).map(([id, sphere]) => {
      const center = sphere.getWorldPosition(new THREE.Vector3());
      const depth = -center.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const radius =
        sphere.userData.presentation.radius * sphere.getWorldScale(new THREE.Vector3()).x;
      const offset = cameraRight.clone().multiplyScalar(radius);
      const left = center.clone().sub(offset).project(camera).x;
      const right = center.clone().add(offset).project(camera).x;
      const collider = sphere.userData.collider;
      const hitRadius =
        collider.geometry.parameters.radius * collider.getWorldScale(new THREE.Vector3()).x;
      return {
        id,
        depth,
        diameter: (right - left) * halfWidth,
        orbitScale: sphere.scale.x / (grid.scale * grid.assignments.get(id).bodyScale),
        hitRadiusGap: Math.abs(hitRadius - radius),
        hitCenterGap: collider.getWorldPosition(new THREE.Vector3()).distanceTo(center),
      };
    });
    return { spheres, selected: appState.selectedPlanet, orbitView: { ...galaxy.orbitView } };
  }, time);
}

function assertServiceDepthOrder({ spheres }, label) {
  const ordered = spheres.toSorted((a, b) => a.depth - b.depth);
  assert.deepEqual(ordered.map(({ id }) => id).sort(), [...PLANET_IDS].sort());
  assert.ok(ordered[0].depth > 0 && ordered.at(-1).depth - ordered[0].depth > 1);
  for (const [index, sphere] of ordered.entries()) {
    const nearer = ordered[index - 1];
    if (nearer && sphere.depth - nearer.depth > 0.02) {
      assert.ok(
        nearer.diameter > sphere.diameter,
        `${label}: nearer ${nearer.id} (${nearer.diameter.toFixed(1)}px) must be larger than ${sphere.id} (${sphere.diameter.toFixed(1)}px)`,
      );
    }
    assert.ok(
      sphere.orbitScale <= MAX_SERVICE_ORBIT_SCALE + tolerance,
      `${sphere.id} exceeds its orbit clearance`,
    );
    assert.ok(
      sphere.hitCenterGap < tolerance && sphere.hitRadiusGap < tolerance,
      `${sphere.id} hit surface must follow its visual shell`,
    );
  }
}

async function serviceOrbitExtremes(page, id) {
  return page.evaluate((id) => {
    const { galaxy, THREE } = window.galaxyTest;
    const { orbit, phase } = galaxy.rescueRigGrid.assignments.get(id);
    const origin = galaxy.rescueRig.getWorldPosition(new THREE.Vector3());
    const forward = galaxy.camera.getWorldDirection(new THREE.Vector3());
    const depthX = galaxy.rescueRig.localToWorld(orbit.axisX.clone()).sub(origin).dot(forward);
    const depthY = galaxy.rescueRig.localToWorld(orbit.axisY.clone()).sub(origin).dot(forward);
    const farAngle = Math.atan2(depthY, depthX);
    const timeAtAngle = (angle) =>
      THREE.MathUtils.euclideanModulo(angle - phase, Math.PI * 2) / orbit.speed;
    return { near: timeAtAngle(farAngle + Math.PI), far: timeAtAngle(farAngle) };
  }, id);
}

async function selectLayout(page, layout) {
  await page
    .locator("#galaxy-layout")
    .getByText(layout === "atom" ? "Atom" : "Planets")
    .tap();
  assert.equal(new URL(page.url()).searchParams.get("layout"), layout);
  const links = await page
    .locator("#services [data-galaxy-service-link]")
    .evaluateAll((items) =>
      Object.fromEntries(items.map((link) => [link.dataset.galaxyServiceLink, link.href])),
    );
  assert.deepEqual(Object.keys(links).sort(), Object.keys(routes).sort());
  for (const [id, route] of Object.entries(routes)) {
    const url = new URL(links[id]);
    assert.equal(url.pathname, `/services/${route}/`);
    assert.equal(url.searchParams.get("layout"), layout);
  }
}

for (const width of [390, 1366]) {
  test(`Galaxy perspective sizes nearer service spheres first at ${width}px`, async () => {
    const mobile = width === 390;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    try {
      await page.goto(
        new URL("/explore.html?layout=planets&focus=hardware&sceneTime=1.25", origin).href,
        {
          waitUntil: "domcontentloaded",
        },
      );
      await connectScene(page);
      await sampleServiceDepths(page, 1.25);
      const times = await serviceOrbitExtremes(page, "backend");
      const near = (await sampleServiceDepths(page, times.near)).spheres.find(
        ({ id }) => id === "backend",
      );
      const far = (await sampleServiceDepths(page, times.far)).spheres.find(
        ({ id }) => id === "backend",
      );
      assert.ok(
        near.depth < far.depth,
        "Backend must move from the near side to the far side of its orbit",
      );
      assert.ok(
        near.diameter / far.diameter >= 1.25,
        `Near-side Backend should grow at least 25% (measured ${(near.diameter / far.diameter).toFixed(2)}×)`,
      );

      const rotate = page.locator("#galaxy-orbit-reset");
      for (const layout of ["planets", "atom"]) {
        if (layout === "atom") {
          await page.locator("#galaxy-layout").getByText("Atom", { exact: true }).click();
        }
        await rotate.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");
        const frame = await sampleServiceDepths(page, 4.6);
        assert.equal(frame.selected, "hardware");
        assert.ok(frame.orbitView.yaw > 0 && frame.orbitView.pitch > 0);
        assertServiceDepthOrder(frame, `${width}px ${layout}`);
      }
    } finally {
      await context.close();
    }
  });
}

async function spherePoint(page, id) {
  for (const phase of [1.25, 4.6, 7.9, 12.4]) {
    await sampleScene(page, phase);
    const point = await page.evaluate((id) => {
      const { galaxy, THREE } = window.galaxyTest;
      const canvas = galaxy.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const projected = galaxy.rescueRigObjects[id]
        .getWorldPosition(new THREE.Vector3())
        .project(galaxy.camera);
      const x = Math.round(rect.left + ((projected.x + 1) * rect.width) / 2);
      const y = Math.round(rect.top + ((1 - projected.y) * rect.height) / 2);
      const ray = new THREE.Raycaster();
      const pointer = new THREE.Vector2(
        ((x - rect.left) * 2) / rect.width - 1,
        1 - ((y - rect.top) * 2) / rect.height,
      );
      ray.setFromCamera(pointer, galaxy.camera);
      const serviceHit = ray.intersectObjects(galaxy.planetMeshes, false)[0];
      const coreHit = ray.intersectObject(galaxy.star, false)[0];
      if (
        document.elementFromPoint(x, y) === canvas &&
        serviceHit?.object.userData.planetId === id &&
        (!coreHit || serviceHit.distance < coreHit.distance)
      ) {
        return { x, y };
      }
      return null;
    }, id);
    if (point) return { ...point, phase };
  }
  assert.fail(`The ${id} sphere must be reachable on the canvas`);
}

async function expectHologram(page, label) {
  const hologram = page.locator(".galaxy-object-hologram");
  const title = hologram.locator(".galaxy-object-hologram-label");
  await title.waitFor({ state: "visible" });
  assert.equal(await title.textContent(), label);
  return hologram.locator(".galaxy-object-hologram-panel");
}

async function inspectSphere(page, point, id) {
  const path = new URL(page.url()).pathname;
  await page.touchscreen.tap(point.x, point.y);
  const hologram = await expectHologram(page, PLANETS[id].label);
  assert.equal(new URL(page.url()).pathname, path, "The first tap only inspects the service");
  assert.equal(await page.locator(".galaxy-dive").count(), 0);
  const box = await hologram.boundingBox();
  const { width, height } = page.viewportSize();
  assert.ok(
    box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height,
  );
  assert.ok(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.id === "galaxy-canvas",
      point,
    ),
    "The visible panel must not intercept the next tap on the sphere",
  );
}

async function checkTouchInspection(page) {
  const backend = await spherePoint(page, "backend");
  await inspectSphere(page, backend, "backend");
  const automation = await spherePoint(page, "automation");
  await inspectSphere(page, automation, "automation");

  const before = await sampleScene(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    const { x, y } = automation;
    const step = x < page.viewportSize().width / 2 ? 15 : -15;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 4; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + step * i, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  const after = await sampleScene(page);
  assert.notEqual(after.orbit.yaw, before.orbit.yaw, "Dragging the scene must still rotate it");
  assert.equal(new URL(page.url()).pathname, "/explore.html");
  assert.equal(await page.locator(".galaxy-dive").count(), 0, "Dragging is not a second tap");
  await page.locator("#galaxy-orbit-reset").tap();
  await page.locator(".galaxy-object-hologram").waitFor({ state: "hidden" });
}

async function tapSphere(page, id, layout) {
  const point = await spherePoint(page, id);
  await inspectSphere(page, point, id);
  const serviceApp = /\/src\/studio\/app\.js(?:\?|$)/;
  let releaseApp;
  const holdApp = new Promise((resolve) => {
    releaseApp = resolve;
  });
  await page.route(
    serviceApp,
    async (route) => {
      await holdApp;
      await route.continue();
    },
    { times: 1 },
  );
  const appRequested = page.waitForRequest(serviceApp);
  const destination = page.waitForURL(`**/services/${routes[id]}/?**`, { waitUntil: "commit" });
  const dive = page.waitForFunction(() => {
    const overlay = document.querySelector(".galaxy-dive");
    const { focusHalo, focusBeam } = window.galaxyTest?.galaxy ?? {};
    return (
      Number(overlay?.style.getPropertyValue("--dive-progress")) > 0.06 &&
      !focusHalo.visible &&
      !focusBeam.visible
    );
  });
  const back = page.locator("[data-galaxy-return]");
  try {
    await page.touchscreen.tap(point.x, point.y);
    await Promise.all([dive, destination, appRequested]);
    await back.waitFor();
    const returnUrl = new URL(await back.getAttribute("href"), origin);
    assert.equal(returnUrl.searchParams.get("layout"), layout);
    assert.equal(returnUrl.searchParams.get("focus"), id);
    const related = page.locator("[data-galaxy-related]");
    assert.equal(await related.count(), 1, "Automation must link to its related Data service");
    const relatedUrl = new URL(await related.getAttribute("href"), origin);
    assert.equal(relatedUrl.pathname, "/services/data-logs/");
    assert.equal(relatedUrl.searchParams.get("layout"), layout);
  } finally {
    releaseApp();
  }
  await back.tap();
  await page.waitForURL(
    (url) =>
      url.pathname === "/explore.html" &&
      url.searchParams.get("layout") === layout &&
      url.searchParams.get("focus") === id,
  );
}

async function checkSimulationAndReset(page) {
  const trigger = (selector) => page.locator(selector).evaluate((button) => button.click());
  const runHandoff = () => trigger('[data-scenario="apiLatency"]');
  const waitForAnomaly = (visible) =>
    page.waitForFunction((visible) => {
      const { galaxy, appState } = window.galaxyTest;
      return (
        (appState.simulation === "handoff") === visible && galaxy.blackHole.visible === visible
      );
    }, visible);
  await page.locator("#scale-slider").evaluate((slider) => {
    slider.value = slider.max;
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assertIdle(await sampleScene(page));
  await trigger('[data-simulate="dominant"]');
  await waitForAnomaly(true);
  const active = await sampleScene(page, 7.9);
  assertFocus(active, "planets");
  assert.ok(
    active.anomalyGap < tolerance && active.outerRings > 0,
    "Handoff effect must be between the visible services",
  );
  assert.ok(
    active.beamVisible && active.beamGap < tolerance,
    "Focus beam must end on the actual sphere shell",
  );
  assert.ok(
    active.bridges.length > 0,
    "A running Planets simulation must render its preview bridges",
  );
  assert.ok(
    active.bridges.flat().every((gap) => gap < tolerance),
    "Preview bridges must connect live sphere surfaces",
  );
  await waitForAnomaly(false);
  assertIdle(await sampleScene(page));

  await runHandoff();
  await waitForAnomaly(true);
  await selectLayout(page, "atom");
  const atom = await sampleScene(page);
  assertFocus(atom, "atom");
  assert.equal(
    atom.bridges.length,
    0,
    "Atom must suppress preview bridges even during a simulation",
  );
  await selectLayout(page, "planets");
  await runHandoff();
  await waitForAnomaly(true);
  await trigger("[data-reset]");
  await waitForAnomaly(false);
  const reset = await sampleScene(page);
  assertFocus(reset, "planets");
  assertIdle(reset);
  assert.equal(reset.selected, "firmware");
  assert.equal(await page.locator("#scale-slider").inputValue(), "0");
  assert.equal(await page.locator('[data-scenario][aria-pressed="true"]').count(), 0);
  assert.equal(
    new URL(page.url()).searchParams.has("focus"),
    false,
    "Reset must clear stale URL focus",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await connectScene(page);
  const reloaded = await sampleScene(page);
  assertFocus(reloaded, "planets");
  assert.equal(reloaded.selected, "firmware");
}

async function checkCoreOcclusion(page) {
  await page.evaluate(() =>
    Object.assign(window.galaxyTest.galaxy.orbitView, { yaw: 1.98, pitch: -1.2 }),
  );
  await sampleScene(page, 8.8);
  const point = await page.evaluate(() => {
    const { galaxy, THREE } = window.galaxyTest;
    const canvas = galaxy.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const core = galaxy.star.getWorldPosition(new THREE.Vector3()).project(galaxy.camera);
    const x = Math.round(rect.left + ((core.x + 1) * rect.width) / 2);
    const y = Math.round(rect.top + ((1 - core.y) * rect.height) / 2);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2(
      ((x - rect.left) * 2) / rect.width - 1,
      1 - ((y - rect.top) * 2) / rect.height,
    );
    ray.setFromCamera(pointer, galaxy.camera);
    const coreHit = ray.intersectObject(galaxy.star, false)[0];
    const serviceHit = ray.intersectObjects(galaxy.planetMeshes, false)[0];
    return {
      x,
      y,
      hasHiddenService: coreHit && serviceHit && coreHit.distance < serviceHit.distance,
    };
  });
  assert.ok(point.hasHiddenService, "The fixture must put a service directly behind Core");
  const url = page.url();
  await page.touchscreen.tap(point.x, point.y);
  await expectHologram(page, "Core");
  await page.touchscreen.tap(point.x, point.y);
  await sampleScene(page);
  assert.equal(
    await page.locator(".galaxy-dive").count(),
    0,
    "Tapping Core must not open a hidden service",
  );
  assert.equal(page.url(), url);
  await page.locator("#galaxy-orbit-reset").tap();
}

for (const width of [320, 390]) {
  test(`Galaxy mobile overview, simulation and touch at ${width}px`, async () => {
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 568 : 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /THREE|WebGL|GLSL|shader/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await context.route("**/*", (route) =>
      route
        .request()
        .url()
        .startsWith(origin + "/")
        ? route.continue()
        : route.abort(),
    );

    try {
      await page.goto(
        new URL("/explore.html?layout=atom&focus=automation&sceneTime=1.25", origin).href,
        {
          waitUntil: "domcontentloaded",
        },
      );
      await connectScene(page);
      assert.equal(
        await page.locator(".hero-atmosphere .atmosphere-beam").count(),
        0,
        "No decorative signal beams should sweep across the scene",
      );
      const initial = await sampleScene(page, 1.25);
      const later = await sampleScene(page, 4.6);
      assertFocus(initial, "atom");
      assertFocus(later, "atom");
      assertIdle(initial);
      assert.ok(
        later.position.some((value, index) => Math.abs(value - initial.position[index]) > 0.05),
        "The second frame must exercise a different orbital position",
      );

      const resetView = page.locator("#galaxy-orbit-reset");
      await resetView.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowDown");
      const rotated = await sampleScene(page, 4.6);
      assert.ok(rotated.orbit.yaw > 0 && rotated.orbit.pitch > 0, "Rotation must move both axes");
      assertFocus(rotated, "atom");
      await resetView.tap();

      await selectLayout(page, "planets");
      const planets = await sampleScene(page, 1.25);
      assertFocus(planets, "planets");
      assertIdle(planets);
      if (width === 390) {
        const handoff = await sampleScene(page, 3.25);
        assert.ok(
          handoff.packetHead > 0 && handoff.packetHead < 1,
          "PQC must hand its live packet to the cable",
        );
        await checkProtectedPacket(page);
        await checkSimulationAndReset(page);
        await checkCoreOcclusion(page);
      }
      const diveLayout = width === 320 ? "atom" : "planets";
      await selectLayout(page, diveLayout);
      if (width === 320) await checkTouchInspection(page);
      await tapSphere(page, "automation", diveLayout);
      assert.deepEqual(errors, [], "The journey must not throw browser or WebGL errors");
    } catch (error) {
      await mkdir(artifacts, { recursive: true });
      await page
        .screenshot({ path: resolve(artifacts, `failure-${width}.png`), timeout: 5000 })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  });
}

test("Galaxy desktop hologram follows a hovered sphere without intercepting clicks", async () => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 850 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    const url = new URL("/explore.html?layout=planets&sceneTime=1.25", origin);
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await connectScene(page);
    const point = await spherePoint(page, "automation");
    await page.mouse.move(point.x, point.y);
    const hologram = await expectHologram(page, PLANETS.automation.label);
    assert.equal(page.url(), url.href, "Hover must not navigate");
    const before = await hologram.boundingBox();
    await sampleScene(page, point.phase + 0.35);
    const after = await hologram.boundingBox();
    assert.ok(
      before && after && Math.hypot(after.x - before.x, after.y - before.y) > 1,
      "The hovered hologram must follow the moving sphere",
    );

    await page.mouse.move(0, 0);
    await hologram.waitFor({ state: "hidden" });
    const target = await spherePoint(page, "automation");
    await Promise.all([
      page.waitForURL((destination) => destination.pathname === "/services/automation/"),
      page.mouse.click(target.x, target.y),
    ]);
    const destination = new URL(page.url());
    assert.equal(destination.searchParams.get("from"), "galaxy");
    assert.equal(destination.searchParams.get("layout"), "planets");
  } finally {
    await context.close();
  }
});

test("Galaxy reload shows loading until the live scene renders", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const url = new URL("/explore.html?focus=ops&layout=planets", origin);
  const loader = page.locator("#galaxy-loading");
  const rig = page.locator(".rescue-rig");
  const fallback = page.locator(".galaxy-fallback");
  const mainModule = /\/src\/galaxy\/js\/main\.js(?:\?|$)/;
  let releaseMain;
  const holdMain = new Promise((resolve) => {
    releaseMain = resolve;
  });

  try {
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await page.locator(".galaxy-hero.webgl-ready").waitFor();
    await loader.waitFor({ state: "hidden" });

    await page.route(
      mainModule,
      async (route) => {
        await holdMain;
        await route.continue();
      },
      { times: 1 },
    );
    await Promise.all([page.waitForRequest(mainModule), page.reload({ waitUntil: "commit" })]);
    await loader.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector("#galaxy-loading")).opacity > 0,
    );
    assert.ok(await rig.isHidden(), "The fallback models must stay hidden while WebGL loads");
    assert.ok(await fallback.isHidden(), "Loading must not look like a WebGL failure");
    await loader.evaluate(async (status) => {
      const entry = document.querySelector('script[src*="/galaxy/js/main.js"]');
      const version = new URL(entry.src).searchParams.get("v");
      const { galaxy } = await import("/src/galaxy/js/state.js?v=" + version);
      new MutationObserver(() => {
        if (status.hidden) window.drawCallsAtLoaderHide = galaxy.renderer?.info.render.calls ?? 0;
      }).observe(status, { attributes: true, attributeFilter: ["hidden"] });
    });

    releaseMain();
    await connectScene(page);
    await loader.waitFor({ state: "hidden" });
    const scene = await page.evaluate(() => {
      const { galaxy, appState } = window.galaxyTest;
      return {
        drawCallsAtLoaderHide: window.drawCallsAtLoaderHide,
        drawCalls: galaxy.renderer.info.render.calls,
        liveModels: Object.entries(galaxy.rescueRigObjects)
          .filter(([, model]) => galaxy.root.visible && galaxy.rescueRig.visible && model.visible)
          .map(([id]) => id),
        layout: galaxy.layout,
        focus: appState.selectedPlanet,
        contextLost: galaxy.renderer.getContext().isContextLost(),
      };
    });
    assert.ok(scene.drawCallsAtLoaderHide > 0, "Loading must end only after the first WebGL frame");
    assert.ok(scene.drawCalls > 0, "The reloaded canvas must render the live scene");
    assert.deepEqual(scene.liveModels.sort(), Object.keys(routes).sort());
    assert.equal(scene.layout, "planets");
    assert.equal(scene.focus, "ops");
    assert.equal(scene.contextLost, false);
    assert.equal(page.url(), url.href);
    assert.ok(await rig.isHidden());
    assert.ok(await fallback.isHidden());

    url.searchParams.set("forceFallback", "1");
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await fallback.waitFor({ state: "visible" });
    assert.ok(await loader.isHidden(), "A genuine WebGL failure must end loading");
    const links = page.locator("#services a[data-galaxy-service-link]:visible");
    assert.equal(await links.count(), Object.keys(routes).length);
    await Promise.all([
      page.waitForURL((destination) => destination.pathname === "/services/monitoring/"),
      links.filter({ hasText: "Monitoring" }).tap(),
    ]);
  } finally {
    releaseMain();
    await context.close();
  }
});

test("Galaxy leaves loading when a scene module request fails", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const url = new URL("/explore.html?focus=ops&layout=planets", origin);
  try {
    for (const module of [
      /\/src\/galaxy\/js\/main\.js(?:\?|$)/,
      /\/src\/galaxy\/js\/scene\/energy-core\.js(?:\?|$)/,
    ]) {
      await page.route(module, (route) => route.fulfill({ status: 503, body: "Unavailable" }), {
        times: 1,
      });
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      await page.locator(".galaxy-fallback").waitFor({ state: "visible", timeout: 5000 });
      assert.ok(await page.locator("#galaxy-loading").isHidden());
      assert.equal(
        await page.locator("#services [data-galaxy-service-link]:visible").count(),
        Object.keys(routes).length,
      );
    }
    await Promise.all([
      page.waitForURL(
        (destination) =>
          destination.pathname === "/services/monitoring/" &&
          destination.searchParams.get("from") === "galaxy" &&
          destination.searchParams.get("layout") === "planets",
      ),
      page.locator('#services [data-galaxy-service-link="ops"]').tap(),
    ]);
    const back = page.locator("[data-galaxy-return]");
    await back.waitFor();
    const returnUrl = new URL(await back.getAttribute("href"), origin);
    assert.equal(returnUrl.searchParams.get("layout"), "planets");
    assert.equal(returnUrl.searchParams.get("focus"), "ops");
  } finally {
    await context.close();
  }
});

async function rememberOverviewSpheres(page) {
  await page.evaluate(() => {
    const state = window.galaxyTest;
    const { galaxy } = state;
    state.overviewSpheres = Object.fromEntries(
      Object.entries(galaxy.rescueRigObjects).map(([id, sphere]) => {
        const { presentation } = sphere.userData;
        return [
          id,
          {
            sphere,
            parent: sphere.parent,
            presentation,
            shell: presentation.shell,
            model: presentation.model,
            collider: galaxy.planetMeshes.find((mesh) => mesh.userData.planetId === id),
          },
        ];
      }),
    );
  });
}

async function swipeGalaxy(page, { x, y }, amount) {
  const context = page.context();
  const cdp = await context.newCDPSession(page);
  let timeout;
  try {
    await Promise.race([
      cdp.send("Input.synthesizeScrollGesture", {
        x,
        y,
        yDistance: -amount,
        gestureSourceType: "touch",
        preventFling: true,
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Chromium did not complete the touch swipe")),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    await cdp.detach();
  }
}

const retiredQuizControls =
  "[data-start-3d], #quiz-console, #choice-hud, #fingerprint-form, #result-title, [data-scroll-result]";

async function scrollGalaxy(page, mobile, amount) {
  const point = await page.evaluate(() => ({
    x: Math.round(innerWidth * 0.14),
    y: Math.round(innerHeight * 0.52),
  }));
  const position = await page.evaluate(() => scrollY);
  if (mobile) await swipeGalaxy(page, point, amount);
  else {
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, amount);
  }
  await page.waitForFunction(
    ({ amount, position }) => (scrollY - position) * Math.sign(amount) > 1,
    { amount, position },
    { timeout: 5000 },
  );
}

async function assertServiceRow(page, layout) {
  const links = page.locator(".galaxy-service-row a[data-galaxy-service-link]");
  assert.equal(await links.count(), PLANET_IDS.length);
  const row = await links.evaluateAll((anchors) => {
    const { galaxy, THREE, overviewSpheres } = window.galaxyTest;
    const canvas = galaxy.renderer.domElement.getBoundingClientRect();
    return anchors.map((anchor) => {
      const id = anchor.dataset.galaxyServiceLink;
      const rect = anchor.getBoundingClientRect();
      const orb = anchor.querySelector(".galaxy-service-row-orb").getBoundingClientRect();
      const sphere = galaxy.rescueRigObjects[id];
      const projected = sphere.getWorldPosition(new THREE.Vector3()).project(galaxy.camera);
      const anchorX = orb.left + orb.width / 2;
      const anchorY = orb.top + orb.height / 2;
      return {
        id,
        href: anchor.href,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        anchorY,
        screenWidth: innerWidth,
        screenHeight: innerHeight,
        actorDelta: Math.hypot(
          anchorX - (canvas.left + ((1 + projected.x) * canvas.width) / 2),
          anchorY - (canvas.top + ((1 - projected.y) * canvas.height) / 2),
        ),
        sameActor:
          sphere === overviewSpheres[id].sphere &&
          sphere.userData.presentation.shell === overviewSpheres[id].shell &&
          sphere.userData.presentation.model === overviewSpheres[id].model,
        visible: sphere.visible && projected.z >= -1 && projected.z <= 1,
        tappable: anchor.contains(document.elementFromPoint(anchorX, anchorY)),
      };
    });
  });
  assert.deepEqual(
    row.map(({ id }) => id),
    PLANET_IDS,
  );
  for (const [index, item] of row.entries()) {
    assert.ok(item.sameActor && item.visible, `${item.id}: retain the visible Galaxy model`);
    assert.ok(
      item.actorDelta <= 3,
      `${item.id}: model must align with its link (${item.actorDelta}px)`,
    );
    assert.ok(Math.abs(item.anchorY - row[0].anchorY) <= 1, "Keep all seven models in one row");
    assert.ok(item.left >= 0 && item.right <= item.screenWidth + 1);
    assert.ok(item.top >= 0 && item.bottom <= item.screenHeight + 1);
    assert.ok(item.height >= 44 && item.width >= 32, `${item.id}: service hit target`);
    assert.ok(item.tappable, `${item.id}: link must be clickable at the visible model`);
    if (index) assert.ok(row[index - 1].right <= item.left + 1, "Avoid overlapping service links");
    const url = new URL(item.href);
    assert.equal(url.pathname, `/services/${routes[item.id]}/`);
    assert.equal(url.searchParams.get("from"), "galaxy");
    assert.equal(url.searchParams.get("layout"), layout);
  }
}

for (const { path, layout, width, height, mobile } of [
  { path: "/explore.html", layout: "atom", width: 1140, height: 900, mobile: false },
  { path: "/home/", layout: "planets", width: 390, height: 844, mobile: true },
  { path: "/home/", layout: "atom", width: 320, height: 568, mobile: true },
]) {
  test(
    `Galaxy ${layout} forms a service row on native ${mobile ? "touch" : "wheel"} scrolling at ${width}px`,
    { timeout: 90000 },
    async () => {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const start = new URL(`${path}?layout=${layout}&focus=automation&sceneDebug=1`, origin);
        await page.goto(start.href, { waitUntil: "domcontentloaded" });
        await connectScene(page);
        await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
        const formation = page.locator(
          ".galaxy-hero.is-service-row:not(.is-service-row-transitioning)",
        );
        const overview = page.locator(
          ".galaxy-hero.webgl-ready:not(.is-service-row):not(.is-service-row-transitioning)",
        );
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await overview.waitFor();
        await rememberOverviewSpheres(page);
        const before = await page.evaluate(async () => {
          await document.fonts.ready;
          const hero = document.querySelector(".galaxy-hero");
          const scrollTest = { inputs: [], formedRow: false, animated: false, quizStarted: false };
          for (const type of ["wheel", "touchmove"]) {
            document.addEventListener(
              type,
              (event) => {
                scrollTest.inputs.push({
                  canceled: event.defaultPrevented,
                  trusted: event.isTrusted,
                  canvas: event.target.id === "galaxy-canvas",
                });
              },
              { passive: true },
            );
          }
          new MutationObserver((records) => {
            const classes = [hero.className, ...records.map((record) => record.oldValue)].join(" ");
            scrollTest.formedRow ||= /\bis-service-row\b/.test(classes);
            scrollTest.animated ||= /\bis-service-row-transitioning\b/.test(classes);
            scrollTest.quizStarted ||= /is-(?:3d-mode|quiz-transitioning)/.test(classes);
          }).observe(hero, {
            attributes: true,
            attributeFilter: ["class"],
            attributeOldValue: true,
          });
          window.galaxyTest.scrollTest = scrollTest;
          window.galaxyTest.focusBeforeScroll = document.activeElement;
          return { scroll: scrollY, history: history.length };
        });

        const enterRow = async () => {
          for (let step = 0; step < 5 && !(await formation.isVisible()); step += 1) {
            await scrollGalaxy(page, mobile, 110);
            if (await page.locator(".galaxy-hero.is-service-row-transitioning").isVisible()) break;
          }
          await formation.waitFor();
          await page.locator(".galaxy-service-row").waitFor();
          await assertServiceRow(page, layout);
        };
        await enterRow();
        assert.ok((await page.evaluate(() => scrollY)) > before.scroll);
        for (let step = 0; step < 8 && (await page.evaluate(() => scrollY)) > 1; step += 1) {
          await scrollGalaxy(page, mobile, -150);
        }
        await overview.waitFor();
        assert.ok((await page.evaluate(() => scrollY)) <= 1, "Scrolling up must return to Galaxy");
        assert.equal(await page.locator(retiredQuizControls).count(), 0);
        assert.ok(await page.locator("#service-preview").isVisible());
        assert.equal(
          await page.locator("#services a[data-galaxy-service-link]:visible").count(),
          PLANET_IDS.length,
        );
        const state = await page.evaluate(() => {
          const { galaxy, appState, overviewSpheres, scrollTest, focusBeforeScroll } =
            window.galaxyTest;
          return {
            layout: galaxy.layout,
            selected: appState.selectedPlanet,
            rootVisible: galaxy.root.visible,
            ids: Object.keys(galaxy.rescueRigObjects),
            persistent: Object.entries(overviewSpheres).every(
              ([id, original]) =>
                galaxy.rescueRigObjects[id] === original.sphere &&
                original.sphere.parent === original.parent &&
                original.sphere.userData.presentation === original.presentation &&
                original.presentation.shell === original.shell &&
                original.presentation.model === original.model &&
                galaxy.planetMeshes.includes(original.collider),
            ),
            history: history.length,
            focusUnchanged: document.activeElement === focusBeforeScroll,
            ...scrollTest,
          };
        });
        assert.equal(state.layout, layout);
        assert.equal(state.selected, "automation");
        assert.deepEqual(state.ids, PLANET_IDS);
        assert.ok(state.rootVisible && state.persistent && state.focusUnchanged);
        assert.equal(state.history, before.history);
        assert.ok(state.formedRow && state.animated);
        assert.equal(state.quizStarted, false);
        assert.ok(
          state.inputs.length >= 2 &&
            state.inputs.some(({ canvas }) => canvas) &&
            state.inputs.every(({ canceled, trusted }) => trusted && !canceled),
          "Native touch or wheel input must remain uncanceled, including over the canvas",
        );

        const launch = page.locator(".hero-actions").getByRole("link", { name: "Services" });
        await launch.click();
        await formation.waitFor();
        await assertServiceRow(page, layout);
        const back = page.locator("[data-exit-service-row]");
        assert.ok(await back.isVisible());
        if (!mobile) {
          await back.click();
          await overview.waitFor();
          await page.waitForFunction(() => scrollY <= 1);
          await page.waitForURL((url) => url.hash === "#top");
          assert.ok(await launch.evaluate((link) => document.activeElement === link));
          await launch.press("Enter");
          await page.waitForURL((url) => url.hash === "#service-row");
          await formation.waitFor();
          await assertServiceRow(page, layout);
          assert.ok(
            await page
              .locator(".galaxy-service-row a[data-galaxy-service-link]")
              .first()
              .evaluate((link) => document.activeElement === link),
            "Keyboard entry must focus the first service",
          );
        }
        const service = page.locator('.galaxy-service-row a[data-galaxy-service-link="pqc"]');
        assert.equal(await service.count(), 1);
        const orb = service.locator(".galaxy-service-row-orb");
        await page.evaluate(() => {
          const { galaxy, THREE } = window.galaxyTest;
          const target = galaxy.rescueRigObjects.pqc;
          new MutationObserver((records) => {
            if (
              !records.some(({ addedNodes }) =>
                [...addedNodes].some((node) => node.classList?.contains("galaxy-dive")),
              )
            )
              return;
            const center = target.getWorldPosition(new THREE.Vector3());
            window.galaxyTest.rowDive = {
              target,
              center,
              distance: galaxy.camera.position.distanceTo(center),
            };
          }).observe(document.body, { childList: true });
        });
        const waitForRowDive = () =>
          page.waitForFunction(() => {
            const { galaxy, rowDive, THREE } = window.galaxyTest ?? {};
            if (!rowDive) return false;
            const dive = window.__sceneDebug.getSnapshot().dive;
            const overlay = document.querySelector(".galaxy-dive");
            const center = rowDive.target.getWorldPosition(new THREE.Vector3());
            return (
              dive?.serviceId === "pqc" &&
              Number(overlay?.style.getPropertyValue("--dive-progress")) > 0.06 &&
              center.distanceTo(rowDive.center) < 0.01 &&
              galaxy.camera.position.distanceTo(center) < rowDive.distance - 0.1
            );
          });
        if (!mobile) {
          await Promise.all([waitForRowDive(), service.press("Enter")]);
          await page.keyboard.press("Escape");
          await page.locator(".galaxy-dive").waitFor({ state: "detached" });
          assert.equal(new URL(page.url()).pathname, path);
          await assertServiceRow(page, layout);
          assert.ok(await service.evaluate((link) => document.activeElement === link));
        }
        await Promise.all([
          page.waitForURL((url) => url.pathname === "/services/post-quantum-security/"),
          waitForRowDive(),
          mobile ? orb.tap() : service.press("Enter"),
        ]);
        const destination = new URL(page.url());
        assert.equal(destination.searchParams.get("from"), "galaxy");
        assert.equal(destination.searchParams.get("layout"), layout);
        if (path === "/home/") assert.equal(destination.searchParams.get("theme"), "light");
        const returnUrl = new URL(
          await page.locator("[data-galaxy-return]").getAttribute("href"),
          origin,
        );
        assert.equal(returnUrl.searchParams.get("layout"), layout);
        assert.equal(returnUrl.searchParams.get("focus"), "pqc");
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    },
  );
}

test("Galaxy contact returns to the live scene on a narrow phone", async () => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const contactUrl = new URL("/explore.html?layout=atom&focus=pqc#contact", origin);
  const returnLink = page.locator("#contact a[data-back-to-galaxy]");
  try {
    await page.goto(contactUrl.href, { waitUntil: "domcontentloaded" });
    assert.equal(await returnLink.getAttribute("href"), "#top");
    assert.equal((await returnLink.textContent()).trim(), "Back to Galaxy");
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    await returnLink.waitFor();
    const hit = await returnLink.evaluate((link) => {
      const { left, top, width, height } = link.getBoundingClientRect();
      const x = left + width / 2;
      const y = top + height / 2;
      return link.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    });
    assert.ok(hit, "Back to Galaxy must be tappable without scrolling from #contact");
    await page.touchscreen.tap(hit.x, hit.y);
    await page.waitForURL((url) => url.hash === "#top");
    await page.waitForFunction(() => scrollY <= 1);
    await page.locator(".galaxy-hero.webgl-ready").waitFor({ timeout: 45000 });
    await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).search, contactUrl.search);
    assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin);
    assert.ok(await page.locator('#galaxy-layout input[value="atom"]').isChecked());
    assert.equal(await page.locator('[data-planet="pqc"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(retiredQuizControls).count(), 0);
    const contact = page
      .locator(".hero-actions")
      .getByRole("link", { name: "Discuss your project" });
    await Promise.all([page.waitForURL((url) => url.pathname === "/contact/"), contact.tap()]);
    assert.equal(await page.locator("#inquiry-form").getAttribute("action"), "/api/inquiries");
  } finally {
    await context.close();
  }
});

for (const javaScriptEnabled of [true, false]) {
  test(`Galaxy old quiz links reach Services with JavaScript ${javaScriptEnabled ? "on" : "off"}`, async () => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      javaScriptEnabled,
    });
    const page = await context.newPage();
    try {
      for (const [index, fragment] of [
        "project-quiz",
        "quiz-answers",
        "fingerprint",
        "result",
      ].entries()) {
        const path = index < 2 ? "/explore.html" : "/home/";
        const start = new URL(`${path}?layout=atom&focus=pqc#${fragment}`, origin);
        await page.goto(start.href, { waitUntil: "domcontentloaded" });
        const destination = new URL(start);
        if (javaScriptEnabled) destination.hash = "#services";
        await page.waitForURL(destination.href);
        await page.waitForFunction(() => {
          const header = document.querySelector(".site-header").getBoundingClientRect();
          const service = document
            .querySelector('#services [data-galaxy-service-link="pqc"]')
            .getBoundingClientRect();
          return service.top >= header.bottom && service.bottom <= innerHeight;
        });
        assert.equal(await page.locator(retiredQuizControls).count(), 0);
        assert.equal(
          await page.locator("#services [data-galaxy-service-link]:visible").count(),
          PLANET_IDS.length,
        );
        assert.equal(await page.locator(`#services > #${fragment}`).count(), 1);
      }
      const historyBefore = await page.evaluate(() => history.length);
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).hash, javaScriptEnabled ? "#services" : "#result");
      assert.equal(await page.evaluate(() => history.length), historyBefore);
    } finally {
      await context.close();
    }
  });
}

test("Galaxy return stays available across mobile service journeys", async () => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const galaxy = new URL("/explore.html?layout=planets&forceFallback=1", origin);
  const headerReturn = page.locator("header [data-studio-galaxy-return]");
  const journeys = [
    {
      service: "automation",
      hops: [
        {
          link: '.galaxy-service-hero-actions a[href^="/contact/"]',
          path: "/contact/",
          focus: "automation",
          inquiry: "integrations",
        },
      ],
    },
    {
      service: "firmware",
      hops: [
        {
          link: '.galaxy-service-actions a[href$="#pricing"]',
          path: "/services/",
          focus: "firmware",
          hash: "#pricing",
        },
      ],
    },
    {
      service: "hardware",
      hops: [
        {
          link: '.galaxy-service-actions a[href^="/services/support/"]',
          path: "/services/support/",
          focus: "hardware",
        },
      ],
    },
    {
      service: "pqc",
      hops: [
        {
          link: "[data-galaxy-related]",
          path: "/services/backend-api/",
          focus: "backend",
          related: true,
        },
        {
          link: ".header-contact",
          path: "/contact/",
          focus: "backend",
          inquiry: "integrations",
        },
      ],
    },
  ];

  async function follow(link, path) {
    await Promise.all([
      page.waitForURL((destination) => destination.pathname === path),
      page.locator(link).tap(),
    ]);
    return new URL(page.url());
  }

  async function assertHeaderReturn(focus) {
    await headerReturn.waitFor({ state: "visible" });
    const url = new URL(await headerReturn.getAttribute("href"), origin);
    assert.equal(url.pathname, "/explore.html");
    assert.equal(url.searchParams.get("layout"), "planets");
    assert.equal(url.searchParams.get("focus"), focus);
    const visibleAtBottom = await headerReturn.evaluate(async (link) => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const { left, top, right, bottom, width, height } = link.getBoundingClientRect();
      return (
        scrollY > 0 &&
        left >= 0 &&
        top >= 0 &&
        right <= innerWidth &&
        bottom <= innerHeight &&
        link.contains(document.elementFromPoint(left + width / 2, top + height / 2))
      );
    });
    assert.ok(visibleAtBottom, `Galaxy return must stay reachable after scrolling ${page.url()}`);
  }

  try {
    for (const { service, hops } of journeys) {
      await page.goto(galaxy.href, { waitUntil: "domcontentloaded" });
      await page.locator(".galaxy-fallback").waitFor();
      const detail = await follow(
        `#services [data-galaxy-service-link="${service}"]`,
        `/services/${routes[service]}/`,
      );
      assert.equal(detail.searchParams.get("from"), "galaxy");
      assert.equal(detail.searchParams.get("layout"), "planets");
      await assertHeaderReturn(service);

      for (const { link, path, focus, inquiry, hash, related } of hops) {
        const destination = await follow(link, path);
        assert.equal(destination.searchParams.get("layout"), "planets");
        if (!related) {
          assert.equal(destination.searchParams.get("from"), "galaxy");
          assert.equal(destination.searchParams.get("focus"), focus);
        }
        if (hash) {
          assert.equal(destination.hash, hash);
          await page.locator(hash).waitFor();
        }
        if (inquiry) {
          await page.waitForFunction(
            (service) => document.querySelector("#inquiry-service")?.value === service,
            inquiry,
          );
        }
        await assertHeaderReturn(focus);
      }
    }

    await Promise.all([
      page.waitForURL(
        (destination) =>
          destination.pathname === "/explore.html" &&
          destination.searchParams.get("layout") === "planets" &&
          destination.searchParams.get("focus") === "backend",
        { waitUntil: "commit" },
      ),
      headerReturn.tap(),
    ]);
  } finally {
    await context.close();
  }
});

async function assertHardwareOverview(page, theme) {
  await connectScene(page);
  await page.locator("#galaxy-loading").waitFor({ state: "hidden" });
  const state = await page.evaluate(() => {
    const { galaxy, appState } = window.galaxyTest;
    const canvas = galaxy.renderer.domElement.getBoundingClientRect();
    return {
      light: document.documentElement.dataset.galaxyTheme === "light",
      background: getComputedStyle(document.body).backgroundColor,
      focus: appState.selectedPlanet,
      layout: galaxy.layout,
      models: Object.entries(galaxy.rescueRigObjects)
        .filter(([, sphere]) => sphere.visible && sphere.userData.presentation.shell.visible)
        .map(([id]) => id),
      draws: galaxy.renderer.info.render.calls,
      fitsViewport:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <=
          innerWidth + 1 &&
        canvas.left >= -1 &&
        canvas.right <= innerWidth + 1 &&
        Math.min(canvas.bottom, innerHeight) - Math.max(canvas.top, 0) >= 240,
    };
  });
  const url = new URL(page.url());
  assert.equal(url.pathname, theme === "light" ? "/home/" : "/explore.html");
  assert.equal(url.searchParams.get("layout"), "planets");
  assert.equal(url.searchParams.get("focus"), "hardware");
  assert.equal(state.light, theme === "light");
  if (state.light) {
    const background = state.background.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    assert.ok(
      background.length === 3 && Math.min(...background) >= 180,
      `Light Galaxy needs a light page background: ${state.background}`,
    );
  }
  assert.equal(state.focus, "hardware");
  assert.equal(state.layout, "planets");
  assert.deepEqual(state.models.sort(), [...PLANET_IDS].sort());
  assert.ok(state.draws > 0, "Galaxy must render live 3D models");
  assert.ok(state.fitsViewport, "The Galaxy canvas must fit on a narrow phone");

  const toggle = page.locator("header .galaxy-theme-toggle");
  assert.ok(await toggle.isVisible(), "The theme switch must be visible with the menu closed");
  assert.equal(await page.locator("#nav-toggle").getAttribute("aria-expanded"), "false");
  const current = toggle.locator('[aria-current="page"]');
  assert.equal(await current.count(), 1);
  assert.equal((await current.textContent()).trim(), state.light ? "Light" : "Dark");
  assert.equal(await toggle.getByRole("link").count(), 1);
  const link = toggle.getByRole("link", { name: state.light ? "Dark" : "Light", exact: true });
  assert.equal(
    new URL(await link.getAttribute("href"), origin).pathname,
    state.light ? "/explore.html" : "/home/",
  );
  const fitsHeader = await toggle.evaluate((control) =>
    [...control.querySelectorAll('[aria-current="page"], a[href]')].every((element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return (
        width > 0 &&
        height > 0 &&
        left >= 0 &&
        right <= innerWidth &&
        top >= 0 &&
        bottom <= innerHeight &&
        (!element.matches("a") ||
          element.contains(document.elementFromPoint(left + width / 2, top + height / 2)))
      );
    }),
  );
  assert.ok(fitsHeader, "Both theme options must fit in the header without an overlay");
}

test("Galaxy light Home renders and returns from Hardware on a 320px phone", async () => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  try {
    const start = new URL("/home/?layout=planets&focus=hardware&sceneTime=1.25", origin);
    await page.goto(start.href, { waitUntil: "domcontentloaded" });
    await assertHardwareOverview(page, "light");

    const point = await spherePoint(page, "hardware");
    await inspectSphere(page, point, "hardware");
    await Promise.all([
      page.locator(".galaxy-dive").waitFor({ state: "visible" }),
      page.waitForURL((url) => url.pathname === "/services/hardware/"),
      page.touchscreen.tap(point.x, point.y),
    ]);
    const service = new URL(page.url());
    assert.equal(service.searchParams.get("from"), "galaxy");
    assert.equal(service.searchParams.get("layout"), "planets");
    assert.equal(service.searchParams.get("theme"), "light");

    const back = page.locator("[data-galaxy-return]");
    const returnUrl = new URL(await back.getAttribute("href"), origin);
    assert.equal(returnUrl.pathname, "/home/");
    assert.equal(returnUrl.searchParams.get("layout"), "planets");
    assert.equal(returnUrl.searchParams.get("focus"), "hardware");
    await Promise.all([page.waitForURL((url) => url.pathname === "/home/"), back.tap()]);
    await assertHardwareOverview(page, "light");
  } finally {
    await context.close();
  }
});

test("Galaxy header switches dark to light and back with context on a 390px phone", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    const start = new URL("/explore.html?layout=planets&focus=hardware", origin);
    await page.goto(start.href, { waitUntil: "domcontentloaded" });
    await assertHardwareOverview(page, "dark");
    for (const [label, path, theme] of [
      ["Light", "/home/", "light"],
      ["Dark", "/explore.html", "dark"],
    ]) {
      const link = page
        .locator("header .galaxy-theme-toggle")
        .getByRole("link", { name: label, exact: true });
      await Promise.all([page.waitForURL((url) => url.pathname === path), link.tap()]);
      await assertHardwareOverview(page, theme);
    }
  } finally {
    await context.close();
  }
});

test("Starworld returns to the same Galaxy context on a narrow phone", async () => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  function assertContext(url, path) {
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, path);
    assert.equal(url.searchParams.get("layout"), "planets");
    assert.equal(url.searchParams.get("focus"), "automation");
  }

  async function follow(link, path) {
    await Promise.all([
      page.waitForURL((destination) => destination.pathname === path, { waitUntil: "commit" }),
      link.tap(),
    ]);
    const destination = new URL(page.url());
    assertContext(destination, path);
    return destination;
  }

  try {
    const start = new URL("/explore.html?layout=planets&focus=automation&forceFallback=1", origin);
    await page.goto(start.href, { waitUntil: "domcontentloaded" });
    await page.locator(".galaxy-fallback").waitFor();
    const light = page.locator(".galaxy-theme-toggle").getByRole("link", { name: "Light" });
    const home = await follow(light, "/home/");
    assert.equal(home.searchParams.get("from"), "galaxy");
    await page.waitForLoadState("domcontentloaded");
    const themeLink = page.locator("footer").getByRole("link", { name: "Use device theme" });
    assert.equal(
      new URL(await themeLink.getAttribute("href"), origin).searchParams.has("theme"),
      false,
    );
    const starworld = await follow(
      page.locator("footer").getByRole("link", { name: "Starworld service map" }),
      "/starworld.html",
    );
    assert.equal(starworld.searchParams.get("from"), "galaxy");
    assert.equal(starworld.searchParams.get("theme"), "light");
    await page.waitForLoadState("domcontentloaded");
    const themeStart = new URL(
      await page.locator("#device-theme-link").getAttribute("href"),
      origin,
    );
    assertContext(themeStart, "/");
    assert.equal(themeStart.searchParams.has("theme"), false);

    const header = page.locator("#nav-galaxy");
    const footer = page.locator("#site-galaxy");
    for (const link of [header, footer]) {
      await link.waitFor({ state: "visible" });
      assertContext(new URL(await link.getAttribute("href"), origin), "/home/");
    }
    const canTap = await header.evaluate((link) => {
      const { left, top, right, bottom, width, height } = link.getBoundingClientRect();
      return (
        left >= 0 &&
        top >= 0 &&
        right <= innerWidth &&
        bottom <= innerHeight &&
        height >= 44 &&
        link.contains(document.elementFromPoint(left + width / 2, top + height / 2))
      );
    });
    assert.ok(canTap, "The Starworld header Galaxy link must have a reachable touch target");
    await follow(header, "/home/");
  } finally {
    await context.close();
  }
});

test("The start chooser and Starworld offer native Galaxy links without JavaScript", async () => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.goto(new URL("/", origin).href, { waitUntil: "domcontentloaded" });
    const galaxy = page.locator('nav a[href="/explore.html"]');
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/explore.html", { waitUntil: "commit" }),
      galaxy.tap(),
    ]);

    await page.goto(new URL("/starworld.html", origin).href, { waitUntil: "domcontentloaded" });
    for (const selector of ["#nav-galaxy", "#site-galaxy"]) {
      const link = page.locator(selector);
      await link.waitFor({ state: "visible" });
      assert.equal(await link.getAttribute("href"), "https://levnat.ca/explore.html");
    }
  } finally {
    await context.close();
  }
});
