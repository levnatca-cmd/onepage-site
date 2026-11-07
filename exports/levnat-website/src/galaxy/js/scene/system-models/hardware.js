export function buildHardwareModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "hardware-model";

  const assembly = new THREE.Group();
  assembly.name = "hardware-assembly";
  assembly.rotation.set(-0.05, 0.16, -0.035);
  root.add(assembly);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);

  const boardMaterial = createRigMaterial(0x0b3027, 1, 0.005);
  const componentMaterial = createRigMaterial(0x070b0d, 1, 0.002);
  const metalMaterial = createRigMaterial(
    VISUAL_COLORS.muted ?? VISUAL_COLORS.text ?? 0x91a3ab,
    1,
    0.006
  );
  const copperMaterial = createRigBasicMaterial(0xc99745, 0.98);
  const traceMaterial = createRigBasicMaterial(color, 0.92);
  const capacitorMaterial = createRigMaterial(0x174b5c, 1, 0.006);
  const diagnosticMaterial = createRigBasicMaterial(color, 0.94);

  const substrate = [];
  const components = [];
  const metalwork = [];
  const copperBoxes = [];
  const traces = [];
  const capacitorBodies = [];
  const metalCylinders = [];
  const solderPads = [];

  function addInstance(instances, name, scale, position, rotation) {
    instances.push({
      name,
      scale,
      position,
      rotation: rotation ?? [0, 0, 0]
    });
  }

  function addBatch(name, geometry, material, instances) {
    if (!instances.length) return;

    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    const matrix = new THREE.Matrix4();
    const matrixPosition = new THREE.Vector3();
    const matrixRotation = new THREE.Euler();
    const matrixQuaternion = new THREE.Quaternion();
    const matrixScale = new THREE.Vector3();

    mesh.name = `hardware-${name}-batch`;
    mesh.userData.instanceNames = instances.map(function (instance) {
      return instance.name;
    });

    instances.forEach(function (instance, index) {
      matrixPosition.set(
        instance.position[0],
        instance.position[1],
        instance.position[2]
      );
      matrixRotation.set(
        instance.rotation[0],
        instance.rotation[1],
        instance.rotation[2]
      );
      matrixQuaternion.setFromEuler(matrixRotation);
      matrixScale.set(instance.scale[0], instance.scale[1], instance.scale[2]);
      matrix.compose(matrixPosition, matrixQuaternion, matrixScale);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    assembly.add(mesh);
  }

  // Overlapping dark-green sections produce an asymmetric PCB with visible steps and cutouts.
  addInstance(substrate, "pcb-core", [1.02, 0.64, 0.24], [-0.08, 0, 0]);
  addInstance(substrate, "pcb-top-shoulder", [0.68, 0.24, 0.24], [-0.25, 0.41, 0]);
  addInstance(substrate, "pcb-io-wing", [0.34, 0.47, 0.3], [0.59, 0.04, 0]);
  addInstance(substrate, "pcb-connector-tongue", [0.6, 0.18, 0.2], [-0.1, -0.41, 0]);
  addInstance(substrate, "pcb-service-tab", [0.25, 0.22, 0.28], [-0.69, -0.16, 0]);

  // Raised packages populate the front and provide dark mass between the metallic parts.
  addInstance(components, "front-processor-package", [0.46, 0.34, 0.12], [-0.24, 0.11, 0.18]);
  addInstance(components, "front-memory-upper", [0.26, 0.11, 0.1], [0.24, 0.22, 0.17]);
  addInstance(components, "front-memory-lower", [0.26, 0.11, 0.1], [0.24, 0.06, 0.17]);
  addInstance(components, "front-control-chip", [0.27, 0.2, 0.14], [0.24, -0.18, 0.19]);
  addInstance(components, "front-power-stage", [0.21, 0.14, 0.12], [-0.42, -0.22, 0.18]);

  addInstance(components, "rear-controller", [0.3, 0.22, 0.14], [0.25, 0.17, -0.19]);
  addInstance(components, "rear-memory", [0.26, 0.12, 0.12], [0.25, -0.03, -0.18]);
  addInstance(components, "rear-power-stage", [0.27, 0.17, 0.16], [0.24, -0.21, -0.2]);
  addInstance(components, "rear-logic-chip", [0.2, 0.16, 0.14], [-0.48, -0.15, -0.19]);

  // Dark apertures sit on the outward faces of four strongly protruding edge connectors.
  addInstance(components, "right-port-upper-aperture", [0.025, 0.1, 0.27], [0.89, 0.15, 0.02]);
  addInstance(components, "right-port-lower-aperture", [0.025, 0.085, 0.23], [0.89, -0.12, -0.01]);
  addInstance(components, "left-service-aperture", [0.025, 0.085, 0.22], [-0.9, 0.19, -0.01]);
  addInstance(components, "left-barrel-aperture", [0.025, 0.13, 0.13], [-0.94, -0.17, 0.03]);

  // The heatsink rises far beyond the PCB thickness so quarter-turn views retain depth.
  addInstance(metalwork, "heatsink-base", [0.52, 0.38, 0.08], [-0.24, 0.11, 0.28]);
  [-0.43, -0.335, -0.24, -0.145, -0.05].forEach(function (x, index) {
    addInstance(
      metalwork,
      `heatsink-fin-${index}`,
      [0.055, 0.34, 0.3],
      [x, 0.11, 0.47]
    );
  });
  addInstance(metalwork, "heatsink-top-rail", [0.5, 0.045, 0.045], [-0.24, 0.29, 0.61]);

  addInstance(metalwork, "right-port-upper-shell", [0.27, 0.2, 0.5], [0.75, 0.15, 0.02]);
  addInstance(metalwork, "right-port-lower-shell", [0.27, 0.17, 0.44], [0.75, -0.12, -0.01]);
  addInstance(metalwork, "left-service-shell", [0.24, 0.17, 0.4], [-0.78, 0.19, -0.01]);
  addInstance(metalwork, "rear-emi-shield", [0.46, 0.31, 0.15], [-0.25, 0.13, -0.205]);
  addInstance(metalwork, "rear-support-rail", [0.12, 0.42, 0.14], [0.43, 0.02, -0.2]);
  addInstance(metalwork, "rear-edge-socket", [0.32, 0.1, 0.2], [-0.13, -0.25, -0.21]);

  // Gold is confined to connector fingers, package pins, and small solder lands.
  [-0.34, -0.26, -0.18, -0.1, -0.02, 0.06, 0.14].forEach(function (x, index) {
    addInstance(copperBoxes, `front-edge-finger-${index}`, [0.05, 0.13, 0.015], [x, -0.415, 0.107]);
    addInstance(copperBoxes, `rear-edge-finger-${index}`, [0.05, 0.13, 0.015], [x, -0.415, -0.107]);
  });
  [-0.05, 0.05, 0.15].forEach(function (x, index) {
    addInstance(copperBoxes, `rear-solder-land-upper-${index}`, [0.055, 0.035, 0.015], [x, 0.28, -0.128]);
    addInstance(copperBoxes, `rear-solder-land-lower-${index}`, [0.055, 0.035, 0.015], [x, -0.28, -0.128]);
  });
  addInstance(copperBoxes, "front-package-pin-left", [0.025, 0.28, 0.016], [-0.49, 0.11, 0.129]);
  addInstance(copperBoxes, "front-package-pin-right", [0.025, 0.28, 0.016], [0.01, 0.11, 0.129]);

  // Bright green traces stay narrow, preserving the dark substrate as the primary board color.
  addInstance(traces, "front-signal-bus", [0.31, 0.024, 0.014], [0.25, 0.38, 0.128]);
  addInstance(traces, "front-signal-drop", [0.024, 0.18, 0.014], [0.4, 0.29, 0.128]);
  addInstance(traces, "front-power-bus", [0.3, 0.024, 0.014], [-0.34, -0.29, 0.128]);
  addInstance(traces, "front-power-rise", [0.024, 0.16, 0.014], [-0.49, -0.21, 0.128]);
  addInstance(traces, "rear-signal-bus", [0.44, 0.024, 0.014], [0.1, -0.29, -0.128]);
  addInstance(traces, "rear-signal-rise", [0.024, 0.2, 0.014], [-0.12, -0.2, -0.128]);
  addInstance(traces, "rear-service-bus", [0.26, 0.024, 0.014], [-0.42, 0.3, -0.128]);
  addInstance(traces, "rear-service-drop", [0.024, 0.16, 0.014], [-0.55, 0.22, -0.128]);

  // Cylinders span both faces; the barrel jack points outward along the left edge.
  [
    { name: "front-capacitor-upper", position: [0.43, 0.18, 0.27], radius: 0.065, depth: 0.24, side: 1 },
    { name: "front-capacitor-lower", position: [0.43, -0.08, 0.24], radius: 0.06, depth: 0.18, side: 1 },
    { name: "rear-capacitor", position: [-0.48, -0.15, -0.22], radius: 0.07, depth: 0.2, side: -1 }
  ].forEach(function (capacitor) {
    addInstance(
      capacitorBodies,
      `${capacitor.name}-body`,
      [capacitor.radius, capacitor.depth, capacitor.radius],
      capacitor.position,
      [Math.PI / 2, 0, 0]
    );
    addInstance(
      metalCylinders,
      `${capacitor.name}-cap`,
      [capacitor.radius * 0.9, 0.018, capacitor.radius * 0.9],
      [
        capacitor.position[0],
        capacitor.position[1],
        capacitor.position[2] + capacitor.side * (capacitor.depth / 2 + 0.01)
      ],
      [Math.PI / 2, 0, 0]
    );
  });
  addInstance(metalCylinders, "left-barrel-jack", [0.11, 0.28, 0.11], [-0.79, -0.17, 0.03], [0, 0, Math.PI / 2]);
  addInstance(metalCylinders, "left-barrel-rim", [0.13, 0.045, 0.13], [-0.945, -0.17, 0.03], [0, 0, Math.PI / 2]);

  [
    [-0.5, 0.28],
    [-0.5, -0.27],
    [0.38, 0.27],
    [0.38, -0.27],
    [-0.05, 0.23],
    [-0.05, 0.12],
    [-0.05, 0.01],
    [-0.05, -0.1]
  ].forEach(function (position, index) {
    addInstance(
      solderPads,
      `rear-round-solder-pad-${index}`,
      [0.026, 0.015, 0.026],
      [position[0], position[1], -0.128],
      [Math.PI / 2, 0, 0]
    );
  });

  addBatch("substrate", unitBox, boardMaterial, substrate);
  addBatch("components", unitBox, componentMaterial, components);
  addBatch("metalwork", unitBox, metalMaterial, metalwork);
  addBatch("copper", unitBox, copperMaterial, copperBoxes);
  addBatch("traces", unitBox, traceMaterial, traces);
  addBatch("capacitor-bodies", unitCylinder, capacitorMaterial, capacitorBodies);
  addBatch("metal-cylinders", unitCylinder, metalMaterial, metalCylinders);
  addBatch("solder-pads", unitCylinder, copperMaterial, solderPads);

  // Geometry, not mesh scale, keeps the shared scene's fault pulse physically small.
  const diagnosticPulse = new THREE.Mesh(
    new THREE.BoxGeometry(0.052, 0.034, 0.024),
    diagnosticMaterial
  );
  diagnosticPulse.name = "hardware-diagnostic-pulse";
  diagnosticPulse.position.set(0.01, 0.43, 0.145);
  diagnosticPulse.userData.fault = true;
  assembly.add(diagnosticPulse);

  return {
    root,
    mechanicalParts: [],
    semanticRole: "hardware"
  };
}
