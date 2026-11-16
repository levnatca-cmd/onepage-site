import { HOLO_AMBER } from "../hologram.js?v=wow60";

export const HARDWARE_FEEDTHROUGH_ANCHOR = Object.freeze([0.55, 0.32, 0.435]);

export function addHardwareFeedthrough(assembly, anchor, cable, standalone = false) {
  const { THREE, root, holo, halfPi, mesh, metal, amberLight } = assembly;
  const mount = new THREE.Group();
  mount.name = "hardware-shell-feedthrough";
  mount.position.copy(anchor);
  root.add(mount);
  const lead = new THREE.Group();
  lead.name = "hardware-feedthrough-inner-lead";
  const exteriorCable = new THREE.Group();
  exteriorCable.name = "hardware-exterior-cable";
  const cableTip = [0.284, -0.004, -0.009];
  const outlet = new THREE.Object3D();
  outlet.name = "hardware-cable-outlet";
  outlet.position.set(...cableTip);
  exteriorCable.add(outlet);
  mount.add(exteriorCable);
  if (standalone) {
    mount.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), anchor.clone().normalize());
  } else {
    mount.add(lead);
    root.userData.sphereFeedthrough = { mount, anchor, lead, outlet };
  }

  // Angle the visible socket slightly while the inner lead follows the shell normal.
  const socketTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.16, -0.03));
  exteriorCable.quaternion.copy(socketTilt);
  function orientSocket(part) {
    part.position.applyQuaternion(socketTilt);
    part.quaternion.premultiply(socketTilt);
  }

  function portBarrel(name, x, top, bottom, length, material, openEnded = true) {
    return mesh(name, new THREE.CylinderGeometry(top, bottom, length, 24, 1, openEnded),
      material, [x, 0, 0], [0, 0, -halfPi], mount);
  }

  function portRing(name, x, radius, tube, material) {
    orientSocket(mesh(name, new THREE.TorusGeometry(radius, tube, 5, 24), material,
      [x, 0, 0], [0, halfPi, 0], mount));
  }

  // The presentation puts x = 0 on the shell and points the socket outwards.
  portBarrel("right-signal-port", -0.044, 0.145, 0.159, 0.044, holo.glass(0x377283, 0.16));
  const sleeveMetal = metal.clone();
  sleeveMetal.color.setHex(0xffffff);
  sleeveMetal.emissive.setHex(0x09141a);
  sleeveMetal.specular.setHex(0x5a7885);
  sleeveMetal.shininess = 82;
  sleeveMetal.vertexColors = true;
  // A shallow flange seats against the sphere. The shaft stays narrow past the seal.
  const sleeveProfile = [
    [0.118, -0.066], [0.147, -0.066], [0.156, -0.056], [0.156, -0.041],
    [0.143, -0.035], [0.143, -0.025], [0.151, -0.019], [0.151, 0.004],
    [0.137, 0.013], [0.132, 0.016], [0.132, 0.036], [0.120, 0.045],
    [0.112, 0.049], [0.112, 0.064], [0.087, 0.072], [0.075, 0.081],
    [0.073, 0.091], [0.066, 0.096], [0.066, 0.106], [0.063, 0.108],
    [0.063, 0.113], [0.066, 0.115], [0.066, 0.128], [0.057, 0.134],
    [0.057, 0.164], [0.047, 0.170], [0.047, 0.182], [0.044, 0.184],
    [0.044, 0.189], [0.047, 0.191], [0.047, 0.199], [0.038, 0.208],
    [0.035, 0.218], [0.030, 0.218]
  ].map(([radius, x]) => new THREE.Vector2(radius, x));
  const sleeve = new THREE.LatheGeometry(sleeveProfile, 28);
  const vertices = sleeve.getAttribute("position");
  const colors = new Float32Array(vertices.count * 3);
  const darkSteel = new THREE.Color(0x203742);
  const lightSteel = new THREE.Color(0x42626d);
  const sealReflection = new THREE.Color(0x865730);
  const tint = new THREE.Color();
  for (let index = 0; index < vertices.count; index += 1) {
    const x = vertices.getY(index);
    const nearSeal = (x - 0.057) / 0.022;
    const neckBlend = THREE.MathUtils.smoothstep(x, 0.075, 0.16);
    tint.copy(darkSteel).lerp(lightSteel, 0.13 + neckBlend * 0.34)
      .lerp(sealReflection, 0.38 * Math.exp(-nearSeal * nearSeal));
    tint.toArray(colors, index * 3);
  }
  sleeve.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  orientSocket(mesh("signal-port-machined-sleeve", sleeve, sleeveMetal,
    [0, 0, 0], [0, 0, -halfPi], mount));

  const edgeLight = holo.light(0x86b9c8, 0.73);
  for (const [name, x, radius, thickness] of [
    ["back-glint", -0.055, 0.155, 0.003],
    ["flange-glint", 0.003, 0.150, 0.0025],
    ["neck-glint", 0.087, 0.074, 0.0022],
    ["shaft-glint", 0.127, 0.065, 0.0018]
  ]) {
    portRing("signal-port-" + name, x, radius, thickness, edgeLight);
  }
  portRing("signal-port-amber-seal", 0.055, 0.114, 0.0068, amberLight);
  portRing("signal-port-strain-relief-glint", 0.164, 0.056, 0.0015, amberLight);
  if (!standalone) {
    cable("signal-port-inner", [[-1, 0, 0], [-0.5, 0, 0], [0, 0, 0]],
      { parent: lead, segments: 3, size: 0.76 });
  }
  cable("signal-port-exterior", [[0.205, 0, 0], [0.231, 0, -0.002],
    [0.255, -0.001, -0.005], cableTip],
    { parent: exteriorCable, segments: 14, size: 1.08, twist: Math.PI * 0.55, insulation: holo.glass(0x2b6473, 0.38) });

  const pulse = mesh("hardware-diagnostic-pulse", new THREE.OctahedronGeometry(0.019),
    holo.light(HOLO_AMBER, 0.89), [0.1, 0.004, 0], [0, 0, 0], mount);
  orientSocket(pulse);
  pulse.userData.fault = true;

  return mount;
}
