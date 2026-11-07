// A distant spherical distribution keeps glyphs around every orbit direction.
function createGlyphFieldData(random, count = 768) {
  const positions = [],
    sizes = [],
    cells = [],
    opacities = [],
    phases = [];
  for (let i = 0; i < count; i++) {
    const vertical = random() * 2 - 1;
    const azimuth = random() * Math.PI * 2;
    const radius = 88 + random() * 10;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    positions.push(
      Math.cos(azimuth) * horizontal * radius,
      vertical * radius,
      Math.sin(azimuth) * horizontal * radius,
    );
    sizes.push(12 + random() * 8);
    cells.push(Math.floor(random() * 64));
    opacities.push(0.07 + random() * 0.09);
    phases.push(random() * Math.PI * 2);
  }
  return { positions, sizes, cells, opacities, phases };
}

function makeGlyphField(T, random, pixelRatio) {
  const atlas = document.createElement("canvas");
  atlas.width = atlas.height = 256;
  const context = atlas.getContext("2d");
  context.clearRect(0, 0, 256, 256);
  context.fillStyle = "#ffffff";
  context.font = "22px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let cell = 0; cell < 64; cell++) {
    context.fillText(
      String.fromCharCode(0x30a1 + cell),
      (cell % 8) * 32 + 16,
      Math.floor(cell / 8) * 32 + 16,
    );
  }
  const texture = new T.CanvasTexture(atlas);
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  const data = createGlyphFieldData(random);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(data.positions, 3));
  for (const [attribute, values] of Object.entries({
    aSize: data.sizes,
    aCell: data.cells,
    aOpacity: data.opacities,
    aPhase: data.phases,
  })) {
    geometry.setAttribute(attribute, new T.Float32BufferAttribute(values, 1));
  }
  const material = new T.ShaderMaterial({
    uniforms: {
      uAtlas: { value: texture },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uCyan: { value: new T.Color(0x43f5ff) },
      uPink: { value: new T.Color(0xff3c9d) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aCell;
      attribute float aOpacity;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vCell;
      varying float vOpacity;
      void main() {
        vec3 point = position;
        point.y += sin(uTime * 0.035 + aPhase) * 0.65;
        vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uPixelRatio * 100.0 / max(40.0, -viewPosition.z), 8.0 * uPixelRatio, 20.0 * uPixelRatio);
        vCell = aCell;
        vOpacity = aOpacity * (0.9 + 0.1 * sin(uTime * 0.12 + aPhase));
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform vec3 uCyan;
      uniform vec3 uPink;
      varying float vCell;
      varying float vOpacity;
      void main() {
        vec2 cell = vec2(mod(vCell, 8.0), floor(vCell / 8.0));
        vec2 point = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
        float ink = texture2D(uAtlas, (cell + point) / 8.0).a;
        if (ink < 0.06) discard;
        vec3 tint = mix(uCyan, uPink, step(56.0, vCell));
        gl_FragColor = vec4(tint, ink * vOpacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const object = new T.Points(geometry, material);
  object.name = "spatial-glyph-field";
  object.frustumCulled = false;
  return {
    object,
    update(dt, enabled, motionEnabled) {
      object.visible = enabled;
      if (enabled && motionEnabled) {
        material.uniforms.uTime.value += dt;
        object.rotation.y = material.uniforms.uTime.value * 0.002;
      }
    },
    dispose() {
      object.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
