import { createHologram, HOLO_AMBER, HOLO_CYAN, HOLO_ICE } from "./hologram.js?v=wow60";
import { addModelSignalPackets } from "./signal-packets.js?v=wow60";

export function buildDataModel(_color, { THREE, part }) {
  const root = new THREE.Group();
  root.name = "data-model";
  const holo = createHologram(root);
  const includes = (id) => !part || part === id;
  const rims = [];
  const archive = [
    [1.84, -0.04], [1.81, -0.17], [1.77, -0.28], [1.73, -0.37],
    [1.69, -0.45], [1.65, -0.52], [1.61, -0.58], [1.56, -0.635],
    [1.52, -0.69], [1.47, -0.745], [1.42, -0.80], [1.36, -0.855], [1.29, -0.91]
  ];
  const index = [1.66, 0.12];
  const scan = [1.37, 0.79];
  const [indexWidth, indexY] = index;
  const [scanWidth, scanY] = scan;

  function corners(width, y) {
    const half = width / 2;
    return [[-half, y, -half], [-half, y, half], [half, y, half], [half, y, -half]];
  }

  function outline(width, y, color, opacity) {
    const points = corners(width, y);
    holo.line([...points, points[0]], color, opacity);
  }

  function grid(width, y, divisions, color, opacity) {
    const edge = width / 2;
    for (let i = 1; i < divisions; i += 1) {
      const offset = width * (i / divisions - 0.5);
      holo.line([[-edge, y, offset], [edge, y, offset]], color, opacity);
      holo.line([[offset, y, -edge], [offset, y, edge]], color, opacity);
    }
  }

  function sheets(name, layers, color, opacity, gradient) {
    const positions = [];
    const colors = [];
    const indices = [];
    layers.forEach(function ([width, y], layer) {
      const offset = positions.length / 3;
      const [rimAlpha, centerAlpha] = gradient(layer);
      positions.push(...corners(width, y).flat(), 0, y, 0);
      for (let i = 0; i < 4; i += 1) {
        colors.push(1, 1, 1, rimAlpha);
        indices.push(offset + i, offset + (i + 1) % 4, offset + 4);
      }
      colors.push(1, 1, 1, centerAlpha);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const material = holo.glass(color, opacity);
    material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    root.add(mesh);
  }

  // Broad illuminated lips separate the sheets even when the thinner grid disappears on a phone.
  function addRimLight(layers) {
    const positions = [];
    const colors = [];
    const indices = [];
    for (const [[width, y], tint, strength, falloff] of layers) {
      const offset = positions.length / 3;
      const color = new THREE.Color(tint);
      positions.push(...corners(width, y).flat(), ...corners(width - falloff, y).flat());
      for (let i = 0; i < 8; i += 1) colors.push(color.r, color.g, color.b, i < 4 ? strength : 0);
      for (let i = 0; i < 4; i += 1) {
        const a = offset + i;
        const b = offset + (i + 1) % 4;
        indices.push(a, b, b + 4, a, b + 4, a + 4);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.81,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      depthWrite: false,
      toneMapped: false
    }));
    mesh.name = "illuminated-sheet-rims";
    mesh.renderOrder = 10;
    root.add(mesh);
  }

  if (includes("archive")) addArchive();
  if (includes("index")) addSearchIndex();
  if (includes("scan")) addScanner();
  if (includes("columns")) addDataColumns();
  if (rims.length) addRimLight(rims);
  holo.finish();

  return { root, mechanicalParts: [], semanticRole: "data" };

  function addArchive() {
    sheets("indexed-record-layer", archive, HOLO_CYAN, 0.13, layer => [0.23 + layer * 0.012, 0.05]);
    rims.push(...archive.map((layer, i) => [layer, HOLO_CYAN, i === 0 ? 0.69 : 0.23 + i * 0.019, 0.10 + i * 0.003]));
    const archiveRecords = [];
    const archiveHighlights = [];
    const random = recordRandom(71);

    // Older trays get denser, with illuminated addresses along all four edges.
    archive.forEach(([width, y], layer) => {
      if (layer === 0) outline(width, y, HOLO_ICE, 0.94);
      else outline(width, y, HOLO_CYAN, layer >= 8 || layer % 2 === 0 ? 0.63 : 0.44);
      grid(width, y, 8, HOLO_CYAN, 0.08);
      const recordY = y + 0.006;
      const edge = width * 0.465;
      const rows = 7 + Math.floor(layer / 3);
      const columns = 12 + Math.floor(layer / 2);
      const pitch = 2 * edge / columns;
      for (let row = 1; row < rows; row += 1) {
        const z = edge * (2 * row / rows - 1);
        for (let column = 1; column < columns; column += 1) {
          if (random() < 0.18) continue;
          const x = -edge + (column + (random() - 0.5) * 0.44) * pitch;
          const batch = (column + row + layer) % 9 === 0 ? archiveHighlights : archiveRecords;
          batch.push([x, recordY, z]);
        }
      }
      for (const side of [-1, 1]) {
        for (let i = 1; i < columns; i += 1) {
          const offset = -edge + (i + (random() - 0.5) * 0.3) * pitch;
          const batch = (i + layer) % 4 === 0 ? archiveHighlights : archiveRecords;
          batch.push([offset, recordY, side * edge], [side * edge, recordY, -offset]);
        }
      }
    });

    const cornersOfArchive = [...corners(...archive[0]), ...corners(...archive.at(-1))];
    holo.dots(archiveRecords, HOLO_CYAN, 0.028, 0.78);
    holo.dots(archiveHighlights, HOLO_ICE, 0.036, 0.96);
    holo.glow(archiveHighlights.filter((_, i) => i % 3 === 0), HOLO_CYAN, 0.09, 0.25);
    holo.dots(cornersOfArchive, HOLO_ICE, 0.048, 0.98);
    holo.glow(cornersOfArchive, HOLO_CYAN, 0.16, 0.42);
  }

  function addSearchIndex() {
    sheets("amber-search-index", [index], HOLO_AMBER, 0.34, () => [0.47, 0.14]);
    rims.push([index, HOLO_AMBER, 1, 0.165]);
    outline(indexWidth, indexY, HOLO_AMBER, 1);
    grid(indexWidth, indexY, 10, HOLO_AMBER, 0.26);
    const indexMarkers = [];
    visitColumnGrid(function (x, z, _row, _column, bright) {
      if (bright) indexMarkers.push([x, indexY + 0.006, z]);
    });
    const amberCorners = corners(...index);
    holo.dots(indexMarkers, HOLO_AMBER, 0.041, 0.96);
    holo.dots(amberCorners, HOLO_AMBER, 0.052, 1);
    holo.glow(amberCorners, HOLO_AMBER, 0.18, 0.48);
  }

  function addScanner() {
    sheets("floating-cyan-scan-plane", [scan], HOLO_CYAN, 0.42, () => [0.52, 0.20]);
    rims.push([scan, HOLO_CYAN, 0.92, 0.15]);
    outline(scanWidth, scanY, HOLO_ICE, 0.94);
    grid(scanWidth, scanY, 8, HOLO_CYAN, 0.32);
    const scanPoints = [];
    const brightScanPoints = [];
    visitColumnGrid(function (x, z, _row, _column, bright) {
      (bright ? brightScanPoints : scanPoints).push([x, scanY + 0.006, z]);
    });
    const reticleY = scanY + 0.008;
    for (const radius of [0.073, 0.117, 0.171, 0.231]) {
      const ring = Array.from({ length: 49 }, (_, i) => {
        const angle = i * Math.PI / 24;
        return [radius * Math.cos(angle), reticleY, radius * Math.sin(angle)];
      });
      holo.line(ring, HOLO_ICE, 0.94);
    }
    for (let i = 0; i < 8; i += 1) {
      const x = Math.cos(i * Math.PI / 4);
      const z = Math.sin(i * Math.PI / 4);
      holo.line([[x * 0.236, reticleY, z * 0.236], [x * 0.267, reticleY, z * 0.267]], HOLO_CYAN, 0.63);
    }
    const scanCorners = corners(...scan);
    holo.dots(scanPoints, HOLO_CYAN, 0.017, 0.62);
    holo.dots(brightScanPoints, HOLO_ICE, 0.032, 0.94);
    holo.dots(scanCorners, HOLO_ICE, 0.048, 0.98);
    holo.dots([[0, reticleY, 0]], HOLO_ICE, 0.095, 1);
    holo.glow(scanCorners, HOLO_CYAN, 0.16, 0.42);
    holo.glow([[0, reticleY, 0]], HOLO_CYAN, 0.33, 0.72);
  }

  function addDataColumns() {
    for (const [width, y] of [[1.65, 0.29], [1.65, 0.435]]) {
      const edge = width / 2;
      for (let i = 0; i < 24; i += 1) {
        const start = -edge + width * i / 24;
        const end = start + width * 0.52 / 24;
        for (const side of [-edge, edge]) {
          holo.line([[side, y, start], [side, y, end]], HOLO_ICE, 0.31);
          holo.line([[start, y, side], [end, y, side]], HOLO_ICE, 0.31);
        }
      }
      grid(width, y, 4, HOLO_CYAN, 0.13);
    }
    const records = [];
    const brightRecords = [];
    // Preserve the column seed from the original model after the archive sampled its records.
    const random = recordRandom(1769618121);
    const packetColumns = new Map([
      ["-2,-1", [0.04, HOLO_CYAN]], ["-1,2", [0.47, 0x68fce2]],
      ["0,0", [0.23, HOLO_CYAN]], ["1,-2", [0.68, HOLO_CYAN]],
      ["2,1", [0.84, HOLO_AMBER]]
    ]);
    const routes = [];
    visitColumnGrid(function (x, z, row, column, bright) {
      const trayY = archive[Math.max(Math.abs(row), Math.abs(column))][1];
      holo.line([[x, indexY, z], [x, scanY, z]], HOLO_CYAN, bright ? 0.43 : 0.13);
      holo.line([[x, trayY, z], [x, indexY, z]], HOLO_AMBER, 0.26);
      (bright ? brightRecords : records).push([x, indexY + 0.045 + random() * 0.56, z]);
      records.push([x, indexY + 0.05 + random() * 0.56, z]);
      const packet = packetColumns.get([row, column].join(","));
      if (packet) {
        const [phase, color] = packet;
        routes.push({
          curve: new THREE.LineCurve3(new THREE.Vector3(x, trayY, z), new THREE.Vector3(x, scanY, z)),
          size: 1,
          phase,
          color
        });
      }
    });
    holo.dots(records, HOLO_CYAN, 0.017, 0.62);
    holo.dots(brightRecords, HOLO_ICE, 0.032, 0.94);
    holo.glow(brightRecords.filter((_, i) => i % 4 === 1), HOLO_CYAN, 0.16, 0.42);
    root.userData.modelSignals = addModelSignalPackets({ THREE, root }, routes, { radius: 0.046, speed: 0.57 });
  }

  function visitColumnGrid(visit) {
    const step = scanWidth / 8;
    for (let row = -3; row <= 3; row += 1) {
      for (let column = -3; column <= 3; column += 1) {
        if (Math.abs(row) + Math.abs(column) === 6) continue;
        visit(column * step, row * step, row, column, (row + column) % 2 === 0);
      }
    }
  }
}

function recordRandom(seed) {
  return function () {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}
