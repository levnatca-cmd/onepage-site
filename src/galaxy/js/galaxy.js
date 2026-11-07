// Three.js scene: setup, geometry builders, frame loop, pointer interaction.
// Reads/mutates the shared `galaxy` and `appState` singletons from state.js.

import * as THREE from "../../../vendor/three/three.module.min.js";

import {
  VISUAL_COLORS,
  QUALITY_CONFIG,
  BRIDGE_SEGMENTS
} from "./data/config.js?v=wow50";
import {
  PLANETS,
  PLANET_IDS,
  QUESTION_FLOW,
  CHOICE_VISUALS,
  CHOICE_MOTION_GROUPS,
  SCALE_STAGES,
  ARCHETYPES
} from "./data/quiz-data.js?v=wow50";
import { SYSTEM_PRESENTATIONS } from "./data/scene-presentations.js?v=wow50";
import { appState, galaxy } from "./state.js?v=wow50";
import {
  createSpherePresentation,
  retargetSpherePresentation,
  updateSpherePresentation
} from "./scene/sphere-kit.js?v=wow50";
import { buildSystemModel as buildSemanticSystemModel } from "./scene/system-models/index.js?v=wow50";
import {
  updateChoiceHud,
  focusPlanet,
  inferPlanet,
  findChoiceIndex,
  canGoBackIn3D,
  goToPrevious3DQuestion,
  select3DChoice
} from "./ui.js?v=wow50";

const SCENE_DEBUG = createSceneDebugConfig();
if (SCENE_DEBUG.forceReducedMotion) {
  appState.reducedMotion = true;
  document.documentElement.classList.add("is-reduced-motion");
}

const DEFAULT_CHOICE_POSE = Object.freeze({
  scale: 1,
  detailScale: 1,
  tiltX: 0,
  tiltZ: 0,
  yaw: 0,
  yawRange: 0.12
});

const CHOICE_POSES = Object.freeze({
  webInterface: { scale: 1.08, detailScale: 1.08, tiltX: -0.04, tiltZ: 0, yaw: 0, yawRange: 0.1 },
  apiStack: { scale: 1.02, detailScale: 1.04, tiltX: -0.02, tiltZ: 0, yaw: -0.08, yawRange: 0.14 },
  workflowGear: { scale: 1.08, detailScale: 1.08, tiltX: 0.08, tiltZ: -0.04, yaw: 0, yawRange: 0.08 },
  dataVault: { scale: 1.04, detailScale: 1.04, tiltX: 0, tiltZ: 0, yaw: 0.08, yawRange: 0.18 },
  hardwarePort: { scale: 1.08, detailScale: 1.1, tiltX: -0.28, tiltZ: 0.03, yaw: -0.08, yawRange: 0.12 },
  opsRadar: { scale: 1.1, detailScale: 1.1, tiltX: -0.06, tiltZ: 0, yaw: 0.08, yawRange: 0.14 },
  deviceFleet: { scale: 1.04, detailScale: 1.05, tiltX: -0.03, tiltZ: 0, yaw: 0, yawRange: 0.12 },
  logConsole: { scale: 1.06, detailScale: 1.06, tiltX: -0.03, tiltZ: 0, yaw: 0, yawRange: 0.1 },
  architectureMap: { scale: 1.08, detailScale: 1.1, tiltX: -0.24, tiltZ: 0, yaw: 0, yawRange: 0.08 },
  monitoringArray: { scale: 1.08, detailScale: 1.08, tiltX: -0.04, tiltZ: 0, yaw: 0, yawRange: 0.16 }
});

function createSceneDebugConfig() {
  const params = new URLSearchParams(window.location.search);
  const hasPhase = params.has("scenePhase");
  const hasTime = params.has("sceneTime");
  const phase = hasPhase ? Number(params.get("scenePhase")) : null;
  const elapsed = hasTime ? Number(params.get("sceneTime")) : null;
  const forceContextLoss = params.get("forceContextLoss") === "1";
  return {
    enabled: params.get("sceneDebug") === "1" || hasPhase || hasTime || params.has("forceFallback") || forceContextLoss,
    forceFallback: params.get("forceFallback") === "1",
    forceContextLoss,
    forceReducedMotion: params.get("motion") === "reduce",
    fixedPhase: Number.isFinite(phase) ? THREE.MathUtils.clamp(phase, 0, 1) : null,
    fixedElapsed: Number.isFinite(elapsed) ? Math.max(0, elapsed) : null
  };
}

function installSceneDebugApi() {
  if (!SCENE_DEBUG.enabled) return;
  window.__sceneDebug = {
    getSnapshot: function () {
      const presentations = {};
      const planetPresentations = {};
      const choicePresentations = [];
      const targets = {};
      Object.entries(galaxy.rescueRigObjects).forEach(function ([id, object]) {
        const presentation = object.userData.presentation;
        if (!presentation) return;
        presentations[id] = {
          angle: presentation.spinAngle,
          radius: presentation.radius,
          innerRadius: presentation.innerRadius,
          fit: presentation.fit
        };
      });
      Object.entries(galaxy.planets).forEach(function ([id, planet]) {
        const presentation = planet.userData.presentation;
        if (!presentation) return;
        planetPresentations[id] = {
          angle: presentation.spinAngle,
          radius: presentation.radius,
          innerRadius: presentation.innerRadius,
          fit: presentation.fit
        };
      });
      galaxy.answerModels.forEach(function (model, index) {
        const data = model.userData;
        const presentation = data.presentation;
        if (!presentation) return;
        choicePresentations.push({
          index,
          id: presentation.id,
          angle: presentation.spinAngle,
          radius: presentation.radius,
          innerRadius: presentation.innerRadius,
          fit: presentation.fit,
          shellMaterial: presentation.shellMaterial.uuid,
          shellGeometry: presentation.shell.geometry.uuid,
          detailDispose: data.lastDetailDispose || null,
          hierarchySafe: Boolean(
            isObjectInside(data.semanticHost, presentation.spinPivot)
            && [data.label, data.frame, data.marker, data.axis, data.collider].every(function (object) {
              return object && !isObjectInside(object, presentation.spinPivot);
            })
          )
        });
      });
      if (galaxy.camera && galaxy.renderer) {
        const canvas = galaxy.renderer.domElement;
        const canvasRect = canvas.getBoundingClientRect();
        Object.entries(galaxy.planets).forEach(function ([id, planet]) {
          const point = new THREE.Vector3();
          planet.getWorldPosition(point);
          point.project(galaxy.camera);
          targets[id] = {
            x: canvasRect.left + (point.x + 1) * 0.5 * canvasRect.width,
            y: canvasRect.top + (1 - point.y) * 0.5 * canvasRect.height,
            depth: point.z
          };
        });
      }
      const render = galaxy.renderer ? galaxy.renderer.info.render : null;
      return {
        webglReady: appState.webglReady,
        reducedMotion: appState.reducedMotion,
        selectedPlanet: appState.selectedPlanet,
        fixedPhase: SCENE_DEBUG.fixedPhase,
        fixedElapsed: SCENE_DEBUG.fixedElapsed,
        renderer: render ? {
          calls: render.calls,
          triangles: render.triangles,
          lines: render.lines,
          points: render.points
        } : null,
        interactions: {
          planetMeshes: galaxy.planetMeshes.length,
          answerMeshes: galaxy.answerMeshes.length
        },
        targets,
        presentations,
        planetPresentations,
        choicePresentations
      };
    },
    setPhase: function (value) {
      const phase = Number(value);
      SCENE_DEBUG.fixedPhase = Number.isFinite(phase)
        ? THREE.MathUtils.clamp(phase, 0, 1)
        : null;
    },
    setTime: function (value) {
      const elapsed = Number(value);
      SCENE_DEBUG.fixedElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : null;
    },
    setReducedMotion: function (value) {
      appState.reducedMotion = Boolean(value);
    },
    setPresentationVisible: function (id, value) {
      const object = galaxy.rescueRigObjects[id];
      if (object && object.userData.presentation) object.visible = Boolean(value);
    },
    setPlanetPresentationVisible: function (id, value) {
      const planet = galaxy.planets[id];
      if (planet && planet.userData.presentation) {
        planet.userData.presentation.root.visible = Boolean(value);
      }
    }
  };
}

function isObjectInside(object, ancestor) {
  let current = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

// ---------- Scene init ----------

export function initGalaxyScene() {
  const canvas = document.getElementById("galaxy-canvas");
  const hero = document.querySelector(".galaxy-hero");

  if (!canvas || !window.WebGLRenderingContext || SCENE_DEBUG.forceFallback) {
    if (hero) hero.classList.add("webgl-failed");
    installSceneDebugApi();
    return;
  }

  if (hero) hero.classList.add("is-loading");
  const loading = document.getElementById("galaxy-loading");
  if (loading) loading.hidden = false;

  galaxy.scene = new THREE.Scene();
  galaxy.scene.fog = new THREE.FogExp2(0x080a0f, 0.026);
  galaxy.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  galaxy.camera.position.set(0.8, 7.4, 12.2);
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
  galaxy.renderer.toneMappingExposure = 1.48;
  bindWebGLContextLifecycle(canvas, hero, loading);

  galaxy.root = new THREE.Group();
  galaxy.root.rotation.x = -0.32;
  galaxy.root.rotation.z = 0.08;
  galaxy.scene.add(galaxy.root);
  applyHeroGalaxyComposition();

  const ambient = new THREE.AmbientLight(0xd8e8f2, 0.58);
  galaxy.scene.add(ambient);

  const key = new THREE.PointLight(VISUAL_COLORS.accent, 4.1, 30);
  key.position.set(0, 0, 0);
  galaxy.root.add(key);

  const rim = new THREE.PointLight(VISUAL_COLORS.soft, 1.55, 34);
  rim.position.set(-5, 5, 7);
  galaxy.scene.add(rim);

  createProductStar();
  createOrbitalRibbons();
  createEnergyEffects();
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
  installSceneDebugApi();
  if (hero) hero.classList.add("webgl-ready");
  animateGalaxy();
  if (SCENE_DEBUG.forceContextLoss) {
    window.setTimeout(function () {
      if (galaxy.renderer && typeof galaxy.renderer.forceContextLoss === "function") {
        galaxy.renderer.forceContextLoss();
      }
    }, 320);
  }
  scheduleIdleGeometry();
  const clearLoading = function () {
    if (hero) hero.classList.remove("is-loading");
    if (loading) loading.hidden = true;
  };
  requestAnimationFrame(clearLoading);
  window.setTimeout(clearLoading, 420);
}

function bindWebGLContextLifecycle(canvas, hero, loading) {
  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault();
    appState.webglReady = false;
    appState.threeDMode = false;
    appState.hoveredBack = false;
    appState.hoveredChoice = null;
    canvas.classList.remove("is-targeting");
    if (hero) {
      hero.classList.remove("webgl-ready", "is-loading", "is-3d-mode", "is-launching");
      hero.classList.add("webgl-failed");
    }
    if (loading) loading.hidden = true;
    updateChoiceHud();
  });

  canvas.addEventListener("webglcontextrestored", function () {
    window.location.reload();
  });
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
  const starGeometry = new THREE.OctahedronGeometry(0.38, 2);
  const starMaterial = new THREE.MeshStandardMaterial({
    color: VISUAL_COLORS.text,
    emissive: VISUAL_COLORS.accent,
    emissiveIntensity: 1.65,
    roughness: 0.22,
    metalness: 0.28
  });
  galaxy.star = new THREE.Mesh(starGeometry, starMaterial);
  galaxy.star.position.set(0.04, 0.12, -0.18);
  galaxy.root.add(galaxy.star);

  const wireGeometry = new THREE.OctahedronGeometry(0.43, 1);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.text,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });
  const wire = new THREE.Mesh(wireGeometry, wireMaterial);
  galaxy.star.add(wire);

  const haloGeometry = new THREE.SphereGeometry(0.78, 40, 24);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.accent,
    transparent: true,
    opacity: 0.055,
    depthWrite: false
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.position.copy(galaxy.star.position);
  galaxy.starHalo = halo;
  galaxy.root.add(halo);

  galaxy.starRings = new THREE.Group();
  [
    { radius: 0.62, tube: 0.008, color: VISUAL_COLORS.accent, opacity: 0.3, x: 1.4, y: 0.16 },
    { radius: 0.82, tube: 0.007, color: VISUAL_COLORS.api, opacity: 0.2, x: 1.08, y: -0.24 },
    { radius: 1.02, tube: 0.006, color: VISUAL_COLORS.automation, opacity: 0.14, x: 1.72, y: 0.48 }
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
  galaxy.starRings.position.copy(galaxy.star.position);
  galaxy.root.add(galaxy.starRings);

  const shellGeometry = new THREE.SphereGeometry(0.66, 32, 18, 0, Math.PI * 1.25);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.soft,
    wireframe: true,
    transparent: true,
    opacity: 0
  });
  galaxy.shell = new THREE.Mesh(shellGeometry, shellMaterial);
  galaxy.shell.position.copy(galaxy.star.position);
  galaxy.root.add(galaxy.shell);
}

function createOrbitalRibbons() {
  galaxy.ribbons = new THREE.Group();
  const ribbonConfigs = [
    { radius: 3.25, color: VISUAL_COLORS.accent, opacity: 0.12, x: 1.08, y: 0.2, z: -0.14, speed: 0.006 },
    { radius: 6.7, color: VISUAL_COLORS.automation, opacity: 0.07, x: 1.0, y: 0.48, z: 0.08, speed: -0.003 }
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

function createEnergyEffects() {
  galaxy.energyArcs = new THREE.Group();
  const arcConfigs = [
    { radius: 1.3, height: 0.34, color: VISUAL_COLORS.accent, opacity: 0.2, speed: 0.005, tilt: 1.1 },
    { radius: 1.72, height: 0.24, color: VISUAL_COLORS.automation, opacity: 0.12, speed: -0.003, tilt: 1.42 }
  ];

  arcConfigs.forEach(function (config, arcIndex) {
    const points = [];
    const segments = 160;
    const start = -0.18 + arcIndex * 0.14;
    const sweep = Math.PI * (1.18 + arcIndex * 0.12);
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const angle = start + t * sweep;
      const wave = Math.sin(t * Math.PI) * config.height;
      points.push(new THREE.Vector3(
        Math.cos(angle) * config.radius,
        wave + Math.sin(angle * 2.2 + arcIndex) * 0.08,
        Math.sin(angle) * config.radius * 0.76
      ));
    }

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false
      })
    );
    line.rotation.x = config.tilt;
    line.rotation.y = arcIndex * 0.34;
    line.userData = {
      baseOpacity: config.opacity,
      speed: config.speed,
      phase: arcIndex * 0.8
    };
    galaxy.energyArcs.add(line);
  });
  galaxy.root.add(galaxy.energyArcs);

  galaxy.shockwaves = [];
  [
    { radius: 1.08, color: VISUAL_COLORS.accent, phase: 0 }
  ].forEach(function (config, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, 0.006, 8, 180),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2 + index * 0.16;
    ring.rotation.y = index * 0.24;
    ring.userData = {
      baseRadius: config.radius,
      phase: config.phase,
      baseOpacity: index === 0 ? 0.24 : 0.16
    };
    galaxy.shockwaves.push(ring);
    galaxy.root.add(ring);
  });
}

function createHeroShowcaseEffect() {
  galaxy.heroShowcase = new THREE.Group();
  galaxy.heroShowcase.position.set(3.4, -0.28, -0.65);
  galaxy.heroShowcase.rotation.set(-0.18, -0.22, 0.08);
  galaxy.heroShowcaseParts = [];

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.86, 4),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.text,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  core.userData.heroRole = "core";
  galaxy.heroShowcaseParts.push(core);
  galaxy.heroShowcase.add(core);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.42, 64, 32),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.userData.heroRole = "glow";
  galaxy.heroShowcaseParts.push(glow);
  galaxy.heroShowcase.add(glow);

  [
    { radius: 1.65, tube: 0.012, color: VISUAL_COLORS.accent, opacity: 0.74, x: 1.34, y: 0.12, speed: 0.014 },
    { radius: 2.18, tube: 0.01, color: VISUAL_COLORS.soft, opacity: 0.48, x: 1.08, y: -0.42, speed: -0.011 },
    { radius: 2.72, tube: 0.008, color: VISUAL_COLORS.warning, opacity: 0.34, x: 1.62, y: 0.62, speed: 0.008 },
    { radius: 3.18, tube: 0.006, color: VISUAL_COLORS.muted, opacity: 0.24, x: 1.2, y: 0.84, speed: -0.006 }
  ].forEach(function (config, index) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, config.tube, 8, 220),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.x = config.x;
    ring.rotation.y = config.y;
    ring.userData = {
      heroRole: "ring",
      speed: config.speed,
      baseOpacity: config.opacity,
      phase: index * 0.7
    };
    galaxy.heroShowcaseParts.push(ring);
    galaxy.heroShowcase.add(ring);
  });

  const beamPositions = [];
  const beamCount = 30;
  for (let i = 0; i < beamCount; i += 1) {
    const angle = (i / beamCount) * Math.PI * 2;
    const inner = 1.1 + (i % 3) * 0.16;
    const outer = 3.25 + (i % 5) * 0.18;
    beamPositions.push(
      Math.cos(angle) * inner,
      Math.sin(angle * 2) * 0.22,
      Math.sin(angle) * inner * 0.72,
      Math.cos(angle) * outer,
      Math.sin(angle * 2 + 0.8) * 0.34,
      Math.sin(angle) * outer * 0.72
    );
  }
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(beamPositions, 3));
  const beams = new THREE.LineSegments(
    beamGeometry,
    new THREE.LineBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  beams.userData = {
    heroRole: "beams",
    baseOpacity: 0.28
  };
  galaxy.heroShowcaseParts.push(beams);
  galaxy.heroShowcase.add(beams);

  galaxy.scene.add(galaxy.heroShowcase);
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
    planet.userData = { id, base: config, ticks, visualMaterials: [] };

    const visual = createSystemModel(id, config.color);
    visual.traverse(function (child) {
      if (!child.material) return;
      child.material.userData.planetBaseOpacity = child.material.opacity === undefined ? 1 : child.material.opacity;
      planet.userData.visualMaterials.push(child.material);
    });
    const presentationConfig = SYSTEM_PRESENTATIONS[id];
    const sphereRadius = config.size * presentationConfig.planetRadiusMultiplier;
    const presentation = createSpherePresentation({
      id,
      context: "planet",
      color: config.color,
      model: visual,
      config: presentationConfig,
      radius: sphereRadius,
      compact: window.innerWidth < 760
    });
    planet.userData.visual = visual;
    planet.userData.presentation = presentation;
    planet.add(presentation.root);

    const collider = new THREE.Mesh(
      new THREE.SphereGeometry(sphereRadius, 18, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001,
        depthWrite: false
      })
    );
    collider.userData.planetId = id;
    planet.userData.collider = collider;
    planet.add(collider);

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(config.size * 1.85, 0.008, 8, 72),
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
    label.position.set(0, config.size + 0.54, 0);
    label.scale.multiplyScalar(0.88);
    planet.userData.label = label;
    planet.add(label);

    presentation.root.visible = false;
    marker.visible = false;
    label.visible = false;

    galaxy.planets[id] = planet;
    galaxy.root.add(planet);
  });
}

function createSystemModel(id, color) {
  return buildSemanticSystemModel(id, color, getSystemModelKit()).root;
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
  galaxy.rescueRig.position.set(0.18, 0.24, 0.12);
  galaxy.rescueRig.rotation.x = 0.04;
  galaxy.rescueRig.rotation.z = -0.03;
  galaxy.root.add(galaxy.rescueRig);

  galaxy.rescueRigCore = new THREE.Group();
  galaxy.rescueRig.add(galaxy.rescueRigCore);

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34, 2, 2, 2),
    new THREE.MeshStandardMaterial({
      color: 0x1b2a34,
      emissive: VISUAL_COLORS.accent,
      emissiveIntensity: 0.9,
      roughness: 0.24,
      metalness: 0.7,
      transparent: true,
      opacity: 0.92
    })
  );
  core.rotation.set(0.42, 0.58, 0.18);
  galaxy.rescueRigCore.add(core);
  galaxy.rescueRigCore.userData.core = core;

  [0.56, 0.76, 0.98].forEach(function (radius, index) {
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
    { id: "firmware", position: [-2.55, 0.42, 0.34], rotation: [-0.04, 0.12, -0.03], color: PLANETS.firmware.color },
    { id: "backend", position: [-1.08, 1.2, -0.26], rotation: [0, -0.1, 0.02], color: PLANETS.backend.color },
    { id: "automation", position: [1.12, 1.08, -0.16], rotation: [0.02, 0.06, -0.02], color: PLANETS.automation.color },
    { id: "data", position: [2.52, 0.12, 0.22], rotation: [0, 0.12, 0], color: PLANETS.data.color },
    { id: "hardware", position: [1.05, -1.28, 0.5], rotation: [-0.22, -0.08, 0.03], color: PLANETS.hardware.color },
    { id: "ops", position: [-1.42, -1.18, 0.2], rotation: [-0.04, 0.1, 0], color: PLANETS.ops.color }
  ];

  configs.forEach(function (config) {
    const built = buildSemanticSystemModel(config.id, config.color, getSystemModelKit());
    const semanticModel = built.root;
    const presentation = createSpherePresentation({
      id: config.id,
      context: "rescue",
      color: config.color,
      model: semanticModel,
      config: SYSTEM_PRESENTATIONS[config.id],
      compact: window.innerWidth < 760
    });
    const object = presentation.root;
    object.userData.semanticModel = semanticModel;
    object.position.set(config.position[0], config.position[1], config.position[2]);
    object.userData.id = config.id;
    object.userData.basePosition = new THREE.Vector3(config.position[0], config.position[1], config.position[2]);
    object.userData.baseRotation = new THREE.Euler(config.rotation[0], config.rotation[1], config.rotation[2]);
    object.userData.color = config.color;
    object.userData.semanticRole = built.semanticRole;
    object.userData.mechanicalParts = built.mechanicalParts;
    object.userData.materials = [];
    semanticModel.traverse(function (child) {
      if (!child.material) return;
      child.material.userData.baseOpacity = child.material.opacity === undefined ? 1 : child.material.opacity;
      if (child.material.color && !child.material.userData.baseColor) {
        child.material.userData.baseColor = child.material.color.clone();
        child.material.userData.dimColor = child.material.color.clone().multiplyScalar(0.58);
      }
      object.userData.materials.push(child.material);
    });
    const collider = new THREE.Mesh(
      new THREE.SphereGeometry(presentation.radius * 1.12, 18, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001,
        depthWrite: false
      })
    );
    collider.userData.planetId = config.id;
    object.userData.collider = collider;
    object.add(collider);
    galaxy.planetMeshes.push(collider);
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

function getSystemModelKit() {
  return {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  };
}

function createRigBasicMaterial(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 0.98,
    opacity,
    depthWrite: false
  });
}

function createRescueRigCables() {
  const pairs = [
    ["firmware", "backend"],
    ["backend", "automation"],
    ["automation", "data"],
    ["data", "hardware"],
    ["hardware", "ops"],
    ["ops", "firmware"]
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
  for (let i = 0; i < 8; i += 1) {
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

  const semanticHost = new THREE.Group();
  semanticHost.name = `choice-${index}-semantic-host`;

  const core = new THREE.Mesh(
    createChoiceGeometry("webInterface"),
    new THREE.MeshStandardMaterial({
      color: VISUAL_COLORS.accent,
      emissive: VISUAL_COLORS.accent,
      emissiveIntensity: 0.38,
      roughness: 0.3,
      metalness: 0.52,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    })
  );
  core.userData.choiceIndex = index;
  semanticHost.add(core);

  const wire = new THREE.Mesh(
    createChoiceGeometry("webInterface"),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.text,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    })
  );
  wire.scale.setScalar(1.06);
  wire.userData.choiceIndex = index;
  semanticHost.add(wire);

  const initialConfig = SYSTEM_PRESENTATIONS.firmware;
  const presentation = createSpherePresentation({
    id: "firmware",
    context: "choice",
    color: VISUAL_COLORS.accent,
    model: semanticHost,
    config: initialConfig,
    radius: initialConfig.choiceRadius,
    compact: window.innerWidth < 700
  });
  presentation.root.name = `choice-${index}-presentation`;
  model.add(presentation.root);

  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.01, 12, 96),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.34,
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
  model.userData.semanticHost = semanticHost;
  model.userData.presentation = presentation;
  model.userData.marker = marker;
  model.userData.axis = axis;
  model.userData.frame = frame;
  model.userData.collider = collider;
  model.userData.lastDetailDispose = null;
  galaxy.answerMeshes.push(core, wire, marker, collider);
  return model;
}

export function getChoiceVisual(value, planetId) {
  return CHOICE_VISUALS[value] || {
    kind: planetId === "firmware"
      ? "webInterface"
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

function getChoicePose(kind) {
  return CHOICE_POSES[kind] || DEFAULT_CHOICE_POSE;
}

function createChoiceGeometry(kind) {
  if (kind === "webInterface") return new THREE.BoxGeometry(0.92, 0.64, 0.1, 8, 6, 2);
  if (kind === "firmwareChip") return new THREE.BoxGeometry(0.82, 0.12, 0.62, 16, 4, 12);
  if (kind === "apiStack") return new THREE.BoxGeometry(0.7, 0.88, 0.5, 8, 10, 6);
  if (kind === "workflowGear") return new THREE.TorusGeometry(0.39, 0.1, 18, 72);
  if (kind === "dataVault") return new THREE.CylinderGeometry(0.4, 0.4, 0.78, 36, 6);
  if (kind === "opsRadar") return new THREE.CylinderGeometry(0.22, 0.34, 0.18, 32, 2);
  if (kind === "hardwarePort") return new THREE.BoxGeometry(0.82, 0.12, 0.58, 8, 2, 6);
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
      opacity: 0.18
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
  const add = function (mesh, bucket) {
    mesh.userData.choiceIndex = choiceIndex;
    frame.add(mesh);
    if (bucket === "accent") frame.userData.accentMaterials.push(mesh.material);
    if (bucket === "soft") frame.userData.softMaterials.push(mesh.material);
    return mesh;
  };

  const base = add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.66, 0.035, 28, 1),
    makeBasic(0x111821, 0.34)
  ), "soft");
  base.position.y = -0.62;
  base.scale.z = 0.74;

  const ring = add(new THREE.Mesh(
    new THREE.TorusGeometry(0.57, 0.008, 8, 88),
    makeBasic(color, 0.34)
  ), "accent");
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.59;

  [-0.34, 0, 0.34].forEach(function (x, index) {
    const tick = add(new THREE.Mesh(
      new THREE.BoxGeometry(index === choiceIndex % 3 ? 0.16 : 0.1, 0.012, 0.025),
      makeBasic(index === choiceIndex % 3 ? color : VISUAL_COLORS.text, index === choiceIndex % 3 ? 0.64 : 0.2)
    ), index === choiceIndex % 3 ? "accent" : "soft");
    tick.position.set(x, -0.565, 0.4);
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
  switch (visual.kind) {
    case "webInterface":
      addBox([1.06, 0.76, 0.055], [0, 0.08, -0.075], accent, 0.42);
      addBox([0.94, 0.64, 0.035], [0, 0.08, 0.075], 0x101821, 0.92);
      addBox([0.9, 0.075, 0.03], [0, 0.35, 0.1], accent, 0.76);
      [-0.38, -0.3, -0.22].forEach(function (x, index) {
        addSphere(0.022, [x, 0.35, 0.13], index === 1 ? VISUAL_COLORS.automation : index === 2 ? VISUAL_COLORS.hardware : accent, 0.94);
      });
      addBox([0.22, 0.42, 0.025], [-0.31, 0.04, 0.105], accent, 0.32);
      addBox([0.48, 0.055, 0.025], [0.17, 0.19, 0.105], pale, 0.68);
      addBox([0.42, 0.04, 0.025], [0.14, 0.06, 0.105], accent, 0.76);
      addBox([0.3, 0.04, 0.025], [0.08, -0.07, 0.105], pale, 0.46);
      addBox([0.24, 0.1, 0.04], [0.26, -0.18, 0.11], accent, 0.86);
      addBox([0.09, 0.24, 0.09], [0, -0.42, 0], pale, 0.56);
      addBox([0.52, 0.06, 0.28], [0, -0.56, 0], accent, 0.62);
      break;
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
      addBox([0.78, 0.96, 0.54], [0, 0.02, -0.04], 0x111821, 0.78);
      [-0.32, -0.1, 0.12, 0.34].forEach(function (offset, layerIndex) {
        addBox([0.66, 0.16, 0.055], [0, offset, 0.27], layerIndex === 1 ? accent : 0x30414f, layerIndex === 1 ? 0.88 : 0.72);
        addSphere(0.024, [-0.25, offset + 0.025, 0.315], accent, 0.94);
        addSphere(0.022, [-0.17, offset + 0.025, 0.315], VISUAL_COLORS.hardware, 0.8);
        addBox([0.24, 0.02, 0.025], [0.14, offset + 0.025, 0.315], pale, 0.5);
      });
      addBox([0.045, 0.94, 0.05], [-0.36, 0.02, 0.29], accent, 0.58);
      addBox([0.045, 0.94, 0.05], [0.36, 0.02, 0.29], accent, 0.58);
      addBox([0.86, 0.06, 0.62], [0, 0.54, -0.02], accent, 0.52);
      break;
    case "workflowGear":
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2;
        addBox([0.13, 0.19, 0.16], [Math.cos(angle) * 0.48, Math.sin(angle) * 0.48, 0], accent, 0.76, [0, 0, angle]);
      }
      addCylinder(0.11, 0.11, 0.18, [0, 0, 0], pale, 0.9, [Math.PI / 2, 0, 0], 24);
      addRing(0.24, 0.065, [0.34, -0.3, 0.08], pale, 0.72, [0, 0, 0]);
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        addBox([0.09, 0.14, 0.12], [0.34 + Math.cos(angle) * 0.31, -0.3 + Math.sin(angle) * 0.31, 0.08], pale, 0.58, [0, 0, angle]);
      }
      [-0.36, 0, 0.36].forEach(function (offset, i) {
        addBox([0.18, 0.08, 0.14], [offset, -0.52, 0.02], i === 1 ? accent : pale, i === 1 ? 0.82 : 0.52);
      });
      addLine([new THREE.Vector3(-0.45, -0.52, 0.02), new THREE.Vector3(0, -0.52, 0.02), new THREE.Vector3(0.45, -0.52, 0.02)], accent, 0.74);
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
      addCylinder(0.3, 0.4, 0.14, [0, -0.48, 0], 0x171c25, 0.88);
      addBox([0.08, 0.58, 0.08], [0, -0.15, 0], accent, 0.72);
      addRing(0.46, 0.018, [0, 0.3, 0], accent, 0.88, [-0.58, 0, 0]);
      addRing(0.25, 0.01, [0, 0.3, 0.01], pale, 0.5, [-0.58, 0, 0]);
      {
        const radarSweep = addLine([new THREE.Vector3(0, 0.3, 0.04), new THREE.Vector3(0.39, 0.38, 0.12)], accent, 0.94);
        radarSweep.userData.radarSweep = true;
      }
      addSphere(0.052, [0.4, 0.39, 0.13], pale, 0.95);
      addSphere(0.045, [-0.24, -0.38, 0.18], VISUAL_COLORS.warning, 0.86);
      break;
    case "hardwarePort":
      addBox([0.9, 0.07, 0.62], [0, 0.02, 0], 0x183329, 0.86);
      addBox([0.38, 0.17, 0.3], [0, 0.14, 0], accent, 0.92);
      [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].forEach(function (offset, index) {
        addBox([0.035, 0.045, 0.17], [offset, 0.07, 0.4], pale, 0.68);
        addBox([0.035, 0.045, 0.17], [offset, 0.07, -0.4], pale, 0.68);
        if (index % 2 === 0) addBox([0.022, 0.018, 0.25], [offset, 0.075, index === 0 ? -0.14 : 0.16], accent, 0.66);
      });
      addBox([0.2, 0.18, 0.22], [-0.33, 0.13, -0.18], pale, 0.66);
      addBox([0.18, 0.14, 0.18], [0.34, 0.11, -0.2], accent, 0.72);
      addSphere(0.055, [0.34, 0.2, 0.2], VISUAL_COLORS.warning, 0.94);
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
  const solid = opacity >= 0.82;
  const solidOpacity = solid ? 1 : Math.max(0.18, opacity);
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.28,
    metalness: 0.42,
    transparent: !solid,
    opacity: solidOpacity,
    depthWrite: solid
  });
}

function disposeObject3D(object) {
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const stats = { geometries: 0, materials: 0 };
  const disposeGeometry = function (geometry) {
    if (!geometry || geometry.userData.sharedResource || disposedGeometries.has(geometry)) return;
    disposedGeometries.add(geometry);
    stats.geometries += 1;
    geometry.dispose();
  };
  const disposeMaterial = function (material) {
    if (!material || material.userData.sharedResource || disposedMaterials.has(material)) return;
    disposedMaterials.add(material);
    stats.materials += 1;
    material.dispose();
  };
  object.traverse(function (child) {
    disposeGeometry(child.geometry);
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(child.material);
      }
    }
  });
  return stats;
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
      data.semanticHost.remove(data.detailGroup);
      data.lastDetailDispose = disposeObject3D(data.detailGroup);
    }
    data.detailGroup = createChoiceDetailGroup(visual, planet.color, model.userData.choiceIndex);
    data.detailGroup.scale.setScalar(getChoicePose(visual.kind).detailScale);
    data.semanticHost.add(data.detailGroup);

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
    const presentationConfig = SYSTEM_PRESENTATIONS[planetId];
    retargetSpherePresentation(data.presentation, {
      id: planetId,
      color,
      config: presentationConfig,
      radius: presentationConfig.choiceRadius
    });
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
  wrapChoiceText(choice.label, 18).forEach(function (line, lineIndex, lines) {
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
  sprite.scale.set(1.04, 0.54, 1);
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
  applyHeroGalaxyComposition();
}

function applyHeroGalaxyComposition() {
  if (!galaxy.root) return;
  const compact = window.innerWidth < 760;
  const trueMobile = window.innerWidth < QUALITY_CONFIG.trueMobileWidth;
  galaxy.root.position.set(
    compact ? 0.15 : 2.55,
    compact ? -0.25 : -0.1,
    compact ? -0.2 : 0
  );
  galaxy.root.scale.setScalar(trueMobile ? 1.28 : compact ? 1.12 : 1.18);
  if (galaxy.scene && galaxy.scene.fog) {
    galaxy.scene.fog.density = compact ? 0.034 : 0.024;
  }
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
  const clockDelta = Math.min(galaxy.clock.getDelta(), 0.05);
  if (!galaxy.renderer || !galaxy.scene || !galaxy.camera || !appState.webglReady) return;
  const fixedTime = Number.isFinite(SCENE_DEBUG.fixedElapsed);
  const delta = fixedTime ? 0 : clockDelta;
  const elapsed = fixedTime ? SCENE_DEBUG.fixedElapsed : galaxy.clock.elapsedTime;
  const motionDelta = appState.reducedMotion ? 0 : delta;
  const motionElapsed = appState.reducedMotion ? 0 : elapsed;
  const archetype = ARCHETYPES[appState.archetype];
  const visual = appState.galaxyState || refreshGalaxyState();

  galaxy.root.visible = !appState.threeDMode;
  if (galaxy.heroShowcase) galaxy.heroShowcase.visible = !appState.threeDMode;

  if (appState.reducedMotion) galaxy.root.rotation.y = 0;
  else galaxy.root.rotation.y += motionDelta * (0.045 + visual.pressure * 0.035);

  updatePlanets(elapsed, motionDelta, visual);
  updateBridges(motionElapsed, visual);
  updateParticles(motionDelta, visual);
  updateVectorField(motionElapsed, visual);
  updateAnomalies(motionElapsed, motionDelta, visual);
  updateEnergyEffects(motionElapsed, motionDelta, visual);
  updateHeroShowcaseEffect(motionElapsed, motionDelta, visual);
  updateInteractionLayer(motionElapsed, motionDelta, visual);
  updateRescueRig(motionElapsed, motionDelta, visual);
  updateAnswerDeck(motionElapsed, motionDelta, visual);

  if (appState.reducedMotion) galaxy.star.rotation.set(0, 0, 0);
  else {
    galaxy.star.rotation.y += motionDelta * 0.22;
    galaxy.star.rotation.x += motionDelta * 0.1;
  }
  galaxy.star.material.emissiveIntensity = 1.15 + Math.sin(motionElapsed * 2.4) * 0.18;

  const targetPlanet = galaxy.planets[archetype.focus];
  const target = targetPlanet ? targetPlanet.position : galaxy.scratch.lookAt;
  const revealing = appState.revealUntil > elapsed;
  const revealBoost = revealing ? 1 : 0;
  const compact = window.innerWidth < 760;
  const trueMobile = window.innerWidth < QUALITY_CONFIG.trueMobileWidth;
  const desiredX = appState.threeDMode
    ? appState.pointer.x * 0.18
    : target.x * (0.08 + revealBoost * 0.12) + appState.pointer.x * 0.55 + (compact ? 0 : 0.55);
  const desiredY = appState.threeDMode
    ? compact ? 6.15 : 5.75
    : (trueMobile ? 6.4 : compact ? 6.8 : 7.0) + Math.abs(target.y) * 0.05 + appState.pointer.y * 0.22 - revealBoost * 0.85;
  const desiredZ = appState.threeDMode
    ? compact ? 12.2 : 11.55
    : (trueMobile ? 11.2 : compact ? 11.8 : 11.55) + (visual.opsShadow * 0.9) - revealBoost * 2.2;
  if (appState.reducedMotion) {
    galaxy.camera.position.set(desiredX, desiredY, desiredZ);
  } else {
    galaxy.camera.position.x += (desiredX - galaxy.camera.position.x) * 0.035;
    galaxy.camera.position.y += (desiredY - galaxy.camera.position.y) * 0.025;
    galaxy.camera.position.z += (desiredZ - galaxy.camera.position.z) * 0.025;
  }
  if (appState.threeDMode) {
    galaxy.camera.lookAt(0, 1.1, 2.35);
  } else {
    galaxy.camera.lookAt(0, 0, 0);
  }

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

function updatePlanets(elapsed, delta, visual) {
  PLANET_IDS.forEach(function (id) {
    const config = PLANETS[id];
    const planet = galaxy.planets[id];
    let radius = config.radius * (1 + visual.pressure * 0.045);
    let inclination = config.inclination;

    if (id === "ops") radius += visual.opsShadow * 1.2;
    if (id === "automation") radius += visual.automationDebris * 0.35;
    if (id === "firmware" && appState.archetype === "handoff") inclination += 0.42;
    if (id === "backend" && appState.archetype === "handoff") inclination -= 0.42;
    if (visual.pressure > 0.6 && id === "data") inclination -= 0.18;
    if (visual.pressure > 0.4 && id === "automation") inclination += 0.2;

    const orbitElapsed = appState.reducedMotion ? 0 : elapsed;
    const angle = config.angle + orbitElapsed * config.speed * (1 + visual.pressure * 0.36);
    const y = Math.sin(angle) * radius * Math.sin(inclination) * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * Math.cos(inclination);
    planet.position.set(x, y, z);

    const selected = appState.selectedPlanet === id || ARCHETYPES[appState.archetype].focus === id;
    const hovered = appState.hoveredPlanet === id;
    const active = selected || hovered;
    const pulse = planet.userData.pulseUntil && planet.userData.pulseUntil > elapsed
      ? Math.sin((planet.userData.pulseUntil - elapsed) * 10) * 0.12
      : 0;
    const pressureScale = visual.pressure * (id === "backend" || id === "automation" ? 0.18 : 0.08);
    const scale = (active ? 1.42 : 1 + visual.benchGlow * (id === "firmware" ? 0.38 : 0)) + pressureScale + Math.max(pulse, 0);
    galaxy.scratch.scale.set(scale, scale, scale);
    planet.scale.lerp(galaxy.scratch.scale, 0.08);
    updateSpherePresentation(planet.userData.presentation, {
      delta,
      elapsed,
      selected,
      hovered,
      reducedMotion: appState.reducedMotion,
      debugPhase: SCENE_DEBUG.fixedPhase
    });
    planet.userData.visualMaterials.forEach(function (material) {
      const baseOpacity = material.userData.planetBaseOpacity === undefined ? 1 : material.userData.planetBaseOpacity;
      const shadow = id === "ops" ? 1 - visual.opsShadow * 0.22 : 1;
      const targetOpacity = baseOpacity * (active ? 1 : 0.68) * shadow;
      material.opacity += (targetOpacity - material.opacity) * 0.1;
      if (material.emissive) {
        material.emissiveIntensity += ((active ? 0.58 : 0.14) - material.emissiveIntensity) * 0.08;
      }
    });
    planet.userData.marker.material.opacity += ((active ? 0.68 : 0.2) - planet.userData.marker.material.opacity) * 0.1;
    if (planet.userData.label) {
      const labelOpacity = active ? 1 : 0.46;
      planet.userData.label.material.opacity += (labelOpacity - planet.userData.label.material.opacity) * 0.1;
    }

    const orbit = galaxy.orbits[id];
    orbit.rotation.x = inclination;
    orbit.material.opacity = active ? 0.3 : 0.08;
    planet.userData.ticks.rotation.x = inclination;
    planet.userData.ticks.material.opacity = active ? 0.24 : 0.06;
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

function updateAnomalies(elapsed, delta, visual) {
  const firmware = galaxy.planets.firmware.position;
  const backend = galaxy.planets.backend.position;
  galaxy.blackHole.position.set(
    (firmware.x + backend.x) * 0.5,
    (firmware.y + backend.y) * 0.5,
    (firmware.z + backend.z) * 0.5
  );
  galaxy.blackHole.scale.setScalar(1 + visual.handoffWarp * 0.6);
  galaxy.blackHole.rotation.z += delta * 60 * (0.025 + visual.handoffWarp * 0.04);
  galaxy.blackHole.material.opacity += ((visual.handoffWarp > 0.85 ? 0.75 : 0.08) - galaxy.blackHole.material.opacity) * 0.08;
  galaxy.accretionRings.forEach(function (ring, index) {
    ring.position.copy(galaxy.blackHole.position);
    ring.scale.setScalar(1 + visual.handoffWarp * (0.3 + index * 0.18));
    ring.rotation.z += delta * 60 * (0.018 + index * 0.012 + visual.handoffWarp * 0.02);
    ring.material.opacity += ((visual.handoffWarp > 0.85 ? 0.42 - index * 0.08 : 0.03) - ring.material.opacity) * 0.08;
  });

  galaxy.shell.material.opacity += ((visual.ghostShell ? 0.34 : 0) - galaxy.shell.material.opacity) * 0.08;
  galaxy.shell.rotation.y += delta * 0.6;
  if (galaxy.starRings) {
    galaxy.starRings.children.forEach(function (ring, index) {
      ring.rotation.z += delta * 60 * (0.006 + index * 0.003);
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
  } else if (appState.revealUntil > galaxy.clock.elapsedTime) {
    const revealPulse = 0.5 + Math.sin(elapsed * 7) * 0.5;
    galaxy.star.scale.setScalar(1.05 + revealPulse * 0.08);
  } else {
    galaxy.scratch.scale.set(1, 1, 1);
    galaxy.star.scale.lerp(galaxy.scratch.scale, 0.08);
  }
}

function updateEnergyEffects(elapsed, delta, visual) {
  const intensity = 0.62 + visual.completeness * 0.52 + visual.pressure * 0.36;
  if (galaxy.starHalo) {
    const haloPulse = 0.5 + Math.sin(elapsed * 1.9) * 0.5;
    const targetOpacity = 0.065 + haloPulse * 0.03 + visual.completeness * 0.055;
    galaxy.starHalo.material.opacity += (Math.min(0.18, targetOpacity) - galaxy.starHalo.material.opacity) * 0.06;
    galaxy.starHalo.scale.setScalar(1 + haloPulse * 0.045 + visual.pressure * 0.06);
  }

  if (galaxy.energyArcs) {
    galaxy.energyArcs.children.forEach(function (arc, index) {
      const speed = arc.userData.speed * delta * 60;
      arc.rotation.z += speed * (1 + visual.pressure * 0.8);
      arc.rotation.y += speed * 0.34;
      const pulse = 0.5 + Math.sin(elapsed * (1.7 + index * 0.3) + arc.userData.phase) * 0.5;
      const targetOpacity = arc.userData.baseOpacity * (0.72 + intensity * 0.48 + pulse * 0.34);
      arc.material.opacity += (Math.min(0.48, targetOpacity) - arc.material.opacity) * 0.07;
    });
  }

  if (galaxy.shockwaves && galaxy.shockwaves.length) {
    galaxy.shockwaves.forEach(function (ring, index) {
      const cycle = (elapsed * (0.14 + index * 0.018) + ring.userData.phase + visual.completeness * 0.12) % 1;
      const waveScale = 0.82 + cycle * (1.55 + visual.pressure * 0.45);
      ring.scale.setScalar(waveScale);
      ring.rotation.z += delta * 60 * (0.006 + index * 0.002);
      const fade = Math.sin(cycle * Math.PI);
      const targetOpacity = ring.userData.baseOpacity * fade * (0.62 + visual.completeness * 0.65);
      ring.material.opacity += (Math.min(0.42, targetOpacity) - ring.material.opacity) * 0.1;
    });
  }
}

function updateHeroShowcaseEffect(elapsed, delta, visual) {
  if (!galaxy.heroShowcase) return;
  const compact = window.innerWidth < 760;
  const heroVisible = appState.threeDMode ? 0.08 : 1;
  galaxy.heroShowcase.position.x += ((compact ? 0.2 : 3.35) - galaxy.heroShowcase.position.x) * 0.06;
  galaxy.heroShowcase.position.y += ((compact ? -0.72 : -0.28) - galaxy.heroShowcase.position.y) * 0.06;
  galaxy.heroShowcase.position.z += ((compact ? -0.8 : -0.65) - galaxy.heroShowcase.position.z) * 0.06;
  galaxy.heroShowcase.scale.setScalar(compact ? 0.68 : 1);
  galaxy.heroShowcase.rotation.y += delta * 60 * (0.006 + visual.pressure * 0.004);
  galaxy.heroShowcase.rotation.z = 0.08 + Math.sin(elapsed * 0.48) * 0.05;

  galaxy.heroShowcaseParts.forEach(function (part, index) {
    const role = part.userData.heroRole;
    const pulse = 0.5 + Math.sin(elapsed * (1.8 + index * 0.18) + index) * 0.5;
    if (role === "core") {
      part.rotation.x += delta * 0.36;
      part.rotation.y += delta * 0.6;
      part.material.opacity += ((0.82 + pulse * 0.18) * heroVisible - part.material.opacity) * 0.08;
      part.scale.setScalar(1 + pulse * 0.08 + visual.completeness * 0.08);
    } else if (role === "glow") {
      part.material.opacity += ((0.12 + pulse * 0.06 + visual.completeness * 0.08) * heroVisible - part.material.opacity) * 0.08;
      part.scale.setScalar(1 + pulse * 0.16 + visual.pressure * 0.08);
    } else if (role === "ring") {
      part.rotation.z += part.userData.speed * delta * 60;
      const targetOpacity = part.userData.baseOpacity * (0.74 + pulse * 0.32 + visual.completeness * 0.28) * heroVisible;
      part.material.opacity += (Math.min(0.86, targetOpacity) - part.material.opacity) * 0.08;
    } else if (role === "beams") {
      part.rotation.y += delta * 0.18;
      part.material.opacity += ((part.userData.baseOpacity + pulse * 0.08 + visual.completeness * 0.12) * heroVisible - part.material.opacity) * 0.08;
    }
  });
}

function updateInteractionLayer(elapsed, delta, visual) {
  if (galaxy.ribbons) {
    galaxy.ribbons.children.forEach(function (ribbon, index) {
      ribbon.rotation.z += ribbon.userData.speed * delta * 60 * (1 + visual.pressure * 0.45);
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
  const pulseLeft = Math.max(0, appState.focusPulseUntil - galaxy.clock.elapsedTime);
  const pulse = !appState.reducedMotion && pulseLeft ? Math.sin(pulseLeft * 9) * 0.18 + 0.22 : 0;
  const activeBoost = appState.threeDMode ? 0.2 : 0;
  galaxy.focusHaloRings.forEach(function (item, index) {
    const ringPulse = 1 + pulse + Math.sin(elapsed * (1.8 + index * 0.4)) * 0.035;
    item.scale.setScalar(ringPulse + index * 0.04);
    if (appState.reducedMotion) item.rotation.z = index * 0.18;
    else item.rotation.z += delta * 60 * (0.01 + index * 0.006 + activeBoost * 0.01);
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
  const motionFactor = appState.reducedMotion ? 0 : 1;
  const activeFocus = appState.hoveredPlanet || appState.selectedPlanet || ARCHETYPES[appState.archetype].focus;
  const completeBoost = visual.completeness;
  const threeDModeDimming = appState.threeDMode ? 0.26 : 1;
  const targetScale = compact ? 1.05 : 1;
  galaxy.scratch.scale.set(targetScale, targetScale, targetScale);
  if (appState.reducedMotion) galaxy.rescueRig.scale.copy(galaxy.scratch.scale);
  else galaxy.rescueRig.scale.lerp(galaxy.scratch.scale, 0.06);
  galaxy.rescueRig.rotation.y += delta * (0.06 + visual.pressure * 0.04) * motionFactor;
  galaxy.rescueRig.position.y = 0.28 + Math.sin(elapsed * 0.85) * 0.05 * motionFactor;

  if (galaxy.rescueRigCore) {
    galaxy.rescueRigCore.rotation.y -= delta * 0.22 * motionFactor;
    galaxy.rescueRigCore.rotation.x = Math.sin(elapsed * 0.5) * 0.08 * motionFactor;
    const corePulse = 1 + Math.sin(elapsed * 2.8) * 0.025 * motionFactor + completeBoost * 0.05;
    galaxy.rescueRigCore.scale.setScalar(corePulse);
    const core = galaxy.rescueRigCore.userData.core;
    if (core && core.material) {
      core.material.emissiveIntensity += ((1.2 + completeBoost * 1.4 + visual.hardwarePulse * 0.7) - core.material.emissiveIntensity) * 0.08;
      core.material.opacity += ((0.76 + completeBoost * 0.16) * threeDModeDimming - core.material.opacity) * 0.08;
    }
    galaxy.rescueRigCore.children.forEach(function (child) {
      if (child.userData && child.userData.speed) child.rotation.z += child.userData.speed * delta * 60 * (1 + completeBoost);
      if (child.material && child.material.userData.baseOpacity !== undefined) {
        const targetOpacity = child.material.userData.baseOpacity * (0.72 + completeBoost * 0.8) * threeDModeDimming;
        child.material.opacity += (Math.min(0.9, targetOpacity) - child.material.opacity) * 0.08;
      }
    });
  }

  Object.entries(galaxy.rescueRigObjects).forEach(function ([id, object], index) {
    const selected = id === activeFocus;
    const hovered = id === appState.hoveredPlanet;
    const presentation = object.userData.presentation;
    const poseObject = presentation ? presentation.posePivot : object;
    const semanticModel = presentation ? presentation.model : object;
    const planet = PLANETS[id];
    const pulse = !appState.reducedMotion && planet && galaxy.planets[id] && galaxy.planets[id].userData.pulseUntil > galaxy.clock.elapsedTime
      ? Math.sin((galaxy.planets[id].userData.pulseUntil - galaxy.clock.elapsedTime) * 11) * 0.16 + 0.22
      : 0;
    const hardwareBoost = id === "hardware" ? visual.hardwarePulse * 0.22 : 0;
    const targetObjectScale = (selected ? 1.12 : 0.94) + pulse * 0.72 + completeBoost * 0.05 + hardwareBoost;
    galaxy.scratch.modelScale.set(targetObjectScale, targetObjectScale, targetObjectScale);
    if (appState.reducedMotion) object.scale.copy(galaxy.scratch.modelScale);
    else object.scale.lerp(galaxy.scratch.modelScale, 0.09);
    object.position.y = object.userData.basePosition.y
      + Math.sin(elapsed * (1.4 + index * 0.14) + index) * 0.055 * motionFactor
      + (selected ? 0.08 : 0);
    poseObject.rotation.y = object.userData.baseRotation.y
      + Math.sin(elapsed * 0.72 + index) * 0.065 * motionFactor
      + (selected ? appState.pointer.x * 0.08 * motionFactor : 0);
    poseObject.rotation.x = object.userData.baseRotation.x
      + Math.sin(elapsed * 0.5 + index * 0.7) * 0.025 * motionFactor;
    poseObject.rotation.z = object.userData.baseRotation.z;
    if (presentation) {
      updateSpherePresentation(presentation, {
        delta,
        elapsed,
        selected,
        hovered,
        reducedMotion: appState.reducedMotion,
        debugPhase: SCENE_DEBUG.fixedPhase
      });
    }
    const visitedMaterials = new Set();
    semanticModel.traverse(function (child) {
      if (child.userData && child.userData.spin) child.rotation.z += delta * (1.25 + completeBoost * 1.2) * child.userData.spin * motionFactor;
      if (child.userData && child.userData.sweep && motionFactor) child.rotation.z = elapsed * (1.8 + visual.pressure) % (Math.PI * 2);
      if (child.userData && child.userData.sweepRing) child.rotation.z += delta * 0.28 * motionFactor;
      if (child.userData && child.userData.fault) {
        const faultPulse = 0.55 + Math.sin(elapsed * (visual.hardwarePulse > 0.4 ? 9.5 : 5.2)) * 0.45 * motionFactor;
        child.scale.setScalar(1 + faultPulse * (0.45 + visual.hardwarePulse * 0.45));
        if (child.material) child.material.opacity = 0.32 + faultPulse * 0.62;
      }
      if (!child.material || child.material.userData.baseOpacity === undefined) return;
      if (visitedMaterials.has(child.material)) return;
      visitedMaterials.add(child.material);
      const baseOpacity = child.material.userData.baseOpacity;
      const targetOpacity = baseOpacity * (selected ? 1.18 : 0.68 + completeBoost * 0.42) * threeDModeDimming;
      if (child.material.transparent) {
        child.material.opacity += (Math.min(0.96, targetOpacity) - child.material.opacity) * 0.08;
      }
      if (child.material.color && child.material.userData.baseColor && child.material.userData.dimColor) {
        child.material.color.lerp(
          selected ? child.material.userData.baseColor : child.material.userData.dimColor,
          0.08
        );
      }
      if (child.material.emissive) {
        child.material.emissiveIntensity += ((selected ? 0.42 : 0.12) + pulse * 0.8 + hardwareBoost) * 0.08 - child.material.emissiveIntensity * 0.04;
      }
    });
  });

  updateRescueRigCables(elapsed, visual, activeFocus, threeDModeDimming, motionFactor);
  updateRescueRigSignals(elapsed, delta, visual, threeDModeDimming, motionFactor);
}

function updateRescueRigCables(elapsed, visual, activeFocus, opacityScale, motionFactor) {
  galaxy.rescueRigCables.forEach(function (cable, index) {
    const [a, b] = cable.userData.pair;
    const startObject = galaxy.rescueRigObjects[a];
    const endObject = galaxy.rescueRigObjects[b];
    if (!startObject || !endObject) return;
    const start = getRescueRigCableAnchor(startObject, endObject.position, galaxy.scratch.beamStart);
    const end = getRescueRigCableAnchor(endObject, startObject.position, galaxy.scratch.beamEnd);
    const active = a === activeFocus || b === activeFocus;
    const height = 0.32 + Math.sin(elapsed * 1.2 + index) * 0.08 * motionFactor + visual.completeness * 0.26;
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

function getRescueRigCableAnchor(object, toward, target) {
  const radius = object.userData.sphereRadius || 0;
  if (radius <= 0) return target.copy(object.position);
  target.copy(toward).sub(object.position);
  if (target.lengthSq() < 0.000001) return target.copy(object.position);
  return target
    .normalize()
    .multiplyScalar(radius * object.scale.x * 0.94)
    .add(object.position);
}

function updateRescueRigSignals(elapsed, delta, visual, opacityScale, motionFactor) {
  galaxy.rescueRigSignals.forEach(function (signal, index) {
    const cable = galaxy.rescueRigCables[signal.userData.cableIndex];
    if (!cable) return;
    const positionAttr = cable.geometry.getAttribute("position");
    const max = positionAttr.count - 1;
    signal.userData.progress = (
      signal.userData.progress
      + delta * signal.userData.speed * (1 + visual.completeness * 1.8 + visual.hardwarePulse * 0.8) * motionFactor
    ) % 1;
    const exact = signal.userData.progress * max;
    const low = Math.floor(exact);
    const high = Math.min(max, low + 1);
    const t = exact - low;
    const x = positionAttr.getX(low) * (1 - t) + positionAttr.getX(high) * t;
    const y = positionAttr.getY(low) * (1 - t) + positionAttr.getY(high) * t;
    const z = positionAttr.getZ(low) * (1 - t) + positionAttr.getZ(high) * t;
    signal.position.set(x, y, z);
    const pulse = 0.7 + Math.sin(elapsed * 8 + index) * 0.3 * motionFactor;
    signal.scale.setScalar(0.72 + pulse * 0.55 + visual.completeness * 0.45);
    signal.material.opacity += ((0.28 + visual.completeness * 0.58 + visual.hardwarePulse * 0.18) * opacityScale - signal.material.opacity) * 0.08;
  });
}

function updateAnswerDeck(elapsed, delta, visual) {
  if (!galaxy.answerDeck) return;
  syncAnswerDeck();
  const active = appState.threeDMode && appState.webglReady;
  galaxy.answerDeck.visible = active;

  if (!active) {
    updateBackPortal(elapsed, delta, visual, false);
    galaxy.choiceBeams.forEach(function (beam) {
      beam.material.opacity += (0 - beam.material.opacity) * 0.16;
    });
    return;
  }

  const compact = window.innerWidth < 700;
  const spread = compact ? 1.35 : 2.75;
  const deckY = compact ? 1.72 : 1.58;
  const deckZ = compact ? 5.0 : 4.65;
  const hasSelectedChoice = appState.selectedChoice !== null;
  const motionFactor = appState.reducedMotion ? 0 : 1;
  const targetDeckX = appState.pointer.x * 0.18 * motionFactor;
  if (appState.reducedMotion) {
    galaxy.answerDeck.position.set(targetDeckX, deckY, deckZ);
  } else {
    galaxy.answerDeck.position.x += (targetDeckX - galaxy.answerDeck.position.x) * 0.08;
    galaxy.answerDeck.position.y += (deckY - galaxy.answerDeck.position.y) * 0.08;
    galaxy.answerDeck.position.z += (deckZ - galaxy.answerDeck.position.z) * 0.08;
  }
  updateBackPortal(elapsed, delta, visual, true);

  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  galaxy.answerModels.forEach(function (model, index) {
    const choice = question.choices[index];
    if (!choice) return;
    const data = model.userData;
    const hovered = appState.hoveredChoice === index;
    const selected = appState.selectedChoice === index;
    const pose = getChoicePose(data.visualKind);
    const pulse = !appState.reducedMotion && appState.choicePulseUntil > galaxy.clock.elapsedTime
      ? Math.sin(elapsed * 18) * 0.08 + 0.08
      : 0;
    const mobileLayout = [
      [-spread, 0.38],
      [0, 0.38],
      [spread, 0.38],
      [-spread * 0.5, -1.32],
      [spread * 0.5, -1.32]
    ];
    let x = compact ? mobileLayout[index][0] : (index - 2) * spread;
    let y = compact ? mobileLayout[index][1] : (index % 2 === 0 ? 0.2 : -0.22);
    let z = hovered ? 0.78 : 0;
    let targetScale = compact ? hovered ? 0.76 : 0.68 : hovered ? 1.04 : 0.9;

    if (hasSelectedChoice) {
      if (selected) {
        x = appState.pointer.x * 0.1;
        y = compact ? 0.65 : 0.88;
        z = compact ? 1.42 : 1.78;
        targetScale = (compact ? 0.82 : 1.16) + pulse;
      } else {
        const nonSelected = [0, 1, 2, 3, 4].filter(function (choiceIndex) {
          return choiceIndex !== appState.selectedChoice;
        });
        const slot = nonSelected.indexOf(index);
        const desktopSlots = [-4.2, -1.4, 1.4, 4.2];
        const compactSlots = [
          [-1.55, 0],
          [-1.55, -1.45],
          [1.55, -1.45],
          [1.55, 0]
        ];
        x = compact ? compactSlots[slot][0] : desktopSlots[slot];
        y = compact ? compactSlots[slot][1] : -0.94;
        z = -0.92;
        targetScale = compact ? hovered ? 0.38 : 0.3 : hovered ? 0.7 : 0.56;
      }
    }

    targetScale *= pose.scale;
    const dimmed = hasSelectedChoice && !selected && !hovered;
    setChoiceModelRenderPriority(model, selected ? 18 : hovered ? 12 : dimmed ? 4 : 8);
    galaxy.scratch.modelPosition.set(x, y, z);
    galaxy.scratch.modelScale.set(targetScale, targetScale, targetScale);
    if (appState.reducedMotion) {
      model.position.copy(galaxy.scratch.modelPosition);
      model.scale.copy(galaxy.scratch.modelScale);
    } else {
      model.position.lerp(galaxy.scratch.modelPosition, 0.12);
      model.scale.lerp(galaxy.scratch.modelScale, 0.12);
    }
    model.rotation.y = pose.yaw + (
      Math.sin(elapsed * (0.52 + index * 0.025) + index) * pose.yawRange
      + appState.pointer.x * 0.08
    ) * motionFactor;
    model.rotation.x = pose.tiltX + Math.sin(elapsed * 0.48 + index) * 0.022 * motionFactor;
    model.rotation.z = pose.tiltZ;

    data.core.material.emissiveIntensity += ((selected ? 1.65 : hovered ? 0.9 : 0.36) - data.core.material.emissiveIntensity) * 0.1;
    data.core.material.opacity += ((selected ? 0.76 : hovered ? 0.62 : dimmed ? 0.2 : 0.46) - data.core.material.opacity) * 0.1;
    data.wire.material.opacity += ((selected ? 0.5 : hovered ? 0.36 : dimmed ? 0.06 : 0.14) - data.wire.material.opacity) * 0.1;
    data.marker.material.opacity += ((selected ? 0.72 : hovered ? 0.46 : dimmed ? 0.06 : 0.22) - data.marker.material.opacity) * 0.1;
    if (motionFactor) {
      data.marker.rotation.z += delta * (1.08 + visual.completeness * 0.72);
    } else {
      data.marker.rotation.z = index * 0.18;
    }
    data.axis.material.opacity += ((selected ? 0.84 : hovered ? 0.72 : dimmed ? 0.12 : 0.28) - data.axis.material.opacity) * 0.1;
    updateChoiceFrameState(data.frame, selected, hovered, dimmed);
    if (data.label) {
      data.label.material.opacity += ((selected ? 1 : hovered ? 0.92 : dimmed ? 0.36 : 0.78) - data.label.material.opacity) * 0.1;
      const labelX = compact ? 0.96 : 1.18;
      const labelY = compact ? 0.46 : 0.58;
      const labelBoost = selected ? 0.22 : hovered ? 0.08 : 0;
      galaxy.scratch.labelScale.set(labelX + labelBoost, labelY + labelBoost * 0.45, 1);
      if (appState.reducedMotion) data.label.scale.copy(galaxy.scratch.labelScale);
      else data.label.scale.lerp(galaxy.scratch.labelScale, 0.12);
    }
    updateSpherePresentation(data.presentation, {
      delta,
      elapsed,
      selected,
      hovered,
      reducedMotion: appState.reducedMotion,
      debugPhase: SCENE_DEBUG.fixedPhase
    });
    updateChoiceModelMotion(data, elapsed, delta, selected, hovered);

    updateChoiceBeam(index, choice, selected, hovered, visual);
  });
}

function updateBackPortal(elapsed, delta, visual, deckActive) {
  if (!galaxy.backPortal) return;
  const enabled = deckActive && canGoBackIn3D();
  const portal = galaxy.backPortal;
  portal.visible = enabled;
  if (!enabled) {
    appState.hoveredBack = false;
    return;
  }

  const compact = window.innerWidth < 700;
  const pulseLeft = Math.max(0, appState.backPortalPulseUntil - galaxy.clock.elapsedTime);
  const pulse = !appState.reducedMotion && pulseLeft ? Math.sin(pulseLeft * 11) * 0.14 + 0.18 : 0;
  const hoverBoost = appState.hoveredBack ? 0.14 : 0;
  const targetScale = (compact ? 0.34 : 0.36) + hoverBoost * (compact ? 0.7 : 0.45) + pulse * 0.28;
  const targetX = compact ? 0 : -6.2;
  const targetY = compact ? -2.35 : -1.15;
  const targetZ = compact ? -0.2 : -0.15;

  galaxy.scratch.modelPosition.set(targetX, targetY + Math.sin(elapsed * 2.8) * 0.035, targetZ);
  galaxy.scratch.modelScale.set(targetScale, targetScale, targetScale);
  if (appState.reducedMotion) {
    portal.position.copy(galaxy.scratch.modelPosition);
    portal.scale.copy(galaxy.scratch.modelScale);
  } else {
    portal.position.lerp(galaxy.scratch.modelPosition, 0.14);
    portal.scale.lerp(galaxy.scratch.modelScale, 0.14);
  }
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
    if (child.userData && child.userData.speed && !child.userData.portalParticle) {
      child.rotation.z += child.userData.speed * delta * 60 * (1 + hoverBoost * 2 + visual.pressure * 0.2);
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

function updateChoiceModelMotion(data, elapsed, delta, selected, hovered) {
  const group = data.detailGroup;
  if (!group) return;
  const kind = data.visualKind || group.userData.kind;
  const intensity = selected ? 1 : hovered ? 0.72 : 0.28;
  const choiceIndex = group.userData.choiceIndex;

  if (appState.reducedMotion) {
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0.18 + choiceIndex * 0.11, 0);
  }

  group.traverse(function (child) {
    if (child.userData && child.userData.radarSweep) {
      child.rotation.z = appState.reducedMotion
        ? 0.72
        : elapsed * (0.7 + intensity * 1.4);
    }
  });

  if (appState.reducedMotion) return;

  if (CHOICE_MOTION_GROUPS.spin.has(kind)) {
    group.rotation.z += delta * (0.72 + intensity * 2.7);
  } else if (CHOICE_MOTION_GROUPS.sweep.has(kind)) {
    group.rotation.y = Math.sin(elapsed * 1.2) * 0.045 * intensity;
    group.rotation.z = 0;
  } else if (CHOICE_MOTION_GROUPS.orbit.has(kind)) {
    group.rotation.y += delta * (0.36 + intensity * 1.08);
  } else if (CHOICE_MOTION_GROUPS.incident.has(kind)) {
    group.rotation.y += delta * (1.08 + intensity * 1.56);
    group.position.y = Math.sin(elapsed * 5.2) * 0.05 * intensity;
  } else if (CHOICE_MOTION_GROUPS.stack.has(kind)) {
    group.position.y = Math.sin(elapsed * 3.6 + choiceIndex) * 0.035 * intensity;
    group.rotation.x = Math.sin(elapsed * 1.3) * 0.05 * intensity;
  } else if (CHOICE_MOTION_GROUPS.bridge.has(kind)) {
    group.rotation.z = Math.sin(elapsed * 2.2 + choiceIndex) * 0.08 * intensity;
  } else if (kind === "ownerCrown") {
    group.position.y = 0.04 + Math.sin(elapsed * 3.4) * 0.045 * intensity;
    group.rotation.y += delta * (0.48 + intensity * 0.9);
  } else if (CHOICE_MOTION_GROUPS.cluster.has(kind)) {
    group.rotation.y += delta * (0.42 + intensity * 0.72);
    group.position.y = Math.sin(elapsed * 2.6 + choiceIndex) * 0.025 * intensity;
  } else {
    group.rotation.y += delta * (0.48 + intensity * 0.6);
  }
}

function updateChoiceBeam(index) {
  const beam = galaxy.choiceBeams[index];
  if (!beam) return;
  beam.material.opacity += (0 - beam.material.opacity) * 0.18;
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
