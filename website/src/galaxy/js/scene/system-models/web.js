import { createHologram, HOLO_CYAN, HOLO_AMBER, HOLO_ICE } from "./hologram.js?v=wow60";
import { addModelSignalPackets } from "./signal-packets.js?v=wow60";

export function buildWebModel(color, { THREE, part }) {
  const root = new THREE.Group();
  root.name = "web-model";
  const stack = new THREE.Group();
  stack.rotation.z = 0.168;
  stack.scale.set(0.97, 1.075, 1);
  root.add(stack);

  const h = createHologram(stack);
  const ink = createDashboardBatch(THREE, h, stack);
  const accent = color || HOLO_CYAN;
  const includes = (id) => !part || part === id;
  const signals = [];
  const frontX = 0.22;
  const frontZ = 0.43;
  const boards = [
    [-0.43, -0.035, -0.47, 1.30, 1.17, 0.52],
    [-0.15, 0.095, -0.06, 1.42, 1.28, 0.64],
    [frontX, 0, frontZ, 1.51, 1.38, 0.89]
  ];

  const boardIds = ["back-board", "middle-board", "dashboard"];
  boards.forEach(function addBoard([x, y, z, width, height, opacity], index) {
    if (!includes(boardIds[index])) return;
    const front = index === 2;
    const dashboard = h.box([width, height, 0.064], [x, y, z], {
      color: 0xffffff, opacity, edgeOpacity: 0, radius: 0.092, maskBehind: front
    });
    dashboard.name = "web-dashboard-" + (index + 1);
    tintPlate(THREE, dashboard, height,
      front ? 0x1c2b26 : index ? 0x3c3927 : 0x123039,
      front ? 0x104754 : 0x1b5d6b);

    const bevel = (px, py) => THREE.MathUtils.smoothstep(py - y + 0.07 * (x - px), -height * 0.43, height * 0.22);
    ink.rim(x, y, z + 0.033, width, height, 0.092, front ? 0.032 : 0.035,
      ink.blend(front ? 0xffd18a : index ? 0xffdfaa : 0x78e5f5, front ? 0x92f4ff : 0x9ef7ff, bevel),
      ink.blend(front ? 0x775333 : index ? 0x916738 : 0x246c7b, front ? 0x1e6170 : 0x388b9a, bevel));

    const edgeInset = 0.012;
    const edgeZ = z + 0.041;
    const edge = roundedLoop(x, y, edgeZ, width - 2 * edgeInset, height - 2 * edgeInset, 0.092 - edgeInset);
    ink.stroke([[x + 0.18, edge[5][1], edgeZ], ...edge.slice(5, 10),
      [edge[9][0], y + height * 0.23, edgeZ]], 0.010, HOLO_ICE);
    ink.stroke([...edge.slice(10, 15), [x + 0.19, edge[14][1], edgeZ]],
      0.012, index ? 0xffe4b1 : 0xa6f2ff);
    h.glow([edge[4], edge[7], [x + width * 0.28, y + height * 0.48, edgeZ]], HOLO_CYAN, 0.19, 0.52);
    const baseLights = [edge[12], [x - width * 0.06, y - height * 0.48, edgeZ]];
    if (front) baseLights.push([x + width * 0.37, y - height * 0.48, edgeZ]);
    if (index) h.glow(baseLights, HOLO_AMBER, 0.24, 0.56);
    else h.glow(baseLights, HOLO_CYAN, 0.19, 0.52);

    if (front) return;
    const faceZ = z + 0.042;
    const panel = (dx, dy, w, height, radius, ...colors) =>
      ink.panel(x + dx, y + dy, faceZ, w, height, radius, ...colors);
    panel(-0.15, 0.389, width - 0.38, 0.166, 0.036, 0x143a43, 0x235763, 0x3d7e88);
    panel(-width / 2 + 0.23, 0.389, 0.174, 0.036, 0.018, 0x387480, 0x80b7bf);
    panel(-0.17, 0.108, width - 0.43, 0.263, 0.042,
      index ? 0x303d3c : 0x123741, index ? 0xa3713d : 0x245f6d,
      index ? 0xffcf83 : 0x3c8392, index ? 0.014 : 0.006);
    if (!index) {
      for (let i = 0; i < 9; i += 1) {
        ink.arc(x - 0.44, y + 0.108, faceZ + 0.004, 0.044, 0.058, i * Math.PI * 2 / 9, 0.27,
          i === 2 ? HOLO_AMBER : i === 5 ? accent : 0x297383);
      }
    }
    [-0.15, -0.36].forEach(function (dy) {
      panel(-width / 2 + 0.26, dy, 0.35, 0.156, 0.029, 0x1c434c, 0x427781, 0x53848d);
      if (index) panel(-width / 2 + 0.57, dy, 0.20, 0.156, 0.029, 0x1b4048, 0x315f69, 0x466e79);
    });

    // Two short navigation paths sit just above the rear panes.
    const routeY = y + height / 2 + (index ? 0.14 : 0.23);
    const tip = x + (index ? 0.31 : -0.33);
    const start = x - (index ? 0.48 : 0.59);
    ink.stroke([[start, routeY - 0.034, faceZ], [tip - 0.105, routeY - 0.034, faceZ]], 0.009, 0x56b6c3);
    [tip - 0.051, tip].forEach(function (tx) {
      ink.stroke([[tx - 0.041, routeY, faceZ], [tx, routeY - 0.034, faceZ],
        [tx - 0.041, routeY - 0.068, faceZ]], 0.022, HOLO_AMBER);
    });
    addSignal(new THREE.LineCurve3(
      new THREE.Vector3(start, routeY - 0.034, faceZ + 0.008),
      new THREE.Vector3(tip, routeY - 0.034, faceZ + 0.008)
    ), index ? 0.47 : 0.14, index ? HOLO_AMBER : HOLO_CYAN);
  });

  const faceZ = frontZ + 0.05;
  const point = (x, y, z = faceZ) => [frontX + x, y, z];
  const panel = (x, y, w, height, radius, ...colors) =>
    ink.panel(frontX + x, y, faceZ, w, height, radius, ...colors);
  const tile = (x, y, w, height) => panel(x, y, w, height, 0.03, 0x152b30, 0x214851, 0x3b666f);

  if (includes("dashboard")) addDashboard();
  if (includes("metrics")) addMetrics();
  if (includes("action")) addAction();
  if (includes("dashboard")) {
    h.glow([point(-0.61, 0.53, faceZ + 0.018), point(-0.52, 0.06, faceZ + 0.022)], HOLO_AMBER, 0.18, 0.28);
  }
  ink.finish();
  h.finish();
  if (signals.length) {
    root.userData.modelSignals = addModelSignalPackets({ THREE, root: stack }, signals, { radius: 0.035, speed: 0.48 });
  }
  return { root, mechanicalParts: [], semanticRole: "web" };

  function addSignal(curve, phase, tint, size = 1) {
    signals.push({ curve, phase, color: tint, size });
  }

  function addDashboard() {
    h.line([point(-0.68, 0.41), point(0.68, 0.41)], accent, 0.48);
    [HOLO_AMBER, HOLO_CYAN, 0x4d8e9b].forEach((tint, index) =>
      ink.arc(frontX - 0.61 + index * 0.082, 0.53, faceZ, 0, 0.021, 0, Math.PI * 2, tint));
    panel(-0.12, 0.53, 0.212, 0.039, 0.0195, 0xe58f3c, HOLO_AMBER);
    [0.158, 0.397].forEach((x) => panel(x, 0.53, 0.188, 0.034, 0.017, 0x2a606b, 0x4e8996, 0x629eaa));
    ink.arc(frontX + 0.62, 0.53, faceZ, 0.031, 0.044, 0, Math.PI * 2, HOLO_ICE);

    tile(-0.52, -0.044, 0.259, 0.81);
    [0.23, 0.06, -0.11, -0.28].forEach(function (y, index) {
      const active = index === 1;
      const z = faceZ + 0.004;
      ink.panel(frontX - 0.52, y, z, active ? 0.15 : 0.118, active ? 0.105 : 0.083, 0.018,
        active ? 0xe9973f : 0x214852, active ? 0x96602e : 0x376d7a, active ? HOLO_AMBER : 0x54808b);
      if (index) ink.panel(frontX - 0.52, y, z + 0.004, active ? 0.044 : 0.027, active ? 0.044 : 0.027,
        0.005, active ? 0xffe6ae : 0x498995, active ? 0xfff3d6 : 0x7ab4be);
    });

    panel(0.158, 0.16, 1.02, 0.445, 0.036, 0x102930, 0x17515d, 0x3a6b76);
    const wave = addWaveField(THREE, ink, h, point, faceZ, accent);
    addSignal(new THREE.CatmullRomCurve3(wave.map((node) => new THREE.Vector3(...node))), 0.24, HOLO_CYAN);
  }

  function addMetrics() {
    [-0.215, 0.135, 0.485].forEach((x) => tile(x, -0.225, 0.317, 0.256));
    const donutZ = faceZ + 0.009;
    ink.arc(frontX - 0.215, -0.225, donutZ, 0.055, 0.084, Math.PI * 0.52, Math.PI, accent);
    ink.arc(frontX - 0.215, -0.225, donutZ, 0.055, 0.084, -Math.PI * 0.24, Math.PI * 0.72, HOLO_AMBER);
    ink.arc(frontX - 0.215, -0.225, donutZ, 0.055, 0.084, Math.PI * 1.56, Math.PI * 0.17, 0x3e6972);

    const barHeights = [0.045, 0.073, 0.103, 0.142, 0.172];
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), h.light(0xffffff, 0.9), barHeights.length);
    tintPlate(THREE, bars, 1, 0x3c5862, 0xffffff);
    const barTransform = new THREE.Matrix4();
    barHeights.forEach(function (height, index) {
      barTransform.makeScale(0.025, height, 0.02).setPosition(frontX + 0.046 + index * 0.044, -0.304 + height / 2, faceZ);
      bars.setMatrixAt(index, barTransform);
      bars.setColorAt(index, new THREE.Color(index > 2 ? HOLO_AMBER : accent));
    });
    bars.name = "web-metric-bars";
    stack.add(bars);

    const sparkX = [0.372, 0.418, 0.479, 0.543, 0.599];
    const sparkline = (ys, tint, phase) => {
      const nodes = ys.map((y, i) => new THREE.Vector3(...point(sparkX[i], y, faceZ + 0.007)));
      const curve = new THREE.CatmullRomCurve3(nodes);
      ink.stroke(curve.getPoints(20).map((node) => node.toArray()), 0.007, tint);
      h.dots([nodes[0], nodes[4]], tint, 0.022, 0.92);
      addSignal(curve, phase, tint, 0.69);
    };
    sparkline([-0.291, -0.271, -0.218, -0.179, -0.166], accent, 0.34);
    sparkline([-0.244, -0.228, -0.244, -0.213, -0.193], HOLO_AMBER, 0.68);
  }

  function addAction() {
    tile(0.158, -0.507, 1.02, 0.197);
    const action = h.box([0.74, 0.116, 0.027], point(0.14, -0.49), {
      color: 0xffffff, opacity: 1, edgeOpacity: 0, radius: 0.055, maskBehind: true
    });
    action.name = "web-amber-action";
    tintPlate(THREE, action, 0.116, 0xed9138, 0xffd786);
    ink.rim(frontX + 0.14, -0.49, faceZ + 0.016, 0.74, 0.116, 0.055, 0.008, 0xffecbf, HOLO_AMBER);
    const stripe = [point(0.07, -0.49, faceZ + 0.021), point(0.21, -0.49, faceZ + 0.021)];
    ink.stroke(stripe, 0.006, HOLO_ICE);
    addSignal(new THREE.LineCurve3(...stripe.map((node) => new THREE.Vector3(...node))), 0.81, HOLO_ICE, 0.58);
    h.glow([-0.05, 0.14, 0.33].map(x => point(x, -0.49, faceZ + 0.022)), HOLO_AMBER, 0.24, 0.56);
  }
}

function addWaveField(THREE, ink, h, point, z, accent) {
  const columns = 20;
  const rows = 8;
  const vertices = [];
  const triangles = [];
  const samples = [];
  const peak = (x, center, width) => Math.exp(-(((x - center) / width) ** 2));
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const y = -0.037 + v * 0.102 + 0.074 * peak(u, 0.16 + 0.1 * v, 0.19)
        - 0.051 * peak(u, 0.4, 0.16) + (0.188 + 0.043 * v) * peak(u, 0.87 - 0.12 * v, 0.18);
      const node = point(-0.326 + 0.923 * u + 0.04 * v, y, z + 0.004 + 0.008 * v);
      vertices.push(node);
      if (row % 2 === 0 && column % 2 === 0) samples.push([node[0], y, node[2] + 0.002]);
      if (row === rows || column === columns) continue;
      const i = row * (columns + 1) + column;
      triangles.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
    }
  }

  const cyan = new THREE.Color(accent);
  const amber = new THREE.Color(HOLO_AMBER);
  const surface = new THREE.Color();
  ink.append(vertices, triangles, (x, y, i) => {
    const u = i % (columns + 1) / columns;
    const v = Math.floor(i / (columns + 1)) / rows;
    const warm = THREE.MathUtils.smoothstep(u, 0.34, 0.81) * (1 - v ** 1.7);
    return surface.copy(cyan).lerp(amber, warm).multiplyScalar(0.13 + 0.54 * THREE.MathUtils.smoothstep(y, -0.02, 0.29));
  });

  const wire = (row, column) => {
    const [x, y, depth] = vertices[row * (columns + 1) + column];
    return [x, y, depth + 0.002];
  };
  for (let row = 0; row <= rows; row += 1) {
    const line = Array.from({ length: columns + 1 }, (_, i) => wire(row, i));
    const split = 10 + row;
    h.line(line.slice(0, split + 1), accent, 0.48);
    h.line(line.slice(split), HOLO_AMBER, 0.58);
  }
  for (let column = 0; column <= columns; column += 2) {
    h.line(Array.from({ length: rows + 1 }, (_, row) => wire(row, column)), accent, 0.48);
  }
  h.dots(samples, HOLO_ICE, 0.015, 0.75);
  return Array.from({ length: columns + 1 }, (_, i) => wire(rows >> 1, i));
}

function tintPlate(THREE, mesh, height, bottom, top) {
  const positions = mesh.geometry.getAttribute("position");
  const low = new THREE.Color(bottom);
  const high = new THREE.Color(top);
  const color = new THREE.Color();
  const colors = [];
  for (let i = 0; i < positions.count; i += 1) {
    color.copy(low).lerp(high, positions.getY(i) / height + 0.5);
    colors.push(color.r, color.g, color.b);
  }
  mesh.geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  mesh.material = mesh.material.clone();
  mesh.material.vertexColors = true;
}

function createDashboardBatch(THREE, h, root) {
  const positions = [];
  const colors = [];
  const indices = [];
  const solid = new THREE.Color();

  function append(points, triangles, tint) {
    const offset = positions.length / 3;
    const colorAt = typeof tint === "function" ? tint : () => solid.set(tint);
    points.forEach(function ([x, y, z], i) {
      const { r, g, b } = colorAt(x, y, i);
      positions.push(x, y, z);
      colors.push(r, g, b);
    });
    for (const i of triangles) indices.push(offset + i);
  }

  function blend(a, b, factor) {
    const low = new THREE.Color(a);
    const high = new THREE.Color(b);
    const color = new THREE.Color();
    return (x, y) => color.copy(low).lerp(high, THREE.MathUtils.clamp(factor(x, y), 0, 1));
  }

  function rim(x, y, z, w, height, radius, thickness, outside, inside) {
    const outer = roundedLoop(x, y, z, w, height, radius);
    const inner = roundedLoop(x, y, z, w - 2 * thickness, height - 2 * thickness, radius - thickness);
    const n = outer.length;
    const triangles = [];
    for (let i = 0; i < n; i += 1) {
      const next = (i + 1) % n;
      triangles.push(i, next, n + i, next, n + next, n + i);
    }
    append(outer.concat(inner), triangles, (px, py, i) => {
      const tint = i < n ? outside : inside;
      return typeof tint === "function" ? tint(px, py) : solid.set(tint);
    });
  }

  function panel(x, y, z, w, height, radius, bottom, top, edge, edgeWidth = 0.005) {
    const inset = edge ? Math.min(edgeWidth, radius / 2) : 0;
    const tint = blend(bottom, top, (_, py) => (py - y) / height + 0.5);
    const points = roundedLoop(x, y, z, w - 2 * inset, height - 2 * inset, radius - inset);
    const triangles = [];
    for (let i = 1; i < points.length - 1; i += 1) triangles.push(0, i, i + 1);
    append(points, triangles, tint);
    if (inset) rim(x, y, z, w, height, radius, inset, edge, tint);
  }

  function arc(x, y, z, inner, outer, start, length, tint) {
    const ring = new THREE.RingGeometry(inner, outer, Math.max(5, Math.ceil(length * 5)), 1, start, length);
    const position = ring.getAttribute("position");
    const points = Array.from({ length: position.count }, (_, i) => [x + position.getX(i), y + position.getY(i), z]);
    append(points, ring.index.array, tint);
    ring.dispose();
  }

  function stroke(path, width, tint) {
    const points = [];
    const triangles = [];
    path.forEach(function ([x, y, z], i) {
      const before = path[Math.max(0, i - 1)];
      const after = path[Math.min(path.length - 1, i + 1)];
      const dx = after[0] - before[0];
      const dy = after[1] - before[1];
      const scale = width / (2 * Math.hypot(dx, dy));
      points.push([x + dy * scale, y - dx * scale, z], [x - dy * scale, y + dx * scale, z]);
      if (i) triangles.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i, 2 * i + 1, 2 * i - 1);
    });
    append(points, triangles, tint);
  }

  function finish() {
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = h.light(0xffffff).clone();
    material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "web-dashboard-inlays";
    root.add(mesh);
  }

  return { append, blend, rim, panel, arc, stroke, finish };
}

function roundedLoop(x, y, z, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const dx = width / 2 - r;
  const dy = height / 2 - r;
  return [[dx, dy], [-dx, dy], [-dx, -dy], [dx, -dy]].flatMap(function ([cx, cy], corner) {
    return Array.from({ length: 5 }, (_, step) => {
      const angle = (corner + step / 4) * Math.PI / 2;
      return [x + cx + Math.cos(angle) * r, y + cy + Math.sin(angle) * r, z];
    });
  });
}
