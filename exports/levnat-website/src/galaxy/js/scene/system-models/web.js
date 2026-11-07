export function buildWebModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "web-model";

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const bodyMaterial = createRigMaterial(0x17232c, 1, 0.02);
  const bezelMaterial = createRigMaterial(0x243540, 1, 0.025);
  const darkMaterial = createRigMaterial(0x070c10, 1, 0);
  const screenMaterial = createRigMaterial(0x081820, 1, 0.01);
  const accentMaterial = createRigMaterial(color, 0.98, 0.06);
  const uiMaterial = createRigBasicMaterial(color, 0.92);
  const uiTextMaterial = createRigBasicMaterial(VISUAL_COLORS.text, 0.82);
  const uiMutedMaterial = createRigBasicMaterial(
    VISUAL_COLORS.muted ?? VISUAL_COLORS.text,
    0.62
  );

  const boxBatches = new Map([
    [bodyMaterial, { name: "body", instances: [] }],
    [bezelMaterial, { name: "bezel", instances: [] }],
    [darkMaterial, { name: "dark", instances: [] }],
    [screenMaterial, { name: "screen", instances: [] }],
    [accentMaterial, { name: "accent", instances: [] }],
    [uiMaterial, { name: "ui", instances: [] }],
    [uiTextMaterial, { name: "ui-text", instances: [] }],
    [uiMutedMaterial, { name: "ui-muted", instances: [] }]
  ]);

  function addBox(name, size, position, material, rotation) {
    boxBatches.get(material).instances.push({ name, size, position, rotation });
  }

  function addBoxBatches() {
    const matrix = new THREE.Matrix4();
    const matrixPosition = new THREE.Vector3();
    const matrixRotation = new THREE.Euler();
    const matrixQuaternion = new THREE.Quaternion();
    const matrixScale = new THREE.Vector3();

    boxBatches.forEach(function (batch, material) {
      if (!batch.instances.length) return;

      const mesh = new THREE.InstancedMesh(unitBox, material, batch.instances.length);
      mesh.name = `web-${batch.name}-batch`;
      mesh.userData.instanceNames = batch.instances.map(function (instance) {
        return instance.name;
      });

      batch.instances.forEach(function (instance, index) {
        const rotation = instance.rotation ?? [0, 0, 0];
        matrixPosition.set(instance.position[0], instance.position[1], instance.position[2]);
        matrixRotation.set(rotation[0], rotation[1], rotation[2]);
        matrixQuaternion.setFromEuler(matrixRotation);
        matrixScale.set(instance.size[0], instance.size[1], instance.size[2]);
        matrix.compose(matrixPosition, matrixQuaternion, matrixScale);
        mesh.setMatrixAt(index, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    });
  }

  // Deep shell and raised rails leave the browser face visibly inset.
  addBox("chassis", [1.52, 0.88, 0.36], [0, 0.13, -0.02], bodyMaterial);
  addBox("bezel-top", [1.48, 0.1, 0.1], [0, 0.52, 0.16], bezelMaterial);
  addBox("bezel-bottom", [1.48, 0.1, 0.1], [0, -0.26, 0.16], bezelMaterial);
  addBox("bezel-left", [0.1, 0.68, 0.1], [-0.69, 0.13, 0.16], bezelMaterial);
  addBox("bezel-right", [0.1, 0.68, 0.1], [0.69, 0.13, 0.16], bezelMaterial);
  addBox("screen-recess", [1.32, 0.66, 0.026], [0, 0.13, 0.164], darkMaterial);
  addBox("screen", [1.25, 0.59, 0.018], [0, 0.13, 0.18], screenMaterial);

  // Shallow browser chrome reads as interface structure without rendered text.
  addBox("browser-chrome", [1.23, 0.1, 0.012], [0, 0.365, 0.196], accentMaterial);
  [-0.56, -0.5, -0.44].forEach(function (x, index) {
    addBox(
      `window-control-${index}`,
      [0.034, 0.034, 0.014],
      [x, 0.365, 0.204],
      index === 0 ? uiTextMaterial : uiMutedMaterial
    );
  });
  addBox("address-field", [0.78, 0.038, 0.014], [0.14, 0.365, 0.204], darkMaterial);
  addBox("page-sidebar", [0.16, 0.39, 0.012], [-0.5, 0.075, 0.196], uiMutedMaterial);
  addBox("page-hero", [0.65, 0.12, 0.012], [0.12, 0.22, 0.196], uiMaterial);
  addBox("content-line-wide", [0.48, 0.035, 0.012], [0.035, 0.105, 0.196], uiTextMaterial);
  addBox("content-line-short", [0.34, 0.028, 0.012], [-0.035, 0.045, 0.196], uiMutedMaterial);
  addBox("content-card-left", [0.28, 0.14, 0.012], [-0.11, -0.075, 0.196], uiMutedMaterial);
  addBox("content-card-right", [0.28, 0.14, 0.012], [0.25, -0.075, 0.196], uiTextMaterial);
  addBox("content-action", [0.15, 0.05, 0.014], [0.35, -0.195, 0.2], uiMaterial);

  // Rear relief keeps the monitor readable from 180 degrees.
  addBox("back-panel", [1.36, 0.7, 0.045], [0, 0.13, -0.215], bezelMaterial);
  addBox("back-service-panel", [0.88, 0.48, 0.022], [0.12, 0.14, -0.248], darkMaterial);
  [0.29, 0.22, 0.15, 0.08].forEach(function (y, index) {
    addBox(`back-vent-${index}`, [0.38, 0.028, 0.018], [0.14, y, -0.266], uiMutedMaterial);
  });
  addBox("back-spine", [0.09, 0.43, 0.025], [-0.48, 0.14, -0.25], accentMaterial);
  addBox("back-cable-bay", [0.36, 0.1, 0.025], [0.12, -0.2, -0.262], darkMaterial);

  // Opposing vent and port treatments distinguish both side elevations.
  addBox("side-rail-left", [0.045, 0.72, 0.28], [-0.772, 0.13, -0.02], bezelMaterial);
  addBox("side-rail-right", [0.045, 0.72, 0.28], [0.772, 0.13, -0.02], bezelMaterial);
  [0.3, 0.2, 0.1, 0].forEach(function (y, index) {
    addBox(`side-vent-${index}`, [0.026, 0.045, 0.17], [-0.802, y, -0.02], darkMaterial);
  });
  [0.14, -0.08].forEach(function (y, index) {
    addBox(`port-frame-${index}`, [0.03, 0.13, 0.15], [0.802, y, -0.03], accentMaterial);
    addBox(`port-aperture-${index}`, [0.018, 0.075, 0.09], [0.827, y, -0.03], darkMaterial);
  });

  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1, 12, 1, false),
    accentMaterial
  );
  hinge.name = "web-stand-hinge";
  hinge.position.set(0, -0.31, -0.09);
  hinge.scale.set(1, 0.3, 1);
  hinge.rotation.z = Math.PI / 2;
  root.add(hinge);

  addBox("stand-neck", [0.2, 0.36, 0.19], [0, -0.49, -0.09], bodyMaterial, [-0.06, 0, 0]);
  addBox("stand-neck-spine", [0.06, 0.26, 0.024], [0, -0.48, 0.014], accentMaterial, [-0.06, 0, 0]);
  addBox("stand-foot", [0.94, 0.1, 0.56], [0, -0.7, -0.04], bodyMaterial);
  addBox("stand-foot-deck", [0.62, 0.026, 0.34], [0, -0.637, -0.04], bezelMaterial);
  [-0.31, 0.31].forEach(function (x, index) {
    addBox(`stand-pad-${index}`, [0.2, 0.025, 0.32], [x, -0.758, -0.04], darkMaterial);
  });

  addBoxBatches();

  return {
    root,
    mechanicalParts: [],
    semanticRole: "web"
  };
}
