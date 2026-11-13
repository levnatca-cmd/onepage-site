import * as THREE from "../../vendor/three/three.module.min.js";
import { PLANETS } from "../../src/galaxy/js/data/quiz-data.js?v=wow60";
import { SYSTEM_PRESENTATIONS } from "../../src/galaxy/js/data/scene-presentations.js?v=wow60";
import { buildSystemModel } from "../../src/galaxy/js/scene/system-models/index.js?v=wow60";
import { updatePqcSignal } from "../../src/galaxy/js/scene/system-models/pqc.js?v=wow60";
import { createSpherePresentation, fitModelIntoSphere, updateSpherePresentation } from "../../src/galaxy/js/scene/sphere-kit.js?v=wow60";
import { updateModelSignalPackets } from "../../src/galaxy/js/scene/system-models/signal-packets.js?v=wow60";
import { modelParts } from "./parts.js?v=wow60";

const references = {
  firmware: "02-interface-app.png",
  backend: "03-backend-api.png",
  automation: "04-automation.png",
  data: "05-data-logs.png",
  hardware: "06-hardware.png",
  ops: "07-monitoring.png",
  pqc: "08-post-quantum-security.png"
};

// Start each model at the elevation and apparent sphere size of its concept plate.
const reviewViews = {
  firmware: { height: 0.48, depth: 4.32 },
  backend: { height: 1.55, depth: 4.25 },
  automation: { height: 0.28, depth: 4.49 },
  data: { height: 0.28, depth: 4.52 },
  hardware: { height: 0.52, depth: 4.54, angle: 17, frameOffset: [0.008, 0.05] },
  ops: { height: 0.28, depth: 4.65, roll: -0.07 },
  pqc: { height: 0.28, depth: 4.48, angle: 18 }
};

const service = document.querySelector("#service");
const part = document.querySelector("#part");
const angle = document.querySelector("#angle");
const animate = document.querySelector("#animate");
const signalControl = document.querySelector("#signals-control");
const signals = document.querySelector("#signals");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const reference = document.querySelector("#reference");
const canvas = document.querySelector("#preview");
const frame = document.querySelector("#render-frame");
const status = document.querySelector("#render-status");
const caption = document.querySelector("#live-caption");
const comparison = document.querySelector(".comparison");
const query = new URLSearchParams(location.search);
const requested = query.get("service");
for (const id of Object.keys(references)) service.add(new Option(PLANETS[id].label, id));
service.value = Object.hasOwn(references, requested) ? requested : "firmware";
signals.checked = !motionPreference.matches;

function updateParts(requestedPart = "") {
  const choices = modelParts[service.value];
  part.replaceChildren(new Option("Assembled sphere", ""));
  for (const [id, label] of Object.entries(choices)) part.add(new Option(label, id));
  part.value = Object.hasOwn(choices, requestedPart) ? requestedPart : "";
}

function updateReference() {
  reference.src = `../../assets/concepts/system-galaxy/${references[service.value]}`;
  reference.alt = `${PLANETS[service.value].label} concept reference`;
  comparison.dataset.mode = part.value ? "part" : "assembly";
  caption.textContent = part.value ? part.selectedOptions[0].textContent : "Live Three.js model";
  canvas.setAttribute("aria-label", `${PLANETS[service.value].label} · ${caption.textContent}`);
}

updateParts(query.get("part"));
updateReference();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  canvas.hidden = true;
  status.textContent = "WebGL is unavailable.";
  status.hidden = false;
  angle.disabled = true;
  animate.disabled = true;
  signals.disabled = true;
  part.disabled = true;
  service.addEventListener("change", () => {
    updateParts();
    updateReference();
  });
}

if (renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x021218);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 0.28, 4.2);
  camera.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight(0xe8f9ff, 2);
  key.position.set(-3, 4, 5);
  scene.add(key, new THREE.HemisphereLight(0xc0eaff, 0x384e5e, 1.3));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;

  const presentations = new Map();
  let current;
  let elapsed = 0;
  let signalElapsed = 0;
  let previousRotationTime = null;
  let previousSignalTime = null;
  let animationFrame = 0;
  let inView = true;
  let needsProjection = true;
  let frameWidth = 0;
  let frameHeight = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 0;

  function signalsOn() {
    return current?.hasSignals && signals.checked;
  }

  function render(delta, signalMoving) {
    if (!current) return;
    const turn = Number(angle.value) * Math.PI / 180 + elapsed * 0.33;
    current.posePivot.rotation.y = turn;
    if (current.part) {
      updateModelSignalPackets(current.modelSignals, signalElapsed, !signalMoving);
    } else {
      updateSpherePresentation(current, {
        delta,
        elapsed,
        selected: true,
        reducedMotion: !animate.checked,
        signalElapsed,
        signalReducedMotion: !signalMoving
      });
    }
    if (current.model.userData.pqc?.raw) updatePqcSignal(current.model, signalElapsed, !signalMoving);
    renderer.render(scene, camera);
    const { calls, triangles } = renderer.info.render;
    if (Number(canvas.dataset.calls) !== calls) canvas.dataset.calls = calls;
    if (Number(canvas.dataset.triangles) !== triangles) canvas.dataset.triangles = triangles;
    if (canvas.dataset.service !== current.id) canvas.dataset.service = current.id;
    if (canvas.dataset.part !== current.part) canvas.dataset.part = current.part;
  }

  function createPartPresentation(id, selectedPart, model, config) {
    fitModelIntoSphere(model, 0.96);
    const posePivot = new THREE.Group();
    const spin = new THREE.Group();
    spin.quaternion.setFromAxisAngle(new THREE.Vector3(...config.spinAxis).normalize(), config.staticAngle);
    spin.add(model);
    posePivot.add(spin);
    posePivot.rotation.x = config.tiltX ?? 0;
    const modelSignals = model.userData.modelSignals ? [model.userData.modelSignals] : [];
    return { id, part: selectedPart, root: posePivot, posePivot, model, modelSignals };
  }

  function selectView() {
    updateReference();
    const id = service.value;
    const selectedPart = part.value;
    const url = new URL(location.href);
    url.searchParams.set("service", id);
    if (selectedPart) url.searchParams.set("part", selectedPart);
    else url.searchParams.delete("part");
    history.replaceState(null, "", url);
    if (current) {
      scene.remove(current.root);
      if (current.part) {
        current.model.traverse((object) => {
          object.geometry?.dispose();
          object.material?.dispose();
        });
      }
    }
    if (selectedPart || !presentations.has(id)) {
      const { color } = PLANETS[id];
      const config = SYSTEM_PRESENTATIONS[id];
      const { root: model } = buildSystemModel(id, color, { THREE, part: selectedPart || undefined });
      if (selectedPart) {
        current = createPartPresentation(id, selectedPart, model, config);
      } else {
        presentations.set(id, createSpherePresentation({ id, color, model, config, radius: 1 }));
      }
    }
    if (!selectedPart) {
      current = presentations.get(id);
      current.part = "";
    }
    current.hasSignals = Boolean(current.modelSignals.length || current.model.userData.pqc?.raw);
    signalControl.hidden = !current.hasSignals;
    scene.add(current.root);
    elapsed = 0;
    signalElapsed = 0;
    resetMotionClocks();
    const { height, depth, roll = 0, angle: openingAngle = 0 } = reviewViews[id];
    camera.position.set(0, height, depth);
    camera.lookAt(0, 0, 0);
    current.posePivot.rotation.z = roll;
    angle.value = String(openingAngle);
    needsProjection = true;
    requestRender();
  }

  function measureFrame() {
    const { width, height } = frame.getBoundingClientRect();
    if (width === frameWidth && height === frameHeight) return;
    frameWidth = width;
    frameHeight = height;
    requestRender();
  }

  function updateSize(moving) {
    const width = frameWidth;
    const height = frameHeight;
    if (!width || !height) return false;
    const ratio = Math.min(devicePixelRatio, moving ? 1 : 1.5);
    const resized = canvasWidth !== width || canvasHeight !== height;
    if (resized || ratio !== pixelRatio) {
      renderer.setDrawingBufferSize(width, height, ratio);
      canvasWidth = width;
      canvasHeight = height;
      pixelRatio = ratio;
    }
    if (resized || needsProjection) {
      const offset = !current.part && reviewViews[current.id].frameOffset;
      camera.aspect = width / height;
      if (offset) camera.setViewOffset(width, height, width * offset[0], height * offset[1], width, height);
      else camera.clearViewOffset();
      needsProjection = false;
    }
    return true;
  }

  function requestRender() {
    if (!animationFrame) animationFrame = requestAnimationFrame(drawFrame);
  }

  function drawFrame(now) {
    animationFrame = 0;
    const visible = inView && !document.hidden;
    const signalMoving = signalsOn();
    const rotating = animate.checked && visible;
    const signaling = signalMoving && visible;
    const moving = rotating || signaling;
    const delta = rotating && previousRotationTime !== null ? (now - previousRotationTime) / 1000 : 0;
    if (signaling && previousSignalTime !== null) signalElapsed += (now - previousSignalTime) / 1000;
    previousRotationTime = rotating ? now : null;
    previousSignalTime = signaling ? now : null;
    elapsed += delta;
    if (current && updateSize(moving)) render(delta, signalMoving);
    if (moving) requestRender();
  }

  function resetMotionClocks() {
    previousRotationTime = null;
    previousSignalTime = null;
  }

  new ResizeObserver(measureFrame).observe(frame);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    resetMotionClocks();
    if (animate.checked || signalsOn()) requestRender();
  }).observe(frame);
  document.addEventListener("visibilitychange", () => {
    resetMotionClocks();
    if (!document.hidden && (animate.checked || signalsOn())) requestRender();
  });
  service.addEventListener("change", () => {
    updateParts();
    selectView();
  });
  part.addEventListener("change", selectView);
  angle.addEventListener("input", requestRender);
  animate.addEventListener("change", () => {
    previousRotationTime = null;
    if (!animate.checked) {
      const degrees = Number(angle.value) + elapsed * 0.33 * 180 / Math.PI;
      angle.value = String(THREE.MathUtils.euclideanModulo(degrees + 180, 360) - 180);
      elapsed = 0;
    }
    requestRender();
  });
  function refreshSignals() {
    previousSignalTime = null;
    if (current?.hasSignals) requestRender();
  }
  signals.addEventListener("change", refreshSignals);
  motionPreference.addEventListener("change", () => {
    signals.checked = !motionPreference.matches;
    refreshSignals();
  });
  measureFrame();
  selectView();
}
