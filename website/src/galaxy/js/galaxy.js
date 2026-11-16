// Three.js scene: setup, geometry builders, frame loop, pointer interaction.
// Reads/mutates the shared `galaxy` and `appState` singletons from state.js.

import * as THREE from "../../../vendor/three/three.module.min.js";
import { GALAXY_SERVICE_BY_ID } from "../../shared/service-catalog.js?v=wow60";

import {
  VISUAL_COLORS,
  QUALITY_CONFIG
} from "./data/config.js?v=wow60";
import {
  PLANETS,
  PLANET_IDS,
  QUESTION_FLOW,
  SCALE_STAGES,
  ARCHETYPES
} from "./data/quiz-data.js?v=wow60&rev=galaxy-seven-quiz1";
import { SYSTEM_PRESENTATIONS } from "./data/scene-presentations.js?v=wow60";
import { appState, galaxy } from "./state.js?v=wow60";
import {
  createSpherePresentation,
  updateSpherePresentation
} from "./scene/sphere-kit.js?v=wow60&rev=galaxy-light1";
import { createConnectionTube, updateConnectionTube } from "./scene/connection-tube.js?v=wow60&rev=galaxy-light1";
import { createCoreObject, updateCoreObject } from "./scene/core-object.js?v=wow60&rev=core-plasma6";
import { createSphereDive, SPHERE_DIVE_DURATION, updateSphereDive } from "./scene/sphere-dive.js?v=wow60";
import { createObjectHologram } from "./scene/object-hologram.js?v=wow60&rev=quiz-flow1";
import { createQuizBurst } from "./scene/quiz-transition.js?v=wow60";
import {
  MAX_SERVICE_ORBIT_SCALE,
  createServiceSpatialGrid,
  getServiceGridMinimumSeparation,
  sampleServiceGridPosition,
  sampleServiceGridTangent,
  updateServiceSpatialGrid
} from "./scene/service-spatial-grid.js?v=wow60";
import { buildSystemModel as buildSemanticSystemModel } from "./scene/system-models/index.js?v=wow60";
import { updatePqcSignal } from "./scene/system-models/pqc.js?v=wow60";
import { focusPlanet } from "./ui.js?v=wow60&rev=galaxy-motion1";

const LIGHT_GALAXY = document.documentElement.dataset.galaxyTheme === "light";
const SCENE_DEBUG = createSceneDebugConfig();
const ORBIT_VIEW_LIMIT = { pitch: 1.22 };
const SERVICE_DEPTH_RADIUS = { base: 0.65, gain: 0.06, min: 0.46, max: 0.79 };
const serviceViewDirection = new THREE.Vector3();
const overviewCanvasSize = new THREE.Vector2();
const resizeCanvasSize = new THREE.Vector2();
const overviewFitNormal = new THREE.Vector3();
let sphereDive = null;
let objectHologram = null;
let hologramTarget = null;
const hologramPosition = new THREE.Vector3();
const hologramViewPosition = new THREE.Vector3();
const hologramCanvasSize = new THREE.Vector2();
const quizCanvasSize = new THREE.Vector2();
const serviceRowOrbs = new Map();
let sceneAnimationFrame = null;
let sceneInViewport = true;
let scenePageActive = true;
let simulationTimer = null;
const ORBIT_LAYOUTS = {
  atom: { tilt: -0.49, compactScale: 0.62, narrowScale: 0.60, desktopScale: 0.40, desktopMin: 0.54, desktopMax: 0.69 },
  planets: { tilt: -0.32, compactScale: 0.67, narrowScale: 0.67, desktopScale: 0.43, desktopMin: 0.59, desktopMax: 0.74 }
};
if (SCENE_DEBUG.forceReducedMotion) {
  appState.reducedMotion = true;
  document.documentElement.classList.add("is-reduced-motion");
}

const FORMATION_DEPTH = 8.25;
const FORMATION_FLIGHT_MS = 1040;
const QUIZ_RING_RADIUS = 2.12;
const formationSlots = new Map();
let formationFlight = null;
let formationOrbit = null;
let formationBurst = null;
let overviewElapsed = 0;
let overviewMotionPaused = false;
let quizCenterService = PLANET_IDS[0];
let quizRingServices = [];
const formationPosition = new THREE.Vector3();
const formationScale = new THREE.Vector3();
const formationRotation = new THREE.Quaternion();
const formationOrigin = new THREE.Vector3();

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
      const targets = {};
      const orbitTargets = {};
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
        Object.entries(galaxy.rescueRigObjects).forEach(function ([id, planet]) {
          const point = planet.getWorldPosition(new THREE.Vector3()).project(galaxy.camera);
          orbitTargets[id] = {
            x: canvasRect.left + (point.x + 1) * 0.5 * canvasRect.width,
            y: canvasRect.top + (1 - point.y) * 0.5 * canvasRect.height,
            depth: point.z
          };
        });
      }
      const coreConnections = Object.fromEntries(galaxy.rescueRigCables.map((tube) => {
        const id = tube.userData.serviceId;
        const planet = galaxy.rescueRigObjects[id];
        const { uStart, uEnd, uEnergyHead, uFlowTime } = tube.material.uniforms;
        const towardCore = id === "pqc";
        const coreEnd = towardCore ? uEnd.value : uStart.value;
        const planetEnd = towardCore ? uStart.value : uEnd.value;
        const { radius, feedthroughs } = planet.userData.presentation;
        const outlet = planet.userData.semanticModel.userData.pqc?.outlet ?? feedthroughs[0]?.outlet;
        const attachmentGap = outlet
          ? outlet.getWorldPosition(new THREE.Vector3()).applyMatrix4(galaxy.scratch.rigWorldInverse).distanceTo(planetEnd)
          : Math.abs(planetEnd.distanceTo(planet.position) - radius * planet.scale.x);
        return [id, {
          coreEnd: coreEnd.toArray(),
          planetEnd: planetEnd.toArray(),
          planetCenter: planet.position.toArray(),
          energyHead: uEnergyHead.value,
          flowTime: uFlowTime.value,
          attachmentGap
        }];
      }));
      const render = galaxy.renderer ? galaxy.renderer.info.render : null;
      const pqcModel = galaxy.rescueRigObjects.pqc?.userData.semanticModel;
      const pqcCable = galaxy.rescueRigCables.find((cable) => cable.userData.serviceId === "pqc");
      let pqcSignal = null;
      if (pqcModel && pqcCable && galaxy.camera && galaxy.renderer) {
        const { outlet, stage } = pqcModel.userData.pqc;
        const outletPosition = galaxy.rescueRig.worldToLocal(outlet.getWorldPosition(new THREE.Vector3()));
        const { uStart, uPacketHead } = pqcCable.material.uniforms;
        const canvas = galaxy.renderer.domElement.getBoundingClientRect();
        const point = pqcModel.getWorldPosition(new THREE.Vector3()).project(galaxy.camera);
        pqcSignal = {
          stage,
          packetHead: uPacketHead.value,
          outletGap: outletPosition.distanceTo(uStart.value),
          x: canvas.left + (point.x + 1) * 0.5 * canvas.width,
          y: canvas.top + (1 - point.y) * 0.5 * canvas.height
        };
      }
      const spatialGrid = galaxy.rescueRigGrid ? {
        capacity: galaxy.rescueRigGrid.capacity,
        occupied: galaxy.rescueRigGrid.assignments.size,
        reserved: galaxy.rescueRigGrid.capacity - galaxy.rescueRigGrid.assignments.size,
        orbitSpeed: galaxy.rescueRigGrid.orbitSpeed,
        minimumSeparation: getServiceGridMinimumSeparation(
          galaxy.rescueRigGrid,
          PLANET_IDS,
          getOverviewElapsed(),
          { scale: galaxy.rescueRigGrid.scale }
        )
      } : null;
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
          planetMeshes: galaxy.planetMeshes.length
        },
        targets,
        orbitTargets,
        orbitView: { ...galaxy.orbitView },
        layout: galaxy.layout,
        dive: sphereDive ? { serviceId: sphereDive.serviceId, progress: sphereDive.progress } : null,
        quizTransition: formationOrbit?.mode === "quiz" ? formationFlightSnapshot() : null,
        serviceRowMode: Boolean(appState.serviceRowMode),
        serviceRowTransition: formationOrbit?.mode === "service-row" ? formationFlightSnapshot() : null,
        coreConnections,
        presentations,
        planetPresentations,
        spatialGrid,
        pqcSignal
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
      SCENE_DEBUG.forceReducedMotion = Boolean(value);
      appState.reducedMotion = SCENE_DEBUG.forceReducedMotion;
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

// ---------- Scene init ----------

export function initGalaxyScene() {
  const canvas = document.getElementById("galaxy-canvas");
  const hero = document.querySelector(".galaxy-hero");
  const loading = document.getElementById("galaxy-loading");

  if (!canvas || SCENE_DEBUG.forceFallback) {
    showGalaxyFallback();
    installSceneDebugApi();
    return;
  }

  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  }) ?? canvas.getContext("webgl2", { alpha: true, antialias: false });
  if (!context) {
    showGalaxyFallback();
    installSceneDebugApi();
    return;
  }

  galaxy.scene = new THREE.Scene();
  galaxy.scene.fog = new THREE.FogExp2(0x080a0f, 0.026);
  galaxy.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  galaxy.camera.position.set(0.8, 7.4, 12.2);
  galaxy.camera.lookAt(0, 0, 0);

  galaxy.renderer = new THREE.WebGLRenderer({ canvas, context });
  galaxy.renderer.setClearColor(0x080a0f, 0);
  galaxy.renderer.outputColorSpace = THREE.SRGBColorSpace;
  galaxy.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  galaxy.renderer.toneMappingExposure = 1.48;
  bindWebGLContextLifecycle(canvas);

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
  createAnomalies();
  createInteractionLayer();
  for (const orb of document.querySelectorAll(".galaxy-service-row [data-galaxy-service-link] .galaxy-service-row-orb")) {
    serviceRowOrbs.set(orb.closest("[data-galaxy-service-link]").dataset.galaxyServiceLink, orb);
  }
  if (serviceRowOrbs.size || document.getElementById("quiz-console")) createAnswerDeck();
  resizeGalaxy();

  window.addEventListener("resize", resizeGalaxy);
  bindCanvasInteraction(canvas);
  bindGalaxyLayoutControl();
  appState.webglReady = true;
  installSceneDebugApi();
  if (hero) hero.classList.add("webgl-ready");
  galaxy.scene.onAfterRender = function () {
    hero?.classList.remove("is-loading");
    if (loading) loading.hidden = true;
    this.onAfterRender = THREE.Scene.prototype.onAfterRender;
  };
  bindSceneActivity(canvas);
  if (SCENE_DEBUG.forceContextLoss) {
    window.setTimeout(function () {
      if (galaxy.renderer && typeof galaxy.renderer.forceContextLoss === "function") {
        galaxy.renderer.forceContextLoss();
      }
    }, 320);
  }
  scheduleIdleGeometry();
}

export function showGalaxyFallback() {
  const hero = document.querySelector(".galaxy-hero");
  const loading = document.getElementById("galaxy-loading");
  const canvas = document.getElementById("galaxy-canvas");
  if (hero?.classList.contains("webgl-failed")) return;

  appState.webglReady = false;
  appState.threeDMode = false;
  appState.serviceRowMode = false;
  formationFlight = null;
  formationOrbit = null;
  updateSceneActivity();
  clearSphereDive();
  hideObjectHologram();
  hero?.classList.remove(
    "webgl-ready", "is-loading", "is-3d-mode", "is-service-row", "is-service-row-transitioning",
    "is-quiz-transitioning", "is-launching", "is-diving"
  );
  hero?.classList.add("webgl-failed");
  if (loading) loading.hidden = true;
  canvas?.dispatchEvent(new Event("galaxy:unavailable"));
}

function bindWebGLContextLifecycle(canvas) {
  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault();
    showGalaxyFallback();
  });

  canvas.addEventListener("webglcontextrestored", function () {
    window.location.reload();
  });
}

function updateSceneViewport(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const viewport = window.visualViewport;
  const hasVisualViewport = viewport?.width > 0 && viewport?.height > 0;
  const left = hasVisualViewport ? viewport.offsetLeft : 0;
  const top = hasVisualViewport ? viewport.offsetTop : 0;
  const width = hasVisualViewport ? viewport.width : window.innerWidth;
  const height = hasVisualViewport ? viewport.height : window.innerHeight;
  sceneInViewport = bounds.width > 0 && bounds.height > 0 &&
    bounds.bottom > top && bounds.top < top + height &&
    bounds.right > left && bounds.left < left + width;
  updateSceneActivity();
}

function bindSceneActivity(canvas) {
  let viewportFrame = null;

  function scheduleViewportCheck() {
    if (viewportFrame !== null || document.hidden || !scenePageActive || !appState.webglReady) return;
    viewportFrame = requestAnimationFrame(function () {
      viewportFrame = null;
      updateSceneViewport(canvas);
    });
  }

  function cancelViewportCheck() {
    if (viewportFrame === null) return;
    cancelAnimationFrame(viewportFrame);
    viewportFrame = null;
  }

  // Observer entries can lag behind mobile browser chrome and sticky positioning.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(scheduleViewportCheck).observe(canvas);
  }
  window.addEventListener("scroll", scheduleViewportCheck, { passive: true });
  window.addEventListener("resize", scheduleViewportCheck);
  window.visualViewport?.addEventListener("scroll", scheduleViewportCheck, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleViewportCheck);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(function () {
      scheduleViewportCheck();
      resizeGalaxy();
    });
    observer.observe(canvas);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelViewportCheck();
      updateSceneActivity();
    } else {
      updateSceneViewport(canvas);
    }
  });
  window.addEventListener("pagehide", function () {
    scenePageActive = false;
    cancelViewportCheck();
    updateSceneActivity();
  });
  window.addEventListener("pageshow", function () {
    scenePageActive = true;
    updateSceneViewport(canvas);
  });
  updateSceneViewport(canvas);
}

function updateSceneActivity() {
  const active = sceneInViewport && scenePageActive && !document.hidden && appState.webglReady;
  if (!active) {
    if (formationFlight) finishFormationFlight(formationFlight.direction);
    if (sceneAnimationFrame !== null) {
      cancelAnimationFrame(sceneAnimationFrame);
      sceneAnimationFrame = null;
    }
    if (galaxy.clock.running) galaxy.clock.stop();
    return;
  }

  if (!galaxy.clock.running) {
    const elapsed = galaxy.clock.elapsedTime;
    galaxy.clock.start();
    galaxy.clock.elapsedTime = elapsed;
  }
  if (sceneAnimationFrame === null) {
    sceneAnimationFrame = requestAnimationFrame(animateGalaxy);
  }
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

function getRenderPixelRatio(width, height) {
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
  const maxCanvasSide = galaxy.renderer.capabilities.maxTextureSize;
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
    opacity: 0.045
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
      opacity: 0.035
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
  for (const [layout, config] of Object.entries(ORBIT_LAYOUTS)) {
    galaxy.overviewLayouts[layout] = {
      baseView: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), config.tilt)
    };
  }
  galaxy.star = createCoreObject();
  galaxy.star.position.set(0.04, 0.12, -0.18);
  galaxy.root.add(galaxy.star);

  const shellGeometry = new THREE.SphereGeometry(0.66, 32, 18, 0, Math.PI * 1.25);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: VISUAL_COLORS.soft,
    wireframe: true,
    transparent: true,
    opacity: 0
  });
  galaxy.shell = new THREE.Mesh(shellGeometry, shellMaterial);
  galaxy.shell.position.copy(galaxy.star.position);
  galaxy.shell.visible = false;
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

function createSystemPlanets() {
  Object.entries(PLANETS).forEach(function ([id, config]) {
    const planet = new THREE.Group();
    planet.userData.id = id;
    if (SCENE_DEBUG.enabled) {
      const model = createSystemModel(id, config.color);
      const visualMaterials = [];
      model.traverse(function (child) {
        if (!child.material) return;
        child.material.userData.planetBaseOpacity = child.material.opacity ?? 1;
        visualMaterials.push(child.material);
      });
      const presentationConfig = SYSTEM_PRESENTATIONS[id];
      const presentation = createSpherePresentation({
        id,
        context: "planet",
        color: config.color,
        model,
        config: presentationConfig,
        radius: config.size * presentationConfig.planetRadiusMultiplier,
        compact: window.innerWidth < 760,
        lightTheme: LIGHT_GALAXY
      });
      planet.userData.presentation = presentation;
      planet.userData.visualMaterials = visualMaterials;
      presentation.root.visible = false;
      planet.add(presentation.root);
    }

    galaxy.planets[id] = planet;
    galaxy.root.add(planet);
  });
}

function createSystemModel(id, color) {
  return buildSemanticSystemModel(id, color, getSystemModelKit()).root;
}

function createRescueRig() {
  galaxy.rescueRig = new THREE.Group();
  galaxy.rescueRig.position.copy(galaxy.star.position);
  galaxy.rescueRig.quaternion.copy(galaxy.root.quaternion).invert();
  galaxy.root.add(galaxy.rescueRig);

  const serviceColors = {};
  PLANET_IDS.forEach(function (serviceId) {
    serviceColors[serviceId] = PLANETS[serviceId].color;
  });
  for (const [layout, assets] of Object.entries(galaxy.overviewLayouts)) {
    assets.grid = createServiceSpatialGrid({ layout, serviceIds: PLANET_IDS, colors: serviceColors });
  }
  setGalaxyLayout(galaxy.layout);
  const initialGridScale = galaxy.rescueRigGrid.scale;

  const rotations = {
    firmware: [-0.04, 0.12, -0.03],
    backend: [0, -0.1, 0.02],
    automation: [0.02, 0.06, -0.02],
    pqc: [0.08, 0.14, 0],
    data: [0, 0.12, 0],
    hardware: [-0.22, -0.08, 0.03],
    ops: [-0.04, 0.1, 0]
  };

  PLANET_IDS.forEach(function (id) {
    const { color } = PLANETS[id];
    const built = buildSemanticSystemModel(id, color, getSystemModelKit());
    const semanticModel = built.root;
    const presentation = createSpherePresentation({
      id,
      context: "rescue",
      color,
      model: semanticModel,
      config: SYSTEM_PRESENTATIONS[id],
      compact: window.innerWidth < 760,
      lightTheme: LIGHT_GALAXY
    });
    const object = presentation.root;
    object.scale.setScalar(initialGridScale * SERVICE_DEPTH_RADIUS.base / presentation.radius);
    if (id === "pqc") presentation.posePivot.rotation.order = "ZYX";
    sampleServiceGridPosition(
      galaxy.rescueRigGrid,
      id,
      0,
      object.position,
      { compact: window.innerWidth < 760, reducedMotion: true }
    );
    object.userData.semanticModel = semanticModel;
    object.userData.id = id;
    const [pitch, yaw, roll] = rotations[id];
    object.userData.baseRotation = new THREE.Euler(SYSTEM_PRESENTATIONS[id].tiltX ?? pitch, yaw, roll);
    object.userData.color = color;
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
      new THREE.SphereGeometry(presentation.radius, 18, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001,
        depthWrite: false
      })
    );
    collider.userData.planetId = id;
    object.userData.collider = collider;
    object.add(collider);
    galaxy.planetMeshes.push(collider);
    galaxy.rescueRigObjects[id] = object;
    galaxy.rescueRig.add(object);
  });

  createRescueRigCables();
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
  galaxy.rescueRigCables = PLANET_IDS.map(function (serviceId) {
    const tube = createConnectionTube(0.14, {
      protectedSignal: serviceId === "pqc",
      lightTheme: LIGHT_GALAXY
    });
    tube.userData.serviceId = serviceId;
    tube.userData.opacity = 0.4;
    galaxy.rescueRig.add(tube);
    return tube;
  });
  refreshConnectionObstacles();
}

function refreshConnectionObstacles() {
  const lanes = galaxy.rescueRigGrid.assignments;
  for (const tube of galaxy.rescueRigCables) {
    const trackRadius = lanes.get(tube.userData.serviceId).orbit.radius;
    tube.userData.innerPlanets = PLANET_IDS.filter((id) => lanes.get(id).orbit.radius < trackRadius)
      .map((id) => galaxy.rescueRigObjects[id]);
  }
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
    const tube = createConnectionTube(0.025, { carriesSignal: false });
    tube.userData.pair = pair;
    tube.visible = false;
    galaxy.rescueRig.add(tube);
    return tube;
  });
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
  galaxy.blackHole.visible = false;
  galaxy.rescueRig.add(galaxy.blackHole);

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
    ring.visible = false;
    galaxy.accretionRings.push(ring);
    galaxy.rescueRig.add(ring);
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
  debrisGroup.visible = false;
  galaxy.rescueRig.add(debrisGroup);
}

function createInteractionLayer() {
  galaxy.focusHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.017, 8, 96),
    new THREE.MeshBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );
  galaxy.focusHalo.visible = false;
  galaxy.rescueRig.add(galaxy.focusHalo);

  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  galaxy.focusBeam = new THREE.Line(
    beamGeometry,
    new THREE.LineBasicMaterial({
      color: VISUAL_COLORS.accent,
      transparent: true,
      opacity: 0.018,
      depthWrite: false
    })
  );
  galaxy.focusBeam.frustumCulled = false;
  galaxy.focusBeam.visible = false;
  galaxy.rescueRig.add(galaxy.focusBeam);
}

// ---------- Staging slots for the reversible scene formation ----------

function createAnswerDeck() {
  galaxy.answerDeck = new THREE.Group();
  galaxy.answerDeck.visible = false;
  galaxy.scene.add(galaxy.answerDeck);

  for (const id of PLANET_IDS) {
    const slot = new THREE.Group();
    formationSlots.set(id, slot);
    galaxy.answerDeck.add(slot);
  }
}

// ---------- Resize, pointer, micro-pulse ----------

export function resizeGalaxy() {
  if (!galaxy.renderer || !galaxy.camera) return;
  const canvas = galaxy.renderer.domElement;
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  galaxy.camera.aspect = width / Math.max(height, 1);
  galaxy.camera.updateProjectionMatrix();
  const size = galaxy.renderer.getSize(resizeCanvasSize);
  const pixelRatio = getRenderPixelRatio(width, height);
  if (size.x !== width || size.y !== height || galaxy.renderer.getPixelRatio() !== pixelRatio) {
    galaxy.renderer.setDrawingBufferSize(width, height, pixelRatio);
  }
  applyHeroGalaxyComposition();
}

function applyHeroGalaxyComposition() {
  if (!galaxy.root) return;
  const compact = window.innerWidth < 760;
  const trueMobile = window.innerWidth < QUALITY_CONFIG.trueMobileWidth;
  galaxy.root.scale.setScalar(trueMobile ? 1.28 : compact ? 1.12 : 1.18);
  if (galaxy.scene && galaxy.scene.fog) {
    galaxy.scene.fog.density = compact ? 0.034 : 0.024;
  }
}

function getOverviewRigScale() {
  const width = window.innerWidth;
  const config = ORBIT_LAYOUTS[galaxy.layout];
  if (width <= 340) return config.narrowScale;
  if (width < 760) return config.compactScale;
  return THREE.MathUtils.clamp(galaxy.camera.aspect * config.desktopScale, config.desktopMin, config.desktopMax);
}

function setGalaxyLayout(layout) {
  const assets = galaxy.overviewLayouts[layout];
  if (!assets?.grid || galaxy.rescueRigGrid === assets.grid) return;
  hideObjectHologram();
  galaxy.rescueRigGrid?.root.removeFromParent();
  galaxy.layout = layout;
  galaxy.rescueRigGrid = assets.grid;
  const compact = window.innerWidth < 760;
  assets.grid.scale = compact ? assets.grid.compactScale : 1;
  assets.grid.root.scale.setScalar(assets.grid.scale);
  galaxy.rescueRig.add(assets.grid.root);
  galaxy.rescueRig.scale.setScalar(getOverviewRigScale());
  refreshConnectionObstacles();
  applyHeroGalaxyComposition();
}

function bindGalaxyLayoutControl() {
  const controls = document.getElementById("galaxy-layout");
  if (!controls) return;
  for (const input of controls.querySelectorAll('input[name="galaxy-layout"]')) {
    input.checked = input.value === galaxy.layout;
  }
  controls.addEventListener("change", function (event) {
    const { value, name, checked } = event.target;
    if (name !== "galaxy-layout" || !checked || !Object.hasOwn(ORBIT_LAYOUTS, value)) return;
    setGalaxyLayout(value);
    syncGalaxyNavigationLinks();
    const url = new URL(window.location.href);
    url.searchParams.set("layout", value);
    window.history.replaceState(window.history.state, "", url);
  });
}

export function syncGalaxyNavigationLinks() {
  const focus = appState.selectedPlanet;
  document.querySelectorAll("a[data-galaxy-service-link], a[data-galaxy-context-link]").forEach(function (link) {
    const service = GALAXY_SERVICE_BY_ID[link.dataset.galaxyServiceLink];
    const url = new URL(service?.path ?? link.href, window.location.href);
    url.searchParams.set("from", "galaxy");
    url.searchParams.set("layout", galaxy.layout);
    if (LIGHT_GALAXY && url.pathname !== "/" && url.pathname !== "/explore.html") {
      url.searchParams.set("theme", "light");
    }
    if (link.hasAttribute("data-galaxy-context-link")) {
      if (Object.hasOwn(PLANETS, focus)) url.searchParams.set("focus", focus);
      else url.searchParams.delete("focus");
    }
    link.href = url.href;
  });
}

function clearSphereDive() {
  if (!sphereDive) return null;
  const { opener } = sphereDive;
  window.clearTimeout(sphereDive.timer);
  galaxy.camera.position.copy(sphereDive.startPosition);
  galaxy.camera.quaternion.copy(sphereDive.startRotation);
  galaxy.camera.updateMatrixWorld();
  sphereDive.overlay.remove();
  sphereDive = null;
  const hero = galaxy.renderer.domElement.closest(".galaxy-hero");
  hero?.classList.remove("is-diving");
  hero?.dispatchEvent(new Event("galaxy:sphere-dive-end"));
  return opener;
}

function openGalaxyService(link, fromCanvas = false) {
  const serviceId = link.dataset.galaxyServiceLink;
  if (sphereDive || !Object.hasOwn(PLANETS, serviceId)) return;
  hideObjectHologram();
  const url = new URL(link.href);
  const current = new URL(window.location.href);
  current.searchParams.set("focus", serviceId);
  window.history.replaceState(window.history.state, "", current);
  focusPlanet(serviceId, { fromCanvas });

  const target = galaxy.rescueRigObjects[serviceId];
  if (!appState.webglReady || appState.reducedMotion || appState.threeDMode ||
      formationFlight || !target) {
    window.location.assign(url);
    return;
  }
  const canvas = galaxy.renderer.domElement;
  const bounds = canvas.getBoundingClientRect();
  if (Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0) < 100) {
    window.location.assign(url);
    return;
  }
  sphereDive = createSphereDive(galaxy.camera, target, target.userData.presentation.radius, PLANETS[serviceId].color);
  sphereDive.serviceId = serviceId;
  sphereDive.opener = document.activeElement === link ? link : null;
  sphereDive.timer = window.setTimeout(() => window.location.assign(url), SPHERE_DIVE_DURATION + 45);
  canvas.closest(".galaxy-hero")?.classList.add("is-diving");
}

export function bindGalaxyServiceLinks() {
  const focus = new URLSearchParams(window.location.search).get("focus");
  if (Object.hasOwn(PLANETS, focus)) focusPlanet(focus);
  else syncGalaxyNavigationLinks();
  for (const services of document.querySelectorAll(".galaxy-service-links, .galaxy-service-row")) {
    services.addEventListener("click", function (event) {
      const link = event.target.closest("[data-galaxy-service-link]");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openGalaxyService(link);
    });
  }
  window.addEventListener("pageshow", clearSphereDive);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !sphereDive) return;
    event.preventDefault();
    clearSphereDive()?.focus({ preventScroll: true });
  });
}

function bindCanvasInteraction(canvas) {
  objectHologram = createObjectHologram(canvas.parentElement);
  const controls = document.getElementById("galaxy-orbit-controls");
  const toggle = document.getElementById("galaxy-orbit-toggle");
  const done = document.getElementById("galaxy-orbit-done");
  const reset = document.getElementById("galaxy-orbit-reset");
  const motionToggle = document.getElementById("galaxy-motion-toggle");
  let gesture = null;
  let suppressClick = false;
  let touchActivation = false;
  let touchOrbit = false;

  motionToggle?.addEventListener("click", function () {
    overviewMotionPaused = !overviewMotionPaused;
    const label = overviewMotionPaused ? "Resume Galaxy motion" : "Pause Galaxy motion";
    motionToggle.classList.toggle("is-paused", overviewMotionPaused);
    motionToggle.setAttribute("aria-label", label);
    motionToggle.title = label;
  });

  function canRotateOverview() {
    return appState.webglReady && !appState.threeDMode && !appState.serviceRowMode &&
      !sphereDive && !formationFlight;
  }

  function rotateOverview(yaw, pitch) {
    const view = galaxy.orbitView;
    view.yaw += yaw;
    if (view.yaw > Math.PI || view.yaw < -Math.PI) {
      view.yaw = THREE.MathUtils.euclideanModulo(view.yaw + Math.PI, Math.PI * 2) - Math.PI;
    }
    view.pitch = THREE.MathUtils.clamp(view.pitch + pitch, -ORBIT_VIEW_LIMIT.pitch, ORBIT_VIEW_LIMIT.pitch);
    if (sceneAnimationFrame === null) updateSceneViewport(canvas);
  }

  function resetView() {
    galaxy.orbitView.yaw = 0;
    galaxy.orbitView.pitch = 0;
    clearHover();
  }

  function setTouchOrbit(enabled) {
    if (touchOrbit === enabled) return;
    const transferFocus = document.activeElement === (enabled ? toggle : done);
    touchOrbit = enabled;
    canvas.classList.toggle("is-touch-orbiting", enabled);
    controls?.classList.toggle("is-touch-orbiting", enabled);
    toggle?.setAttribute("aria-pressed", String(enabled));
    if (done) done.hidden = !enabled;
    if (transferFocus && canRotateOverview()) (enabled ? done : toggle)?.focus({ preventScroll: true });
    if (gesture?.touch) cancelGesture(gesture.id);
    if (enabled && sceneAnimationFrame === null) updateSceneViewport(canvas);
  }

  function clearHover() {
    appState.pointer.x = 0;
    appState.pointer.y = 0;
    appState.hoveredPlanet = null;
    hideObjectHologram();
    canvas.classList.remove("is-targeting");
  }

  function endGesture(pointerId) {
    if (gesture?.id !== pointerId) return;
    gesture = null;
    canvas.classList.remove("is-orbit-dragging");
    if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  function cancelGesture(pointerId) {
    if (gesture?.id !== pointerId) return;
    suppressClick = true;
    touchActivation = false;
    endGesture(pointerId);
    clearHover();
  }

  function exitOrbitInteraction() {
    if (gesture) cancelGesture(gesture.id);
    else clearHover();
    setTouchOrbit(false);
  }

  canvas.addEventListener("pointerdown", function (event) {
    const touch = event.pointerType === "touch";
    if (!event.isPrimary) {
      if (touch && gesture?.touch) cancelGesture(gesture.id);
      return;
    }
    if (event.button !== 0 || (gesture && gesture.touch !== touch)) return;
    // A browser navigation gesture can interrupt the preceding touch without a final event.
    if (gesture) endGesture(gesture.id);
    touchActivation = touch;
    suppressClick = false;
    if (!canRotateOverview()) return;
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      touch,
      twoAxes: !touch || touchOrbit,
      mode: "pending"
    };
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!canRotateOverview()) {
      cancelGesture(event.pointerId);
      return;
    }
    if (gesture?.id === event.pointerId) {
      if (gesture.mode === "scroll") return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (gesture.mode === "pending") {
        const threshold = gesture.touch ? 9 : 5;
        if (Math.hypot(dx, dy) < threshold) return;
        suppressClick = true;
        clearHover();
        if (!gesture.twoAxes && Math.abs(dx) <= Math.abs(dy) * 1.15) {
          gesture.mode = "scroll";
          return;
        }
        gesture.mode = "drag";
        try {
          canvas.setPointerCapture?.(event.pointerId);
        } catch {
          // A pending touch can be reclaimed by the browser while starting a drag.
          // End and cancel are also observed outside the canvas.
        }
        canvas.classList.add("is-orbit-dragging");
      }
      const sensitivity = gesture.touch ? 0.009 : 0.006;
      rotateOverview(dx * sensitivity, gesture.twoAxes ? dy * sensitivity : 0);
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      return;
    }
    if (gesture || event.pointerType === "touch") return;
    updatePointerFromEvent(canvas, event);

    const hit = getCanvasHit();
    const now = performance.now();
    canvas.classList.toggle("is-targeting", Boolean(hit && hit.type !== "core" && hit.type !== "anomaly"));
    if (hit) showObjectHologram(hit, false);
    else hideObjectHologram();

    if (hit?.type === "planet" && hit.planetId !== appState.hoveredPlanet && now - appState.lastPointerFocus > 90) {
      appState.hoveredPlanet = hit.planetId;
      appState.lastPointerFocus = now;
      focusPlanet(hit.planetId, { fromCanvas: true });
      runMicroPulse(hit.planetId, { preserveInsight: true });
    } else if (hit?.type !== "planet") {
      appState.hoveredPlanet = null;
    }
  });

  canvas.addEventListener("pointerleave", function (event) {
    if (!event.isPrimary || event.pointerType === "touch" || canvas.hasPointerCapture?.(event.pointerId)) return;
    endGesture(event.pointerId);
    clearHover();
  });

  window.addEventListener("pointerup", (event) => endGesture(event.pointerId));
  window.addEventListener("pointercancel", (event) => cancelGesture(event.pointerId));
  canvas.addEventListener("lostpointercapture", function (event) {
    if (gesture?.mode === "drag") cancelGesture(event.pointerId);
  });
  canvas.addEventListener("galaxy:unavailable", exitOrbitInteraction);
  window.addEventListener("pagehide", exitOrbitInteraction);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) exitOrbitInteraction();
  });

  canvas.addEventListener("click", function (event) {
    const touch = event.pointerType === "touch" || touchActivation;
    touchActivation = false;
    if (!canRotateOverview()) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    updatePointerFromEvent(canvas, event);
    const hit = getCanvasHit(touch);
    if (!hit) {
      clearHover();
      return;
    }
    if (hit.type === "core" || hit.type === "anomaly") {
      showObjectHologram(hit, touch);
      return;
    }
    if (touch && hit.type === "planet" && showObjectHologram(hit, true)) {
      focusPlanet(hit.planetId, { fromCanvas: true });
      runMicroPulse(hit.planetId, { preserveInsight: true });
      return;
    }
    hideObjectHologram();
    if (hit.type === "planet") {
      const link = document.querySelector(`.galaxy-service-links [data-galaxy-service-link="${hit.planetId}"]`);
      if (link) openGalaxyService(link, true);
    }
  });

  document.addEventListener("pointerdown", function (event) {
    if (event.target === canvas) return;
    hideObjectHologram();
    if (touchOrbit && !controls?.contains(event.target)) exitOrbitInteraction();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    hideObjectHologram();
    if (!event.defaultPrevented && touchOrbit) {
      setTouchOrbit(false);
      event.preventDefault();
    }
  });
  window.addEventListener("pageshow", hideObjectHologram);

  toggle?.addEventListener("click", function () {
    if (canRotateOverview()) setTouchOrbit(!touchOrbit);
  });
  done?.addEventListener("click", function () {
    setTouchOrbit(false);
  });
  reset?.addEventListener("click", function () {
    if (canRotateOverview()) resetView();
  });
  const hero = canvas.closest(".galaxy-hero");
  if (hero) {
    new MutationObserver(function () {
      if (!canRotateOverview() && (touchOrbit || gesture)) exitOrbitInteraction();
    }).observe(hero, { attributes: true, attributeFilter: ["class"] });
  }

  const keyTurns = {
    ArrowLeft: [-0.12, 0],
    ArrowRight: [0.12, 0],
    ArrowUp: [0, -0.12],
    ArrowDown: [0, 0.12]
  };
  controls?.addEventListener("keydown", function (event) {
    if (!canRotateOverview() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Home") {
      resetView();
    } else if (event.key === "Escape" && touchOrbit) {
      setTouchOrbit(false);
    } else if (Object.hasOwn(keyTurns, event.key)) {
      rotateOverview(...keyTurns[event.key]);
      clearHover();
    } else {
      return;
    }
    event.preventDefault();
  });
}

function showObjectHologram(hit, touch) {
  let object, radius, label, color;
  if (hit.type === "planet") {
    object = galaxy.rescueRigObjects[hit.planetId];
    radius = object.userData.presentation.radius;
    ({ label, color } = PLANETS[hit.planetId]);
  } else if (hit.type === "anomaly") {
    object = galaxy.blackHole;
    radius = object.geometry.parameters.radius;
    label = "API latency";
    color = VISUAL_COLORS.warning;
  } else {
    object = galaxy.star;
    radius = object.geometry.parameters.radius;
    label = "Core";
    color = VISUAL_COLORS.accent;
  }

  if (hologramTarget?.object === object && hologramTarget.touch === touch) return false;
  hologramTarget = { object, radius, touch };
  objectHologram.show(label, "#" + color.toString(16).padStart(6, "0"));
  updateObjectHologram();
  return true;
}

function hideObjectHologram() {
  if (!hologramTarget) return;
  hologramTarget = null;
  objectHologram.hide();
}

function updateObjectHologram() {
  if (!hologramTarget) return;
  const { object, radius } = hologramTarget;
  if (appState.threeDMode || appState.serviceRowMode || !object.visible) {
    hideObjectHologram();
    return;
  }
  const { camera, renderer } = galaxy;
  const center = object.getWorldPosition(hologramPosition);
  const viewDepth = -hologramViewPosition.copy(center).applyMatrix4(camera.matrixWorldInverse).z;
  const projected = center.project(camera);
  if (viewDepth <= 0 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
    hideObjectHologram();
    return;
  }
  const { x: width, y: height } = renderer.getSize(hologramCanvasSize);
  const worldRadius = radius * object.getWorldScale(hologramViewPosition).x;
  const screenRadius = worldRadius * camera.projectionMatrix.elements[5] * height / (2 * viewDepth);
  objectHologram.update((projected.x + 1) * width / 2, (1 - projected.y) * height / 2, screenRadius, width, height);
}

function updatePointerFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
  appState.pointer.x = (x - 0.5) * 2;
  appState.pointer.y = (0.5 - y) * 2;
  galaxy.pointerVector.set(appState.pointer.x, appState.pointer.y);
}

function getCanvasHit(touch = false) {
  if (!appState.webglReady || !galaxy.raycaster || !galaxy.camera) return null;
  galaxy.raycaster.setFromCamera(galaxy.pointerVector, galaxy.camera);

  const hit = getOverviewPointerHit();
  // Core blocks nearby service targets and has a label but no navigation action.
  if (hit?.object === galaxy.star) return { type: "core" };
  const planetId = hit ? hit.object.userData.planetId : touch ? getPlanetFromTouchProximity() : null;
  if (planetId) return { type: "planet", planetId };
  if (galaxy.blackHole.visible && galaxy.raycaster.intersectObject(galaxy.blackHole, false).length) {
    return { type: "anomaly" };
  }
  return null;
}

function getOverviewPointerHit() {
  galaxy.hitBuffer.length = 0;
  galaxy.raycaster.intersectObjects(galaxy.planetMeshes, false, galaxy.hitBuffer);
  galaxy.raycaster.intersectObject(galaxy.star, false, galaxy.hitBuffer);
  return galaxy.hitBuffer[0];
}

function getPlanetFromTouchProximity() {
  const canvas = galaxy.renderer.domElement;
  const bounds = canvas.getBoundingClientRect();
  let nearest = null;
  let nearestDistance = 22 * 22;
  for (const collider of galaxy.planetMeshes) {
    collider.getWorldPosition(galaxy.scratch.screenPosition);
    const point = galaxy.scratch.screenPosition.project(galaxy.camera);
    if (point.z < -1 || point.z > 1) continue;
    const dx = (galaxy.pointerVector.x - point.x) * bounds.width / 2;
    const dy = (galaxy.pointerVector.y - point.y) * bounds.height / 2;
    const distance = dx * dx + dy * dy;
    if (distance > nearestDistance) continue;

    // A nearby tap must not select a sphere hidden behind Core or another service.
    galaxy.raycaster.setFromCamera(point, galaxy.camera);
    const id = collider.userData.planetId;
    if (getOverviewPointerHit()?.object.userData.planetId !== id) continue;
    nearest = id;
    nearestDistance = distance;
  }
  galaxy.raycaster.setFromCamera(galaxy.pointerVector, galaxy.camera);
  return nearest;
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

export function isGalaxyQuizTransitioning() {
  return formationOrbit?.mode === "quiz" && formationFlight !== null;
}

export function startGalaxyQuizTransition(direction) {
  return startGalaxyFormation("quiz", direction);
}

export function isGalaxyServiceRowTransitioning() {
  return formationOrbit?.mode === "service-row" && formationFlight !== null;
}

export function startGalaxyServiceRowTransition(direction) {
  if (!PLANET_IDS.every((id) => serviceRowOrbs.has(id))) return false;
  return startGalaxyFormation("service-row", direction);
}

function formationFlightSnapshot() {
  return formationFlight ? { direction: formationFlight.direction, progress: formationFlight.progress } : null;
}

function startGalaxyFormation(mode, direction) {
  if (!appState.webglReady || !galaxy.answerDeck || sphereDive) return false;
  if (formationFlight || (direction === "enter" ? Boolean(formationOrbit) : formationOrbit?.mode !== mode)) return false;
  const { camera, renderer } = galaxy;
  const canvas = renderer.domElement;
  const bounds = canvas.getBoundingClientRect();
  const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
  const animate = !appState.reducedMotion && sceneInViewport && scenePageActive && !document.hidden &&
    bounds.bottom > headerBottom && bounds.top < window.innerHeight;
  const corePosition = galaxy.star.getWorldPosition(new THREE.Vector3());
  const coreRadius = galaxy.star.geometry.parameters.radius * galaxy.star.getWorldScale(formationScale).x;
  if (direction === "enter") {
    if (mode === "quiz") {
      quizCenterService = appState.selectedPlanet;
      quizRingServices = PLANET_IDS.filter((id) => id !== quizCenterService);
    }
    formationOrbit = {
      mode,
      focus: appState.selectedPlanet,
      poses: new Map(PLANET_IDS.map((id) => {
        const sphere = galaxy.rescueRigObjects[id];
        return [id, {
          position: sphere.position.clone(),
          rotation: sphere.quaternion.clone(),
          scale: sphere.scale.clone()
        }];
      }))
    };
  }
  hideObjectHologram();
  if (!animate) {
    if (direction === "enter") updateFormationSlots();
    finishFormationFlight(direction);
    return true;
  }
  if (direction === "exit") updateFormationSlots();
  galaxy.answerDeck.visible = false;

  const actors = PLANET_IDS.map(function (id) {
    const sphere = galaxy.rescueRigObjects[id];
    const position = sphere.getWorldPosition(new THREE.Vector3());
    const rotation = sphere.getWorldQuaternion(new THREE.Quaternion());
    const scale = sphere.getWorldScale(new THREE.Vector3());
    const origin = projectFormationOrigin(position, camera, bounds);
    galaxy.scene.attach(sphere);
    return { id, sphere, origin, rotation, scale };
  });
  formationFlight = {
    direction,
    actors,
    started: null,
    progress: 0,
    core: projectFormationOrigin(corePosition, camera, bounds),
    coreRadius,
    startFocalPixels: camera.projectionMatrix.elements[5] * bounds.height
  };
  formationBurst ??= createQuizBurst(THREE, galaxy.scene);
  canvas.closest(".galaxy-hero")?.classList.add(`is-${mode}-transitioning`);
  return true;
}

function projectFormationOrigin(position, camera, bounds) {
  const point = position.project(camera);
  return new THREE.Vector3(
    bounds.left + (point.x + 1) * bounds.width / 2,
    bounds.top + (1 - point.y) * bounds.height / 2,
    point.z
  );
}

function unprojectFormationOrigin(origin, bounds, target) {
  return target.set(
    (origin.x - bounds.left) * 2 / bounds.width - 1,
    1 - (origin.y - bounds.top) * 2 / bounds.height,
    origin.z
  ).unproject(galaxy.camera);
}

function finishFormationFlight(direction) {
  const { mode } = formationOrbit;
  for (const id of PLANET_IDS) {
    const sphere = galaxy.rescueRigObjects[id];
    if (direction === "enter") {
      formationSlots.get(id).add(sphere);
      sphere.position.set(0, 0, 0);
      sphere.quaternion.identity();
      sphere.scale.setScalar(1);
    } else {
      const orbit = formationOrbit.poses.get(id);
      galaxy.rescueRig.add(sphere);
      sphere.position.copy(orbit.position);
      sphere.quaternion.copy(orbit.rotation);
      sphere.scale.copy(orbit.scale);
    }
  }
  galaxy.answerDeck.visible = direction === "enter" && mode === "service-row";
  if (direction === "exit") {
    const focus = formationOrbit.focus;
    formationOrbit = null;
    focusPlanet(focus);
    galaxy.root.visible = true;
  }
  formationFlight = null;
  formationBurst?.hide();
  const hero = galaxy.renderer.domElement.closest(".galaxy-hero");
  const transitionClass = `is-${mode}-transitioning`;
  if (hero?.classList.contains(transitionClass)) {
    hero.classList.remove(transitionClass);
    hero.dispatchEvent(new Event(`galaxy:${mode}-transition-end`));
  }
}

function updateFormationFlight() {
  if (!formationFlight) return;
  const { direction, actors, startFocalPixels } = formationFlight;
  const now = performance.now();
  formationFlight.started ??= now;
  const progress = Math.min(1, (now - formationFlight.started) / FORMATION_FLIGHT_MS);
  formationFlight.progress = progress;
  if (progress >= 1 || appState.reducedMotion) {
    finishFormationFlight(direction);
    return;
  }
  const entering = direction === "enter";
  const bounds = galaxy.renderer.domElement.getBoundingClientRect();
  const scaleRatio = startFocalPixels / (galaxy.camera.projectionMatrix.elements[5] * bounds.height);
  const core = entering
    ? unprojectFormationOrigin(formationFlight.core, bounds, formationOrigin)
    : galaxy.star.getWorldPosition(formationOrigin);
  formationBurst.update(core, formationFlight.coreRadius * (entering ? scaleRatio : 1), progress, direction);
  for (const [index, actor] of actors.entries()) {
    const { id, sphere, origin, rotation, scale } = actor;
    const delay = entering ? 0.075 + index * 0.013 : index * 0.011;
    const movement = THREE.MathUtils.smootherstep(progress, delay, 0.96);
    const parent = entering ? formationSlots.get(id) : galaxy.rescueRig;
    const orbit = formationOrbit.poses.get(id);
    const targetPosition = entering ? formationPosition.set(0, 0, 0) : formationPosition.copy(orbit.position);
    parent.localToWorld(targetPosition);
    unprojectFormationOrigin(origin, bounds, sphere.position).lerp(targetPosition, movement);
    // Stagger curved paths so the seven spheres remain distinct through the burst.
    sphere.position.y += Math.sin(Math.PI * movement) * (0.16 + (index % 3) * 0.09);
    parent.getWorldQuaternion(formationRotation);
    if (!entering) formationRotation.multiply(orbit.rotation);
    sphere.quaternion.copy(rotation).slerp(formationRotation, movement);
    parent.getWorldScale(formationScale);
    if (!entering) formationScale.multiply(orbit.scale);
    sphere.scale.copy(scale).multiplyScalar(scaleRatio).lerp(formationScale, movement);
  }
}

// ---------- Frame loop + per-frame updaters ----------

function animateGalaxy() {
  sceneAnimationFrame = null;
  if (!sceneInViewport || !scenePageActive || document.hidden || !appState.webglReady) {
    updateSceneActivity();
    return;
  }
  try {
    drawGalaxyFrame();
  } catch (error) {
    if (!galaxy.renderer?.getContext().isContextLost()) {
      window.__galaxyFrameError = { message: error?.message ?? String(error) };
    }
    showGalaxyFallback();
    return;
  }
  if (sceneAnimationFrame === null && appState.webglReady) {
    sceneAnimationFrame = requestAnimationFrame(animateGalaxy);
  }
}

function getOverviewElapsed() {
  if (SCENE_DEBUG.forceReducedMotion) return 0;
  if (Number.isFinite(SCENE_DEBUG.fixedElapsed)) {
    return appState.reducedMotion ? 0 : SCENE_DEBUG.fixedElapsed;
  }
  return overviewElapsed;
}

function drawGalaxyFrame() {
  const clockDelta = Math.min(galaxy.clock.getDelta(), 0.05);
  if (!galaxy.renderer || !galaxy.scene || !galaxy.camera || !appState.webglReady) return;
  const fixedTime = Number.isFinite(SCENE_DEBUG.fixedElapsed);
  const advanceMotion = !fixedTime && !overviewMotionPaused && !formationOrbit && !SCENE_DEBUG.forceReducedMotion;
  // Keep a slow orbit while honoring reduced motion for camera moves and visual effects.
  if (advanceMotion) overviewElapsed += clockDelta * (appState.reducedMotion ? 0.45 : 1);
  const elapsed = fixedTime ? SCENE_DEBUG.fixedElapsed : galaxy.clock.elapsedTime;
  const orbitElapsed = getOverviewElapsed();
  const motionDelta = advanceMotion && !appState.reducedMotion ? clockDelta : 0;
  const motionElapsed = appState.reducedMotion ? 0 : orbitElapsed;
  const visual = appState.galaxyState || refreshGalaxyState();

  galaxy.root.visible = formationFlight
    ? formationFlight.direction === "enter" ? formationFlight.progress < 0.08 : formationFlight.progress > 0.87
    : !formationOrbit;

  if (!formationOrbit) {
    if (appState.reducedMotion) galaxy.root.rotation.y = 0;
    else galaxy.root.rotation.y += motionDelta * (0.045 + visual.pressure * 0.035);

    updatePlanets(elapsed, orbitElapsed, motionDelta, visual);
    updateVectorField(motionElapsed, visual);
    updateAnomalies(motionElapsed, motionDelta, visual);
    updateEnergyEffects(motionElapsed, motionDelta, visual);
  }

  if (!sphereDive) updateGalaxyCamera(elapsed, visual);

  if (!formationOrbit) {
    updateRescueRig(orbitElapsed, motionDelta, visual);
    updateBridges(motionElapsed, visual);
    updateAutomationDebris(motionElapsed, visual);
    updateHandoffAnomaly(motionElapsed, motionDelta, visual);
    updateInteractionLayer(motionElapsed, motionDelta, visual);
  }

  if (appState.reducedMotion) galaxy.star.rotation.set(0, 0, 0);
  else {
    galaxy.star.rotation.y += motionDelta * 0.09;
    galaxy.star.rotation.x += motionDelta * 0.04;
  }
  updateCoreObject(galaxy.star, motionElapsed, appState.reducedMotion);

  if (sphereDive) {
    updateSphereDive(sphereDive, galaxy.camera, galaxy.renderer.domElement);
    galaxy.renderer.render(galaxy.scene, galaxy.camera);
    return;
  }

  updateOverviewProjection();
  if (formationOrbit) {
    galaxy.camera.updateMatrixWorld();
    if (formationFlight?.direction !== "exit") updateFormationSlots();
  }
  if (formationFlight) {
    updateFormationFlight();
  }
  galaxy.renderer.render(galaxy.scene, galaxy.camera);
  updateObjectHologram();
}

function updateOverviewProjection() {
  const { camera, renderer, rescueRig, rescueRigGrid } = galaxy;
  let zoom = 1;
  if (!appState.threeDMode && !appState.serviceRowMode) {
    const { x: width, y: height } = renderer.getSize(overviewCanvasSize);
    // Leave room for the layout switch and rotation controls above and below the scene.
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizontal = tangent * Math.max(1, width - 32) / height;
    const vertical = tangent * Math.max(1, height - 132) / height;
    const distance = camera.position.distanceTo(galaxy.scratch.lookAt) /
      (galaxy.root.scale.x * rescueRig.scale.x * rescueRigGrid.scale);
    let low = 0;
    let high = 2.5;
    // Fit the entire orbital paths so ordinary motion cannot cause the camera to zoom in and out.
    for (let step = 0; step < 11; step += 1) {
      const candidate = (low + high) / 2;
      if (fitsOverviewFrustum(horizontal / candidate, vertical / candidate, distance)) low = candidate;
      else high = candidate;
    }
    zoom = low;
  }
  if (zoom === camera.zoom) return;
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
}

function fitsOverviewFrustum(horizontal, vertical, distance) {
  const { camera, rescueRigGrid, scratch } = galaxy;
  for (const [axis, slope] of [horizontal, vertical].entries()) {
    const limit = distance * slope / Math.hypot(1, slope);
    for (const sign of [-1, 1]) {
      const normal = overviewFitNormal.set(axis === 0 ? sign : 0, axis === 1 ? sign : 0, slope)
        .applyQuaternion(camera.quaternion).transformDirection(scratch.rigWorldInverse);
      for (const orbit of rescueRigGrid.tracks) {
        const reach = Math.hypot(normal.dot(orbit.axisX), normal.dot(orbit.axisY));
        if (reach + SERVICE_DEPTH_RADIUS.max > limit) return false;
      }
    }
  }
  return true;
}

function updateGalaxyCamera(elapsed, visual) {
  const formationMode = appState.threeDMode || appState.serviceRowMode;
  const target = galaxy.planets[ARCHETYPES[appState.archetype].focus]?.position;
  const overviewCenter = formationMode ? null : galaxy.star.getWorldPosition(galaxy.scratch.lookAt);
  const revealing = appState.revealUntil > elapsed;
  const revealBoost = revealing ? 1 : 0;
  const compact = window.innerWidth < 760;
  const trueMobile = window.innerWidth < QUALITY_CONFIG.trueMobileWidth;
  const desiredX = formationMode
    ? appState.pointer.x * 0.18
    : overviewCenter.x + (target?.x ?? 0) * (0.08 + revealBoost * 0.12) + appState.pointer.x * 0.55 + (compact ? 0 : 0.55);
  const desiredY = formationMode
    ? compact ? 6.15 : 5.75
    : overviewCenter.y + (trueMobile ? 6.4 : compact ? 6.8 : 7.0) + Math.abs(target?.y ?? 0) * 0.05 + appState.pointer.y * 0.22 - revealBoost * 0.85;
  const revealZoom = trueMobile ? 0.24 : compact ? 0.65 : 2.2;
  const desiredZ = formationMode
    ? compact ? 12.2 : 11.55
    : overviewCenter.z + (trueMobile ? 11.2 : compact ? 11.8 : 11.55) + (visual.opsShadow * 0.9) - revealBoost * revealZoom;
  if (appState.reducedMotion) {
    galaxy.camera.position.set(desiredX, desiredY, desiredZ);
  } else {
    galaxy.camera.position.x += (desiredX - galaxy.camera.position.x) * 0.035;
    galaxy.camera.position.y += (desiredY - galaxy.camera.position.y) * 0.025;
    galaxy.camera.position.z += (desiredZ - galaxy.camera.position.z) * 0.025;
  }
  if (formationMode) {
    galaxy.camera.lookAt(0, 1.1, 2.35);
  } else {
    galaxy.camera.lookAt(overviewCenter);
  }
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

function updatePlanets(elapsed, orbitElapsed, delta, visual) {
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

    const angle = config.angle + orbitElapsed * config.speed * (1 + visual.pressure * 0.36);
    const y = Math.sin(angle) * radius * Math.sin(inclination) * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * Math.cos(inclination);
    planet.position.set(x, y, z);

    const selected = appState.selectedPlanet === id || ARCHETYPES[appState.archetype].focus === id;
    const hovered = appState.hoveredPlanet === id;
    const active = selected || hovered;
    if (planet.userData.presentation) {
      const pulse = planet.userData.pulseUntil && planet.userData.pulseUntil > elapsed
        ? Math.sin((planet.userData.pulseUntil - elapsed) * 10) * 0.12
        : 0;
      const pressureScale = visual.pressure * (id === "backend" || id === "automation" ? 0.18 : 0.08);
      const scale = (active ? 1.42 : 1 + visual.benchGlow * (id === "firmware" ? 0.38 : 0)) + pressureScale + Math.max(pulse, 0);
      galaxy.scratch.scale.set(scale, scale, scale);
      planet.scale.lerp(galaxy.scratch.scale, 0.08);
      updateSpherePresentation(planet.userData.presentation, {
        delta,
        elapsed: orbitElapsed,
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
    }
  });
}

function updateBridges(elapsed, visual) {
  const showScenarioBridges = galaxy.layout === "planets" && Boolean(appState.simulation) && !sphereDive;
  const scratch = galaxy.scratch;
  galaxy.bridges.forEach(function (bridge) {
    bridge.visible = showScenarioBridges;
    if (!showScenarioBridges) return;
    const [a, b] = bridge.userData.pair;
    const source = galaxy.rescueRigObjects[a];
    const destination = galaxy.rescueRigObjects[b];
    const direction = scratch.portDirection.copy(destination.position).sub(source.position).normalize();
    const startRadius = source.userData.presentation.radius * source.scale.x;
    const endRadius = destination.userData.presentation.radius * destination.scale.x;
    const start = scratch.beamStart.copy(source.position).addScaledVector(direction, startRadius);
    const end = scratch.beamEnd.copy(destination.position).addScaledVector(direction, -endRadius);
    const control = scratch.beamMiddle.copy(start).lerp(end, 0.5);
    control.y += Math.min(start.distanceTo(end) * 0.12, 1.15);

    if ((a === "firmware" && b === "backend") || (a === "backend" && b === "ops")) {
      control.y += visual.handoffWarp * Math.sin(elapsed * 2.2) * 0.7;
      control.x += visual.handoffWarp * 0.45;
    }

    const automationFlow = a === "backend" && b === "automation" ? visual.automationDebris : 0;
    control.y += automationFlow * 0.9;
    const signalLoss = a === "hardware" && b === "data" ? visual.opsShadow : 0;
    const opacity = (0.044 + visual.completeness * 0.08 + visual.pressure * 0.04) * (1 - signalLoss * 0.36);
    const tint = visual.handoffWarp > 0.8 && a === "firmware" ? VISUAL_COLORS.soft : VISUAL_COLORS.accent;
    updateConnectionTube(bridge, start, end, control, tint, opacity, 0);
  });
}

function updateAnomalies(elapsed, delta, visual) {
  galaxy.shell.visible = appState.simulation === "ghost" && !sphereDive;
  if (galaxy.shell.visible) {
    galaxy.shell.material.opacity += (0.34 - galaxy.shell.material.opacity) * 0.08;
    galaxy.shell.rotation.y += delta * 0.6;
  } else {
    galaxy.shell.material.opacity = 0;
  }
  if (appState.simulation) {
    const pulse = 0.5 + Math.sin(elapsed * (9 + visual.pressure * 5)) * 0.5;
    galaxy.star.scale.setScalar(1 + pulse * 0.09);
  } else if (appState.revealUntil > galaxy.clock.elapsedTime) {
    const revealPulse = 0.5 + Math.sin(elapsed * 7) * 0.5;
    galaxy.star.scale.setScalar(1.05 + revealPulse * 0.08);
  } else {
    galaxy.scratch.scale.set(1, 1, 1);
    galaxy.star.scale.lerp(galaxy.scratch.scale, 0.08);
  }
}

function updateAutomationDebris(elapsed, visual) {
  const debris = galaxy.debris;
  debris.visible = appState.simulation === "automation" && !sphereDive;
  if (!debris.visible) return;
  const automation = galaxy.rescueRigObjects.automation;
  const shellRadius = automation.userData.presentation.radius * automation.scale.x;
  const opacity = Math.min(0.92, 0.55 + visual.automationDebris * 0.3);
  debris.position.copy(automation.position);
  for (const mesh of debris.children) {
    const { angle, radius, speed } = mesh.userData;
    const phase = angle + elapsed * speed;
    const distance = shellRadius * (0.65 + radius);
    mesh.position.set(Math.cos(phase) * distance, Math.sin(phase * 1.7) * shellRadius * 0.16,
      Math.sin(phase) * distance);
    mesh.material.opacity = opacity;
  }
}

function updateHandoffAnomaly(elapsed, delta, visual) {
  const anomaly = galaxy.blackHole;
  const visible = appState.simulation === "handoff" && !sphereDive;
  anomaly.visible = visible;
  if (visible) {
    const { firmware, backend } = galaxy.rescueRigObjects;
    anomaly.position.copy(firmware.position).lerp(backend.position, 0.5);
    anomaly.scale.setScalar(1 + visual.handoffWarp * 0.6);
    anomaly.rotation.z += delta * 60 * (0.025 + visual.handoffWarp * 0.04);
  }

  const strength = window.innerWidth < QUALITY_CONFIG.trueMobileWidth ? 0.18 : 1;
  const pulse = 0.5 + Math.sin(elapsed * (9 + visual.pressure * 5)) * 0.5;
  anomaly.material.opacity = visible ? (0.22 + 0.48 * pulse) * strength : 0;
  galaxy.accretionRings.forEach(function (ring, index) {
    ring.visible = visible;
    if (!visible) return;
    ring.position.copy(anomaly.position);
    ring.scale.setScalar(1 + visual.handoffWarp * (0.3 + index * 0.18));
    ring.rotation.z += delta * 60 * (0.018 + index * 0.012 + visual.handoffWarp * 0.02);
    ring.material.opacity = (0.2 - index * 0.04) * strength;
  });
}

function updateEnergyEffects(elapsed, delta, visual) {
  const intensity = 0.62 + visual.completeness * 0.52 + visual.pressure * 0.36;
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
      ring.visible = galaxy.layout === "planets";
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

function updateInteractionLayer(elapsed, delta, visual) {
  if (galaxy.ribbons) {
    const guideStrength = appState.activeScenario || appState.simulation ? 1 : 0.38;
    galaxy.ribbons.children.forEach(function (ribbon, index) {
      ribbon.rotation.z += ribbon.userData.speed * delta * 60 * (1 + visual.pressure * 0.45);
      ribbon.material.opacity += ((ribbon.userData.baseOpacity + visual.completeness * 0.04) * guideStrength - ribbon.material.opacity) * 0.04;
      ribbon.position.y = Math.sin(elapsed * 0.32 + index) * 0.03;
    });
  }

  const { focusHalo, focusBeam } = galaxy;
  const focusId = appState.hoveredPlanet || appState.selectedPlanet || ARCHETYPES[appState.archetype].focus;
  const targetPlanet = galaxy.rescueRigObjects[focusId];
  focusHalo.visible = Boolean(targetPlanet?.visible && !sphereDive);
  focusBeam.visible = false;
  if (!focusHalo.visible) return;

  const radius = targetPlanet.userData.presentation.radius * targetPlanet.scale.x;
  const color = PLANETS[focusId].color;
  const pulseLeft = Math.max(0, appState.focusPulseUntil - galaxy.clock.elapsedTime);
  const pulse = !appState.reducedMotion && pulseLeft ? Math.sin(pulseLeft * 9) * 0.18 + 0.22 : 0;
  focusHalo.position.copy(targetPlanet.position);
  focusHalo.scale.setScalar(radius * 1.06);
  focusHalo.lookAt(galaxy.camera.position);
  focusHalo.material.color.setHex(color);
  focusHalo.material.opacity = 0.42 + pulse;

  focusBeam.visible = galaxy.layout === "planets" && Boolean(pulseLeft || appState.simulation);
  if (!focusBeam.visible) return;
  const end = galaxy.scratch.beamEnd.copy(targetPlanet.position);
  end.setLength(Math.max(0, end.length() - radius));
  const position = focusBeam.geometry.getAttribute("position");
  position.setXYZ(1, end.x, end.y, end.z);
  position.needsUpdate = true;
  focusBeam.material.color.setHex(color);
}

function updateRescueRig(orbitElapsed, delta, visual) {
  if (!galaxy.rescueRig) return;
  const compact = window.innerWidth < 760;
  const motionFactor = appState.reducedMotion ? 0 : 1;
  const elapsed = orbitElapsed * motionFactor;
  const activeFocus = appState.hoveredPlanet || appState.selectedPlanet || ARCHETYPES[appState.archetype].focus;
  const completeBoost = visual.completeness;
  const threeDModeDimming = appState.threeDMode ? 0.26 : 1;
  const targetScale = getOverviewRigScale();
  galaxy.scratch.scale.set(targetScale, targetScale, targetScale);
  if (appState.reducedMotion) galaxy.rescueRig.scale.copy(galaxy.scratch.scale);
  else galaxy.rescueRig.scale.lerp(galaxy.scratch.scale, 0.06);
  // Tilt the whole orbital system together while the background turns independently.
  const { pitch, yaw } = galaxy.orbitView;
  const view = galaxy.scratch.orbitViewRotation.setFromEuler(galaxy.scratch.orbitViewEuler.set(pitch, yaw, 0));
  const { baseView } = galaxy.overviewLayouts[galaxy.layout];
  galaxy.rescueRig.quaternion.copy(galaxy.root.quaternion).invert().multiply(baseView).multiply(view);
  galaxy.rescueRig.position.copy(galaxy.star.position);
  galaxy.rescueRig.updateWorldMatrix(true, false);
  galaxy.scratch.rigWorldInverse.copy(galaxy.rescueRig.matrixWorld).invert();
  galaxy.camera.getWorldDirection(serviceViewDirection)
    .transformDirection(galaxy.scratch.rigWorldInverse).negate();

  if (galaxy.rescueRigGrid) {
    updateServiceSpatialGrid(galaxy.rescueRigGrid, {
      activeId: activeFocus,
      opacityScale: threeDModeDimming,
      compact
    });
  }

  const gridScale = galaxy.rescueRigGrid.scale;
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
    sampleServiceGridPosition(
      galaxy.rescueRigGrid,
      id,
      orbitElapsed,
      object.position,
      { scale: gridScale }
    );
    if (!sphereDive) {
      // Measure depth from Core toward the camera in unscaled orbit units.
      const depth = object.position.dot(serviceViewDirection) / gridScale;
      const radius = THREE.MathUtils.clamp(
        SERVICE_DEPTH_RADIUS.base + depth * SERVICE_DEPTH_RADIUS.gain,
        SERVICE_DEPTH_RADIUS.min,
        SERVICE_DEPTH_RADIUS.max
      );
      const { bodyScale } = galaxy.rescueRigGrid.assignments.get(id);
      const maxScale = MAX_SERVICE_ORBIT_SCALE * bodyScale;
      object.scale.setScalar(gridScale * Math.min(radius / presentation.radius, maxScale));
    }
    poseObject.rotation.y = object.userData.baseRotation.y
      + Math.sin(elapsed * 0.72 + index) * 0.065 * motionFactor
      + (selected ? appState.pointer.x * 0.08 * motionFactor : 0);
    poseObject.rotation.x = object.userData.baseRotation.x
      + Math.sin(elapsed * 0.5 + index * 0.7) * 0.025 * motionFactor;
    poseObject.rotation.z = object.userData.baseRotation.z;
    if (id === "pqc") {
      // The bridge rolls around its own axis, while its outlet stays on the core-facing side.
      poseObject.rotation.z = Math.atan2(-object.position.y, -object.position.x);
    }
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
    const port = presentation?.feedthroughs[0]?.mount ?? semanticModel.userData.pqc?.outlet;
    if (port) {
      // Keep actual connectors facing Core through each inclined orbit.
      const direction = port.getWorldPosition(galaxy.scratch.portDirection)
        .applyMatrix4(galaxy.scratch.rigWorldInverse).sub(object.position).normalize();
      const inward = galaxy.scratch.portInward.copy(object.position).negate().normalize();
      poseObject.quaternion.premultiply(galaxy.scratch.portAlignment.setFromUnitVectors(direction, inward));
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

  updateRescueRigCables(orbitElapsed, visual, activeFocus, threeDModeDimming, motionFactor);
}

function updateRescueRigCables(orbitElapsed, visual, activeFocus, opacityScale, motionFactor) {
  const elapsed = orbitElapsed * motionFactor;
  const coreRadius = galaxy.star.geometry.parameters.radius * galaxy.star.scale.x / galaxy.rescueRig.scale.x;
  const scratch = galaxy.scratch;
  const showCoreFlows = galaxy.layout === "planets";

  galaxy.rescueRigCables.forEach(function (cable, index) {
    cable.visible = showCoreFlows;
    const serviceId = cable.userData.serviceId;
    const service = galaxy.rescueRigObjects[serviceId];
    const pqcModel = serviceId === "pqc" ? service.userData.semanticModel : null;
    // The packet inside the PQC model stays active when its external cable is hidden.
    const packetHead = pqcModel ? updatePqcSignal(pqcModel, elapsed, appState.reducedMotion) : undefined;
    const active = serviceId === activeFocus;
    const targetOpacity = (active ? 0.96 : 0.79 + visual.completeness * 0.12) * opacityScale;
    cable.userData.opacity += (targetOpacity - cable.userData.opacity) * 0.08;
    if (!showCoreFlows && !SCENE_DEBUG.enabled) return;

    const direction = scratch.portDirection.copy(service.position).normalize();
    const corePort = scratch.beamStart.copy(direction).multiplyScalar(coreRadius * 0.98);
    const presentation = service.userData.presentation;
    const outlet = pqcModel?.userData.pqc.outlet ?? presentation.feedthroughs[0]?.outlet;
    const servicePort = outlet
      ? outlet.getWorldPosition(scratch.beamEnd).applyMatrix4(scratch.rigWorldInverse)
      : scratch.beamEnd.copy(service.position).addScaledVector(direction, -presentation.radius * service.scale.x);
    const start = pqcModel ? servicePort : corePort;
    const end = pqcModel ? corePort : servicePort;
    const bend = Math.min(start.distanceTo(end) * 0.24, 0.38);
    const control = scratch.beamMiddle.copy(start).lerp(end, 0.5);
    control.z += bend * (0.85 + Math.sin(elapsed * 1.2 + index) * 0.17 * motionFactor);
    sampleServiceGridTangent(
      galaxy.rescueRigGrid,
      serviceId,
      orbitElapsed,
      scratch.orbitTangent
    );
    control.addScaledVector(scratch.orbitTangent, bend * 1.12);
    bendConnectionAroundPlanets(start, end, control, cable.userData.innerPlanets, scratch.orbitTangent);
    const tint = PLANETS[serviceId].color;
    const flowTime = elapsed + index * 0.19;
    updateConnectionTube(cable, start, end, control, tint, cable.userData.opacity, flowTime, packetHead, appState.reducedMotion);
  });
}

function bendConnectionAroundPlanets(start, end, control, innerPlanets, fallbackDirection) {
  for (let pass = 0; pass < 3; pass += 1) {
    let adjusted = false;
    for (const planet of innerPlanets) {
      const center = planet.position;
      const clearance = planet.userData.presentation.radius * planet.scale.x + 0.23;
      let nearestSquared = clearance * clearance;
      let influence = 0;
      let nearestX, nearestY, nearestZ;

      for (let step = 1; step < 40; step += 1) {
        const t = step / 40;
        const a = (1 - t) ** 2;
        const b = 2 * t * (1 - t);
        const c = t ** 2;
        const x = a * start.x + b * control.x + c * end.x - center.x;
        const y = a * start.y + b * control.y + c * end.y - center.y;
        const z = a * start.z + b * control.z + c * end.z - center.z;
        const distanceSquared = x * x + y * y + z * z;
        if (distanceSquared >= nearestSquared) continue;
        nearestSquared = distanceSquared;
        influence = b;
        nearestX = x;
        nearestY = y;
        nearestZ = z;
      }

      if (!influence) continue;
      // Push away from the actual 3D sphere. A projected crossing can stay in place.
      const distance = Math.sqrt(nearestSquared);
      const offset = (clearance - distance) / influence;
      if (distance > 1e-6) {
        const scale = offset / distance;
        control.x += nearestX * scale;
        control.y += nearestY * scale;
        control.z += nearestZ * scale;
      } else {
        control.addScaledVector(fallbackDirection, offset);
      }
      adjusted = true;
    }
    if (!adjusted) return;
  }
}

function updateFormationSlots() {
  if (formationOrbit.mode === "service-row") {
    updateServiceRowSlots();
    return;
  }
  const { camera, renderer } = galaxy;
  const { x: width, y: height } = renderer.getSize(quizCanvasSize);
  const unitsPerPixel = 2 * FORMATION_DEPTH / (camera.projectionMatrix.elements[5] * height);
  const frameScale = Math.min(width / (width < 700 ? 7.6 : 9.2), height / 7.3, 105) * unitsPerPixel;
  camera.localToWorld(galaxy.answerDeck.position.set(0, 0, -FORMATION_DEPTH));

  for (const id of PLANET_IDS) {
    const slot = formationSlots.get(id);
    const centered = id === quizCenterService;
    const angle = Math.PI / 2 - quizRingServices.indexOf(id) * Math.PI / 3;
    slot.position.set(
      centered ? 0 : Math.cos(angle) * QUIZ_RING_RADIUS,
      centered ? 0 : Math.sin(angle) * QUIZ_RING_RADIUS,
      0
    ).multiplyScalar(frameScale).applyQuaternion(camera.quaternion);
    slot.scale.setScalar(frameScale * 0.88);
  }
}

function updateServiceRowSlots() {
  const { camera, renderer, rescueRigObjects } = galaxy;
  const bounds = renderer.domElement.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const unitsPerPixel = 2 * FORMATION_DEPTH / (camera.projectionMatrix.elements[5] * bounds.height);
  camera.localToWorld(galaxy.answerDeck.position.set(0, 0, -FORMATION_DEPTH));

  for (const [id, orb] of serviceRowOrbs) {
    const { left, top, width, height } = orb.getBoundingClientRect();
    const slot = formationSlots.get(id);
    slot.position.set(
      (left + width / 2 - bounds.left - bounds.width / 2) * unitsPerPixel,
      (bounds.top + bounds.height / 2 - top - height / 2) * unitsPerPixel,
      0
    ).applyQuaternion(camera.quaternion);
    slot.quaternion.copy(camera.quaternion);
    const radius = rescueRigObjects[id].userData.presentation.radius;
    slot.scale.setScalar(Math.min(width, height) * unitsPerPixel * 0.46 / radius);
  }
}

// ---------- Cinematic helpers ----------

export function runWhatIfSimulation(type) {
  window.clearTimeout(simulationTimer);
  appState.simulation = type || "handoff";
  const insight = document.getElementById("live-insight");
  if (insight) {
    insight.textContent = "Adding motion layer: " + appState.simulation + ". Watch the map settle into a stronger constellation.";
  }
  simulationTimer = window.setTimeout(function () {
    appState.simulation = null;
    simulationTimer = null;
  }, appState.reducedMotion ? 800 : 4200);
}
