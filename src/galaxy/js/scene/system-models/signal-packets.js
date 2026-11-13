const TUBE_SEGMENTS = 18;
const TUBE_SIDES = 7;

const packetEnvelope = `
  float packetEnvelope(float offset) {
    return smoothstep(-0.285, -0.036, offset) *
      (1.0 - smoothstep(0.012, 0.092, offset));
  }
`;

const vertexShader = `
  uniform float uElapsed;
  uniform float uReducedMotion;
  uniform float uSpeed;
  attribute vec4 signalRoute;
  attribute vec3 signalTint;

  varying vec3 vTint;
  varying vec3 vNormalView;
  varying vec3 vToCamera;
  varying float vOffset;
  varying float vEndDistance;

  #include <fog_pars_vertex>
  ${packetEnvelope}

  void main() {
    float distanceAlong = signalRoute.x;
    float routeLength = signalRoute.y;
    float phase = signalRoute.z;
    float radius = signalRoute.w;

    // Each route leaves enough space for the entire capsule to clear its ends.
    float cycleLength = routeLength + 0.43;
    float movingHead = mod(uElapsed * uSpeed + phase * cycleLength, cycleLength) - 0.105;
    float parkedHead = routeLength * mix(0.40, 0.66, fract(phase));
    vOffset = distanceAlong - mix(movingHead, parkedHead, uReducedMotion);
    vEndDistance = min(distanceAlong, routeLength - distanceAlong);

    // The baked tube is the maximum radius. Collapse its unlit cross sections
    // toward the cable and open the cross sections around the traveling head.
    float volume = 0.24 + 0.76 * pow(packetEnvelope(vOffset), 0.68);
    vec3 taperedPosition = position - normal * radius * (1.0 - volume);
    vec4 mvPosition = modelViewMatrix * vec4(taperedPosition, 1.0);
    vNormalView = normalMatrix * normal;
    vToCamera = -mvPosition.xyz;
    vTint = signalTint;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = `
  uniform float uOpacity;
  varying vec3 vTint;
  varying vec3 vNormalView;
  varying vec3 vToCamera;
  varying float vOffset;
  varying float vEndDistance;

  #include <fog_pars_fragment>
  ${packetEnvelope}

  void main() {
    float energy = packetEnvelope(vOffset) * smoothstep(0.0, 0.052, vEndDistance);
    if (energy < 0.003) discard;

    float facing = max(0.0, dot(normalize(vNormalView), normalize(vToCamera)));
    float edgeFade = smoothstep(0.05, 0.80, facing);
    float centerLine = pow(facing, 8.0);
    float head = 1.0 - smoothstep(0.014, 0.065, abs(vOffset + 0.013));
    float whiteCore = head * centerLine;
    vec3 color = mix(vTint, vec3(1.0, 0.99, 0.95), whiteCore);
    float alpha = energy * edgeFade * (0.57 + 0.41 * whiteCore);

    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFade = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= fogFade;
    #endif

    gl_FragColor = vec4(color, alpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function addModelSignalPackets({ THREE, root }, routes, { radius: baseRadius = 0.064, speed = 0.6 } = {}) {
  const positions = [];
  const normals = [];
  const routeData = [];
  const colors = [];
  const indices = [];
  let routeCount = 0;

  for (const { curve, size, phase, color } of routes) {
    const length = curve.getLength();
    if (!Number.isFinite(length) || length <= 0.00001) continue;
    const radius = baseRadius * size;
    const tint = new THREE.Color(color);
    const tube = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, radius, TUBE_SIDES, false);
    const position = tube.getAttribute("position");
    const normal = tube.getAttribute("normal");
    const uv = tube.getAttribute("uv");
    const vertexOffset = positions.length / 3;

    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      // TubeGeometry spaces rings by arc length and records that fraction in UV.x.
      routeData.push(uv.getX(index) * length, length, phase, radius);
      colors.push(tint.r, tint.g, tint.b);
    }
    for (const index of tube.index.array) indices.push(vertexOffset + index);
    tube.dispose();
    routeCount += 1;
  }

  if (!routeCount) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("signalRoute", new THREE.Float32BufferAttribute(routeData, 4));
  geometry.setAttribute("signalTint", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uElapsed: { value: 0 }, uReducedMotion: { value: 1 }, uOpacity: { value: 1 }, uSpeed: { value: speed } }
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    fog: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${root.name}-signal-packets`;
  mesh.renderOrder = 12;
  mesh.onBeforeRender = () => {
    uniforms.uOpacity.value = material.opacity;
  };
  root.add(mesh);

  return { uniforms, routeCount };
}

export function updateModelSignalPackets(states, elapsed, reducedMotion) {
  const time = !reducedMotion && Number.isFinite(elapsed) ? elapsed : 0;
  for (const { uniforms } of states) {
    uniforms.uElapsed.value = time;
    uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
  }
}
