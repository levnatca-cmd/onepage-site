import * as THREE from "../../../../vendor/three/three.module.min.js";

const vertexShader = `
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vToCamera;
  varying vec3 vLocalCamera;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vSurface = position;
    vNormal = normalMatrix * normal;
    vToCamera = -view.xyz;
    vLocalCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const planetaryFragmentShader = `
  uniform float uTime;
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vToCamera;

  void main() {
    vec3 p = normalize(vSurface);
    float facing = max(0.0, dot(normalize(vNormal), normalize(vToCamera)));
    float drift = uTime * 0.75;
    float fold = sin(p.z * 6.0 + p.x * 3.0 - drift);
    float ribbon = sin(p.y * 10.0 - p.x * 5.0 + fold * 1.4 + drift);
    float filament = pow(1.0 - abs(ribbon), 5.0);
    float arc = pow(1.0 - abs(sin(p.x * 9.0 + p.z * 4.0 - p.y * 2.0 - drift * 0.7)), 7.0);
    vec3 color = mix(vec3(0.004, 0.075, 0.15), vec3(0.045, 0.45, 0.59), facing * 0.55 + fold * 0.17 + 0.22);
    color += filament * vec3(0.34, 0.93, 1.0) * (0.64 + facing * 0.36);
    color += arc * vec3(0.24, 0.12, 0.58) * (0.52 + 0.48 * fold);
    color += pow(1.0 - facing, 2.3) * vec3(0.12, 0.55, 0.69);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createEnergyCoreMaterial(layout = "atom") {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader,
    fragmentShader: layout === "planets" ? planetaryFragmentShader : `
      uniform float uTime;
      varying vec3 vSurface;
      varying vec3 vNormal;
      varying vec3 vToCamera;
      varying vec3 vLocalCamera;

      void nucleon(vec3 origin, vec3 ray, vec3 center, float radius, vec3 tint,
          inout float nearest, inout vec3 body, inout vec3 binding) {
        vec3 delta = center - origin;
        float along = dot(delta, ray);
        float distanceSquared = max(0.0, dot(delta, delta) - along * along);
        float radiusSquared = radius * radius;
        float outerRadius = radius + 0.105;
        float aura = 1.0 - smoothstep(radiusSquared, outerRadius * outerRadius, distanceSquared);
        binding += tint * aura * 0.066;
        if (distanceSquared >= radiusSquared || along <= 0.0) return;

        float depth = along - sqrt(radiusSquared - distanceSquared);
        if (depth >= nearest) return;
        nearest = depth;
        vec3 normal = (origin + ray * depth - center) / radius;
        float facing = max(0.0, dot(normal, -ray));
        float light = max(0.0, dot(normal, vec3(-0.45, 0.69, 0.57)));
        float glint = pow(light, 8.0) * (0.36 + 0.64 * facing);
        float rim = (1.0 - facing) * (1.0 - facing);
        body = tint * (0.14 + 0.64 * light + 0.39 * facing * facing + 0.24 * rim);
        body += mix(tint, vec3(0.94, 0.99, 1.0), 0.72) * glint * 0.66;
      }

      void main() {
        // Use the existing sphere as a volume proxy and shade the nearest nucleon.
        vec3 origin = normalize(vSurface);
        vec3 ray = normalize(vSurface - vLocalCamera);
        float facing = max(0.0, dot(normalize(vNormal), normalize(vToCamera)));
        float breath = 1.0 + sin(uTime * 1.3) * 0.025;
        float nearest = 2.0;
        vec3 body = vec3(0.0);
        vec3 binding = vec3(0.0);
        nucleon(origin, ray, vec3(-0.42, 0.23, 0.13), 0.36 * breath, vec3(0.08, 0.69, 0.88), nearest, body, binding);
        nucleon(origin, ray, vec3(0.35, 0.29, 0.24), 0.36, vec3(0.14, 0.53, 0.93), nearest, body, binding);
        nucleon(origin, ray, vec3(0.02, -0.37, 0.35), 0.35, vec3(0.97, 0.43, 0.10), nearest, body, binding);
        nucleon(origin, ray, vec3(0.02, 0.43, -0.29), 0.35, vec3(0.44, 0.22, 0.87), nearest, body, binding);
        nucleon(origin, ray, vec3(-0.31, -0.32, -0.31), 0.35, vec3(0.19, 0.65, 0.92), nearest, body, binding);
        nucleon(origin, ray, vec3(0.39, -0.24, -0.26), 0.36 * breath, vec3(0.31, 0.35, 0.89), nearest, body, binding);

        float edge = pow(1.0 - facing, 2.8);
        vec3 color = vec3(0.003, 0.019, 0.031) + edge * vec3(0.055, 0.24, 0.34);
        color += body + binding * (0.85 + sin(uTime * 2.2) * 0.15);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false
  });
}

export function createEnergyHaloMaterial(layout = "atom") {
  const halo = layout === "planets"
    ? "vec4(0.10, 0.73, 0.94, glow * uGlow)"
    : "vec4(0.06, 0.44, 0.62, glow * uGlow * 0.72)";
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0.20 } },
    vertexShader,
    fragmentShader: `
      uniform float uGlow;
      varying vec3 vNormal;
      varying vec3 vToCamera;

      void main() {
        float facing = max(0.0, dot(normalize(vNormal), normalize(vToCamera)));
        float glow = facing * facing * facing;
        gl_FragColor = ${halo};
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}
