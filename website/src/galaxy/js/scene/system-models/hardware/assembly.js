import { createHologram, HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "../hologram.js?v=wow60";

export function createHardwareAssembly(THREE) {
  const root = new THREE.Group();
  root.name = "hardware-model";
  const holo = createHologram(root);
  const halfPi = Math.PI / 2;
  const layoutYaw = 0.56; // The host's readable pose swings toward the opposite yaw.
  const diamondYaw = 0.48;
  const glass = { color: 0x18758f, opacity: 0.29, edgeColor: HOLO_CYAN, edgeOpacity: 0.51 };
  const carrier = { color: 0x45b9cd, opacity: 0.34, edgeColor: HOLO_ICE, edgeOpacity: 0.62 };
  const amber = { color: 0x6e4024, opacity: 0.29, edgeColor: HOLO_AMBER, edgeOpacity: 0.72 };
  const shadedMaterials = new Map();
  const metal = new THREE.MeshPhongMaterial({
    color: 0x51656d,
    emissive: 0x25353b,
    specular: 0xdcf4f7,
    shininess: 68
  });
  const cyanLight = holo.light(HOLO_CYAN, 0.87);
  const amberLight = holo.light(HOLO_AMBER, 0.93);
  const iceLight = holo.light(HOLO_ICE, 0.82);
  const contacts = holo.light(0xce8c4f, 0.75);
  const jacket = holo.glass(0x288fa3, 0.25);

  function frame(origin, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {
      yaw,
      at: ([x, y, z]) => [origin[0] + x * c + z * s, origin[1] + y, origin[2] - x * s + z * c]
    };
  }

  const layout = frame([0, 0, 0], layoutYaw);
  const station = (origin, yaw = 0) => frame(layout.at(origin), layoutYaw + yaw);

  function mesh(name, geometry, material, position, rotation = [0, 0, 0], parent = root) {
    const part = new THREE.Mesh(geometry, material);
    part.name = name;
    part.position.set(...position);
    part.rotation.set(...rotation);
    parent.add(part);
    return part;
  }

  function plate(base, name, [width, height, depth], position, style, radius = 0.035) {
    const part = holo.box([width, depth, height], base.at(position), {
      ...style,
      radius,
      rotation: [-halfPi, base.yaw, 0, "YXZ"]
    });
    part.name = name;
    shadeGlass(part, depth);
  }

  function block(base, name, size, position, style, radius = 0.008) {
    const part = holo.box(size, base.at(position), { ...style, radius, rotation: [0, base.yaw, 0] });
    part.name = name;
    shadeGlass(part, size[1], 1);
  }

  function shadeGlass(part, height, up = 2) {
    const source = part.material;
    if (!shadedMaterials.has(source)) {
      const material = source.clone();
      material.vertexColors = true;
      shadedMaterials.set(source, material);
    }
    part.material = shadedMaterials.get(source);
    const positions = part.geometry.getAttribute("position");
    const normals = part.geometry.getAttribute("normal");
    const colors = [];
    for (let i = 0; i < positions.count; i += 1) {
      const y = positions.getComponent(i, up) / height + 0.5;
      const top = Math.max(0, normals.getComponent(i, up));
      const litFace = Math.max(0, normals.getX(i));
      const light = 0.23 + 0.55 * y + 0.22 * top + 0.16 * litFace;
      colors.push(light * 0.8, light * 0.95, light);
    }
    part.geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  function barrel(base, name, radii, length, position, material, openEnded = true) {
    return mesh(name, new THREE.CylinderGeometry(...radii, length, 28, 1, openEnded), material,
      base.at(position), [halfPi, base.yaw, 0, "YXZ"]);
  }

  function ring(base, name, radius, thickness, position, material) {
    mesh(name, new THREE.TorusGeometry(radius, thickness, 6, 28), material,
      base.at(position), [0, base.yaw, 0]);
  }

  function reticle(base, center, radius) {
    for (const r of [radius, radius * 0.65]) {
      holo.line(Array.from({ length: 25 }, (_, i) => {
        const angle = i * Math.PI / 12;
        return base.at([center[0] + Math.cos(angle) * r, center[1], center[2] + Math.sin(angle) * r]);
      }), HOLO_CYAN, 0.34);
    }
  }

  // Parts use one root and one hologram batch so splitting builders adds no draws.
  return {
    THREE, root, holo, halfPi, diamondYaw,
    glass, carrier, amber, metal, cyanLight, amberLight, iceLight, contacts, jacket,
    layout, station, mesh, plate, block, barrel, ring, reticle
  };
}

export function batchHardwareFaces(root, THREE) {
  const byMaterial = new Map();
  for (const mesh of root.children) {
    if (!mesh.isMesh || mesh.userData.fault || mesh.name === "right-signal-port") continue;
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(mesh);
  }

  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const vertices = [];
    const normals = [];
    const colors = [];
    for (const mesh of meshes) {
      mesh.updateMatrix();
      normalMatrix.getNormalMatrix(mesh.matrix);
      const positions = mesh.geometry.getAttribute("position");
      const sourceNormals = mesh.geometry.getAttribute("normal");
      const sourceColors = mesh.geometry.getAttribute("color");
      const indices = mesh.geometry.getIndex();
      const count = indices ? indices.count : positions.count;
      for (let i = 0; i < count; i += 1) {
        const index = indices ? indices.getX(i) : i;
        point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrix);
        vertices.push(point.x, point.y, point.z);
        normal.fromBufferAttribute(sourceNormals, index).applyNormalMatrix(normalMatrix);
        normals.push(normal.x, normal.y, normal.z);
        if (sourceColors) colors.push(sourceColors.getX(index), sourceColors.getY(index), sourceColors.getZ(index));
      }
      root.remove(mesh);
      mesh.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    if (colors.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const batch = new THREE.Mesh(geometry, material);
    batch.name = "hardware-static-face-batch";
    batch.userData.partNames = [...new Set(meshes.map(mesh => mesh.name))];
    root.add(batch);
  }
}
