// UI state, event handlers, preferences, and optional local agent tools.
const $ = (id) => document.getElementById(id);
let brief = new Set(),
  selected = 0,
  paused = false,
  sound = false,
  rain = false;
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = motionPreference.matches;
let sceneApi = null,
  audioContext = null,
  lastTime = performance.now(),
  lastRendered = 0,
  elapsed = 0,
  toastTimer,
  scanFxUntil = 0;
let backgroundPaused = document.hidden,
  dialogPaused = false,
  sceneAvailable = false;
const dialogOpeners = new WeakMap();
try {
  const legacyDraftKey = "systems-project-brief:v1";
  const raw = sessionStorage.getItem(legacyDraftKey);
  sessionStorage.removeItem(legacyDraftKey);
  const saved = JSON.parse(raw || "null");
  if (saved && Array.isArray(saved.services)) {
    brief = new Set(
      saved.services.filter((id) => Number.isInteger(id) && id >= 0 && id < worlds.length),
    );
    $("brief-notes").value = normalizeNotes(typeof saved.notes === "string" ? saved.notes : "");
  }
} catch {
  // Storage may be unavailable or contain an invalid legacy draft.
}
const effectivePause = () => paused || backgroundPaused || dialogPaused;
function toast(message) {
  if ($("brief-dialog").open) {
    $("brief-status").textContent = message;
    return;
  }
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4200);
}
function playTone(freq = 440, duration = 0.1) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    void audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      freq * 0.7,
      audioContext.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    sound = false;
    syncSettings();
  }
}
function syncSettings() {
  $("sound-setting").checked = sound;
  $("motion-setting").checked = reduced;
  $("rain-setting").checked = rain;
  document.documentElement.classList.toggle("reduced-motion", reduced);
}
function renderPause() {
  const stopped = effectivePause();
  $("app").classList.toggle("paused", stopped);
  $("pause-button").setAttribute("aria-pressed", String(paused));
  $("pause-button").setAttribute("aria-label", paused ? "Resume animation" : "Pause animation");
  $("pause-button").title = paused ? "Resume · P" : "Pause · P";
  $("pause-button").innerHTML = paused
    ? '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
}
function selectWorld(id, { feedback = true, reveal = false } = {}) {
  if (!Number.isInteger(id) || id < 0 || id >= worlds.length) return;
  selected = id;
  const w = worlds[id];
  $("service-tag").textContent = `0${id + 1} / ${w.type}`;
  $("service-title").textContent = w.name;
  $("service-description").textContent = w.info;
  $("service-trigger").textContent = w.trigger;
  $("service-focus").textContent = w.focus;
  $("service-code").textContent = w.code;
  $("service-control").classList.toggle("has-specialism", Boolean(w.detail));
  $("service-specialism").hidden = !w.detail;
  $("specialism-title").textContent = w.detailTitle || "";
  $("specialism-description").textContent = w.detail || "";
  $("service-technologies").replaceChildren(
    ...(w.technologies || []).map((text) => {
      const chip = document.createElement("span");
      chip.textContent = text;
      return chip;
    }),
  );
  const reference = $("service-reference");
  reference.hidden = !w.reference;
  if (w.reference) {
    reference.href = w.reference;
    reference.textContent = w.referenceLabel + " ↗";
  } else reference.removeAttribute("href");
  $("service-deliverables").replaceChildren(
    ...w.deliverables.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  document.querySelectorAll(".world-button").forEach((b, i) => {
    b.classList.toggle("active", i === id);
    b.setAttribute("aria-pressed", String(i === id));
  });
  document
    .querySelectorAll(".world-label")
    .forEach((b, i) => b.classList.toggle("selected", i === id));
  if (feedback) playTone(360 + id * 80, 0.07);
  sceneApi?.select(id);
  if (feedback) openPreview(id, reveal);
  renderBrief();
}
$("shortcut-last").textContent = String(worlds.length);
$("universe").setAttribute(
  "aria-label",
  `Interactive service map. Drag to orbit. Select an object to preview a service, use keys 1 to ${worlds.length} while focused here, or open Explore services.`,
);
worlds.forEach((w, id) => {
  const b = document.createElement("button");
  b.className = "world-button";
  b.setAttribute("aria-pressed", String(id === 0));
  b.setAttribute("aria-label", `${id + 1}. ${w.name}, ${w.type.toLowerCase()}`);
  b.innerHTML = `<span class="num" aria-hidden="true">0${id + 1}</span><span><strong>${w.name}</strong><small>${w.short}</small></span><span class="state-dot" aria-hidden="true"></span>`;
  b.addEventListener("click", () => selectWorld(id, { reveal: true }));
  $("world-list").append(b);
  const label = document.createElement("div");
  label.className = "world-label";
  label.textContent = w.mapLabel || w.name;
  $("world-labels").append(label);
});
const holograms = makeHolograms({
  panel: $("holograms"),
  toggle: $("hologram-toggle"),
  status: $("hologram-status"),
  services: worlds,
  onDetails: showService,
  onScope: (id) => setService(id, !brief.has(id)),
  inBrief: (id) => brief.has(id),
});
const servicesPanel = makeCollapsiblePanel({
  container: $("services-panel"),
  closeButton: $("services-toggle"),
  content: $("services-content"),
  triggers: [$("hero-services"), $("nav-service")],
  fallbackFocus: $("hero-services"),
});
const overviewPanel = makeCollapsiblePanel({
  container: $("service-control"),
  closeButton: $("overview-toggle"),
  content: $("overview-content"),
  fallbackFocus: $("hologram-toggle"),
});
function scrollToSection(id) {
  $(id).scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}
function openPreview(id, reveal) {
  holograms.open(id, { focus: reveal });
  if (reveal) scrollToSection("holograms");
}
function toggleHolograms() {
  if (holograms.isOpen()) holograms.close();
  else openPreview(selected, true);
}
$("hologram-toggle").addEventListener("click", toggleHolograms);
function syncBriefNotes() {
  const notes = normalizeNotes($("brief-notes").value);
  if ($("brief-notes").value !== notes) $("brief-notes").value = notes;
  $("notes-count").textContent = `${notes.length} / 1,200`;
}
function setMapAvailable(available) {
  sceneAvailable = available;
  $("map-stage").classList.toggle("map-unavailable", !available);
  $("fallback").hidden = available;
  $("world-labels").hidden = !available;
  $("universe").tabIndex = available ? 0 : -1;
  for (const id of ["zoom-in", "zoom-out", "recenter", "pause-button"]) $(id).disabled = !available;
  $("map-gesture-hint").textContent = available
    ? "Drag to orbit · Tap an object to explore"
    : "Explore the service list";
  $("render-status").textContent = available ? "3D SERVICE MAP" : "SERVICE LIST MODE";
}

function renderBrief() {
  holograms.syncBrief();
  const ids = worlds.map((_, id) => id).filter((id) => brief.has(id));
  $("nav-brief-count").textContent = String(brief.size);
  $("nav-brief-count").hidden = !brief.size;
  $("nav-brief").setAttribute(
    "aria-label",
    brief.size ? `Review project brief, ${brief.size} selected` : "Review project brief",
  );
  $("brief-summary").textContent = brief.size
    ? `${brief.size} service ${brief.size === 1 ? "area" : "areas"} selected. Review your brief and tell us what you need.`
    : "Add the services you need, or describe your project in the brief.";
  $("brief-chips").replaceChildren(
    ...ids.map((id) => {
      const span = document.createElement("span");
      span.className = "brief-chip";
      span.textContent = worlds[id].name;
      return span;
    }),
  );
  document
    .querySelectorAll(".world-button")
    .forEach((b, i) => b.classList.toggle("in-brief", brief.has(i)));
  document
    .querySelectorAll(".world-label")
    .forEach((b, i) => b.classList.toggle("in-brief", brief.has(i)));
  $("brief-items").replaceChildren(
    ...ids.map((id) => {
      const row = document.createElement("div");
      row.className = "brief-item";
      const name = document.createElement("strong");
      name.textContent = worlds[id].name;
      const remove = document.createElement("button");
      remove.textContent = "Remove ×";
      remove.setAttribute("aria-label", `Remove ${worlds[id].name} from brief`);
      remove.addEventListener("click", () => {
        setService(id, false);
        $("brief-notes").focus();
      });
      row.append(name, remove);
      return row;
    }),
  );
  if (!ids.length) {
    const empty = document.createElement("p");
    empty.className = "brief-empty";
    empty.textContent =
      "Not sure which services you need? Describe your project below and I can help clarify the scope.";
    $("brief-items").append(empty);
  }
  syncBriefNotes();
}
function setService(id, include) {
  brief = updateBrief(brief, id, include);
  renderBrief();
  const message = `${worlds[id].name} ${include ? "added to" : "removed from"} your brief.`;
  toast(message);
  playTone(include ? 700 : 320, 0.12);
}
function toggleService() {
  setService(selected, !brief.has(selected));
}
function explore() {
  sceneApi?.jump(selected);
  scanFxUntil = elapsed + 1.2;
  showService();
}
function showCatalog() {
  servicesPanel.open();
  scrollToSection("services-panel");
  $("catalog-title").focus({ preventScroll: true });
}
function showService() {
  overviewPanel.open();
  scrollToSection("service-control");
  $("service-control").focus({ preventScroll: true });
}
function togglePause() {
  if (!sceneAvailable) return;
  paused = !paused;
  lastTime = performance.now();
  renderPause();
  toast(
    paused ? "Map animation paused. Service controls remain available." : "Map animation resumed.",
  );
}
function openDialog(id) {
  if (document.querySelector("dialog[open]")) return;
  if (id === "brief-dialog") {
    renderBrief();
    $("brief-status").textContent = "";
  }
  dialogOpeners.set($(id), document.activeElement);
  dialogPaused = true;
  $(id).showModal();
  renderPause();
}
function recenter() {
  if (!sceneAvailable) return;
  sceneApi.reset();
  toast("Camera recentered on your product.");
}
$("pause-button").addEventListener("click", togglePause);
$("recenter").addEventListener("click", recenter);
$("zoom-in").addEventListener("click", () => sceneApi?.zoom(-3));
$("zoom-out").addEventListener("click", () => sceneApi?.zoom(3));
$("hint-help").addEventListener("click", () => openDialog("help-dialog"));
$("mobile-settings").addEventListener("click", () => {
  openDialog("settings-dialog");
});
for (const id of ["nav-brief", "review-button"])
  $(id).addEventListener("click", () => openDialog("brief-dialog"));
$("hero-brief").addEventListener("click", () => {
  openDialog("brief-dialog");
  $("brief-notes").focus();
});
const brandLink = $("nav-map");
// The hosted standalone copy lives at / and also works when opened from disk.
if (window.location.pathname === "/starworld.html" && /^https?:$/.test(window.location.protocol)) {
  brandLink.href = "/home/";
  brandLink.setAttribute("aria-label", "LEVNAT light homepage");
  brandLink.querySelector("span").textContent = "LEVNAT";
  $("map-signature").hidden = true;
  $("site-services").hidden = false;
  $("site-contact").hidden = false;
  $("device-theme-link").hidden = false;
  const context = new URLSearchParams(window.location.search);
  const light = context.get("theme") === "light";
  const galaxyLinks = [$("nav-galaxy"), $("site-galaxy")];
  for (const link of galaxyLinks) link.href = light ? "/home/" : "/explore.html";
  const layout = context.get("layout");
  if (layout === "atom" || layout === "planets") {
    const focus = context.get("focus");
    const siteLinks = [brandLink, $("site-services"), $("site-contact"), $("device-theme-link")];
    for (const link of [...galaxyLinks, ...siteLinks]) {
      const destination = new URL(link.href);
      destination.searchParams.set("layout", layout);
      if (focus) destination.searchParams.set("focus", focus);
      if (light && destination.pathname !== "/") destination.searchParams.set("theme", "light");
      link.href = destination.pathname + destination.search;
    }
  }
} else {
  brandLink.addEventListener("click", (event) => {
    event.preventDefault();
    recenter();
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  });
}
for (const id of ["nav-service", "hero-services"]) $(id).addEventListener("click", showCatalog);
$("guide-services").addEventListener("click", () => {
  const guide = $("help-dialog");
  guide.addEventListener("close", showCatalog, { once: true });
  guide.close();
});
$("skip-service").addEventListener("click", (event) => {
  event.preventDefault();
  showService();
});
$("sound-setting").addEventListener("change", (e) => {
  sound = e.target.checked;
  syncSettings();
  playTone();
});
$("motion-setting").addEventListener("change", (e) => {
  reduced = e.target.checked;
  syncSettings();
});
$("rain-setting").addEventListener("change", (e) => {
  rain = e.target.checked;
  syncSettings();
});
$("settings-help").addEventListener("click", () => {
  $("settings-dialog").close();
  openDialog("help-dialog");
});
$("brief-notes").addEventListener("input", syncBriefNotes);
if (window.location.protocol === "https:") {
  import("/src/shared/secure-inquiry.js?v=pqc1")
    .then(({ bindSecureInquiry }) =>
      bindSecureInquiry($("brief-form"), {
        read: () => createBriefInquiry(brief, $("brief-notes").value, $("brief-email").value),
        status: $("brief-submit-status"),
        onSuccess: () => {
          $("brief-form").reset();
          brief = new Set();
          renderBrief();
        },
      }),
    )
    .catch(() => {
      $("brief-submit-status").textContent = "Protected submission is unavailable on this page.";
    });
}
motionPreference.addEventListener("change", (event) => {
  reduced = event.matches;
  syncSettings();
});
$("download-brief").addEventListener("click", () => {
  const blob = new Blob([createBriefText(brief, $("brief-notes").value)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "software-project-brief.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast("Your brief is ready to save.");
});
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...dialog.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener("close", () => {
    dialogPaused = Boolean(document.querySelector("dialog[open]"));
    lastTime = performance.now();
    renderPause();
    if (!dialogPaused) {
      const opener = dialogOpeners.get(dialog);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
  });
  dialog
    .querySelectorAll("[data-close]")
    .forEach((b) => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close();
    }
  });
}
document.addEventListener("visibilitychange", () => {
  backgroundPaused = document.hidden;
  lastTime = performance.now();
  renderPause();
});
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.target.closest('input,textarea,select,[contenteditable="true"]') ||
    document.querySelector("dialog[open]")
  )
    return;
  if (!e.target.closest("#main-content")) return;
  const k = e.key.toLowerCase();
  if (k === "escape" && e.target.closest("#scene-controls[open]")) {
    e.preventDefault();
    $("scene-controls").open = false;
    $("scene-controls").querySelector("summary").focus();
    return;
  }
  if (k === "escape" && servicesPanel.isOpen() && e.target.closest("#services-panel")) {
    e.preventDefault();
    servicesPanel.close();
    return;
  }
  if (k === "escape" && overviewPanel.isOpen() && e.target.closest("#service-control")) {
    e.preventDefault();
    overviewPanel.close();
    return;
  }
  if (k === "escape" && holograms.isOpen()) {
    e.preventDefault();
    holograms.close();
    return;
  }
  if (!e.target.closest("#scene-viewport,#services-panel,#holograms,#service-control")) return;
  if (/^[1-9]$/.test(k) && Number(k) <= worlds.length) {
    e.preventDefault();
    selectWorld(Number(k) - 1, { reveal: true });
    return;
  }
  if (!sceneAvailable && ["p", "r", "+", "=", "-"].includes(k)) return;
  const actions = {
    h: toggleHolograms,
    e: explore,
    a: toggleService,
    b: () => openDialog("brief-dialog"),
    p: togglePause,
    r: recenter,
    "+": () => sceneApi?.zoom(-3),
    "=": () => sceneApi?.zoom(-3),
    "-": () => sceneApi?.zoom(3),
    "?": () => openDialog("help-dialog"),
  };
  if (actions[k]) {
    e.preventDefault();
    actions[k]();
  }
});

try {
  sceneApi = makeScene();
  setMapAvailable(true);
} catch (error) {
  console.warn("Service map: using list fallback.", error.message);
  setMapAvailable(false);
}
syncSettings();
selectWorld(0, { feedback: false });
renderPause();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(0, now - lastTime), 250);
  lastTime = now;
  if (document.hidden) return;
  const suspended = effectivePause();
  if (!suspended) elapsed += dt / 1000;
  const interval = reduced || suspended ? 1000 / 15 : 1000 / 45;
  if (now - lastRendered >= interval) {
    const renderDt = Math.min(0.12, (now - lastRendered) / 1000);
    lastRendered = now;
    sceneApi?.update(renderDt, elapsed);
  }
}
requestAnimationFrame(frame);
// Optional tools expose service choices. Inquiry fields stay in the form.
const modelContext = document.modelContext || navigator.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const snapshot = () => ({
    selected: worlds[selected].name,
    services: worlds.map((w, id) => ({ id, name: w.name, inBrief: brief.has(id) })),
    brief: createBriefText(brief),
  });
  const register = (tool) => {
    try {
      void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {}
  };
  register({
    name: "inspect_software_services",
    description: "Read software services and the current service selections.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => snapshot(),
  });
  register({
    name: "configure_project_brief",
    description: "Select a service or add/remove it from the local project brief.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["select", "add", "remove"] },
        serviceId: { type: "integer", minimum: 0, maximum: worlds.length - 1 },
      },
      required: ["action", "serviceId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      if (
        !input ||
        !["select", "add", "remove"].includes(input.action) ||
        !Number.isInteger(input.serviceId) ||
        input.serviceId < 0 ||
        input.serviceId >= worlds.length
      )
        throw new Error(
          `Choose select, add or remove and a serviceId from 0 to ${worlds.length - 1}.`,
        );
      if (input.action === "select") selectWorld(input.serviceId);
      else setService(input.serviceId, input.action === "add");
      return snapshot();
    },
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) lifecycle.abort();
  });
}
