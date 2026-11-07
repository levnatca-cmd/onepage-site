export function buildBackendModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "backend-model";

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const shellMaterial = createRigMaterial(0x111a20, 1, 0);
  const frameMaterial = createRigMaterial(0x31434d, 1, 0);
  const moduleMaterial = createRigMaterial(0x1b2a32, 1, 0);
  const recessMaterial = createRigMaterial(0x05090c, 1, 0);
  const accentMaterial = createRigMaterial(color, 1, 0);
  const metalMaterial = createRigMaterial(
    VISUAL_COLORS.muted ?? VISUAL_COLORS.text,
    1,
    0
  );
  const onlineMaterial = createRigBasicMaterial(
    VISUAL_COLORS.hardware ?? VISUAL_COLORS.text,
    0.98
  );
  const warningMaterial = createRigBasicMaterial(
    VISUAL_COLORS.warning ?? color,
    0.98
  );

  const boxBatches = new Map([
    [shellMaterial, { name: "shell", instances: [] }],
    [frameMaterial, { name: "frame", instances: [] }],
    [moduleMaterial, { name: "module", instances: [] }],
    [recessMaterial, { name: "recess", instances: [] }],
    [accentMaterial, { name: "accent", instances: [] }],
    [metalMaterial, { name: "metal", instances: [] }],
    [onlineMaterial, { name: "online", instances: [] }],
    [warningMaterial, { name: "warning", instances: [] }]
  ]);

  function addBox(name, size, position, material) {
    boxBatches.get(material).instances.push({ name, size, position });
  }

  function addBoxBatches() {
    const matrix = new THREE.Matrix4();
    const matrixPosition = new THREE.Vector3();
    const matrixQuaternion = new THREE.Quaternion();
    const matrixScale = new THREE.Vector3();

    boxBatches.forEach(function (batch, material) {
      const mesh = new THREE.InstancedMesh(unitBox, material, batch.instances.length);
      mesh.name = `backend-${batch.name}-batch`;
      mesh.userData.instanceNames = batch.instances.map(function (instance) {
        return instance.name;
      });

      batch.instances.forEach(function (instance, index) {
        matrixPosition.set(instance.position[0], instance.position[1], instance.position[2]);
        matrixScale.set(instance.size[0], instance.size[1], instance.size[2]);
        matrix.compose(matrixPosition, matrixQuaternion, matrixScale);
        mesh.setMatrixAt(index, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    });
  }

  // The enclosed chassis and oversized caps establish the deep rack silhouette.
  addBox("enclosed-chassis", [1.34, 1.32, 0.76], [0, 0, 0], shellMaterial);
  addBox("top-cap", [1.52, 0.12, 0.92], [0, 0.72, 0], frameMaterial);
  addBox("bottom-cap", [1.52, 0.12, 0.92], [0, -0.72, 0], frameMaterial);
  addBox("top-service-deck", [0.86, 0.025, 0.56], [0, 0.792, 0], shellMaterial);
  addBox("bottom-reinforcement", [0.86, 0.025, 0.56], [0, -0.792, 0], shellMaterial);

  [-0.71, 0.71].forEach(function (x, sideIndex) {
    addBox(`front-rack-ear-${sideIndex}`, [0.1, 1.32, 0.12], [x, 0, 0.4], frameMaterial);
    addBox(`rear-upright-${sideIndex}`, [0.12, 1.32, 0.12], [x, 0, -0.4], frameMaterial);

    [-0.51, 0, 0.51].forEach(function (y, railIndex) {
      addBox(
        `side-rail-${sideIndex}-${railIndex}`,
        [0.12, 0.09, 0.78],
        [x, y, 0],
        frameMaterial
      );
    });
  });

  // Eight removable front cartridges, each with a pull handle and two indicators.
  addBox("front-bay-recess", [1.2, 1.15, 0.04], [0, 0, 0.39], recessMaterial);
  [-0.57, -0.285, 0, 0.285, 0.57].forEach(function (y, index) {
    addBox(`front-row-divider-${index}`, [1.13, 0.024, 0.07], [0, y, 0.438], frameMaterial);
  });
  addBox("front-column-divider", [0.032, 1.13, 0.07], [0, 0, 0.438], frameMaterial);

  const frontRows = [0.43, 0.145, -0.145, -0.43];
  const frontColumns = [-0.29, 0.29];
  frontRows.forEach(function (y, rowIndex) {
    frontColumns.forEach(function (x, columnIndex) {
      const bayIndex = rowIndex * frontColumns.length + columnIndex;
      const outerDirection = columnIndex === 0 ? -1 : 1;

      addBox(
        `hot-swap-bay-${bayIndex}`,
        [0.52, 0.22, 0.055],
        [x, y, 0.425],
        moduleMaterial
      );
      addBox(
        `hot-swap-air-slot-${bayIndex}`,
        [0.31, 0.11, 0.022],
        [x - outerDirection * 0.025, y, 0.463],
        recessMaterial
      );
      addBox(
        `hot-swap-handle-${bayIndex}`,
        [0.045, 0.145, 0.026],
        [x + outerDirection * 0.205, y, 0.482],
        metalMaterial
      );

      const indicatorX = x - outerDirection * 0.19;
      addBox(
        `bay-online-indicator-${bayIndex}`,
        [0.028, 0.026, 0.025],
        [indicatorX, y + 0.04, 0.486],
        bayIndex === 3 || bayIndex === 6 ? warningMaterial : onlineMaterial
      );
      addBox(
        `bay-activity-indicator-${bayIndex}`,
        [0.028, 0.026, 0.025],
        [indicatorX, y - 0.04, 0.486],
        accentMaterial
      );
    });
  });

  [-0.71, 0.71].forEach(function (x, sideIndex) {
    [0.48, 0, -0.48].forEach(function (y, mountIndex) {
      addBox(
        `front-ear-slot-${sideIndex}-${mountIndex}`,
        [0.036, 0.075, 0.025],
        [x, y, 0.472],
        recessMaterial
      );
    });
  });

  // Twin vent banks and full-depth rails make both side elevations unmistakable.
  [-1, 1].forEach(function (sideSign, sideIndex) {
    addBox(
      `side-service-panel-${sideIndex}`,
      [0.028, 0.87, 0.58],
      [sideSign * 0.686, 0, 0],
      moduleMaterial
    );

    [-0.17, 0.17].forEach(function (z, bankIndex) {
      [0.36, 0.245, 0.13, -0.13, -0.245, -0.36].forEach(function (y, ventIndex) {
        addBox(
          `side-vent-${sideIndex}-${bankIndex}-${ventIndex}`,
          [0.022, 0.048, 0.23],
          [sideSign * 0.708, y, z],
          recessMaterial
        );
      });
    });

    [-0.33, 0.33].forEach(function (z, markerIndex) {
      addBox(
        `side-signal-marker-${sideIndex}-${markerIndex}`,
        [0.026, 0.31, 0.025],
        [sideSign * 0.711, 0, z],
        accentMaterial
      );
    });
  });

  // The rear carries a framed backplane, two I/O rows, and redundant cable ports.
  addBox("rear-backplane-recess", [1.2, 1.14, 0.04], [0, 0, -0.39], recessMaterial);
  [-0.58, 0.58].forEach(function (x, index) {
    addBox(`rear-backplane-side-${index}`, [0.065, 1.12, 0.07], [x, 0, -0.425], frameMaterial);
  });
  [-0.55, 0.55].forEach(function (y, index) {
    addBox(`rear-backplane-edge-${index}`, [1.16, 0.055, 0.07], [0, y, -0.425], frameMaterial);
  });

  [0.38, 0.18].forEach(function (y, rowIndex) {
    addBox(`rear-io-panel-${rowIndex}`, [1.03, 0.16, 0.055], [0, y, -0.425], moduleMaterial);

    [-0.39, -0.234, -0.078, 0.078, 0.234, 0.39].forEach(function (x, portIndex) {
      addBox(
        `rear-io-frame-${rowIndex}-${portIndex}`,
        [0.115, 0.08, 0.026],
        [x, y, -0.466],
        metalMaterial
      );
      addBox(
        `rear-io-aperture-${rowIndex}-${portIndex}`,
        [0.074, 0.043, 0.018],
        [x, y, -0.489],
        recessMaterial
      );
    });
  });

  addBox("rear-vent-panel", [1.03, 0.14, 0.05], [0, -0.02, -0.425], moduleMaterial);
  [-0.42, -0.3, -0.18, -0.06, 0.06, 0.18, 0.3, 0.42].forEach(function (x, index) {
    addBox(`rear-vent-${index}`, [0.065, 0.065, 0.024], [x, -0.02, -0.466], recessMaterial);
  });

  [-0.275, 0.275].forEach(function (x, powerIndex) {
    const cableDirection = powerIndex === 0 ? -1 : 1;
    addBox(
      `rear-power-module-${powerIndex}`,
      [0.49, 0.31, 0.06],
      [x, -0.34, -0.425],
      moduleMaterial
    );
    addBox(
      `rear-power-vent-${powerIndex}`,
      [0.245, 0.17, 0.026],
      [x - cableDirection * 0.065, -0.34, -0.47],
      recessMaterial
    );
    addBox(
      `rear-cable-port-frame-${powerIndex}`,
      [0.12, 0.13, 0.032],
      [x + cableDirection * 0.155, -0.34, -0.473],
      metalMaterial
    );
    addBox(
      `rear-cable-port-${powerIndex}`,
      [0.072, 0.082, 0.02],
      [x + cableDirection * 0.155, -0.34, -0.5],
      recessMaterial
    );
  });

  addBox("rear-cable-retainer", [0.78, 0.045, 0.055], [0, -0.515, -0.468], metalMaterial);
  [-0.28, 0, 0.28].forEach(function (x, index) {
    addBox(`rear-cable-pass-${index}`, [0.14, 0.07, 0.024], [x, -0.515, -0.505], recessMaterial);
  });

  addBoxBatches();

  root.userData.signalMarkers = [
    { role: "request-ingress", position: [-0.29, 0.43, 0.5] },
    { role: "request-egress", position: [0.29, -0.43, 0.5] },
    { role: "backplane", position: [0, 0.28, -0.51] }
  ];

  return {
    root,
    mechanicalParts: [],
    semanticRole: "api"
  };
}
