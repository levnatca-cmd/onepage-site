import { createHologram, HOLO_CYAN, HOLO_AMBER, HOLO_ICE } from "./hologram.js?v=wow60";
import { addModelSignalPackets } from "./signal-packets.js?v=wow60";

export function buildBackendModel(color, { THREE, part }) {
  const root = new THREE.Group();
  root.name = "backend-model";
  const h = createHologram(root);
  const includes = (id) => !part || part === id;
  const signals = [];
  const source = new THREE.Vector3(-0.77, 0.065, -0.105);
  const destination = new THREE.Vector3(0.77, 0.035, 0.105);
  const axis = destination.clone().sub(source).setY(0).normalize();
  const side = new THREE.Vector3(-axis.z, 0, axis.x);
  const up = new THREE.Vector3(0, 1, 0);
  const linkYaw = -Math.atan2(axis.z, axis.x);
  const towerYaw = linkYaw - 0.32;
  const cardYaw = towerYaw - 0.29;
  const towerX = new THREE.Vector3(Math.cos(towerYaw), 0, -Math.sin(towerYaw));
  const towerZ = new THREE.Vector3(-towerX.z, 0, towerX.x);
  const transform = new THREE.Matrix4();
  const size = new THREE.Vector3();
  const cards = [];

  const start = source.clone().setY(-0.085).addScaledVector(axis, 0.40);
  const end = destination.clone().setY(0.055).addScaledVector(axis, -0.40);

  if (includes("source") || includes("destination")) addTowers();
  if (includes("links")) addBackplaneGrid();
  if (cards.length) addCards();
  if (includes("gateway")) addGateway();
  if (part === "links") {
    addSignalTraces(start, -1);
    addSignalTraces(end, 1);
  }
  if (includes("gateway")) {
    root.userData.signalMarkers = [
      { role: "request-ingress", position: start.toArray() },
      { role: "request-egress", position: end.toArray() },
      { role: "backplane", position: start.clone().lerp(end, 0.5).toArray() }
    ];
  }
  h.finish();
  if (signals.length) {
    root.userData.modelSignals = addModelSignalPackets({ THREE, root }, signals, { radius: 0.045, speed: 0.58 });
  }
  return { root, mechanicalParts: [], semanticRole: "api" };

  function addTowers() {
    // The roof and base carry dense glass reflections. The front wall fades in the
    // middle so the amber and cyan cards remain visible through it.
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1, 4, 6, 4);
    colorVertices(towerGeometry, function (x, y, z, nx, ny, nz) {
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (ny > 0) return z > 0.3 ? [0xb5f3fb, 0.76] : edge > 0.4 ? [0x50d8ec, 0.67] : [0x31768a, 0.45];
      if (ny < 0) return z > 0.3 ? [0xffba6c, 0.68] : edge > 0.4 ? [0x63c3db, 0.59] : [0x247187, 0.25];
      if (y > 0.4) return [nz > 0 ? 0x4dc2dd : 0x55d2e1, 0.49];
      if (y < -0.4) return [z > 0.24 ? 0xefab66 : 0x30a4bd, 0.43];
      const outsideEdge = nz !== 0 ? Math.abs(x) > 0.4 : Math.abs(z) > 0.4;
      return outsideEdge ? [nx > 0 ? 0x3c818c : 0x30afc5, 0.22] : [0x184554, nz > 0 ? 0.064 : 0.13];
    });
    const towerMaterial = vertexGlass(0.82);
    if (includes("source")) addTower(towerGeometry, towerMaterial, source, [0.72, 1.83, 0.73], "api-source-tower", [
      { y: 0.24, height: 0.49, count: 4 },
      { y: -0.55, height: 0.36, count: 4 }
    ]);
    if (includes("destination")) addTower(towerGeometry, towerMaterial, destination, [0.68, 1.56, 0.70], "api-destination-tower", [
      { y: -0.17, height: 0.49, count: 4 }
    ]);
  }

  function addCards() {
    const cardGeometry = new THREE.BoxGeometry(1, 1, 1, 4, 8, 1);
    colorVertices(cardGeometry, function (x, y, z, nx, ny) {
      if (y > 0.38) return [0xffbc6f, 0.92];
      if (y > 0.19) return [0xb27334, 0.52];
      if (y < -0.38) return [0x74edff, 0.87];
      if (y < -0.19) return [0x208a9e, 0.48];
      return Math.abs(x) > 0.4 || nx !== 0 || ny !== 0 ? [0x447c7f, 0.39] : [0x1c3d46, 0.17];
    });
    const cardMesh = new THREE.InstancedMesh(cardGeometry, vertexGlass(0.92), cards.length);
    cards.forEach(function ({ center, width, height }, index) {
      transform.makeRotationY(cardYaw).scale(size.set(width, height, 0.025)).setPosition(center);
      cardMesh.setMatrixAt(index, transform);
    });
    cardMesh.name = "api-internal-stacks";
    root.add(cardMesh);
  }

  function addGateway() {
    const channelLength = start.distanceTo(end);
    const channelAxis = end.clone().sub(start).normalize();
    const channelUp = side.clone().cross(channelAxis);
    const channelRotation = new THREE.Quaternion().setFromRotationMatrix(
      transform.makeBasis(channelAxis, channelUp, side)
    );
    const channelGeometry = new THREE.BoxGeometry(channelLength, 0.34, 0.29, 6, 4, 2);
    colorVertices(channelGeometry, function (x, y, z, nx, ny) {
      if (ny > 0 || y > 0.10) return [0xbf813d, 0.37];
      if (ny < 0 || y < -0.10) return [0x21a2c5, 0.37];
      return [0x1d6070, 0.06];
    });
    const tunnel = new THREE.Mesh(channelGeometry, vertexGlass(0.58));
    tunnel.position.copy(start).lerp(end, 0.5);
    tunnel.quaternion.copy(channelRotation);
    tunnel.name = "api-transparent-gateway-channel";
    root.add(tunnel);

    // Rounded hardware lips sit inside a broader cyan glass collar, leaving an open bore.
    const collarGeometry = new THREE.LatheGeometry([
      [0.273, -0.16], [0.341, -0.16], [0.372, -0.13], [0.402, -0.084],
      [0.419, -0.036], [0.417, 0.01], [0.393, 0.052], [0.354, 0.063],
      [0.313, 0.055], [0.289, 0.02], [0.281, -0.045], [0.273, -0.16]
    ].map(([radius, depth]) => new THREE.Vector2(radius, depth)), 36);
    colorVertices(collarGeometry, function (x, y, z) {
      if (y > 0.023) return x + z > 0.05 ? [0xa0f6ff, 0.81] : [0x69d3e3, 0.58];
      if (y < -0.12) return [0x227a94, 0.3];
      return x + z > 0.05 ? [0x3baec4, 0.72] : [0x236784, 0.42];
    });
    const rimGeometry = new THREE.TorusGeometry(0.317, 0.035, 8, 36);
    colorVertices(rimGeometry, function (x, y) {
      if (x < -0.11 || y < -0.18) return [0xffbd67, 0.94];
      if (y > 0.16) return [0xcafaff, 0.96];
      return [0xffeed0, 0.96];
    });

    [start, end].forEach(function (position, index) {
      // Angle the receiving flange forward so both lit bores read at the opening pose.
      const direction = axis.clone().multiplyScalar(index ? -1 : 1)
        .addScaledVector(side, index ? 0.73 : 0.11).normalize();
      const scale = index ? 0.935 : 1;
      const collar = new THREE.Mesh(collarGeometry, vertexGlass(0.86));
      collar.position.copy(position);
      collar.quaternion.setFromUnitVectors(up, direction);
      collar.scale.setScalar(scale);
      root.add(collar);

      const rimTint = index ? 0xffe1ac : 0xeaffff;
      const rimMaterial = h.light(rimTint, 0.96);
      rimMaterial.vertexColors = true;
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.position.copy(position).addScaledVector(direction, 0.04);
      rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      rim.scale.setScalar(scale);
      rim.name = index ? "api-destination-gateway" : "api-source-gateway";
      rim.renderOrder = 10;
      root.add(rim);

      h.line(portArc(position, direction, 0.415 * scale, 0.004), HOLO_CYAN, 0.86);
      h.line(portArc(position, direction, 0.373 * scale, -0.126), color || HOLO_CYAN, 0.34);
      h.line(portArc(position, direction, 0.322 * scale, 0.065, index ? Math.PI * 0.50 : -0.16, Math.PI * 0.98), HOLO_ICE, 0.96);
      h.glow([position.clone().addScaledVector(up, 0.35 * scale)], HOLO_CYAN, 0.20, 0.60);
      h.glow([position.clone().addScaledVector(up, -0.24 * scale).addScaledVector(side, 0.22)], HOLO_AMBER, 0.20, 0.61);
      if (includes("links")) addSignalTraces(position, index ? 1 : -1);
    });

    const packetGeometry = new THREE.BoxGeometry(0.064, 0.064, 0.064);
    const packetEdges = new THREE.EdgesGeometry(packetGeometry);
    const packetPositions = packetEdges.getAttribute("position");
    const edgeStart = new THREE.Vector3();
    const edgeEnd = new THREE.Vector3();
    const laneGeometry = new THREE.BoxGeometry(channelLength, 0.08, 0.25, 6, 2, 2);
    colorVertices(laneGeometry, function (x, y, z, nx, ny) {
      const edge = ny !== 0 || Math.abs(y) > 0.4 || Math.abs(z) > 0.4;
      return [0xffffff, edge ? 0.37 : 0.13];
    });
    [HOLO_AMBER, HOLO_CYAN].forEach(function (laneColor, index) {
      const response = index === 1;
      const offset = response ? -0.106 : 0.106;
      const routePoint = (t, y = 0, z = 0) => start.clone().lerp(end, response ? 1 - t : t)
        .addScaledVector(channelUp, offset + y).addScaledVector(side, z);
      signals.push({
        curve: new THREE.LineCurve3(routePoint(0, 0, 0.053), routePoint(1, 0, 0.053)),
        phase: response ? 0.54 : 0.12, color: laneColor, size: 1
      });
      const laneMaterial = h.glass(laneColor, 0.78);
      laneMaterial.vertexColors = true;
      const lane = new THREE.Mesh(laneGeometry, laneMaterial);
      lane.position.copy(routePoint(0.5));
      lane.quaternion.copy(channelRotation);
      lane.name = response ? "api-response-lane" : "api-request-lane";
      root.add(lane);

      const packetCenters = [];
      const packets = new THREE.InstancedMesh(packetGeometry, h.glass(laneColor, 0.54), 4);
      [0.19, 0.31, 0.43, 0.55].forEach(function (t, packetIndex) {
        const center = routePoint(t, 0, 0.053);
        packetCenters.push(center);
        transform.makeRotationY(linkYaw + Math.PI / 4).setPosition(center);
        packets.setMatrixAt(packetIndex, transform);
        for (let i = 0; i < packetPositions.count; i += 2) {
          h.line([
            edgeStart.fromBufferAttribute(packetPositions, i).applyMatrix4(transform),
            edgeEnd.fromBufferAttribute(packetPositions, i + 1).applyMatrix4(transform)
          ], laneColor, 0.86);
        }
      });
      packets.name = response ? "api-response-packets" : "api-request-packets";
      root.add(packets);

      const tail = 0.65;
      const tip = 0.79;
      const notch = 0.70;
      const arrow = new THREE.BufferGeometry().setFromPoints([
        routePoint(tail, 0.055, 0.06), routePoint(tip, 0, 0.06), routePoint(notch, 0, 0.06),
        routePoint(notch, 0, 0.06), routePoint(tip, 0, 0.06), routePoint(tail, -0.055, 0.06)
      ]);
      root.add(new THREE.Mesh(arrow, h.glass(laneColor, 0.96)));
      h.line([routePoint(0.05, 0, 0.045), routePoint(0.62, 0, 0.045)], laneColor, 0.86);
      for (const y of [-0.038, 0.038]) {
        h.line([routePoint(0, y, 0.085), routePoint(1, y, 0.085)], laneColor, 0.34);
      }
      h.glow(packetCenters, laneColor, 0.15, 0.44);
    });
    packetEdges.dispose();
  }

  function vertexGlass(opacity) {
    const material = h.glass(0xffffff, opacity);
    material.vertexColors = true;
    return material;
  }

  function colorVertices(geometry, getTint) {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const tint = new THREE.Color();
    const colors = [];
    for (let i = 0; i < position.count; i += 1) {
      const [hex, alpha] = getTint(
        position.getX(i), position.getY(i), position.getZ(i),
        normal.getX(i), normal.getY(i), normal.getZ(i)
      );
      tint.setHex(hex);
      colors.push(tint.r, tint.g, tint.b, alpha);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  }

  function addTower(towerGeometry, towerMaterial, center, [width, height, depth], name, banks) {
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.name = name;
    tower.position.copy(center);
    tower.rotation.y = towerYaw;
    tower.scale.set(width, height, depth);
    root.add(tower);

    const x = width / 2, y = height / 2, z = depth / 2;
    const point = (dx, dy, dz) => center.clone().addScaledVector(towerX, dx)
      .addScaledVector(towerZ, dz).addScaledVector(up, dy);
    const path = (coords, lineColor, opacity) => h.line(coords.map(p => point(...p)), lineColor, opacity);
    const roof = [[-x, y, z], [-x, y, -z], [x, y, -z], [x, y, z]];
    const base = roof.map(([dx, , dz]) => [dx, -y, dz]);
    path([...roof, roof[0]], HOLO_CYAN, 0.86);
    path([...base, base[0]], HOLO_CYAN, 0.34);
    roof.forEach(function (corner, index) {
      path([base[index], corner], index === 3 ? HOLO_AMBER : HOLO_CYAN, index % 2 ? 0.34 : 0.86);
    });
    path([roof[0], roof[3]], HOLO_ICE, 0.96);
    path([base[0], base[3], roof[3]], HOLO_AMBER, 0.86);
    const coldCorners = [point(...roof[0]), point(...roof[2]), point(...base[1])];
    const warmCorners = [point(...roof[3]), point(...base[3])];
    h.dots([...coldCorners, ...warmCorners], HOLO_ICE, 0.046, 0.96);
    h.glow(coldCorners, HOLO_CYAN, 0.20, 0.60);
    h.glow(warmCorners, HOLO_AMBER, 0.20, 0.61);

    const traceDepth = z - 0.026;
    const trace = [
      [0.24, y - 0.14], [-0.1, y - 0.14], [-0.21, y - 0.21], [-0.25, y - 0.32],
      [-0.25, -y + 0.24], [-0.18, -y + 0.14], [0.07, -y + 0.12], [0.24, -y + 0.19]
    ];
    const tracePoints = trace.map(([dx, dy]) => point(dx, dy, traceDepth));
    h.line(tracePoints, HOLO_AMBER, 0.34);
    h.dots([0, 2, 4, 6].map(i => point(...trace[i], traceDepth)), HOLO_AMBER, 0.026, 0.93);
    const curve = new THREE.CurvePath();
    for (let i = 1; i < tracePoints.length; i += 1) {
      curve.add(new THREE.LineCurve3(tracePoints[i - 1], tracePoints[i]));
    }
    signals.push({ curve, size: 0.68, phase: center === source ? 0.18 : 0.62, color: HOLO_AMBER });

    const cardX = new THREE.Vector3(Math.cos(cardYaw), 0, -Math.sin(cardYaw));
    const cardZ = new THREE.Vector3(-cardX.z, 0, cardX.x);
    for (const bank of banks) {
      for (let i = 0; i < bank.count; i += 1) {
        const cardWidth = 0.225;
        const cardHeight = bank.height + i * 0.037;
        const cardCenter = point(-0.15 + i * 0.099, bank.y + i * 0.055, 0.17 - i * 0.099);
        cards.push({ center: cardCenter, width: cardWidth, height: cardHeight });
        const cardPoint = (dx, dy) => cardCenter.clone().addScaledVector(cardX, dx)
          .addScaledVector(up, dy).addScaledVector(cardZ, 0.014);
        const topLeft = cardPoint(-cardWidth / 2, cardHeight / 2);
        const topRight = cardPoint(cardWidth / 2, cardHeight / 2);
        const bottomRight = cardPoint(cardWidth / 2, -cardHeight / 2);
        const bottomLeft = cardPoint(-cardWidth / 2, -cardHeight / 2);
        h.line([topLeft, topRight, topRight.clone().lerp(bottomRight, 0.43)], HOLO_AMBER, 0.86);
        h.line([topRight.clone().lerp(bottomRight, 0.58), bottomRight, bottomLeft], HOLO_CYAN, 0.86);
        h.line([bottomLeft, topLeft], HOLO_AMBER, 0.34);
        h.dots([topRight, bottomRight], HOLO_ICE, 0.046, 0.96);
        h.glow([topRight], HOLO_AMBER, 0.15, 0.44);
        h.glow([bottomRight], HOLO_CYAN, 0.15, 0.44);
      }
    }
  }

  function portArc(center, direction, radius, depth, startAngle = 0, sweep = Math.PI * 2) {
    const tangent = direction.clone().cross(up);
    if (tangent.dot(side) < 0) tangent.negate();
    return Array.from({ length: 41 }, function (_, index) {
      const angle = startAngle + sweep * index / 40;
      return center.clone().addScaledVector(direction, depth)
        .addScaledVector(up, radius * Math.cos(angle)).addScaledVector(tangent, radius * Math.sin(angle));
    });
  }

  function addBackplaneGrid() {
    const columns = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];
    const rows = [-0.54, -0.27, 0, 0.27, 0.54];
    const point = (x, z) => new THREE.Vector3(x, -0.84, z);
    for (const x of columns) h.line([point(x, rows[0]), point(x, rows.at(-1))], HOLO_CYAN, 0.15);
    for (const z of rows) h.line([point(columns[0], z), point(columns.at(-1), z)], HOLO_CYAN, 0.15);
    h.dots(columns.flatMap(x => rows.map(z => point(x, z))), HOLO_CYAN, 0.026, 0.54);
  }

  function addSignalTraces(port, outward) {
    const profile = [
      [0, 0.13, 0.20], [0.23, 0.03, 0.32], [0.55, -0.17, 0.31],
      [0.84, -0.21, 0.24], [1.02, -0.04, 0.12], [0.94, 0.16, -0.10],
      [0.70, 0.24, -0.24], [0.36, 0.13, -0.23], [0.06, 0.03, -0.17]
    ];
    [HOLO_CYAN, HOLO_AMBER].forEach(function (tone, index) {
      const wave = (index ? -1 : 1) * outward;
      const knots = profile.map(([x, y, z]) => port.clone()
        .addScaledVector(axis, x * outward * 1.15)
        .addScaledVector(up, (y + 0.02) * wave)
        .addScaledVector(side, z + 0.024 * wave));
      const curve = new THREE.CatmullRomCurve3(knots);
      const trace = curve.getPoints(48);
      signals.push({ curve, size: 0.72, phase: (outward > 0 ? 0.28 : 0.08) + index * 0.44, color: tone });
      h.line(trace, tone, 0.86);
      h.dots(trace.filter((_, step) => step % 5 === 2), tone, 0.026, 0.93);
      h.glow([trace[9], trace[18], trace[24], trace[33], trace[40]], tone, 0.15, 0.44);
    });
  }
}
