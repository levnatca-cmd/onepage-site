export function buildAutomationModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "automation-model";

  const gearMaterial = createRigMaterial(color, 1, 0);
  const hardwareMaterial = createRigMaterial(VISUAL_COLORS.text, 1, 0);
  const frameMaterial = createRigMaterial(0x17232c, 1, 0);
  const workflowMaterial = createRigBasicMaterial(color, 1);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false);
  const mechanicalParts = [];

  function createGearGeometry(teeth, rootRadius, toothRadius, thickness) {
    const shape = new THREE.Shape();
    const toothProfile = [
      [0, rootRadius],
      [0.14, rootRadius],
      [0.27, toothRadius],
      [0.73, toothRadius],
      [0.86, rootRadius]
    ];

    for (let tooth = 0; tooth < teeth; tooth += 1) {
      toothProfile.forEach(function (profilePoint) {
        const turn = (tooth + profilePoint[0]) / teeth;
        const angle = turn * Math.PI * 2 - Math.PI / 2;
        const radius = profilePoint[1];
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (tooth === 0 && profilePoint === toothProfile[0]) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 1
    });
    geometry.translate(0, 0, -thickness / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function setInstanceMatrix(mesh, index, position, scale, rotation) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(
      rotation?.[0] ?? 0,
      rotation?.[1] ?? 0,
      rotation?.[2] ?? 0
    );
    quaternion.setFromEuler(euler);
    matrix.compose(
      new THREE.Vector3(position[0], position[1], position[2]),
      quaternion,
      new THREE.Vector3(scale[0], scale[1], scale[2])
    );
    mesh.setMatrixAt(index, matrix);
  }

  function createBoxBatch(name, material, instances) {
    const mesh = new THREE.InstancedMesh(unitBox, material, instances.length);
    mesh.name = name;
    mesh.userData.instanceNames = instances.map(function (instance) {
      return instance.name;
    });
    instances.forEach(function (instance, index) {
      setInstanceMatrix(
        mesh,
        index,
        instance.position,
        instance.size,
        instance.rotation
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }

  function addGear(options) {
    const gear = new THREE.Group();
    gear.name = options.name;
    gear.position.set(options.position[0], options.position[1], options.position[2]);
    gear.userData.spin = options.direction;

    const body = new THREE.Mesh(
      createGearGeometry(
        options.teeth,
        options.rootRadius,
        options.toothRadius,
        options.thickness
      ),
      gearMaterial
    );
    body.name = `${options.name}-toothed-body`;
    gear.add(body);

    const hubDepth = options.thickness * 0.66;
    const hubOffset = options.thickness / 2 + hubDepth / 2;
    const hardware = new THREE.InstancedMesh(unitCylinder, hardwareMaterial, 3);
    hardware.name = `${options.name}-hubs-and-axle`;
    hardware.userData.instanceNames = ["front-hub", "rear-hub", "through-axle"];
    setInstanceMatrix(
      hardware,
      0,
      [0, 0, hubOffset],
      [options.hubRadius, hubDepth, options.hubRadius],
      [Math.PI / 2, 0, 0]
    );
    setInstanceMatrix(
      hardware,
      1,
      [0, 0, -hubOffset],
      [options.hubRadius, hubDepth, options.hubRadius],
      [Math.PI / 2, 0, 0]
    );
    setInstanceMatrix(
      hardware,
      2,
      [0, 0, 0],
      [options.axleRadius, options.axleLength, options.axleRadius],
      [Math.PI / 2, 0, 0]
    );
    hardware.instanceMatrix.needsUpdate = true;
    gear.add(hardware);

    root.add(gear);
    mechanicalParts.push(gear);
  }

  addGear({
    name: "automation-drive-gear",
    teeth: 12,
    rootRadius: 0.36,
    toothRadius: 0.46,
    thickness: 0.22,
    hubRadius: 0.16,
    axleRadius: 0.065,
    axleLength: 0.76,
    position: [-0.28, 0.16, 0],
    direction: 1
  });

  addGear({
    name: "automation-transfer-gear",
    teeth: 10,
    rootRadius: 0.27,
    toothRadius: 0.355,
    thickness: 0.2,
    hubRadius: 0.13,
    axleRadius: 0.055,
    axleLength: 0.7,
    position: [0.36, -0.17, 0.015],
    direction: -1
  });

  // Rear bearings, bracing, and deep feet keep the machine legible from the side.
  createBoxBatch("automation-frame-batch", frameMaterial, [
    { name: "base-beam", size: [1.72, 0.11, 0.24], position: [0, -0.72, -0.2] },
    { name: "rear-cross-rail", size: [1.52, 0.1, 0.12], position: [0, -0.02, -0.34] },
    { name: "drive-upright", size: [0.12, 0.78, 0.12], position: [-0.28, -0.23, -0.34] },
    { name: "transfer-upright", size: [0.12, 0.45, 0.12], position: [0.36, -0.395, -0.34] },
    { name: "drive-bearing", size: [0.26, 0.26, 0.11], position: [-0.28, 0.16, -0.335] },
    { name: "transfer-bearing", size: [0.22, 0.22, 0.11], position: [0.36, -0.17, -0.335] },
    { name: "left-brace", size: [0.08, 0.58, 0.1], position: [-0.55, -0.4, -0.33], rotation: [0, 0, -0.58] },
    { name: "right-brace", size: [0.08, 0.48, 0.1], position: [0.61, -0.48, -0.33], rotation: [0, 0, 0.58] },
    { name: "left-depth-foot", size: [0.2, 0.09, 0.86], position: [-0.64, -0.79, -0.08] },
    { name: "right-depth-foot", size: [0.2, 0.09, 0.86], position: [0.64, -0.79, -0.08] },
    { name: "workflow-track", size: [1.58, 0.055, 0.12], position: [0, -0.61, 0.27] }
  ]);

  // Three stations and paired chevrons form a compact input-process-output path.
  createBoxBatch("automation-workflow-batch", workflowMaterial, [
    { name: "input-station", size: [0.18, 0.18, 0.2], position: [-0.68, -0.54, 0.27] },
    { name: "process-station", size: [0.23, 0.23, 0.24], position: [0, -0.515, 0.27] },
    { name: "output-station", size: [0.18, 0.18, 0.2], position: [0.68, -0.54, 0.27] },
    { name: "input-arrow-upper", size: [0.15, 0.035, 0.045], position: [-0.355, -0.575, 0.345], rotation: [0, 0, 0.64] },
    { name: "input-arrow-lower", size: [0.15, 0.035, 0.045], position: [-0.355, -0.645, 0.345], rotation: [0, 0, -0.64] },
    { name: "output-arrow-upper", size: [0.15, 0.035, 0.045], position: [0.325, -0.575, 0.345], rotation: [0, 0, 0.64] },
    { name: "output-arrow-lower", size: [0.15, 0.035, 0.045], position: [0.325, -0.645, 0.345], rotation: [0, 0, -0.64] }
  ]);

  return {
    root,
    mechanicalParts,
    semanticRole: "automation"
  };
}
