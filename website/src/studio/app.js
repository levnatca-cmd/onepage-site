import { DRAFT_KEY, SERVICE_LABELS, sanitizeInquiry } from "./inquiry.js";
import { bindSecureInquiry } from "/src/shared/secure-inquiry.js?v=pqc1";
import { refreshIcons } from "./icons.js";
import { initSystemLab } from "./lab/controller.js";

refreshIcons();

if (document.body.hasAttribute("data-galaxy-service")) {
  import("./galaxy-arrival.js?v=wow63")
    .then(({ initGalaxyArrival }) => initGalaxyArrival())
    .catch(() => document.documentElement.classList.remove("galaxy-arriving"));
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-filter]")
      .forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    document.querySelectorAll("[data-category]").forEach((item) => {
      item.hidden =
        button.dataset.filter !== "all" && item.dataset.category !== button.dataset.filter;
    });
  });
});

const requestButton = document.querySelector("[data-demo-request]");
requestButton?.addEventListener("click", () => {
  const list = document.querySelector("[data-demo-requests]");
  const count = document.querySelector("[data-demo-count]");
  const number = Number(count.textContent) + 1;
  count.textContent = String(number);
  const item = document.createElement("li");
  item.innerHTML = `<span>Sample request ${String(number).padStart(2, "0")}</span><span class="status-tag">Queued</span>`;
  list.prepend(item);
  if (list.children.length > 4) list.lastElementChild.remove();
  if (number >= 10) requestButton.disabled = true;
});

const runButton = document.querySelector("[data-demo-run]");
runButton?.addEventListener("click", async () => {
  runButton.disabled = true;
  const stages = [...document.querySelector("[data-demo-pipeline]").children];
  stages.forEach((stage) => {
    stage.dataset.state = "waiting";
  });
  for (const stage of stages) {
    stage.dataset.state = "active";
    await new Promise((resolve) =>
      setTimeout(resolve, matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 360),
    );
    stage.dataset.state = "complete";
  }
  const status = document.querySelector("[data-pipeline-status]");
  if (status) status.textContent = "Sample workflow complete. No external data sent.";
  runButton.disabled = false;
});

const form = document.querySelector("#project-form");
if (form) {
  const status = document.querySelector("#inquiry-status");
  const options = form.closest("details");
  if (location.protocol === "https:") {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        localStorage.removeItem(DRAFT_KEY);
        for (const [name, value] of Object.entries(sanitizeInquiry(JSON.parse(saved)))) {
          if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
        }
        options.open = true;
        status.textContent = "Your previous draft is available for this visit.";
      }
    } catch {
      // Storage can be disabled. The live form remains available.
    }
  }
  const url = new URL(location.href);
  const selected = url.searchParams.get("service");
  if (Object.hasOwn(SERVICE_LABELS, selected)) {
    form.elements.service.value = selected;
    options.open = true;
    url.searchParams.delete("service");
    history.replaceState(history.state, "", url);
  }
  bindSecureInquiry(form, {
    read: () => sanitizeInquiry(Object.fromEntries(new FormData(form))),
    status,
  });
}

const systemLab = initSystemLab();
if (document.querySelector("#engineering-scene")) {
  import("./scene.js?v=living2")
    .then(({ createEngineeringScene }) => createEngineeringScene({ lab: systemLab }))
    .catch(() => {
      document.querySelector("#engineering-scene").dataset.ready = "false";
      document.querySelectorAll("[data-scene-pause]").forEach((button) => {
        button.disabled = true;
      });
    });
}
