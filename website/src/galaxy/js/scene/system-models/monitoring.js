import { createHologram, HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "./hologram.js?v=wow60";
import { addModelSignalPackets } from "./signal-packets.js?v=wow60";

const ANOMALY_ORANGE = 0xff914d;

export function buildMonitoringModel(color, kit) {
  const { THREE, part } = kit;
  const root = new THREE.Group();
  root.name = "monitoring-model";
  const h = createHologram(root);
  const mechanicalParts = [];
  const apertureX = -0.79;
  const signalFrontX = [-0.045, 0.43, 0.97];
  const anomalyX = signalFrontX[1];

  function mesh(name, geometry, material, x) {
    const part = new THREE.Mesh(geometry, material);
    part.name = name;
    part.position.x = x;
    root.add(part);
    return part;
  }

  function lathe(name, profile, material) {
    const geometry = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), 40);
    const part = mesh(name, geometry, material, -0.98);
    part.rotation.z = -Math.PI / 2;
    return part;
  }

  function ring(x, radius, start = 0, sweep = Math.PI * 2) {
    const steps = Math.ceil(sweep / (Math.PI * 2) * 48);
    return Array.from({ length: steps + 1 }, (_, i) => {
      const angle = start + sweep * i / steps;
      return [x, radius * Math.cos(angle), radius * Math.sin(angle)];
    });
  }

  function glassWithFalloff(tone, opacity) {
    const material = h.glass(tone, opacity).clone();
    material.vertexColors = true;
    return material;
  }

  function setGlassAlpha(geometry, alphaAt) {
    const positions = geometry.getAttribute("position");
    const rgba = new Float32Array(positions.count * 4).fill(1);
    for (let i = 0; i < positions.count; i++) {
      rgba[i * 4 + 3] = alphaAt(positions.getX(i), positions.getY(i), positions.getZ(i));
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
  }

  function addEmitter() {
    lathe("monitoring-emitter", [
      [0.13, -0.43], [0.20, -0.41], [0.30, -0.33], [0.338, -0.25], [0.338, -0.13],
      [0.30, -0.07], [0.26, -0.045], [0.26, 0.037], [0.215, 0.072], [0.21, 0.118],
      [0.173, 0.143], [0.163, 0.206], [0.1, 0.227]
    ], h.glass(0x3994a8, 0.23));
    lathe("monitoring-emitter-armature", [
      [0, -0.395], [0.115, -0.395], [0.22, -0.345], [0.26, -0.245], [0.26, -0.145],
      [0.222, -0.068], [0.191, -0.045], [0.191, 0.06], [0.137, 0.105], [0, 0.152]
    ], h.light(0x102b34));
    lathe("monitoring-inner-lens", [
      [0, 0.04], [0.108, 0.052], [0.175, 0.076], [0.198, 0.102],
      [0.18, 0.128], [0.109, 0.148], [0, 0.161]
    ], h.glass(0x96eaff, 0.17));
    lathe("monitoring-front-lens", [
      [0, 0.147], [0.098, 0.153], [0.151, 0.172], [0.159, 0.189],
      [0.142, 0.206], [0.085, 0.224], [0, 0.233]
    ], h.glass(HOLO_ICE, 0.24));
    for (const [x, radius, thickness, tint, opacity] of [
      [-1.11, 0.333, 0.008, HOLO_CYAN, 0.62],
      [-0.98, 0.263, 0.012, HOLO_AMBER, 0.91],
      [-0.88, 0.202, 0.010, HOLO_CYAN, 0.82],
      [apertureX, 0.158, 0.012, HOLO_ICE, 0.94]
    ]) {
      const collar = mesh("monitoring-emitter-collar", new THREE.TorusGeometry(radius, thickness, 6, 36),
        h.light(tint, opacity), x);
      collar.rotation.y = Math.PI / 2;
    }
    h.dots([[apertureX + 0.028, 0, 0]], HOLO_ICE, 0.092, 0.99);

    for (const [x, radius] of [[-1.39, 0.20], [-1.23, 0.338], [-0.91, 0.217]]) {
      h.line(ring(x, radius), HOLO_CYAN, 0.38);
    }
    h.line(ring(-1.23, 0.338, -0.24, 1.06), HOLO_ICE, 0.8);
    h.line(ring(-0.78, 0.163, 2.15, 1.68), HOLO_ICE, 0.8);
    h.line(ring(-1.16, 0.397), HOLO_AMBER, 0.18);
    h.dots(ring(-1.16, 0.397).filter((_, i) => i % 4 === 1), HOLO_AMBER, 0.032, 0.9);
    h.dots([[-1.37, 0, 0], [-1.25, 0, 0], [-1.13, 0, 0]], HOLO_AMBER, 0.058, 0.98);
  }

  function addScanCone() {
    const coneGeometry = new THREE.CylinderGeometry(0.52, 0.088, 1.88, 48, 4, true);
    setGlassAlpha(coneGeometry, (x, y, z) => {
      const edge = Math.abs(x) / Math.hypot(x, z);
      const progress = (y + 0.94) / 1.88;
      return (0.14 + 0.86 * edge ** 4) * (1 - 0.35 * progress);
    });
    const cone = mesh("monitoring-scan-cone", coneGeometry, glassWithFalloff(HOLO_CYAN, 0.31), 0.15);
    cone.rotation.z = -Math.PI / 2;
    h.line(ring(1.09, 0.52), HOLO_CYAN, 0.5);
    for (const angle of [0, 0.68, 1.57, 2.45, Math.PI, 4.71]) {
      const y = Math.cos(angle);
      const z = Math.sin(angle);
      h.line([[-0.79, y * 0.088, z * 0.088], [1.09, y * 0.52, z * 0.52]], HOLO_CYAN, 0.5);
    }
  }

  function addWavefronts() {
    const cyanGlass = glassWithFalloff(HOLO_CYAN, 0.34);
    const amberGlass = glassWithFalloff(HOLO_AMBER, 0.34);
    const echoGlass = glassWithFalloff(HOLO_CYAN, 0.065);
    const wavefronts = [
      [-0.39, 0.35, echoGlass], [-0.20, 0.44, echoGlass],
      [signalFrontX[0], 0.49, cyanGlass], [anomalyX, 0.64, amberGlass],
      [signalFrontX[2], 0.79, cyanGlass], [1.14, 0.73, echoGlass]
    ];
    for (const [x, radius, material] of wavefronts) {
      const geometry = new THREE.RingGeometry(0, radius, 48, 8);
      setGlassAlpha(geometry, (u, v) => 0.04 + 0.96 * (Math.hypot(u, v) / radius) ** 6);
      const front = mesh("monitoring-wavefront", geometry, material, x);
      front.rotation.y = Math.PI / 2;
      const amber = material === amberGlass;
      const tone = amber ? HOLO_AMBER : HOLO_CYAN;
      h.line(ring(x, radius), tone, material === echoGlass ? 0.16 : 0.82);
      if (material !== echoGlass) {
        for (const reticle of [0.078, 0.125, 0.18]) {
          h.line(ring(x, reticle), amber ? ANOMALY_ORANGE : tone, amber ? 0.88 : 0.26);
        }
      }
    }
  }

  function addTelemetry() {
    // Sparse telemetry stays behind the bright axial events and glass rims.
    const cageRotation = new THREE.Euler(-0.20, 0.50, 0, "YXZ");
    const cagePoint = (x, y, z) => new THREE.Vector3(x * 0.75, y * 0.86, z * 0.53).applyEuler(cageRotation);
    const samples = [];
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const edges = [
          [cagePoint(-1, a, b), cagePoint(1, a, b)],
          [cagePoint(a, -1, b), cagePoint(a, 1, b)],
          [cagePoint(a, b, -1), cagePoint(a, b, 1)]
        ];
        for (const edge of edges) {
          h.line(edge, HOLO_CYAN, 0.075);
          for (let i = 1; i < 12; i++) samples.push(edge[0].clone().lerp(edge[1], i / 12));
        }
        h.dots([cagePoint(a, b, -1), cagePoint(a, b, 1)], HOLO_CYAN, 0.048, 0.74);
      }
    }
    for (let row = -5; row <= 5; row++) {
      for (let col = -5; col <= 5; col++) {
        if (row ** 2 + col ** 2 <= 25) samples.push([1.045, row * 0.098, col * 0.098]);
      }
    }
    h.dots(samples, HOLO_CYAN, 0.022, 0.28);

    for (const sign of [-1, 1]) {
      const traces = [
        [HOLO_CYAN, [[-0.84, 0.20, 0.08], [-0.61, 0.48, 0.16], [-0.32, 0.64, 0.17],
          [0.05, 0.63, 0.02], [0.48, 0.81, 0.11], [0.82, 0.76, 0.18], [1.07, 0.54, 0.13]]],
        [HOLO_AMBER, [[-0.72, 0.22, -0.01], [-0.39, 0.43, 0.02], [-0.02, 0.49, 0.02],
          [0.29, 0.63, 0.10], [0.63, 0.76, 0.19], [0.94, 0.62, 0.19]]]
      ];
      for (const [tone, control] of traces) {
        const curve = new THREE.CatmullRomCurve3(control.map(([x, y, z]) => new THREE.Vector3(x, y * sign, z)));
        const path = curve.getSpacedPoints(44);
        h.line(path, tone, 0.26);
        h.dots(path.filter((_, i) => i % 3 === 2), tone, 0.032, 0.9);
      }
    }
  }

  function addSignalAxis() {
    h.line([[-1.42, 0, 0], [1.19, 0, 0]], HOLO_CYAN, 0.87);
    for (let i = 0; i < 41; i++) {
      const x = -0.76 + i * 0.048;
      h.dots([[x, 0, 0]], x >= 0.27 && x <= 0.61 ? HOLO_AMBER : HOLO_CYAN, 0.032, 0.9);
    }
    h.dots(signalFrontX.map(x => [x, 0, 0]), HOLO_ICE, 0.083, 0.98);
    h.glow([apertureX, signalFrontX[0], signalFrontX[2]].map(x => [x, 0, 0]), HOLO_CYAN, 0.39, 0.83);
    h.glow([[apertureX, 0, 0.032]], HOLO_ICE, 0.20, 0.78);
    h.glow([[anomalyX, 0, 0]], ANOMALY_ORANGE, 0.42, 0.94);

    const sweepPlane = new THREE.Group();
    sweepPlane.position.x = anomalyX;
    sweepPlane.rotation.y = Math.PI / 2;
    const sweep = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.006, 5, 18, Math.PI * 0.75), h.light(HOLO_AMBER, 0.7));
    sweep.name = "monitoring-sweep";
    sweep.userData.sweepRing = true;
    sweepPlane.add(sweep);
    root.add(sweepPlane);
    mechanicalParts.push(sweep);

    const beam = new THREE.LineCurve3(
      new THREE.Vector3(apertureX + 0.024, 0, 0),
      new THREE.Vector3(1.14, 0, 0)
    );
    const anomaly = new THREE.LineCurve3(
      new THREE.Vector3(anomalyX - 0.24, 0, 0),
      new THREE.Vector3(anomalyX + 0.24, 0, 0)
    );
    root.userData.modelSignals = addModelSignalPackets({ THREE, root }, [
      { curve: beam, size: 1.04, phase: 0.08, color: HOLO_CYAN },
      { curve: beam, size: 0.86, phase: 0.60, color: HOLO_CYAN },
      { curve: anomaly, size: 0.92, phase: 0.28, color: ANOMALY_ORANGE }
    ], { radius: 0.074, speed: 0.86 });
  }

  const components = {
    emitter: addEmitter,
    "scan-cone": addScanCone,
    wavefronts: addWavefronts,
    telemetry: addTelemetry,
    "signal-axis": addSignalAxis
  };
  if (part == null) {
    Object.values(components).forEach(build => build());
  } else {
    if (!Object.hasOwn(components, part)) throw new Error("Unknown Monitoring part: " + part);
    components[part]();
  }
  h.finish();

  return { root, mechanicalParts, semanticRole: "monitoring" };
}
