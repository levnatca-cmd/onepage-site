import * as THREE from "../../../../vendor/three/three.module.min.js";

// Open cylinder topology, bent along each connection in the vertex shader.
const connectionGeometry = new THREE.CylinderGeometry(1, 1, 1, 10, 24, true);

const vertexShader = `
  uniform vec3 uStart;
  uniform vec3 uEnd;
  uniform vec3 uControl;
  uniform float uRadius;
  uniform float uSignalStrength;

  varying float vAlong;
  varying vec3 vSurfaceNormal;
  varying vec3 vTangentView;
  varying vec3 vToCamera;

  void main() {
    float t = position.y + 0.5;
    vec3 a = mix(uStart, uControl, t);
    vec3 b = mix(uControl, uEnd, t);
    vec3 center = mix(a, b, t);
    vec3 chord = uEnd - uStart;
    vec3 direction = b - a;
    if (dot(direction, direction) < 0.000001) direction = chord;
    if (dot(direction, direction) < 0.000001) direction = vec3(0.0, 1.0, 0.0);
    vec3 tangent = normalize(direction);
    // Keep the cross-section aligned with the plane of the whole curve.
    vec3 across = cross(chord, uControl - uStart);
    if (dot(across, across) < 0.000001) {
      vec3 up = abs(tangent.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      across = cross(tangent, up);
    }
    vec3 side = normalize(across);
    vec3 radial = side * position.x + cross(side, tangent) * position.z;
    float ends = 1.0 - smoothstep(0.0, 0.10, min(t, 1.0 - t));
    float radius = uRadius * (1.0 + 0.14 * ends * uSignalStrength);
    vec4 viewPosition = modelViewMatrix * vec4(center + radius * radial, 1.0);

    vAlong = t;
    vSurfaceNormal = normalMatrix * radial;
    vTangentView = mat3(modelViewMatrix) * tangent;
    vToCamera = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uEnergyHead;
  uniform float uPacketHead;
  uniform float uSignalStrength;
  uniform float uProtected;
  uniform float uPathLength;
  uniform float uPhotonSpacing;
  uniform bool uLightTheme;

  varying float vAlong;
  varying vec3 vSurfaceNormal;
  varying vec3 vTangentView;
  varying vec3 vToCamera;

  vec4 photonFlow(float facing, float crossFacing) {
    // The PQC cable is built from its outlet toward Core. Its photons travel the other way.
    float along = mix(vAlong, 1.0 - vAlong, uProtected);
    float pathLength = max(uPathLength, 0.01);
    float spacing = uPhotonSpacing;
    float offset = (fract((along - uEnergyHead) * pathLength / spacing + 0.5) - 0.5) * spacing;
    float across = sqrt(max(0.0, 1.0 - crossFacing * crossFacing));
    float headSize = min(0.092, spacing * 0.23);
    float shape = length(vec2(offset / headSize, across / 0.65));
    float core = 1.0 - smoothstep(0.17, 0.61, shape);
    float glow = 1.0 - smoothstep(0.36, 1.23, shape);
    float tail = smoothstep(-headSize * 1.85, -headSize * 0.36, offset)
      * (1.0 - smoothstep(-headSize * 0.36, 0.0, offset))
      * (1.0 - smoothstep(0.04, 0.35, across));
    float endFade = smoothstep(0.0, min(0.062, pathLength * 0.23), min(along, 1.0 - along) * pathLength);
    float photon = (glow * 0.72 + core * 0.50 + tail * 0.23) * endFade;

    vec3 color = mix(uTint, vec3(0.48, 0.84, 1.0), 0.19);
    color = mix(color, vec3(1.0, 0.99, 0.93), core * 0.91);
    if (uLightTheme) {
      vec3 halo = mix(uTint * 0.23, vec3(0.007, 0.046, 0.08), 0.34);
      color = mix(color, halo, 0.84 - core * 0.56);
    }
    float conduit = 0.010 + 0.012 * (1.0 - facing) * (1.0 - facing);

    // Unlike energy photons, the protected packet follows the outlet-to-Core geometry.
    if (uProtected > 0.5 && uPacketHead >= 0.0) {
      float packetOffset = (vAlong - uPacketHead) * pathLength;
      float packetWidth = min(0.135, pathLength * 0.27);
      float packetShape = length(vec2(packetOffset / packetWidth, across / 0.86));
      float packetCore = 1.0 - smoothstep(0.17, 0.62, packetShape);
      float packetHalo = 1.0 - smoothstep(0.37, 1.18, packetShape);
      float packetTail = smoothstep(-0.32, -0.055, packetOffset)
        * (1.0 - smoothstep(-0.055, 0.0, packetOffset))
        * (1.0 - smoothstep(0.10, 0.61, across));
      float packetGlow = max(packetHalo * 0.94, packetTail * 0.49);
      color = mix(color, vec3(0.48, 0.27, 1.0), packetGlow);
      color = mix(color, vec3(0.99, 0.96, 1.0), packetCore * 0.96);
      photon += packetGlow + packetCore * 0.34;
    }

    return vec4(color, uOpacity * min(conduit + photon, 1.0));
  }

  void main() {
    vec3 normalView = normalize(vSurfaceNormal);
    vec3 view = normalize(vToCamera);
    float facing = clamp(dot(normalView, view), 0.0, 1.0);
    if (uSignalStrength > 0.0) {
      vec3 axis = normalize(vTangentView);
      vec3 crossView = view - axis * dot(view, axis);
      float crossFacing = clamp(dot(normalView, crossView) / max(length(crossView), 0.06), 0.0, 1.0);
      gl_FragColor = photonFlow(facing, crossFacing);
    } else {
      float rim = pow(1.0 - facing, 1.3);
      gl_FragColor = vec4(uTint * (0.24 + rim * 1.48), min(uOpacity * (0.19 + 0.83 * rim), 0.96));
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createConnectionTube(radius, { carriesSignal = true, protectedSignal = false, lightTheme = false } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uStart: { value: new THREE.Vector3() },
      uEnd: { value: new THREE.Vector3() },
      uControl: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Color(0x5de7ff) },
      uRadius: { value: radius },
      uOpacity: { value: 0 },
      uPacketHead: { value: -1 },
      uEnergyHead: { value: -1 },
      uFlowTime: { value: 0 },
      uSignalStrength: { value: carriesSignal ? 1 : 0 },
      uProtected: { value: protectedSignal ? 1 : 0 },
      uPathLength: { value: 0 },
      uPhotonSpacing: { value: 0.13 },
      uLightTheme: { value: lightTheme }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: !carriesSignal,
    side: THREE.FrontSide
  });
  const tube = new THREE.Mesh(connectionGeometry, material);
  tube.name = "connection-tube";
  tube.frustumCulled = false;
  return tube;
}

export function updateConnectionTube(tube, start, end, control, tintHex, opacity, flowTime, packetHead, reducedMotion = false) {
  const uniforms = tube.material.uniforms;
  uniforms.uStart.value.copy(start);
  uniforms.uEnd.value.copy(end);
  uniforms.uControl.value.copy(control);
  uniforms.uTint.value.setHex(tintHex);
  uniforms.uOpacity.value = opacity;
  // Average the chord and control polygon lengths to size the photons along the curve.
  const pathLength = (start.distanceTo(end) + start.distanceTo(control) + control.distanceTo(end)) * 0.5;
  const spacing = THREE.MathUtils.clamp(pathLength * 0.65, 0.13, 0.66);
  const phase = reducedMotion ? 0.35 : THREE.MathUtils.euclideanModulo(flowTime * 1.24 + 0.35, 1);
  const energyHead = phase * spacing / Math.max(pathLength, 0.01);
  uniforms.uEnergyHead.value = energyHead;
  uniforms.uFlowTime.value = reducedMotion ? 0 : THREE.MathUtils.euclideanModulo(flowTime, 25);
  uniforms.uPacketHead.value = packetHead ?? (uniforms.uProtected.value ? -1 : energyHead);
  uniforms.uPathLength.value = pathLength;
  uniforms.uPhotonSpacing.value = spacing;
}
