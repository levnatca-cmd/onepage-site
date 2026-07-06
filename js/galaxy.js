// Three.js scene: setup, geometry builders, frame loop, pointer interaction.
// Reads/mutates the shared `galaxy` and `appState` singletons from state.js.

import * as THREE from "../three.module.min.js";

import {
  VISUAL_COLORS,
  QUALITY_CONFIG,
  BRIDGE_SEGMENTS
} from "./data/config.js?v=wow21";
import {
  PLANETS,
  PLANET_IDS,
  QUESTION_FLOW,
  CHOICE_VISUALS,
  CHOICE_MOTION_GROUPS,
  SCALE_STAGES,
  ARCHETYPES
} from "./data/quiz-data.js?v=wow21";
import { appState, galaxy } from "./state.js?v=wow21";
import {
  updateChoiceHud,
  focusPlanet,
  inferPlanet,
  findChoiceIndex,
  canGoBackIn3D,
  goToPrevious3DQuestion,
  select3DChoice
} from "./ui.js?v=wow21";

// ---------- Scene init ----------

export function initGalaxyScene() {
  const canvas = document.getElementById("galaxy-canvas");
  const hero = document.querySelector(".galaxy-hero");

  if (!canvas || !window.WebGLRenderingContext) {
    hero.classList.add("no-webgl");
    return;
  }

  hero.classList.add("is-loading");
  const loading = document.getElementById("galaxy-loading");
  if (loading) loading.hidden = false;

  galaxy.scene = new THREE.Scene();
  galaxy.scene.fog = new THREE.FogExp2(0x080a0f, 0.035);
  galaxy.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  galaxy.camera.position.set(0, 8.2, 14.5);
  galaxy.camera.lookAt(0, 0, 0);

  galaxy.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  galaxy.renderer.setPixelRatio(getRenderPixelRatio());
  galaxy.renderer.setClearColor(0x080a0f, 0);
  galaxy.renderer.outputColorSpace = THREE.SRGBColorSpace;
  galaxy.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  galaxy.renderer.toneMappingExposure = 1.24;

  galaxy.root = new THREE.Group();
  galaxy.root.position.x = 1.15;
  galaxy.root.rotation.x = -0.32;
  galaxy.root.rotation.z = 0.08;
  galaxy.scene.add(galaxy.root);

  const ambient = new THREE.AmbientLight(0xd8e8f2, 0.48);
  galaxy.scene.add(ambient);

  const key = new THREE.PointLight(VISUAL_COLORS.accent, 2.8, 25);
  key.position.set(0, 0, 0);
  galaxy.root.add(key);

  const rim = new THREE.PointLight(VISUAL_COLORS.soft, 0.95, 28);
  rim.position.set(-5, 5, 6);
  galaxy.scene.add(rim);

  createProductStar();
  createOrbitalRibbons();
  createSystemPlanets();
  createRescueRig();
  createLightBridges();
  createSignalParticles();
  createAnomalies();
  createInteractionLayer();
  createAnswerDeck();
  resizeGalaxy();

  window.addEventListener("resize", resizeGalaxy);
  bindCanvasInteraction(canvas);
  appState.webglReady = true;
  animateGalaxy();
  scheduleIdleGeometry();
  const clearLoading = function () {
    hero.classList.remove("is-loading");
    if (loading) loading.hidden = true;
  };
  requestAnimationFrame(clearLoading);
  window.setTimeout(clearLoading, 420);
}

function scheduleIdleGeometry() {
  runWhenIdle(createStarField, 450);
  runWhenIdle(createMathematicalGrid, 700);
  runWhenIdle(createVectorField, 900);
}

function runWhenIdle(task, timeout) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(task, { timeout });
    return;
  }
  window.setTimeout(task, 16);
}

// ---------- Background geometry ----------

function createStarField() {
  const count = getStarCount();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    [0.62, 0.92, 1],
    [0.9, 0.96, 1]
  ];
  for (let i = 0; i < count; i += 1) {
    const radius = 18 + Math.random() * 32;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.55;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[i % palette.length];
    const brightness = 0.42 + Math.random() * 0.46;
    colors[i * 3] = color[0] * brightness;
    colors[i * 3 + 1] = color[1] * brightness;
    colors[i * 3 + 2] = color[2] * brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.026,
    transparent: true,
    opacity: 0.46,
    vertexColors: true,
    depthWrite: false
  });
  galaxy.scene.add(new THREE.Points(geometry, material));
}

function getStarCount() {
  if (window.innerWidth < QUALITY_CONFIG.trueMobileWidth) return 650;
  if (window.innerWidth < 760) return 800;
  return 1200;
}

function getRenderPixelRatio() {
  const canvas = galaxy.renderer ? galaxy.renderer.domElement : document.getElementById("galaxy-canvas");
  const width = canvas ? canvas.clientWidth || window.innerWidth : window.innerWidth;
  const height = canvas ? canvas.clientHeight || window.innerHeight : window.innerHeight;
  const nativeRatio = window.devicePixelRatio || 1;
  const trueMobile = window.innerWidth < QUALITY_CONFIG.trueMobileWidth;
  const compact = window.innerWidth < 760;
  const targetWidth = trueMobile
    ? width * QUALITY_CONFIG.mobilePixelRatioCap
    : compact
      ? QUALITY_CONFIG.compactTargetWidth
      : QUALITY_CONFIG.desktopTargetWidth;
  const cap = trueMobile
    ? QUALITY_CONFIG.mobilePixelRatioCap
    : compact
      ? QUALITY_CONFIG.compactPixelRatioCap
      : QUALITY_CONFIG.desktopPixelRatioCap;
  const targetRatio = targetWidth / Math.max(width, 1);
  const maxCanvasSide = galaxy.renderer ? galaxy.renderer.capabilities.maxTextureSize : 8192;
  const sizeCap = maxCanvasSide / Math.max(width, height, 1);
  return Math.min(cap, sizeCap, Math.max(nativeRatio, targetRatio));
}

function createMathematicalGrid() {
  const group = new THREE.Group();
  const segments = [];
  const extent = 11;
  const step = 1.25;

  for (let value = -extent; value <= extent; value += step) {
    segments.push(-extent, -0.92, value, extent, -0.92, value);
    segments.push(value, -0.92, -extent, value, -0.92, extent);
  }

  segments.push(-extent, 0, 0, extent, 0, 0);
  segments.push(0, -extent * 0.22, 0, 0, extent * 0.22, 0);
  segments.push(0, 0, -extent, 0, 0, extent);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x6fb6d6,
    transparent: true,
    opacity: 0.07
  });
  const grid = new THREE.LineSegments(geometry, material);
  grid.rotation.x = -0.05;
  group.add(grid);

  const axisGeometry = new THREE.BufferGeometry();
  axisGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -extent, 0.02, 0, extent, 0.02, 0,
      0, -1.8, 0, 0, 1.8, 0,
      0, 0.02, -extent, 0, 0.02, extent
    ], 3)
  );
  const axis = new THREE.LineSegments(
    axisGeometry,
    new THREE.LineBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.16
    })
  );
  group.add(axis);
  galaxy.root.add(group);
}

function createVectorField() {
  const vectors = [];
  const base = [];
  const rings = [3.2, 4.8, 6.4, 8.0, 9.6];

  rings.forEach(function (radius, ringIndex) {
    const count = 18 + ringIndex * 4;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const tangent = new THREE.Vector3(-Math.sin(angle), 0.08 * Math.sin(angle * 2), Math.cos(angle)).normalize();
      const length = 0.3 + ringIndex * 0.025;
      vectors.push(x, -0.45 + ringIndex * 0.04, z, x + tangent.x * length, -0.45 + ringIndex * 0.04 + tangent.y * length, z + tangent.z * length);
      base.push({ angle, radius, length, ringIndex });
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vectors, 3));
  const material = new THREE.LineBasicMaterial({
    color: VISUAL_COLORS.muted,
    transparent: true,
    opacity: 0.14
  });
  galaxy.vectorField = new THREE.LineSegments(geometry, material);
  galaxy.vectorField.userData.base = base;
  galaxy.root.add(galaxy.vectorField);
}

function createProductStar() {
  const starGeometry = new THREE.IcosahedronGeometry(1.1, 5);
  const starMaterial = new THREE.MeshStandardMaterial({
    color: VISUAL_COLORS.text,
    emissive: VISUAL_COLORS.accent,
    emissiveIntensity: 1.65,
    roughness: 0.22,
    metalness: 0.28
  });
  galaxy.star = new THREE.Mesh(starGeometry, starMaterial);
  galaxy.root.add(galaxy.star);

  const wireGeometry = new THREE.IcosahedronGeometry(1.135, 4);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.text,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });
  const wire = new THREE.Mesh(wireGeometry, wireMaterial);
  galaxy.star.add(wire);

  const haloGeometry = new THREE.SphereGeometry(1.7, 96, 64);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.accent,
    transparent: true,
    opacity: 0.055,
    depthWrite: false
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  galaxy.root.add(halo);

  galaxy.starRings = new THREE.Group();
  [
    { radius: 1.95, tube: 0.009, color: VISUAL_COLORS.accent, opacity: 0.26, x: 1.4, y: 0.16 },
    { radius: 2.3, tube: 0.008, color: VISUAL_COLORS.soft, opacity: 0.14, x: 1.08, y: -0.24 },
    { radius: 2.62, tube: 0.006, color: VISUAL_COLORS.muted, opacity: 0.1, x: 1.72, y: 0.48 }
  ].forEach(function (ring) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius, ring.tube, 10, 160),
      new THREE.MeshBasicMaterial({
        color: ring.color,
        transparent: true,
        opacity: ring.opacity
      })
    );
    mesh.rotation.x = ring.x;
    mesh.rotation.y = ring.y;
    galaxy.starRings.add(mesh);
  });
  galaxy.root.add(galaxy.starRings);

  const shellGeometry = new THREE.SphereGeometry(1.45, 64, 32, 0, Math.PI * 1.25);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.soft,
    wireframe: true,
    transparent: true,
    opacity: 0
  });
  galaxy.shell = new THREE.Mesh(shellGeometry, shellMaterial);
  galaxy.root.add(galaxy.shell);
}

function createOrbitalRibbons() {
  galaxy.ribbons = new THREE.Group();
  const ribbonConfigs = [
    { radius: 3.15, color: VISUAL_COLORS.accent, opacity: 0.18, x: 1.08, y: 0.2, z: -0.14, speed: 0.008 },
    { radius: 4.85, color: VISUAL_COLORS.soft, opacity: 0.12, x: 1.34, y: -0.18, z: 0.28, speed: -0.006 },
    { radius: 6.55, color: VISUAL_COLORS.muted, opacity: 0.11, x: 1.0, y: 0.48, z: 0.08, speed: 0.004 },
    { radius: 8.2, color: VISUAL_COLORS.accentSoft, opacity: 0.08, x: 1.52, y: -0.34, z: -0.24, speed: -0.003 }
  ];

  ribbonConfigs.forEach(function (config, ribbonIndex) {
    const points = [];
    const segments = 260;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const angle = t * Math.PI * 2;
      const wave = Math.sin(angle * (3 + ribbonIndex) + ribbonIndex) * 0.18;
      const radius = config.radius + wave;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle * 2 + ribbonIndex) * 0.16,
        Math.sin(angle) * radius * (0.82 + ribbonIndex * 0.04)
      ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false
      })
    );
    line.rotation.set(config.x, config.y, config.z);
    line.userData.speed = config.speed;
    line.userData.baseOpacity = config.opacity;
    galaxy.ribbons.add(line);
  });

  galaxy.root.add(galaxy.ribbons);
}

function createSystemPlanets() {
  Object.entries(PLANETS).forEach(function ([id, config]) {
    const orbit = createOrbit(config.radius, config.inclination, config.color);
    galaxy.orbits[id] = orbit;
    galaxy.root.add(orbit);

    const ticks = createOrbitTicks(config.radius, config.inclination, config.color);
    galaxy.orbitTicks.push(ticks);
    galaxy.root.add(ticks);

    const planet = new THREE.Group();
    planet.userData = { id, base: config };

    const geometry = new THREE.SphereGeometry(config.size, 64, 36);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.38,
      roughness: 0.2,
      metalness: 0.48
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.userData.planetId = id;
    planet.userData.sphere = sphere;
    planet.userData.ticks = ticks;
    planet.add(sphere);
    galaxy.planetMeshes.push(sphere);

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(config.size * 1.45, 0.009, 10, 96),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.45
      })
    );
    marker.rotation.x = Math.PI / 2;
    planet.userData.marker = marker;
    planet.add(marker);

    const label = createLabelSprite(config.short, config.color);
    label.position.set(0, config.size + 0.36, 0);
    planet.userData.label = label;
    planet.add(label);

    galaxy.planets[id] = planet;
    galaxy.root.add(planet);
  });
}

function createOrbit(radius, inclination, color) {
  const points = [];
  const segments = 320;
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18
  });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.x = inclination;
  return line;
}

function createOrbitTicks(radius, inclination, color) {
  const positions = [];
  const count = 64;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const inner = radius - (i % 5 === 0 ? 0.16 : 0.07);
    const outer = radius + (i % 5 === 0 ? 0.16 : 0.07);
    positions.push(Math.cos(angle) * inner, 0, Math.sin(angle) * inner);
    positions.push(Math.cos(angle) * outer, 0, Math.sin(angle) * outer);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16
  });
  const ticks = new THREE.LineSegments(geometry, material);
  ticks.rotation.x = inclination;
  return ticks;
}

function createRescueRig() {
  galaxy.rescueRig = new THREE.Group();
  galaxy.rescueRig.position.set(0.15, 0.28, 0.2);
  galaxy.rescueRig.rotation.x = 0.08;
  galaxy.rescueRig.rotation.z = -0.05;
  galaxy.root.add(galaxy.rescueRig);

  galaxy.rescueRigCore = new THREE.Group();
  galaxy.rescueRig.add(galaxy.rescueRigCore);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 2),
    new THREE.MeshStandardMaterial({
      color: VISUAL_COLORS.text,
      emissive: VISUAL_COLORS.accent,
      emissiveIntensity: 1.4,
      roughness: 0.16,
      metalness: 0.62,
      transparent: true,
      opacity: 0.9
    })
  );
  galaxy.rescueRigCore.add(core);
  galaxy.rescueRigCore.userData.core = core;

  [0.72, 1.02, 1.32].forEach(function (radius, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012 - index * 0.0015, 8, 96),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? VISUAL_COLORS.accent : index === 1 ? VISUAL_COLORS.text : VISUAL_COLORS.warning,
        transparent: true,
        opacity: index === 2 ? 0.16 : 0.24,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2 + index * 0.28;
    ring.rotation.y = index * 0.32;
    ring.userData.baseOpacity = index === 2 ? 0.16 : 0.24;
    ring.userData.speed = index % 2 ? -0.018 : 0.024;
    galaxy.rescueRigCore.add(ring);
  });

  const configs = [
    { id: "firmware", position: [-2.35, 0.38, 0.35], color: PLANETS.firmware.color, builder: createRigWebApp },
    { id: "backend", position: [-0.85, 0.88, -0.34], color: PLANETS.backend.color, builder: createRigBackend },
    { id: "automation", position: [0.95, 0.72, -0.22], color: PLANETS.automation.color, builder: createRigAutomation },
    { id: "data", position: [2.35, 0.16, 0.22], color: PLANETS.data.color, builder: createRigLogs },
    { id: "hardware", position: [1.12, -1.0, 0.44], color: PLANETS.hardware.color, builder: createRigHardware },
    { id: "ops", position: [-1.22, -1.0, 0.16], color: PLANETS.ops.color, builder: createRigMonitoring }
  ];

  configs.forEach(function (config) {
    const object = config.builder(config.color);
    object.position.set(config.position[0], config.position[1], config.position[2]);
    object.userData.id = config.id;
    object.userData.basePosition = new THREE.Vector3(config.position[0], config.position[1], config.position[2]);
    object.userData.color = config.color;
    object.userData.materials = [];
    object.traverse(function (child) {
      if (!child.material) return;
      child.material.userData.baseOpacity = child.material.opacity === undefined ? 1 : child.material.opacity;
      object.userData.materials.push(child.material);
    });
    galaxy.rescueRigObjects[config.id] = object;
    galaxy.rescueRig.add(object);
  });

  createRescueRigCables();
  createRescueRigSignals();
}

function createRigMaterial(color, opacity = 0.72, emissiveIntensity = 0.18) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.22,
    metalness: 0.48,
    transparent: opacity < 0.98,
    opacity,
    depthWrite: opacity > 0.65
  });
}

function createRigBasicMaterial(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 0.98,
    opacity,
    depthWrite: false
  });
}

function createRigWebApp(color) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.74, 0.045, 1, 1, 1),
    createRigMaterial(0x16242d, 0.78, 0.16)
  );
  group.add(glass);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.88, 0.04, 1, 1, 1),
    createRigBasicMaterial(color, 0.22)
  );
  frame.position.z = -0.035;
  group.add(frame);

  [-0.2, 0.02, 0.24].forEach(function (y, index) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(index === 0 ? 0.58 : 0.72, 0.025, 0.035),
      createRigBasicMaterial(index === 0 ? color : VISUAL_COLORS.text, index === 0 ? 0.88 : 0.5)
    );
    line.position.set(0, y, 0.055);
    group.add(line);
  });

  [-0.34, 0, 0.34].forEach(function (x, index) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.13, 0.045),
      createRigMaterial(index === 1 ? color : VISUAL_COLORS.text, index === 1 ? 0.7 : 0.42, 0.22)
    );
    tile.position.set(x, -0.32, 0.075);
    group.add(tile);
  });

  return group;
}

function createRigBackend(color) {
  const group = new THREE.Group();
  [-0.24, 0, 0.24].forEach(function (y, index) {
    const server = new THREE.Mesh(
      new THREE.BoxGeometry(0.84 - index * 0.06, 0.18, 0.48, 1, 1, 1),
      createRigMaterial(index === 1 ? color : VISUAL_COLORS.text, index === 1 ? 0.68 : 0.5, 0.18)
    );
    server.position.y = y;
    group.add(server);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 6),
      createRigBasicMaterial(color, 0.9)
    );
    led.position.set(-0.28, y + 0.04, 0.24);
    group.add(led);
  });
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.78, 0.07),
    createRigBasicMaterial(color, 0.46)
  );
  spine.position.set(0.42, 0, -0.04);
  group.add(spine);
  return group;
}

function createRigAutomation(color) {
  const group = new THREE.Group();
  const gear = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.085, 10, 72),
    createRigMaterial(color, 0.76, 0.26)
  );
  gear.userData.spin = 1;
  group.add(gear);
  for (let i = 0; i < 8; i += 1) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.18, 0.06),
      createRigBasicMaterial(color, 0.66)
    );
    const angle = i / 8 * Math.PI * 2;
    tooth.position.set(Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0);
    tooth.rotation.z = angle;
    group.add(tooth);
  }
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 8),
    createRigBasicMaterial(VISUAL_COLORS.text, 0.9)
  );
  group.add(core);
  return group;
}

function createRigLogs(color) {
  const group = new THREE.Group();
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.62, 0.055),
    createRigMaterial(0x121a22, 0.82, 0.12)
  );
  group.add(terminal);
  [-0.18, -0.04, 0.1, 0.24].forEach(function (y, index) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 + index * 0.12, 0.025, 0.04),
      createRigBasicMaterial(index % 2 ? VISUAL_COLORS.text : color, index % 2 ? 0.45 : 0.78)
    );
    line.position.set(-0.2 + index * 0.04, y, 0.06);
    group.add(line);
  });
  [-0.3, -0.1, 0.1, 0.3].forEach(function (x, index) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.12 + index * 0.07, 0.045),
      createRigBasicMaterial(color, 0.68)
    );
    bar.position.set(x, -0.26 + index * 0.03, 0.07);
    group.add(bar);
  });
  return group;
}

function createRigHardware(color) {
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.6, 0.06, 1, 1, 1),
    createRigMaterial(0x26323a, 0.78, 0.14)
  );
  group.add(board);
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.27, 0.09, 1, 1, 1),
    createRigMaterial(color, 0.8, 0.32)
  );
  chip.position.z = 0.08;
  group.add(chip);
  [-0.34, -0.2, -0.06, 0.08, 0.22, 0.36].forEach(function (x) {
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.11, 0.045),
      createRigBasicMaterial(VISUAL_COLORS.text, 0.7)
    );
    pin.position.set(x, 0.34, 0.075);
    group.add(pin);
    const pinBottom = pin.clone();
    pinBottom.position.y = -0.34;
    group.add(pinBottom);
  });
  const fault = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 8),
    createRigBasicMaterial(VISUAL_COLORS.warning, 0.9)
  );
  fault.position.set(0.34, 0.1, 0.14);
  fault.userData.fault = true;
  group.add(fault);
  return group;
}

function createRigMonitoring(color) {
  const group = new THREE.Group();
  [0.22, 0.38, 0.54].forEach(function (radius, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.02, 0.011, 8, 72),
      createRigBasicMaterial(index === 2 ? color : VISUAL_COLORS.text, index === 2 ? 0.66 : 0.32)
    );
    ring.rotation.x = Math.PI / 2;
    ring.userData.sweepRing = true;
    group.add(ring);
  });
  const sweep = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.018, 0.035),
    createRigBasicMaterial(color, 0.84)
  );
  sweep.position.x = 0.28;
  sweep.userData.sweep = true;
  group.add(sweep);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 8),
    createRigBasicMaterial(VISUAL_COLORS.text, 0.9)
  );
  group.add(beacon);
  return group;
}

function createRescueRigCables() {
  const pairs = [
    ["firmware", "backend"],
    ["backend", "automation"],
    ["automation", "data"],
    ["data", "hardware"],
    ["hardware", "ops"],
    ["ops", "firmware"],
    ["backend", "hardware"]
  ];
  galaxy.rescueRigCables = pairs.map(function (pair, index) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18), 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: index % 3 === 0 ? VISUAL_COLORS.accent : index % 3 === 1 ? VISUAL_COLORS.text : VISUAL_COLORS.warning,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    line.userData.pair = pair;
    line.frustumCulled = false;
    galaxy.rescueRig.add(line);
    return line;
  });
}

function createRescueRigSignals() {
  const geometry = new THREE.SphereGeometry(0.045, 10, 6);
  for (let i = 0; i < 14; i += 1) {
    const signal = new THREE.Mesh(
      geometry,
      createRigBasicMaterial(i % 4 === 0 ? VISUAL_COLORS.warning : i % 2 ? VISUAL_COLORS.accent : VISUAL_COLORS.text, 0.82)
    );
    signal.userData.cableIndex = i % galaxy.rescueRigCables.length;
    signal.userData.progress = Math.random();
    signal.userData.speed = 0.12 + Math.random() * 0.2;
    galaxy.rescueRigSignals.push(signal);
    galaxy.rescueRig.add(signal);
  }
}

function createLabelSprite(text, color) {
  const scale = QUALITY_CONFIG.labelScale;
  const canvas = document.createElement("canvas");
  canvas.width = 1024 * scale;
  canvas.height = 256 * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = "rgba(6, 10, 16, 0.72)";
  ctx.strokeStyle = "rgba(180, 222, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.fillRect(64, 54, 896, 148);
  ctx.strokeRect(64, 54, 896, 148);
  ctx.font = "700 82px Oxanium, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.fillText(text, 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.anisotropy = galaxy.renderer ? Math.min(8, galaxy.renderer.capabilities.getMaxAnisotropy()) : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.34, 0.5, 1);
  return sprite;
}

function createLightBridges() {
  const pairs = [
    ["firmware", "backend"],
    ["backend", "data"],
    ["backend", "automation"],
    ["backend", "hardware"],
    ["hardware", "data"],
    ["data", "automation"],
    ["hardware", "ops"],
    ["backend", "ops"],
    ["firmware", "ops"]
  ];
  galaxy.bridges = pairs.map(function (pair) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((BRIDGE_SEGMENTS + 1) * 3), 3));
    const material = new THREE.LineBasicMaterial({
      color: VISUAL_COLORS.accentSoft,
      transparent: true,
      opacity: 0.34
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { pair };
    line.frustumCulled = false;
    galaxy.root.add(line);
    return line;
  });
}

function createSignalParticles() {
  const particleGeometry = new THREE.SphereGeometry(0.045, 12, 8);
  const material = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.text,
    transparent: true,
    opacity: 0.72
  });
  for (let i = 0; i < 36; i += 1) {
    const particle = new THREE.Mesh(particleGeometry, material.clone());
    particle.userData = {
      bridgeIndex: i % galaxy.bridges.length,
      progress: Math.random(),
      speed: 0.13 + Math.random() * 0.16
    };
    galaxy.particles.push(particle);
    galaxy.root.add(particle);
  }
}

function createAnomalies() {
  galaxy.blackHole = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 32, 192),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.warning,
      transparent: true,
      opacity: 0
    })
  );
  galaxy.blackHole.rotation.x = Math.PI / 2;
  galaxy.root.add(galaxy.blackHole);

  [0.78, 1.02, 1.32].forEach(function (radius, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.011, 10, 144),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? VISUAL_COLORS.warning : index === 1 ? VISUAL_COLORS.muted : VISUAL_COLORS.soft,
        transparent: true,
        opacity: 0
      })
    );
    ring.rotation.x = Math.PI / 2 + index * 0.18;
    ring.rotation.y = index * 0.22;
    galaxy.accretionRings.push(ring);
    galaxy.root.add(ring);
  });

  const debrisGroup = new THREE.Group();
  const debrisGeometry = new THREE.SphereGeometry(0.035, 10, 8);
  for (let i = 0; i < 44; i += 1) {
    const mesh = new THREE.Mesh(
      debrisGeometry,
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? VISUAL_COLORS.soft : VISUAL_COLORS.muted,
        transparent: true,
        opacity: 0
      })
    );
    mesh.userData = {
      angle: Math.random() * Math.PI * 2,
      radius: 0.55 + Math.random() * 0.7,
      speed: 0.25 + Math.random() * 0.2
    };
    debrisGroup.add(mesh);
  }
  galaxy.debris = debrisGroup;
  galaxy.root.add(debrisGroup);
}

function createInteractionLayer() {
  galaxy.focusHalo = new THREE.Group();
  galaxy.focusHaloRings = [];

  [0.56, 0.82, 1.12].forEach(function (radius, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012 - index * 0.0015, 10, 144),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? VISUAL_COLORS.accent : VISUAL_COLORS.soft,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2 + index * 0.16;
    ring.rotation.y = index * 0.2;
    ring.userData.baseOpacity = index === 0 ? 0.58 : 0.32 - index * 0.05;
    galaxy.focusHaloRings.push(ring);
    galaxy.focusHalo.add(ring);
  });

  const focusCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 24, 16),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.text,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  focusCore.userData.baseOpacity = 0.78;
  galaxy.focusHaloRings.push(focusCore);
  galaxy.focusHalo.add(focusCore);
  galaxy.root.add(galaxy.focusHalo);

  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  galaxy.focusBeam = new THREE.Line(
    beamGeometry,
    new THREE.LineBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  galaxy.focusBeam.frustumCulled = false;
  galaxy.root.add(galaxy.focusBeam);
}

// ---------- Choice deck (3D-mode question carousel) ----------

function createAnswerDeck() {
  galaxy.answerDeck = new THREE.Group();
  galaxy.answerDeck.visible = false;
  galaxy.answerDeck.position.set(0, 1.65, 4.7);
  galaxy.scene.add(galaxy.answerDeck);

  const deckLight = new THREE.PointLight(VISUAL_COLORS.text, 1.35, 9);
  deckLight.position.set(0, 1.2, 1.6);
  galaxy.answerDeck.add(deckLight);

  createBackPortal();

  for (let i = 0; i < 5; i += 1) {
    const model = createChoiceModel(i);
    galaxy.answerModels.push(model);
    galaxy.answerDeck.add(model);

    const beamGeometry = new THREE.BufferGeometry();
    beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const beam = new THREE.Line(
      beamGeometry,
      new THREE.LineBasicMaterial({
        color: VISUAL_COLORS.accent,
        transparent: true,
        opacity: 0
      })
    );
    beam.frustumCulled = false;
    galaxy.choiceBeams.push(beam);
    galaxy.scene.add(beam);
  }

  syncAnswerDeck(true);
}

function createBackPortal() {
  const portal = new THREE.Group();
  portal.visible = false;
  portal.userData.materials = [];
  portal.userData.particles = [];

  const makeMaterial = function (color, opacity, options = {}) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: options.side || THREE.DoubleSide,
      blending: options.blending || THREE.NormalBlending
    });
    material.userData.baseOpacity = opacity;
    portal.userData.materials.push(material);
    return material;
  };

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 128),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })
  );
  core.userData.backPortal = true;
  portal.userData.core = core;
  portal.add(core);

  const innerRim = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.51, 128),
    makeMaterial(0x111820, 0.96)
  );
  innerRim.userData.backPortal = true;
  portal.add(innerRim);

  const lens = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.7, 160),
    makeMaterial(VISUAL_COLORS.accent, 0.3, { blending: THREE.AdditiveBlending })
  );
  lens.userData.backPortal = true;
  portal.userData.lens = lens;
  portal.add(lens);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.92, 160),
    makeMaterial(VISUAL_COLORS.soft, 0.12, { blending: THREE.AdditiveBlending })
  );
  halo.userData.backPortal = true;
  portal.userData.halo = halo;
  portal.add(halo);

  [0.52, 0.68, 0.86, 1.0].forEach(function (radius, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.018 - index * 0.0025, 14, 192),
      makeMaterial(index === 0 ? VISUAL_COLORS.accentSoft : index === 1 ? VISUAL_COLORS.accent : VISUAL_COLORS.soft, index === 0 ? 0.64 : 0.42 - index * 0.05, { blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = index * 0.1;
    ring.rotation.y = index * 0.18;
    ring.userData.backPortal = true;
    ring.userData.speed = index % 2 ? -0.036 - index * 0.004 : 0.03 + index * 0.006;
    portal.add(ring);
  });

  const particleGeometry = new THREE.SphereGeometry(0.022, 12, 8);
  for (let i = 0; i < 32; i += 1) {
    const particle = new THREE.Mesh(
      particleGeometry,
      makeMaterial(i % 3 === 0 ? VISUAL_COLORS.accentSoft : i % 2 ? VISUAL_COLORS.accent : VISUAL_COLORS.soft, 0.58, { blending: THREE.AdditiveBlending })
    );
    particle.userData.backPortal = true;
    particle.userData.portalParticle = true;
    particle.userData.angle = (i / 32) * Math.PI * 2;
    particle.userData.radius = 0.52 + (i % 5) * 0.075;
    particle.userData.speed = 0.55 + (i % 7) * 0.035;
    particle.userData.depth = (i % 4 - 1.5) * 0.035;
    portal.userData.particles.push(particle);
    portal.add(particle);
  }

  const label = createBackPortalLabelSprite();
  label.position.set(0, 1.16, 0.04);
  portal.userData.label = label;
  portal.add(label);

  const collider = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 28, 18),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
      depthTest: false
    })
  );
  collider.userData.backPortal = true;
  portal.add(collider);

  galaxy.backPortal = portal;
  galaxy.backPortalMeshes.push(collider, core, lens);
  galaxy.answerDeck.add(portal);
}

function createChoiceModel(index) {
  const model = new THREE.Group();
  model.visible = false;
  model.userData = { choiceIndex: index, currentValue: null };

  const core = new THREE.Mesh(
    createChoiceGeometry("firmwareChip"),
    new THREE.MeshStandardMaterial({
      color: VISUAL_COLORS.accent,
      emissive: VISUAL_COLORS.accent,
      emissiveIntensity: 0.68,
      roughness: 0.18,
      metalness: 0.64,
      transparent: true,
      opacity: 1,
      depthWrite: true
    })
  );
  core.userData.choiceIndex = index;
  model.add(core);

  const wire = new THREE.Mesh(
    createChoiceGeometry("firmwareChip"),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.text,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    })
  );
  wire.scale.setScalar(1.06);
  wire.userData.choiceIndex = index;
  model.add(wire);

  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.014, 16, 160),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.58,
      depthWrite: false
    })
  );
  marker.rotation.x = Math.PI / 2;
  marker.position.y = -0.48;
  marker.userData.choiceIndex = index;
  model.add(marker);

  const axis = createChoiceAxis(VISUAL_COLORS.accent);
  axis.position.y = -0.48;
  axis.userData.choiceIndex = index;
  model.add(axis);

  const frame = createChoiceFrame(VISUAL_COLORS.accent, index);
  model.add(frame);

  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.25, 1.35),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false
    })
  );
  collider.position.y = 0.24;
  collider.userData.choiceIndex = index;
  model.add(collider);

  model.userData.core = core;
  model.userData.wire = wire;
  model.userData.marker = marker;
  model.userData.axis = axis;
  model.userData.frame = frame;
  model.userData.collider = collider;
  galaxy.answerMeshes.push(core, wire, marker, collider);
  return model;
}

export function getChoiceVisual(value, planetId) {
  return CHOICE_VISUALS[value] || {
    kind: planetId === "firmware"
      ? "firmwareChip"
      : planetId === "backend"
        ? "apiStack"
        : planetId === "automation"
          ? "workflowGear"
          : planetId === "data"
            ? "dataVault"
            : planetId === "hardware"
              ? "hardwarePort"
              : "opsRadar",
    accent: PLANETS[planetId].color,
    labelY: 1
  };
}

function createChoiceGeometry(kind) {
  if (kind === "firmwareChip") return new THREE.BoxGeometry(0.82, 0.12, 0.62, 16, 4, 12);
  if (kind === "apiStack") return new THREE.BoxGeometry(0.68, 0.72, 0.68, 14, 14, 14);
  if (kind === "workflowGear") return new THREE.TorusGeometry(0.36, 0.13, 28, 112);
  if (kind === "dataVault") return new THREE.CylinderGeometry(0.38, 0.38, 0.76, 72, 10);
  if (kind === "opsRadar") return new THREE.SphereGeometry(0.43, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.62);
  if (kind === "hardwarePort") return new THREE.BoxGeometry(0.72, 0.34, 0.5, 12, 6, 8);
  if (kind === "contractBridge") {
    const geometry = new THREE.CylinderGeometry(0.16, 0.16, 0.86, 48, 8);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  if (kind === "incidentBeacon") return new THREE.ConeGeometry(0.34, 0.72, 64, 8);
  if (kind === "processRail") return new THREE.BoxGeometry(0.86, 0.2, 0.42, 12, 4, 8);
  if (kind === "ownershipCompass") return new THREE.IcosahedronGeometry(0.48, 3);
  if (kind === "userCluster") return new THREE.SphereGeometry(0.42, 64, 32);
  if (kind === "deviceFleet") return new THREE.BoxGeometry(0.54, 0.62, 0.32, 8, 12, 6);
  if (kind === "manualStack") return new THREE.BoxGeometry(0.7, 0.18, 0.54, 10, 3, 8);
  if (kind === "integrationHub") return new THREE.DodecahedronGeometry(0.48, 2);
  if (kind === "incidentFlare") return new THREE.ConeGeometry(0.46, 0.78, 64, 10);
  if (kind === "logConsole") return new THREE.BoxGeometry(0.78, 0.42, 0.18, 12, 8, 3);
  if (kind === "memoryNode") return new THREE.SphereGeometry(0.46, 64, 32);
  if (kind === "retryLoop") return new THREE.TorusGeometry(0.38, 0.09, 24, 128);
  if (kind === "layerPatch") return new THREE.BoxGeometry(0.72, 0.16, 0.56, 12, 3, 10);
  if (kind === "debateOrbit") return new THREE.TorusKnotGeometry(0.32, 0.08, 128, 18);
  if (kind === "architectureMap") return new THREE.BoxGeometry(0.82, 0.12, 0.58, 12, 2, 8);
  if (kind === "stableHandoff") {
    const geometry = new THREE.CylinderGeometry(0.18, 0.18, 0.92, 64, 8);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  if (kind === "opsQueue") return new THREE.BoxGeometry(0.78, 0.18, 0.46, 12, 3, 8);
  if (kind === "monitoringArray") return new THREE.SphereGeometry(0.42, 64, 32);
  if (kind === "ownerCrown") return new THREE.CylinderGeometry(0.46, 0.34, 0.46, 6, 4);
  return new THREE.IcosahedronGeometry(0.5, 3);
}

function createChoiceAxis(color) {
  const positions = [
    -0.62, 0, 0, 0.62, 0, 0,
    0, 0, -0.62, 0, 0, 0.62,
    -0.36, 0, -0.36, 0.36, 0, 0.36,
    -0.36, 0, 0.36, 0.36, 0, -0.36
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4
    })
  );
}

function createChoiceFrame(color, choiceIndex) {
  const frame = new THREE.Group();
  frame.userData.accentMaterials = [];
  frame.userData.softMaterials = [];

  const makeBasic = function (materialColor, opacity) {
    const material = new THREE.MeshBasicMaterial({
      color: materialColor,
      transparent: true,
      opacity,
      depthWrite: false
    });
    material.userData.baseOpacity = opacity;
    return material;
  };
  const makeStandard = function (materialColor, opacity) {
    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      emissive: materialColor,
      emissiveIntensity: 0.08,
      roughness: 0.22,
      metalness: 0.54,
      transparent: true,
      opacity,
      depthWrite: false
    });
    material.userData.baseOpacity = opacity;
    return material;
  };
  const add = function (mesh, bucket) {
    mesh.userData.choiceIndex = choiceIndex;
    frame.add(mesh);
    if (bucket === "accent") frame.userData.accentMaterials.push(mesh.material);
    if (bucket === "soft") frame.userData.softMaterials.push(mesh.material);
    return mesh;
  };

  const base = add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.88, 0.07, 6, 2),
    makeStandard(0x1b2730, 0.64)
  ), "soft");
  base.rotation.y = Math.PI / 6;
  base.position.y = -0.64;
  base.scale.z = 0.72;

  const glass = add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.72, 0.035, 6, 2),
    makeBasic(color, 0.2)
  ), "accent");
  glass.rotation.y = Math.PI / 6;
  glass.position.y = -0.58;
  glass.scale.z = 0.7;

  const ring = add(new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.01, 10, 132),
    makeBasic(color, 0.58)
  ), "accent");
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.5;

  const innerRing = add(new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.006, 8, 96),
    makeBasic(VISUAL_COLORS.text, 0.24)
  ), "soft");
  innerRing.rotation.x = Math.PI / 2.12;
  innerRing.rotation.z = 0.38;
  innerRing.position.y = -0.46;

  [[-0.52, -0.34], [0.52, -0.34], [-0.52, 0.34], [0.52, 0.34]].forEach(function (point, i) {
    const post = add(new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.22, 0.035, 1, 4, 1),
      makeStandard(i % 2 ? color : VISUAL_COLORS.text, i % 2 ? 0.62 : 0.42)
    ), i % 2 ? "accent" : "soft");
    post.position.set(point[0], -0.42, point[1]);

    const cap = add(new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.025, 0.035, 1, 1, 1),
      makeBasic(color, 0.52)
    ), "accent");
    cap.position.set(point[0], -0.29, point[1]);
    cap.rotation.y = point[0] > 0 ? 0.45 : -0.45;
  });

  return frame;
}

function createChoiceDetailGroup(visual, planetColor, choiceIndex) {
  const group = new THREE.Group();
  group.userData.kind = visual.kind;
  group.userData.choiceIndex = choiceIndex;
  const accent = visual.accent || planetColor;
  const pale = VISUAL_COLORS.text;
  const addMesh = function (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.userData.choiceIndex = choiceIndex;
    group.add(mesh);
    return mesh;
  };
  const addBox = function (size, position, color = pale, opacity = 0.55, rotation = [0, 0, 0]) {
    return addMesh(
      new THREE.BoxGeometry(size[0], size[1], size[2], 2, 2, 2),
      createDetailMaterial(color, opacity),
      position,
      rotation
    );
  };
  const addCylinder = function (radiusTop, radiusBottom, height, position, color = pale, opacity = 0.58, rotation = [0, 0, 0], segments = 32) {
    return addMesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 4),
      createDetailMaterial(color, opacity),
      position,
      rotation
    );
  };
  const addSphere = function (radius, position, color = pale, opacity = 0.58) {
    return addMesh(
      new THREE.SphereGeometry(radius, 24, 16),
      createDetailMaterial(color, opacity),
      position
    );
  };
  const addRing = function (radius, tube, position, color = accent, opacity = 0.46, rotation = [Math.PI / 2, 0, 0]) {
    return addMesh(
      new THREE.TorusGeometry(radius, tube, 12, 72),
      createDetailMaterial(color, opacity),
      position,
      rotation
    );
  };
  const addLine = function (points, color = accent, opacity = 0.6) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    );
    line.userData.choiceIndex = choiceIndex;
    group.add(line);
    return line;
  };
  const addDeck = function (width = 0.92, depth = 0.7) {
    addBox([width, 0.035, depth], [0, -0.38, 0], pale, 0.32);
    addRing(Math.max(width, depth) * 0.45, 0.01, [0, -0.405, 0], accent, 0.46);
    [-0.32, 0, 0.32].forEach(function (offset) {
      addBox([0.055, 0.02, depth * 0.72], [offset, -0.352, 0], accent, 0.24);
    });
  };

  addDeck();

  switch (visual.kind) {
    case "firmwareChip":
      addBox([0.64, 0.05, 0.46], [0, 0.12, 0], pale, 0.5);
      addBox([0.52, 0.035, 0.08], [0, 0.18, -0.17], accent, 0.74);
      addBox([0.5, 0.03, 0.045], [0, 0.2, -0.04], pale, 0.58);
      addBox([0.2, 0.03, 0.05], [-0.15, 0.215, 0.08], pale, 0.5);
      addBox([0.18, 0.03, 0.05], [0.18, 0.215, 0.08], pale, 0.5);
      addBox([0.18, 0.045, 0.09], [0.22, 0.235, 0.19], accent, 0.84);
      for (let i = -3; i <= 3; i += 1) {
        addBox([0.035, 0.1, 0.13], [i * 0.095, 0.02, -0.42], accent, 0.74);
        addBox([0.035, 0.1, 0.13], [i * 0.095, 0.02, 0.42], accent, 0.74);
      }
      addLine([new THREE.Vector3(-0.31, 0.245, -0.17), new THREE.Vector3(0.18, 0.245, 0.18)], accent, 0.86);
      addSphere(0.035, [-0.31, 0.25, -0.17], pale, 0.86);
      addSphere(0.035, [0.18, 0.25, 0.18], accent, 0.9);
      break;
    case "apiStack":
      [-0.26, -0.04, 0.18].forEach(function (offset, layerIndex) {
        addBox([0.78 - layerIndex * 0.05, 0.07, 0.62], [0, offset, 0], layerIndex === 1 ? accent : pale, layerIndex === 1 ? 0.62 : 0.46);
        addSphere(0.028, [-0.29, offset + 0.055, 0.32], accent, 0.88);
        addSphere(0.026, [-0.19, offset + 0.055, 0.32], pale, 0.72);
        addBox([0.28, 0.018, 0.035], [0.15, offset + 0.06, 0.32], pale, 0.54);
      });
      addBox([0.08, 0.56, 0.08], [-0.38, -0.02, -0.26], accent, 0.5);
      addBox([0.08, 0.56, 0.08], [0.38, -0.02, 0.26], accent, 0.42);
      addLine([new THREE.Vector3(-0.38, 0.34, -0.26), new THREE.Vector3(0.38, -0.34, 0.26)], accent, 0.72);
      break;
    case "workflowGear":
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2;
        addBox([0.14, 0.1, 0.2], [Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.48], accent, 0.62, [0, -angle, 0]);
      }
      addSphere(0.1, [0, 0, 0], pale, 0.86);
      [-0.34, 0, 0.34].forEach(function (offset, i) {
        addBox([0.2, 0.09, 0.16], [offset, 0.24 + i * 0.018, 0.04 * (i - 1)], i === 1 ? accent : pale, 0.58);
      });
      addLine([new THREE.Vector3(-0.43, 0.24, 0.02), new THREE.Vector3(0, 0.29, -0.02), new THREE.Vector3(0.43, 0.28, 0.02)], accent, 0.74);
      break;
    case "dataVault":
      [-0.3, -0.06, 0.18, 0.38].forEach(function (offset, i) {
        addRing(0.42 - i * 0.018, 0.012, [0, offset, 0], i === 2 ? accent : pale, i === 2 ? 0.68 : 0.48);
      });
      addBox([0.08, 0.82, 0.025], [0.28, 0, 0.28], pale, 0.48);
      addBox([0.08, 0.82, 0.025], [-0.28, 0, -0.28], pale, 0.48);
      [-0.2, 0, 0.2].forEach(function (offset, i) {
        addBox([0.06, 0.22 + i * 0.1, 0.06], [offset, 0.04 + i * 0.06, 0.08], accent, 0.72);
      });
      break;
    case "opsRadar":
      addRing(0.54, 0.012, [0, -0.06, 0], accent, 0.72);
      addRing(0.34, 0.01, [0, 0.03, 0], pale, 0.5);
      addLine([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0.48, 0.2, 0.16)], accent, 0.92);
      addSphere(0.052, [0.5, 0.21, 0.17], pale, 0.95);
      addCylinder(0.035, 0.045, 0.3, [0, 0.18, 0], accent, 0.62);
      addSphere(0.045, [-0.24, 0.1, -0.18], pale, 0.72);
      break;
    case "hardwarePort":
      addBox([0.68, 0.05, 0.42], [0, 0.08, 0], pale, 0.46);
      addBox([0.52, 0.035, 0.1], [0, 0.17, -0.14], accent, 0.72);
      addBox([0.34, 0.032, 0.06], [-0.08, 0.2, 0.02], pale, 0.58);
      addBox([0.16, 0.045, 0.08], [0.22, 0.22, 0.15], accent, 0.82);
      [-0.24, -0.08, 0.08, 0.24].forEach(function (offset) {
        addBox([0.055, 0.18, 0.44], [offset, 0.3, 0], accent, 0.74);
      });
      break;
    case "contractBridge":
      addBox([0.25, 0.42, 0.54], [-0.56, 0, 0], accent, 0.6);
      addBox([0.25, 0.42, 0.54], [0.56, 0, 0], planetColor, 0.58);
      [-0.16, 0.04, 0.24].forEach(function (height, i) {
        addLine([new THREE.Vector3(-0.4, height, -0.08 + i * 0.08), new THREE.Vector3(0.4, height, 0.08 - i * 0.08)], i === 1 ? accent : pale, i === 1 ? 0.86 : 0.64);
      });
      addSphere(0.05, [0, 0.04, 0], accent, 0.88);
      break;
    case "incidentBeacon":
      addRing(0.46, 0.012, [0, -0.28, 0], accent, 0.72);
      addRing(0.64, 0.01, [0, -0.3, 0], VISUAL_COLORS.warning, 0.5);
      addCylinder(0.16, 0.28, 0.42, [0, 0.03, 0], accent, 0.5);
      addSphere(0.075, [0, 0.48, 0], VISUAL_COLORS.warning, 0.88);
      addLine([new THREE.Vector3(-0.32, 0.28, 0), new THREE.Vector3(0, 0.48, 0), new THREE.Vector3(0.32, 0.28, 0)], VISUAL_COLORS.warning, 0.72);
      break;
    case "processRail":
      addBox([1.0, 0.045, 0.055], [0, 0.16, -0.24], pale, 0.64);
      addBox([1.0, 0.045, 0.055], [0, 0.16, 0.24], pale, 0.64);
      [-0.32, 0, 0.32].forEach(function (offset) {
        addBox([0.2, 0.2, 0.2], [offset, 0.29, 0], accent, 0.68);
        addSphere(0.04, [offset, 0.45, 0], pale, 0.76);
      });
      addLine([new THREE.Vector3(-0.42, 0.38, 0), new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.42, 0.38, 0)], accent, 0.78);
      break;
    case "ownershipCompass":
      addRing(0.58, 0.014, [0, 0, 0], accent, 0.64);
      addRing(0.36, 0.01, [0, 0.04, 0], pale, 0.4);
      addLine([new THREE.Vector3(-0.66, 0, 0), new THREE.Vector3(0.66, 0, 0)], pale, 0.68);
      addLine([new THREE.Vector3(0, 0, -0.66), new THREE.Vector3(0, 0, 0.66)], pale, 0.68);
      addMesh(new THREE.ConeGeometry(0.09, 0.26, 24, 4), createDetailMaterial(accent, 0.9), [0.68, 0, 0], [0, 0, -Math.PI / 2]);
      addSphere(0.055, [0, 0.05, 0], pale, 0.86);
      break;
    case "userCluster":
      [[-0.26, 0.08, 0.12], [0, 0.18, 0], [0.28, 0.06, -0.12], [-0.1, -0.18, -0.2], [0.18, -0.16, 0.2]].forEach(function (pos, i) {
        addSphere(i === 1 ? 0.13 : 0.09, pos, i === 1 ? accent : pale, i === 1 ? 0.88 : 0.72);
        addCylinder(0.045, 0.065, 0.16, [pos[0], pos[1] - 0.13, pos[2]], i === 1 ? accent : pale, 0.54);
      });
      addLine([new THREE.Vector3(-0.26, 0.08, 0.12), new THREE.Vector3(0, 0.18, 0), new THREE.Vector3(0.28, 0.06, -0.12)], accent, 0.58);
      break;
    case "deviceFleet":
      [[-0.24, 0.1, 0], [0.04, 0, 0.08], [0.3, -0.08, -0.06]].forEach(function (pos, i) {
        addBox([0.2, 0.34, 0.05], pos, i === 0 ? accent : pale, i === 0 ? 0.72 : 0.58);
        addBox([0.13, 0.035, 0.018], [pos[0], pos[1] + 0.08, pos[2] + 0.04], i === 0 ? pale : accent, 0.76);
        addSphere(0.02, [pos[0], pos[1] - 0.13, pos[2] + 0.045], accent, 0.9);
      });
      addLine([new THREE.Vector3(-0.24, 0.1, 0), new THREE.Vector3(0.04, 0, 0.08), new THREE.Vector3(0.3, -0.08, -0.06)], accent, 0.64);
      break;
    case "manualStack":
      [-0.18, 0, 0.18].forEach(function (offset, i) {
        addBox([0.64, 0.055, 0.44], [offset * 0.24, 0.18 + i * 0.065, offset], i === 2 ? accent : pale, i === 2 ? 0.66 : 0.48);
        addBox([0.34, 0.018, 0.035], [offset * 0.24 - 0.08, 0.215 + i * 0.065, offset + 0.17], accent, 0.56);
      });
      addBox([0.09, 0.28, 0.09], [0.34, 0.31, 0.24], accent, 0.68);
      addSphere(0.04, [0.34, 0.48, 0.24], pale, 0.86);
      break;
    case "integrationHub":
      addSphere(0.12, [0, 0, 0], accent, 0.92);
      [[0.52, 0, 0], [-0.46, 0.14, 0.1], [0.12, -0.08, 0.52], [-0.12, 0.18, -0.5]].forEach(function (pos) {
        addSphere(0.075, pos, pale, 0.82);
        addBox([0.12, 0.04, 0.12], [pos[0], pos[1] - 0.12, pos[2]], accent, 0.46);
        addLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(pos[0], pos[1], pos[2])], accent, 0.66);
      });
      addRing(0.42, 0.01, [0, -0.02, 0], pale, 0.42, [Math.PI / 2.4, 0, 0.3]);
      break;
    case "incidentFlare":
      addRing(0.46, 0.012, [0, -0.28, 0], VISUAL_COLORS.warning, 0.68);
      addRing(0.66, 0.009, [0, -0.31, 0], VISUAL_COLORS.soft, 0.38);
      addCylinder(0.1, 0.24, 0.44, [0, 0.02, 0], VISUAL_COLORS.warning, 0.46);
      [0, 1, 2].forEach(function (i) {
        const angle = i * Math.PI * 0.66;
        addLine([new THREE.Vector3(0, 0.34, 0), new THREE.Vector3(Math.cos(angle) * 0.36, 0.64, Math.sin(angle) * 0.36)], VISUAL_COLORS.warning, 0.76);
        addSphere(0.026, [Math.cos(angle) * 0.36, 0.64, Math.sin(angle) * 0.36], pale, 0.8);
      });
      break;
    case "logConsole":
      addBox([0.72, 0.07, 0.42], [0, 0.04, 0], pale, 0.44);
      [-0.24, -0.08, 0.08, 0.24].forEach(function (offset, i) {
        addBox([0.065, 0.05 + i * 0.055, 0.04], [offset, 0.15 + i * 0.03, 0.18], accent, 0.76);
      });
      [-0.17, 0, 0.17].forEach(function (offset) {
        addBox([0.46, 0.018, 0.03], [0, 0.23 + offset * 0.2, -0.12 + offset], pale, 0.5);
      });
      addLine([new THREE.Vector3(-0.34, -0.12, 0.18), new THREE.Vector3(0.34, 0.2, 0.18)], pale, 0.72);
      break;
    case "memoryNode":
      addRing(0.54, 0.012, [0, 0, 0], accent, 0.6, [Math.PI / 2.6, 0, 0.4]);
      addSphere(0.08, [-0.32, 0.12, 0.18], pale, 0.82);
      addSphere(0.07, [0.34, -0.06, -0.12], accent, 0.9);
      addSphere(0.055, [0.05, 0.24, 0.08], pale, 0.72);
      addLine([new THREE.Vector3(-0.32, 0.12, 0.18), new THREE.Vector3(0.05, 0.24, 0.08), new THREE.Vector3(0.34, -0.06, -0.12)], accent, 0.68);
      break;
    case "retryLoop":
      addMesh(new THREE.ConeGeometry(0.09, 0.26, 24, 4), createDetailMaterial(accent, 0.86), [0.38, 0.04, 0.04], [0, 0, -0.85]);
      addRing(0.52, 0.011, [0, 0, 0], pale, 0.52, [Math.PI / 2, 0.15, 0]);
      addRing(0.34, 0.009, [0, 0.02, 0], accent, 0.42, [Math.PI / 2.2, -0.3, 0.2]);
      addBox([0.18, 0.1, 0.18], [-0.18, 0.05, 0.14], pale, 0.54);
      break;
    case "layerPatch":
      addBox([0.68, 0.045, 0.46], [0, 0.12, 0], pale, 0.36);
      addBox([0.58, 0.052, 0.09], [0, 0.25, -0.18], accent, 0.66);
      addBox([0.58, 0.052, 0.09], [0, 0.25, 0.18], accent, 0.66);
      addBox([0.09, 0.052, 0.42], [-0.23, 0.26, 0], pale, 0.56);
      addBox([0.09, 0.052, 0.42], [0.23, 0.26, 0], pale, 0.56);
      addSphere(0.04, [0, 0.34, 0], accent, 0.88);
      break;
    case "debateOrbit":
      addSphere(0.1, [-0.34, 0.12, 0], accent, 0.88);
      addSphere(0.1, [0.34, -0.12, 0], VISUAL_COLORS.warning, 0.78);
      addRing(0.48, 0.01, [0, 0, 0], pale, 0.4, [Math.PI / 2.3, 0, -0.6]);
      addLine([new THREE.Vector3(-0.26, 0.1, 0), new THREE.Vector3(0.26, -0.1, 0)], pale, 0.68);
      addBox([0.14, 0.08, 0.16], [0, 0.04, 0.18], accent, 0.5);
      break;
    case "architectureMap":
      addBox([0.76, 0.04, 0.5], [0, 0.09, 0], pale, 0.38);
      addLine([new THREE.Vector3(-0.34, 0.18, -0.2), new THREE.Vector3(-0.06, 0.25, 0.1), new THREE.Vector3(0.32, 0.18, -0.02)], accent, 0.86);
      addSphere(0.05, [-0.34, 0.18, -0.2], pale, 0.84);
      addSphere(0.05, [-0.06, 0.25, 0.1], accent, 0.88);
      addSphere(0.05, [0.32, 0.18, -0.02], pale, 0.84);
      addBox([0.15, 0.05, 0.12], [-0.34, 0.13, -0.2], accent, 0.44);
      addBox([0.15, 0.05, 0.12], [0.32, 0.13, -0.02], pale, 0.4);
      break;
    case "stableHandoff":
      addBox([0.24, 0.38, 0.46], [-0.54, 0, 0], accent, 0.58);
      addBox([0.24, 0.38, 0.46], [0.54, 0, 0], planetColor, 0.58);
      addRing(0.2, 0.014, [-0.28, 0, 0], pale, 0.62, [0, Math.PI / 2, 0]);
      addRing(0.2, 0.014, [0.28, 0, 0], pale, 0.62, [0, Math.PI / 2, 0]);
      addLine([new THREE.Vector3(-0.38, 0.18, 0.1), new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0.38, 0.18, -0.1)], accent, 0.78);
      addSphere(0.045, [0, 0.28, 0], pale, 0.9);
      break;
    case "opsQueue":
      [-0.34, -0.12, 0.1, 0.32].forEach(function (offset, i) {
        addBox([0.18, 0.14, 0.32], [offset, 0.19 + i * 0.03, 0], i === 3 ? accent : pale, i === 3 ? 0.7 : 0.52);
        addSphere(0.025, [offset, 0.31 + i * 0.03, 0.18], i === 3 ? pale : accent, 0.78);
      });
      addLine([new THREE.Vector3(-0.44, -0.02, 0.24), new THREE.Vector3(0.44, -0.02, 0.24)], accent, 0.72);
      addBox([0.88, 0.03, 0.05], [0, 0.08, 0.25], pale, 0.42);
      break;
    case "monitoringArray":
      [0.28, 0.46, 0.64].forEach(function (radius, i) {
        addRing(radius, 0.009, [0, 0, 0], i === 2 ? accent : pale, i === 2 ? 0.64 : 0.38);
      });
      addLine([new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(0.56, 0.08, 0.2)], accent, 0.9);
      addSphere(0.05, [0.56, 0.08, 0.2], pale, 0.9);
      [-0.18, 0, 0.18].forEach(function (offset, i) {
        addBox([0.055, 0.14 + i * 0.08, 0.055], [offset, 0.12 + i * 0.04, -0.2], accent, 0.62);
      });
      break;
    case "ownerCrown":
      [-0.26, 0, 0.26].forEach(function (offset, i) {
        addMesh(new THREE.ConeGeometry(0.085, 0.36, 24, 4), createDetailMaterial(i === 1 ? accent : pale, 0.84), [offset, 0.36, i === 1 ? 0 : 0.08]);
        addSphere(0.035, [offset, 0.58, i === 1 ? 0 : 0.08], i === 1 ? pale : accent, 0.88);
      });
      addRing(0.42, 0.014, [0, 0.05, 0], accent, 0.72);
      addBox([0.64, 0.09, 0.18], [0, 0.18, 0], pale, 0.42);
      break;
    default:
      addRing(0.48, 0.01, [0, 0, 0], accent, 0.46);
  }

  return group;
}

function createDetailMaterial(color, opacity) {
  const solidOpacity = Math.min(1, opacity + 0.22);
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.28,
    metalness: 0.42,
    transparent: solidOpacity < 0.98,
    opacity: solidOpacity,
    depthWrite: false
  });
}

function disposeObject3D(object) {
  object.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(function (material) { material.dispose(); });
      } else {
        child.material.dispose();
      }
    }
  });
}

export function syncAnswerDeck(force = false) {
  if (!galaxy.answerDeck) return;
  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  if (!force && galaxy.answerDeck.userData.questionId === question.id) return;
  galaxy.answerDeck.userData.questionId = question.id;

  galaxy.answerModels.forEach(function (model, index) {
    const choice = question.choices[index];
    if (!choice) {
      model.visible = false;
      return;
    }
    updateChoiceModel(model, choice);
    model.visible = appState.threeDMode;
  });

  const selectedValue = appState.answers[question.id];
  appState.selectedChoice = selectedValue ? findChoiceIndex(question.id, selectedValue) : null;
}

function updateChoiceModel(model, choice) {
  const planetId = inferPlanet(choice.value);
  const planet = PLANETS[planetId];
  const visual = getChoiceVisual(choice.value, planetId);
  const color = visual.accent || planet.color;
  const data = model.userData;

  if (data.currentValue !== choice.value) {
    data.core.geometry.dispose();
    data.wire.geometry.dispose();
    data.core.geometry = createChoiceGeometry(visual.kind);
    data.wire.geometry = createChoiceGeometry(visual.kind);

    if (data.detailGroup) {
      model.remove(data.detailGroup);
      disposeObject3D(data.detailGroup);
    }
    data.detailGroup = createChoiceDetailGroup(visual, planet.color, model.userData.choiceIndex);
    model.add(data.detailGroup);

    if (data.label) {
      model.remove(data.label);
      data.label.material.map.dispose();
      data.label.material.dispose();
    }
    data.label = createChoiceLabelSprite(choice, color);
    data.label.position.set(0, visual.labelY || 0.98, 0);
    model.add(data.label);
    data.currentValue = choice.value;
    data.planetId = planetId;
    data.visualKind = visual.kind;
  }

  data.core.material.color.setHex(color);
  data.core.material.emissive.setHex(color);
  data.wire.material.color.setHex(VISUAL_COLORS.text);
  data.marker.material.color.setHex(color);
  data.axis.material.color.setHex(color);
  updateChoiceFrameColors(data.frame, color);
}

function updateChoiceFrameColors(frame, color) {
  if (!frame) return;
  frame.userData.accentMaterials.forEach(function (material) {
    material.color.setHex(color);
    if (material.emissive) material.emissive.setHex(color);
  });
  frame.userData.softMaterials.forEach(function (material) {
    material.color.setHex(VISUAL_COLORS.text);
    if (material.emissive) material.emissive.setHex(VISUAL_COLORS.text);
  });
}

function updateChoiceFrameState(frame, selected, hovered, dimmed) {
  if (!frame) return;
  const opacityBoost = selected ? 1.25 : hovered ? 1.08 : dimmed ? 0.34 : 0.82;
  const scale = selected ? 1.08 : hovered ? 1.03 : 1;
  frame.scale.lerp(galaxy.scratch.detailScale.set(scale, scale, scale), 0.1);
  frame.traverse(function (child) {
    if (!child.material || child.material.userData.baseOpacity === undefined) return;
    const baseOpacity = child.material.userData.baseOpacity;
    const targetOpacity = Math.min(0.96, baseOpacity * opacityBoost);
    child.material.opacity += (targetOpacity - child.material.opacity) * 0.12;
  });
}

function createChoiceLabelSprite(choice, color) {
  const scale = QUALITY_CONFIG.labelScale;
  const canvas = document.createElement("canvas");
  canvas.width = 1024 * scale;
  canvas.height = 512 * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, 1024, 512);
  drawCanvasRoundRect(ctx, 56, 72, 912, 274, 18);
  ctx.fillStyle = "rgba(7, 10, 15, 0.84)";
  ctx.fill();
  ctx.strokeStyle = "rgba(213, 227, 237, 0.34)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const colorHex = "#" + color.toString(16).padStart(6, "0");
  ctx.fillStyle = colorHex;
  ctx.fillRect(92, 102, 840, 5);
  ctx.fillRect(92, 320, 120, 4);
  ctx.fillRect(812, 320, 120, 4);

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(86, 132);
  ctx.lineTo(86, 96);
  ctx.lineTo(122, 96);
  ctx.moveTo(938, 132);
  ctx.lineTo(938, 96);
  ctx.lineTo(902, 96);
  ctx.moveTo(86, 286);
  ctx.lineTo(86, 322);
  ctx.lineTo(122, 322);
  ctx.moveTo(938, 286);
  ctx.lineTo(938, 322);
  ctx.lineTo(902, 322);
  ctx.stroke();

  ctx.font = "700 58px Oxanium, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4f8fb";
  wrapChoiceText(choice.label, 28).forEach(function (line, lineIndex, lines) {
    const y = lines.length === 1 ? 212 : 176 + lineIndex * 72;
    ctx.fillText(line.toUpperCase(), 512, y);
  });

  ctx.fillStyle = colorHex;
  ctx.font = "700 34px Share Tech Mono, monospace";
  drawCanvasRoundRect(ctx, 424, 388, 176, 48, 12);
  ctx.fillStyle = "rgba(7, 10, 15, 0.78)";
  ctx.fill();
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = colorHex;
  ctx.fillText(choice.tag.toUpperCase(), 512, 413);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.anisotropy = galaxy.renderer ? Math.min(8, galaxy.renderer.capabilities.getMaxAnisotropy()) : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 20;
  sprite.scale.set(1.65, 0.74, 1);
  return sprite;
}

function createBackPortalLabelSprite() {
  const scale = QUALITY_CONFIG.labelScale;
  const canvas = document.createElement("canvas");
  canvas.width = 1024 * scale;
  canvas.height = 256 * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, 1024, 256);
  drawCanvasRoundRect(ctx, 116, 58, 792, 140, 20);
  ctx.fillStyle = "rgba(3, 5, 9, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(93, 231, 255, 0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(93, 231, 255, 0.18)";
  ctx.fillRect(156, 82, 708, 4);
  ctx.fillRect(156, 172, 708, 3);

  ctx.strokeStyle = "rgba(93, 231, 255, 0.88)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(196, 128);
  ctx.lineTo(262, 88);
  ctx.moveTo(196, 128);
  ctx.lineTo(262, 168);
  ctx.moveTo(204, 128);
  ctx.lineTo(328, 128);
  ctx.stroke();

  ctx.font = "700 58px Oxanium, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4f8fb";
  ctx.fillText("PREVIOUS", 588, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.anisotropy = galaxy.renderer ? Math.min(8, galaxy.renderer.capabilities.getMaxAnisotropy()) : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  material.userData.baseOpacity = 0.92;
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 24;
  sprite.scale.set(1.9, 0.5, 1);
  return sprite;
}

function drawCanvasRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapChoiceText(text, maxLength) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  words.forEach(function (word) {
    const next = current ? current + " " + word : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

// ---------- Resize, pointer, micro-pulse ----------

export function resizeGalaxy() {
  if (!galaxy.renderer || !galaxy.camera) return;
  const canvas = galaxy.renderer.domElement;
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  galaxy.camera.aspect = width / Math.max(height, 1);
  galaxy.camera.updateProjectionMatrix();
  galaxy.renderer.setPixelRatio(getRenderPixelRatio());
  galaxy.renderer.setSize(width, height, false);
}

function bindCanvasInteraction(canvas) {
  canvas.addEventListener("pointermove", function (event) {
    updatePointerFromEvent(canvas, event);

    const hit = getCanvasHit();
    const now = performance.now();
    canvas.classList.toggle("is-targeting", Boolean(hit));

    if (hit && hit.type === "back") {
      const changedBack = !appState.hoveredBack;
      appState.hoveredBack = true;
      appState.hoveredChoice = null;
      appState.hoveredPlanet = null;
      if (changedBack) updateChoiceHud();
    } else if (hit && hit.type === "choice") {
      const changedChoice = appState.hoveredChoice !== hit.choiceIndex;
      appState.hoveredBack = false;
      appState.hoveredChoice = hit.choiceIndex;
      appState.hoveredPlanet = null;
      if (changedChoice) updateChoiceHud();
    } else if (hit && hit.type === "planet" && hit.planetId !== appState.hoveredPlanet && now - appState.lastPointerFocus > 90) {
      appState.hoveredBack = false;
      appState.hoveredChoice = null;
      appState.hoveredPlanet = hit.planetId;
      appState.lastPointerFocus = now;
      focusPlanet(hit.planetId, { fromCanvas: true });
      runMicroPulse(hit.planetId, { preserveInsight: true });
      updateChoiceHud();
    } else if (!hit) {
      const hadChoice = appState.hoveredChoice !== null;
      const hadBack = appState.hoveredBack;
      appState.hoveredBack = false;
      appState.hoveredChoice = null;
      appState.hoveredPlanet = null;
      if (hadChoice || hadBack) updateChoiceHud();
    }
  });

  canvas.addEventListener("pointerleave", function () {
    appState.pointer.x = 0;
    appState.pointer.y = 0;
    appState.hoveredBack = false;
    appState.hoveredChoice = null;
    appState.hoveredPlanet = null;
    canvas.classList.remove("is-targeting");
    updateChoiceHud();
  });

  canvas.addEventListener("click", function (event) {
    updatePointerFromEvent(canvas, event);
    const hit = getCanvasHit();
    if (!hit) return;
    if (hit.type === "back") {
      goToPrevious3DQuestion();
    } else if (hit.type === "choice") {
      select3DChoice(hit.choiceIndex);
    } else if (hit.type === "planet") {
      focusPlanet(hit.planetId, { fromCanvas: true, clicked: true });
      runMicroPulse(hit.planetId);
    }
  });
}

function updatePointerFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
  appState.pointer.x = (x - 0.5) * 2;
  appState.pointer.y = (0.5 - y) * 2;
  galaxy.pointerVector.set(appState.pointer.x, appState.pointer.y);
}

function getCanvasHit() {
  if (!galaxy.raycaster || !galaxy.camera) return null;
  galaxy.raycaster.setFromCamera(galaxy.pointerVector, galaxy.camera);

  if (appState.threeDMode && galaxy.answerMeshes.length > 0) {
    if (canGoBackIn3D() && galaxy.backPortal && galaxy.backPortal.visible) {
      galaxy.hitBuffer.length = 0;
      galaxy.raycaster.intersectObjects(galaxy.backPortalMeshes, false, galaxy.hitBuffer);
      if (galaxy.hitBuffer.length) {
        return { type: "back" };
      }
      if (getBackPortalFromPointerProximity()) {
        return { type: "back" };
      }
    }

    galaxy.hitBuffer.length = 0;
    galaxy.raycaster.intersectObjects(galaxy.answerMeshes, false, galaxy.hitBuffer);
    if (galaxy.hitBuffer.length) {
      return { type: "choice", choiceIndex: galaxy.hitBuffer[0].object.userData.choiceIndex };
    }
    const nearbyChoice = getChoiceFromPointerProximity();
    if (nearbyChoice !== null) {
      return { type: "choice", choiceIndex: nearbyChoice };
    }
  }

  const planetId = getPlanetFromPointer();
  return planetId ? { type: "planet", planetId } : null;
}

function getChoiceFromPointerProximity() {
  if (!appState.threeDMode || !galaxy.camera || galaxy.answerModels.length === 0) return null;
  const compact = window.innerWidth < 700;
  const threshold = compact ? 0.32 : 0.22;
  let bestIndex = null;
  let bestScore = threshold * threshold;

  galaxy.answerModels.forEach(function (model, index) {
    if (!model.visible) return;
    model.getWorldPosition(galaxy.scratch.screenPosition);
    galaxy.scratch.screenPosition.project(galaxy.camera);
    if (galaxy.scratch.screenPosition.z < -1 || galaxy.scratch.screenPosition.z > 1) return;
    const dx = galaxy.pointerVector.x - galaxy.scratch.screenPosition.x;
    const dy = galaxy.pointerVector.y - galaxy.scratch.screenPosition.y;
    const score = dx * dx + dy * dy * 0.85;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getBackPortalFromPointerProximity() {
  if (!canGoBackIn3D() || !galaxy.backPortal || !galaxy.backPortal.visible || !galaxy.camera) return false;
  const compact = window.innerWidth < 700;
  const threshold = compact ? 0.24 : 0.16;
  galaxy.backPortal.getWorldPosition(galaxy.scratch.screenPosition);
  galaxy.scratch.screenPosition.project(galaxy.camera);
  if (galaxy.scratch.screenPosition.z < -1 || galaxy.scratch.screenPosition.z > 1) return false;
  const dx = galaxy.pointerVector.x - galaxy.scratch.screenPosition.x;
  const dy = galaxy.pointerVector.y - galaxy.scratch.screenPosition.y;
  return dx * dx + dy * dy * 0.85 < threshold * threshold;
}

function getPlanetFromPointer() {
  if (!galaxy.raycaster || !galaxy.camera || galaxy.planetMeshes.length === 0) return null;
  galaxy.hitBuffer.length = 0;
  galaxy.raycaster.intersectObjects(galaxy.planetMeshes, false, galaxy.hitBuffer);
  return galaxy.hitBuffer.length ? galaxy.hitBuffer[0].object.userData.planetId : null;
}

export function runMicroPulse(planetId, options = {}) {
  const planet = galaxy.planets[planetId];
  if (!planet) return;
  planet.userData.pulseUntil = galaxy.clock.elapsedTime + 1.2;
  appState.focusPulseUntil = galaxy.clock.elapsedTime + 1.35;
  if (options.preserveInsight) return;
  const insight = document.getElementById("live-insight");
  if (insight) {
    const config = PLANETS[planetId];
    insight.textContent = config.label + " selected in the 3D map. Meaning: " + config.role + ".";
  }
}

// ---------- Frame loop + per-frame updaters ----------

function animateGalaxy() {
  requestAnimationFrame(animateGalaxy);
  const delta = Math.min(galaxy.clock.getDelta(), 0.05);
  const elapsed = galaxy.clock.elapsedTime;
  const archetype = ARCHETYPES[appState.archetype];
  const visual = appState.galaxyState || refreshGalaxyState();

  if (!appState.reducedMotion) {
    galaxy.root.rotation.y += delta * (0.045 + visual.pressure * 0.035);
  }

  updatePlanets(elapsed, visual);
  updateBridges(elapsed, visual);
  updateParticles(delta, visual);
  updateVectorField(elapsed, visual);
  updateAnomalies(elapsed, visual);
  updateInteractionLayer(elapsed, visual);
  updateRescueRig(elapsed, delta, visual);
  updateAnswerDeck(elapsed, visual);

  galaxy.star.rotation.y += delta * 0.22;
  galaxy.star.rotation.x += delta * 0.1;
  galaxy.star.material.emissiveIntensity = 1.8 + Math.sin(elapsed * 2.4) * 0.28;

  const targetPlanet = galaxy.planets[archetype.focus];
  const target = targetPlanet ? targetPlanet.position : galaxy.scratch.lookAt;
  const revealing = appState.revealUntil > elapsed;
  const revealBoost = revealing ? 1 : 0;
  const desiredX = target.x * (0.08 + revealBoost * 0.12) + appState.pointer.x * 0.55;
  const desiredY = 7.5 + Math.abs(target.y) * 0.05 + appState.pointer.y * 0.22 - revealBoost * 0.85;
  const desiredZ = 13.4 + (visual.opsShadow * 0.9) - revealBoost * 2.2;
  galaxy.camera.position.x += (desiredX - galaxy.camera.position.x) * 0.035;
  galaxy.camera.position.y += (desiredY - galaxy.camera.position.y) * 0.025;
  galaxy.camera.position.z += (desiredZ - galaxy.camera.position.z) * 0.025;
  galaxy.camera.lookAt(0, 0, 0);

  galaxy.renderer.render(galaxy.scene, galaxy.camera);
}

function updateVectorField(elapsed, visual) {
  if (!galaxy.vectorField) return;
  const position = galaxy.vectorField.geometry.getAttribute("position");
  const base = galaxy.vectorField.userData.base;
  let cursor = 0;
  base.forEach(function (item) {
    const swirl = elapsed * (0.12 + item.ringIndex * 0.015);
    const warp = 1 + visual.handoffWarp * 0.08 + visual.automationDebris * 0.04;
    const angle = item.angle + swirl;
    const radius = item.radius * warp;
    const y = -0.45 + item.ringIndex * 0.04 + Math.sin(elapsed * 0.8 + item.angle * 2) * 0.04;
    let tangentX = -Math.sin(angle);
    let tangentY = 0.08 * Math.sin(angle * 2);
    let tangentZ = Math.cos(angle);
    const tangentLength = 1 / Math.hypot(tangentX, tangentY, tangentZ);
    tangentX *= tangentLength;
    tangentY *= tangentLength;
    tangentZ *= tangentLength;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const length = item.length * (1 + visual.completeness * 0.4);
    position.setXYZ(cursor, x, y, z);
    position.setXYZ(cursor + 1, x + tangentX * length, y + tangentY * length, z + tangentZ * length);
    cursor += 2;
  });
  position.needsUpdate = true;
  galaxy.vectorField.material.opacity = 0.16 + visual.completeness * 0.18;
}

function computeGalaxyState(archetypeId, answerCount, scaleStage) {
  const completeness = answerCount / QUESTION_FLOW.length;
  const pressure = SCALE_STAGES[scaleStage].pressure;
  return {
    handoffWarp: Math.min(1.45, (archetypeId === "handoff" ? 1 : 0.2 * completeness) + pressure * 0.34),
    ghostShell: Math.min(1.25, (archetypeId === "ghost" ? 1 : 0) + pressure * 0.18),
    automationDebris: Math.min(1.4, (archetypeId === "spreadsheet" ? 1 : 0) + pressure * 0.42),
    benchGlow: Math.min(1.35, (archetypeId === "bench" ? 1 : 0) + pressure * 0.16),
    hardwarePulse: Math.min(1.45, (archetypeId === "hardware" ? 1 : 0) + pressure * 0.22),
    opsShadow: Math.min(1.35, (archetypeId === "ops" ? 1 : 0) + pressure * 0.3),
    completeness,
    pressure
  };
}

export function refreshGalaxyState() {
  appState.galaxyState = computeGalaxyState(
    appState.archetype,
    Object.keys(appState.answers).length,
    appState.scaleStage
  );
  return appState.galaxyState;
}

function updatePlanets(elapsed, visual) {
  PLANET_IDS.forEach(function (id) {
    const config = PLANETS[id];
    const planet = galaxy.planets[id];
    const speed = appState.reducedMotion ? 0.03 : config.speed;
    let radius = config.radius * (1 + visual.pressure * 0.045);
    let inclination = config.inclination;

    if (id === "ops") radius += visual.opsShadow * 1.2;
    if (id === "automation") radius += visual.automationDebris * 0.35;
    if (id === "firmware" && appState.archetype === "handoff") inclination += 0.42;
    if (id === "backend" && appState.archetype === "handoff") inclination -= 0.42;
    if (visual.pressure > 0.6 && id === "data") inclination -= 0.18;
    if (visual.pressure > 0.4 && id === "automation") inclination += 0.2;

    const angle = config.angle + elapsed * speed * (1 + visual.pressure * 0.36);
    const y = Math.sin(angle) * radius * Math.sin(inclination) * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * Math.cos(inclination);
    planet.position.set(x, y, z);

    const selected = appState.selectedPlanet === id || appState.hoveredPlanet === id || ARCHETYPES[appState.archetype].focus === id;
    const pulse = planet.userData.pulseUntil && planet.userData.pulseUntil > elapsed
      ? Math.sin((planet.userData.pulseUntil - elapsed) * 10) * 0.12
      : 0;
    const pressureScale = visual.pressure * (id === "backend" || id === "automation" ? 0.18 : 0.08);
    const scale = (selected ? 1.42 : 1 + visual.benchGlow * (id === "firmware" ? 0.38 : 0)) + pressureScale + Math.max(pulse, 0);
    galaxy.scratch.scale.set(scale, scale, scale);
    planet.scale.lerp(galaxy.scratch.scale, 0.08);
    planet.userData.sphere.material.emissiveIntensity = selected ? 1.25 : 0.38;
    planet.userData.sphere.material.opacity = id === "ops" ? 1 - visual.opsShadow * 0.34 : 1;
    planet.userData.marker.material.opacity += ((selected ? 0.78 : 0.32) - planet.userData.marker.material.opacity) * 0.1;
    if (planet.userData.label) {
      const labelOpacity = appState.threeDMode
        ? selected ? 0.18 : 0.04
        : selected ? 1 : 0.52;
      planet.userData.label.material.opacity += (labelOpacity - planet.userData.label.material.opacity) * 0.1;
    }

    const orbit = galaxy.orbits[id];
    orbit.rotation.x = inclination;
    orbit.material.opacity = selected ? 0.46 : 0.16;
    planet.userData.ticks.rotation.x = inclination;
    planet.userData.ticks.material.opacity = selected ? 0.34 : 0.12;
  });
}

function updateBridges(elapsed, visual) {
  galaxy.bridges.forEach(function (bridge) {
    const [a, b] = bridge.userData.pair;
    const start = galaxy.planets[a].position;
    const end = galaxy.planets[b].position;
    let middleX = (start.x + end.x) * 0.5;
    let middleY = (start.y + end.y) * 0.5;
    let middleZ = (start.z + end.z) * 0.5;

    if ((a === "firmware" && b === "backend") || (a === "backend" && b === "ops")) {
      middleY += visual.handoffWarp * Math.sin(elapsed * 2.2) * 0.7;
      middleX += visual.handoffWarp * 0.45;
    }

    if (a === "backend" && b === "automation") {
      middleY += visual.automationDebris * 0.9;
    }

    const position = bridge.geometry.getAttribute("position");
    for (let i = 0; i <= BRIDGE_SEGMENTS; i += 1) {
      const t = i / BRIDGE_SEGMENTS;
      const inv = 1 - t;
      position.setXYZ(
        i,
        inv * inv * start.x + 2 * inv * t * middleX + t * t * end.x,
        inv * inv * start.y + 2 * inv * t * middleY + t * t * end.y,
        inv * inv * start.z + 2 * inv * t * middleZ + t * t * end.z
      );
    }
    position.needsUpdate = true;
    bridge.material.opacity = 0.18 + visual.completeness * 0.18 + visual.pressure * 0.08;
    bridge.material.color.setHex(visual.handoffWarp > 0.8 && a === "firmware" ? VISUAL_COLORS.soft : VISUAL_COLORS.accentSoft);
  });
}

function updateParticles(delta, visual) {
  galaxy.particles.forEach(function (particle) {
    const bridge = galaxy.bridges[particle.userData.bridgeIndex];
    const positionAttr = bridge.geometry.getAttribute("position");
    if (!positionAttr) return;

    particle.userData.progress = (particle.userData.progress + delta * particle.userData.speed * (1 + visual.pressure * 0.8)) % 1;
    if (visual.automationDebris > 0 && particle.userData.bridgeIndex === 2) {
      particle.userData.progress = (particle.userData.progress + delta * 0.08) % 1;
      particle.material.color.setHex(VISUAL_COLORS.soft);
    } else if (visual.opsShadow > 0 && particle.userData.bridgeIndex === 4) {
      particle.material.color.setHex(VISUAL_COLORS.dim);
    } else {
      particle.material.color.setHex(VISUAL_COLORS.text);
    }

    const index = Math.floor(particle.userData.progress * (positionAttr.count - 1));
    particle.position.set(
      positionAttr.getX(index),
      positionAttr.getY(index),
      positionAttr.getZ(index)
    );
    particle.visible = visual.completeness > 0.05 || particle.userData.progress < 0.45;
  });
}

function updateAnomalies(elapsed, visual) {
  const firmware = galaxy.planets.firmware.position;
  const backend = galaxy.planets.backend.position;
  galaxy.blackHole.position.set(
    (firmware.x + backend.x) * 0.5,
    (firmware.y + backend.y) * 0.5,
    (firmware.z + backend.z) * 0.5
  );
  galaxy.blackHole.scale.setScalar(1 + visual.handoffWarp * 0.6);
  galaxy.blackHole.rotation.z += 0.025 + visual.handoffWarp * 0.04;
  galaxy.blackHole.material.opacity += ((visual.handoffWarp > 0.85 ? 0.75 : 0.08) - galaxy.blackHole.material.opacity) * 0.08;
  galaxy.accretionRings.forEach(function (ring, index) {
    ring.position.copy(galaxy.blackHole.position);
    ring.scale.setScalar(1 + visual.handoffWarp * (0.3 + index * 0.18));
    ring.rotation.z += 0.018 + index * 0.012 + visual.handoffWarp * 0.02;
    ring.material.opacity += ((visual.handoffWarp > 0.85 ? 0.42 - index * 0.08 : 0.03) - ring.material.opacity) * 0.08;
  });

  galaxy.shell.material.opacity += ((visual.ghostShell ? 0.34 : 0) - galaxy.shell.material.opacity) * 0.08;
  galaxy.shell.rotation.y += 0.01;
  if (galaxy.starRings) {
    galaxy.starRings.children.forEach(function (ring, index) {
      ring.rotation.z += 0.006 + index * 0.003;
      ring.material.opacity += ((0.16 + visual.completeness * 0.12 + index * 0.03) - ring.material.opacity) * 0.04;
    });
  }

  const automation = galaxy.planets.automation.position;
  galaxy.debris.position.copy(automation);
  galaxy.debris.children.forEach(function (mesh) {
    const data = mesh.userData;
    const angle = data.angle + elapsed * data.speed;
    mesh.position.set(Math.cos(angle) * data.radius, Math.sin(angle * 1.7) * 0.12, Math.sin(angle) * data.radius);
    mesh.material.opacity += ((visual.automationDebris ? Math.min(0.92, 0.55 + visual.automationDebris * 0.3) : 0) - mesh.material.opacity) * 0.08;
  });

  if (appState.simulation) {
    const pulse = 0.5 + Math.sin(elapsed * (9 + visual.pressure * 5)) * 0.5;
    galaxy.blackHole.material.opacity = Math.max(galaxy.blackHole.material.opacity, pulse * 0.7);
    galaxy.star.scale.setScalar(1 + pulse * 0.09);
  } else if (appState.revealUntil > elapsed) {
    const revealPulse = 0.5 + Math.sin(elapsed * 7) * 0.5;
    galaxy.star.scale.setScalar(1.05 + revealPulse * 0.08);
  } else {
    galaxy.scratch.scale.set(1, 1, 1);
    galaxy.star.scale.lerp(galaxy.scratch.scale, 0.08);
  }
}

function updateInteractionLayer(elapsed, visual) {
  if (galaxy.ribbons) {
    galaxy.ribbons.children.forEach(function (ribbon, index) {
      ribbon.rotation.z += ribbon.userData.speed * (1 + visual.pressure * 0.45);
      ribbon.material.opacity += ((ribbon.userData.baseOpacity + visual.completeness * 0.04) - ribbon.material.opacity) * 0.04;
      ribbon.position.y = Math.sin(elapsed * 0.32 + index) * 0.03;
    });
  }

  if (!galaxy.focusHalo || !galaxy.focusBeam) return;
  const focusId = appState.hoveredPlanet || appState.selectedPlanet || ARCHETYPES[appState.archetype].focus;
  const targetPlanet = galaxy.planets[focusId];
  if (!targetPlanet) return;

  galaxy.focusHalo.position.lerp(targetPlanet.position, 0.16);
  const focusConfig = PLANETS[focusId];
  const pulseLeft = Math.max(0, appState.focusPulseUntil - elapsed);
  const pulse = pulseLeft ? Math.sin(pulseLeft * 9) * 0.18 + 0.22 : 0;
  const activeBoost = appState.threeDMode ? 0.2 : 0;
  galaxy.focusHaloRings.forEach(function (item, index) {
    const ringPulse = 1 + pulse + Math.sin(elapsed * (1.8 + index * 0.4)) * 0.035;
    item.scale.setScalar(ringPulse + index * 0.04);
    item.rotation.z += 0.01 + index * 0.006 + activeBoost * 0.01;
    item.material.color.setHex(index === 0 ? focusConfig.color : VISUAL_COLORS.soft);
    const targetOpacity = (item.userData.baseOpacity || 0.4) * (0.48 + activeBoost + visual.completeness * 0.28 + pulse);
    item.material.opacity += (Math.min(0.9, targetOpacity) - item.material.opacity) * 0.1;
  });

  const position = galaxy.focusBeam.geometry.getAttribute("position");
  position.setXYZ(0, 0, 0, 0);
  position.setXYZ(1, targetPlanet.position.x, targetPlanet.position.y, targetPlanet.position.z);
  position.needsUpdate = true;
  galaxy.focusBeam.material.color.setHex(focusConfig.color);
  const beamOpacity = 0.16 + visual.completeness * 0.16 + activeBoost * 0.24 + pulse * 0.42;
  galaxy.focusBeam.material.opacity += (Math.min(0.72, beamOpacity) - galaxy.focusBeam.material.opacity) * 0.1;
}

function updateRescueRig(elapsed, delta, visual) {
  if (!galaxy.rescueRig) return;
  const compact = window.innerWidth < 760;
  const activeFocus = appState.hoveredPlanet || appState.selectedPlanet || ARCHETYPES[appState.archetype].focus;
  const completeBoost = visual.completeness;
  const threeDModeDimming = appState.threeDMode ? 0.26 : 1;
  const targetScale = compact ? 0.78 : 1;
  galaxy.rescueRig.scale.lerp(galaxy.scratch.scale.set(targetScale, targetScale, targetScale), 0.06);
  galaxy.rescueRig.rotation.y += delta * (0.06 + visual.pressure * 0.04);
  galaxy.rescueRig.position.y = 0.28 + Math.sin(elapsed * 0.85) * 0.05;

  if (galaxy.rescueRigCore) {
    galaxy.rescueRigCore.rotation.y -= delta * 0.22;
    galaxy.rescueRigCore.rotation.x = Math.sin(elapsed * 0.5) * 0.08;
    const corePulse = 1 + Math.sin(elapsed * 2.8) * 0.035 + completeBoost * 0.08;
    galaxy.rescueRigCore.scale.setScalar(corePulse);
    const core = galaxy.rescueRigCore.userData.core;
    if (core && core.material) {
      core.material.emissiveIntensity += ((1.2 + completeBoost * 1.4 + visual.hardwarePulse * 0.7) - core.material.emissiveIntensity) * 0.08;
      core.material.opacity += ((0.76 + completeBoost * 0.16) * threeDModeDimming - core.material.opacity) * 0.08;
    }
    galaxy.rescueRigCore.children.forEach(function (child) {
      if (child.userData && child.userData.speed) child.rotation.z += child.userData.speed * (1 + completeBoost);
      if (child.material && child.material.userData.baseOpacity !== undefined) {
        const targetOpacity = child.material.userData.baseOpacity * (0.72 + completeBoost * 0.8) * threeDModeDimming;
        child.material.opacity += (Math.min(0.9, targetOpacity) - child.material.opacity) * 0.08;
      }
    });
  }

  Object.entries(galaxy.rescueRigObjects).forEach(function ([id, object], index) {
    const selected = id === activeFocus;
    const planet = PLANETS[id];
    const pulse = planet && galaxy.planets[id] && galaxy.planets[id].userData.pulseUntil > elapsed
      ? Math.sin((galaxy.planets[id].userData.pulseUntil - elapsed) * 11) * 0.16 + 0.22
      : 0;
    const hardwareBoost = id === "hardware" ? visual.hardwarePulse * 0.22 : 0;
    const targetObjectScale = (selected ? 1.2 : 0.95) + pulse + completeBoost * 0.08 + hardwareBoost;
    object.scale.lerp(galaxy.scratch.modelScale.set(targetObjectScale, targetObjectScale, targetObjectScale), 0.09);
    object.position.y = object.userData.basePosition.y + Math.sin(elapsed * (1.4 + index * 0.14) + index) * 0.055 + (selected ? 0.08 : 0);
    object.rotation.y = Math.sin(elapsed * 0.72 + index) * 0.1 + (selected ? appState.pointer.x * 0.16 : 0);
    object.rotation.x = Math.sin(elapsed * 0.5 + index * 0.7) * 0.04;
    object.traverse(function (child) {
      if (child.userData && child.userData.spin) child.rotation.z += delta * (1.6 + completeBoost * 1.8);
      if (child.userData && child.userData.sweep) child.rotation.z = elapsed * (1.8 + visual.pressure) % (Math.PI * 2);
      if (child.userData && child.userData.sweepRing) child.rotation.z += delta * 0.28;
      if (child.userData && child.userData.fault) {
        const faultPulse = 0.55 + Math.sin(elapsed * (visual.hardwarePulse > 0.4 ? 9.5 : 5.2)) * 0.45;
        child.scale.setScalar(1 + faultPulse * (0.45 + visual.hardwarePulse * 0.45));
        if (child.material) child.material.opacity = 0.32 + faultPulse * 0.62;
      }
      if (!child.material || child.material.userData.baseOpacity === undefined) return;
      const baseOpacity = child.material.userData.baseOpacity;
      const targetOpacity = baseOpacity * (selected ? 1.18 : 0.68 + completeBoost * 0.42) * threeDModeDimming;
      child.material.opacity += (Math.min(0.96, targetOpacity) - child.material.opacity) * 0.08;
      if (child.material.emissive) {
        child.material.emissiveIntensity += ((selected ? 0.42 : 0.12) + pulse * 0.8 + hardwareBoost) * 0.08 - child.material.emissiveIntensity * 0.04;
      }
    });
  });

  updateRescueRigCables(elapsed, visual, activeFocus, threeDModeDimming);
  updateRescueRigSignals(delta, visual, threeDModeDimming);
}

function updateRescueRigCables(elapsed, visual, activeFocus, opacityScale) {
  galaxy.rescueRigCables.forEach(function (cable, index) {
    const [a, b] = cable.userData.pair;
    const startObject = galaxy.rescueRigObjects[a];
    const endObject = galaxy.rescueRigObjects[b];
    if (!startObject || !endObject) return;
    const start = startObject.position;
    const end = endObject.position;
    const active = a === activeFocus || b === activeFocus;
    const height = 0.32 + Math.sin(elapsed * 1.2 + index) * 0.08 + visual.completeness * 0.26;
    const position = cable.geometry.getAttribute("position");
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const inv = 1 - t;
      const curve = Math.sin(t * Math.PI) * height;
      position.setXYZ(
        i,
        inv * start.x + t * end.x,
        inv * start.y + t * end.y + curve,
        inv * start.z + t * end.z + Math.sin(t * Math.PI + index) * 0.12
      );
    }
    position.needsUpdate = true;
    const targetOpacity = (active ? 0.68 : 0.18 + visual.completeness * 0.32) * opacityScale;
    cable.material.opacity += (Math.min(0.86, targetOpacity) - cable.material.opacity) * 0.08;
    cable.material.color.setHex(active ? PLANETS[activeFocus].color : index % 3 === 2 ? VISUAL_COLORS.warning : VISUAL_COLORS.accentSoft);
  });
}

function updateRescueRigSignals(delta, visual, opacityScale) {
  galaxy.rescueRigSignals.forEach(function (signal, index) {
    const cable = galaxy.rescueRigCables[signal.userData.cableIndex];
    if (!cable) return;
    const positionAttr = cable.geometry.getAttribute("position");
    const max = positionAttr.count - 1;
    signal.userData.progress = (signal.userData.progress + delta * signal.userData.speed * (1 + visual.completeness * 1.8 + visual.hardwarePulse * 0.8)) % 1;
    const exact = signal.userData.progress * max;
    const low = Math.floor(exact);
    const high = Math.min(max, low + 1);
    const t = exact - low;
    const x = positionAttr.getX(low) * (1 - t) + positionAttr.getX(high) * t;
    const y = positionAttr.getY(low) * (1 - t) + positionAttr.getY(high) * t;
    const z = positionAttr.getZ(low) * (1 - t) + positionAttr.getZ(high) * t;
    signal.position.set(x, y, z);
    const pulse = 0.7 + Math.sin(galaxy.clock.elapsedTime * 8 + index) * 0.3;
    signal.scale.setScalar(0.72 + pulse * 0.55 + visual.completeness * 0.45);
    signal.material.opacity += ((0.28 + visual.completeness * 0.58 + visual.hardwarePulse * 0.18) * opacityScale - signal.material.opacity) * 0.08;
  });
}

function updateAnswerDeck(elapsed, visual) {
  if (!galaxy.answerDeck) return;
  syncAnswerDeck();
  const active = appState.threeDMode && appState.webglReady;
  galaxy.answerDeck.visible = active;

  if (!active) {
    updateBackPortal(elapsed, visual, false);
    galaxy.choiceBeams.forEach(function (beam) {
      beam.material.opacity += (0 - beam.material.opacity) * 0.16;
    });
    return;
  }

  const compact = window.innerWidth < 700;
  const spread = compact ? 1.08 : 1.86;
  const deckY = compact ? 1.95 : 1.58;
  const deckZ = compact ? 5.0 : 4.65;
  const hasSelectedChoice = appState.selectedChoice !== null;
  galaxy.answerDeck.position.x += (appState.pointer.x * 0.18 - galaxy.answerDeck.position.x) * 0.08;
  galaxy.answerDeck.position.y += (deckY - galaxy.answerDeck.position.y) * 0.08;
  galaxy.answerDeck.position.z += (deckZ - galaxy.answerDeck.position.z) * 0.08;
  updateBackPortal(elapsed, visual, true);

  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  galaxy.answerModels.forEach(function (model, index) {
    const choice = question.choices[index];
    if (!choice) return;
    const data = model.userData;
    const hovered = appState.hoveredChoice === index;
    const selected = appState.selectedChoice === index;
    const pulse = appState.choicePulseUntil > elapsed ? Math.sin(elapsed * 18) * 0.08 + 0.08 : 0;
    const columnOffset = compact && index > 2 ? 0.46 : 0;
    const mobileLayout = [
      [-1.08, 0.06],
      [0, 0.06],
      [1.08, 0.06],
      [-0.56, -0.98],
      [0.56, -0.98]
    ];
    let x = compact ? mobileLayout[index][0] : (index - 2) * spread + columnOffset;
    let y = compact ? mobileLayout[index][1] : (index % 2 === 0 ? 0.08 : -0.2);
    let z = hovered ? 0.78 : 0;
    let targetScale = hovered ? 1.1 : 0.92;

    if (hasSelectedChoice) {
      const distance = index - appState.selectedChoice;
      if (selected) {
        x = appState.pointer.x * 0.1;
        y = compact ? 0.94 : 0.88;
        z = compact ? 1.68 : 1.78;
        targetScale = (compact ? 1.12 : 1.24) + pulse;
      } else {
        x = distance * (compact ? 1.16 : 1.58);
        y = compact ? -1.38 : -0.94;
        z = -0.92;
        targetScale = hovered ? 0.74 : 0.58;
      }
    }

    const dimmed = hasSelectedChoice && !selected && !hovered;
    setChoiceModelRenderPriority(model, selected ? 18 : hovered ? 12 : dimmed ? 4 : 8);
    galaxy.scratch.modelPosition.set(x, y, z);
    galaxy.scratch.modelScale.set(targetScale, targetScale, targetScale);
    model.position.lerp(galaxy.scratch.modelPosition, 0.12);
    model.scale.lerp(galaxy.scratch.modelScale, 0.12);
    model.rotation.y = elapsed * (0.36 + index * 0.035) + appState.pointer.x * 0.18;
    model.rotation.x = Math.sin(elapsed * 0.6 + index) * 0.08;

    data.core.material.emissiveIntensity += ((selected ? 2.8 : hovered ? 1.55 : 0.78) - data.core.material.emissiveIntensity) * 0.1;
    data.core.material.opacity += ((selected ? 1 : dimmed ? 0.42 : 0.86) - data.core.material.opacity) * 0.1;
    data.wire.material.opacity += ((selected ? 0.78 : hovered ? 0.62 : dimmed ? 0.14 : 0.28) - data.wire.material.opacity) * 0.1;
    data.marker.material.opacity += ((selected ? 1 : hovered ? 0.65 : dimmed ? 0.12 : 0.38) - data.marker.material.opacity) * 0.1;
    data.marker.rotation.z += 0.018 + visual.completeness * 0.012;
    data.axis.material.opacity += ((selected ? 0.84 : hovered ? 0.72 : dimmed ? 0.12 : 0.28) - data.axis.material.opacity) * 0.1;
    updateChoiceFrameState(data.frame, selected, hovered, dimmed);
    if (data.label) {
      data.label.material.opacity += ((selected ? 1 : hovered ? 0.92 : dimmed ? 0.36 : 0.78) - data.label.material.opacity) * 0.1;
      const labelX = compact ? 1.4 : 1.58;
      const labelY = compact ? 0.62 : 0.72;
      const labelBoost = selected ? 0.22 : hovered ? 0.08 : 0;
      galaxy.scratch.labelScale.set(labelX + labelBoost, labelY + labelBoost * 0.45, 1);
      data.label.scale.lerp(galaxy.scratch.labelScale, 0.12);
    }
    updateChoiceModelMotion(data, elapsed, selected, hovered, visual);

    updateChoiceBeam(index, choice, selected, hovered, visual);
  });
}

function updateBackPortal(elapsed, visual, deckActive) {
  if (!galaxy.backPortal) return;
  const enabled = deckActive && canGoBackIn3D();
  const portal = galaxy.backPortal;
  portal.visible = enabled;
  if (!enabled) {
    appState.hoveredBack = false;
    return;
  }

  const compact = window.innerWidth < 700;
  const pulseLeft = Math.max(0, appState.backPortalPulseUntil - elapsed);
  const pulse = pulseLeft ? Math.sin(pulseLeft * 11) * 0.14 + 0.18 : 0;
  const hoverBoost = appState.hoveredBack ? 0.14 : 0;
  const targetScale = (compact ? 0.54 : 0.74) + hoverBoost + pulse * 0.28;
  const targetX = compact ? -1.56 : -5.24;
  const targetY = compact ? 1.76 : 2.18;
  const targetZ = compact ? 1.78 : 2.02;

  galaxy.scratch.modelPosition.set(targetX, targetY + Math.sin(elapsed * 2.8) * 0.035, targetZ);
  galaxy.scratch.modelScale.set(targetScale, targetScale, targetScale);
  portal.position.lerp(galaxy.scratch.modelPosition, 0.14);
  portal.scale.lerp(galaxy.scratch.modelScale, 0.14);
  portal.lookAt(galaxy.camera.position);
  portal.renderOrder = 26;

  portal.children.forEach(function (child, index) {
    if (child.userData && child.userData.portalParticle) {
      const data = child.userData;
      const angle = data.angle + elapsed * data.speed * (1 + hoverBoost);
      const radius = data.radius + Math.sin(elapsed * 1.7 + index) * 0.035;
      child.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.48,
        data.depth + Math.sin(angle * 2 + elapsed) * 0.025
      );
      child.scale.setScalar(1 + hoverBoost * 1.4 + pulse * 0.7);
    }
    if (child.userData && child.userData.speed) {
      child.rotation.z += child.userData.speed * (1 + hoverBoost * 2 + visual.pressure * 0.2);
    }
    if (!child.material) return;
    child.renderOrder = child.type === "Sprite" ? 34 : 26 + index;
    if (child.material.userData.baseOpacity === undefined) return;
    const baseOpacity = child.material.userData.baseOpacity;
    const targetOpacity = Math.min(1, baseOpacity * (1 + hoverBoost + pulse));
    child.material.opacity += (targetOpacity - child.material.opacity) * 0.14;
  });

  if (portal.userData.lens && portal.userData.lens.material) {
    const lensOpacity = 0.34 + hoverBoost * 0.32 + pulse * 0.42;
    portal.userData.lens.material.opacity += (Math.min(0.9, lensOpacity) - portal.userData.lens.material.opacity) * 0.12;
  }
  if (portal.userData.halo && portal.userData.halo.material) {
    const haloScale = 1.05 + Math.sin(elapsed * 2.4) * 0.035 + hoverBoost * 0.12;
    portal.userData.halo.scale.setScalar(haloScale);
    portal.userData.halo.material.opacity += ((0.16 + hoverBoost * 0.18 + pulse * 0.28) - portal.userData.halo.material.opacity) * 0.12;
  }
  if (portal.userData.core && portal.userData.core.material) {
    portal.userData.core.scale.setScalar(1 + hoverBoost * 0.06 + pulse * 0.05);
    portal.userData.core.material.opacity += ((appState.hoveredBack ? 1 : 0.94) - portal.userData.core.material.opacity) * 0.12;
  }
}

function setChoiceModelRenderPriority(model, priority) {
  model.renderOrder = priority;
  model.traverse(function (child) {
    if (!child.material) return;
    child.renderOrder = child.type === "Sprite" ? priority + 6 : priority;
  });
}

function updateChoiceModelMotion(data, elapsed, selected, hovered, visual) {
  const group = data.detailGroup;
  if (!group) return;
  const kind = data.visualKind || group.userData.kind;
  const intensity = selected ? 1 : hovered ? 0.72 : 0.28;
  const pulse = 1 + Math.sin(elapsed * (selected ? 6.4 : 3.2) + group.userData.choiceIndex) * 0.035 * intensity;
  galaxy.scratch.detailScale.set(pulse, pulse, pulse);
  group.scale.lerp(galaxy.scratch.detailScale, 0.12);

  if (CHOICE_MOTION_GROUPS.spin.has(kind)) {
    group.rotation.z += 0.012 + intensity * 0.045;
  } else if (CHOICE_MOTION_GROUPS.sweep.has(kind)) {
    group.rotation.y = Math.sin(elapsed * 1.8) * 0.22 * intensity;
    group.rotation.z += 0.006 + intensity * 0.018;
  } else if (CHOICE_MOTION_GROUPS.orbit.has(kind)) {
    group.rotation.y += 0.006 + intensity * 0.018;
  } else if (CHOICE_MOTION_GROUPS.incident.has(kind)) {
    group.rotation.y += 0.018 + intensity * 0.026;
    group.position.y = Math.sin(elapsed * 5.2) * 0.05 * intensity;
  } else if (CHOICE_MOTION_GROUPS.stack.has(kind)) {
    group.position.y = Math.sin(elapsed * 3.6 + group.userData.choiceIndex) * 0.035 * intensity;
    group.rotation.x = Math.sin(elapsed * 1.3) * 0.05 * intensity;
  } else if (CHOICE_MOTION_GROUPS.bridge.has(kind)) {
    group.rotation.z = Math.sin(elapsed * 2.2 + group.userData.choiceIndex) * 0.08 * intensity;
  } else if (kind === "ownerCrown") {
    group.position.y = 0.04 + Math.sin(elapsed * 3.4) * 0.045 * intensity;
    group.rotation.y += 0.008 + intensity * 0.015;
  } else if (CHOICE_MOTION_GROUPS.cluster.has(kind)) {
    group.rotation.y += 0.007 + intensity * 0.012;
    group.position.y = Math.sin(elapsed * 2.6 + group.userData.choiceIndex) * 0.025 * intensity;
  } else {
    group.rotation.y += 0.008 + intensity * 0.01;
  }
}

function updateChoiceBeam(index, choice, selected, hovered, visual) {
  const beam = galaxy.choiceBeams[index];
  const model = galaxy.answerModels[index];
  if (!beam || !model) return;
  const planetId = inferPlanet(choice.value);
  const planet = galaxy.planets[planetId];
  if (!planet) {
    beam.material.opacity += (0 - beam.material.opacity) * 0.14;
    return;
  }

  model.getWorldPosition(galaxy.scratch.beamStart);
  planet.getWorldPosition(galaxy.scratch.beamEnd);
  galaxy.scratch.beamMiddle.lerpVectors(galaxy.scratch.beamStart, galaxy.scratch.beamEnd, 0.5);
  galaxy.scratch.beamMiddle.y += 0.65 + visual.pressure * 0.35;
  const position = beam.geometry.getAttribute("position");
  position.setXYZ(0, galaxy.scratch.beamStart.x, galaxy.scratch.beamStart.y, galaxy.scratch.beamStart.z);
  position.setXYZ(1, galaxy.scratch.beamMiddle.x, galaxy.scratch.beamMiddle.y, galaxy.scratch.beamMiddle.z);
  position.setXYZ(2, galaxy.scratch.beamEnd.x, galaxy.scratch.beamEnd.y, galaxy.scratch.beamEnd.z);
  position.needsUpdate = true;
  beam.material.color.setHex(PLANETS[planetId].color);
  const hasSelectedChoice = appState.selectedChoice !== null;
  const baseOpacity = hasSelectedChoice && !selected && !hovered ? 0.035 : 0.11;
  beam.material.opacity += ((selected ? 0.76 : hovered ? 0.42 : baseOpacity) - beam.material.opacity) * 0.12;
}

// ---------- Cinematic helpers ----------

export function runWhatIfSimulation(type) {
  appState.simulation = type || "handoff";
  const insight = document.getElementById("live-insight");
  if (insight) {
    insight.textContent = "Adding motion layer: " + appState.simulation + ". Watch the map settle into a stronger constellation.";
  }
  window.setTimeout(function () {
    appState.simulation = null;
  }, appState.reducedMotion ? 800 : 4200);
}
