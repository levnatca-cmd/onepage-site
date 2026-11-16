import { createHologram, HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "./hologram.js?v=wow60";
import { addModelSignalPackets } from "./signal-packets.js?v=wow60";

const TRACK_CYAN = 0x26dafa;
const TRACK_AMBER = 0xffad40;
const DETAIL_OPACITY = 0.17;
const STEPS_PER_KNOT = 6;

export function buildAutomationModel(_color, { THREE, part }) {
  const root = new THREE.Group();
  root.name = "automation-model";
  const h = createHologram(root);
  const includes = (id) => !part || part === id;
  const hubY = 0.108;
  const left = [-0.81, 0.28, 0.11];
  const right = [0.81, 0.28, 0.13];
  const top = [0, 0.82, -0.07];
  const lowerLeft = [-0.65, -0.40, 0.22];
  const lowerRight = [0.50, -0.53, 0.25];
  const queue = [-0.09, -0.59, 0.37];
  const layout = { hubY, left, right, top, lowerLeft, lowerRight, queue };
  const mechanicalParts = [];

  if (includes("ribbons")) addWorkflowRibbons(THREE, root, h, layout);
  if (includes("checkpoints")) {
    const checkpoints = [
      [top, TRACK_AMBER], [left, TRACK_CYAN], [right, TRACK_CYAN],
      [lowerLeft, TRACK_AMBER], [lowerRight, TRACK_CYAN]
    ];
    addCheckpoints(THREE, root, h, checkpoints);
  }
  if (includes("queue")) addWorkflowQueue(h, queue);
  if (includes("hub")) mechanicalParts.push(addWorkflowHub(THREE, root, h, hubY));
  h.finish();

  return { root, mechanicalParts, semanticRole: "automation" };
}

function addWorkflowRibbons(THREE, root, h, { hubY, left, right, top, lowerLeft, lowerRight, queue }) {
  // Knots carry both the transverse roll of the ribbon and its cyan-to-amber mix.
  const lanes = [
    {
      name: "workflow-ribbon-crown",
      closed: true,
      width: 0.114,
      knots: [
        [[-0.10, hubY, -0.14], -0.65, 0], [[-0.37, 0.19, -0.24], -0.53, 0],
        [[-0.43, 0.42, -0.18], -0.30, 0.18], [[-0.29, 0.66, -0.10], 0.35, 1],
        [top, 0.76, 1], [[0.29, 0.65, -0.10], 0.70, 0.08],
        [[0.43, 0.42, -0.12], 0.46, 1], [[0.42, 0.19, -0.14], 0.23, 1],
        [[0.20, hubY, -0.13], -0.38, 0.75]
      ],
      arrows: [3.08, 5.92]
    },
    {
      name: "workflow-ribbon-return",
      width: 0.122,
      knots: [
        [right, -0.40, 1], [[0.96, 0.12, 0.02], -0.60, 1],
        [[0.99, -0.08, -0.13], 0.20, 0.12], [[0.76, -0.27, -0.22], 0.48, 0],
        [[0.41, -0.39, -0.28], 0.68, 0], [[0.02, -0.40, -0.31], 0.76, 0],
        [[-0.43, -0.30, -0.28], 0.42, 0.12], [[-0.78, -0.21, -0.20], 0.19, 0.85],
        [[-0.99, -0.03, -0.10], -0.35, 0.05], [[-0.96, 0.13, 0.01], -0.63, 0],
        [left, -0.48, 0]
      ],
      arrows: [3.20]
    },
    {
      name: "workflow-ribbon-braid",
      width: 0.137,
      knots: [
        [left, -0.48, 0], [[-0.53, 0.29, 0.17], -0.31, 0],
        [[-0.25, 0.21, 0.22], -0.24, 0], [[0, hubY, 0.25], -0.49, 0],
        [[0.27, -0.13, 0.28], -0.39, 0.18], [[0.47, -0.37, 0.27], -0.26, 0.31],
        [lowerRight, 0.09, 0], [[0.25, -0.61, 0.33], 0.42, 1],
        [queue, 0.55, 1], [[-0.41, -0.53, 0.31], 0.45, 1],
        [lowerLeft, 0.06, 1], [[-0.55, -0.21, 0.18], -0.20, 1],
        [[-0.29, -0.02, 0.09], -0.46, 1], [[0, hubY, -0.01], -0.51, 1],
        [[0.29, 0.22, 0.04], -0.47, 1], [[0.55, 0.30, 0.10], -0.43, 1],
        [right, -0.40, 1]
      ],
      arrows: [1.68, 7.16, 11.47, 14.65]
    }
  ];

  const arrows = new Map([[TRACK_CYAN, []], [TRACK_AMBER, []]]);
  const ribbonMaterial = h.glass(0xffffff, 0.54);
  ribbonMaterial.vertexColors = true;
  const tones = [TRACK_AMBER, TRACK_CYAN, 0x62f1d5];
  const routes = lanes.map((lane, index) => ({
    curve: addRibbon(THREE, root, h, lane, ribbonMaterial, 7 + index, arrows, hubY),
    size: 1,
    phase: [0.16, 0.54, 0.81][index],
    color: tones[index]
  }));

  const arrow = new THREE.Shape()
    .moveTo(0, 0.044).lineTo(-0.031, -0.032).lineTo(0, -0.018)
    .lineTo(0.031, -0.032).closePath();
  const arrowGeometry = new THREE.ExtrudeGeometry(arrow, { depth: 0.012, bevelEnabled: false });
  arrows.forEach((matrices, tone) => {
    const tip = new THREE.Color(tone).lerp(new THREE.Color(HOLO_ICE), 0.38);
    addInstances(THREE, root, "workflow-direction-arrows", arrowGeometry, h.light(tip.getHex()), matrices);
  });
  root.userData.modelSignals = addModelSignalPackets({ THREE, root }, routes, { radius: 0.054, speed: 0.67 });
}

function addWorkflowQueue(h, queue) {
  const packet = h.box([0.091, 0.091, 0.091], queue, {
    color: HOLO_AMBER, opacity: 0.54, edgeColor: HOLO_ICE, edgeOpacity: 0.90,
    rotation: [0.36, 0.58, -0.03]
  });
  packet.name = "workflow-queue-packet";
  h.glow([queue], TRACK_AMBER, 0.25, 0.48);
  for (const [x, y, z] of [[-0.47, -0.47, 0.28], [-0.37, -0.53, 0.31], [-0.27, -0.56, 0.34]]) {
    h.line([
      [x - 0.028, y - 0.048, z], [x + 0.028, y - 0.063, z + 0.018],
      [x + 0.028, y + 0.030, z + 0.018], [x - 0.028, y + 0.045, z],
      [x - 0.028, y - 0.048, z]
    ], TRACK_AMBER, DETAIL_OPACITY);
  }
}

function addWorkflowHub(THREE, root, h, hubY) {
  const hub = new THREE.Group();
  hub.name = "workflow-hub";
  hub.position.y = hubY;
  hub.userData.spin = 0.32;
  const hubTilt = 0.40;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.193, 0.193, 0.19, 32, 1, true), h.glass(HOLO_CYAN, 0.12));
  sleeve.rotation.x = hubTilt;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.074), h.light(0xffffff));
  hub.add(sleeve, core);
  const collarGeometry = new THREE.TorusGeometry(0.195, 0.009, 6, 40);
  const collarRotation = new THREE.Euler(hubTilt - Math.PI / 2, 0, 0);
  const collarMatrix = (offset) => new THREE.Matrix4().makeRotationFromEuler(collarRotation)
    .setPosition(0, offset * Math.cos(hubTilt), offset * Math.sin(hubTilt));
  addInstances(THREE, hub, "workflow-cyan-collars", collarGeometry, h.light(HOLO_CYAN, 0.94), [0.099, -0.017].map(collarMatrix));
  addInstances(THREE, hub, "workflow-amber-collar", collarGeometry, h.light(HOLO_AMBER, 0.85), [collarMatrix(-0.099)]);
  h.line([[0, hubY - 0.31, 0.16], [0, hubY + 0.32, 0.16]], TRACK_CYAN, DETAIL_OPACITY);
  h.glow([[0, hubY, 0.17]], TRACK_CYAN, 0.52, 0.82);
  h.glow([[0, hubY, 0.18]], HOLO_ICE, 0.27, 0.82);
  root.add(hub);
  return hub;
}

function addRibbon(THREE, root, h, lane, material, order, arrows, hubY) {
  const { knots, width, closed = false } = lane;
  const curve = new THREE.CatmullRomCurve3(knots.map(([point]) => new THREE.Vector3(...point)), closed);
  const spans = closed ? knots.length : knots.length - 1;
  const segments = spans * STEPS_PER_KNOT;
  const front = new THREE.Vector3(0, 0, 1);
  const cyan = new THREE.Color(TRACK_CYAN);
  const amber = new THREE.Color(TRACK_AMBER);
  const positions = [];
  const colors = [];
  const indices = [];
  const bands = [-0.5, -0.39, 0, 0.39, 0.5];
  const brightness = [1.24, 0.88, 0.64, 0.88, 1.24];
  const glassAlpha = [1, 0.84, 0.58, 0.84, 1];
  let previous;

  function sample(knot) {
    const t = knot / spans;
    const index = Math.floor(knot);
    const current = knots[index % knots.length];
    const next = knots[(index + 1) % knots.length];
    const mix = knot - index;
    const tangent = curve.getTangent(t).normalize();
    const roll = THREE.MathUtils.lerp(current[1], next[1], mix);
    const blend = THREE.MathUtils.lerp(current[2], next[2], mix);
    const side = new THREE.Vector3().crossVectors(tangent, front).normalize().applyAxisAngle(tangent, roll);
    return { point: curve.getPoint(t), side, tangent, blend, tone: blend >= 0.5 ? TRACK_AMBER : TRACK_CYAN };
  }

  for (let step = 0; step <= segments; step += 1) {
    const { point, side, blend, tone } = sample(step / STEPS_PER_KNOT);
    const cross = bands.map((offset) => point.clone().addScaledVector(side, offset * width));
    // Let the core shine through the layered glass where the paths cross.
    const fromHub = Math.hypot(point.x, point.y - hubY);
    const alpha = THREE.MathUtils.lerp(0.34, 1, THREE.MathUtils.smoothstep(fromHub, 0.04, 0.24));
    cross.forEach((vertex, column) => {
      positions.push(...vertex);
      colors.push(...cyan.clone().lerp(amber, blend).multiplyScalar(brightness[column]), alpha * glassAlpha[column]);
    });
    if (previous) {
      const row = (step - 1) * bands.length;
      for (let column = 0; column < bands.length - 1; column += 1) {
        const a = row + column;
        const b = a + bands.length;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      for (const column of [0, 4]) h.line([previous[column], cross[column]], tone, 0.88);
      h.line([previous[2], cross[2]], tone, DETAIL_OPACITY);
    }
    if (step % 3 === 1) h.line([cross[0], cross[4]], tone, DETAIL_OPACITY);
    if (step % 2 === 1 && fromHub > 0.18) {
      h.dots([point], tone, 0.028, 0.96);
      if (step % STEPS_PER_KNOT === 3) h.glow([point], tone, 0.14, 0.45);
    }
    previous = cross;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.name = lane.name;
  ribbon.renderOrder = order;
  root.add(ribbon);

  lane.arrows.forEach((knot) => {
    const { point, side, tangent, tone } = sample(knot);
    const normal = new THREE.Vector3().crossVectors(side, tangent);
    arrows.get(tone).push(new THREE.Matrix4().makeBasis(side, tangent, normal)
      .setPosition(point.addScaledVector(normal, 0.009)));
  });
  return curve;
}

function addCheckpoints(THREE, root, h, checkpoints) {
  const diamond = new THREE.OctahedronGeometry(0.062);
  const diamondEdges = new THREE.EdgesGeometry(diamond).getAttribute("position");
  const shells = new Map([[TRACK_CYAN, []], [TRACK_AMBER, []]]);
  const cores = [];

  checkpoints.forEach(([position, tone]) => {
    const center = new THREE.Vector3(...position);
    shells.get(tone).push(new THREE.Matrix4().setPosition(center));
    cores.push(new THREE.Matrix4().setPosition(center.x, center.y, center.z + 0.021));
    for (let i = 0; i < diamondEdges.count; i += 2) {
      h.line([i, i + 1].map((index) => new THREE.Vector3().fromBufferAttribute(diamondEdges, index).add(center)), tone, 0.88);
    }
    for (const [radius, opacity] of [[0.091, 0.88], [0.115, DETAIL_OPACITY]]) {
      h.line(Array.from({ length: 33 }, (_, index) => {
        const angle = index * Math.PI / 16;
        return [center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle), center.z + 0.012];
      }), tone, opacity);
    }
    h.glow([center], tone, 0.29, 0.61);
  });

  shells.forEach((matrices, tone) => {
    addInstances(THREE, root, "workflow-checkpoints", diamond, h.glass(tone, 0.36), matrices);
  });
  addInstances(THREE, root, "workflow-checkpoint-cores", new THREE.OctahedronGeometry(0.032), h.light(0xffffff), cores);
}

function addInstances(THREE, parent, name, geometry, material, matrices) {
  const batch = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
  batch.instanceMatrix.needsUpdate = true;
  batch.name = name;
  parent.add(batch);
}
