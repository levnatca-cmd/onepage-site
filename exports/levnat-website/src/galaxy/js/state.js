// Mutable app + galaxy state. Both are exported as singletons that the rest of
// the modules read and mutate directly — keeps the imperative Three.js flow simple.

import * as THREE from "../../../vendor/three/three.module.min.js";

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function syncReducedMotionClass(reduced) {
  document.documentElement.classList.toggle("is-reduced-motion", reduced);
}

syncReducedMotionClass(reducedMotionQuery.matches);

export const appState = {
  selectedPlanet: "firmware",
  hoveredPlanet: null,
  answers: {},
  archetype: "handoff",
  reducedMotion: reducedMotionQuery.matches,
  simulation: null,
  activeScenario: null,
  scaleStage: 0,
  revealUntil: 0,
  webglReady: false,
  threeDMode: false,
  activeQuestionIndex: 0,
  hoveredChoice: null,
  hoveredBack: false,
  selectedChoice: null,
  choiceAdvanceTimer: null,
  launchTimer: null,
  choicePulseUntil: 0,
  focusPulseUntil: 0,
  backPortalPulseUntil: 0,
  lastAnswerCount: 0,
  hasCelebratedCompletion: false,
  galaxyState: null,
  pointer: { x: 0, y: 0 },
  lastPointerFocus: 0
};

if (typeof reducedMotionQuery.addEventListener === "function") {
  reducedMotionQuery.addEventListener("change", function (event) {
    appState.reducedMotion = event.matches;
    syncReducedMotionClass(event.matches);
  });
}

export const galaxy = {
  scene: null,
  camera: null,
  renderer: null,
  root: null,
  star: null,
  shell: null,
  blackHole: null,
  accretionRings: [],
  vectorField: null,
  vectorFieldBase: null,
  ribbons: null,
  focusHalo: null,
  focusHaloRings: [],
  focusBeam: null,
  rescueRig: null,
  rescueRigCore: null,
  rescueRigObjects: {},
  rescueRigCables: [],
  rescueRigSignals: [],
  orbitTicks: [],
  starRings: null,
  starHalo: null,
  energyArcs: null,
  shockwaves: [],
  heroShowcase: null,
  heroShowcaseParts: [],
  planetMeshes: [],
  planets: {},
  orbits: {},
  answerDeck: null,
  answerModels: [],
  answerMeshes: [],
  backPortal: null,
  backPortalMeshes: [],
  choiceBeams: [],
  bridges: [],
  particles: [],
  debris: null,
  raycaster: new THREE.Raycaster(),
  pointerVector: new THREE.Vector2(10, 10),
  hitBuffer: [],
  scratch: {
    modelPosition: new THREE.Vector3(),
    modelScale: new THREE.Vector3(),
    labelScale: new THREE.Vector3(),
    detailScale: new THREE.Vector3(),
    beamStart: new THREE.Vector3(),
    beamEnd: new THREE.Vector3(),
    beamMiddle: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    screenPosition: new THREE.Vector3()
  },
  clock: new THREE.Clock()
};
