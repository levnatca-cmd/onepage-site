import {
  DRAFT_KEY,
  SERVICE_LABELS,
  sanitizeInquiry,
  buildInquiry,
  inquiryMailto,
} from "./inquiry.js";
import { refreshIcons } from "./icons.js";
import { initSystemLab } from "./lab/controller.js";

refreshIcons();

const menu = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("#primary-navigation");
function closeMenu({ focus = false } = {}) {
  document.body.removeAttribute("data-menu-open");
  menu?.setAttribute("aria-expanded", "false");
  menu?.setAttribute("aria-label", "Open menu");
  if (focus) menu?.focus();
}
menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.body.toggleAttribute("data-menu-open", open);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu?.getAttribute("aria-expanded") === "true")
    closeMenu({ focus: true });
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
nav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
matchMedia("(min-width: 769px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

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
  const emailLink = document.querySelector("#email-draft-link");
  const read = () => sanitizeInquiry(Object.fromEntries(new FormData(form)));
  const notice = (message) => {
    status.textContent = message;
  };
  function restore(draft) {
    for (const [name, value] of Object.entries(sanitizeInquiry(draft))) {
      if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    }
  }
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      restore(JSON.parse(saved));
      notice("Your draft was restored from this browser.");
    }
  } catch {
    notice("Browser storage is unavailable. Your draft will not be saved.");
  }
  const selected = new URLSearchParams(location.search).get("service");
  if (Object.hasOwn(SERVICE_LABELS, selected)) form.elements.service.value = selected;
  const save = () => {
    emailLink.hidden = true;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(read()));
      notice("Draft saved in this browser only.");
    } catch {
      notice("Draft not saved. You can still copy or download your inquiry.");
    }
  };
  if (selected && Object.hasOwn(SERVICE_LABELS, selected)) {
    save();
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("service");
    history.replaceState(history.state, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
  form.addEventListener("input", save);
  form.addEventListener("change", save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    emailLink.href = inquiryMailto(read());
    emailLink.hidden = false;
    notice(
      "Your draft is ready. Continue to your email app to review and send it. Nothing has been sent.",
    );
    emailLink.focus();
  });
  document.querySelector("[data-copy-inquiry]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(buildInquiry(read()));
      notice("Inquiry copied. Paste it into an email to info@levnat.ca.");
    } catch {
      notice("Copy unavailable. Download the inquiry or email info@levnat.ca directly.");
    }
  });
  document.querySelector("[data-download-inquiry]")?.addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([buildInquiry(read())], { type: "text/plain;charset=utf-8" }),
    );
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: "levnat-project-inquiry.txt",
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Inquiry downloaded. No message has been sent.");
  });
  document.querySelector("[data-clear-draft]")?.addEventListener("click", () => {
    form.reset();
    restore({});
    emailLink.hidden = true;
    try {
      localStorage.removeItem(DRAFT_KEY);
      notice("Draft cleared from this browser.");
    } catch {
      notice("Form cleared. Browser storage is unavailable.");
    }
    form.elements.description.focus();
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
