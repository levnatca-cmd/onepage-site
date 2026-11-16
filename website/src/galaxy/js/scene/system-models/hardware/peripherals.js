import { HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "../hologram.js?v=wow60";

const TILES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

export function addHardwarePeripherals(assembly, part) {
  const { station, diamondYaw } = assembly;
  const memory = station([-0.766, 0.345, -0.4], 0.46);
  const sensor = station([0.735, 0.159, -0.42], -0.88);
  const edge = station([-1.14, -0.128, 0.184], 0.59);
  const dock = station([0.269, -0.466, 0.5], 0.62);
  const control = station([0.11, 0.78, -0.492], diamondYaw);
  const housing = createPeripheralHousing(assembly);

  if (!part || part === "memory") addMemoryBank(assembly, housing, memory);
  if (!part || part === "sensor") addOpticalSensor(assembly, sensor);
  if (!part || part === "edge-node") addEdgeNode(assembly, housing, edge);
  if (!part || part === "dock") addLogicDock(assembly, housing, dock);
  if (!part || part === "controls") addControlTiles(assembly, housing, control);

  return {
    memory: memory.at([0.13, 0.005, 0.16]),
    sensor: sensor.at([-0.129, 0, 0.113]),
    edge: edge.at([0.17, 0, 0]),
    dock: dock.at([0.115, 0, -0.179]),
    control: control.at([0, -0.322, 0]),
    returnFrom: dock.at([-0.12, 0, 0.19]),
    returnTo: edge.at([0.007, -0.008, 0.151])
  };
}

function createPeripheralHousing({ THREE, holo }) {
  const opacity = 0.64;
  const material = holo.glass(0xffffff, opacity).clone();
  material.vertexColors = true;
  const color = new THREE.Color();

  return function housing(base, name, size, position, palette, outline, radius = 0.008) {
    const part = holo.box(size, base.at(position), {
      color: 0xffffff, opacity, edgeColor: outline.edgeColor, edgeOpacity: outline.edgeOpacity,
      radius, rotation: [0, base.yaw, 0]
    });
    part.name = name;
    part.material = material;
    const [foot, face, cap] = palette.map(tint => new THREE.Color(tint));
    const points = part.geometry.getAttribute("position");
    const normals = part.geometry.getAttribute("normal");
    const colors = new Float32Array(points.count * 3);
    for (let i = 0; i < points.count; i += 1) {
      const height = points.getY(i) / size[1] + 0.5;
      const light = 0.52 + 0.48 * Math.max(0, normals.getZ(i), -normals.getX(i), normals.getY(i));
      color.copy(face).lerp(foot, (1 - height) ** 3 * 0.8)
        .lerp(cap, height ** 3 * (normals.getY(i) > 0.5 ? 0.91 : 0.56)).multiplyScalar(light);
      color.toArray(colors, i * 3);
    }
    part.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  };
}

function addMemoryBank({ plate, holo, carrier, amber, glass }, housing, memory) {
  plate(memory, "memory-bank-platform", [0.5, 0.046, 0.36], [0, 0, 0], carrier);
  plate(memory, "memory-contact-rail", [0.398, 0.022, 0.285], [0, 0.032, 0], amber);
  const contacts = [];
  for (let i = 0; i < 4; i += 1) {
    const x = (i - 1.5) * 0.082;
    const height = 0.283 - i * 0.011;
    housing(memory, "glass-memory-fin", [0.032, height, 0.278], [x, 0.042 + height / 2, 0],
      [0xf09a42, 0x17404a, 0x60d9ec], glass);
    holo.line([memory.at([x, 0.049, -0.13]), memory.at([x, 0.049, 0.13])], HOLO_AMBER, 0.9);
    holo.line([memory.at([x, height + 0.04, -0.13]), memory.at([x, height + 0.04, 0.13])], HOLO_ICE, 0.62);
    contacts.push(memory.at([x, 0.051, 0.112]));
  }
  holo.dots(contacts, HOLO_AMBER, 0.023, 0.94);
  holo.glow([memory.at([0.065, 0.044, 0.09])], HOLO_AMBER, 0.19, 0.78);
}

function addOpticalSensor({ plate, block, barrel, ring, holo, carrier, amber, glass, metal, iceLight, cyanLight, amberLight }, sensor) {
  plate(sensor, "sensor-platform", [0.363, 0.044, 0.306], [0, 0, 0], carrier);
  plate(sensor, "sensor-mount-foot", [0.207, 0.025, 0.18], [0, 0.033, 0], amber);
  block(sensor, "sensor-pedestal", [0.104, 0.10, 0.107], [0, 0.08, 0], glass);
  barrel(sensor, "cylindrical-hardware-sensor", [0.126, 0.119], 0.178, [0, 0.204, -0.024], metal, false);
  barrel(sensor, "sensor-rear-cap", [0.122, 0.126], 0.028, [0, 0.204, -0.104], metal);
  ring(sensor, "sensor-rear-glint", 0.125, 0.004, [0, 0.204, -0.111], iceLight);
  ring(sensor, "sensor-copper-seal", 0.124, 0.004, [0, 0.204, -0.073], amberLight);
  ring(sensor, "sensor-cyan-housing", 0.12, 0.008, [0, 0.204, 0.066], cyanLight);
  ring(sensor, "sensor-amber-lens", 0.062, 0.013, [0, 0.204, 0.077], amberLight);
  ring(sensor, "sensor-inner-iris", 0.041, 0.005, [0, 0.204, 0.085], iceLight);
  barrel(sensor, "sensor-emitter", [0.022, 0.029], 0.008, [0, 0.204, 0.081], amberLight, false);
  holo.glow([sensor.at([0, 0.204, 0.088]), sensor.at([0, 0.045, 0.078])], HOLO_AMBER, 0.15, 0.62);
}

function addEdgeNode({ plate, holo, carrier, amber }, housing, edge) {
  plate(edge, "edge-node-platform", [0.386, 0.044, 0.327], [0, 0, 0], carrier);
  plate(edge, "edge-node-contact", [0.26, 0.022, 0.222], [0, 0.032, 0], amber);
  housing(edge, "floating-edge-device", [0.192, 0.208, 0.183], [0, 0.148, 0],
    [0x935223, 0x134d59, 0x7bcad6], carrier);
  const status = Array.from({ length: 15 }, (_, i) => edge.at([
    (((i * 29) % 31) / 30 - 0.5) * 0.142,
    0.072 + (((i * 13) % 37) / 36) * 0.157,
    (((i * 11) % 23) / 22 - 0.5) * 0.139
  ]));
  holo.dots(status, HOLO_AMBER, 0.023, 0.94);
  holo.glow([edge.at([-0.073, 0.046, 0.072])], HOLO_AMBER, 0.19, 0.78);
  const corner = edge.at([-0.088, 0.248, 0.084]);
  holo.dots([corner], HOLO_ICE, 0.042, 0.96);
  holo.glow([corner], HOLO_CYAN, 0.15, 0.62);
}

function addLogicDock({ plate, holo, carrier, amber, glass }, housing, dock) {
  plate(dock, "logic-bank-platform", [0.51, 0.048, 0.425], [0, 0, 0], carrier, 0.058);
  plate(dock, "logic-bank-tray", [0.441, 0.022, 0.368], [0, 0.036, 0], amber);
  for (const [x, z] of TILES) {
    const cx = x * 0.11;
    const cz = z * 0.091;
    housing(dock, "logic-bank-module", [0.175, 0.088, 0.147], [cx, 0.087, cz],
      [0x905629, 0x142b36, 0x5593a7], glass);
    plate(dock, "logic-module-cap", [0.145, 0.015, 0.123], [cx, 0.135, cz], carrier, 0.012);
    const status = dock.at([cx, 0.147, cz]);
    const cool = x === 1 && z === -1;
    holo.dots([status], cool ? HOLO_ICE : HOLO_AMBER, 0.042, 0.96);
    holo.glow([status], cool ? HOLO_CYAN : HOLO_AMBER, 0.15, 0.62);
  }
  holo.glow([dock.at([-0.11, 0.064, 0.095])], HOLO_AMBER, 0.19, 0.78);
}

function addControlTiles({ reticle, holo, carrier, amber }, housing, control) {
  for (const [index, [x, z]] of TILES.entries()) {
    const cx = x * 0.105;
    const cz = z * 0.105;
    const warm = index === 2 || index === 3;
    const palette = warm ? [0xbf6b2c, 0x254851, 0x95d7de] : [0x245669, 0x0d3547, 0x58b9cc];
    housing(control, "floating-control-module", [0.187, 0.057, 0.187], [cx, 0, cz],
      palette, index === 3 ? amber : carrier, 0.009);
    holo.line([control.at([cx, -0.03, cz]), control.at([cx, -0.322, cz])], HOLO_CYAN, 0.34);
  }
  reticle(control, [0, -0.322, 0], 0.09);
  holo.glow([control.at([0, -0.322, 0])], HOLO_CYAN, 0.15, 0.62);
  holo.glow([control.at([-0.179, -0.028, 0.179])], HOLO_AMBER, 0.15, 0.62);
}

export function addHardwareInspectionGuides({ station, holo, reticle }) {
  for (const origin of [[-0.37, 0.61, -0.6], [0.74, 0.124, -0.2], [-0.412, -0.348, 0.556]]) {
    const guide = station(origin, Math.PI / 4);
    const corners = [[-0.083, -0.083], [0.083, -0.083], [0.083, 0.083], [-0.083, 0.083]];
    const marks = [];
    for (const [i, [x, z]] of corners.entries()) {
      const [nx, nz] = corners[(i + 1) % corners.length];
      for (let j = 0; j < 5; j += 1) {
        const t = j / 5;
        marks.push(guide.at([x + (nx - x) * t, 0, z + (nz - z) * t]));
        marks.push(guide.at([x + (nx - x) * t, 0.085, z + (nz - z) * t]));
      }
      for (const y of [0.028, 0.056]) marks.push(guide.at([x, y, z]));
    }
    holo.dots(marks, HOLO_CYAN, 0.014, 0.43);
    reticle(guide, [0, -0.105, 0], 0.062);
  }
}
