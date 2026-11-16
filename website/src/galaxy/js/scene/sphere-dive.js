import * as THREE from "../../../../vendor/three/three.module.min.js";

export const SPHERE_DIVE_DURATION = 620;

export function createSphereDive(camera, target, radius, accent) {
  const center = target.getWorldPosition(new THREE.Vector3());
  const startPosition = camera.position.clone();
  const approach = startPosition.clone().sub(center);
  const distance = approach.length();
  const overlay = document.createElement("div");
  overlay.className = "galaxy-dive";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--dive-accent", `#${accent.toString(16).padStart(6, "0")}`);
  document.body.append(overlay);
  return {
    target, radius, center, distance, overlay, startPosition,
    startRotation: camera.quaternion.clone(),
    startAim: camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(distance).add(startPosition),
    approach: approach.normalize(),
    aim: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    projected: new THREE.Vector3(),
    startedAt: performance.now(),
    progress: 0
  };
}

export function updateSphereDive(dive, camera, canvas) {
  const progress = Math.min(1, (performance.now() - dive.startedAt) / SPHERE_DIVE_DURATION);
  const travel = THREE.MathUtils.smoothstep(progress, 0, 1);
  dive.target.getWorldPosition(dive.center);
  const surface = dive.radius * dive.target.getWorldScale(dive.scale).x;
  // Close the distance exponentially so the rim expands into the viewport before the camera crosses it.
  const distance = dive.distance * Math.pow(surface * 0.45 / dive.distance, travel);
  camera.position.copy(dive.center).addScaledVector(dive.approach, distance);
  camera.lookAt(dive.aim.copy(dive.startAim).lerp(dive.center, THREE.MathUtils.smoothstep(progress, 0, 0.5)));
  camera.updateMatrixWorld();

  const point = dive.projected.copy(dive.center).project(camera);
  const bounds = canvas.getBoundingClientRect();
  dive.overlay.style.setProperty("--dive-x", `${bounds.left + (point.x + 1) * bounds.width / 2}px`);
  dive.overlay.style.setProperty("--dive-y", `${bounds.top + (1 - point.y) * bounds.height / 2}px`);
  dive.overlay.style.setProperty("--dive-progress", String(progress));
  dive.progress = progress;
}
