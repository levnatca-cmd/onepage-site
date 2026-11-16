import * as THREE from "../../../../vendor/three/three.module.min.js";

const DESKTOP_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 32, 20);
const COMPACT_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 20, 12);
const SPHERE_ARC_GEOMETRY = createSphereArcGeometry(64);

[DESKTOP_SPHERE_GEOMETRY, COMPACT_SPHERE_GEOMETRY, SPHERE_ARC_GEOMETRY].forEach(function (geometry) {
  geometry.userData.sharedResource = true;
});

const COVER_VERTEX_SHADER = `
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

const COVER_FRAGMENT_SHADER = `
  #include <fog_pars_fragment>
  uniform vec3 uAccent;
  uniform float uBaseAlpha;
  uniform float uRimAlpha;
  uniform float uGlintPhase;
  uniform bool uPolishedGlass;
  uniform bool uClearReflections;
  uniform bool uLightTheme;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  vec4 clearGlass(vec2 direction, float facing) {
    float rim = exp(-facing * 8.4);
    float upper = pow(max(0.0, dot(direction, vec2(-0.67, 0.742))), 5.0);
    float lower = pow(max(0.0, dot(direction, vec2(0.12, -0.9928))), 9.0);
    float right = pow(max(0.0, dot(direction, vec2(0.87, 0.493))), 37.0);
    float upperOffset = (facing - 0.30) * 10.5;
    float lowerOffset = (facing - 0.17) * 9.0;
    float upperLip = upper * exp(-upperOffset * upperOffset);
    float lowerLip = lower * exp(-lowerOffset * lowerOffset);
    float amber = right * exp(-facing * 4.8);

    vec3 tint = vec3(0.01, 0.35, 0.52);
    tint = mix(tint, vec3(0.90, 0.97, 1.0), min(upperLip * 0.95 + upper * rim * 0.65, 1.0));
    tint = mix(tint, vec3(0.04, 0.90, 1.0), max(lowerLip, lower * rim));
    tint = mix(tint, vec3(1.0, 0.61, 0.29), amber * 0.55);
    float alpha = uBaseAlpha * 0.45 + rim * (0.48 + uRimAlpha * 0.36)
      + upperLip * 0.67 + lowerLip * 0.48 + amber * 0.18;
    return vec4(tint, min(alpha, 0.98));
  }

  vec4 polishedGlass(vec3 normalView, float facing) {
    vec2 direction = normalize(normalView.xy + vec2(0.0001));
    if (uClearReflections) return clearGlass(direction, facing);
    float upper = pow(max(0.0, dot(direction, vec2(-0.42, 0.9075))), 2.2);
    float lower = pow(max(0.0, dot(direction, vec2(0.26, -0.966))), 2.8);
    float rightGlint = pow(max(0.0, dot(direction, vec2(0.87, 0.493))), 36.0);
    float leftGlint = pow(max(0.0, dot(direction, vec2(-0.67, -0.742))), 21.0);
    float edge = exp(-facing * 6.2);
    float spread = exp(-facing * 3.3);
    float reflectionOffset = (facing - 0.27) * 8.0;
    float reflection = exp(-reflectionOffset * reflectionOffset);
    float amber = max(rightGlint, leftGlint * 0.72);
    vec3 tint = mix(vec3(0.012, 0.32, 0.44), vec3(0.025, 0.82, 1.0), lower);
    tint = mix(tint, vec3(0.82, 0.94, 1.0), min(upper * (0.66 + edge * 0.38) + edge * 0.26 + lower * edge * 0.29, 1.0));
    tint = mix(tint, vec3(1.0, 0.57, 0.23), amber * 0.9);
    float alpha = uBaseAlpha + edge * (0.48 + uRimAlpha * 0.34 + upper * 0.39 + lower * 0.22)
      + spread * (0.13 + upper * 0.24 + lower * 0.4 + amber * 0.40)
      + reflection * upper * upper * 0.21;
    return vec4(tint, min(alpha, 0.98));
  }

  void main() {
    vec3 normalView = normalize(vNormalView);
    float facing = clamp(abs(dot(normalView, normalize(vViewDirection))), 0.0, 1.0);
    float grazing = 1.0 - facing;
    float rim = pow(grazing, 3.7);
    float edge = pow(grazing, 8.0);
    float sky = max(0.0, dot(normalView, normalize(vec3(-0.59, 0.80, 0.10))));
    float floorLight = max(0.0, dot(normalView, normalize(vec3(0.11, -0.99, 0.06))));
    float key = pow(sky, 12.0) * smoothstep(0.40, 0.92, grazing);
    float bounce = pow(floorLight, 10.0) * smoothstep(0.47, 0.94, grazing);
    vec3 warmDirection = normalize(vec3(0.93, -0.34 + sin(uGlintPhase) * 0.1, 0.08));
    float warmRim = pow(max(0.0, dot(normalView, warmDirection)), 22.0) * rim;
    vec3 glass = mix(vec3(0.008, 0.42, 0.67), uAccent, 0.16);
    vec3 tint = mix(glass, vec3(0.86, 0.98, 1.0), min(key * 1.9 + edge * 0.28, 0.98));
    tint = mix(tint, vec3(0.09, 0.87, 1.0), bounce * 0.94);
    tint = mix(tint, vec3(1.0, 0.61, 0.25), min(warmRim * 1.45, 0.75));
    float alpha = uBaseAlpha + rim * uRimAlpha * 0.68 + key * 0.92 + bounce * 0.66 + warmRim * 0.22;
    gl_FragColor = uPolishedGlass ? polishedGlass(normalView, facing) : vec4(tint, min(alpha, 0.91));
    if (uLightTheme) {
      float silhouette = smoothstep(0.61, 1.0, grazing);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.021, 0.16, 0.23), silhouette * 0.79);
      gl_FragColor.a = max(gl_FragColor.a, silhouette * 0.56);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createServiceSphereCover(options) {
  const {
    color,
    radius,
    config,
    compact = false,
    lightTheme = false
  } = options;

  if (!config || !Number.isFinite(radius) || radius <= 0) {
    throw new Error("Service sphere cover requires a positive radius and presentation config");
  }

  const root = new THREE.Group();
  root.name = "service-sphere-cover";
  root.userData.serviceSphereCover = true;

  const shellMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uAccent: { value: new THREE.Color(color) },
        uBaseAlpha: { value: 0 },
        uRimAlpha: { value: 0 },
        uGlintPhase: { value: config.spinPhase },
        uPolishedGlass: { value: config.glassStyle === "polished" },
        uClearReflections: { value: config.glassReflections === "clear" },
        uLightTheme: { value: lightTheme }
      }
    ]),
    vertexShader: COVER_VERTEX_SHADER,
    fragmentShader: COVER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    fog: true
  });

  const shell = new THREE.Mesh(
    compact && config.glassStyle !== "polished" ? COMPACT_SPHERE_GEOMETRY : DESKTOP_SPHERE_GEOMETRY,
    shellMaterial
  );
  shell.scale.setScalar(radius);
  shell.renderOrder = 14;
  shell.userData.presentationShell = true;
  shell.userData.serviceSphereCover = true;
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
  arcs.visible = config.glassStyle !== "polished";

  const shellArcPivot = new THREE.Group();
  shellArcPivot.rotation.set(config.shellTilt[0], config.shellTilt[1], config.shellTilt[2]);
  shellArcPivot.add(arcs);
  root.add(shellArcPivot);

  const cover = {
    root,
    shell,
    shellMaterial,
    shellArcPivot,
    arcs,
    arcMaterial,
    radius,
    config
  };
  updateServiceSphereCover(cover, { delta: 0, elapsed: 0, reveal: 0 });
  return cover;
}

export function retargetServiceSphereCover(cover, options) {
  const {
    color,
    radius,
    config
  } = options;

  if (!cover || !config || !Number.isFinite(radius) || radius <= 0) {
    throw new Error("Cannot retarget an invalid service sphere cover");
  }

  cover.radius = radius;
  cover.config = config;
  cover.shell.scale.setScalar(radius);
  cover.arcs.scale.setScalar(radius * 1.003);
  cover.shellArcPivot.rotation.set(
    config.shellTilt[0],
    config.shellTilt[1],
    config.shellTilt[2]
  );
  if (color !== undefined) {
    cover.shellMaterial.uniforms.uAccent.value.set(color);
    cover.arcMaterial.color.set(color);
  }
  cover.shellMaterial.uniforms.uGlintPhase.value = config.spinPhase;
  cover.shellMaterial.uniforms.uPolishedGlass.value = config.glassStyle === "polished";
  cover.shellMaterial.uniforms.uClearReflections.value = config.glassReflections === "clear";
  cover.arcs.visible = config.glassStyle !== "polished";
  return cover;
}

export function updateServiceSphereCover(cover, options) {
  const {
    delta,
    elapsed,
    reveal,
    selected = false,
    hovered = false,
    reducedMotion = false,
    debugPhase = null
  } = options;
  const config = cover.config;

  if (Number.isFinite(debugPhase)) {
    cover.shellArcPivot.rotation.x = config.shellTilt[0] + debugPhase * 0.32;
    cover.shellArcPivot.rotation.y = config.shellTilt[1] - debugPhase * 0.46;
    cover.shellArcPivot.rotation.z = config.shellTilt[2];
  } else if (reducedMotion) {
    cover.shellArcPivot.rotation.set(
      config.shellTilt[0],
      config.shellTilt[1],
      config.shellTilt[2]
    );
  } else {
    cover.shellArcPivot.rotation.x += delta * config.shellSpeed * 0.42;
    cover.shellArcPivot.rotation.y -= delta * config.shellSpeed;
  }

  // The silhouette stays readable even when the presentation reveal is frozen at zero.
  const baseAlpha = selected ? 0.03 : hovered ? 0.024 : 0.018;
  const rimAlpha = selected ? 0.68 : hovered ? 0.59 : 0.5;
  cover.shellMaterial.uniforms.uBaseAlpha.value = baseAlpha;
  cover.shellMaterial.uniforms.uRimAlpha.value = rimAlpha * (0.9 + reveal * 0.1);
  cover.shellMaterial.uniforms.uGlintPhase.value = reducedMotion
    ? config.spinPhase
    : elapsed * 0.12 + config.spinPhase;
  cover.arcMaterial.opacity = (selected ? 0.085 : hovered ? 0.063 : 0.046) * (0.45 + reveal * 0.55);
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
