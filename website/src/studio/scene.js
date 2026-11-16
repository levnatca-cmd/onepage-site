import * as THREE from "/vendor/three/three.module.min.js";
import { createLabState, deriveLab, LAB_THEMES } from "./lab/state.js";
import { refreshIcons } from "./icons.js";

function outline(width, height, radius = 0.18) {
  const shape = new THREE.Shape(),
    x = -width / 2,
    y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function slab(width, height, depth, material, radius = 0.18) {
  const geometry = new THREE.ExtrudeGeometry(outline(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.055,
    bevelThickness: 0.055,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function displayTexture(label, value, accent = "#4261f2") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#171b21";
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = accent;
  ctx.fillRect(28, 28, 456, 7);
  ctx.font = "500 30px Arial, sans-serif";
  ctx.fillStyle = "#c0c8d3";
  ctx.fillText(label, 32, 91);
  ctx.font = "600 112px Arial, sans-serif";
  ctx.fillStyle = "#f4f6fa";
  ctx.fillText(value, 26, 237);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createEngineeringScene({ lab } = {}) {
  const mount = document.querySelector("#engineering-scene");
  if (!mount) return;
  const hero = mount.closest(".home-hero"),
    pause = document.querySelector("[data-scene-pause]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let model = lab?.getState() || createLabState();
  const status = {
    ready: false,
    frames: 0,
    mode: model.mode,
    paused: false,
    inView: true,
    reducedMotion: reduced.matches,
  };
  Object.defineProperty(window, "__studioScene", {
    configurable: true,
    get: () => ({ ...status }),
  });
  let renderer;
  function syncPause() {
    if (!pause) return;
    pause.disabled = !status.ready || reduced.matches;
    pause.setAttribute("aria-pressed", String(status.paused));
    const label = !status.ready
      ? "3D unavailable"
      : reduced.matches
        ? "3D motion disabled by device preference"
        : status.paused
          ? "Resume 3D motion"
          : "Pause 3D motion";
    pause.setAttribute("aria-label", label);
    pause.title = label;
  }
  function fallback() {
    status.ready = false;
    mount.dataset.ready = "false";
    syncPause();
  }
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    fallback();
    return;
  }
  renderer.setClearColor(0xeff1f5, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100);
  camera.position.set(8, 10, 16);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const system = new THREE.Group();
  scene.add(system);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x687889, 3.1));
  const key = new THREE.DirectionalLight(0xffffff, 4.2);
  key.position.set(-5, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const edge = new THREE.DirectionalLight(0xc2d3ff, 2.2);
  edge.position.set(8, 3, -6);
  scene.add(edge);
  const studio = document.createElement("canvas");
  studio.width = 1024;
  studio.height = 512;
  const context = studio.getContext("2d");
  context.fillStyle = "#647383";
  context.fillRect(0, 0, 1024, 512);
  context.fillStyle = "#ffffff";
  context.fillRect(80, 25, 170, 440);
  context.fillRect(520, 35, 360, 160);
  context.fillStyle = "#111820";
  context.fillRect(300, 210, 150, 270);
  const environmentSource = new THREE.CanvasTexture(studio);
  environmentSource.colorSpace = THREE.SRGBColorSpace;
  environmentSource.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = pmrem.fromEquirectangular(environmentSource);
  scene.environment = environment.texture;
  const silver = new THREE.MeshStandardMaterial({
    color: 0xe0e7ee,
    metalness: 0.9,
    roughness: 0.24,
    envMapIntensity: 1.2,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b242e, metalness: 0.65, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x4261f2,
    metalness: 0.25,
    roughness: 0.3,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xc4f563,
    emissive: 0x87ab32,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const inactive = new THREE.MeshStandardMaterial({
    color: 0xa9b4bf,
    metalness: 0.45,
    roughness: 0.4,
  });
  const danger = new THREE.MeshStandardMaterial({
    color: 0xee7259,
    emissive: 0x752513,
    emissiveIntensity: 0.22,
    metalness: 0.2,
    roughness: 0.3,
  });
  const modules = [],
    displays = [],
    leds = [];
  function createModule(index, label) {
    const group = new THREE.Group();
    group.userData.node = index;
    const base = slab(2.7, 2.5, 0.32, index === 1 ? accent : dark, 0.22);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.42;
    group.add(base);
    const lower = slab(2.34, 2.14, 0.17, silver, 0.16);
    lower.rotation.x = -Math.PI / 2;
    lower.position.y = -0.14;
    group.add(lower);
    const body = slab(2.2, 1.64, 0.26, index === 0 ? silver : dark, 0.16);
    body.position.set(0, 0.8, 0.05);
    group.add(body);
    const material = new THREE.MeshBasicMaterial({
      map: displayTexture(label, "--"),
      toneMapped: false,
    });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.22), material);
    display.position.set(0, 0.8, 0.25);
    group.add(display);
    displays.push(material);
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.065, 0.09), inactive);
    led.position.set(0, 1.52, 0.23);
    group.add(led);
    leds.push(led);
    for (const x of [-0.88, 0.88]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 10), silver);
      pin.position.set(x, -0.12, 0.81);
      group.add(pin);
    }
    if (index === 1)
      for (let i = 0; i < 5; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.54, 1.4), silver);
        fin.position.set(-0.72 + i * 0.36, 0.1, -0.1);
        group.add(fin);
      }
    if (index === 2) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.75, 10), silver);
      antenna.position.set(0.86, 1.95, -0.08);
      group.add(antenna);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 24), accent);
      ring.position.set(0.86, 2.29, -0.08);
      group.add(ring);
    }
    system.add(group);
    modules.push(group);
  }
  ["APP / DAYBOOK", "API / ROUTE", "DELIVERY"].forEach((label, index) =>
    createModule(index, label),
  );
  const curves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.1, -0.25, 0.4),
      new THREE.Vector3(-2.4, -0.4, 1.2),
      new THREE.Vector3(-1.5, -0.4, 1.2),
      new THREE.Vector3(-1.15, -0.25, 0.4),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.1, -0.25, 0.4),
      new THREE.Vector3(1.6, -0.4, 1.2),
      new THREE.Vector3(2.6, -0.4, 1.2),
      new THREE.Vector3(3.1, -0.25, 0.4),
    ]),
  ];
  const cables = curves.map((curve) => {
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.07, 8, false), inactive);
    cable.castShadow = true;
    system.add(cable);
    return cable;
  });
  const packets = curves.map((curve, index) => {
    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), glow);
    packet.userData.offset = index * 0.28;
    system.add(packet);
    return packet;
  });
  const rails = new THREE.Group();
  system.add(rails);
  for (let i = 0; i < 9; i++) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(12.3, 0.018, 0.018),
      new THREE.MeshBasicMaterial({ color: 0xcfd6df, transparent: true, opacity: 0.55 }),
    );
    rail.position.set(0, -0.78, -2.1 + i * 0.6);
    rails.add(rail);
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.ShadowMaterial({ opacity: 0.15 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  ground.receiveShadow = true;
  system.add(ground);
  let elapsed = 0,
    previousTime = 0,
    previousFrame = 0,
    raf = 0,
    signalUntil = 0,
    disposed = false;
  const pointer = { x: 0, y: 0 };
  const targetPositions = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function updateModel() {
    const summary = deriveLab(model);
    accent.color.set(LAB_THEMES[model.theme].color);
    const values = [
      model.built ? "LIVE" : "IDEA",
      model.fault === "api" ? "ERR" : model.connected ? "ON" : "OFF",
      String(summary.delivered).padStart(2, "0"),
    ];
    const labels = [
      "APP / DAYBOOK",
      "API / ROUTE",
      model.fault === "device" ? "DEVICE / OFFLINE" : "DELIVERY",
    ];
    displays.forEach((material, i) => {
      material.map.dispose();
      material.map = displayTexture(
        labels[i],
        values[i],
        model.fault && ((i === 1 && model.fault === "api") || (i === 2 && model.fault === "device"))
          ? "#ee7259"
          : LAB_THEMES[model.theme].color,
      );
      material.needsUpdate = true;
    });
    const nodeValues = [summary.nodes.app, summary.nodes.api, summary.nodes.device];
    leds.forEach((led, i) => {
      led.material =
        nodeValues[i] === "fault" ? danger : nodeValues[i] === "online" ? glow : inactive;
    });
    cables.forEach((cable, i) => {
      cable.material =
        model.fault === (i === 0 ? "api" : "device")
          ? danger
          : model.connected && (i === 0 || !model.fault)
            ? accent
            : inactive;
    });
    const spread = model.built ? 4.2 : 5;
    targetPositions[0].set(-spread, model.mode === "build" ? 0.35 : 0, model.built ? 0 : -0.7);
    targetPositions[1].set(
      0,
      model.mode === "connect" ? 0.6 : 0,
      model.mode === "connect" ? 0.3 : 0,
    );
    targetPositions[2].set(spread, model.mode === "care" ? 0.6 : 0, model.built ? 0 : 0.7);
  }
  function applyPose(instant = false) {
    const quiet = reduced.matches || status.paused || instant;
    modules.forEach((module, index) => {
      if (quiet) module.position.copy(targetPositions[index]);
      else module.position.lerp(targetPositions[index], 0.13);
      if (!quiet) module.position.y += Math.sin(elapsed * 0.9 + index) * 0.008;
      const faulted = model.fault === (index === 1 ? "api" : index === 2 ? "device" : "none");
      module.rotation.z = faulted ? -0.12 : 0;
      module.rotation.y = (index - 1) * -0.06 + (quiet ? 0 : pointer.x * 0.025);
    });
    packets.forEach((packet, index) => {
      packet.visible =
        model.built &&
        model.connected &&
        model.fault !== "api" &&
        (index === 0 || !model.fault) &&
        (elapsed < signalUntil || (status.paused && deriveLab(model).delivered > 0));
      if (packet.visible)
        packet.position.copy(curves[index].getPoint((elapsed * 0.55 + packet.userData.offset) % 1));
      packet.rotation.set(elapsed, elapsed * 0.6, 0);
    });
  }
  function render() {
    if (!status.ready || disposed) return;
    renderer.render(scene, camera);
    status.frames += 1;
  }
  function tick(time) {
    raf = 0;
    if (
      disposed ||
      !status.ready ||
      status.paused ||
      reduced.matches ||
      !status.inView ||
      document.hidden
    )
      return;
    if (time - previousFrame >= 32) {
      elapsed += previousTime ? Math.min(0.05, (time - previousTime) / 1000) : 0;
      previousTime = time;
      previousFrame = time;
      applyPose();
      render();
    }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (
      !raf &&
      status.ready &&
      !disposed &&
      !status.paused &&
      !reduced.matches &&
      status.inView &&
      !document.hidden
    ) {
      previousTime = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    previousTime = 0;
  }
  function resize() {
    const box = mount.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const title = hero.querySelector(".hero-title");
    document.body.classList.toggle(
      "living-large-text",
      parseFloat(getComputedStyle(title).fontSize) > (box.width > 768 ? 120 : 76),
    );
    const compact = box.width < 769;
    const vertical = compact ? (16.6 * box.height) / Math.max(540, box.width * 1.4) : 10.8;
    const horizontal = (vertical * box.width) / box.height;
    camera.left = -horizontal / 2;
    camera.right = horizontal / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const grid = hero.querySelector(".living-grid"),
      copy = hero.querySelector(".hero-content");
    const gridStyle = getComputedStyle(grid);
    const bandHeight = compact
      ? parseFloat(getComputedStyle(grid, "::before").height)
      : parseFloat(gridStyle.paddingBottom);
    const bandTop = compact
      ? copy.getBoundingClientRect().bottom - box.top + parseFloat(gridStyle.rowGap)
      : grid.getBoundingClientRect().bottom - box.top - bandHeight;
    const bandCenter = bandTop + bandHeight / 2;
    system.position
      .copy(right.clone().multiplyScalar(horizontal * 0.02))
      .add(up.clone().multiplyScalar((0.5 - bandCenter / box.height) * vertical));
    system.scale.setScalar(compact ? (bandHeight < 60 ? 0.4 : 0.58) : 1);
    applyPose(true);
    if (!compact) {
      // Fit the actual modules into the open space below the offer, not behind the product.
      system.position.set(0, 0, 0);
      system.updateMatrixWorld(true);
      const points = [];
      for (const module of modules) {
        const bounds = new THREE.Box3().setFromObject(module);
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const point = new THREE.Vector3(x, y, z).project(camera);
              points.push({
                x: ((point.x + 1) * box.width) / 2,
                y: ((1 - point.y) * box.height) / 2,
              });
            }
      }
      const left = Math.min(...points.map((point) => point.x));
      const top = Math.min(...points.map((point) => point.y));
      const width = Math.max(...points.map((point) => point.x)) - left;
      const height = Math.max(...points.map((point) => point.y)) - top;
      const copyBox = copy.getBoundingClientRect();
      const target = {
        x: copyBox.left - box.left + copyBox.width / 2,
        top: copyBox.bottom - box.top + 18,
        bottom: grid.getBoundingClientRect().bottom - box.top - 12,
      };
      const scale = Math.max(
        0.2,
        Math.min(0.82, (copyBox.width - 12) / width, (target.bottom - target.top) / height),
      );
      system.scale.setScalar(scale);
      const centerX = box.width / 2 + (left + width / 2 - box.width / 2) * scale;
      const centerY = box.height / 2 + (top + height / 2 - box.height / 2) * scale;
      system.position
        .copy(right.clone().multiplyScalar(((target.x - centerX) * horizontal) / box.width))
        .add(
          up
            .clone()
            .multiplyScalar(((centerY - (target.top + target.bottom) / 2) * vertical) / box.height),
        );
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.1 : 1.3));
    renderer.setSize(box.width, box.height);
    applyPose(true);
    render();
  }
  const unlisten = lab?.subscribe((next, action, previous) => {
    model = next;
    status.mode = next.mode;
    if (next.sequence > previous.sequence) signalUntil = elapsed + 3.2;
    updateModel();
    if (status.paused || reduced.matches || action.type === "SELECT_MODE") applyPose(true);
    render();
    start();
  });
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  observer.observe(hero.querySelector(".hero-content"));
  const intersection = new IntersectionObserver(([entry]) => {
    status.inView = entry.isIntersecting;
    if (status.inView) start();
    else stop();
  });
  intersection.observe(mount);
  hero.addEventListener("pointermove", (event) => {
    if (reduced.matches || status.paused || innerWidth < 769) return;
    pointer.x = (event.clientX - mount.getBoundingClientRect().left) / mount.clientWidth - 0.5;
  });
  const raycaster = new THREE.Raycaster();
  let down = null;
  function hitModule(event) {
    const box = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        (-(event.clientY - box.top) / box.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(modules, true)[0];
    if (!hit) return null;
    let object = hit.object;
    while (object.parent && object.userData.node === undefined) object = object.parent;
    return object.userData.node ?? null;
  }
  renderer.domElement.addEventListener("pointermove", (event) => {
    const index = hitModule(event);
    renderer.domElement.style.cursor = index === null ? "" : "pointer";
    renderer.domElement.title =
      index === 0
        ? model.built
          ? "View the app"
          : "Build Daybook"
        : index === 1
          ? model.connected
            ? "Disconnect the API"
            : "Connect the API"
          : index === 2
            ? model.fault
              ? "Repair and replay pending requests"
              : model.built && model.connected
                ? "Simulate a device outage"
                : "View device debugging"
            : "";
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    down = [event.clientX, event.clientY];
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 8 || !lab) return;
    down = null;
    const index = hitModule(event);
    if (index === null) return;
    lab.dispatch({ type: "SELECT_MODE", mode: ["build", "connect", "care"][index] });
    if (index === 0 && !model.built) lab.dispatch({ type: "BUILD" });
    if (index === 1 && model.built)
      lab.dispatch({ type: model.connected ? "DISCONNECT" : "CONNECT" });
    if (index === 2 && model.built && model.connected)
      lab.dispatch({ type: model.fault ? "REPAIR" : "FAIL", fault: "device" });
  });
  renderer.domElement.addEventListener("pointercancel", () => {
    down = null;
  });
  pause?.addEventListener("click", () => {
    status.paused = !status.paused;
    syncPause();
    pause.innerHTML = `<i data-lucide="${status.paused ? "play" : "pause"}" aria-hidden="true"></i>`;
    refreshIcons(pause);
    if (status.paused) stop();
    else start();
  });
  reduced.addEventListener("change", () => {
    status.reducedMotion = reduced.matches;
    syncPause();
    if (reduced.matches) {
      stop();
      applyPose(true);
      render();
    } else start();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
    fallback();
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    environment.dispose();
    environment = pmrem.fromEquirectangular(environmentSource);
    scene.environment = environment.texture;
    status.ready = true;
    mount.dataset.ready = "true";
    syncPause();
    updateModel();
    resize();
    start();
  });
  status.ready = true;
  mount.dataset.ready = "true";
  syncPause();
  updateModel();
  applyPose(true);
  resize();
  start();
  window.addEventListener("pagehide", (event) => {
    stop();
    if (event.persisted) return;
    disposed = true;
    unlisten?.();
    observer.disconnect();
    intersection.disconnect();
    const materials = new Set(),
      geometries = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
    environment.dispose();
    environmentSource.dispose();
    pmrem.dispose();
    renderer.dispose();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) start();
  });
}
