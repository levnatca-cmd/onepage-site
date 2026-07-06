// All quiz/galaxy data: planets, scoring, questions, choice visuals, motion groups,
// scale stages, motion-preview scenarios, archetype outcomes.

import { VISUAL_COLORS } from "./config.js";

export const PLANETS = {
  firmware: {
    label: "Website / app",
    short: "WEBAPP",
    role: "interface people use",
    links: "Backend/API, Monitoring",
    risk: "first touch",
    copy: "This is the website, app, portal, landing page, or dashboard surface people see and use first.",
    color: VISUAL_COLORS.accent,
    radius: 4.1,
    size: 0.3,
    speed: 0.42,
    angle: 0.2,
    inclination: 0.22
  },
  backend: {
    label: "Backend / API",
    short: "ENGINE",
    role: "logic behind actions",
    links: "Website/app, Data/logs, Hardware",
    risk: "handoff",
    copy: "This is the engine behind the interface: APIs, forms, auth, business rules, payments, webhooks, and integrations.",
    color: VISUAL_COLORS.soft,
    radius: 5.4,
    size: 0.36,
    speed: 0.31,
    angle: 1.65,
    inclination: -0.16
  },
  automation: {
    label: "Automation",
    short: "WORK",
    role: "repeated tasks",
    links: "Backend/API, Data/logs",
    risk: "repeated work",
    copy: "This is repeated admin work that can become forms, notifications, scheduled jobs, queues, and dashboards.",
    color: VISUAL_COLORS.muted,
    radius: 6.65,
    size: 0.34,
    speed: 0.24,
    angle: 2.8,
    inclination: 0.32
  },
  data: {
    label: "Data / logs",
    short: "SIGNAL",
    role: "visibility layer",
    links: "Backend/API, Automation, Hardware",
    risk: "unknowns",
    copy: "This is the information you need from users, app flows, integrations, devices, logs, and business events.",
    color: 0xc9d4dc,
    radius: 7.75,
    size: 0.32,
    speed: 0.2,
    angle: 4.2,
    inclination: -0.28
  },
  hardware: {
    label: "Hardware",
    short: "HW",
    role: "real-world device layer",
    links: "Backend/API, Data/logs, Monitoring",
    risk: "field faults",
    copy: "This is where real devices, signals, boards, cables, sensors, firmware behavior, and physical debugging enter the system.",
    color: VISUAL_COLORS.warning,
    radius: 8.45,
    size: 0.34,
    speed: 0.18,
    angle: 5.05,
    inclination: 0.38
  },
  ops: {
    label: "Monitoring",
    short: "LIVE",
    role: "support after launch",
    links: "Website/app, Backend/API, Hardware",
    risk: "maintenance",
    copy: "This is what keeps the site, app, integration, or hardware-backed product understandable, maintainable, and reliable after launch.",
    color: VISUAL_COLORS.dim,
    radius: 9.35,
    size: 0.34,
    speed: 0.145,
    angle: 5.85,
    inclination: -0.14
  }
};

export const PLANET_IDS = Object.keys(PLANETS);

export const SCORE_MAP = {
  firmware: { bench: 2, handoff: 1 },
  backend: { ghost: 1, handoff: 1 },
  automation: { spreadsheet: 2 },
  data: { ops: 1, ghost: 1 },
  hardware: { hardware: 3 },
  ops: { ops: 2 },
  hardwareFirmware: { hardware: 3 },
  firmwareBackend: { handoff: 3 },
  backendOps: { ops: 2, handoff: 1 },
  businessAutomation: { spreadsheet: 3 },
  crossStack: { ghost: 2, handoff: 1, hardware: 1 },
  users: { ghost: 1, handoff: 1 },
  devices: { hardware: 2 },
  manual: { spreadsheet: 2 },
  integrations: { handoff: 1, hardware: 1 },
  incidents: { ops: 2 },
  logs: { ops: 2, hardware: 1 },
  person: { ghost: 2 },
  retry: { spreadsheet: 2 },
  patch: { ghost: 1, handoff: 1 },
  debate: { handoff: 2 },
  map: { ghost: 2 },
  handoff: { handoff: 3 },
  manualOps: { spreadsheet: 2 },
  hardwareCare: { hardware: 2, ops: 1 },
  monitoring: { ops: 3 },
  owner: { handoff: 1, ghost: 1 }
};

export const QUESTION_FLOW = [
  {
    id: "q1",
    prompt: "Which system needs work first?",
    choices: [
      { value: "firmware", label: "Website, app, or product page", tag: "webapp" },
      { value: "backend", label: "Portal, backend, API, or dashboard", tag: "engine" },
      { value: "automation", label: "Automation for manual work", tag: "workflow" },
      { value: "hardware", label: "Hardware or device debug", tag: "device" },
      { value: "ops", label: "Monitoring and maintenance", tag: "support" }
    ]
  },
  {
    id: "q2",
    prompt: "Where does the chain usually break?",
    choices: [
      { value: "hardwareFirmware", label: "Device signal to software", tag: "signal" },
      { value: "firmwareBackend", label: "Interface to backend/API", tag: "journey" },
      { value: "backendOps", label: "Backend to follow-up/support", tag: "handoff" },
      { value: "businessAutomation", label: "Manual process to automation", tag: "workflow" },
      { value: "crossStack", label: "Nobody sees the whole system", tag: "plan" }
    ]
  },
  {
    id: "q3",
    prompt: "What is adding pressure?",
    choices: [
      { value: "users", label: "More users, leads, or requests", tag: "scale" },
      { value: "devices", label: "More devices, locations, or products", tag: "field" },
      { value: "manual", label: "More manual work", tag: "load" },
      { value: "integrations", label: "More tools, APIs, or hardware links", tag: "mesh" },
      { value: "incidents", label: "More bugs or field incidents", tag: "incident" }
    ]
  },
  {
    id: "q4",
    prompt: "What should become visible?",
    choices: [
      { value: "logs", label: "App, device, or customer logs", tag: "observe" },
      { value: "person", label: "What the team knows", tag: "memory" },
      { value: "retry", label: "Repeated failure or retry loops", tag: "manual" },
      { value: "patch", label: "Fragile first version", tag: "version" },
      { value: "debate", label: "Who owns each layer", tag: "owner" }
    ]
  },
  {
    id: "q5",
    prompt: "What should the real engagement turn into?",
    choices: [
      { value: "map", label: "Clear build/debug plan", tag: "map" },
      { value: "handoff", label: "Working app or customer flow", tag: "journey" },
      { value: "manualOps", label: "Automation or dashboard", tag: "automation" },
      { value: "hardwareCare", label: "Hardware debug and maintenance", tag: "device" },
      { value: "monitoring", label: "Monitoring after launch", tag: "live" }
    ]
  }
];

export const CHOICE_VISUALS = {
  firmware: { kind: "firmwareChip", accent: VISUAL_COLORS.accent, labelY: 0.95 },
  backend: { kind: "apiStack", accent: VISUAL_COLORS.soft, labelY: 0.98 },
  automation: { kind: "workflowGear", accent: VISUAL_COLORS.muted, labelY: 1.02 },
  data: { kind: "dataVault", accent: 0xc9d4dc, labelY: 1.02 },
  hardware: { kind: "hardwarePort", accent: VISUAL_COLORS.warning, labelY: 1.02 },
  ops: { kind: "opsRadar", accent: VISUAL_COLORS.dim, labelY: 1.0 },
  hardwareFirmware: { kind: "hardwarePort", accent: VISUAL_COLORS.accent, labelY: 0.96 },
  firmwareBackend: { kind: "contractBridge", accent: VISUAL_COLORS.soft, labelY: 0.98 },
  backendOps: { kind: "incidentBeacon", accent: VISUAL_COLORS.dim, labelY: 1.06 },
  businessAutomation: { kind: "processRail", accent: VISUAL_COLORS.muted, labelY: 0.96 },
  crossStack: { kind: "ownershipCompass", accent: VISUAL_COLORS.text, labelY: 1.02 },
  users: { kind: "userCluster", accent: 0xc9d4dc, labelY: 0.98 },
  devices: { kind: "deviceFleet", accent: VISUAL_COLORS.accent, labelY: 0.98 },
  manual: { kind: "manualStack", accent: VISUAL_COLORS.muted, labelY: 0.96 },
  integrations: { kind: "integrationHub", accent: VISUAL_COLORS.soft, labelY: 1.0 },
  incidents: { kind: "incidentFlare", accent: VISUAL_COLORS.warning, labelY: 1.08 },
  logs: { kind: "logConsole", accent: 0xc9d4dc, labelY: 0.96 },
  person: { kind: "memoryNode", accent: 0xc9d4dc, labelY: 1.02 },
  retry: { kind: "retryLoop", accent: VISUAL_COLORS.muted, labelY: 1.02 },
  patch: { kind: "layerPatch", accent: VISUAL_COLORS.soft, labelY: 0.96 },
  debate: { kind: "debateOrbit", accent: VISUAL_COLORS.warning, labelY: 1.04 },
  map: { kind: "architectureMap", accent: 0xc9d4dc, labelY: 0.98 },
  handoff: { kind: "stableHandoff", accent: VISUAL_COLORS.accent, labelY: 0.98 },
  manualOps: { kind: "opsQueue", accent: VISUAL_COLORS.muted, labelY: 0.96 },
  hardwareCare: { kind: "hardwarePort", accent: VISUAL_COLORS.warning, labelY: 1.02 },
  monitoring: { kind: "monitoringArray", accent: VISUAL_COLORS.dim, labelY: 1.04 },
  owner: { kind: "ownerCrown", accent: VISUAL_COLORS.text, labelY: 1.08 }
};

export const CHOICE_MOTION_GROUPS = {
  spin: new Set(["workflowGear", "retryLoop", "debateOrbit"]),
  sweep: new Set(["opsRadar", "monitoringArray"]),
  orbit: new Set(["dataVault", "integrationHub", "memoryNode"]),
  incident: new Set(["incidentBeacon", "incidentFlare"]),
  stack: new Set(["apiStack", "manualStack", "processRail", "opsQueue", "architectureMap"]),
  bridge: new Set(["contractBridge", "stableHandoff", "hardwarePort", "layerPatch"]),
  cluster: new Set(["userCluster", "deviceFleet"])
};

export const SCALE_STAGES = [
  {
    label: "Prototype",
    pressure: 0,
    copy: "The galaxy is open. This is the moment when a clean system picture can shape the build."
  },
  {
    label: "First users",
    pressure: 0.35,
    copy: "First real users add motion. The system starts showing which paths deserve more structure."
  },
  {
    label: "Field use",
    pressure: 0.68,
    copy: "Field use stretches the orbits. Repeated work, product signals, and device behavior become easier to see as one system."
  },
  {
    label: "Launch",
    pressure: 1,
    copy: "Launch motion compresses the system. This is where a precise rescue map can turn movement into leverage."
  }
];

export const SCENARIOS = {
  firmwareFail: {
    label: "Build mode",
    simulation: "bench",
    archetype: "bench",
    planet: "firmware",
    copy: "Build mode: the website/app surface, backend, and main customer action start moving as one path."
  },
  apiLatency: {
    label: "API handoff",
    simulation: "handoff",
    archetype: "handoff",
    planet: "backend",
    copy: "API handoff: the map shows what should happen after someone clicks, submits, books, pays, or uses the app."
  },
  noMonitoring: {
    label: "Maintenance",
    simulation: "ops",
    archetype: "ops",
    planet: "ops",
    copy: "Maintenance: leads, app errors, device faults, requests, and important updates stay visible after launch."
  },
  manualWorkflow: {
    label: "Hardware debug",
    simulation: "ops",
    archetype: "hardware",
    planet: "hardware",
    copy: "Hardware debug: device signals, logs, cables, boards, and app behavior become one inspectable chain."
  }
};

export const ARCHETYPES = {
  handoff: {
    name: "The Full-Stack Product Flow",
    focus: "backend",
    summary:
      "Your project needs the interface, backend, data, and follow-up to work as one connected product path.",
    gaps: [
      "Users should understand what to do next in the website or app.",
      "The backend should know what happens after a click, form, payment, booking, or device event.",
      "The build plan should show UI, API, data, automation, and support together."
    ],
    action:
      "Turn the product flow into one build plan: screens, API actions, data, follow-up, and support.",
    simulation: "handoff"
  },
  ghost: {
    name: "The System Architecture Map",
    focus: "data",
    summary:
      "Your idea or existing product has web, app, data, and operational parts that need one understandable map.",
    gaps: [
      "The interface, workflow, data, and support needs can become one picture.",
      "What is currently in your head or team knowledge can become a buildable plan.",
      "The first version can be scoped without guessing every detail upfront."
    ],
    action:
      "Turn the idea into a practical rescue map with screens, flows, data, debug points, and next build steps.",
    simulation: "ghost"
  },
  spreadsheet: {
    name: "The Automation Engine",
    focus: "automation",
    summary:
      "Your website, app, or dashboard can remove repeated admin work instead of only displaying information.",
    gaps: [
      "Repeated messages, forms, updates, or spreadsheets can become part of the system.",
      "The product can do more than display information.",
      "Manual follow-up can be designed into the build from the start."
    ],
    action:
      "Map the manual steps that should become forms, notifications, dashboards, or automations.",
    simulation: "automation"
  },
  bench: {
    name: "The Web/App Launch Layer",
    focus: "firmware",
    summary:
      "Your product or offer is ready to become a clear website, app, portal, or dashboard people can understand and use.",
    gaps: [
      "The first screen should make the offer obvious.",
      "The customer action should be clear: contact, book, buy, apply, or use.",
      "The launch plan should include what happens after the visitor takes action."
    ],
    action:
      "Map the offer, first page, main customer action, and follow-up flow together.",
    simulation: "bench"
  },
  ops: {
    name: "The Monitoring & Maintenance Loop",
    focus: "ops",
    summary:
      "You want the site, app, integration, or device-backed product to keep giving useful signals after it goes live.",
    gaps: [
      "You should know what people do after they arrive.",
      "Important requests, bookings, orders, app errors, and device faults should not disappear.",
      "The launch should include visibility and maintenance, not just finished pages."
    ],
    action:
      "Define what you need to see after launch: leads, requests, usage, logs, failures, and maintenance actions.",
    simulation: "ops"
  },
  hardware: {
    name: "The Hardware Debug Bridge",
    focus: "hardware",
    summary:
      "Your system has real-world device behavior that needs to connect with software, logs, and maintenance.",
    gaps: [
      "Hardware faults should be tied to observable signals, not guesses.",
      "Device behavior, app behavior, and logs should be reviewed as one chain.",
      "The support plan should include debug notes, monitoring, and clear ownership after the fix."
    ],
    action:
      "Inspect the hardware/software chain: device signals, logs, app flow, failure points, and maintenance path.",
    simulation: "ops"
  }
};
