const SPARK_COUNT = 96;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function createQuizBurst(THREE, scene) {
  const root = new THREE.Group();
  root.name = "quiz-core-burst";
  root.visible = false;

  const directions = new Float32Array(SPARK_COUNT * 3);
  const variation = new Float32Array(SPARK_COUNT * 2);
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / SPARK_COUNT;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * GOLDEN_ANGLE;
    directions.set([Math.cos(angle) * radius, y, Math.sin(angle) * radius], index * 3);
    variation.set([((index * 43) % 97) / 97, ((index * 67) % 101) / 101], index * 2);
  }

  const additive = {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  };
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(directions, 3));
  sparkGeometry.setAttribute("variation", new THREE.BufferAttribute(variation, 2));
  const sparkUniforms = { uSpread: { value: 0 }, uFade: { value: 0 }, uOutward: { value: 1 } };
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: sparkUniforms,
      vertexShader: `
        uniform float uSpread;
        uniform float uFade;
        uniform float uOutward;
        attribute vec2 variation;
        varying vec2 vAxis;
        varying float vFade;
        varying float vTint;

        void main() {
          float spread = clamp((uSpread - variation.x * 0.14) / 0.86, 0.0, 1.0);
          float travel = 1.0 - pow(1.0 - spread, 2.2);
          float distance = 0.25 + travel * (2.2 + variation.y * 2.45);
          vec3 ray = mat3(modelViewMatrix) * position;
          vAxis = ray.xy / max(length(ray.xy), 0.0001) * uOutward;
          vFade = uFade * (0.42 + variation.y * 0.58) * smoothstep(0.0, 0.09, spread);
          vTint = variation.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position * distance, 1.0);
          gl_PointSize = 5.0 + variation.y * 10.0;
        }
      `,
      fragmentShader: `
        varying vec2 vAxis;
        varying float vFade;
        varying float vTint;

        void main() {
          vec2 pixel = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
          float along = dot(pixel, vAxis);
          float across = dot(pixel, vec2(-vAxis.y, vAxis.x));
          float tail = (1.0 - smoothstep(0.02, 0.22, abs(across)))
            * smoothstep(-0.92, 0.12, along) * (1.0 - smoothstep(0.25, 0.78, along));
          float head = 1.0 - smoothstep(0.02, 0.29, length(vec2((along - 0.34) * 1.6, across)));
          vec3 color = mix(vec3(0.05, 0.72, 1.0), vec3(0.42, 0.21, 1.0), step(0.58, vTint));
          color = mix(color, vec3(1.0, 0.49, 0.14), step(0.82, vTint));
          color = mix(color, vec3(0.83, 0.97, 1.0), head * 0.64);
          gl_FragColor = vec4(color, (tail * 0.54 + head * 0.46) * vFade);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  // The shader expands the cloud beyond the direction vectors stored in the geometry.
  sparks.frustumCulled = false;
  root.add(sparks);

  const coronaUniforms = { uTravel: { value: 0 }, uRing: { value: 0 }, uFlare: { value: 0 } };
  const corona = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 10.2),
    new THREE.ShaderMaterial({
      ...additive,
      depthTest: false,
      uniforms: coronaUniforms,
      vertexShader: `
        varying vec2 vOffset;

        void main() {
          vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float scale = length(modelMatrix[0].xyz);
          vOffset = position.xy;
          gl_Position = projectionMatrix * (center + vec4(position.xy * scale, 0.0, 0.0));
        }
      `,
      fragmentShader: `
        uniform float uTravel;
        uniform float uRing;
        uniform float uFlare;
        varying vec2 vOffset;

        void main() {
          float radius = length(vOffset);
          float waveDistance = abs(radius - mix(0.68, 4.55, uTravel));
          float wave = 1.0 - smoothstep(0.018, 0.10, waveDistance);
          float halo = 1.0 - smoothstep(0.025, 0.40, waveDistance);
          float echoRadius = mix(0.30, 3.75, uTravel);
          float echo = 1.0 - smoothstep(0.028, 0.15, abs(radius - echoRadius));
          float angle = atan(vOffset.y, vOffset.x + 0.0001);
          float streak = pow(abs(cos(angle * 2.0 - 0.46)), 18.0);
          float flare = exp(-1.6 * radius * radius) * 0.55
            + streak * (1.0 - smoothstep(0.10, 2.0, radius)) * 0.16;
          vec3 color = mix(vec3(0.12, 0.60, 1.0), vec3(0.62, 0.37, 1.0), echo * 0.62);
          color = mix(color, vec3(0.75, 0.96, 1.0), flare);
          gl_FragColor = vec4(color, uRing * (wave * 0.50 + halo * 0.16 + echo * 0.25) + uFlare * flare);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  root.add(corona);
  scene.add(root);

  const smoothstep = THREE.MathUtils.smoothstep;
  return {
    update(center, scale, progress, direction) {
      const phase = THREE.MathUtils.clamp(progress, 0, 1);
      const entering = direction === "enter";
      root.visible = scale > 0 && (!entering || (phase > 0 && phase < 1));
      if (!root.visible) return;
      root.position.copy(center);
      root.scale.setScalar(scale);
      sparkUniforms.uSpread.value = entering ? phase : 1 - phase;
      sparkUniforms.uOutward.value = entering ? 1 : -1;
      sparkUniforms.uFade.value = entering
        ? smoothstep(phase, 0.025, 0.14) * (1 - smoothstep(phase, 0.42, 0.96))
        : (0.15 + 0.85 * smoothstep(phase, 0.0, 0.44)) * (1 - smoothstep(phase, 0.82, 0.99));
      coronaUniforms.uTravel.value = entering
        ? smoothstep(phase, 0.02, 0.76)
        : 1 - smoothstep(phase, 0.05, 0.94);
      coronaUniforms.uRing.value = entering
        ? smoothstep(phase, 0.02, 0.12) * (1 - smoothstep(phase, 0.47, 0.85))
        : (0.12 + 0.48 * smoothstep(phase, 0.05, 0.65)) * (1 - smoothstep(phase, 0.84, 0.995));
      coronaUniforms.uFlare.value = entering
        ? smoothstep(phase, 0.01, 0.075) * (1 - smoothstep(phase, 0.14, 0.32))
        : smoothstep(phase, 0.76, 0.97) * 0.74;
    },
    hide() {
      root.visible = false;
    },
  };
}
