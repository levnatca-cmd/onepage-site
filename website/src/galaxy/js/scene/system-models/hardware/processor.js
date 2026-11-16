import { HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "../hologram.js?v=wow60";

export function addHardwareProcessor(assembly, part) {
  const { THREE, holo, station, diamondYaw, glass, carrier, amber, mesh, plate } = assembly;
  const halfPi = Math.PI / 2;
  const processor = station([-0.15, 0.102, 0.02], diamondYaw);
  const showPackage = !part || part === "processor";
  const showLayers = !part || part === "layers";
  const layers = [-0.233, -0.385, -0.537];
  if (showPackage) addPackage();
  if (showPackage || showLayers) addFilledSurfaces(layers);
  if (showLayers) addLayers();

  return {
    memory: processor.at([-0.399, 0, -0.15]),
    sensor: processor.at([0.067, 0, -0.4]),
    edge: processor.at([-0.27, 0, 0.4]),
    dock: processor.at([0.4, 0, 0.215]),
    control: processor.at([-0.4, 0.013, -0.27]),
    feedthrough: processor.at([0.4, -0.019, 0.273])
  };

  function addPackage() {
    const packageRim = { ...amber, color: 0xe29852, opacity: 0.79 };
    plate(processor, "processor-amber-package", [0.81, 0.054, 0.81], [0, -0.080, 0], packageRim, 0.04);
    plate(processor, "processor-package-body", [0.778, 0.114, 0.778], [0, -0.016, 0], glass, 0.037);
    plate(processor, "processor-upper-rim", [0.82, 0.034, 0.82], [0, 0.045, 0], packageRim, 0.04);
    plate(processor, "processor-top-glass", [0.644, 0.042, 0.644], [0, 0.079, 0], carrier);
    plate(processor, "illuminated-processor-die", [0.462, 0.056, 0.462], [0, 0.121, 0], {
      color: 0x49e5f4, opacity: 0.82, edgeColor: HOLO_ICE, edgeOpacity: 0.93
    }, 0.014);
    const die = new THREE.PlaneGeometry(0.45, 0.45, 10, 10).rotateX(-halfPi);
    const dieVertices = die.getAttribute("position");
    const dieColors = [];
    const dieHotspot = [-0.193, 0.19];
    for (let i = 0; i < dieVertices.count; i += 1) {
      const d = Math.hypot(dieVertices.getX(i) - dieHotspot[0], dieVertices.getZ(i) - dieHotspot[1]);
      const hot = Math.exp(-33 * d * d);
      dieColors.push(0.008 + 0.88 * hot, 0.19 + 0.8 * hot, 0.27 + 0.73 * hot);
    }
    die.setAttribute("color", new THREE.Float32BufferAttribute(dieColors, 3));
    const dieSurface = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    mesh("processor-die-light-field", die, dieSurface, processor.at([0, 0.15, 0]), [0, processor.yaw, 0]);
    const diePoints = [];
    for (let row = -8; row <= 8; row += 1) {
      for (let column = -8; column <= 8; column += 1) {
        diePoints.push(processor.at([row * 0.025, 0.154, column * 0.025]));
      }
    }
    holo.dots(diePoints, HOLO_ICE, 0.015, 0.68);
    const dieCenter = processor.at([dieHotspot[0], 0.153, dieHotspot[1]]);
    holo.glow([dieCenter], HOLO_CYAN, 0.31, 0.88);
    holo.glow([dieCenter], HOLO_ICE, 0.165, 0.66);
    const contacts = holo.light(0xa87a52, 0.48);
    for (const sign of [-1, 1]) {
      for (let index = -7; index <= 7; index += 1) {
        const offset = index * 0.046;
        for (const position of [[offset, -0.017, sign * 0.375], [sign * 0.375, -0.017, offset]]) {
          mesh("processor-contact-pin", new THREE.BoxGeometry(0.009, 0.07, 0.009),
            contacts, processor.at(position), [0, processor.yaw, 0]);
        }
      }
    }
    const packageCorners = [[-0.376, 0.047, 0.376], [0.376, 0.047, 0.376], [-0.376, 0.047, -0.376],
      [-0.38, -0.091, 0.38]].map(point => processor.at(point));
    holo.glow(packageCorners, HOLO_AMBER, 0.19, 0.78);
    holo.dots(packageCorners, HOLO_ICE, 0.042, 0.96);
  }

  function addLayers() {
    for (const [index, y] of layers.entries()) {
      plate(processor, "suspended-processor-layer", [0.506, 0.012, 0.506], [0, y, 0],
        index === 1 ? amber : glass, 0.008);
      const layerPoints = [];
      for (let x = -3; x <= 3; x += 1) {
        for (let z = -3; z <= 3; z += 1) layerPoints.push(processor.at([x * 0.067, y + 0.008, z * 0.067]));
      }
      holo.dots(layerPoints, HOLO_ICE, 0.015, 0.68);
      holo.glow([processor.at([-0.241, y, 0.241])], index === 1 ? HOLO_AMBER : HOLO_CYAN, 0.19, 0.78);
    }
    for (const x of [-0.22, -0.11, 0, 0.11, 0.22]) {
      for (const z of [-0.22, -0.11, 0, 0.11, 0.22]) {
        holo.line([processor.at([x, layers[2], z]), processor.at([x, -0.09, z])], HOLO_CYAN,
          x === 0 && z === 0 ? 0.76 : 0.21);
      }
    }
  }

  function addFilledSurfaces(layers) {
    const positions = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();
    const quad = [0, 1, 2, 0, 2, 3];
    const square = (r, y) => [[-r, y, -r], [-r, y, r], [r, y, r], [r, y, -r]];
    function fill(points, tints, triangles = quad) {
      const offset = positions.length / 3;
      points.forEach(function (point, index) {
        const [tint, alpha] = tints[index];
        color.setHex(tint);
        positions.push(...point);
        colors.push(color.r, color.g, color.b, alpha);
      });
      for (const index of triangles) indices.push(offset + index);
    }

    // The darker interior remains translucent, with a cooler highlight on the leading corner.
    const bottom = square(0.371, -0.057);
    const top = square(0.371, 0.028);
    if (showPackage) for (let i = 0; i < 4; i += 1) {
      const next = (i + 1) % 4;
      const blue = [0x225a72, 0.72];
      const glint = [0x30798a, 0.68];
      fill([bottom[i], bottom[next], top[next], top[i]], [
        [0x0a2634, 0.78], [0x123344, 0.74], next === 1 ? glint : blue, i === 1 ? glint : blue
      ]);
    }

    if (showLayers) layers.forEach(function (y, index) {
      const amberLayer = index === 1;
      const faceY = y + 0.007;
      const shade = amberLayer ? [0x8d5831, 0.44] : [0x265d72, 0.43];
      const light = amberLayer ? [0xffbc67, 0.68] : [0x65eaff, 0.71];
      fill([...square(0.246, faceY), [-0.045, faceY, 0.045]], [shade, light, shade, shade, shade],
        [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
    });

    // Crossed strips keep the main data traces visible as the processor turns.
    if (showLayers) for (const [x, z] of [[-0.17, 0.12], [-0.08, 0.07], [0, 0], [0.09, -0.08], [0.15, -0.13]]) {
      const bright = [HOLO_CYAN, 0.59];
      const dim = [0x37adc7, 0.27];
      const width = x === 0 ? 0.01 : 0.007;
      const lower = layers[2];
      fill([[x - width, lower, z], [x + width, lower, z], [x + width, -0.101, z], [x - width, -0.101, z]],
        [dim, dim, bright, bright]);
      fill([[x, lower, z - width], [x, lower, z + width], [x, -0.101, z + width], [x, -0.101, z - width]],
        [dim, dim, bright, bright]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false
    });
    const faces = mesh("processor-filled-faces-and-traces", geometry, material, processor.at([0, 0, 0]),
      [0, processor.yaw, 0]);
    faces.renderOrder = 10;
  }
}
