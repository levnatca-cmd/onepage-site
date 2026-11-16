import { HOLO_CYAN } from "../hologram.js?v=wow60";
import { addModelSignalPackets } from "../signal-packets.js?v=wow60";

const OUTBOUND_SIGNAL = 0xffa04b;

export function createHardwareCable({ THREE, root, mesh, jacket, cyanLight, amberLight }) {
  return function cable(name, knots, { parent = root, segments = 18, size = 1, twist = 0, insulation = jacket } = {}) {
    const curve = new THREE.CatmullRomCurve3(knots.map(point => new THREE.Vector3(...point)));
    const points = curve.getSpacedPoints(segments);
    const { normals, binormals } = curve.computeFrenetFrames(segments, false);
    mesh(name + "-jacket", new THREE.TubeGeometry(curve, segments, 0.024 * size, 6, false),
      insulation, [0, 0, 0], [0, 0, 0], parent);
    for (const [offset, lift, radius, material] of [
      [-0.012, 0.004, 0.0068, cyanLight], [0.011, -0.003, 0.0057, amberLight]
    ]) {
      const rail = new THREE.CatmullRomCurve3(points.map((point, i) => {
        const angle = twist * i / segments;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return point.clone().addScaledVector(normals[i], (offset * c - lift * s) * size)
          .addScaledVector(binormals[i], (offset * s + lift * c) * size);
      }));
      mesh(name + "-rail", new THREE.TubeGeometry(rail, segments, radius * size, 5, false),
        material, [0, 0, 0], [0, 0, 0], parent);
    }
    return curve;
  };
}

export function addHardwareSignalNetwork(assembly, processorPorts, peripheralPorts, anchor, cable) {
  const { root, layout } = assembly;
  const routes = [];

  function route(name, from, via, to, { phase, color, size = 1.12 }) {
    const curve = cable(name, [from, ...via.map(layout.at), to], { size });
    routes.push({ curve, size, phase, color });
  }

  route("memory-bus", peripheralPorts.memory,
    [[-0.635, 0.24, -0.19], [-0.67, 0.124, -0.105]], processorPorts.memory,
    { phase: 0.12, color: HOLO_CYAN });
  route("sensor-bus", peripheralPorts.sensor,
    [[0.53, 0.147, -0.33], [0.43, 0.104, -0.257]], processorPorts.sensor,
    { phase: 0.36, color: 0x72cfff });
  route("edge-bus", peripheralPorts.edge,
    [[-0.91, -0.116, 0.175], [-0.75, -0.07, 0.273], [-0.47, 0.03, 0.393]], processorPorts.edge,
    { phase: 0.54, color: HOLO_CYAN });
  route("dock-bus", processorPorts.dock,
    [[0.324, -0.067, 0.18], [0.439, -0.232, 0.33], [0.403, -0.369, 0.38]], peripheralPorts.dock,
    { phase: 0.71, color: OUTBOUND_SIGNAL });
  route("control-bus", processorPorts.control,
    [[-0.354, 0.105, -0.383], [-0.266, 0.219, -0.492], [-0.094, 0.312, -0.532]], peripheralPorts.control,
    { phase: 0.26, color: OUTBOUND_SIGNAL });
  route("feedthrough-bus", processorPorts.feedthrough,
    [[0.306, 0.131, 0.28], [0.27, 0.218, 0.46], [0.246, 0.281, 0.59]], anchor.toArray(),
    { phase: 0.84, color: OUTBOUND_SIGNAL });
  route("lower-return", peripheralPorts.returnFrom,
    [[0.038, -0.54, 0.637], [-0.22, -0.581, 0.669], [-0.571, -0.41, 0.519], [-0.91, -0.303, 0.376]],
    peripheralPorts.returnTo, { phase: 0.48, color: 0x9f9aff, size: 0.82 });

  root.userData.modelSignals = addModelSignalPackets(assembly, routes);
}
