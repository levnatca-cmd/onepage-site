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
    fill: 0.84,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.1,
    spinPhase: 0.15,
    staticAngle: 0.58,
    shellTilt: [0.18, 0.24, 0.08],
    shellSpeed: 0.12
  }),
  backend: freezePresentation({
    semanticRole: "api",
    rescueRadius: 0.82,
    planetRadiusMultiplier: 2.05,
    choiceRadius: 0.72,
    fill: 0.84,
    spinAxis: [0, -1, 0],
    spinSpeed: 0.13,
    spinPhase: 1.05,
    staticAngle: 0.74,
    shellTilt: [-0.12, 0.3, -0.06],
    shellSpeed: -0.1
  }),
  automation: freezePresentation({
    semanticRole: "automation",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.84,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.09,
    spinPhase: 1.95,
    staticAngle: 0.48,
    shellTilt: [0.28, -0.16, 0.12],
    shellSpeed: 0.11
  }),
  data: freezePresentation({
    semanticRole: "data",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.84,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.16,
    spinPhase: 2.85,
    staticAngle: 0.66,
    shellTilt: [-0.2, -0.24, 0.08],
    shellSpeed: -0.13
  }),
  hardware: freezePresentation({
    semanticRole: "hardware",
    rescueRadius: 0.84,
    planetRadiusMultiplier: 2.08,
    choiceRadius: 0.74,
    fill: 0.82,
    spinAxis: [0, -1, 0],
    spinSpeed: 0.11,
    spinPhase: 3.75,
    staticAngle: 0.62,
    shellTilt: [0.24, 0.12, -0.16],
    shellSpeed: 0.09
  }),
  ops: freezePresentation({
    semanticRole: "monitoring",
    rescueRadius: 0.78,
    planetRadiusMultiplier: 2.02,
    choiceRadius: 0.7,
    fill: 0.84,
    spinAxis: [0, 1, 0],
    spinSpeed: 0.08,
    spinPhase: 4.65,
    staticAngle: 0.54,
    shellTilt: [-0.16, 0.2, 0.18],
    shellSpeed: -0.08
  })
});
