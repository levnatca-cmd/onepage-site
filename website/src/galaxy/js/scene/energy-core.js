import * as THREE from "../../../../vendor/three/three.module.min.js";

const detailUrl = new URL("../../../../assets/images/galaxy-core-plasma.webp", import.meta.url);
let detailLoad;

const vertexShader = `
  uniform float uRadius;
  varying vec3 vSurface;
  varying vec3 vEye;
  varying vec3 vRight;
  varying vec3 vUp;

  void main() {
    // Leave room for translucent filaments beyond the sphere's picking surface.
    vec3 expanded = position * 1.035;
    vSurface = expanded / uRadius;
    vEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz / uRadius;
    vRight = normalize(vec3(modelViewMatrix[0].x, modelViewMatrix[1].x, modelViewMatrix[2].x));
    vUp = normalize(vec3(modelViewMatrix[0].y, modelViewMatrix[1].y, modelViewMatrix[2].y));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform sampler2D uDetail;
  uniform bool uHasDetail;
  varying vec3 vSurface;
  varying vec3 vEye;
  varying vec3 vRight;
  varying vec3 vUp;

  float ridge(float distance, float falloff) {
    return exp(-falloff * distance * distance);
  }

  // A broad trail follows the brighter leading edge as each packet travels.
  float energyPacket(float path) {
    float cycle = fract(path);
    return smoothstep(0.04, 0.53, cycle) * (1.0 - smoothstep(0.53, 0.72, cycle));
  }

  vec3 ribbonLight(vec3 p, float height, float phase, float flow) {
    float position = p.x * 5.0 + p.z * 2.8 + phase;
    float distance = p.y - height + 0.014 * sin(position * 3.1) + 0.007 * sin(position * 6.4);
    float veil = ridge(distance, 98.0) * (0.71 + 0.29 * sin(position * 2.7));
    float filament = ridge(distance - 0.009 * sin(position * 4.0), 2600.0);
    float strands = ridge(distance + 0.036 + 0.023 * sin(position * 2.6), 2100.0)
      + 0.48 * ridge(distance - 0.048 + 0.022 * cos(position * 3.9), 1850.0);
    float split = 0.5 + 0.5 * sin(position * 1.7 - phase);
    strands += 0.58 * split * ridge(distance + 0.075 * split, 3650.0);
    float glints = pow(0.5 + 0.5 * sin(position * 4.4), 9.0);
    return vec3(0.011, 0.18, 1.0) * veil
      + vec3(0.21, 0.82, 1.46) * strands * (0.37 + 0.46 * flow)
      + mix(vec3(0.29, 0.93, 1.62), vec3(1.32, 1.94, 2.66), max(glints, flow)) * filament;
  }

  vec3 plasmaBands(vec3 p, float phase) {
    float crest = 0.29 + 0.25 * ridge(p.x - 0.07, 5.4) + 0.10 * p.x;
    float sweep = -0.17 + 0.23 * sin(3.65 * p.x - 0.32) + 0.13 * p.x;
    float drift = sin(p.x * 4.3 + p.z * 3.4 + phase);
    crest += 0.046 * drift + 0.076 * (p.z - 0.45);
    sweep -= 0.038 * drift + 0.11 * (p.z - 0.45);
    float amount = smoothstep(0.0, 0.65, uTime);
    float path = p.x * 0.90 + p.z * 0.27;
    float top = energyPacket(path - uTime * 0.57 + 0.16) * amount;
    float bottom = energyPacket(-path - uTime * 0.47 + 0.56) * amount;
    return ribbonLight(p, crest, phase, top) * 0.88 + ribbonLight(p, sweep, -phase + 1.9, bottom);
  }

  // Resolve the bright filaments at the exact intersections rather than at fixed ray steps.
  vec3 bandLayer(vec3 closest, vec3 ray, float radius, float phase) {
    float span = sqrt(max(0.0, radius * radius - dot(closest, closest)));
    return smoothstep(0.0, 0.19, span) * (
      plasmaBands(closest - ray * span, phase) + 0.12 * plasmaBands(closest + ray * span, phase)
    );
  }

  vec4 plasmaDetail(vec3 point, float phase, float roll, float keepReferenceCore) {
    float coverage = smoothstep(0.07, 0.29, abs(point.z));
    vec2 plane = point.xy;
    if (point.z < 0.0) {
      plane.x = -plane.x;
      roll += 0.68;
    }
    float c = cos(roll);
    float s = sin(roll);
    plane = mat2(c, s, -s, c) * plane;
    vec2 uv = vec2(0.5) + 0.428 * plane / (1.0 - abs(point.z) / 3.82);
    uv += 0.011 * sin(phase) * sin(vec2(uv.y * 26.0 + uv.x * 9.0, uv.x * 23.0 - uv.y * 11.0) + phase);
    vec3 color = max(texture2D(uDetail, uv).rgb - vec3(0.0010, 0.0014, 0.0042), vec3(0.0));
    float centerDistance = length(uv - vec2(0.497, 0.523));
    float referenceHeart = 1.0 - smoothstep(0.028, 0.096, centerDistance);

    // The two streams counterflow along the bright texture strands.
    float split = 0.51 + 0.07 * sin(6.0 * (uv.x - 0.5));
    float topLane = smoothstep(split - 0.045, split + 0.045, uv.y);
    float topPath = 1.75 * uv.x + 0.12 * sin(7.0 * uv.y);
    float bottomPath = -1.68 * uv.x + 0.13 * sin(5.0 * uv.y);
    float top = energyPacket(topPath - uTime * 0.57 + 0.16);
    float bottom = energyPacket(bottomPath - uTime * 0.47 + 0.56);
    float passingLight = mix(bottom, top, topLane);
    float litStrand = smoothstep(0.025, 0.37, color.b);
    float envelope = (1.0 - referenceHeart) * (1.0 - smoothstep(0.32, 0.47, centerDistance));
    float flow = smoothstep(0.0, 0.65, uTime) * litStrand * envelope;
    color *= 1.0 - 0.14 * flow * (1.0 - passingLight);
    color += (1.0 - color) * vec3(0.29, 0.53, 0.82) * (0.47 * flow * passingLight);

    // At an oblique angle the luminous center belongs to the volume, not the surface projection.
    coverage *= 1.0 - referenceHeart * (1.0 - keepReferenceCore);
    return vec4(color, coverage);
  }

  vec4 projectDetail(vec3 point, float phase, vec3 view, float keepReferenceCore) {
    vec3 facing = view / max(view.x, max(view.y, view.z));
    vec3 reliability = facing * facing;
    vec4 front = plasmaDetail(point, phase, 0.0, keepReferenceCore);
    float coverage = front.a * reliability.z;
    float weight = coverage * coverage;
    vec3 color = front.rgb * weight;
    // Favor the projection facing the camera while neighbors fill its faded edges.
    if (reliability.x > 0.02) {
      vec4 side = plasmaDetail(vec3(-point.z, point.y, point.x), -phase, 0.21, 0.0);
      float sideCoverage = side.a * reliability.x * smoothstep(0.02, 0.08, reliability.x);
      float sideWeight = sideCoverage * sideCoverage;
      color += side.rgb * sideWeight;
      weight += sideWeight;
      coverage += sideCoverage;
    }
    if (reliability.y > 0.02) {
      vec4 cap = plasmaDetail(vec3(point.x, -point.z, point.y), phase, 0.52, 0.0);
      float capCoverage = cap.a * reliability.y * smoothstep(0.02, 0.08, reliability.y);
      float capWeight = capCoverage * capCoverage;
      color += cap.rgb * capWeight;
      weight += capWeight;
      coverage += capCoverage;
    }
    return vec4(color / max(weight, 0.001), min(coverage, 1.0));
  }

  vec3 edgeFilaments(vec3 p, float radiusSquared, float phase) {
    float sweep = dot(p, vec3(13.0, -17.0, 11.0)) + phase;
    float fold = sin(sweep + 1.2 * sin(dot(p, vec3(-7.0, 6.0, 8.0)) - phase));
    float current = sin(dot(p, vec3(8.0, 12.0, -15.0)) + 1.5 * fold - phase);
    float broken = smoothstep(0.02, 0.92, current);
    float distance = radiusSquared - (0.917 + 0.057 * fold);
    float filament = ridge(distance, 7400.0) * broken * broken;
    float branch = ridge(distance - 0.017 - 0.012 * current, 6700.0) * broken * (0.5 + 0.5 * fold);
    float haze = ridge(distance, 990.0) * broken;
    float feather = 1.0 - smoothstep(0.992, 1.055, radiusSquared);
    return feather * (vec3(0.065, 0.29, 0.83) * (0.24 * filament + 0.11 * branch)
      + vec3(0.091, 0.06, 0.48) * (0.07 * haze));
  }

  vec3 vortexLight(vec3 p, float radiusSquared, float phase) {
    vec2 plane = vec2(dot(p, vRight), dot(p, vUp));
    float angle = atan(plane.y, plane.x + 0.00001);
    float spiral = sin(angle + 26.0 * sqrt(radiusSquared) - phase);
    float arm = ridge(1.0 - spiral, 4.2) * (1.0 - exp(-380.0 * radiusSquared));
    float halo = exp(-49.0 * radiusSquared);
    float hotSpot = exp(-445.0 * radiusSquared);
    return vec3(0.94, 0.99, 1.0) * hotSpot
      + vec3(0.08, 0.40, 0.69) * halo * (0.25 + 0.75 * arm);
  }

  void main() {
    vec3 ray = normalize(vSurface - vEye);
    float middle = -dot(vEye, ray);
    vec3 closest = vEye + ray * middle;
    float closestDistanceSquared = dot(closest, closest);
    float chord = sqrt(max(0.0, 1.0 - closestDistanceSquared));
    const int samples = 20;
    float stepSize = 2.0 * chord / float(samples);
    vec3 light = vec3(0.0);
    float phase = uTime * 0.15;

    for (int i = 0; i < samples; i++) {
      vec3 p = closest + ray * ((float(i) + 0.5) * stepSize - chord);
      float r2 = dot(p, p);
      float bound = 1.0 - smoothstep(0.81, 0.99, r2);
      float twist = sin(p.x * 6.0 + p.z * 4.0 + phase);
      float fold = sin(p.y * 13.0 - p.x * 7.0 + twist * 2.4 + p.z * 8.0
        + 0.58 * sin(p.x * 11.0 + p.y * 5.0 - p.z * 9.0));
      float wisps = ridge(fold, 26.0) * (0.4 + 0.6 * twist * twist);
      float corona = ridge(r2 - 0.86, 290.0) * (0.12 + wisps * 0.94);
      float halo = exp(-39.0 * r2);
      light += (vec3(0.085, 0.035, 0.54) * wisps * r2
        + vec3(0.13, 0.50, 1.78) * corona
        + vec3(0.12, 0.58, 1.55) * halo) * (bound * stepSize);
    }

    light += bandLayer(closest, ray, 0.92, phase);
    light += bandLayer(closest, ray, 0.78, -phase + 0.7) * 0.17;
    if (!uHasDetail) {
      float heart = exp(-268.0 * closestDistanceSquared);
      light += vec3(2.1, 2.9, 3.55) * heart;
    }
    vec3 color = 1.0 - exp(-light * 1.55);
    float shade = 0.0;
    if (uHasDetail) {
      vec3 view = normalize(vEye);
      float keepReferenceCore = smoothstep(0.974, 0.998, view.z);
      vec4 detail = projectDetail(closest - ray * chord, phase, abs(view), keepReferenceCore);
      detail.a *= smoothstep(0.12, 0.37, chord);
      color = mix(color, detail.rgb, detail.a * 0.98);
      shade = detail.a * (1.0 - smoothstep(0.67, 0.96, closestDistanceSquared)) * 0.18;
      float oblique = 1.0 - keepReferenceCore;
      if (oblique > 0.0 && closestDistanceSquared < 0.16) {
        float coreFade = 1.0 - smoothstep(0.095, 0.16, closestDistanceSquared);
        vec3 emission = vortexLight(closest, closestDistanceSquared, uTime * 0.87) * oblique * coreFade;
        color += (1.0 - color) * min(emission, vec3(1.0));
      }
    }
    if (closestDistanceSquared > 0.76) {
      vec3 filaments = edgeFilaments(closest, closestDistanceSquared, phase);
      color += (1.0 - color) * (1.0 - exp(-filaments));
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    float brightness = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
    float alpha = min(1.0, max(brightness * 1.05, shade));
    gl_FragColor = vec4(gl_FragColor.rgb / max(alpha, 0.001), alpha);
  }
`;

export function createEnergyCoreMaterial(radius, onDetailReady) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uRadius: { value: radius },
      uTime: { value: 0 },
      uDetail: { value: null },
      uHasDetail: { value: false }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });

  if (typeof document !== "undefined") {
    detailLoad ??= new THREE.TextureLoader().loadAsync(detailUrl.href).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }, () => null);
    detailLoad.then((texture) => {
      if (!texture) return;
      material.uniforms.uDetail.value = texture;
      material.uniforms.uHasDetail.value = true;
      onDetailReady?.();
    });
  }
  return material;
}
