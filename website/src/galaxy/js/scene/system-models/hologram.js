import * as THREE from "../../../../../vendor/three/three.module.min.js";

export const HOLO_CYAN = 0x66efff;
export const HOLO_AMBER = 0xffbd65;
export const HOLO_ICE = 0xe3fbff;

const POINT_MASK_SIZE = 16;
const pointMask = createPointMask();

export function createHologram(root) {
  const materials = new Map();
  const lineBatches = new Map();
  const pointBatches = new Map();
  const edgePoint = new THREE.Vector3();

  function material(color, opacity, glass, maskBehind = false) {
    const key = `${color}/${opacity}/${glass}/${maskBehind}`;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: glass || opacity < 1,
        depthWrite: maskBehind || (!glass && opacity === 1),
        side: glass && !maskBehind ? THREE.DoubleSide : THREE.FrontSide,
        forceSinglePass: true,
        toneMapped: false
      }));
    }
    return materials.get(key);
  }

  function line(points, color = HOLO_CYAN, opacity = 0.85) {
    const vertices = getBatch(lineBatches, color, opacity).vertices;
    for (let index = 1; index < points.length; index += 1) {
      appendPoint(vertices, points[index - 1]);
      appendPoint(vertices, points[index]);
    }
  }

  function dots(points, color = HOLO_ICE, size = 0.036, opacity = 0.92) {
    const vertices = getBatch(pointBatches, color, opacity, size).vertices;
    for (const point of points) appendPoint(vertices, point);
  }

  function glow(points, color, size = 0.24, opacity = 0.42) {
    const vertices = getBatch(pointBatches, color, opacity, size, true).vertices;
    for (const point of points) appendPoint(vertices, point);
  }

  function box(size, position, options = {}) {
    const {
      color = HOLO_CYAN,
      opacity = 0.17,
      edgeColor = color,
      edgeOpacity = 0.84,
      radius = 0,
      rotation = [0, 0, 0],
      maskBehind = false
    } = options;
    const geometry = radius > 0 ? createRoundedPlate(size, radius) : new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, material(color, opacity, true, maskBehind));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);

    if (edgeOpacity > 0) {
      mesh.updateMatrix();
      const edges = new THREE.EdgesGeometry(geometry, 35);
      const attribute = edges.getAttribute("position");
      const vertices = getBatch(lineBatches, edgeColor, edgeOpacity).vertices;
      for (let index = 0; index < attribute.count; index += 1) {
        edgePoint.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrix);
        appendPoint(vertices, edgePoint);
      }
      edges.dispose();
    }
    return mesh;
  }

  function finish() {
    for (const {color, opacity, vertices} of lineBatches.values()) {
      if (!vertices.length) continue;
      const outlines = new THREE.LineSegments(createGeometry(vertices), new THREE.LineBasicMaterial({
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        toneMapped: false
      }));
      outlines.renderOrder = 11;
      root.add(outlines);
    }
    for (const { color, opacity, size, additive, vertices } of pointBatches.values()) {
      if (!vertices.length) continue;
      const points = new THREE.Points(createGeometry(vertices), new THREE.PointsMaterial({
        color,
        opacity,
        size,
        map: pointMask,
        transparent: true,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
        toneMapped: false
      }));
      points.renderOrder = additive ? 13 : 12;
      root.add(points);
    }
    lineBatches.clear();
    pointBatches.clear();
  }

  return {
    box,
    line,
    dots,
    glow,
    glass: (color = HOLO_CYAN, opacity = 0.18) => material(color, opacity, true),
    light: (color = HOLO_ICE, opacity = 1) => material(color, opacity, false),
    finish
  };
}

function getBatch(batches, color, opacity, size, additive = false) {
  const key = `${color}/${opacity}/${size ?? "line"}/${additive}`;
  if (!batches.has(key)) batches.set(key, { color, opacity, size, additive, vertices: [] });
  return batches.get(key);
}

function appendPoint(vertices, point) {
  if (Array.isArray(point)) vertices.push(point[0], point[1], point[2]);
  else vertices.push(point.x, point.y, point.z);
}

function createGeometry(vertices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function createRoundedPlate([width, height, depth], radius) {
  const x = width / 2;
  const y = height / 2;
  const r = Math.min(radius, x, y);
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
  return geometry.translate(0, 0, -depth / 2);
}

function createPointMask() {
  const size = POINT_MASK_SIZE;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const distance = Math.hypot((x + 0.5) * 2 / size - 1, (y + 0.5) * 2 / size - 1);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(255 * (1 - THREE.MathUtils.smoothstep(distance, 0.26, 1)));
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.userData.sharedResource = true;
  texture.needsUpdate = true;
  return texture;
}
