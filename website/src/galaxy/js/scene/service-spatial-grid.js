import * as THREE from "../../../../vendor/three/three.module.min.js";

export const SERVICE_GRID_CAPACITY = 7;
export const MAX_SERVICE_ORBIT_SCALE = 1.2;

const DEFAULT_ORBIT_SPEED = 0.18;
const DEFAULT_COMPACT_SCALE = 0.86;
const GRID_SEGMENTS = 128;
const ORBIT_SPEED_DIVISOR = 6;
// The major axes turn by sixty degrees in the opening view. The minor axes
// tilt into depth, so the three projected ellipses belong to actual 3D planes.
const ATOM_TRACKS = [
  { slots: [0, 5], radius: 4.1, angle: 0, inclination: 1.11, speedUnits: 9, phase: 5.005, bodyScale: 0.82 },
  { slots: [1, 4], radius: 5, angle: Math.PI / 3, inclination: 1.11, speedUnits: 6, phase: 3.959, bodyScale: 0.85 },
  { slots: [2, 3, 6], radius: 5.9, angle: -Math.PI / 3, inclination: -1.11, speedUnits: 4, phase: 5.358, bodyScale: 0.90 }
];
const PLANET_TRACKS = [
  { slots: [0, 5], radius: 1.93, tilt: 0.38, heading: 0.10, speedUnits: 9, phase: 0.31, bodyScale: 0.82 },
  { slots: [1, 4], radius: 3.72, tilt: -0.15, heading: -0.24, speedUnits: 6, phase: 1.59, bodyScale: 0.85 },
  { slots: [2, 3, 6], radius: 5.55, tilt: 0.30, heading: 0.13, speedUnits: 4, phase: 2.08, bodyScale: 0.90 }
];
const ORBIT_LAYOUTS = {
  atom: { tracks: ATOM_TRACKS, activeOpacity: 0.52, idleOpacity: 0.39 },
  planets: { tracks: PLANET_TRACKS, activeOpacity: 0.45, idleOpacity: 0.33 }
};

export function createServiceSpatialGrid({
  serviceIds,
  colors = {},
  capacity = SERVICE_GRID_CAPACITY,
  orbitSpeed = DEFAULT_ORBIT_SPEED,
  phaseOffset = Math.PI,
  compactScale = DEFAULT_COMPACT_SCALE,
  layout = "atom"
}) {
  if (!Array.isArray(serviceIds) || !serviceIds.length) {
    throw new Error("Service spatial grid requires at least one service id");
  }
  if (!Number.isInteger(capacity) || capacity < serviceIds.length) {
    throw new Error("Service spatial grid capacity cannot be smaller than its service count");
  }
  if (!Object.hasOwn(ORBIT_LAYOUTS, layout)) {
    throw new Error("Unknown service spatial-grid layout: " + layout);
  }

  const { tracks: definitions } = ORBIT_LAYOUTS[layout];
  const root = new THREE.Group();
  root.name = "service-spatial-grid";
  root.userData.serviceSpatialGrid = true;
  const baseSpeed = orbitSpeed / ORBIT_SPEED_DIVISOR;
  const assignments = new Map();
  const serviceBySlot = new Map(spreadSlotIndices(serviceIds.length, capacity)
    .map((slot, index) => [slot, serviceIds[index]]));
  const tracks = definitions.map((definition, trackIndex) => {
    const { radius, speedUnits, phase, bodyScale } = definition;
    const [axisX, axisY] = createOrbitAxes(definition, layout);
    const orbit = {
      radius,
      speed: baseSpeed * speedUnits,
      axisX,
      axisY,
      serviceIds: []
    };
    const slots = definition.slots.filter((slot) => slot < capacity);
    if (trackIndex === definitions.length - 1) {
      for (let slot = SERVICE_GRID_CAPACITY; slot < capacity; slot += 1) slots.push(slot);
    }
    slots.forEach((slotIndex, index) => {
      const serviceId = serviceBySlot.get(slotIndex);
      if (!serviceId) return;
      orbit.serviceIds.push(serviceId);
      assignments.set(serviceId, {
        slotIndex, orbit, bodyScale,
        phase: phase + phaseOffset - Math.PI - index * Math.PI * 2 / slots.length
      });
    });
    const path = createOrbitPath(orbit, colors[orbit.serviceIds[0]] ?? 0x5de7ff);
    path.name = `service-orbit-${trackIndex + 1}`;
    root.add(path);
    orbit.path = path;
    return orbit;
  });
  const cycleDuration = Math.PI * 2 / Math.abs(baseSpeed);
  return { root, tracks, assignments, capacity, orbitSpeed, cycleDuration, compactScale, scale: 1, layout };
}

export function sampleServiceGridPosition(grid, serviceId, elapsed, target, options = {}) {
  const lane = grid.assignments.get(serviceId);
  if (!lane) throw new Error("Unknown service spatial-grid assignment: " + serviceId);
  const scale = Number.isFinite(options.scale) ? options.scale : options.compact ? grid.compactScale : 1;
  const motionTime = options.reducedMotion ? 0 : elapsed;
  return writeOrbitPosition(lane.orbit, lane.phase + motionTime * lane.orbit.speed, target).multiplyScalar(scale);
}

export function sampleServiceGridTangent(grid, serviceId, elapsed, target, options = {}) {
  const lane = grid.assignments.get(serviceId);
  if (!lane) throw new Error("Unknown service spatial-grid assignment: " + serviceId);
  const motionTime = options.reducedMotion ? 0 : elapsed;
  return writeOrbitPosition(lane.orbit, lane.phase + motionTime * lane.orbit.speed + Math.PI / 2, target).normalize();
}

export function updateServiceSpatialGrid(grid, { activeId = null, opacityScale = 1, compact = false }) {
  const targetScale = compact ? grid.compactScale : 1;
  grid.scale += (targetScale - grid.scale) * 0.08;
  grid.root.scale.setScalar(grid.scale);

  const { activeOpacity, idleOpacity } = ORBIT_LAYOUTS[grid.layout];
  for (const { path, serviceIds } of grid.tracks) {
    const opacity = (serviceIds.includes(activeId) ? activeOpacity : idleOpacity) * opacityScale;
    const alpha = path.material.uniforms.uOpacity;
    alpha.value += (opacity - alpha.value) * 0.1;
  }
}

export function getServiceGridMinimumSeparation(grid, serviceIds, elapsed, options = {}) {
  const points = serviceIds.map((serviceId) =>
    sampleServiceGridPosition(grid, serviceId, elapsed, new THREE.Vector3(), options)
  );
  let minimum = Infinity;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      minimum = Math.min(minimum, points[first].distanceTo(points[second]));
    }
  }
  return minimum;
}

function spreadSlotIndices(count, capacity) {
  if (count === 1) return [Math.floor(capacity / 2)];
  return Array.from({ length: count }, (_, index) => Math.round(index * (capacity - 1) / (count - 1)));
}

function createOrbitAxes({ radius, angle, inclination, heading, tilt }, layout) {
  if (layout === "planets") {
    const orientation = new THREE.Euler(tilt, heading, 0, "YXZ");
    return [
      new THREE.Vector3(radius, 0, 0).applyEuler(orientation),
      new THREE.Vector3(0, radius, 0).applyEuler(orientation)
    ];
  }

  const x = Math.cos(angle);
  const y = Math.sin(angle);
  const projectedMinor = Math.cos(inclination);
  return [
    new THREE.Vector3(x, y, 0).multiplyScalar(radius),
    new THREE.Vector3(-y * projectedMinor, x * projectedMinor, Math.sin(inclination)).multiplyScalar(radius)
  ];
}

function writeOrbitPosition(orbit, angle, target) {
  return target.copy(orbit.axisX).multiplyScalar(Math.cos(angle)).addScaledVector(orbit.axisY, Math.sin(angle));
}

function createOrbitPath(orbit, color) {
  const points = Array.from({ length: GRID_SEGMENTS }, (_, index) =>
    writeOrbitPosition(orbit, index / GRID_SEGMENTS * Math.PI * 2, new THREE.Vector3())
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(color) },
      uRadius: { value: orbit.radius },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      uniform float uRadius;
      varying float vDepth;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        float radius = uRadius * length(modelViewMatrix[0].xyz);
        vDepth = (view.z - modelViewMatrix[3].z) / radius;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uOpacity;
      varying float vDepth;
      void main() {
        float front = smoothstep(-0.80, 0.78, vDepth);
        gl_FragColor = vec4(uTint, uOpacity * mix(0.35, 1.0, front));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 4;
  return line;
}
