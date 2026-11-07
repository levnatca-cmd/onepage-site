// All quiz/galaxy data: planets, scoring, questions, choice visuals, motion groups,
// scale stages, motion-preview scenarios, archetype outcomes.

import { VISUAL_COLORS } from "./config.js?v=wow50";

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
    color: VISUAL_COLORS.api,
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
    color: VISUAL_COLORS.automation,
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
    color: VISUAL_COLORS.data,
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
    color: VISUAL_COLORS.hardware,
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
    color: VISUAL_COLORS.ops,
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
    prompt: "What would you like to build or improve?",
    choices: [
      { value: "firmware", label: "Website or web app", tag: "webapp" },
      { value: "backend", label: "Backend, API or dashboard", tag: "engine" },
      { value: "automation", label: "Automation for repetitive work", tag: "workflow" },
      { value: "hardware", label: "Hardware/software debugging", tag: "device" },
      { value: "ops", label: "Monitoring and ongoing support", tag: "support" }
    ]
  },
  {
    id: "q2",
    prompt: "Which part needs planning or improvement?",
    choices: [
      { value: "hardwareFirmware", label: "Device signals and software", tag: "signal" },
      { value: "firmwareBackend", label: "Interface and backend/API", tag: "journey" },
      { value: "backendOps", label: "Backend and ongoing support", tag: "handoff" },
      { value: "businessAutomation", label: "Manual tasks and automation", tag: "workflow" },
      { value: "crossStack", label: "Project architecture or a new idea", tag: "plan" }
    ]
  },
  {
    id: "q3",
    prompt: "What is your main priority?",
    choices: [
      { value: "users", label: "Reaching or supporting more users", tag: "scale" },
      { value: "devices", label: "Connecting more devices or locations", tag: "field" },
      { value: "manual", label: "Reducing manual work", tag: "load" },
      { value: "integrations", label: "Connecting apps, APIs or devices", tag: "mesh" },
      { value: "incidents", label: "Investigating bugs or device faults", tag: "incident" }
    ]
  },
  {
    id: "q4",
    prompt: "What needs more clarity before work starts?",
    choices: [
      { value: "logs", label: "App/device activity and logs", tag: "observe" },
      { value: "person", label: "Requirements and team knowledge", tag: "memory" },
      { value: "retry", label: "Repeated failures or retries", tag: "manual" },
      { value: "patch", label: "Scope of a first version", tag: "version" },
      { value: "debate", label: "Responsibilities and support", tag: "owner" }
    ]
  },
  {
    id: "q5",
    prompt: "What would you like help with first?",
    choices: [
      { value: "map", label: "Scope and project priorities", tag: "map" },
      { value: "handoff", label: "Building an app or customer flow", tag: "journey" },
      { value: "manualOps", label: "Automation or a dashboard", tag: "automation" },
      { value: "hardwareCare", label: "Hardware/software debugging", tag: "device" },
      { value: "monitoring", label: "Monitoring and ongoing support", tag: "live" }
    ]
  }
];

export const CHOICE_VISUALS = {
  firmware: { kind: "webInterface", accent: VISUAL_COLORS.accent, labelY: 1.14 },
  backend: { kind: "apiStack", accent: VISUAL_COLORS.api, labelY: 1.1 },
  automation: { kind: "workflowGear", accent: VISUAL_COLORS.automation, labelY: 1.04 },
  data: { kind: "dataVault", accent: VISUAL_COLORS.data, labelY: 1.1 },
  hardware: { kind: "hardwarePort", accent: VISUAL_COLORS.hardware, labelY: 1.02 },
  ops: { kind: "opsRadar", accent: VISUAL_COLORS.ops, labelY: 1.1 },
  hardwareFirmware: { kind: "hardwarePort", accent: VISUAL_COLORS.hardware, labelY: 0.96 },
  firmwareBackend: { kind: "contractBridge", accent: VISUAL_COLORS.api, labelY: 0.98 },
  backendOps: { kind: "incidentBeacon", accent: VISUAL_COLORS.ops, labelY: 1.06 },
  businessAutomation: { kind: "processRail", accent: VISUAL_COLORS.automation, labelY: 0.96 },
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
  monitoring: { kind: "monitoringArray", accent: VISUAL_COLORS.ops, labelY: 1.04 },
  owner: { kind: "ownerCrown", accent: VISUAL_COLORS.text, labelY: 1.08 }
};

export const CHOICE_MOTION_GROUPS = {
  spin: new Set(["workflowGear", "retryLoop", "debateOrbit"]),
  sweep: new Set(["opsRadar", "monitoringArray"]),
  orbit: new Set(["dataVault", "integrationHub", "memoryNode"]),
  incident: new Set(["incidentBeacon", "incidentFlare"]),
  stack: new Set(["webInterface", "apiStack", "manualStack", "processRail", "opsQueue", "architectureMap"]),
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
    copy: "Before launch, review the main user flow, integrations, monitoring and handover needs."
  }
];

export const SCENARIOS = {
  firmwareFail: {
    label: "Build mode",
    simulation: "bench",
    archetype: "bench",
    planet: "firmware",
    copy: "Build preview: explore how the interface, backend and main user action connect."
  },
  apiLatency: {
    label: "API integration",
    simulation: "handoff",
    archetype: "handoff",
    planet: "backend",
    copy: "API integration preview: explore the services behind a form, booking, payment or app action."
  },
  noMonitoring: {
    label: "Ongoing support",
    simulation: "ops",
    archetype: "ops",
    planet: "ops",
    copy: "Maintenance: leads, app errors, device faults, requests, and important updates stay visible after launch."
  },
  manualWorkflow: {
    label: "Hardware/software debugging",
    simulation: "ops",
    archetype: "hardware",
    planet: "hardware",
    copy: "Hardware/software debugging: explore how device signals, logs and app behavior relate."
  }
};

export const ARCHETYPES = {
  handoff: {
    name: "Connected websites & apps",
    focus: "backend",
    summary:
      "Your answers suggest reviewing how the interface, APIs and data should work together in your new or existing product.",
    gaps: [
      "Define the actions customers or team members need to take.",
      "Identify the APIs, data and access rules behind those actions.",
      "Agree on the first feature and the support it will need."
    ],
    action:
      "Review the screens, user actions, APIs, data and support your project needs.",
    simulation: "handoff"
  },
  ghost: {
    name: "Project planning & architecture",
    focus: "data",
    summary:
      "Your answers suggest clarifying the scope, architecture and priorities of a new idea or an existing product.",
    gaps: [
      "Describe the users, goals and workflows.",
      "List what already exists and the decisions that still need to be made.",
      "Define a first version before estimating implementation."
    ],
    action:
      "Review your idea or existing product and agree on requirements, priorities and the next task.",
    simulation: "ghost"
  },
  spreadsheet: {
    name: "Workflow automation",
    focus: "automation",
    summary:
      "Your answers suggest looking at repetitive work that could be supported by integrations, forms or dashboards.",
    gaps: [
      "List the manual steps and the tools involved.",
      "Identify the data, approvals and error handling each step needs.",
      "Choose one useful workflow to automate first."
    ],
    action:
      "Review a repetitive workflow and scope a focused automation or integration.",
    simulation: "automation"
  },
  bench: {
    name: "Website & app launch",
    focus: "firmware",
    summary:
      "Your answers suggest defining a website or app interface around a clear audience and primary action.",
    gaps: [
      "Clarify the offer and the audience.",
      "Choose the main action: contact, book, buy, apply or use the product.",
      "Define the content, integrations and handover needed for launch."
    ],
    action:
      "Review the audience, content and first customer flow before scoping design and development.",
    simulation: "bench"
  },
  ops: {
    name: "Monitoring & ongoing support",
    focus: "ops",
    summary:
      "Your answers suggest planning how an existing or upcoming product will be monitored and maintained.",
    gaps: [
      "Choose the errors, requests and device events that need attention.",
      "Identify who responds and what information they need.",
      "Agree on maintenance tasks and response expectations."
    ],
    action:
      "Review monitoring and maintenance needs, then agree on a support scope.",
    simulation: "ops"
  },
  hardware: {
    name: "Hardware & software debugging",
    focus: "hardware",
    summary:
      "Your answers suggest reviewing the connection between device behavior, software and logs. The cause of a fault needs investigation.",
    gaps: [
      "Gather device details, signals and relevant logs.",
      "Describe the expected behavior and how to reproduce the issue.",
      "Agree on device access, investigation scope and follow-up support."
    ],
    action:
      "Review the device, software and available evidence to scope a debugging task.",
    simulation: "ops"
  }
};
