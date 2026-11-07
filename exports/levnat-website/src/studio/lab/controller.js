import {
  createLabState,
  reduceLab,
  deriveLab,
  LAB_THEMES,
  LAB_SLOTS,
  serializeLabConfig,
  restoreLabConfig,
} from "./state.js";
import { createBuildCard } from "./card.js";
import { refreshIcons } from "../icons.js";

const modeInfo = {
  build: ["01 / Build", "An idea becomes something usable."],
  connect: ["02 / Connect", "A request needs somewhere to go."],
  care: ["03 / Debug", "Break the route. Keep the request."],
};
const stepLabels = {
  app: { idle: "Not built", online: "Built" },
  api: { idle: "Disconnected", online: "Connected", fault: "Timeout" },
  device: { idle: "Standby", online: "Ready", fault: "Offline" },
};

export function initSystemLab() {
  const root = document.querySelector("[data-system-lab]");
  if (!root) return null;
  let state =
    new URLSearchParams(location.search).get("lab") === "1"
      ? restoreLabConfig(location.search)
      : createLabState();
  let selectedSlot = LAB_SLOTS[0];
  let inspecting = false;
  const listeners = new Set();
  const form = root.querySelector("#lab-booking-form");
  const status = root.querySelector("#lab-status");
  const actionButton = root.querySelector("[data-lab-action]");
  const shareLabel = root.querySelector(".lab-share-fallback");
  const shareField = root.querySelector("#lab-share-link");
  const getState = () => state;
  Object.defineProperty(window, "__systemLab", {
    configurable: true,
    get: () => structuredClone(state),
  });

  function renderList(container, records, renderItem, empty) {
    if (!container) return;
    const nodes = records.map(renderItem);
    if (!nodes.length) {
      const item = document.createElement("li");
      item.className = "lab-empty";
      item.textContent = empty;
      nodes.push(item);
    }
    container.replaceChildren(...nodes);
  }
  function announce(message, ok = true) {
    status.textContent = message;
    status.dataset.error = String(!ok);
  }
  function render() {
    const derived = deriveLab(state);
    root.dataset.built = String(state.built);
    root.dataset.status = derived.status;
    root.style.setProperty("--lab-accent", LAB_THEMES[state.theme].color);
    document.documentElement.style.setProperty("--system-accent", LAB_THEMES[state.theme].color);
    document.body.dataset.labMode = state.mode;
    document.querySelectorAll("[data-scene-mode]").forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.sceneMode === state.mode));
    });
    root.querySelectorAll("[data-lab-theme]").forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.labTheme === state.theme));
    });
    for (const key of ["requests", "pending", "delivered"])
      root.querySelector(`[data-lab-count="${key}"]`).textContent = String(derived[key]);
    root.querySelector("[data-lab-health]").textContent = {
      unbuilt: "Not built",
      offline: "App ready",
      online: "System live",
      fault: "Fault isolated",
    }[derived.status];
    root.querySelector("[data-lab-build-cover]").hidden = state.built;
    form.querySelector("fieldset").disabled = !state.built;
    if (!derived.availableSlots.includes(selectedSlot))
      selectedSlot = derived.availableSlots[0] || "";
    root.querySelectorAll("[data-lab-slot]").forEach((button) => {
      button.disabled = !state.built || !derived.availableSlots.includes(button.dataset.labSlot);
      button.setAttribute("aria-pressed", String(button.dataset.labSlot === selectedSlot));
    });
    root.querySelector("[data-lab-submit]").disabled = !state.built || !selectedSlot;
    const [step, title] = modeInfo[state.mode];
    root.querySelector("[data-lab-step]").textContent = step;
    root.querySelector("[data-lab-action-title]").textContent = title;
    const panel = root.querySelector(".lab-mode-panel");
    panel.dataset.mode = state.mode;
    root.querySelector("#lab-fault-type").hidden =
      state.mode !== "care" || !state.built || !state.connected || !!state.fault;
    let action = "BUILD",
      label = "Build app",
      symbol = "plus";
    if (state.built && state.mode === "build") {
      action = "VIEW_CONNECTIONS";
      label = "View connections";
      symbol = "arrow-right";
    }
    if (state.built && state.mode === "connect") {
      action = state.connected ? "DISCONNECT" : "CONNECT";
      label = state.connected ? "Disconnect API" : "Connect API";
      symbol = state.connected ? "unplug" : "plug";
    }
    if (state.built && state.mode === "care") {
      action = state.fault ? "REPAIR" : state.connected ? "FAIL" : "CONNECT";
      label = state.fault ? "Repair & replay" : state.connected ? "Simulate outage" : "Connect API";
      symbol = state.fault ? "wrench" : state.connected ? "zap-off" : "plug";
    }
    actionButton.dataset.action = action;
    actionButton.disabled = false;
    actionButton.replaceChildren(document.createTextNode(label + " "));
    const icon = document.createElement("i");
    icon.dataset.lucide = symbol;
    actionButton.append(icon);
    root
      .querySelectorAll("[data-lab-reset], [data-lab-share], [data-lab-download]")
      .forEach((button) => {
        button.disabled = false;
      });
    const inspect = root.querySelector("[data-lab-inspect]");
    inspect.hidden = !state.events.length;
    inspect.setAttribute("aria-expanded", String(inspecting));
    root.querySelector("#lab-inspection").hidden = !inspecting;
    renderList(
      root.querySelector("[data-lab-inspection-events]"),
      [...state.events].reverse().slice(0, 3),
      (entry) => {
        const item = document.createElement("li");
        item.dataset.level = entry.level;
        const code = document.createElement("b");
        code.textContent = entry.code;
        const message = document.createElement("span");
        message.textContent = entry.message;
        item.append(code, message);
        return item;
      },
      "The system is waiting.",
    );
    document.querySelectorAll("[data-lab-node]").forEach((element) => {
      const key = element.dataset.labNode;
      element.dataset.status = derived.nodes[key];
      element.querySelector("b").textContent = stepLabels[key][derived.nodes[key]];
    });
    const queueLabel = document.querySelector("[data-lab-queue-label]");
    if (queueLabel)
      queueLabel.textContent = `${derived.requests} ${derived.requests === 1 ? "record" : "records"}`;
    renderList(
      document.querySelector("[data-lab-records]"),
      [...state.records].reverse(),
      (record) => {
        const item = document.createElement("li");
        item.dataset.recordId = record.id;
        item.dataset.status = record.status;
        const identity = document.createElement("span");
        identity.className = "record-identity";
        const id = document.createElement("b");
        id.textContent = record.id;
        const name = document.createElement("span");
        name.textContent = record.name;
        identity.append(id, name);
        const slot = document.createElement("span");
        slot.className = "record-slot";
        slot.textContent = record.slot;
        const badge = document.createElement("span");
        badge.className = "record-status";
        badge.textContent = record.status === "delivered" ? "Delivered once" : "In queue";
        item.append(identity, slot, badge);
        return item;
      },
      "No sample requests yet.",
    );
    renderList(
      document.querySelector("[data-lab-events]"),
      [...state.events].reverse().slice(0, 6),
      (entry) => {
        const item = document.createElement("li");
        item.dataset.level = entry.level;
        const sequence = document.createElement("span");
        sequence.className = "event-sequence";
        sequence.textContent = String(entry.sequence).padStart(3, "0");
        const body = document.createElement("span");
        const code = document.createElement("b");
        code.textContent = entry.code;
        const detail = document.createElement("span");
        detail.textContent = entry.message;
        body.append(code, detail);
        item.append(sequence, body);
        return item;
      },
      "The system is waiting.",
    );
    const context = document.querySelector("[data-lab-inquiry]");
    if (context)
      context.href = `/contact/?service=${state.mode === "care" ? "support" : state.mode === "connect" ? "integrations" : "websites"}`;
    announce(state.result.message, state.result.ok);
    refreshIcons();
  }
  function dispatch(action) {
    const previous = state;
    state = reduceLab(state, action);
    render();
    for (const listener of listeners) listener(state, action, previous);
    return state;
  }
  document
    .querySelectorAll("[data-scene-mode]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        dispatch({ type: "SELECT_MODE", mode: button.dataset.sceneMode }),
      ),
    );
  root
    .querySelectorAll("[data-lab-theme]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        dispatch({ type: "SET_THEME", theme: button.dataset.labTheme }),
      ),
    );
  root.querySelectorAll("[data-lab-slot]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedSlot = button.dataset.labSlot;
      render();
    }),
  );
  actionButton.addEventListener("click", () => {
    const action = actionButton.dataset.action;
    if (action === "VIEW_CONNECTIONS") dispatch({ type: "SELECT_MODE", mode: "connect" });
    else dispatch({ type: action, fault: root.querySelector("#lab-fault-type").value });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    dispatch({
      type: "BOOK",
      name: form.elements.guest.value,
      slot: selectedSlot,
      key: `request:${state.nextId}`,
    });
  });
  root.querySelector("[data-lab-inspect]").addEventListener("click", () => {
    inspecting = !inspecting;
    render();
  });
  root.querySelector("[data-lab-reset]").addEventListener("click", () => {
    shareLabel.hidden = true;
    selectedSlot = LAB_SLOTS[0];
    inspecting = false;
    form.reset();
    dispatch({ type: "RESET" });
  });
  root.querySelector("[data-lab-share]").addEventListener("click", async () => {
    const url = new URL("/", location.origin);
    url.search = serializeLabConfig(state);
    url.hash = "system-workbench";
    shareField.value = url.href;
    try {
      await navigator.clipboard.writeText(url.href);
      shareLabel.hidden = true;
      announce("Public setup link copied. Guest names and private details are excluded.");
    } catch {
      shareLabel.hidden = false;
      shareField.focus();
      shareField.select();
      announce("Copy is unavailable. The public setup link is ready to select below.", false);
    }
  });
  root.querySelector("[data-lab-download]").addEventListener("click", async () => {
    const canvas = createBuildCard(state);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      announce("Build card unavailable. Your public setup can still be copied.", false);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: "levnat-system-build.png",
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("Build card saved. It contains public configuration only.");
  });
  render();
  return {
    getState,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
