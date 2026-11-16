// Presentation-only settings for semantic scene objects. Scoring and orbit data
// stay in quiz-data.js so visual tuning cannot change application behavior.

function freezePresentation(config) {
  return Object.freeze({
    ...config,
    spinAxis: Object.freeze(config.spinAxis),
    shellTilt: Object.freeze(config.shellTilt)
  });
}

export const SYSTEM_PRESENTATIONS = Object.freeze({
  firmware: freezePresentation({
    semanticRole: "web",
    rescueRadius: 0.82,
    planetRadiusMultiplier: 2.05,
    choiceRadius: 0.72,
    fill: 0.92,
    glassStyle: "polished",
    spinAxis: [0, 1, 0],
    spinSpeed: 0.1,
    spinPhase: 0.34,
    staticAngle: 0.4,
    shellTilt: [0.18, 0.24, 0.08],
    shellSpeed: 0.12
  }),
  backend: freezePresentation({
    semanticRole: "api",
    rescueRadius: 0.82,
    planetRadiusMultiplier: 2.05,
    choiceRadius: 0.72,
    fill: 0.93,
    glassStyle: "polished",
    tiltX: 0.07,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.13,
    spinPhase: -0.19,
    staticAngle: -0.19,
    shellTilt: [-0.12, 0.3, -0.06],
    shellSpeed: -0.1
  }),
  automation: freezePresentation({
    semanticRole: "automation",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.96,
    glassStyle: "polished",
    spinAxis: [0, 1, 0],
    spinSpeed: 0.09,
    spinPhase: 0.22,
    staticAngle: 0.28,
    shellTilt: [0.28, -0.16, 0.12],
    shellSpeed: 0.11
  }),
  pqc: freezePresentation({
    semanticRole: "pqc",
    rescueRadius: 0.79,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.71,
    fill: 0.95,
    glassStyle: "polished",
    spinAxis: [1, 0, 0],
    spinSpeed: 0.12,
    spinPhase: 0.44,
    staticAngle: 0.4,
    shellTilt: [0.16, -0.22, 0.1],
    shellSpeed: -0.1
  }),
  data: freezePresentation({
    semanticRole: "data",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.93,
    glassStyle: "polished",
    tiltX: 0.28,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.16,
    spinPhase: 0.58,
    staticAngle: 0.73,
    shellTilt: [-0.2, -0.24, 0.08],
    shellSpeed: -0.13
  }),
  hardware: freezePresentation({
    semanticRole: "hardware",
    rescueRadius: 0.84,
    planetRadiusMultiplier: 2.08,
    choiceRadius: 0.74,
    fill: 0.94,
    glassStyle: "polished",
    glassReflections: "clear",
    tiltX: 0.38,
    spinAxis: [0, -1, 0],
    spinSpeed: 0.11,
    spinPhase: 0.48,
    staticAngle: 0.55,
    shellTilt: [0.24, 0.12, -0.16],
    shellSpeed: 0.09
  }),
  ops: freezePresentation({
    semanticRole: "monitoring",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.94,
    glassStyle: "polished",
    spinAxis: [0, 1, 0],
    spinSpeed: 0.08,
    spinPhase: 0.36,
    staticAngle: 0.37,
    shellTilt: [-0.16, 0.2, 0.18],
    shellSpeed: -0.08
  })
});
