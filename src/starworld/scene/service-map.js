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
  let angle = 0.12,
    targetAngle = 0.12,
    tilt = 0.55,
    targetTilt = 0.55,
    distance = 35,
    targetDistance = 35,
    targetX = 0,
    lookX = 0,
    targetZ = 0,
    lookZ = 0;
  scene.add(new T.AmbientLight(0x897ac9, 2.0));
  const key = new T.DirectionalLight(0x8af5ff, 2.9);
  key.position.set(-8, 12, 9);
  scene.add(key);
  const light = new T.PointLight(0xff3c9d, 30, 24);
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
  for (let i = 0; i < 1250; i++) {
    starPositions.push((rand() - 0.5) * 150, (rand() - 0.4) * 85, (rand() - 0.5) * 150);
    const b = 0.3 + rand() * 0.6;
    starColors.push(i % 3 === 0 ? b : b * 0.42, i % 3 === 0 ? b * 0.35 : b, b);
  }
  starsGeometry.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
  starsGeometry.setAttribute("color", new T.Float32BufferAttribute(starColors, 3));
  const stars = new T.Points(
    starsGeometry,
    new T.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.8 }),
  );
  scene.add(stars);
  const grid = new T.GridHelper(70, 70, 0x882b7a, 0x262447);
  grid.position.y = -4.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.24;
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
    new T.MeshBasicMaterial({ color: 0xa140a7, wireframe: true, transparent: true, opacity: 0.1 }),
  );
  root.add(terrain);
  function orbit(radius, opacity = 0.3) {
    const points = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      points.push(new T.Vector3(Math.cos(a) * radius, -0.5, Math.sin(a) * radius));
    }
    const geometry = new T.BufferGeometry().setFromPoints(points);
    const line = new T.Line(
      geometry,
      new T.LineBasicMaterial({
        color: radius === 9.2 || radius === 16 ? 0xff3c9d : 0x43f5ff,
        transparent: true,
        opacity,
      }),
    );
    root.add(line);
    return line;
  }
  orbit(6, 0.42);
  orbit(9.2, 0.25);
  orbit(12, 0.21);
  orbit(16, 0.09);
  const tickPositions = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2,
      r = 6.3,
      rr = r + (i % 5 === 0 ? 0.32 : 0.1);
    tickPositions.push(
      Math.cos(a) * r,
      -0.5,
      Math.sin(a) * r,
      Math.cos(a) * rr,
      -0.5,
      Math.sin(a) * rr,
    );
  }
  const ticksGeo = new T.BufferGeometry();
  ticksGeo.setAttribute("position", new T.Float32BufferAttribute(tickPositions, 3));
  root.add(
    new T.LineSegments(
      ticksGeo,
      new T.LineBasicMaterial({ color: 0xff63b5, transparent: true, opacity: 0.55 }),
    ),
  );
  const axesGeo = new T.BufferGeometry().setFromPoints([
    new T.Vector3(-23, -0.5, 0),
    new T.Vector3(23, -0.5, 0),
    new T.Vector3(0, -0.5, -23),
    new T.Vector3(0, -0.5, 23),
  ]);
  const axes = new T.LineSegments(
    axesGeo,
    new T.LineDashedMaterial({
      color: 0x6450a4,
      dashSize: 0.2,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.2,
    }),
  );
  axes.computeLineDistances();
  root.add(axes);
  const nodes = [],
    pickables = [];
  const globeVertex = `varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;void main(){vNormal=normalize(normalMatrix*normal);vPosition=position;vec4 p=modelViewMatrix*vec4(position,1.);vWorld=-p.xyz;gl_Position=projectionMatrix*p;}`;
  const globeFragment = `precision mediump float;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;uniform float uTime;uniform vec3 uColor;float noise(vec3 p){return sin(p.x*2.1+sin(p.z*2.4))*cos(p.y*2.3+sin(p.x*1.8))*.5+.5;}void main(){vec3 p=normalize(vPosition);float n=noise(p*2.2)+noise(p*4.)*.28;float land=smoothstep(.62,.70,n);float lat=abs(sin(asin(clamp(p.y,-1.,1.))*52.));float lon=abs(sin(atan(p.z,p.x)*48.));float grid=(1.-smoothstep(.035,.08,min(lat,lon)))*.18;float fres=pow(1.-abs(dot(normalize(vNormal),normalize(vWorld))),2.8);float light=clamp(dot(normalize(vNormal),normalize(vec3(-.7,.8,1.))),0.,1.);float dots=step(.82,sin(p.x*165.)*sin(p.y*150.)*sin(p.z*180.));vec3 color=vec3(.018,.010,.032)+uColor*(land*(.10+light*.17)+grid+fres*.72+land*dots*.55);gl_FragColor=vec4(color,1.);}`;
  worlds.forEach((w, i) => {
    const group = new T.Group();
    group.position.set(...w.position);
    root.add(group);
    const geometry = makeServiceGeometry(T, w, i);
    const material = w.model
      ? new T.MeshStandardMaterial({
          color: 0x19263c,
          emissive: w.color,
          emissiveIntensity: 0.15,
          metalness: 0.45,
          roughness: 0.3,
        })
      : new T.ShaderMaterial({
          vertexShader: globeVertex,
          fragmentShader: globeFragment,
          uniforms: { uTime: { value: 0 }, uColor: { value: new T.Color(w.color) } },
        });
    const globe = new T.Mesh(geometry, material);
    group.add(globe);
    globe.userData.id = i;
    pickables.push(globe);
    const wire = w.model
      ? new T.LineSegments(
          new T.EdgesGeometry(geometry, 25),
          new T.LineBasicMaterial({ color: w.color, transparent: true, opacity: 0.85 }),
        )
      : new T.Mesh(
          new T.IcosahedronGeometry(w.radius * 1.012, i === 0 ? 3 : 2),
          new T.MeshBasicMaterial({
            color: w.color,
            wireframe: true,
            transparent: true,
            opacity: i === 0 ? 0.055 : 0.1,
          }),
        );
    group.add(wire);
    if (w.model) {
      const r = w.radius,
        front = r * 0.23;
      const emblem = new T.Group();
      if (w.model === "phone") {
        const screen = new T.Mesh(
          new T.PlaneGeometry(r * 0.94, r * 1.47),
          new T.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.22 }),
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
            new T.LineBasicMaterial({ color: w.color }),
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
            new T.LineBasicMaterial({ color: w.color }),
          ),
        );
      }
      globe.add(emblem);
    }

    if (!w.model) {
      const atmosphere = new T.Mesh(
        new T.SphereGeometry(w.radius * 1.065, 36, 24),
        new T.ShaderMaterial({
          vertexShader: globeVertex,
          fragmentShader: `varying vec3 vNormal;varying vec3 vWorld;uniform vec3 uColor;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(vWorld))),3.);gl_FragColor=vec4(uColor,f*.17);}`,
          uniforms: { uColor: { value: new T.Color(w.color) } },
          transparent: true,
          depthWrite: false,
          side: T.FrontSide,
          blending: T.AdditiveBlending,
        }),
      );
      group.add(atmosphere);
    }
    const ring = new T.Mesh(
      new T.RingGeometry(w.radius * 1.28, w.radius * 1.29, 90),
      new T.MeshBasicMaterial({
        color: i === 0 ? 0xff3c9d : w.color,
        transparent: true,
        opacity: i === 0 ? 0.72 : 0.4,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2 + 0.17;
    ring.rotation.z = 0.13;
    group.add(ring);
    const lineGeo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(0, -w.radius, 0),
      new T.Vector3(0, -w.position[1] - 0.5, 0),
    ]);
    group.add(
      new T.Line(
        lineGeo,
        new T.LineBasicMaterial({ color: w.color, transparent: true, opacity: 0.27 }),
      ),
    );
    nodes.push({ group, globe, wire, ring, w });
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
        opacity: 0.6,
      }),
    );
    connection.computeLineDistances();
    root.add(connection);
  });
  // Orbiting markers reinforce the connected service map.

  const fragments = new T.Group();
  for (let i = 0; i < 58; i++) {
    const a = rand() * Math.PI * 2,
      r = 6.7 + rand() * 0.5;
    const m = new T.Mesh(
      new T.OctahedronGeometry(0.02 + rand() * 0.045),
      new T.MeshBasicMaterial({ color: 0xe989db, transparent: true, opacity: 0.35 + rand() * 0.5 }),
    );
    m.position.set(Math.cos(a) * r, -0.5 + (rand() - 0.5) * 0.15, Math.sin(a) * r);
    fragments.add(m);
  }
  root.add(fragments);
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
      new T.LineBasicMaterial({ color: 0xf4fa54, transparent: true, opacity: 0.8 }),
    ),
  );
  scene.add(selection);
  const scanRing = new T.Mesh(
    new T.RingGeometry(0.985, 1, 100),
    new T.MeshBasicMaterial({
      color: 0xff3c9d,
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
    width = host.clientWidth;
    height = host.clientHeight;
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
    if (hit) selectWorld(hit.object.userData.id);
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
  let labelSizes = [],
    hudBounds = [],
    measureLabels = true;
  const observeLabels = new ResizeObserver(() => {
    measureLabels = true;
  });
  for (const element of [
    host,
    ...labelElements,
    ...document.querySelectorAll(".worlds,.map-tools,.map-corner"),
  ])
    observeLabels.observe(element);
  function measureLayout() {
    const origin = host.getBoundingClientRect();
    labelSizes = labelElements.map((el) => ({ width: el.offsetWidth, height: el.offsetHeight }));
    hudBounds = [...document.querySelectorAll(".worlds,.map-tools,.map-corner")]
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

  $("render-status").textContent = "3D SERVICE MAP";
  return {
    select() {},
    zoom(amount) {
      targetDistance = Math.max(20, Math.min(47, targetDistance + amount));
    },
    reset() {
      targetAngle = 0.12;
      targetTilt = 0.55;
      targetDistance = 35;
      targetX = 0;
      targetZ = 0;
    },
    jump(id) {
      targetX = worlds[id].position[0] * 0.2;
      targetZ = worlds[id].position[2] * 0.2;
      targetDistance = id === 0 ? 27 : 29;
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
      const mobile = width < 500;
      const actualDistance = distance * (mobile ? 1.19 : width < 760 ? 1.08 : 1);
      camera.position.set(
        Math.sin(angle) * actualDistance,
        Math.sin(tilt) * actualDistance,
        Math.cos(angle) * Math.cos(tilt) * actualDistance,
      );
      look.set(lookX + (mobile ? 0 : -1.1), 0.3, lookZ);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      nodes.forEach((node) => {
        if (!reduced && !effectivePause()) {
          node.globe.rotation.y = node.w.model
            ? Math.sin(time * 0.25) * 0.18
            : node.globe.rotation.y + dt * 0.026;
          node.wire.rotation.y = node.globe.rotation.y;
        }
      });
      const placed = [...hudBounds];
      for (const i of [selected, ...worlds.map((_, id) => id).filter((id) => id !== selected)]) {
        const node = nodes[i],
          el = labelElements[i];
        labelPoint.copy(node.group.position);
        labelPoint.y -= node.w.radius + 0.5;
        labelPoint.project(camera);
        if (
          labelPoint.z < -1 ||
          labelPoint.z > 1 ||
          Math.abs(labelPoint.x) > 1 ||
          Math.abs(labelPoint.y) > 1
        ) {
          el.style.visibility = "hidden";
          continue;
        }
        const box = placeMapLabel(
          { x: (labelPoint.x * 0.5 + 0.5) * width, y: (-labelPoint.y * 0.5 + 0.5) * height },
          labelSizes[i],
          { width, height },
          placed,
        );
        el.style.visibility = box ? "visible" : "hidden";
        if (box) {
          el.style.left = `${box.x}px`;
          el.style.top = `${box.y}px`;
          placed.push(box);
        }
      }

      selection.position.copy(nodes[selected].group.position);
      selection.quaternion.copy(camera.quaternion);
      const scale = worlds[selected].radius * 1.42;
      selection.scale.setScalar(scale);
      selection.rotateZ(reduced ? 0 : time * 0.025);
      if (!reduced && !effectivePause()) {
        fragments.rotation.y = time * 0.025;
      }
      glyphField.update(dt, rain, !reduced && !effectivePause());
      const scanRemaining = scanFxUntil - time;
      if (scanRemaining > 0 && !reduced) {
        scanRing.visible = true;
        scanRing.scale.setScalar(1 + (1.2 - scanRemaining) * 17);
        scanRing.material.opacity = (scanRemaining / 1.2) * 0.65;
      } else scanRing.visible = false;
      renderer.render(scene, camera);
    },
    dispose() {
      glyphField.dispose();
      renderer.dispose();
    },
  };
}
