import * as THREE from "../../../../vendor/three/three.module.min.js";
import {
  createServiceSphereCover,
  retargetServiceSphereCover,
  updateServiceSphereCover
} from "./service-sphere-cover.js?v=wow60&rev=galaxy-light1";
import { updateModelSignalPackets } from "./system-models/signal-packets.js?v=wow60";

const SERVICE_VIEW_SWING = 0.32;
const FEEDTHROUGH_AXIS = new THREE.Vector3(1, 0, 0);

export function createSpherePresentation(options) {
  const {
    id,
    color,
    model,
    config,
    context = "rescue",
    radius: radiusOverride = null,
    compact = false,
    lightTheme = false
  } = options;

  if (!model || !config) throw new Error("Sphere presentation requires a model and config for " + id);

  const root = new THREE.Group();
  const posePivot = new THREE.Group();
  const spinPivot = new THREE.Group();
  const fitPivot = new THREE.Group();
  const radius = Number.isFinite(radiusOverride) ? radiusOverride : config.rescueRadius;
  const innerRadius = radius * config.fill;
  const { fit, feedthroughs, modelSignals } = fitSphereContents(model, innerRadius, context !== "choice");
  const cover = createServiceSphereCover({ color, radius, config, compact, lightTheme });
  root.add(cover.root);

  fitPivot.add(model);
  spinPivot.add(fitPivot);
  posePivot.add(spinPivot);
  if (context !== "choice") posePivot.rotation.x = config.tiltX ?? 0;
  root.add(posePivot);

  const spinAxis = new THREE.Vector3(
    config.spinAxis[0],
    config.spinAxis[1],
    config.spinAxis[2]
  ).normalize();

  const presentation = {
    id,
    context,
    root,
    posePivot,
    spinPivot,
    fitPivot,
    model,
    cover,
    shell: cover.shell,
    shellMaterial: cover.shellMaterial,
    shellArcPivot: cover.shellArcPivot,
    arcs: cover.arcs,
    arcMaterial: cover.arcMaterial,
    radius,
    innerRadius,
    spinAxis,
    spinAngle: config.spinPhase,
    spinTravel: 0,
    speedFactor: 1,
    revealProgress: 0,
    config,
    fit,
    feedthroughs,
    modelSignals
  };

  spinPivot.quaternion.setFromAxisAngle(spinAxis, config.spinPhase + 0.314);
  spinPivot.scale.setScalar(0.86);
  updateSphereFeedthroughs(presentation);
  root.userData.presentation = presentation;
  root.userData.presentationContext = context;
  root.userData.usesServiceSphereCover = true;
  root.userData.sphereRadius = radius;
  root.userData.model = model;
  return presentation;
}

export function retargetSpherePresentation(presentation, options) {
  const {
    id = presentation.id,
    color,
    config = presentation.config,
    radius: radiusOverride = presentation.radius
  } = options;
  const radius = Number(radiusOverride);

  if (!presentation.model || !config || !Number.isFinite(radius) || radius <= 0) {
    throw new Error("Cannot retarget an invalid sphere presentation for " + id);
  }

  const innerRadius = radius * config.fill;
  const modelParent = presentation.model.parent;
  let contents;
  if (modelParent) modelParent.remove(presentation.model);
  try {
    contents = fitSphereContents(presentation.model, innerRadius, presentation.context !== "choice");
  } finally {
    if (modelParent) modelParent.add(presentation.model);
  }

  presentation.id = id;
  presentation.config = config;
  presentation.radius = radius;
  presentation.innerRadius = innerRadius;
  presentation.fit = contents.fit;
  presentation.feedthroughs = contents.feedthroughs;
  presentation.modelSignals = contents.modelSignals;
  presentation.spinAxis.set(
    config.spinAxis[0],
    config.spinAxis[1],
    config.spinAxis[2]
  ).normalize();
  presentation.spinAngle = config.spinPhase;
  presentation.spinTravel = 0;
  presentation.speedFactor = 1;
  presentation.spinPivot.quaternion.setFromAxisAngle(
    presentation.spinAxis,
    presentation.spinAngle
  );

  retargetServiceSphereCover(presentation.cover, { color, radius, config });
  updateSphereFeedthroughs(presentation);

  presentation.root.userData.presentation = presentation;
  presentation.root.userData.presentationContext = presentation.context;
  presentation.root.userData.presentationId = id;
  presentation.root.userData.sphereRadius = radius;
  presentation.root.userData.model = presentation.model;
  return presentation;
}

export function updateSpherePresentation(presentation, options) {
  const {
    delta,
    elapsed,
    selected = false,
    hovered = false,
    reducedMotion = false,
    signalElapsed = elapsed,
    signalReducedMotion = reducedMotion,
    debugPhase = null,
    faceReadable = presentation.context !== "choice"
  } = options;
  const config = presentation.config;
  const targetSpeedFactor = selected ? 0.2 : hovered ? 0.45 : 1;
  const speedBlend = 1 - Math.exp(-Math.max(delta, 0) * 8);
  presentation.speedFactor += (targetSpeedFactor - presentation.speedFactor) * speedBlend;

  if (Number.isFinite(debugPhase)) {
    presentation.spinAngle = config.spinPhase + debugPhase * Math.PI * 2;
  } else if (reducedMotion) {
    presentation.spinAngle = config.staticAngle;
  } else if (selected || faceReadable) {
    let viewAngle = config.staticAngle;
    if (!selected) {
      presentation.spinTravel += delta * config.spinSpeed * presentation.speedFactor;
      viewAngle += Math.sin(presentation.spinTravel + config.spinPhase) * SERVICE_VIEW_SWING;
    }
    const angleDelta = Math.atan2(
      Math.sin(viewAngle - presentation.spinAngle),
      Math.cos(viewAngle - presentation.spinAngle)
    );
    presentation.spinAngle += angleDelta * (1 - Math.exp(-Math.max(delta, 0) * 7));
  } else {
    presentation.spinAngle += delta * config.spinSpeed * presentation.speedFactor;
  }

  if (reducedMotion || Number.isFinite(debugPhase)) {
    presentation.revealProgress = 1;
  } else {
    presentation.revealProgress = Math.min(1, presentation.revealProgress + delta / 0.72);
  }

  const reveal = smoothStep(presentation.revealProgress);
  const revealTwist = (1 - reveal) * 0.314;
  presentation.spinPivot.quaternion.setFromAxisAngle(
    presentation.spinAxis,
    presentation.spinAngle + revealTwist
  );
  presentation.spinPivot.scale.setScalar(0.86 + reveal * 0.14);
  updateSphereFeedthroughs(presentation);
  updateModelSignalPackets(presentation.modelSignals, signalElapsed, signalReducedMotion);
  updateServiceSphereCover(presentation.cover, {
    delta,
    elapsed,
    reveal,
    selected,
    hovered,
    reducedMotion,
    debugPhase
  });
}

function fitSphereContents(model, innerRadius, radialFit) {
  const feedthroughs = [];
  const modelSignals = [];
  model.traverse((owner) => {
    const attachment = owner.userData.sphereFeedthrough;
    if (attachment) feedthroughs.push({ owner, ...attachment });
    if (owner.userData.modelSignals) modelSignals.push(owner.userData.modelSignals);
  });

  // Fit the interior first so an external cable cannot shrink the assembly.
  for (const { mount } of feedthroughs) mount.removeFromParent();
  try {
    const fit = fitModelIntoSphere(model, innerRadius, radialFit);
    for (const port of feedthroughs) {
      port.center = port.owner.worldToLocal(new THREE.Vector3());
      port.direction = port.anchor.clone().sub(port.center).normalize();
      port.anchorRadius = port.anchor.distanceTo(port.center);
      port.modelScale = port.owner.getWorldScale(new THREE.Vector3()).x;
      port.mount.quaternion.setFromUnitVectors(FEEDTHROUGH_AXIS, port.direction);
    }
    return { fit, feedthroughs, modelSignals };
  } finally {
    for (const { owner, mount } of feedthroughs) owner.add(mount);
  }
}

function updateSphereFeedthroughs(presentation) {
  for (const port of presentation.feedthroughs) {
    // Cancel the interior reveal scale so the flange stays on the shell.
    const localRadius = presentation.radius / (port.modelScale * presentation.spinPivot.scale.x);
    port.mount.position.copy(port.center).addScaledVector(port.direction, localRadius);
    port.mount.scale.setScalar(localRadius);
    port.lead.scale.x = 1 - port.anchorRadius / localRadius;
  }
}

export function fitModelIntoSphere(model, innerRadius, radialFit = false) {
  const box = new THREE.Box3();
  const center = new THREE.Vector3();

  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  box.setFromObject(model, radialFit);
  if (box.isEmpty()) throw new Error("Cannot fit an empty semantic model into a sphere");

  box.getCenter(center);
  const sourceRadius = radialFit
    ? getModelRadialExtent(model, center)
    : box.getBoundingSphere(new THREE.Sphere()).radius;
  if (!Number.isFinite(sourceRadius) || sourceRadius <= 0) {
    throw new Error("Semantic model has invalid bounds");
  }

  const scale = innerRadius / sourceRadius;
  model.scale.setScalar(scale);
  model.position.copy(center).multiplyScalar(-scale);
  model.updateMatrixWorld(true);

  return Object.freeze({
    sourceRadius,
    fittedRadius: sourceRadius * scale,
    scale,
    centerOffset: Object.freeze(model.position.toArray())
  });
}

function getModelRadialExtent(model, center) {
  let extent = 0;
  const point = new THREE.Vector3();

  function visit(part, envelope) {
    const { spin, sweep, sweepRing, fault } = part.userData;
    if (spin || sweep || sweepRing || fault) {
      const pivot = new THREE.Vector3().setFromMatrixPosition(part.matrixWorld);
      // Budget the hardware diagnostic marker at its strongest pulse.
      const growth = fault ? 2.11 / part.scale.x : 1;
      const offset = envelope
        ? envelope.offset + envelope.pivot.distanceTo(pivot) * envelope.growth
        : center.distanceTo(pivot);
      envelope = { pivot, offset, growth: growth * (envelope?.growth ?? 1) };
    }

    const positions = part.geometry?.getAttribute("position");
    for (let index = 0; index < (positions?.count ?? 0); index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(part.matrixWorld);
      const radius = envelope
        ? envelope.offset + envelope.pivot.distanceTo(point) * envelope.growth
        : center.distanceTo(point);
      extent = Math.max(extent, radius);
    }
    part.children.forEach((child) => visit(child, envelope));
  }

  visit(model, null);
  return extent;
}

function smoothStep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}
