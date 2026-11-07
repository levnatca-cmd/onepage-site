export function buildMonitoringModel(color, kit) {
  const {
    THREE,
    VISUAL_COLORS,
    createRigMaterial,
    createRigBasicMaterial
  } = kit;

  const root = new THREE.Group();
  root.name = "monitoring-model";

  const frameMaterial = createRigMaterial(0x263740, 1, 0);
  const dishMaterial = createRigMaterial(0x31434d, 1, 0);
  const cageMaterial = createRigMaterial(
    VISUAL_COLORS.muted ?? VISUAL_COLORS.text,
    1,
    0
  );
  const accentMaterial = createRigMaterial(color, 1, 0);
  const hornMaterial = createRigMaterial(VISUAL_COLORS.text, 1, 0);
  const sensorMaterial = createRigBasicMaterial(
    VISUAL_COLORS.warning ?? color,
    1
  );
  const sweepMaterial = createRigBasicMaterial(color, 0.9);
  const sweepRingMaterial = createRigBasicMaterial(
    VISUAL_COLORS.text,
    0.72
  );

  const matrix = new THREE.Matrix4();
  const positionVector = new THREE.Vector3();
  const rotationEuler = new THREE.Euler();
  const rotationQuaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();

  function setInstanceMatrix(mesh, index, position, scale, rotation) {
    const instanceRotation = rotation ?? [0, 0, 0];
    positionVector.set(position[0], position[1], position[2]);
    rotationEuler.set(
      instanceRotation[0],
      instanceRotation[1],
      instanceRotation[2]
    );
    rotationQuaternion.setFromEuler(rotationEuler);
    scaleVector.set(scale[0], scale[1], scale[2]);
    matrix.compose(positionVector, rotationQuaternion, scaleVector);
    mesh.setMatrixAt(index, matrix);
  }

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const frameParts = [
    { name: "base-deck", position: [0, -0.53, -0.12], scale: [0.66, 0.08, 0.44] },
    { name: "mast", position: [0, -0.25, -0.2], scale: [0.15, 0.56, 0.16] },
    { name: "yoke-crossbar", position: [0, 0.16, -0.24], scale: [0.92, 0.1, 0.14] },
    { name: "yoke-left", position: [-0.42, 0.22, -0.2], scale: [0.1, 0.26, 0.12] },
    { name: "yoke-right", position: [0.42, 0.22, -0.2], scale: [0.1, 0.26, 0.12] },
    { name: "control-housing", position: [0, -0.08, -0.31], scale: [0.34, 0.2, 0.16] }
  ];
  const frameBatch = new THREE.InstancedMesh(
    unitBox,
    frameMaterial,
    frameParts.length
  );
  frameBatch.name = "monitoring-frame-batch";
  frameBatch.userData.instanceNames = frameParts.map(function (part) {
    return part.name;
  });
  frameParts.forEach(function (part, index) {
    setInstanceMatrix(frameBatch, index, part.position, part.scale);
  });
  frameBatch.instanceMatrix.needsUpdate = true;
  root.add(frameBatch);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.41, 0.18, 16, 1, false),
    frameMaterial
  );
  base.name = "monitoring-pedestal-base";
  base.position.set(0, -0.65, -0.12);
  root.add(base);

  const dish = new THREE.Group();
  dish.name = "monitoring-dish-assembly";
  dish.position.set(0, 0.2, 0.02);
  dish.rotation.x = -0.28;
  root.add(dish);

  const dishProfile = [
    new THREE.Vector2(0.008, -0.18),
    new THREE.Vector2(0.14, -0.169),
    new THREE.Vector2(0.28, -0.135),
    new THREE.Vector2(0.42, -0.079),
    new THREE.Vector2(0.56, 0)
  ];
  const reflector = new THREE.Mesh(
    new THREE.LatheGeometry(dishProfile, 36),
    dishMaterial
  );
  reflector.name = "monitoring-concave-reflector";
  reflector.rotation.x = Math.PI / 2;
  reflector.material.side = THREE.DoubleSide;
  dish.add(reflector);

  const unitHoop = new THREE.TorusGeometry(1, 0.085, 6, 36);
  const hoopParts = [
    { name: "dish-thick-rim", position: [0, 0, 0.004], scale: [0.56, 0.56, 0.56] },
    { name: "rear-cage-hoop", position: [0, 0, -0.13], scale: [0.36, 0.36, 0.36] }
  ];
  const hoopBatch = new THREE.InstancedMesh(
    unitHoop,
    accentMaterial,
    hoopParts.length
  );
  hoopBatch.name = "monitoring-hoop-batch";
  hoopBatch.userData.instanceNames = hoopParts.map(function (part) {
    return part.name;
  });
  hoopParts.forEach(function (part, index) {
    setInstanceMatrix(hoopBatch, index, part.position, part.scale);
  });
  hoopBatch.instanceMatrix.needsUpdate = true;
  dish.add(hoopBatch);

  const rodStarts = [];
  const rodEnds = [];
  const rodRadii = [];

  function addRod(start, end, radius) {
    rodStarts.push(start);
    rodEnds.push(end);
    rodRadii.push(radius);
  }

  addRod([0, 0, -0.31], [0, 0, -0.06], 0.075);
  [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4]
    .forEach(function (angle) {
      addRod(
        [0, 0, -0.25],
        [Math.cos(angle) * 0.46, Math.sin(angle) * 0.46, -0.065],
        0.018
      );
    });
  [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]
    .forEach(function (angle) {
      addRod(
        [Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, -0.025],
        [0, 0, 0.25],
        0.012
      );
    });

  const unitRod = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const rodBatch = new THREE.InstancedMesh(
    unitRod,
    cageMaterial,
    rodStarts.length
  );
  rodBatch.name = "monitoring-cage-and-boom-batch";
  rodBatch.userData.instanceNames = [
    "rear-hub",
    "rear-cage-ne",
    "rear-cage-nw",
    "rear-cage-sw",
    "rear-cage-se",
    "receiver-boom-top",
    "receiver-boom-left",
    "receiver-boom-right"
  ];

  const startVector = new THREE.Vector3();
  const endVector = new THREE.Vector3();
  const directionVector = new THREE.Vector3();
  const midpointVector = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  rodStarts.forEach(function (start, index) {
    const end = rodEnds[index];
    startVector.set(start[0], start[1], start[2]);
    endVector.set(end[0], end[1], end[2]);
    directionVector.subVectors(endVector, startVector);
    const length = directionVector.length();
    midpointVector.addVectors(startVector, endVector).multiplyScalar(0.5);
    rotationQuaternion.setFromUnitVectors(yAxis, directionVector.normalize());
    scaleVector.set(rodRadii[index], length, rodRadii[index]);
    matrix.compose(midpointVector, rotationQuaternion, scaleVector);
    rodBatch.setMatrixAt(index, matrix);
  });
  rodBatch.instanceMatrix.needsUpdate = true;
  dish.add(rodBatch);

  const receiverHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.09, 0.18, 12, 1, false),
    hornMaterial
  );
  receiverHorn.name = "monitoring-receiver-horn";
  receiverHorn.position.set(0, 0, 0.34);
  receiverHorn.rotation.x = Math.PI / 2;
  dish.add(receiverHorn);

  const sensorGeometry = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const sensorParts = [
    { name: "sensor-ne", position: [0.37, 0.37, 0.015], scale: [0.038, 0.07, 0.038] },
    { name: "sensor-nw", position: [-0.37, 0.37, 0.015], scale: [0.038, 0.07, 0.038] },
    { name: "sensor-sw", position: [-0.37, -0.37, 0.015], scale: [0.038, 0.07, 0.038] },
    { name: "sensor-se", position: [0.37, -0.37, 0.015], scale: [0.038, 0.07, 0.038] },
    { name: "receiver-sensor", position: [0, 0, 0.455], scale: [0.04, 0.055, 0.04] },
    { name: "rear-sensor", position: [0, 0, -0.35], scale: [0.045, 0.055, 0.045] }
  ];
  const sensorBatch = new THREE.InstancedMesh(
    sensorGeometry,
    sensorMaterial,
    sensorParts.length
  );
  sensorBatch.name = "monitoring-sensor-node-batch";
  sensorBatch.userData.instanceNames = sensorParts.map(function (part) {
    return part.name;
  });
  sensorParts.forEach(function (part, index) {
    setInstanceMatrix(
      sensorBatch,
      index,
      part.position,
      part.scale,
      [Math.PI / 2, 0, 0]
    );
  });
  sensorBatch.instanceMatrix.needsUpdate = true;
  dish.add(sensorBatch);

  const sweep = new THREE.Group();
  sweep.name = "monitoring-sweep";
  sweep.userData.sweep = true;
  const sweepBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.018, 0.018),
    sweepMaterial
  );
  sweepBeam.name = "monitoring-sweep-beam";
  sweepBeam.position.set(0.24, 0, 0.035);
  sweep.add(sweepBeam);
  dish.add(sweep);

  const sweepRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.009, 4, 32, Math.PI * 1.55),
    sweepRingMaterial
  );
  sweepRing.name = "monitoring-sweep-ring";
  sweepRing.position.z = 0.033;
  sweepRing.userData.sweepRing = true;
  dish.add(sweepRing);

  return {
    root,
    mechanicalParts: [sweep, sweepRing],
    semanticRole: "monitoring"
  };
}
