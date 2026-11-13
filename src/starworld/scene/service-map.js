function makeScene() {
  const T = window.STARWORLD_THREE;
  if (!T) throw new Error("3D engine unavailable");
  const canvas = $("universe"),
    host = $("scene-viewport");
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0x080612, 0);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x080612, 0.011);
  const camera = new T.PerspectiveCamera(44, 1, 0.1, 180);
  const home = { angle: -1.02, tilt: 0.44, distance: 23 };
  let angle = home.angle,
    targetAngle = home.angle,
    tilt = home.tilt,
    targetTilt = home.tilt,
    distance = home.distance,
    targetDistance = home.distance,
    targetX = 0,
    lookX = 0,
    targetZ = 0,
    lookZ = 0;
  scene.add(new T.AmbientLight(0x8997c9, 1.35));
  const key = new T.DirectionalLight(0xbacfff, 2.4);
  key.position.set(-8, 12, 9);
  scene.add(key);
  const light = new T.PointLight(0x8472ff, 16, 24);
  light.position.set(2, 4, 5);
  scene.add(light);
  const root = new T.Group();
  scene.add(root);
  const starsGeometry = new T.BufferGeometry();
  const starPositions = [],
    starColors = [];
  let seed = 9213;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 620; i++) {
    starPositions.push((rand() - 0.5) * 150, (rand() - 0.4) * 85, (rand() - 0.5) * 150);
    const b = 0.3 + rand() * 0.6;
    starColors.push(b * 0.67, b * 0.72, b);
  }
  starsGeometry.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
  starsGeometry.setAttribute("color", new T.Float32BufferAttribute(starColors, 3));
  const stars = new T.Points(
    starsGeometry,
    new T.PointsMaterial({
      size: 0.052,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    }),
  );
  scene.add(stars);
  const grid = new T.GridHelper(70, 35, 0x4b499c, 0x30325e);
  grid.position.y = -4.2;
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  grid.material.opacity = 0.03;
  root.add(grid);
  // Real geometry: low polygon scan terrain beneath the orbital plane.
  const terrainGeometry = new T.PlaneGeometry(59, 44, 52, 40);
  terrainGeometry.rotateX(-Math.PI / 2);
  const tp = terrainGeometry.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i),
      z = tp.getZ(i),
      edge = Math.max(0, (Math.abs(x) - 4) / 23);
    tp.setY(i, -4.5 + Math.sin(x * 0.53 + Math.cos(z * 0.4)) * Math.cos(z * 0.38) * edge * 1.7);
  }
  terrainGeometry.computeVertexNormals();
  const terrain = new T.Mesh(
    terrainGeometry,
    new T.MeshBasicMaterial({
      color: 0x6050aa,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.019,
    }),
  );
  root.add(terrain);
  function orbit(radius, opacity) {
    const points = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      points.push(new T.Vector3(Math.cos(a) * radius, -0.5, Math.sin(a) * radius));
    }
    const geometry = new T.BufferGeometry().setFromPoints(points);
    const line = new T.Line(
      geometry,
      new T.LineBasicMaterial({
        color: 0x777bd9,
        transparent: true,
        depthWrite: false,
        opacity,
      }),
    );
    root.add(line);
  }
  orbit(9.2, 0.13);
  orbit(12, 0.08);
  orbit(16, 0.035);
  const nodes = [],
    pickables = [];
  const globeVertex = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vec4 point = modelViewMatrix * vec4(position, 1.0);
      vView = -point.xyz;
      gl_Position = projectionMatrix * point;
    }
  `;
  const coreFragment = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vView;

    float band(float coordinate, float center, float width) {
      float offset = (coordinate - center) / width;
      return exp(-offset * offset);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 view = normalize(vView);
      vec3 local = normalize(vPosition);
      float facing = clamp(dot(normal, view), 0.0, 1.0);
      float rim = 1.0 - facing;

      // Folded light through the body and reflections on the outer glass.
      float fold = local.y + 0.42 * sin(local.x * 2.6 - local.z * 2.1 + 0.8)
        + 0.15 * sin(local.z * 4.7 + local.x * 1.8);
      float veil = band(fold, -0.1, 0.38);
      float thread = band(fold + 0.065 * sin(local.x * 6.0 + local.z * 3.0), -0.075, 0.028);
      float echo = band(fold + 0.12 * sin(local.z * 3.6 - local.x * 4.2), 0.17, 0.022);
      float echoFade = smoothstep(0.12, 0.84, local.y + local.z * 0.35 + 0.35);
      float depth = 0.35 + 0.65 * smoothstep(-0.9, 0.8, local.z - local.y * 0.25);
      vec3 blue = vec3(0.12, 0.35, 1.0);
      vec3 violet = vec3(0.56, 0.22, 0.99);
      vec3 tint = mix(blue, violet, smoothstep(-0.55, 0.8, normal.x - normal.y * 0.5));
      vec3 color = vec3(0.035, 0.035, 0.12) + tint * (0.09 + veil * depth * 0.40);
      color += vec3(0.38, 0.67, 1.0) * thread * depth * smoothstep(0.12, 0.56, facing) * 0.52;
      color += vec3(0.68, 0.47, 1.0) * echo * depth * echoFade * 0.3;

      float topLight = max(dot(normal, normalize(vec3(-0.62, 0.74, 0.38))), 0.0);
      float bottomLight = max(dot(normal, normalize(vec3(0.55, -0.72, 0.42))), 0.0);
      color += vec3(0.22, 0.48, 1.0) * pow(topLight, 4.0) * 0.42;
      color += vec3(0.48, 0.25, 0.95) * pow(bottomLight, 7.0) * 0.35;
      color += vec3(0.62, 0.76, 1.0) * pow(topLight, 30.0) * 0.62;
      color += tint * pow(rim, 2.5) * 0.92;
      color += vec3(0.67, 0.72, 1.0) * pow(rim, 7.0) * 0.86;
      gl_FragColor = vec4(color, 1.0);
    }
  `;
  const globeFragment = `
    varying vec3 vNormal;
    varying vec3 vView;
    uniform vec3 uColor;
    void main() {
      vec3 normal = normalize(vNormal);
      float facing = clamp(dot(normal, normalize(vView)), 0.0, 1.0);
      float light = max(dot(normal, normalize(vec3(-0.7, 0.65, 0.6))), 0.0);
      float rim = pow(1.0 - facing, 2.4);
      vec3 tint = mix(uColor, vec3(0.25, 0.3, 0.6), 0.30);
      gl_FragColor = vec4(vec3(0.027, 0.028, 0.075) + tint * (0.3 * light + 0.42 * rim), 1.0);
    }
  `;
  const glowVertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const coreRadius = worlds[0].radius;
  const coreHalo = new T.Mesh(
    new T.PlaneGeometry(coreRadius * 4.1, coreRadius * 4.1),
    new T.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 point = vUv * 2.0 - 1.0;
          float radius = length(point);
          float glow = exp(-radius * radius * 3.5) * (1.0 - smoothstep(0.38, 1.0, radius));
          vec3 tint = mix(vec3(0.14, 0.22, 0.7), vec3(0.4, 0.16, 0.72), vUv.x);
          gl_FragColor = vec4(tint, glow * 0.39);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  coreHalo.position.set(...worlds[0].position);
  root.add(coreHalo);

  const coreRibbon = new T.Mesh(
    new T.RingGeometry(coreRadius * 1.38, coreRadius * 1.63, 128),
    new T.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 point = vUv * 2.0 - 1.0;
          float radius = length(point);
          float angle = atan(point.y, point.x);
          float sweep = 0.24 + 0.76 * pow(0.5 + 0.5 * cos(angle + 0.8), 1.8);
          float band = smoothstep(0.85, 0.92, radius) * (1.0 - smoothstep(0.93, 1.0, radius));
          float edge = smoothstep(0.91, 0.927, radius) * (1.0 - smoothstep(0.93, 0.947, radius));
          vec3 tint = mix(vec3(0.23, 0.39, 1.0), vec3(0.74, 0.46, 1.0), 0.5 + 0.5 * sin(angle));
          gl_FragColor = vec4(tint, sweep * (band * 0.2 + edge * 0.72));
        }
      `,
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  coreRibbon.position.copy(coreHalo.position);
  coreRibbon.rotation.set(-1.38, -0.09, 0.32);
  root.add(coreRibbon);

  const satelliteNeutral = new T.Color(0x8b98c4);
  worlds.forEach((w, i) => {
    const group = new T.Group();
    group.position.set(...w.position);
    root.add(group);
    const geometry = makeServiceGeometry(T, w, i);
    const tint = new T.Color(w.color);
    if (w.model) tint.lerp(satelliteNeutral, 0.35);
    const material = w.model
      ? new T.MeshStandardMaterial({
          color: 0x131c35,
          emissive: tint,
          emissiveIntensity: 0.085,
          metalness: 0.45,
          roughness: 0.3,
        })
      : new T.ShaderMaterial({
          vertexShader: globeVertex,
          fragmentShader: i === 0 ? coreFragment : globeFragment,
          uniforms: { uColor: { value: tint } },
        });
    const globe = new T.Mesh(geometry, material);
    group.add(globe);
    globe.userData.id = i;
    pickables.push(globe);
    if (w.model) {
      const wire = new T.LineSegments(
        new T.EdgesGeometry(geometry, 25),
        new T.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.33 }),
      );
      globe.add(wire);
      const r = w.radius,
        front = r * 0.23;
      const emblem = new T.Group();
      if (w.model === "phone") {
        const screen = new T.Mesh(
          new T.PlaneGeometry(r * 0.94, r * 1.47),
          new T.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.1 }),
        );
        screen.position.z = front;
        emblem.add(screen);
        const lines = [
            [-0.19, 0.82, 0.19, 0.82],
            [-0.2, -0.81, 0.2, -0.81],
            [-0.3, 0.3, 0.3, 0.3],
            [-0.3, 0.06, 0.1, 0.06],
            [-0.3, -0.18, 0.22, -0.18],
          ],
          vertices = [];
        for (const [x, y, xx, yy] of lines)
          vertices.push(x * r, y * r, front + 0.01, xx * r, yy * r, front + 0.01);
        emblem.add(
          new T.LineSegments(
            new T.BufferGeometry().setAttribute(
              "position",
              new T.Float32BufferAttribute(vertices, 3),
            ),
            new T.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.51 }),
          ),
        );
      } else {
        emblem.add(
          new T.Line(
            new T.BufferGeometry().setFromPoints([
              new T.Vector3(-0.35 * r, 0, front),
              new T.Vector3(-0.08 * r, -0.25 * r, front),
              new T.Vector3(0.38 * r, 0.32 * r, front),
            ]),
            new T.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.51 }),
          ),
        );
      }
      globe.add(emblem);
    }

    if (i === 0) {
      const atmosphere = new T.Mesh(
        new T.SphereGeometry(w.radius * 1.04, 48, 32),
        new T.ShaderMaterial({
          vertexShader: globeVertex,
          fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vec3 normal = normalize(vNormal);
              float rim = pow(1.0 - abs(dot(normal, normalize(vView))), 3.2);
              vec3 tint = mix(vec3(0.20, 0.36, 1.0), vec3(0.59, 0.37, 1.0), normal.x * 0.5 + 0.5);
              gl_FragColor = vec4(tint, rim * 0.34);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: T.FrontSide,
          blending: T.AdditiveBlending,
        }),
      );
      group.add(atmosphere);
    }
    nodes.push({ group, globe, w });
  });
  // Service relationships connect every capability to the central product.
  const centre = new T.Vector3(...worlds[0].position);
  worlds.slice(1).forEach((w) => {
    const destination = new T.Vector3(...w.position),
      direction = destination.clone().sub(centre).normalize();
    const start = centre.clone().addScaledVector(direction, worlds[0].radius * 1.12),
      end = destination.clone().addScaledVector(direction, -w.radius * 1.2);
    const geometry = new T.BufferGeometry().setFromPoints([start, end]);
    const connection = new T.Line(
      geometry,
      new T.LineDashedMaterial({
        color: w.color,
        dashSize: 0.16,
        gapSize: 0.12,
        transparent: true,
        depthWrite: false,
        opacity: 0.17,
      }),
    );
    connection.computeLineDistances();
    root.add(connection);
  });
  const selection = new T.Group();
  const sg = new T.BufferGeometry(),
    sv = [];
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2;
    for (let i = 0; i < 11; i++) {
      const a0 = a + i * 0.024,
        a1 = a + (i + 1) * 0.024;
      sv.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
    }
  }
  sg.setAttribute("position", new T.Float32BufferAttribute(sv, 3));
  selection.add(
    new T.LineSegments(
      sg,
      new T.LineBasicMaterial({ color: 0xbbbeff, transparent: true, opacity: 0.7 }),
    ),
  );
  scene.add(selection);
  const scanRing = new T.Mesh(
    new T.RingGeometry(0.985, 1, 100),
    new T.MeshBasicMaterial({
      color: 0xa397ff,
      transparent: true,
      opacity: 0,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  scanRing.rotation.x = -Math.PI / 2;
  scanRing.position.y = -0.45;
  scene.add(scanRing);
  // Transparent glyph sprites occupy a distant volume instead of a flat wall.
  const glyphField = makeGlyphField(T, rand, renderer.getPixelRatio());
  scene.add(glyphField.object);
  let width = 1,
    height = 1;
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || drag) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.lastX,
      dy = e.clientY - drag.lastY;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) drag.moved = true;
    if (drag.moved) {
      targetAngle -= dx * 0.006;
      if (e.pointerType !== "touch")
        targetTilt = Math.max(0.23, Math.min(1.12, targetTilt + dy * 0.003));
    }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const click = !drag.moved;
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!click) return;
    const box = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - box.left) / width) * 2 - 1,
      (-(e.clientY - box.top) / height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) selectWorld(hit.object.userData.id, { reveal: true });
  });
  const cancel = () => {
    drag = null;
  };
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  // Ordinary wheel and pinch gestures retain page scrolling/browser zoom. Map zoom uses its buttons.
  let contextLost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    setMapAvailable(false);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    resize();
    setMapAvailable(true);
  });
  const labelPoint = new T.Vector3(),
    look = new T.Vector3();
  const labelElements = [...$("world-labels").children];
  const hudElements = [...document.querySelectorAll(".worlds,.map-tools,.map-corner")];
  let activeLabel = labelElements[selected],
    labelSize = null,
    hudBounds = [],
    measureLabels = true;
  const observeLabels = new ResizeObserver(() => {
    measureLabels = true;
  });
  for (const element of [host, ...labelElements, ...hudElements]) observeLabels.observe(element);
  for (const element of labelElements) element.style.visibility = "hidden";
  function measureLayout() {
    const origin = host.getBoundingClientRect();
    labelSize = { width: activeLabel.offsetWidth, height: activeLabel.offsetHeight };
    hudBounds = hudElements
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => ({
        x: r.left - origin.left,
        y: r.top - origin.top,
        width: r.width,
        height: r.height,
      }));
    measureLabels = false;
  }
  function placeSelectedLabel() {
    if (!labelSize.width || !labelSize.height) return;
    const node = nodes[selected];
    labelPoint.copy(node.group.position);
    labelPoint.y -= node.w.radius + 0.5;
    labelPoint.project(camera);
    const inView =
      labelPoint.z >= -1 &&
      labelPoint.z <= 1 &&
      Math.abs(labelPoint.x) <= 1 &&
      Math.abs(labelPoint.y) <= 1;
    const box =
      inView &&
      placeMapLabel(
        { x: (labelPoint.x * 0.5 + 0.5) * width, y: (-labelPoint.y * 0.5 + 0.5) * height },
        labelSize,
        { width, height },
        hudBounds,
      );
    activeLabel.style.visibility = box ? "visible" : "hidden";
    if (box) {
      activeLabel.style.left = `${box.x}px`;
      activeLabel.style.top = `${box.y}px`;
    }
  }

  $("render-status").textContent = "3D SERVICE MAP";
  return {
    select() {
      activeLabel.style.visibility = "hidden";
      activeLabel = labelElements[selected];
      measureLabels = true;
    },
    zoom(amount) {
      targetDistance = Math.max(20, Math.min(47, targetDistance + amount));
    },
    reset() {
      targetAngle = home.angle;
      targetTilt = home.tilt;
      targetDistance = home.distance;
      targetX = 0;
      targetZ = 0;
    },
    jump(id) {
      targetX = worlds[id].position[0] * 0.34;
      targetZ = worlds[id].position[2] * 0.34;
      targetDistance = id === 0 ? 21 : 22;
    },
    update(dt, time) {
      if (contextLost) return;
      if (measureLabels) measureLayout();
      const ease = reduced ? 1 : Math.min(1, dt * 5);
      angle += (targetAngle - angle) * ease;
      tilt += (targetTilt - tilt) * ease;
      distance += (targetDistance - distance) * ease;
      lookX += (targetX - lookX) * ease;
      lookZ += (targetZ - lookZ) * ease;
      const actualDistance = distance * Math.min(1.19, Math.max(1, 1 / camera.aspect));
      camera.position.set(
        Math.sin(angle) * actualDistance,
        Math.sin(tilt) * actualDistance,
        Math.cos(angle) * Math.cos(tilt) * actualDistance,
      );
      look.set(lookX, worlds[0].position[1], lookZ);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      coreHalo.quaternion.copy(camera.quaternion);
      const motionEnabled = !reduced && !effectivePause();
      if (motionEnabled) {
        nodes.forEach((node, index) => {
          node.globe.rotation.y = node.w.model
            ? Math.sin(time * 0.25) * 0.18
            : node.globe.rotation.y + dt * (index === 0 ? 0.09 : 0.026);
        });
      }
      placeSelectedLabel();
      selection.visible = selected !== 0;
      if (selection.visible) {
        selection.position.copy(nodes[selected].group.position);
        selection.quaternion.copy(camera.quaternion);
        selection.scale.setScalar(worlds[selected].radius * 1.42);
        selection.rotateZ(reduced ? 0 : time * 0.025);
      }
      glyphField.update(dt, rain, motionEnabled);
      const scanRemaining = scanFxUntil - time;
      if (scanRemaining > 0 && !reduced) {
        scanRing.visible = true;
        scanRing.scale.setScalar(1 + (1.2 - scanRemaining) * 17);
        scanRing.material.opacity = (scanRemaining / 1.2) * 0.65;
      } else scanRing.visible = false;
      renderer.render(scene, camera);
    },
    dispose() {
      observeLabels.disconnect();
      for (const effect of [coreHalo, coreRibbon]) {
        effect.geometry.dispose();
        effect.material.dispose();
      }
      glyphField.dispose();
      renderer.dispose();
    },
  };
}
