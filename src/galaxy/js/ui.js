// DOM-side handlers: form binding, HUD readouts, 3D-mode lifecycle, result rendering,
// scenarios, scale slider, share/copy/toast. No Three.js code here.

import { CONTACT_CONFIG } from "./data/config.js?v=wow50";
import {
  PLANETS,
  QUESTION_FLOW,
  SCORE_MAP,
  SCALE_STAGES,
  SCENARIOS,
  ARCHETYPES
} from "./data/quiz-data.js?v=wow50";
import { appState, galaxy } from "./state.js?v=wow50";
import { buildProjectSummary, buildProjectShare, getProjectAnswers } from "./project-summary.js?v=wow50";
import {
  resizeGalaxy,
  syncAnswerDeck,
  refreshGalaxyState,
  runWhatIfSimulation,
  runMicroPulse,
  getChoiceVisual
} from "./galaxy.js?v=wow50";

let threeDInvoker = null;

// ---------- Contact links + copyright ----------

export function hydrateContactLinks() {
  setLink("[data-contact='email']", CONTACT_CONFIG.email, "mailto:" + CONTACT_CONFIG.email);
}

function setLink(selector, text, href) {
  document.querySelectorAll(selector).forEach(function (el) {
    el.textContent = text;
    el.setAttribute("href", href);
  });
}

export function updateCopyrightYear() {
  const yearEl = document.getElementById("copyright-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

// ---------- Control wiring ----------

export function bindControls() {
  document.querySelectorAll("[data-start-3d]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      start3DFingerprintMode(button);
    });
  });

  const choiceOptions = document.getElementById("choice-options");
  if (choiceOptions) {
    choiceOptions.addEventListener("click", function (event) {
      const button = event.target.closest("[data-choice-index]");
      if (!button || !choiceOptions.contains(button)) return;
      select3DChoice(Number(button.dataset.choiceIndex));
    });
    choiceOptions.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const button = event.target.closest("[data-choice-index]");
      if (!button || !choiceOptions.contains(button)) return;
      event.preventDefault();
      select3DChoice(Number(button.dataset.choiceIndex));
    });
  }

  const exit3DButton = document.querySelector("[data-exit-3d]");
  if (exit3DButton) {
    exit3DButton.addEventListener("click", function () {
      exit3DFingerprintMode();
    });
  }

  const prev3DButton = document.querySelector("[data-prev-3d]");
  if (prev3DButton) {
    prev3DButton.addEventListener("click", function () {
      goToPrevious3DQuestion();
    });
  }

  document.querySelectorAll("[data-planet]").forEach(function (button) {
    button.addEventListener("mouseenter", function () {
      focusPlanet(button.dataset.planet);
    });
    button.addEventListener("click", function () {
      focusPlanet(button.dataset.planet);
    });
  });

  document.querySelectorAll("input[type='radio']").forEach(function (input) {
    input.addEventListener("change", function () {
      setFingerprintAnswer(input.name, input.value);
    });
  });

  const fingerprintForm = document.getElementById("fingerprint-form");
  if (fingerprintForm) {
    fingerprintForm.addEventListener("click", function (event) {
      const option = event.target.closest(".answer-option");
      const input = option ? option.querySelector("input[type='radio']") : null;
      if (!input) return;
      setFingerprintAnswer(input.name, input.value);
    });
  }

  document.querySelectorAll("[data-simulate]").forEach(function (button) {
    button.addEventListener("click", function () {
      const type = button.dataset.simulate === "preview"
        ? "handoff"
        : ARCHETYPES[appState.archetype].simulation;
      runWhatIfSimulation(type);
    });
  });

  document.querySelectorAll("[data-scenario]").forEach(function (button) {
    button.addEventListener("click", function () {
      runScenario(button.dataset.scenario);
    });
  });

  const stressButton = document.querySelector("[data-stress-selected]");
  if (stressButton) {
    stressButton.addEventListener("click", function () {
      stressSelectedLayer();
    });
  }

  const scaleSlider = document.getElementById("scale-slider");
  if (scaleSlider) {
    scaleSlider.addEventListener("input", function () {
      appState.scaleStage = Number(scaleSlider.value);
      refreshGalaxyState();
      updateScaleReadout();
    });
  }

  const scrollButton = document.querySelector("[data-scroll-result]");
  if (scrollButton) {
    scrollButton.addEventListener("click", function () {
      startCinematicReveal();
    });
  }

  const resetButton = document.querySelector("[data-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", resetGalaxy);
  }

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      const text = button.dataset.copy === "badge"
        ? buildBadgeText()
        : button.dataset.copy === "slack"
          ? buildSlackMessage()
          : buildSummaryText();
      copyText(text);
    });
  });

  const downloadButton = document.querySelector("[data-download='md']");
  if (downloadButton) {
    downloadButton.addEventListener("click", function () {
      downloadMarkdown();
    });
  }

  syncRescueRigFocus(appState.selectedPlanet);
  bindContactForm();
}

function bindContactForm() {
  const form = document.getElementById("contact-form");
  const textarea = document.getElementById("contact-message");
  const copyBtn = document.getElementById("contact-copy");
  if (!form || !textarea) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const body = textarea.value.trim();
    if (!body) {
      textarea.focus();
      showToast("Describe your project before opening the email draft.");
      return;
    }
    const subject = encodeURIComponent("Project inquiry");
    const inquiry = buildSummaryText() + "\n\nPlease help me clarify the scope and next steps.";
    const mailto = "mailto:" + CONTACT_CONFIG.email + "?subject=" + subject + "&body=" + encodeURIComponent(inquiry);
    window.location.href = mailto;
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      const body = textarea.value.trim();
      if (!body) {
        textarea.focus();
        showToast("Nothing to copy yet");
        return;
      }
      copyText(buildSummaryText() + "\n\nPlease help me clarify the scope and next steps.");
    });
  }

  textarea.addEventListener("input", function () {
    updateMailto();
    document.getElementById("slack-message").textContent = buildSummaryText();
  });
}

// ---------- 3D mode lifecycle + per-question advancement ----------

function start3DFingerprintMode(invoker) {
  const hero = document.querySelector(".galaxy-hero");
  if (invoker instanceof HTMLElement) threeDInvoker = invoker;
  if (!appState.webglReady) {
    if (hero && hero.classList.contains("webgl-failed")) {
      if (appState.launchTimer) return;
      hero.classList.add("is-launching", "css-3d-mode");
      hero.scrollIntoView({ behavior: appState.reducedMotion ? "auto" : "smooth", block: "start" });
      appState.launchTimer = window.setTimeout(function () {
        hero.classList.remove("is-launching");
        appState.launchTimer = null;
        openFingerprintFallback();
      }, appState.reducedMotion ? 80 : 620);
      return;
    }
    openFingerprintFallback();
    return;
  }

  if (appState.launchTimer) return;

  if (hero && !appState.threeDMode && !appState.reducedMotion) {
    hero.classList.add("is-launching");
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
    appState.launchTimer = window.setTimeout(function () {
      hero.classList.remove("is-launching");
      appState.launchTimer = null;
      enter3DFingerprintMode(hero);
    }, 820);
    return;
  }

  enter3DFingerprintMode(hero);
}

function enter3DFingerprintMode(hero) {
  if (appState.choiceAdvanceTimer) {
    window.clearTimeout(appState.choiceAdvanceTimer);
    appState.choiceAdvanceTimer = null;
  }

  appState.threeDMode = true;
  appState.hoveredBack = false;
  appState.hoveredChoice = null;
  appState.activeQuestionIndex = getNextQuestionIndex();
  syncAnswerDeck(true);
  updateChoiceHud();
  if (hero) {
    hero.classList.remove("is-launching");
    hero.classList.add("is-3d-mode");
    requestAnimationFrame(resizeGalaxy);
    hero.scrollIntoView({ behavior: appState.reducedMotion ? "auto" : "smooth", block: "start" });
  }
  focusChoiceOption();
}

function exit3DFingerprintMode() {
  const hero = document.querySelector(".galaxy-hero");
  if (appState.launchTimer) {
    window.clearTimeout(appState.launchTimer);
    appState.launchTimer = null;
  }
  appState.threeDMode = false;
  appState.hoveredBack = false;
  appState.hoveredChoice = null;
  if (hero) hero.classList.remove("is-3d-mode", "is-launching");
  requestAnimationFrame(resizeGalaxy);
  const canvas = document.getElementById("galaxy-canvas");
  if (canvas) canvas.classList.remove("is-targeting");
  window.setTimeout(function () {
    const fallbackTarget = document.querySelector(".hero-actions [data-start-3d]");
    const target = isFocusableOnScreen(threeDInvoker) ? threeDInvoker : fallbackTarget;
    if (target) target.focus({ preventScroll: true });
  }, 60);
}

function openFingerprintFallback() {
  const fingerprint = document.getElementById("fingerprint");
  if (!fingerprint) return;
  fingerprint.scrollIntoView({ behavior: appState.reducedMotion ? "auto" : "smooth", block: "start" });
  showToast("3D is unavailable. Opening the project questions.");
  window.setTimeout(function () {
    const firstInput = fingerprint.querySelector("input, button, select, textarea, a[href]");
    if (firstInput) firstInput.focus({ preventScroll: true });
  }, appState.reducedMotion ? 0 : 420);
}

function isFocusableOnScreen(element) {
  return Boolean(element && element.isConnected && element.getClientRects().length);
}

function focusChoiceOption(preferredIndex = 0) {
  requestAnimationFrame(function () {
    const options = document.querySelectorAll("#choice-options [data-choice-index]");
    const target = options[preferredIndex] || options[0];
    if (target) target.focus({ preventScroll: true });
  });
}

export function goToPrevious3DQuestion() {
  if (!appState.threeDMode || appState.activeQuestionIndex <= 0) return;

  if (appState.choiceAdvanceTimer) {
    window.clearTimeout(appState.choiceAdvanceTimer);
    appState.choiceAdvanceTimer = null;
  }

  appState.activeQuestionIndex -= 1;
  appState.hoveredBack = false;
  appState.hoveredChoice = null;
  appState.backPortalPulseUntil = galaxy.clock.elapsedTime + 0.9;
  syncAnswerDeck(true);
  updateChoiceHud();

  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  const selectedValue = appState.answers[question.id];
  if (selectedValue) {
    focusPlanet(inferPlanet(selectedValue), { fromCanvas: true });
  }

  const insight = document.getElementById("live-insight");
  if (insight) {
    insight.textContent = "Reviewing: " + question.prompt + " Your choices stay saved while you adjust the system.";
  }
}

export function select3DChoice(choiceIndex) {
  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  const choice = question.choices[choiceIndex];
  if (!choice) return;

  if (appState.choiceAdvanceTimer) {
    window.clearTimeout(appState.choiceAdvanceTimer);
  }

  appState.selectedChoice = choiceIndex;
  appState.choicePulseUntil = galaxy.clock.elapsedTime + 0.9;
  setFingerprintAnswer(question.id, choice.value, { from3D: true, deferSimulation: true });
  runMicroPulse(inferPlanet(choice.value), { preserveInsight: true });

  const complete = Object.keys(appState.answers).length === QUESTION_FLOW.length;
  appState.choiceAdvanceTimer = window.setTimeout(function () {
    appState.choiceAdvanceTimer = null;
    if (complete) {
      updateChoiceHud();
      runWhatIfSimulation(ARCHETYPES[appState.archetype].simulation);
      startCinematicReveal();
      return;
    }

    appState.activeQuestionIndex = getNextQuestionIndex(appState.activeQuestionIndex + 1);
    appState.hoveredBack = false;
    appState.hoveredChoice = null;
    appState.selectedChoice = null;
    syncAnswerDeck(true);
    updateChoiceHud();
    focusChoiceOption();
  }, appState.reducedMotion ? 420 : 1150);
}

// ---------- Form + scoring + result rendering ----------

function setFingerprintAnswer(questionId, value, options = {}) {
  appState.answers[questionId] = value;
  const input = document.querySelector("input[name='" + questionId + "'][value='" + value + "']");
  if (input) input.checked = true;

  const firstScore = SCORE_MAP[value] || {};
  const firstPlanet = inferPlanet(value);
  focusPlanet(firstPlanet, { fromCanvas: Boolean(options.from3D) });
  appState.archetype = classifyArchetype();
  refreshGalaxyState();

  const activeIndex = getQuestionIndex(questionId);
  if (activeIndex === appState.activeQuestionIndex) {
    const index = findChoiceIndex(questionId, value);
    appState.selectedChoice = index > -1 ? index : null;
  }

  updateCompletion();
  renderResult();
  updateMailto();
  updateLiveInsight(firstScore, value);
  updateChoiceHud();

  if (Object.keys(appState.answers).length === QUESTION_FLOW.length && !options.deferSimulation) {
    runWhatIfSimulation(ARCHETYPES[appState.archetype].simulation);
  }
}

function getQuestionIndex(questionId) {
  return QUESTION_FLOW.findIndex(function (question) {
    return question.id === questionId;
  });
}

export function findChoiceIndex(questionId, value) {
  const question = QUESTION_FLOW[getQuestionIndex(questionId)];
  if (!question) return -1;
  return question.choices.findIndex(function (choice) {
    return choice.value === value;
  });
}

function getNextQuestionIndex(startIndex = 0) {
  for (let i = startIndex; i < QUESTION_FLOW.length; i += 1) {
    if (!appState.answers[QUESTION_FLOW[i].id]) return i;
  }
  for (let i = 0; i < QUESTION_FLOW.length; i += 1) {
    if (!appState.answers[QUESTION_FLOW[i].id]) return i;
  }
  return QUESTION_FLOW.length - 1;
}

export function canGoBackIn3D() {
  return appState.threeDMode && appState.activeQuestionIndex > 0;
}

export function updateChoiceHud() {
  const progress = document.getElementById("choice-progress");
  const questionEl = document.getElementById("choice-question");
  const objectEl = document.getElementById("choice-object");
  const archetypeEl = document.getElementById("choice-archetype");
  const backButton = document.getElementById("choice-back");
  const optionsEl = document.getElementById("choice-options");
  if (!progress || !questionEl || !archetypeEl) return;

  const complete = Object.keys(appState.answers).length === QUESTION_FLOW.length;
  const question = QUESTION_FLOW[appState.activeQuestionIndex] || QUESTION_FLOW[0];
  updateChoiceOptions(optionsEl, question);
  if (backButton) {
    const canGoBack = canGoBackIn3D();
    backButton.disabled = !canGoBack;
    backButton.setAttribute("aria-disabled", String(!canGoBack));
  }
  progress.textContent = complete
    ? "Project mission complete"
    : "Project mission " + (appState.activeQuestionIndex + 1) + " / " + QUESTION_FLOW.length;
  questionEl.textContent = complete ? "Your initial recommendation" : question.prompt;
  if (objectEl) {
    if (appState.hoveredBack) {
      const prevIndex = Math.max(0, appState.activeQuestionIndex - 1);
      const prevQuestion = QUESTION_FLOW[prevIndex];
      const prevValue = prevQuestion ? appState.answers[prevQuestion.id] : null;
      const prevChoice = prevValue && prevQuestion
        ? prevQuestion.choices.find(function (c) { return c.value === prevValue; })
        : null;
      objectEl.textContent = prevChoice
        ? "Go back: step " + (prevIndex + 1) + " — your answer: " + prevChoice.label
        : "Go back: step " + (prevIndex + 1) + " — no answer yet";
      archetypeEl.textContent = "Choices stay saved while you review step " + (prevIndex + 1);
      return;
    }
    const focusIndex = appState.hoveredChoice !== null
      ? appState.hoveredChoice
      : appState.selectedChoice !== null
        ? appState.selectedChoice
        : null;
    const focusChoice = focusIndex !== null ? question.choices[focusIndex] : null;
    if (focusChoice) {
      const focusPlanetId = inferPlanet(focusChoice.value);
      const focusVisual = getChoiceVisual(focusChoice.value, focusPlanetId);
      objectEl.textContent = "3D choice: " + focusChoice.label + " / " + formatVisualKind(focusVisual.kind);
    } else {
      objectEl.textContent = complete ? "Recommendation ready to review" : "Choose the closest answer";
    }
  }
  archetypeEl.textContent = "Initial direction: " + ARCHETYPES[appState.archetype].name;
}

function updateChoiceOptions(container, question) {
  if (!container) return;
  if (container.dataset.questionId !== question.id) {
    const fragment = document.createDocumentFragment();
    question.choices.forEach(function (choice, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-option";
      button.dataset.choiceIndex = String(index);
      button.textContent = choice.label;
      button.setAttribute("aria-label", "Option " + (index + 1) + ": " + choice.label);
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
    container.dataset.questionId = question.id;
    container.setAttribute("aria-label", question.prompt);
  }

  const selectedValue = appState.answers[question.id];
  container.querySelectorAll("[data-choice-index]").forEach(function (button) {
    const choice = question.choices[Number(button.dataset.choiceIndex)];
    const selected = Boolean(choice && choice.value === selectedValue);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function formatVisualKind(kind) {
  const labels = {
    firmwareChip: "interface model",
    apiStack: "backend/API model",
    workflowGear: "work-saving model",
    dataVault: "data/log model",
    opsRadar: "monitoring model",
    hardwarePort: "hardware debug port",
    contractBridge: "interface/API bridge",
    incidentBeacon: "support beacon",
    processRail: "process rail",
    ownershipCompass: "clear-plan compass",
    userCluster: "customer cluster",
    deviceFleet: "device fleet",
    manualStack: "admin stack",
    integrationHub: "tools hub",
    incidentFlare: "tracking signal",
    logConsole: "customer activity",
    memoryNode: "team knowledge",
    retryLoop: "manual-step loop",
    layerPatch: "first-version layer",
    debateOrbit: "responsibility orbit",
    architectureMap: "site-plan model",
    stableHandoff: "customer-journey bridge",
    opsQueue: "admin-relief queue",
    monitoringArray: "monitoring array",
    ownerCrown: "design-partner model"
  };
  return labels[kind] || "3D model";
}

// ---------- Planet focus + readouts ----------

export function focusPlanet(planetId, options = {}) {
  appState.selectedPlanet = planetId;
  syncRescueRigFocus(planetId);
  document.querySelectorAll("[data-planet]").forEach(function (button) {
    const isActive = button.dataset.planet === planetId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  const planet = PLANETS[planetId];
  const insight = document.getElementById("live-insight");
  if (planet && insight) {
    const source = options.fromCanvas ? "3D object" : "Layer";
    insight.textContent = source + " focus: " + planet.label + ". Meaning: " + planet.role + ". Watch this layer pull the system into shape.";
  }
  updateVectorReadout(planetId);
  updatePlanetInspector(planetId);
}

function syncRescueRigFocus(planetId) {
  const rig = document.querySelector(".rescue-rig");
  if (rig) rig.dataset.activeLayer = planetId;
  document.querySelectorAll("[data-rig-node]").forEach(function (node) {
    node.classList.toggle("is-active", node.dataset.rigNode === planetId);
  });
}

export function updateVectorReadout(planetId) {
  const planet = PLANETS[planetId];
  if (!planet) return;
  const focusEl = document.getElementById("readout-focus");
  const orbitEl = document.getElementById("readout-orbit");
  const planeEl = document.getElementById("readout-plane");
  if (focusEl) focusEl.textContent = planet.label;
  if (orbitEl) orbitEl.textContent = planet.radius.toFixed(2) + " AU";
  if (planeEl) planeEl.textContent = planet.inclination.toFixed(2).toUpperCase() + " RAD";
}

export function updatePlanetInspector(planetId) {
  const planet = PLANETS[planetId];
  if (!planet) return;
  const title = document.getElementById("inspector-title");
  const role = document.getElementById("inspector-role");
  const links = document.getElementById("inspector-links");
  const risk = document.getElementById("inspector-risk");
  const copy = document.getElementById("inspector-copy");
  if (title) title.textContent = planet.label;
  if (role) role.textContent = planet.role;
  if (links) links.textContent = planet.links;
  if (risk) risk.textContent = planet.risk;
  if (copy) copy.textContent = planet.copy;
}

export function updateScaleReadout() {
  const stage = SCALE_STAGES[appState.scaleStage];
  const readout = document.getElementById("scale-readout");
  const insight = document.getElementById("live-insight");
  if (readout) readout.textContent = stage.label;
  if (insight) insight.textContent = "System scale: " + stage.label + ". " + stage.copy;
  updateMissionStats();
}

// ---------- Scenarios + cinematic reveal ----------

function runScenario(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;
  appState.activeScenario = scenarioId;
  refreshGalaxyState();
  focusPlanet(scenario.planet);
  document.querySelectorAll("[data-scenario]").forEach(function (button) {
    const isActive = button.dataset.scenario === scenarioId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  const readout = document.getElementById("scenario-readout");
  const insight = document.getElementById("live-insight");
  if (readout) readout.textContent = scenario.label;
  if (insight) insight.textContent = scenario.copy;
  renderResult();
  updateMailto();
  runWhatIfSimulation(scenario.simulation);
}

function stressSelectedLayer() {
  const planet = appState.selectedPlanet || "firmware";
  const scenarioByPlanet = {
    firmware: "firmwareFail",
    backend: "apiLatency",
    automation: "manualWorkflow",
    data: "manualWorkflow",
    hardware: "manualWorkflow",
    ops: "noMonitoring"
  };
  runScenario(scenarioByPlanet[planet] || "apiLatency");
  runMicroPulse(planet);
}

function startCinematicReveal() {
  const hero = document.querySelector(".galaxy-hero");
  const revealName = document.getElementById("reveal-archetype");
  const revealScore = document.getElementById("reveal-score");
  const revealRank = document.getElementById("reveal-rank");
  const archetype = ARCHETYPES[appState.archetype];
  const stats = getMissionStats();
  if (revealName) revealName.textContent = archetype.name;
  if (revealScore) revealScore.textContent = formatScore(stats.score);
  if (revealRank) revealRank.textContent = stats.rank + " rank";
  appState.revealUntil = galaxy.clock.elapsedTime + (appState.reducedMotion ? 0.6 : 2.4);
  if (hero) hero.classList.add("is-revealing");
  runWhatIfSimulation(archetype.simulation);
  window.setTimeout(function () {
    if (hero) hero.classList.remove("is-revealing");
    document.getElementById("result").scrollIntoView({ behavior: appState.reducedMotion ? "auto" : "smooth" });
  }, appState.reducedMotion ? 650 : 2200);
}

// ---------- Scoring + result text ----------

export function inferPlanet(value) {
  if (["firmware", "map"].includes(value)) return "firmware";
  if (["backend", "firmwareBackend", "backendOps", "integrations", "handoff", "patch"].includes(value)) return "backend";
  if (["automation", "businessAutomation", "manual", "retry", "manualOps"].includes(value)) return "automation";
  if (["data", "logs", "person"].includes(value)) return "data";
  if (["hardware", "hardwareFirmware", "devices", "hardwareCare"].includes(value)) return "hardware";
  return "ops";
}

function classifyArchetype() {
  const totals = { handoff: 0, ghost: 0, spreadsheet: 0, bench: 0, hardware: 0, ops: 0 };
  Object.values(appState.answers).forEach(function (answer) {
    const scores = SCORE_MAP[answer] || {};
    Object.entries(scores).forEach(function ([key, value]) {
      totals[key] += value;
    });
  });

  return Object.entries(totals)
    .sort(function (a, b) {
      return b[1] - a[1];
    })[0][0];
}

export function updateCompletion() {
  const count = Object.keys(appState.answers).length;
  const status = document.getElementById("completion-status");
  if (status) {
    status.textContent = count + " / 5";
  }
  updateMissionStats({ announce: true });
}

function getMissionStats() {
  const count = Object.keys(appState.answers).length;
  const score = Math.min(100, count * 20);
  const ranks = ["Scout", "Spark", "Pilot", "Architect", "Commander", "Legend"];
  const archetypeCodes = {
    handoff: "BRIDGE",
    ghost: "MAP",
    spreadsheet: "ENGINE",
    bench: "LAUNCH",
    hardware: "HW",
    ops: "LIVE"
  };
  const archetype = ARCHETYPES[appState.archetype];
  const code = "SYS-" + (archetypeCodes[appState.archetype] || "MAP") + "-" + formatScore(score);
  return {
    count,
    score,
    rank: ranks[count] || ranks[ranks.length - 1],
    combo: "x" + count,
    complete: count === QUESTION_FLOW.length,
    code,
    archetype
  };
}

function formatScore(score) {
  return String(score).padStart(3, "0");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateMissionStats(options = {}) {
  const stats = getMissionStats();
  setText("hero-score", formatScore(stats.score));
  setText("hero-rank", stats.rank);
  setText("hero-combo", String(stats.count));
  setText("mission-score", formatScore(stats.score));
  setText("mission-rank", stats.rank);
  setText("mission-combo", stats.count + " of " + QUESTION_FLOW.length + " answered");
  setText("badge-score", formatScore(stats.score));
  setText("badge-rank", stats.rank + " rank");
  setText("badge-code", stats.code);
  setText("badge-line", buildBadgeLine(stats));

  const fill = document.getElementById("mission-fill");
  if (fill) fill.style.width = stats.score + "%";
  document.body.classList.toggle("map-complete", stats.complete);

  if (options.announce && stats.count > appState.lastAnswerCount) {
    pulseScoreSurface(stats);
    if (stats.complete && !appState.hasCelebratedCompletion) {
      appState.hasCelebratedCompletion = true;
      showAchievement("Project direction unlocked", stats.count + " of " + QUESTION_FLOW.length + " questions answered");
      showScoreReveal(stats);
      runCompletionBurst();
    } else if (!stats.complete) {
      showAchievement("Answer added", stats.count + " of " + QUESTION_FLOW.length + " questions answered");
    }
  }

  appState.lastAnswerCount = stats.count;
}

function pulseScoreSurface(stats) {
  const meter = document.querySelector(".mission-meter");
  const shareBadge = document.getElementById("share-badge");
  document.body.classList.add("score-pulse");
  if (meter) meter.classList.add("is-hot");
  if (shareBadge) shareBadge.classList.add("is-hot");
  spawnScorePop(stats);
  window.setTimeout(function () {
    document.body.classList.remove("score-pulse");
    if (meter) meter.classList.remove("is-hot");
    if (shareBadge) shareBadge.classList.remove("is-hot");
  }, 760);
}

function spawnScorePop(stats) {
  const anchor = document.querySelector(".mission-meter") || document.getElementById("completion-status");
  if (!anchor || appState.reducedMotion) return;
  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "score-pop";
  pop.textContent = "+20 / " + stats.rank;
  pop.style.left = Math.round(rect.left + rect.width / 2) + "px";
  pop.style.top = Math.round(Math.max(92, rect.top + 10)) + "px";
  document.body.appendChild(pop);
  window.setTimeout(function () {
    pop.remove();
  }, 980);
}

function showScoreReveal(stats) {
  const existing = document.querySelector(".wow-score-reveal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "wow-score-reveal";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  const card = document.createElement("div");
  card.className = "wow-score-card";

  const kicker = document.createElement("span");
  kicker.className = "wow-score-kicker";
  kicker.textContent = "Project direction unlocked";

  const score = document.createElement("strong");
  score.className = "wow-score-number";
  score.textContent = String(stats.count) + " / " + QUESTION_FLOW.length;

  const rank = document.createElement("span");
  rank.className = "wow-score-rank";
  rank.textContent = stats.rank + " rank unlocked";

  const archetype = document.createElement("p");
  archetype.textContent = stats.archetype.name;

  const code = document.createElement("span");
  code.className = "wow-score-code";
  code.textContent = stats.code;

  for (let i = 0; i < 3; i += 1) {
    const orbit = document.createElement("i");
    orbit.setAttribute("aria-hidden", "true");
    card.appendChild(orbit);
  }

  card.append(kicker, score, rank, archetype, code);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(function () {
    overlay.classList.add("is-visible");
  });

  window.setTimeout(function () {
    overlay.classList.remove("is-visible");
  }, appState.reducedMotion ? 1100 : 1850);

  window.setTimeout(function () {
    overlay.remove();
  }, appState.reducedMotion ? 1450 : 2300);
}

function updateLiveInsight(score, value) {
  const insight = document.getElementById("live-insight");
  const archetype = ARCHETYPES[appState.archetype];
  if (!insight) return;
  const keys = Object.keys(score || {});
  insight.textContent = keys.length
    ? "Answer added: " + getChoiceLabel(value) + ". Initial direction: " + archetype.name + "."
    : "Answer added. Continue to explore your initial project direction.";
}

function getChoiceLabel(value) {
  for (let i = 0; i < QUESTION_FLOW.length; i += 1) {
    const match = QUESTION_FLOW[i].choices.find(function (choice) {
      return choice.value === value;
    });
    if (match) return match.label;
  }
  return "selected choice";
}

export function renderResult() {
  const archetype = ARCHETYPES[appState.archetype];
  const hasAnswers = getProjectAnswers(appState.answers).length > 0;
  document.getElementById("archetype-name").textContent = hasAnswers ? archetype.name : "Explore a project direction";
  document.getElementById("archetype-summary").textContent = hasAnswers
    ? archetype.summary
    : "Answer the questions for an initial recommendation, or describe your project directly.";
  document.getElementById("next-action").textContent = hasAnswers
    ? "Suggested next step: " + archetype.action
    : "A tailored plan and estimate require a review of your project.";
  const fallbackArchetype = document.getElementById("fallback-archetype");
  const fallbackAction = document.getElementById("fallback-action");
  if (fallbackArchetype) fallbackArchetype.textContent = hasAnswers ? "Initial direction: " + archetype.name : "Explore your project";
  if (fallbackAction) fallbackAction.textContent = hasAnswers ? "Suggested next step: " + archetype.action : "Use the questions below or discuss your project directly.";

  const gapList = document.getElementById("gap-list");
  gapList.innerHTML = "";
  (hasAnswers ? archetype.gaps : []).forEach(function (gap) {
    const li = document.createElement("li");
    li.textContent = gap;
    gapList.appendChild(li);
  });

  document.getElementById("slack-message").textContent = buildSlackMessage();
  updateMissionStats();
}

function buildSlackMessage() {
  return buildSummaryText();
}

function buildBadgeLine(stats = getMissionStats()) {
  return buildProjectShare({ answers: appState.answers, archetype: stats.archetype });
}

export function getProjectShareData() {
  return {
    title: "My initial project direction | Systems Engineering",
    text: buildProjectShare({ answers: appState.answers, archetype: ARCHETYPES[appState.archetype] }),
    url: CONTACT_CONFIG.siteUrl
  };
}

function buildBadgeText() {
  const stats = getMissionStats();
  return [
    buildBadgeLine(stats),
    "Codename: " + stats.code,
    "Explore your project: " + CONTACT_CONFIG.siteUrl
  ].join("\n");
}

function buildSummaryText() {
  return buildProjectSummary({
    answers: appState.answers,
    archetype: ARCHETYPES[appState.archetype],
    notes: document.getElementById("contact-message")?.value || ""
  });
}

export function updateMailto() {
  const link = document.getElementById("email-map");
  if (!link) return;
  const archetype = ARCHETYPES[appState.archetype];
  const subject = getProjectAnswers(appState.answers).length
    ? "Project planning session inquiry: " + archetype.name
    : "Project planning session inquiry";
  const body = encodeURIComponent(buildSummaryText() + "\n\nI would like to discuss a CAD $500 project planning session (90 minutes, preparation and follow-up notes). Please confirm availability and scope.");
  link.href = "mailto:" + CONTACT_CONFIG.email + "?subject=" + encodeURIComponent(subject) + "&body=" + body;
}

// ---------- Reset + toast/copy + download ----------

function downloadMarkdown() {
  const archetype = ARCHETYPES[appState.archetype];
  const lines = [
    "# Initial project direction",
    "",
    buildSummaryText(),
    "",
    "---",
    "Generated at: " + new Date().toISOString(),
    "Source: " + CONTACT_CONFIG.siteUrl
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "project-direction-" + archetype.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Project summary download started.");
}

function resetGalaxy() {
  const answeredCount = Object.keys(appState.answers).length;
  if (answeredCount > 0 && !window.confirm("Reset " + answeredCount + " answer" + (answeredCount === 1 ? "" : "s") + " and start over?")) {
    return;
  }
  if (appState.choiceAdvanceTimer) {
    window.clearTimeout(appState.choiceAdvanceTimer);
    appState.choiceAdvanceTimer = null;
  }
  appState.answers = {};
  appState.archetype = "handoff";
  appState.selectedPlanet = "firmware";
  appState.activeQuestionIndex = 0;
  appState.hoveredBack = false;
  appState.hoveredChoice = null;
  appState.selectedChoice = null;
  appState.choicePulseUntil = 0;
  appState.backPortalPulseUntil = 0;
  appState.lastAnswerCount = Object.keys(appState.answers).length;
  appState.hasCelebratedCompletion = false;
  document.querySelectorAll("input[type='radio']").forEach(function (input) {
    input.checked = false;
  });
  appState.activeScenario = null;
  appState.scaleStage = 0;
  appState.revealUntil = 0;
  refreshGalaxyState();
  const scaleSlider = document.getElementById("scale-slider");
  if (scaleSlider) scaleSlider.value = "0";
  document.querySelectorAll("[data-scenario]").forEach(function (button) {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  });
  const scenarioReadout = document.getElementById("scenario-readout");
  if (scenarioReadout) scenarioReadout.textContent = "choose one";
  focusPlanet("firmware");
  updateCompletion();
  updateScaleReadout();
  renderResult();
  updateMailto();
  syncAnswerDeck(true);
  updateChoiceHud();
  const insight = document.getElementById("live-insight");
  if (insight) {
    insight.textContent = "Answers reset. Choose a service or answer the first project question.";
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied");
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
    showToast(copied ? "Copied" : "Copy unavailable. Select the project summary and copy it manually.");
  }
}

function showAchievement(kicker, title) {
  const achievement = document.getElementById("achievement-toast");
  const kickerEl = document.getElementById("achievement-kicker");
  const titleEl = document.getElementById("achievement-title");
  if (!achievement || !kickerEl || !titleEl) {
    showToast(kicker + ": " + title);
    return;
  }
  kickerEl.textContent = kicker;
  titleEl.textContent = title;
  achievement.classList.add("is-visible");
  window.setTimeout(function () {
    achievement.classList.remove("is-visible");
  }, 2100);
}

function runCompletionBurst() {
  if (appState.reducedMotion) return;
  const burst = document.createElement("div");
  burst.className = "completion-burst";
  for (let i = 0; i < 26; i += 1) {
    const spark = document.createElement("span");
    const angle = (i / 26) * Math.PI * 2;
    const distance = 80 + Math.random() * 140;
    spark.style.setProperty("--x", Math.cos(angle) * distance + "px");
    spark.style.setProperty("--y", Math.sin(angle) * distance + "px");
    spark.style.setProperty("--delay", Math.random() * 120 + "ms");
    spark.style.setProperty("--spark-color", i % 3 === 0 ? "var(--gold)" : i % 2 === 0 ? "var(--mint)" : "var(--cyan-strong)");
    burst.appendChild(spark);
  }
  document.body.appendChild(burst);
  window.setTimeout(function () {
    burst.remove();
  }, 1300);
}

export function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(function () {
    toast.classList.remove("is-visible");
  }, 1600);
}
