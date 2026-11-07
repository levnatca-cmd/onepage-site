// UI state, event handlers, preferences, and optional local agent tools.
const $ = (id) => document.getElementById(id);
let brief = new Set(),
  selected = 0,
  paused = false,
  sound = false,
  rain = true;
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = motionPreference.matches;
let sceneApi = null,
  audioContext = null,
  lastTime = performance.now(),
  lastRendered = 0,
  elapsed = 0,
  toastTimer,
  scanFxUntil = 0,
  jumpFxUntil = 0;
let backgroundPaused = document.hidden,
  dialogPaused = false,
  sceneAvailable = false;
const dialogOpeners = new WeakMap();
const draftKey = "systems-project-brief:v1";
let draftStorage = true;
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
  if (saved && Array.isArray(saved.services)) {
    brief = new Set(
      saved.services.filter((id) => Number.isInteger(id) && id >= 0 && id < worlds.length),
    );
    $("brief-notes").value = normalizeNotes(typeof saved.notes === "string" ? saved.notes : "");
  }
} catch {
  draftStorage = false;
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
  $("sound-button").setAttribute("aria-pressed", String(sound));
  $("sound-button").setAttribute("aria-label", sound ? "Mute sound" : "Enable sound");
  $("sound-button").title = sound ? "Mute sound" : "Enable sound";
  $("sound-button").style.color = sound ? "var(--accent)" : "";
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
function selectWorld(id, { feedback = true } = {}) {
  if (!Number.isInteger(id) || id < 0 || id >= worlds.length) return;
  selected = id;
  const w = worlds[id];
  $("selected-name").textContent = w.name;
  $("selected-meta").textContent = w.type;
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
  document.querySelector(".art-label").textContent = `SERVICE // ${w.code}`;
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
  renderBrief();
}
$("service-count").textContent = `${worlds.length} SERVICE AREAS`;
$("service-count-badge").textContent = `[ ${String(worlds.length).padStart(2, "0")} ]`;
$("shortcut-last").textContent = String(worlds.length);
$("universe").setAttribute(
  "aria-label",
  `Interactive service map. Drag to orbit. Select a service with 1 to ${worlds.length} while focused here, or use the service list.`,
);
worlds.forEach((w, id) => {
  const b = document.createElement("button");
  b.className = "world-button";
  b.setAttribute("aria-pressed", String(id === 0));
  b.setAttribute("aria-label", `${id + 1}. ${w.name}, ${w.type.toLowerCase()}`);
  b.innerHTML = `<span class="num">0${id + 1}</span><span><strong>${w.name}</strong><small>${w.code} · ${w.short}</small></span><span class="state-dot"></span>`;
  b.addEventListener("click", () => selectWorld(id));
  $("world-list").append(b);
  const label = document.createElement("div");
  label.className = "world-label";
  label.innerHTML = `${(w.mapLabel || w.name).toUpperCase()}<b>${w.code} / ${w.short.toUpperCase()}</b>`;
  $("world-labels").append(label);
});
function syncDraft() {
  const notes = normalizeNotes($("brief-notes").value);
  if ($("brief-notes").value !== notes) $("brief-notes").value = notes;
  $("email-draft").href = createMailto(brief, notes);
  $("notes-count").textContent = `${notes.length} / 1,200`;
  try {
    sessionStorage.setItem(draftKey, JSON.stringify({ services: [...brief], notes }));
    draftStorage = true;
  } catch {
    draftStorage = false;
  }
  $("draft-save-status").textContent = draftStorage
    ? "Saved in this tab, including after refresh."
    : "Kept on this page. Save a copy before refreshing.";
}
function setMapAvailable(available) {
  sceneAvailable = available;
  $("map-stage").classList.toggle("map-unavailable", !available);
  $("fallback").hidden = available;
  $("world-labels").hidden = !available;
  $("universe").tabIndex = available ? 0 : -1;
  for (const id of ["zoom-in", "zoom-out", "recenter", "pause-button"]) $(id).disabled = !available;
  $("map-gesture-hint").textContent = available
    ? "DRAG TO ORBIT · + / − TO ZOOM"
    : "SELECT A SERVICE FROM THE LIST";
  $("render-status").textContent = available ? "3D SERVICE MAP" : "SERVICE LIST MODE";
}

function renderBrief() {
  const ids = worlds.map((_, id) => id).filter((id) => brief.has(id));
  $("nav-brief-count").textContent = String(brief.size);
  $("add-button").querySelector("span").textContent = brief.has(selected)
    ? "Remove from brief"
    : "Add to brief";
  $("add-button").setAttribute("aria-pressed", String(brief.has(selected)));
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
  syncDraft();
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
  $("map-stage").classList.remove("scanning");
  void $("map-stage").offsetWidth;
  $("map-stage").classList.add("scanning");
  showService();
}
function showService() {
  $("service-control").scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
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
$("explore-button").addEventListener("click", explore);
$("add-button").addEventListener("click", toggleService);
$("pause-button").addEventListener("click", togglePause);
$("recenter").addEventListener("click", recenter);
$("zoom-in").addEventListener("click", () => sceneApi?.zoom(-3));
$("zoom-out").addEventListener("click", () => sceneApi?.zoom(3));
for (const id of ["help-button", "hint-help"])
  $(id).addEventListener("click", () => openDialog("help-dialog"));
for (const id of ["settings-button", "mobile-settings"])
  $(id).addEventListener("click", () => openDialog("settings-dialog"));
for (const id of ["nav-brief", "rail-brief", "review-button"])
  $(id).addEventListener("click", () => openDialog("brief-dialog"));
for (const id of ["nav-map", "rail-map"])
  $(id).addEventListener("click", () => {
    recenter();
    $("map-stage").scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  });
for (const id of ["nav-service", "rail-service"]) $(id).addEventListener("click", showService);
$("sound-button").addEventListener("click", () => {
  sound = !sound;
  syncSettings();
  playTone();
  toast(sound ? "Sound enabled." : "Sound muted.");
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
$("brief-notes").addEventListener("input", syncDraft);
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
  if (!e.target.closest("#main-content,#service-control,.rail")) return;
  const k = e.key.toLowerCase();
  if (/^[1-9]$/.test(k) && Number(k) <= worlds.length) {
    e.preventDefault();
    selectWorld(Number(k) - 1);
    $("world-list").children[Number(k) - 1].focus();
    return;
  }
  if (!sceneAvailable && ["p", "r", "+", "=", "-"].includes(k)) return;
  const actions = {
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
  if (elapsed >= scanFxUntil) $("map-stage").classList.remove("scanning");
  const interval = reduced || suspended ? 1000 / 15 : 1000 / 45;
  if (now - lastRendered >= interval) {
    const renderDt = Math.min(0.12, (now - lastRendered) / 1000);
    lastRendered = now;
    sceneApi?.update(renderDt, elapsed);
  }
}
requestAnimationFrame(frame);
// Optional tools prepare the same local brief as the visible interface; no transmission.
const modelContext = document.modelContext || navigator.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const snapshot = () => ({
    selected: worlds[selected].name,
    services: worlds.map((w, id) => ({ id, name: w.name, inBrief: brief.has(id) })),
    brief: createBriefText(brief, $("brief-notes").value),
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
    description: "Read software services, selected service and the local project brief.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => snapshot(),
  });
  register({
    name: "configure_project_brief",
    description:
      "Select a service or add/remove it from the local project brief. Does not open email or send anything.",
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
