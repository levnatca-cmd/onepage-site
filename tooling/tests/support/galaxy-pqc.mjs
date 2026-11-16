import assert from "node:assert/strict";

export async function checkProtectedPacket(page) {
  const width = 256;
  const measurements = await page.evaluate((width) => {
    const { galaxy, THREE } = window.galaxyTest;
    const { renderer } = galaxy;
    const cable = galaxy.rescueRigCables.find((item) => item.userData.serviceId === "pqc");
    const material = cable.material.clone();
    const tube = new THREE.Mesh(cable.geometry, material);
    tube.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(tube);
    const camera = new THREE.OrthographicCamera(-1.2, 1.2, 0.3, -0.3, 0.1, 10);
    camera.position.z = 3;
    const height = width / 4;
    const target = new THREE.WebGLRenderTarget(width, height);
    const savedTarget = renderer.getRenderTarget();
    const savedFace = renderer.getActiveCubeFace();
    const savedLevel = renderer.getActiveMipmapLevel();
    const savedColor = renderer.getClearColor(new THREE.Color());
    const savedAlpha = renderer.getClearAlpha();
    const { uniforms } = material;

    function render(energyHead, packetHead = -1) {
      uniforms.uEnergyHead.value = energyHead;
      uniforms.uPacketHead.value = packetHead;
      renderer.clear();
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      return pixels;
    }

    function measure(pixels, baseline) {
      let signal = 0;
      let weightedX = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const intensity = pixels[i] + pixels[i + 1] + pixels[i + 2];
        // Ignore the faint static conduit, or subtract the matching outbound frame.
        const floor = baseline ? baseline[i] + baseline[i + 1] + baseline[i + 2] + 8 : 80;
        const difference = Math.max(0, intensity - floor);
        signal += difference;
        weightedX += difference * ((i / 4) % width);
      }
      return { signal, x: signal ? weightedX / signal : 0 };
    }

    try {
      // Straight outlet-to-Core path, with one ambient photon period in view.
      uniforms.uStart.value.set(-1, 0, 0);
      uniforms.uEnd.value.set(1, 0, 0);
      uniforms.uControl.value.set(0, 0, 0);
      uniforms.uRadius.value = 0.08;
      uniforms.uOpacity.value = 1;
      uniforms.uPathLength.value = 2;
      uniforms.uPhotonSpacing.value = 2;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      const baseline = render(0.2);
      return {
        outgoing: [measure(baseline), measure(render(0.35))],
        incoming: [measure(render(0.2, 0.32), baseline), measure(render(0.2, 0.68), baseline)],
      };
    } finally {
      renderer.setRenderTarget(savedTarget, savedFace, savedLevel);
      renderer.setClearColor(savedColor, savedAlpha);
      target.dispose();
      material.dispose();
    }
  }, width);

  const { outgoing, incoming } = measurements;
  assert.ok(
    outgoing.every(({ signal }) => signal > 1000),
    "Ambient Core photons must stay visible",
  );
  assert.ok(outgoing[0].x - outgoing[1].x > width * 0.07, "Ambient photons must move toward PQC");
  assert.ok(
    incoming.every(({ signal }) => signal > 1000),
    "The protected packet must add visible light",
  );
  assert.ok(
    incoming[1].x - incoming[0].x > width * 0.2,
    "The protected packet must move toward Core",
  );
}
