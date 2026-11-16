// Entry point: bootstraps app, then wires the back-to-top and native share controls.

import { appState } from "./state.js?v=wow60";
import { bindGalaxyServiceLinks, initGalaxyScene, refreshGalaxyState } from "./galaxy.js?v=wow60&rev=core-plasma6";
import {
  updateCopyrightYear,
  bindControls,
  bindGalaxyStageOffsets,
  bindGalaxyServiceRow,
  bindQuizNavigation,
  renderResult,
  updateCompletion,
  updateVectorReadout,
  updatePlanetInspector,
  updateScaleReadout,
  updateChoiceHud,
  getProjectShareData
} from "./ui.js?v=wow60&rev=core-plasma6";

function initApp() {
  updateCopyrightYear();
  bindGalaxyStageOffsets();
  refreshGalaxyState();
  try {
    initGalaxyScene();
  } catch (error) {
    window.__galaxyInitError = {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ""
    };
    const hero = document.querySelector(".galaxy-hero");
    const loading = document.getElementById("galaxy-loading");
    if (hero) {
      hero.classList.remove("is-loading", "webgl-ready", "is-3d-mode", "is-launching");
      hero.classList.add("webgl-failed");
    }
    appState.webglReady = false;
    appState.threeDMode = false;
    if (loading) loading.hidden = true;
  }
  bindControls();
  bindGalaxyServiceLinks();
  bindGalaxyServiceRow();
  if (document.getElementById("quiz-console")) {
    bindQuizNavigation();
    renderResult();
    updateCompletion();
    updateChoiceHud();
  }
  updateVectorReadout(appState.selectedPlanet);
  updatePlanetInspector(appState.selectedPlanet);
  updateScaleReadout();
}

// ---------- Standalone DOM widgets (no app-state coupling) ----------

function bindBackToTop() {
  const btn = document.getElementById("back-to-top");
  const sysStatus = document.getElementById("sys-status");
  if (!btn) return;
  function update() {
    const deepScroll = window.scrollY > 600;
    btn.classList.toggle("is-visible", deepScroll);
    if (sysStatus) sysStatus.classList.toggle("is-docked", deepScroll);
  }
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function bindShareButton() {
  const shareButtons = document.querySelectorAll("[data-share]");
  const toast = document.getElementById("toast");
  if (!shareButtons.length) return;

  function showShareToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("is-visible");
    setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 1800);
  }

  shareButtons.forEach(function (shareBtn) {
    shareBtn.addEventListener("click", async function () {
      const shareData = getProjectShareData();

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareData.text + " " + shareData.url);
        showShareToast("Project direction copied. Share it when you are ready.");
      } catch (error) {
        showShareToast("Copy unavailable. You can select and copy the project summary below.");
      }
    });
  });
}

function startSysClock() {
  const el = document.getElementById("sys-status-time");
  if (!el) return;
  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    el.textContent = "TS " + hh + ":" + mm + ":" + ss;
  }
  tick();
  window.setInterval(tick, 1000);
}

function startTelemetryTicker() {
  const orbit = document.getElementById("readout-orbit");
  const plane = document.getElementById("readout-plane");
  if (!orbit && !plane) return;
  window.setInterval(function () {
    if (appState.reducedMotion) return;
    if (orbit) {
      const match = orbit.textContent.match(/^([\d.]+)\s*AU$/);
      if (match) {
        const base = parseFloat(match[1]);
        const jitter = (Math.random() - 0.5) * 0.06;
        orbit.textContent = (base + jitter).toFixed(2) + " AU";
      }
    }
    if (plane) {
      const match = plane.textContent.match(/^([-\d.]+)\s*RAD$/i);
      if (match) {
        const base = parseFloat(match[1]);
        const jitter = (Math.random() - 0.5) * 0.012;
        plane.textContent = (base + jitter).toFixed(2).toUpperCase() + " RAD";
      }
    }
  }, 720);
}

initApp();
bindBackToTop();
bindShareButton();
startSysClock();
startTelemetryTicker();
