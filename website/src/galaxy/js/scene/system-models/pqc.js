import { createHologram, HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "./hologram.js?v=wow60";

const PORT = 0.95;
const PROTECTED_AT = 1.45;
const HANDOFF_AT = 2.8;
const ARRIVAL_AT = 4.15;
const CYCLE = 4.8;
const FILTER = 0.29;
const CHAMBER = 0.61;
const RIBBON_ROLL = -0.49;
const COLLAR_TILT = 0.27;

const INTAKE_ARC = [
  [-0.94, 0.23, 0.18], [-0.74, 0.43, 0.20], [-0.49, 0.51, 0.22],
  [-0.23, 0.46, 0.18], [0.03, 0.35, 0.10], [FILTER, 0.27, 0.10]
];
const OUTLET_ARC = [
  [-0.82, 0.19, -0.13], [-0.50, 0.28, -0.12], [-0.21, 0.42, -0.07],
  [0.10, 0.55, -0.13], [0.38, 0.60, -0.17], [0.68, 0.51, -0.20],
  [0.95, 0.24, -0.18]
];

export function buildPqcModel(color, { THREE, part }) {
  const root = new THREE.Group();
  root.name = "pqc-bridge-model";
  const holo = createHologram(root);
  let gate, outlet, raw, secured;
  const cyan = new THREE.Color(color).lerp(new THREE.Color(HOLO_CYAN), 0.78).getHex();
  const axis = new THREE.Vector3(1, 0, 0);
  const keyLight = new THREE.Vector3(-0.37, 0.65, 0.66).normalize();

  function addMesh(name, geometry, material, parent = root) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  function collar(name, x, radius, depth, tint, rimTint, rimWidth, tilt, featured = false) {
    const profile = [
      [radius - 0.04, 0], [radius - 0.04, depth * 0.78], [radius - 0.01, depth],
      [radius + 0.019, depth * 0.74], [radius + 0.02, depth * 0.25],
      [radius + 0.006, 0], [radius - 0.04, 0]
    ].map(([r, d]) => new THREE.Vector2(r, d));
    const glass = new THREE.LatheGeometry(profile, 36).rotateZ(-Math.PI / 2);
    const surface = glass.getAttribute("position");
    const shades = [];
    for (let i = 0; i < surface.count; i += 1) {
      const lobe = Math.max(0, surface.getY(i) * 0.76 + surface.getZ(i) * 0.65) / radius;
      const light = 0.1 + 0.9 * lobe ** 2;
      shades.push(light * 0.85, light * 0.98, light);
    }
    glass.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
    const housing = addMesh(`pqc-${name}-housing`, glass, facetMaterial(tint, featured ? 0.25 : 0.16));
    housing.position.x = x;
    housing.rotation.y = tilt;
    const rim = addMesh(`pqc-${name}-rim`,
      new THREE.TorusGeometry(radius, rimWidth, 8, 40).rotateY(Math.PI / 2),
      holo.light(rimTint, featured ? 0.96 : 0.64)
    );
    rim.position.x = x;
    rim.rotation.y = tilt;
    const local = (angle, r, d) => {
      const z = Math.sin(angle) * r;
      return [x + d * Math.cos(tilt) + z * Math.sin(tilt), Math.cos(angle) * r,
        z * Math.cos(tilt) - d * Math.sin(tilt)];
    };
    for (const [r, d] of [[radius - 0.01, depth], [radius + 0.02, depth * 0.25]]) {
      holo.line(Array.from({ length: 41 }, (_, i) => local(i * Math.PI / 20, r, d)), HOLO_ICE, 0.31);
    }
    const glints = Array.from({ length: 8 }, (_, i) => local((i - 1) * Math.PI / 6, radius, 0));
    holo.dots(glints, HOLO_ICE, 0.022, 0.85);
    holo.glow(glints, tint, 0.11, 0.55);
  }

  function facetMaterial(tint, opacity) {
    const material = holo.glass(tint, opacity).clone();
    material.vertexColors = true;
    return material;
  }

  function shadeFacets(geometry) {
    const positions = geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1).sub(a);
      c.fromBufferAttribute(positions, i + 2).sub(a);
      const shine = Math.max(0, b.cross(c).normalize().dot(keyLight));
      const light = 0.20 + 0.8 * shine ** 1.5;
      for (let vertex = i; vertex < i + 3; vertex += 1) {
        colors.set([light * 0.54, light * 0.96, light], vertex * 3);
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  function outline(batch, geometry, tint, opacity, threshold, matrix, highlight = false) {
    const edges = new THREE.EdgesGeometry(geometry, threshold);
    const positions = edges.getAttribute("position");
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 2) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      if (matrix) {
        a.applyMatrix4(matrix);
        b.applyMatrix4(matrix);
      }
      const top = (a.y + b.y + a.z + b.z) > 0.12;
      batch.line([a, b], tint, highlight && top ? opacity : opacity * 0.5);
    }
    edges.dispose();
  }

  const ribbonGlass = new Map();

  function ribbon(name, profile, side, tint) {
    const curve = new THREE.CatmullRomCurve3(profile.map(point => new THREE.Vector3(...point)));
    const segments = 24;
    const rows = [-1, -0.5, 0, 0.5, 1].map(lane => Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments;
      const point = curve.getPoint(t);
      const swell = Math.sin(Math.PI * t);
      const offset = lane * (0.033 + 0.078 * swell);
      point.y += offset;
      point.z += offset * (0.36 + Math.cos(t * Math.PI) * 0.7) + (1 - lane * lane) * 0.087 * swell;
      point.y *= side;
      point.z *= side;
      return point.applyAxisAngle(axis, RIBBON_ROLL);
    }));
    const faces = [];
    const colors = [];
    for (let row = 0; row < rows.length - 1; row += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = rows[row][i], b = rows[row][i + 1], c = rows[row + 1][i], d = rows[row + 1][i + 1];
        for (const [lane, segment, vertex] of [[row, i, a], [row, i + 1, b], [row + 1, i, c],
          [row, i + 1, b], [row + 1, i + 1, d], [row + 1, i, c]]) {
          faces.push(vertex.x, vertex.y, vertex.z);
          const t = segment / segments;
          const width = lane / (rows.length - 1);
          const highlight = Math.exp(-21 * (width - (side > 0 ? 0.24 : 0.72)) ** 2);
          const light = 0.12 + highlight * (0.31 + 0.57 * Math.sin(Math.PI * t) ** 2);
          colors.push(light * (tint === HOLO_AMBER ? 1 : 0.72), light, light);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(faces, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    if (!ribbonGlass.has(tint)) ribbonGlass.set(tint, facetMaterial(tint, 0.46));
    addMesh(name, geometry, ribbonGlass.get(tint));
    const edges = [rows[0], rows[2], rows[4]];
    for (let row = 0; row < edges.length - 1; row += 1) {
      for (let i = 0; i < segments; i += 3) {
        const midpoint = i + (row === 0 ? 2 : 1);
        holo.line([edges[row][i], edges[row + 1][midpoint], edges[row][i + 3]], tint, 0.24);
      }
    }
    holo.line(edges[0], tint, 0.68);
    holo.line(edges[1], tint, 0.24);
    holo.line(edges[2], tint, 0.68);
    const nodes = edges.flatMap((row, j) => row.filter((_, i) => i % 4 === j));
    holo.dots(nodes, HOLO_ICE, 0.022, 0.85);
    holo.glow(nodes, tint, 0.11, 0.55);
  }

  function addPorts() {
    collar("intake", -PORT, 0.337, 0.14, HOLO_AMBER, HOLO_ICE, 0.004, COLLAR_TILT);
    collar("protected-outlet", PORT, 0.334, -0.12, cyan, HOLO_ICE, 0.004, COLLAR_TILT - 0.22);
    holo.glow([[-PORT, 0, 0], [PORT, 0, 0]], HOLO_AMBER, 0.11, 0.55);

    outlet = new THREE.Object3D();
    outlet.name = "pqc-output-port";
    outlet.position.x = PORT;
    root.add(outlet);
  }

  function addRibbons() {
    // Broad, bowed glass spans cross at different depths; the colors trade sides at the waist.
    ribbon("pqc-intake-amber-band", INTAKE_ARC, 1, HOLO_AMBER);
    ribbon("pqc-intake-cyan-band", INTAKE_ARC, -1, cyan);
    ribbon("pqc-outlet-cyan-band", OUTLET_ARC, 1, cyan);
    ribbon("pqc-outlet-amber-band", OUTLET_ARC, -1, HOLO_AMBER);
  }

  function addEncapsulationGate() {
    collar("encapsulation", FILTER, 0.325, 0.095, HOLO_AMBER, HOLO_AMBER, 0.011, COLLAR_TILT - 0.12, true);

    gate = addMesh("pqc-encapsulation-gate",
      shadeFacets(new THREE.IcosahedronGeometry(1, 1).scale(0.29, 0.317, 0.295)),
      facetMaterial(cyan, 0.58)
    );
    gate.rotation.x = Math.PI / 4;
    const gateHolo = createHologram(gate);
    outline(gateHolo, gate.geometry, HOLO_ICE, 0.27, 16, null, true);

    // Shorter, staggered lenses expose separate facet edges along the intake axis.
    for (const [x, length, radius, detail, rimOpacity] of [
      [-0.23, 0.147, 0.254, 1, 0.35],
      [-0.40, 0.137, 0.165, 0, 0.33]
    ]) {
      const lens = addMesh("pqc-compression-lens",
        shadeFacets(new THREE.IcosahedronGeometry(1, detail).scale(length, radius, radius * 0.92)),
        facetMaterial(cyan, 0.38), gate
      );
      lens.position.x = x;
      lens.rotation.x = Math.PI / 6;
      lens.updateMatrix();
      outline(gateHolo, lens.geometry, cyan, rimOpacity, 18, lens.matrix, true);
    }
    gateHolo.finish();

    const focus = [[0, 0, 0.21]];
    holo.dots(focus, HOLO_ICE, 0.089, 0.98);
    holo.glow(focus, cyan, 0.34, 0.86);
    holo.glow([[FILTER, 0, 0.23]], HOLO_AMBER, 0.11, 0.55);
  }

  function addProtectedChamber() {
    const sleeveLength = PORT - FILTER - 0.16;
    const sleeve = addMesh("pqc-protected-chamber",
      new THREE.CylinderGeometry(0.24, 0.263, sleeveLength, 28, 1, true).rotateZ(-Math.PI / 2),
      holo.glass(cyan, 0.075)
    );
    sleeve.position.x = (PORT + FILTER) / 2 + 0.02;
    const capsule = addMesh("pqc-protected-crystal",
      shadeFacets(new THREE.IcosahedronGeometry(1, 1).scale(0.186, 0.202, 0.179)),
      facetMaterial(cyan, 0.64)
    );
    capsule.position.x = CHAMBER;
    capsule.updateMatrix();
    outline(holo, capsule.geometry, HOLO_ICE, 0.33, 12, capsule.matrix, true);
    const focus = [[CHAMBER, 0, 0.11]];
    holo.dots(focus, HOLO_ICE, 0.089, 0.98);
    holo.glow(focus, cyan, 0.34, 0.86);
  }

  function addSignalAxis() {
    const beam = new THREE.CylinderGeometry(0.006, 0.006, PORT * 2.04, 8).rotateZ(-Math.PI / 2);
    addMesh("pqc-signal-axis", beam, holo.light(HOLO_ICE, 0.85));
    raw = addMesh("pqc-unprotected-packet", new THREE.IcosahedronGeometry(0.052), holo.light(0xfff5e8));
    secured = addMesh("pqc-protected-packet", new THREE.IcosahedronGeometry(0.053), holo.light(HOLO_ICE));
    addMesh("pqc-packet-armor", new THREE.IcosahedronGeometry(1).scale(0.084, 0.113, 0.113),
      holo.glass(cyan, 0.27), secured
    );
  }

  const components = {
    ports: addPorts,
    ribbons: addRibbons,
    "encapsulation-gate": addEncapsulationGate,
    "protected-chamber": addProtectedChamber,
    "signal-axis": addSignalAxis
  };
  if (part == null) {
    Object.values(components).forEach(build => build());
  } else {
    if (!Object.hasOwn(components, part)) throw new Error("Unknown PQC part: " + part);
    components[part]();
  }
  holo.finish();

  if (raw && secured) {
    root.userData.pqc = { raw, secured, outlet, stage: "idle" };
    updatePqcSignal(root, 0, true);
  }
  return { root, semanticRole: "pqc", mechanicalParts: [gate, outlet].filter(Boolean) };
}

export function updatePqcSignal(model, elapsed, reducedMotion) {
  const flow = model.userData.pqc;
  if (!flow) return -1;
  const { raw, secured } = flow;
  const t = elapsed % CYCLE;
  raw.visible = reducedMotion || t < PROTECTED_AT;
  secured.visible = reducedMotion || (t >= PROTECTED_AT && t < HANDOFF_AT);
  raw.position.x = reducedMotion ? -0.57 : -PORT * (1 - Math.min(1, t / PROTECTED_AT));
  secured.position.x = reducedMotion ? 0.57 : PORT * Math.max(0, Math.min(1, (t - PROTECTED_AT) / (HANDOFF_AT - PROTECTED_AT)));
  if (reducedMotion) {
    flow.stage = "static";
    return 0.55;
  }
  if (raw.visible) flow.stage = "unprotected";
  else if (secured.visible) flow.stage = "protected";
  else if (t < ARRIVAL_AT) flow.stage = "to-core";
  else flow.stage = "idle";
  return t >= HANDOFF_AT && t < ARRIVAL_AT ? 1.23 * (t - HANDOFF_AT) / (ARRIVAL_AT - HANDOFF_AT) : -1;
}
