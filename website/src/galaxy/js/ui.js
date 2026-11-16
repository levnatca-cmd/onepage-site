// DOM-side handlers: form binding, HUD readouts, 3D-mode lifecycle, result rendering,
// scenarios, scale slider, share/copy/toast. No Three.js code here.

import { bindSecureInquiry } from "/src/shared/secure-inquiry.js?v=wow60&rev=pqc1";
import { sanitizeInquiry } from "/src/studio/inquiry.js";
import { CONTACT_CONFIG } from "./data/config.js?v=wow60";
import {
  PLANETS,
  QUESTION_FLOW,
  SCORE_MAP,
  SCALE_STAGES,
  SCENARIOS,
  ARCHETYPES
} from "./data/quiz-data.js?v=wow60&rev=galaxy-seven-quiz1";
import { appState, galaxy } from "./state.js?v=wow60";
import { buildProjectSummary, buildProjectShare, getProjectAnswers, getProjectArchetypeKey } from "./project-summary.js?v=wow60&rev=galaxy-seven-quiz1";
import {
  resizeGalaxy,
  refreshGalaxyState,
  runWhatIfSimulation,
  syncGalaxyNavigationLinks,
  startGalaxyServiceRowTransition,
  isGalaxyServiceRowTransitioning,
  startGalaxyQuizTransition,
  isGalaxyQuizTransitioning
} from "./galaxy.js?v=wow60&rev=galaxy-motion1";

let reviewing3DAnswer = false;
let questionHologramOpen = false;
let answerFlight = null;
let resultRevealTimer = null;

// ---------- Contact links + copyright ----------

export function updateCopyrightYear() {
  const yearEl = document.getElementById("copyright-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

// ---------- Control wiring ----------

export function bindControls() {
  if (document.getElementById("quiz-console")) bindQuizControls();

  const fingerprintForm = document.getElementById("fingerprint-form");
  if (fingerprintForm) {
    const applyRadioAnswer = function (event) {
      const input = event.target;
      if (!input.matches("input[type='radio']")) return;
      // Native changes arrive after the click. A click only handles reselecting the current answer.
      if (event.type === "click" && appState.answers[input.name] !== input.value) return;
      setFingerprintAnswer(input.name, input.value);
    };
    fingerprintForm.addEventListener("change", applyRadioAnswer);
    fingerprintForm.addEventListener("click", applyRadioAnswer);
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

  bindContactForm();
}

function bindQuizControls() {
  document.getElementById("choice-options").addEventListener("click", function (event) {
    const button = event.target.closest("[data-choice-index]");
    if (button) commitQuestionAnswer(Number(button.dataset.choiceIndex));
  });
  buildQuestionField();
  document.querySelector("[data-close-question]").addEventListener("click", closeQuestionHologram);
  document.getElementById("quiz-answer-row").addEventListener("click", function (event) {
    const token = event.target.closest("[data-question-index]");
    if (!token || token.disabled || answerFlight) return;
    openQuestionHologram(Number(token.dataset.questionIndex), { focus: true });
  });
  document.getElementById("quiz-core-trigger").addEventListener("click", openRecommendation);
}

function bindContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const services = {
    firmware: "websites",
    backend: "integrations",
    automation: "integrations",
    pqc: "security",
    data: "integrations",
    hardware: "support",
    ops: "support"
  };
  bindSecureInquiry(form, {
    status: document.getElementById("contact-status"),
    read: function () {
      const fields = new FormData(form);
      const notes = String(fields.get("description") || "").trim();
      if (!document.getElementById("fingerprint-form")) {
        return sanitizeInquiry({ email: fields.get("email"), description: notes });
      }
      const summary = buildSummaryText().slice(0, Math.max(0, 3998 - notes.length));
      return sanitizeInquiry({
        email: fields.get("email"),
        service: services[appState.answers.q1],
        description: notes.length >= 20 && summary ? notes + "\n\n" + summary : notes
      });
    }
  });
}

// ---------- 3D mode lifecycle + per-question advancement ----------

export function bindGalaxyStageOffsets() {
  const hero = document.querySelector(".galaxy-hero");
  const header = document.querySelector(".site-header");
  const intro = hero?.querySelector(".hero-copy");
  if (!hero) return;

  function updateStageOffsets() {
    hero.style.setProperty("--galaxy-header-height", (header?.offsetHeight ?? 0) + "px");
    hero.style.setProperty("--galaxy-intro-height", (intro?.offsetHeight ?? 0) + "px");
  }

  window.addEventListener("resize", updateStageOffsets);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(updateStageOffsets);
    if (header) observer.observe(header);
    if (intro) observer.observe(intro);
  }
  updateStageOffsets();
}

export function bindGalaxyServiceRow() {
  const row = document.querySelector(".galaxy-service-row");
  const boundary = document.getElementById("service-row");
  const hero = row?.closest(".galaxy-hero");
  const launch = hero?.querySelector(".hero-actions a[href='#services']");
  const header = document.querySelector(".site-header");
  const canvas = document.getElementById("galaxy-canvas");
  if (!hero || !boundary || !launch || !canvas) return;

  function fallBackToCatalog() {
    if (location.hash === "#service-row") {
      history.replaceState(history.state, "", "#services");
      document.getElementById("services").scrollIntoView({ behavior: "instant" });
    }
  }

  if (!appState.webglReady) {
    fallBackToCatalog();
    return;
  }

  let wantsRow = false;
  let scrollFrame = null;
  let focusRow = false;

  function updateControls() {
    const transitioning = isGalaxyServiceRowTransitioning();
    const settled = appState.serviceRowMode && !transitioning;
    row.hidden = !appState.serviceRowMode && !transitioning;
    row.inert = !settled;
    if (settled && focusRow) {
      focusRow = false;
      row.querySelector("[data-galaxy-service-link]")?.focus({ preventScroll: true });
    }
  }

  function syncMode() {
    if (!appState.webglReady || wantsRow === appState.serviceRowMode || isGalaxyServiceRowTransitioning()) return;
    if (wantsRow) row.hidden = false;
    if (startGalaxyServiceRowTransition(wantsRow ? "enter" : "exit")) {
      appState.serviceRowMode = wantsRow;
      hero.classList.toggle("is-service-row", wantsRow);
      canvas.classList.remove("is-targeting");
    }
    updateControls();
  }

  function readBoundary() {
    scrollFrame = null;
    const offset = boundary.getBoundingClientRect().top - (header?.getBoundingClientRect().bottom ?? 0);
    if (offset < -12) wantsRow = true;
    else if (offset > 12) {
      wantsRow = false;
      focusRow = false;
    }
    syncMode();
  }

  function scheduleRead() {
    scrollFrame ??= requestAnimationFrame(readBoundary);
  }

  function openRow(event) {
    if (!appState.webglReady || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    wantsRow = true;
    focusRow = event.detail === 0;
    if (location.hash !== "#service-row") history.pushState(history.state, "", "#service-row");
    boundary.scrollIntoView({ behavior: "instant" });
    syncMode();
    updateControls();
  }

  function returnToGalaxy() {
    wantsRow = false;
    focusRow = false;
    hero.scrollIntoView({ behavior: "instant" });
    syncMode();
    launch.focus({ preventScroll: true });
  }

  launch.addEventListener("click", openRow);
  row.querySelector("[data-exit-service-row]").addEventListener("click", function (event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== "#top") history.pushState(history.state, "", "#top");
    returnToGalaxy();
  });
  row.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || hero.classList.contains("is-diving")) return;
    event.preventDefault();
    if (location.hash === "#service-row") history.replaceState(history.state, "", "#top");
    returnToGalaxy();
  });
  hero.addEventListener("galaxy:service-row-transition-end", function () {
    updateControls();
    scheduleRead();
  });
  hero.addEventListener("galaxy:sphere-dive-end", scheduleRead);
  canvas.addEventListener("galaxy:unavailable", function () {
    updateControls();
    fallBackToCatalog();
  });
  window.addEventListener("scroll", scheduleRead, { passive: true });
  window.addEventListener("resize", scheduleRead);
  window.addEventListener("pageshow", scheduleRead);
  if (location.hash === "#service-row") boundary.scrollIntoView({ behavior: "instant" });
  scheduleRead();
}

export function bindQuizNavigation() {
  const hero = document.querySelector(".galaxy-hero");
  const boundary = document.getElementById("project-quiz");
  const header = document.querySelector(".site-header");
  const launcher = hero?.querySelector("[data-start-3d]");
  if (!hero || !boundary || !launcher) return;
  const fallback = document.querySelector(".galaxy-quiz-fallback");
  const canvas = document.getElementById("galaxy-canvas");

  let wantsQuiz = false;
  let scrollFrame = null;
  let focusOnEntry = false;
  const margin = 12;

  function updateAvailability() {
    fallback.hidden = appState.webglReady;
    fallback.querySelector("[data-quiz-text]").hidden = false;
    if (!appState.webglReady) {
      questionHologramOpen = false;
      answerFlight?.cancel();
    }
    updateChoiceHud();
  }

  function focusQuizEntry() {
    if (!focusOnEntry || isGalaxyQuizTransitioning() || !appState.threeDMode) return;
    focusOnEntry = false;
    focusNextQuizControl();
  }

  function syncView() {
    if (!appState.webglReady || wantsQuiz === appState.threeDMode || isGalaxyQuizTransitioning()) return;
    if (!startGalaxyQuizTransition(wantsQuiz ? "enter" : "exit")) return;
    appState.threeDMode = wantsQuiz;
    hero.classList.toggle("is-3d-mode", wantsQuiz);
    if (wantsQuiz) {
      reviewing3DAnswer = false;
      appState.activeQuestionIndex = getNextQuestionIndex();
    } else {
      questionHologramOpen = false;
      answerFlight?.cancel();
      cancelCinematicReveal();
      canvas.classList.remove("is-targeting");
    }
    resizeGalaxy();
    updateChoiceHud();
    focusQuizEntry();
  }

  function readBoundary() {
    scrollFrame = null;
    const offset = boundary.getBoundingClientRect().top - (header?.getBoundingClientRect().bottom ?? 0);
    if (offset < -margin) wantsQuiz = true;
    else if (offset > margin) {
      wantsQuiz = false;
      focusOnEntry = false;
    }
    syncView();
  }

  function scheduleBoundaryRead() {
    scrollFrame ??= requestAnimationFrame(readBoundary);
  }

  function navigateTo(target, focus, useHistory = true) {
    const hash = "#" + target.id;
    if (useHistory && location.hash !== hash) history.pushState(history.state, "", hash);
    target.scrollIntoView({ behavior: "instant", block: "start" });
    focus.focus({ preventScroll: true });
  }

  function isPlainClick(event) {
    return !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  launcher.addEventListener("click", function (event) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (!appState.webglReady) {
      openFingerprintFallback();
      return;
    }
    wantsQuiz = true;
    focusOnEntry = true;
    navigateTo(boundary, launcher);
    syncView();
    focusQuizEntry();
  });

  for (const link of document.querySelectorAll('[data-exit-3d], [data-back-to-galaxy], a[href="#top"]')) {
    link.addEventListener("click", function (event) {
      if (!isPlainClick(event) || !appState.threeDMode) return;
      event.preventDefault();
      wantsQuiz = false;
      focusOnEntry = false;
      syncView();
      navigateTo(hero, launcher);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented || event.key !== "Escape" || !wantsQuiz || !appState.webglReady) return;
    event.preventDefault();
    if (questionHologramOpen) {
      closeQuestionHologram();
      return;
    }
    wantsQuiz = false;
    focusOnEntry = false;
    syncView();
    navigateTo(hero, launcher, false);
    if (location.hash === "#project-quiz") history.replaceState(history.state, "", "#top");
  });
  hero.addEventListener("galaxy:quiz-transition-end", function () {
    updateChoiceHud();
    focusQuizEntry();
    scheduleBoundaryRead();
  });
  canvas.addEventListener("galaxy:unavailable", updateAvailability);
  window.addEventListener("scroll", scheduleBoundaryRead, { passive: true });
  window.addEventListener("resize", scheduleBoundaryRead);
  window.addEventListener("pageshow", scheduleBoundaryRead);
  if ("ResizeObserver" in window) {
    if (header) new ResizeObserver(scheduleBoundaryRead).observe(header);
  }
  updateAvailability();
  scheduleBoundaryRead();
  if (location.hash === "#project-quiz" && appState.webglReady) {
    boundary.scrollIntoView({ behavior: "instant", block: "start" });
  }
}

function openFingerprintFallback() {
  const fingerprint = document.getElementById("fingerprint");
  if (!fingerprint) return;
  const questionIndex = getNextQuestionIndex();
  const selector = "input[name='" + QUESTION_FLOW[questionIndex].id + "']";
  const target = fingerprint.querySelector(selector + ":checked") || fingerprint.querySelector(selector);
  const scrollTarget = questionIndex > 0 && target ? target : fingerprint;
  scrollTarget.scrollIntoView({
    behavior: appState.reducedMotion ? "auto" : "smooth",
    block: scrollTarget === fingerprint ? "start" : "center"
  });
  showToast("3D is unavailable. Opening the project questions.");
  window.setTimeout(function () {
    target?.focus({ preventScroll: true });
  }, appState.reducedMotion ? 0 : 420);
}

function focusCurrentQuestion() {
  document.getElementById("choice-question").focus({ preventScroll: true });
}

function hasCompletedQuestions() {
  return QUESTION_FLOW.every(({ id }) => Boolean(appState.answers[id]));
}

function buildQuestionField() {
  const field = document.getElementById("quiz-question-field");
  QUESTION_FLOW.forEach(function ({ prompt }, index) {
    const slot = document.createElement("div");
    slot.className = "quiz-question-slot";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-question-trigger";
    button.dataset.pendingQuestion = String(index);
    button.setAttribute("aria-controls", "choice-hud");
    button.setAttribute("aria-label", "Question " + (index + 1) + " · " + prompt);
    const sphere = createQuizSphere(index);
    const number = document.createElement("span");
    number.className = "quiz-pending-number";
    number.textContent = String(index + 1);
    number.setAttribute("aria-hidden", "true");
    button.append(sphere, number);
    button.addEventListener("pointerenter", function (event) {
      if (event.pointerType !== "mouse") return;
      if (document.getElementById("choice-hud").contains(document.activeElement)) return;
      openQuestionHologram(index);
    });
    button.addEventListener("click", function () {
      openQuestionHologram(index, { focus: true });
    });
    slot.append(button);
    field.append(slot);
  });
}

function createQuizSphere(index) {
  const sphere = document.createElement("span");
  sphere.className = "quiz-question-sphere";
  sphere.setAttribute("aria-hidden", "true");
  sphere.style.setProperty("--quiz-answer-hue", index * 28 + "deg");
  return sphere;
}

function getPendingQuestion(index) {
  return document.querySelector('[data-pending-question="' + index + '"]');
}

function openQuestionHologram(index, { focus = false } = {}) {
  if (!appState.threeDMode || isGalaxyQuizTransitioning() || answerFlight) return;
  appState.activeQuestionIndex = index;
  reviewing3DAnswer = Boolean(appState.answers[QUESTION_FLOW[index].id]);
  questionHologramOpen = true;
  updateChoiceHud();
  if (focus) focusCurrentQuestion();
}

function closeQuestionHologram() {
  const previousIndex = appState.activeQuestionIndex;
  const wasReviewing = reviewing3DAnswer;
  questionHologramOpen = false;
  reviewing3DAnswer = false;
  appState.activeQuestionIndex = getNextQuestionIndex();
  updateChoiceHud();
  const trigger = wasReviewing
    ? document.querySelector('[data-question-index="' + previousIndex + '"]')
    : getPendingQuestion(previousIndex);
  trigger?.focus({ preventScroll: true });
}

function commitQuestionAnswer(choiceIndex) {
  if (!appState.threeDMode || !questionHologramOpen || answerFlight) return;
  const questionIndex = appState.activeQuestionIndex;
  const question = QUESTION_FLOW[questionIndex];
  const choice = question?.choices[choiceIndex];
  if (!choice) return;

  const wasReviewing = reviewing3DAnswer;
  questionHologramOpen = false;
  document.getElementById("choice-hud").hidden = true;
  if (!wasReviewing) {
    const source = getPendingQuestion(questionIndex).querySelector(".quiz-question-sphere");
    const row = document.getElementById("quiz-answer-row");
    const slot = row.children[Object.keys(appState.answers).length];
    const origin = source.getBoundingClientRect();
    const destination = slot.querySelector(".quiz-question-sphere").getBoundingClientRect();
    if (!appState.reducedMotion && origin.width && destination.width && source.animate) {
      animateAnswerFlight(source, slot, origin, destination);
    }
  }

  reviewing3DAnswer = false;
  setFingerprintAnswer(question.id, choice.value, { from3D: true, deferSimulation: true });
  appState.activeQuestionIndex = getNextQuestionIndex();
  updateChoiceHud();
  if (wasReviewing) document.querySelector('[data-question-index="' + questionIndex + '"]').focus({ preventScroll: true });
  else if (!answerFlight) focusNextQuizControl();
}

function animateAnswerFlight(source, slot, origin, destination) {
  const consoleEl = document.getElementById("quiz-console");
  const bounds = consoleEl.getBoundingClientRect();
  const sphere = source.cloneNode(true);
  sphere.classList.add("quiz-flight-sphere");
  Object.assign(sphere.style, {
    left: origin.left - bounds.left + "px",
    top: origin.top - bounds.top + "px",
    width: origin.width + "px",
    height: origin.height + "px"
  });
  consoleEl.append(sphere);
  slot.classList.add("is-landing");

  const x = destination.left + (destination.width - origin.width) / 2 - origin.left;
  const y = destination.top + (destination.height - origin.height) / 2 - origin.top;
  const scale = destination.width / origin.width;
  const animation = sphere.animate([
    { transform: "translate(0, 0) scale(1)", opacity: 1 },
    { transform: "translate(" + x * 0.28 + "px, " + (y * 0.25 - 12) + "px) scale(0.84)", offset: 0.25 },
    { transform: "translate(" + x + "px, " + y + "px) scale(" + scale + ")", opacity: 1 }
  ], { duration: 540, easing: "cubic-bezier(.32,.12,.2,1)", fill: "forwards" });

  answerFlight = animation;
  const finish = function (completed) {
    sphere.remove();
    slot.classList.remove("is-landing");
    answerFlight = null;
    updateChoiceHud();
    if (completed && appState.threeDMode) focusNextQuizControl();
  };
  animation.finished.then(() => finish(true), () => finish(false));
}

function focusNextQuizControl() {
  const trigger = hasCompletedQuestions()
    ? document.getElementById("quiz-core-trigger")
    : getPendingQuestion(getNextQuestionIndex());
  trigger?.focus({ preventScroll: true });
}

function openRecommendation() {
  if (!appState.threeDMode || !hasCompletedQuestions() || answerFlight) return;
  questionHologramOpen = false;
  reviewing3DAnswer = false;
  updateChoiceHud();
  const result = document.getElementById("result-title");
  result.setAttribute("tabindex", "-1");
  document.getElementById("result").scrollIntoView({ behavior: "instant", block: "start" });
  result.focus({ preventScroll: true });
}

// ---------- Form + scoring + result rendering ----------

function setFingerprintAnswer(questionId, value, options = {}) {
  const questionIndex = getQuestionIndex(questionId);
  const choiceIndex = findChoiceIndex(questionId, value);
  const choice = QUESTION_FLOW[questionIndex]?.choices[choiceIndex];
  if (!choice) return;

  appState.answers[questionId] = value;
  const input = document.querySelector("input[name='" + questionId + "'][value='" + value + "']");
  if (input) input.checked = true;

  focusPlanet(choice.serviceId, { fromCanvas: Boolean(options.from3D) });
  appState.archetype = getProjectArchetypeKey(appState.answers);
  refreshGalaxyState();

  if (!options.from3D && !reviewing3DAnswer) appState.activeQuestionIndex = getNextQuestionIndex();
  updateCompletion({ celebrate: !options.from3D });
  renderResult();
  updateLiveInsight(SCORE_MAP[value], choice.label);
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

function findChoiceIndex(questionId, value) {
  const question = QUESTION_FLOW[getQuestionIndex(questionId)];
  if (!question) return -1;
  return question.choices.findIndex(function (choice) {
    return choice.value === value;
  });
}

function getNextQuestionIndex() {
  const next = QUESTION_FLOW.findIndex(({ id }) => !appState.answers[id]);
  return next === -1 ? QUESTION_FLOW.length - 1 : next;
}

export function updateChoiceHud() {
  const consoleEl = document.getElementById("quiz-console");
  if (!consoleEl) return;
  const panel = document.getElementById("choice-hud");
  const core = document.getElementById("quiz-core-trigger");
  const visible = appState.webglReady && appState.threeDMode && !isGalaxyQuizTransitioning();
  const answeredIds = Object.keys(appState.answers);
  const complete = hasCompletedQuestions();
  const panelVisible = visible && questionHologramOpen;
  consoleEl.hidden = !visible;
  panel.hidden = !panelVisible;
  consoleEl.classList.toggle("is-quiz-complete", complete);
  document.querySelectorAll("[data-pending-question]").forEach(function (button, index) {
    button.hidden = Boolean(appState.answers[QUESTION_FLOW[index].id]);
    button.disabled = Boolean(answerFlight);
    const expanded = panelVisible && !reviewing3DAnswer && index === appState.activeQuestionIndex;
    button.setAttribute("aria-expanded", String(expanded));
  });
  core.disabled = !complete || Boolean(answerFlight);
  const coreAction = core.querySelector(".quiz-core-action");
  coreAction.textContent = complete ? "View recommendation" : "After all 5 answers";
  const progress = document.getElementById("choice-progress");
  const progressText = complete ? "Quiz complete" : answeredIds.length + " / " + QUESTION_FLOW.length + " answered";
  if (progress.textContent !== progressText) progress.textContent = progressText;
  const question = QUESTION_FLOW[appState.activeQuestionIndex];
  const coreStatus = document.getElementById("quiz-core-status");
  coreStatus.textContent = complete ? "All five questions answered." : "Answer all five questions to activate Core.";

  updateAnswerRow(answeredIds, panelVisible);
  if (!panelVisible) return;
  const questionEl = document.getElementById("choice-question");
  questionEl.textContent = question.prompt;
  const options = document.getElementById("choice-options");
  if (options.dataset.questionId !== question.id) options.scrollTop = 0;
  updateChoiceOptions(options, question);
}

function updateAnswerRow(answeredIds, panelVisible) {
  const row = document.getElementById("quiz-answer-row");
  if (!row.childElementCount) {
    QUESTION_FLOW.forEach(function (_, index) {
      const slot = document.createElement("li");
      slot.className = "quiz-answer-slot";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-answer-token";
      button.setAttribute("aria-controls", "choice-hud");
      const sphere = createQuizSphere(index);
      const number = document.createElement("span");
      number.className = "quiz-token-number";
      number.setAttribute("aria-hidden", "true");
      button.append(sphere, number);
      slot.append(button);
      row.append(slot);
    });
  }
  for (const [index, slot] of Array.from(row.children).entries()) {
    const button = slot.firstElementChild;
    const questionIndex = getQuestionIndex(answeredIds[index]);
    const question = QUESTION_FLOW[questionIndex];
    const selected = question?.choices.find(({ value }) => value === appState.answers[question.id]);
    const reviewing = panelVisible && reviewing3DAnswer && questionIndex === appState.activeQuestionIndex;
    slot.classList.toggle("is-answered", Boolean(selected));
    slot.classList.toggle("is-reviewing", reviewing);
    button.disabled = !selected || Boolean(answerFlight);
    if (selected) button.dataset.questionIndex = String(questionIndex);
    else delete button.dataset.questionIndex;
    button.setAttribute("aria-expanded", String(reviewing));
    button.setAttribute("aria-label", selected
      ? "Edit question " + (questionIndex + 1) + " · " + selected.label
      : "Empty answer slot " + (index + 1));
    button.querySelector(".quiz-question-sphere").style.setProperty("--quiz-answer-hue", questionIndex * 28 + "deg");
    button.querySelector(".quiz-token-number").textContent = selected ? String(questionIndex + 1) : "";
    button.title = selected?.label ?? "";
  }
}

function updateChoiceOptions(container, question) {
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
  }

  const selectedIndex = findChoiceIndex(question.id, appState.answers[question.id]);
  container.querySelectorAll("[data-choice-index]").forEach(function (button) {
    const selected = Number(button.dataset.choiceIndex) === selectedIndex;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

// ---------- Planet focus + readouts ----------

export function focusPlanet(planetId, options = {}) {
  appState.selectedPlanet = planetId;
  syncGalaxyNavigationLinks();
  const planet = PLANETS[planetId];
  const insight = document.getElementById("live-insight");
  if (planet && insight) {
    const source = options.fromCanvas ? "3D object" : "Layer";
    insight.textContent = source + " focus: " + planet.label + ". Meaning: " + planet.role + ". Watch this layer pull the system into shape.";
  }
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
  runWhatIfSimulation(scenario.simulation);
}

function cancelCinematicReveal() {
  if (resultRevealTimer === null) return;
  window.clearTimeout(resultRevealTimer);
  resultRevealTimer = null;
  appState.revealUntil = 0;
  document.querySelector(".galaxy-hero")?.classList.remove("is-revealing");
}

function startCinematicReveal() {
  cancelCinematicReveal();
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
  resultRevealTimer = window.setTimeout(function () {
    cancelCinematicReveal();
    document.getElementById("result").scrollIntoView({ behavior: appState.reducedMotion ? "auto" : "smooth" });
  }, appState.reducedMotion ? 650 : 2200);
}

// ---------- Scoring + result text ----------

export function updateCompletion({ celebrate = true } = {}) {
  const count = Object.keys(appState.answers).length;
  const status = document.getElementById("completion-status");
  if (status) {
    status.textContent = count + " / 5";
  }
  updateMissionStats({ announce: celebrate });
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
  if (meter) meter.classList.add("is-hot");
  if (shareBadge) shareBadge.classList.add("is-hot");
  spawnScorePop(stats);
  window.setTimeout(function () {
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

function updateLiveInsight(score, choiceLabel) {
  const insight = document.getElementById("live-insight");
  const archetype = ARCHETYPES[appState.archetype];
  if (!insight) return;
  const keys = Object.keys(score || {});
  insight.textContent = keys.length
    ? "Answer added: " + choiceLabel + ". Initial direction: " + archetype.name + "."
    : "Answer added. Continue to explore your initial project direction.";
}

export function renderResult() {
  const name = document.getElementById("archetype-name");
  if (!name) return;
  const archetype = ARCHETYPES[appState.archetype];
  const hasAnswers = getProjectAnswers(appState.answers).length > 0;
  name.textContent = hasAnswers ? archetype.name : "Explore a project direction";
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
    archetype: ARCHETYPES[appState.archetype]
  });
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
  cancelCinematicReveal();
  reviewing3DAnswer = false;
  questionHologramOpen = false;
  reviewing3DAnswer = false;
  answerFlight?.cancel();
  appState.answers = {};
  appState.archetype = "handoff";
  appState.selectedPlanet = "firmware";
  appState.hoveredPlanet = null;
  appState.focusPulseUntil = 0;
  appState.activeQuestionIndex = 0;
  appState.lastAnswerCount = Object.keys(appState.answers).length;
  appState.hasCelebratedCompletion = false;
  document.querySelectorAll("#fingerprint-form input[type='radio']").forEach(function (input) {
    input.checked = false;
  });
  const url = new URL(window.location.href);
  if (url.searchParams.has("focus")) {
    url.searchParams.delete("focus");
    window.history.replaceState(window.history.state, "", url);
  }
  appState.activeScenario = null;
  appState.simulation = null;
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
  updateChoiceHud();
  const insight = document.getElementById("live-insight");
  if (insight) {
    insight.textContent = document.getElementById("fingerprint-form")
      ? "Answers reset. Choose a service or answer the first project question."
      : "System preview reset. Choose a service to explore how it fits.";
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
