export function buildDataModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "data-model";

  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const bandGeometry = new THREE.TorusGeometry(0.54, 0.03, 6, 24);

  const shellMaterial = createRigMaterial(0x131a1f, 1, 0);
  const wallMaterial = createRigMaterial(0x2b3942, 1, 0);
  const platterMaterial = createRigMaterial(0x52616a, 1, 0);
  const darkMaterial = createRigMaterial(0x05090c, 1, 0);
  const bandMaterial = createRigMaterial(color, 1, 0);
  const accentMaterial = createRigBasicMaterial(color, 0.96);
  const statusMaterial = createRigBasicMaterial(
    VISUAL_COLORS.text ?? 0xf4f8fb,
    0.9
  );

  function addBatch(name, geometry, material, instances) {
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    const matrix = new THREE.Matrix4();
    const matrixPosition = new THREE.Vector3();
    const matrixRotation = new THREE.Euler();
    const matrixQuaternion = new THREE.Quaternion();
    const matrixScale = new THREE.Vector3();

    mesh.name = name;
    mesh.userData.instanceNames = instances.map(function (instance) {
      return instance.name;
    });

    instances.forEach(function (instance, index) {
      const rotation = instance.rotation ?? [0, 0, 0];
      matrixPosition.set(
        instance.position[0],
        instance.position[1],
        instance.position[2]
      );
      matrixRotation.set(rotation[0], rotation[1], rotation[2]);
      matrixQuaternion.setFromEuler(matrixRotation);
      matrixScale.set(instance.size[0], instance.size[1], instance.size[2]);
      matrix.compose(matrixPosition, matrixQuaternion, matrixScale);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    return mesh;
  }

  // Four heavy wall drums leave the storage platter edges exposed on every side.
  addBatch("data-wall-drums", unitCylinder, shellMaterial, [
    { name: "wall-drum-0", size: [0.5, 0.23, 0.5], position: [0, -0.435, 0] },
    { name: "wall-drum-1", size: [0.5, 0.23, 0.5], position: [0, -0.145, 0] },
    { name: "wall-drum-2", size: [0.5, 0.23, 0.5], position: [0, 0.145, 0] },
    { name: "wall-drum-3", size: [0.5, 0.23, 0.5], position: [0, 0.435, 0] }
  ]);

  addBatch("data-platter-stack", unitCylinder, platterMaterial, [
    { name: "bottom-deck", size: [0.565, 0.055, 0.565], position: [0, -0.58, 0] },
    { name: "storage-platter-0", size: [0.565, 0.055, 0.565], position: [0, -0.29, 0] },
    { name: "storage-platter-1", size: [0.565, 0.055, 0.565], position: [0, 0, 0] },
    { name: "storage-platter-2", size: [0.565, 0.055, 0.565], position: [0, 0.29, 0] },
    { name: "top-deck", size: [0.565, 0.055, 0.565], position: [0, 0.58, 0] },
    { name: "visible-bottom-hub", size: [0.24, 0.11, 0.24], position: [0, -0.665, 0] },
    { name: "visible-top-hub", size: [0.24, 0.11, 0.24], position: [0, 0.665, 0] }
  ]);

  addBatch("data-circumference-bands", bandGeometry, bandMaterial, [
    { name: "bottom-band", size: [1, 1, 1], position: [0, -0.58, 0], rotation: [Math.PI / 2, 0, 0] },
    { name: "platter-band-0", size: [1, 1, 1], position: [0, -0.29, 0], rotation: [Math.PI / 2, 0, 0] },
    { name: "platter-band-1", size: [1, 1, 1], position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] },
    { name: "platter-band-2", size: [1, 1, 1], position: [0, 0.29, 0], rotation: [Math.PI / 2, 0, 0] },
    { name: "top-band", size: [1, 1, 1], position: [0, 0.58, 0], rotation: [Math.PI / 2, 0, 0] }
  ]);

  const boxBatches = new Map([
    [wallMaterial, { name: "structure", instances: [] }],
    [darkMaterial, { name: "recesses", instances: [] }],
    [accentMaterial, { name: "active-status", instances: [] }],
    [statusMaterial, { name: "log-status", instances: [] }]
  ]);

  function addBox(name, size, position, material) {
    boxBatches.get(material).instances.push({ name, size, position });
  }

  // The front assembly presents an inset log/status window with physical depth.
  addBox("front-window-recess", [0.64, 0.48, 0.08], [0, 0.035, 0.59], darkMaterial);
  addBox("front-bezel-top", [0.74, 0.065, 0.1], [0, 0.31, 0.61], wallMaterial);
  addBox("front-bezel-bottom", [0.74, 0.065, 0.1], [0, -0.24, 0.61], wallMaterial);
  addBox("front-bezel-left", [0.065, 0.485, 0.1], [-0.37, 0.035, 0.61], wallMaterial);
  addBox("front-bezel-right", [0.065, 0.485, 0.1], [0.37, 0.035, 0.61], wallMaterial);
  addBox("status-header", [0.5, 0.04, 0.022], [0.025, 0.24, 0.665], accentMaterial);

  [
    { y: 0.16, width: 0.42, x: 0.025, material: statusMaterial },
    { y: 0.09, width: 0.5, x: 0.065, material: accentMaterial },
    { y: 0.02, width: 0.35, x: -0.01, material: statusMaterial },
    { y: -0.05, width: 0.46, x: 0.045, material: accentMaterial },
    { y: -0.12, width: 0.29, x: -0.04, material: statusMaterial },
    { y: -0.18, width: 0.4, x: 0.015, material: accentMaterial }
  ].forEach(function (log, index) {
    addBox(
      `front-log-line-${index}`,
      [log.width, 0.026, 0.022],
      [log.x, log.y, 0.665],
      log.material
    );
    addBox(
      `front-log-state-${index}`,
      [0.035, 0.035, 0.024],
      [-0.27, log.y, 0.667],
      index % 2 === 0 ? accentMaterial : statusMaterial
    );
  });

  // Side clamps keep the stacked vault silhouette legible at both 90-degree views.
  [-1, 1].forEach(function (side) {
    const sideName = side < 0 ? "left" : "right";
    addBox(`${sideName}-clamp`, [0.12, 0.82, 0.18], [side * 0.55, 0, 0], wallMaterial);
    addBox(`${sideName}-clamp-top`, [0.16, 0.1, 0.24], [side * 0.55, 0.46, 0], wallMaterial);
    addBox(`${sideName}-clamp-bottom`, [0.16, 0.1, 0.24], [side * 0.55, -0.46, 0], wallMaterial);

    [-0.18, 0, 0.18].forEach(function (y, index) {
      addBox(
        `${sideName}-aperture-${index}`,
        [0.034, 0.072, 0.1],
        [side * 0.62, y, 0],
        darkMaterial
      );
      addBox(
        `${sideName}-activity-${index}`,
        [0.018, 0.035, 0.112],
        [side * 0.641, y, 0],
        accentMaterial
      );
    });
  });

  // A keyed rear spine provides an unmistakable cable/connector elevation.
  addBox("rear-connector-spine", [0.24, 0.94, 0.13], [0, 0, -0.57], wallMaterial);
  addBox("rear-spine-top", [0.34, 0.1, 0.18], [0, 0.47, -0.57], wallMaterial);
  addBox("rear-spine-bottom", [0.34, 0.1, 0.18], [0, -0.47, -0.57], wallMaterial);

  [0.3, 0.1, -0.1, -0.3].forEach(function (y, index) {
    addBox(`rear-port-${index}`, [0.14, 0.12, 0.055], [0, y, -0.655], darkMaterial);
    addBox(`rear-port-key-${index}`, [0.08, 0.025, 0.02], [0, y, -0.694], accentMaterial);
  });

  boxBatches.forEach(function (batch, material) {
    addBatch(`data-${batch.name}-batch`, unitBox, material, batch.instances);
  });

  return {
    root,
    mechanicalParts: [],
    semanticRole: "data"
  };
}
