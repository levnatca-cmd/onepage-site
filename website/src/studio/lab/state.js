export const LAB_MODES = ["build", "connect", "care"];
export const LAB_SLOTS = ["09:00", "11:00", "14:00"];
export const LAB_THEMES = {
  cobalt: { label: "Cobalt", color: "#4261f2" },
  citrus: { label: "Citrus", color: "#c4f563" },
  rose: { label: "Rose", color: "#efbdd6" },
};
const faults = ["api", "device"];
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const validTheme = (value) => (Object.hasOwn(LAB_THEMES, value) ? value : "cobalt");

export function createLabState(config = {}) {
  return {
    mode: LAB_MODES.includes(config?.mode) ? config.mode : "build",
    theme: validTheme(config?.theme),
    built: false,
    connected: false,
    fault: null,
    records: [],
    events: [],
    nextId: 1,
    sequence: 0,
    result: { ok: true, message: "A product starts with one working idea." },
  };
}

function event(state, code, message, level = "info", requestId = null) {
  state.sequence += 1;
  state.events = [
    ...state.events,
    { sequence: state.sequence, code, message, level, requestId },
  ].slice(-30);
  state.result = { ok: level !== "error", message };
}

function deliverPending(state, replay = false) {
  if (!state.connected || state.fault) return;
  state.records = state.records.map((record) => {
    if (record.status === "delivered") return record;
    event(
      state,
      replay ? "REQUEST_REPLAYED" : "REQUEST_DELIVERED",
      `${record.id} delivered to the sample workspace.`,
      "success",
      record.id,
    );
    return { ...record, status: "delivered", deliveries: 1 };
  });
}

export function reduceLab(state, action = {}) {
  if (!state || !Array.isArray(state.records)) state = createLabState();
  if (!action || typeof action !== "object") return state;
  const next = {
    ...state,
    records: [...state.records],
    events: [...state.events],
    result: { ...state.result },
  };
  switch (action.type) {
    case "SELECT_MODE":
      if (!LAB_MODES.includes(action.mode)) return state;
      next.mode = action.mode;
      return next;
    case "SET_THEME":
      if (!Object.hasOwn(LAB_THEMES, action.theme)) return state;
      next.theme = action.theme;
      return next;
    case "BUILD":
      if (next.built) return state;
      next.built = true;
      event(next, "APP_BUILT", "Daybook is built. Booking requests are enabled.", "success");
      return next;
    case "CONNECT":
      if (!next.built || next.connected) return state;
      next.connected = true;
      event(next, "API_CONNECTED", "The local API route is connected.", "success");
      deliverPending(next);
      return next;
    case "DISCONNECT":
      if (!next.connected) return state;
      next.connected = false;
      event(
        next,
        "API_DISCONNECTED",
        "API disconnected. New requests remain in the queue.",
        "warning",
      );
      return next;
    case "BOOK": {
      if (!next.built) {
        event(next, "APP_NOT_BUILT", "Build the app before creating a request.", "error");
        return next;
      }
      const rawName = typeof action.name === "string" ? action.name : "";
      const name = decoder.decode(encoder.encode(rawName)).normalize("NFC").trim();
      if (
        Array.from(name).length < 2 ||
        Array.from(name).length > 40 ||
        !LAB_SLOTS.includes(action.slot) ||
        typeof action.key !== "string" ||
        !/^[a-zA-Z0-9:_-]{1,64}$/.test(action.key)
      ) {
        event(
          next,
          "VALIDATION_FAILED",
          "A name of 2-40 characters and an available time are required.",
          "error",
        );
        return next;
      }
      if (next.records.some((record) => record.key === action.key)) return state;
      if (next.records.some((record) => record.slot === action.slot)) {
        event(next, "SLOT_RESERVED", `${action.slot} is already reserved in this sample.`, "error");
        return next;
      }
      const record = {
        id: `B${String(next.nextId).padStart(2, "0")}`,
        key: action.key,
        name,
        slot: action.slot,
        status: "queued",
        deliveries: 0,
      };
      next.nextId += 1;
      next.records.push(record);
      event(next, "REQUEST_QUEUED", `${record.id} received for ${record.slot}.`, "info", record.id);
      deliverPending(next);
      if (!next.connected || next.fault) {
        const reason =
          next.fault === "device"
            ? "notification device offline"
            : next.fault === "api"
              ? "API timeout"
              : "API not connected";
        event(next, "REQUEST_HELD", `${record.id} queued: ${reason}.`, "warning", record.id);
      }
      return next;
    }
    case "FAIL":
      if (!next.built || !next.connected || next.fault || !faults.includes(action.fault))
        return state;
      next.fault = action.fault;
      event(
        next,
        action.fault === "api" ? "API_TIMEOUT" : "DEVICE_OFFLINE",
        action.fault === "api"
          ? "Simulated API timeout. Requests are held safely."
          : "Sample notification device is offline. Delivery is paused.",
        "error",
      );
      return next;
    case "REPAIR":
      if (!next.fault) return state;
      next.fault = null;
      next.connected = true;
      event(
        next,
        "SYSTEM_REPAIRED",
        "Connection restored. Pending requests are replayed once.",
        "success",
      );
      deliverPending(next, true);
      return next;
    case "RESET":
      return createLabState({ theme: next.theme });
    default:
      return state;
  }
}

export function deriveLab(state) {
  const pending = state.records.filter((record) => record.status === "queued").length;
  const delivered = state.records.length - pending;
  const status = !state.built
    ? "unbuilt"
    : state.fault
      ? "fault"
      : !state.connected
        ? "offline"
        : "online";
  return {
    pending,
    delivered,
    requests: state.records.length,
    status,
    availableSlots: LAB_SLOTS.filter(
      (slot) => !state.records.some((record) => record.slot === slot),
    ),
    nodes: {
      app: state.built ? "online" : "idle",
      api: state.fault === "api" ? "fault" : state.connected ? "online" : "idle",
      device:
        state.fault === "device" ? "fault" : state.connected && !state.fault ? "online" : "idle",
    },
  };
}

export function publicLabConfig(state) {
  const mode = LAB_MODES.includes(state?.mode) ? state.mode : "build";
  const built = state?.built === true;
  const records = Array.isArray(state?.records) ? state.records : [];
  return {
    lab: "1",
    mode,
    theme: validTheme(state?.theme),
    built: built ? "1" : "0",
    api: built && state?.connected === true ? "1" : "0",
    fault: built && faults.includes(state?.fault) ? state.fault : "none",
    sample:
      built && records.some((record) => record.status === "queued")
        ? "queued"
        : built && records.length
          ? "delivered"
          : "none",
  };
}

export function serializeLabConfig(state) {
  return new URLSearchParams(publicLabConfig(state)).toString();
}

export function restoreLabConfig(value) {
  let config;
  if (value instanceof URLSearchParams) config = Object.fromEntries(value);
  else if (typeof value === "string") {
    try {
      config = Object.fromEntries(new URL(value, "https://levnat.ca/").searchParams);
    } catch {
      config = {};
    }
    if (!value.includes("?") && !value.includes("://"))
      config = Object.fromEntries(new URLSearchParams(value.slice(0, 1500)));
  } else config = value && typeof value === "object" ? value : {};
  if (config.lab !== "1") return createLabState();
  let state = createLabState({ mode: config.mode, theme: config.theme });
  if (config.built !== "1") return state;
  state = reduceLab(state, { type: "BUILD" });
  if (
    config.api === "1" ||
    (config.fault !== "none" && faults.includes(config.fault)) ||
    config.sample === "delivered"
  )
    state = reduceLab(state, { type: "CONNECT" });
  if (config.sample === "delivered")
    state = reduceLab(state, {
      type: "BOOK",
      name: "Sample guest",
      slot: LAB_SLOTS[0],
      key: "shared:sample",
    });
  if (faults.includes(config.fault))
    state = reduceLab(state, { type: "FAIL", fault: config.fault });
  if (config.api !== "1") state = reduceLab(state, { type: "DISCONNECT" });
  if (config.sample === "queued")
    state = reduceLab(state, {
      type: "BOOK",
      name: "Sample guest",
      slot: LAB_SLOTS[0],
      key: "shared:sample",
    });
  return reduceLab(state, { type: "SELECT_MODE", mode: config.mode });
}
