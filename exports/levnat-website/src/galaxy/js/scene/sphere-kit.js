import * as THREE from "../../../../vendor/three/three.module.min.js";

const DESKTOP_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 32, 20);
const COMPACT_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 20, 12);
const SPHERE_ARC_GEOMETRY = createSphereArcGeometry(64);
[DESKTOP_SPHERE_GEOMETRY, COMPACT_SPHERE_GEOMETRY, SPHERE_ARC_GEOMETRY].forEach(function (geometry) {
  geometry.userData.sharedResource = true;
});

const SHELL_VERTEX_SHADER = `
  #include <fog_pars_vertex>
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SHELL_FRAGMENT_SHADER = `
  #include <fog_pars_fragment>
  uniform vec3 uAccent;
  uniform float uBaseAlpha;
  uniform float uRimAlpha;
  uniform float uGlintPhase;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vec3 normalView = normalize(vNormalView);
    float facing = abs(dot(normalView, normalize(vViewDirection)));
    float rim = pow(max(0.0, 1.0 - facing), 2.35);
    vec3 glintDirection = normalize(vec3(cos(uGlintPhase), 0.56, sin(uGlintPhase)));
    float glint = pow(max(0.0, dot(normalView, glintDirection)), 18.0);
    float alpha = uBaseAlpha + rim * uRimAlpha + glint * 0.055;
    gl_FragColor = vec4(uAccent, min(alpha, 0.42));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createSpherePresentation(options) {
  const {
    id,
    color,
    model,
    config,
    context = "rescue",
    radius: radiusOverride = null,
    compact = false
  } = options;

  if (!model || !config) throw new Error("Sphere presentation requires a model and config for " + id);

  const root = new THREE.Group();
  const posePivot = new THREE.Group();
  const spinPivot = new THREE.Group();
  const fitPivot = new THREE.Group();
  const shellArcPivot = new THREE.Group();
  const radius = Number.isFinite(radiusOverride) ? radiusOverride : config.rescueRadius;
  const innerRadius = radius * config.fill;
  const fit = fitModelIntoSphere(model, innerRadius);

  const shellMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uAccent: { value: new THREE.Color(color) },
        uBaseAlpha: { value: 0 },
        uRimAlpha: { value: 0 },
        uGlintPhase: { value: config.spinPhase }
      }
    ]),
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: true,
    fog: true
  });

  const shell = new THREE.Mesh(
    compact ? COMPACT_SPHERE_GEOMETRY : DESKTOP_SPHERE_GEOMETRY,
    shellMaterial
  );
  shell.scale.setScalar(radius);
  shell.renderOrder = 14;
  shell.userData.presentationShell = true;
  root.add(shell);

  const arcMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  });
  const arcs = new THREE.LineSegments(SPHERE_ARC_GEOMETRY, arcMaterial);
  arcs.scale.setScalar(radius * 1.003);
  arcs.renderOrder = 15;
  shellArcPivot.rotation.set(config.shellTilt[0], config.shellTilt[1], config.shellTilt[2]);
  shellArcPivot.add(arcs);
  root.add(shellArcPivot);

  fitPivot.add(model);
  spinPivot.add(fitPivot);
  posePivot.add(spinPivot);
  root.add(posePivot);

  const spinAxis = new THREE.Vector3(
    config.spinAxis[0],
    config.spinAxis[1],
    config.spinAxis[2]
  ).normalize();

  const presentation = {
    id,
    context,
    root,
    posePivot,
    spinPivot,
    fitPivot,
    model,
    shell,
    shellMaterial,
    shellArcPivot,
    arcs,
    arcMaterial,
    radius,
    innerRadius,
    spinAxis,
    spinAngle: config.spinPhase,
    speedFactor: 1,
    revealProgress: 0,
    config,
    fit
  };

  spinPivot.quaternion.setFromAxisAngle(spinAxis, config.spinPhase + 0.314);
  spinPivot.scale.setScalar(0.86);
  root.userData.presentation = presentation;
  root.userData.presentationContext = context;
  root.userData.sphereRadius = radius;
  root.userData.model = model;
  return presentation;
}

export function retargetSpherePresentation(presentation, options) {
  const {
    id = presentation.id,
    color,
    config = presentation.config,
    radius: radiusOverride = presentation.radius
  } = options;
  const radius = Number(radiusOverride);

  if (!presentation.model || !config || !Number.isFinite(radius) || radius <= 0) {
    throw new Error("Cannot retarget an invalid sphere presentation for " + id);
  }

  const innerRadius = radius * config.fill;
  const modelParent = presentation.model.parent;
  let fit;
  if (modelParent) modelParent.remove(presentation.model);
  try {
    fit = fitModelIntoSphere(presentation.model, innerRadius);
  } finally {
    if (modelParent) modelParent.add(presentation.model);
  }

  presentation.id = id;
  presentation.config = config;
  presentation.radius = radius;
  presentation.innerRadius = innerRadius;
  presentation.fit = fit;
  presentation.spinAxis.set(
    config.spinAxis[0],
    config.spinAxis[1],
    config.spinAxis[2]
  ).normalize();
  presentation.spinAngle = config.spinPhase;
  presentation.speedFactor = 1;
  presentation.spinPivot.quaternion.setFromAxisAngle(
    presentation.spinAxis,
    presentation.spinAngle
  );

  presentation.shell.scale.setScalar(radius);
  presentation.arcs.scale.setScalar(radius * 1.003);
  presentation.shellArcPivot.rotation.set(
    config.shellTilt[0],
    config.shellTilt[1],
    config.shellTilt[2]
  );
  if (color !== undefined) {
    presentation.shellMaterial.uniforms.uAccent.value.set(color);
    presentation.arcMaterial.color.set(color);
  }
  presentation.shellMaterial.uniforms.uGlintPhase.value = config.spinPhase;

  presentation.root.userData.presentation = presentation;
  presentation.root.userData.presentationContext = presentation.context;
  presentation.root.userData.presentationId = id;
  presentation.root.userData.sphereRadius = radius;
  presentation.root.userData.model = presentation.model;
  return presentation;
}

export function updateSpherePresentation(presentation, options) {
  const {
    delta,
    elapsed,
    selected = false,
    hovered = false,
    reducedMotion = false,
    debugPhase = null
  } = options;
  const config = presentation.config;
  const targetSpeedFactor = selected ? 0.2 : hovered ? 0.45 : 1;
  const speedBlend = 1 - Math.exp(-Math.max(delta, 0) * 8);
  presentation.speedFactor += (targetSpeedFactor - presentation.speedFactor) * speedBlend;

  if (Number.isFinite(debugPhase)) {
    presentation.spinAngle = config.spinPhase + debugPhase * Math.PI * 2;
  } else if (reducedMotion) {
    presentation.spinAngle = config.staticAngle;
  } else if (selected) {
    const angleDelta = Math.atan2(
      Math.sin(config.staticAngle - presentation.spinAngle),
      Math.cos(config.staticAngle - presentation.spinAngle)
    );
    presentation.spinAngle += angleDelta * (1 - Math.exp(-Math.max(delta, 0) * 7));
  } else {
    presentation.spinAngle += delta * config.spinSpeed * presentation.speedFactor;
  }

  if (reducedMotion || Number.isFinite(debugPhase)) {
    presentation.revealProgress = 1;
  } else {
    presentation.revealProgress = Math.min(1, presentation.revealProgress + delta / 0.72);
  }

  const reveal = smoothStep(presentation.revealProgress);
  const revealTwist = (1 - reveal) * 0.314;
  presentation.spinPivot.quaternion.setFromAxisAngle(
    presentation.spinAxis,
    presentation.spinAngle + revealTwist
  );
  presentation.spinPivot.scale.setScalar(0.86 + reveal * 0.14);

  if (Number.isFinite(debugPhase)) {
    presentation.shellArcPivot.rotation.x = config.shellTilt[0] + debugPhase * 0.32;
    presentation.shellArcPivot.rotation.y = config.shellTilt[1] - debugPhase * 0.46;
    presentation.shellArcPivot.rotation.z = config.shellTilt[2];
  } else if (reducedMotion) {
    presentation.shellArcPivot.rotation.set(
      config.shellTilt[0],
      config.shellTilt[1],
      config.shellTilt[2]
    );
  } else if (!reducedMotion) {
    presentation.shellArcPivot.rotation.x += delta * config.shellSpeed * 0.42;
    presentation.shellArcPivot.rotation.y -= delta * config.shellSpeed;
  }

  const baseAlpha = selected ? 0.042 : hovered ? 0.032 : 0.022;
  const rimAlpha = selected ? 0.28 : hovered ? 0.23 : 0.18;
  presentation.shellMaterial.uniforms.uBaseAlpha.value = baseAlpha * reveal;
  presentation.shellMaterial.uniforms.uRimAlpha.value = rimAlpha * reveal;
  presentation.shellMaterial.uniforms.uGlintPhase.value = reducedMotion
    ? config.spinPhase
    : elapsed * 0.12 + config.spinPhase;
  presentation.arcMaterial.opacity = (selected ? 0.22 : hovered ? 0.18 : 0.12) * reveal;
}

export function fitModelIntoSphere(model, innerRadius) {
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const sourceSphere = new THREE.Sphere();
  const fittedSphere = new THREE.Sphere();

  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  if (box.isEmpty()) throw new Error("Cannot fit an empty semantic model into a sphere");

  box.getCenter(center);
  model.position.sub(center);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getBoundingSphere(sourceSphere);
  if (!Number.isFinite(sourceSphere.radius) || sourceSphere.radius <= 0) {
    throw new Error("Semantic model has invalid bounds");
  }

  const scale = innerRadius / sourceSphere.radius;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getBoundingSphere(fittedSphere);
  const epsilon = 0.0001;
  if (fittedSphere.radius > innerRadius + epsilon) {
    throw new Error("Semantic model exceeded its sphere containment budget");
  }

  return Object.freeze({
    sourceRadius: sourceSphere.radius,
    fittedRadius: fittedSphere.radius,
    scale,
    centerOffset: Object.freeze([-center.x, -center.y, -center.z])
  });
}

function createSphereArcGeometry(segments) {
  const positions = [];
  const planes = ["xy", "xz", "yz"];
  planes.forEach(function (plane, planeIndex) {
    const start = planeIndex * 0.34;
    const end = start + Math.PI * 1.72;
    for (let index = 0; index < segments; index += 1) {
      const a = start + (index / segments) * (end - start);
      const b = start + ((index + 1) / segments) * (end - start);
      appendCirclePoint(positions, plane, a);
      appendCirclePoint(positions, plane, b);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function appendCirclePoint(target, plane, angle) {
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  if (plane === "xy") target.push(x, y, 0);
  else if (plane === "xz") target.push(x, 0, y);
  else target.push(0, x, y);
}

function smoothStep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}
