import * as THREE from "../../../../vendor/three/three.module.min.js";
import { createEnergyCoreMaterial } from "./energy-core.js?v=wow60&rev=core-plasma6";

export function createCoreObject(radius = 0.43, onDetailReady) {
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 3),
    createEnergyCoreMaterial(radius, onDetailReady)
  );
  core.name = "plasma-core";
  return core;
}

export function updateCoreObject(core, elapsed, reducedMotion = false) {
  core.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
}
