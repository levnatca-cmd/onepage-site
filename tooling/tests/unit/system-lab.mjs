import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFragment } from "parse5";
import { systemWorkbench, systemLedger } from "../../../website/src/studio/lab/view.js";
import { createBuildCard } from "../../../website/src/studio/lab/card.js";
import {
  LAB_MODES,
  LAB_SLOTS,
  LAB_THEMES,
  createLabState,
  reduceLab,
  deriveLab,
  publicLabConfig,
  serializeLabConfig,
  restoreLabConfig,
} from "../../../website/src/studio/lab/state.js";

const publicKeys = ["lab", "mode", "theme", "built", "api", "fault", "sample"];
const privateMarker = "QA_PRIVATE_Caf\u00e9_\u5c71\u7530";
const booking = (index = 0, overrides = {}) => ({
  type: "BOOK",
  name: "Zo\u00eb Moreno",
  slot: LAB_SLOTS[index],
  key: `qa:request-${index}`,
  ...overrides,
});
const run = (...actions) => actions.reduce(reduceLab, createLabState());
const build = () => run({ type: "BUILD" });
const online = () => run({ type: "BUILD" }, { type: "CONNECT" });
const counts = (state) => {
  const { requests, pending, delivered } = deriveLab(state);
  return { requests, pending, delivered };
};
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function invariant(state) {
  assert.ok(LAB_MODES.includes(state.mode));
  assert.ok(Object.hasOwn(LAB_THEMES, state.theme));
  assert.ok([null, "api", "device"].includes(state.fault));
  assert.ok(state.records.length <= LAB_SLOTS.length);
  for (const field of ["id", "key", "slot"])
    assert.equal(new Set(state.records.map((record) => record[field])).size, state.records.length);
  for (const record of state.records) {
    assert.ok(LAB_SLOTS.includes(record.slot));
    assert.ok(["queued", "delivered"].includes(record.status));
    assert.equal(record.deliveries, record.status === "delivered" ? 1 : 0);
    assert.equal(record.name, record.name.normalize("NFC").trim());
    assert.ok(Array.from(record.name).length >= 2 && Array.from(record.name).length <= 40);
  }
  const derived = deriveLab(state);
  assert.equal(derived.requests, state.records.length);
  assert.equal(
    derived.pending,
    state.records.filter((record) => record.status === "queued").length,
  );
  assert.equal(derived.requests, derived.pending + derived.delivered);
  assert.deepEqual(
    derived.availableSlots,
    LAB_SLOTS.filter((slot) => !state.records.some((record) => record.slot === slot)),
  );
  assert.deepEqual(Object.keys(derived.nodes).sort(), ["api", "app", "device"]);
  assert.ok(
    Object.values(derived.nodes).every((value) => ["idle", "online", "fault"].includes(value)),
  );
  assert.ok(["unbuilt", "offline", "online", "fault"].includes(derived.status));
  assert.ok(state.events.length <= 30);
  assert.equal(new Set(state.events.map((event) => event.sequence)).size, state.events.length);
  for (let i = 1; i < state.events.length; i += 1)
    assert.ok(state.events[i].sequence > state.events[i - 1].sequence);
  if (state.events.length) assert.equal(state.events.at(-1).sequence, state.sequence);
}

let passed = 0;
let failed = 0;
function check(name, action) {
  try {
    action();
    passed += 1;
    console.log(`PASS system lab: ${name}`);
  } catch (error) {
    failed += 1;
    process.exitCode = 1;
    console.error(`FAIL system lab: ${name}\n${error.stack}`);
  }
}

check("initial state, fixed slots and selectors are deterministic and independent", () => {
  const first = createLabState();
  const second = createLabState();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.records, second.records);
  assert.notEqual(first.events, second.events);
  assert.deepEqual(LAB_MODES, ["build", "connect", "care"]);
  assert.deepEqual(LAB_SLOTS, ["09:00", "11:00", "14:00"]);
  assert.deepEqual(counts(first), { requests: 0, pending: 0, delivered: 0 });
  assert.equal(deriveLab(first).status, "unbuilt");
  invariant(first);
  for (const mode of LAB_MODES) {
    const selected = reduceLab(first, { type: "SELECT_MODE", mode });
    assert.equal(selected.mode, mode);
    assert.equal(selected.built, false, "Selecting a chapter must not pretend to build the app");
    assert.deepEqual(counts(selected), counts(first));
  }
  for (const theme of Object.keys(LAB_THEMES))
    assert.equal(reduceLab(first, { type: "SET_THEME", theme }).theme, theme);
  for (const value of [null, undefined, {}, [], false, 42, "__proto__", "constructor", "invalid"])
    assert.doesNotThrow(() => invariant(createLabState(value)));
});

check("booking before build is rejected and unconnected requests genuinely queue", () => {
  const rejected = reduceLab(createLabState(), booking());
  assert.equal(rejected.result.ok, false);
  assert.equal(rejected.events.at(-1).code, "APP_NOT_BUILT");
  assert.deepEqual(counts(rejected), { requests: 0, pending: 0, delivered: 0 });
  const queued = reduceLab(build(), booking());
  assert.deepEqual(counts(queued), { requests: 1, pending: 1, delivered: 0 });
  assert.equal(queued.records[0].status, "queued");
  assert.equal(queued.records[0].deliveries, 0);
  assert.equal(deriveLab(queued).status, "offline");
  assert.ok(queued.events.some((event) => event.code === "REQUEST_HELD"));
  const connected = reduceLab(queued, { type: "CONNECT" });
  assert.deepEqual(counts(connected), { requests: 1, pending: 0, delivered: 1 });
  assert.equal(connected.records[0].deliveries, 1);
  assert.equal(deriveLab(connected).status, "online");
  assert.equal(reduceLab(connected, { type: "CONNECT" }), connected);
  assert.equal(
    reduceLab(connected, booking()),
    connected,
    "Retrying a key must not add a second delivery",
  );
  invariant(connected);
});

check("both fault types hold requests and repair replays each record exactly once", () => {
  for (const fault of ["api", "device"]) {
    let state = reduceLab(online(), booking(0));
    const first = structuredClone(state.records[0]);
    state = reduceLab(state, { type: "FAIL", fault });
    assert.equal(state.fault, fault);
    assert.equal(deriveLab(state).status, "fault");
    assert.equal(deriveLab(state).nodes[fault], "fault");
    state = reduceLab(reduceLab(state, booking(1)), booking(2));
    assert.deepEqual(counts(state), { requests: 3, pending: 2, delivered: 1 });
    assert.deepEqual(state.records[0], first);
    state = reduceLab(state, { type: "REPAIR" });
    assert.deepEqual(counts(state), { requests: 3, pending: 0, delivered: 3 });
    assert.deepEqual(state.records[0], first);
    assert.equal(state.fault, null);
    assert.ok(state.records.every((record) => record.deliveries === 1));
    assert.equal(state.events.filter((event) => event.code === "REQUEST_REPLAYED").length, 2);
    const repaired = state;
    for (let i = 0; i < 8; i += 1) state = reduceLab(state, { type: "REPAIR" });
    assert.equal(state, repaired, "Repeated repairs must not emit fictional replays");
    for (const record of state.records) {
      const deliveries = state.events.filter(
        (event) =>
          event.requestId === record.id &&
          ["REQUEST_DELIVERED", "REQUEST_REPLAYED"].includes(event.code),
      );
      assert.equal(deliveries.length, 1, `${fault}: ${record.id} delivered more than once`);
    }
    invariant(state);
  }
});

check(
  "disconnect/reconnect and repair after disconnect never lose or duplicate pending records",
  () => {
    for (const fault of [null, "api", "device"]) {
      let state = online();
      if (fault) state = reduceLab(state, { type: "FAIL", fault });
      state = reduceLab(state, { type: "DISCONNECT" });
      state = reduceLab(state, booking());
      assert.deepEqual(counts(state), { requests: 1, pending: 1, delivered: 0 });
      state = reduceLab(state, { type: "CONNECT" });
      assert.equal(deriveLab(state).pending, fault ? 1 : 0);
      if (fault) state = reduceLab(state, { type: "REPAIR" });
      assert.deepEqual(counts(state), { requests: 1, pending: 0, delivered: 1 });
      invariant(state);
    }
  },
);

check("idempotency keys, unique slot reservations and three-record capacity stay bounded", () => {
  const first = reduceLab(online(), booking());
  const duplicate = reduceLab(first, booking(1, { key: booking().key, name: "Another guest" }));
  assert.equal(duplicate, first, "A reused key must not reserve a different slot");
  const occupied = reduceLab(first, booking(0, { key: "qa:new-key" }));
  assert.deepEqual(occupied.records, first.records);
  assert.equal(occupied.nextId, first.nextId);
  assert.equal(occupied.result.ok, false);
  assert.equal(occupied.events.at(-1).code, "SLOT_RESERVED");
  let full = LAB_SLOTS.reduce((state, slot, index) => reduceLab(state, booking(index)), online());
  assert.deepEqual(counts(full), { requests: 3, pending: 0, delivered: 3 });
  assert.deepEqual(deriveLab(full).availableSlots, []);
  full = reduceLab(full, booking(0, { key: "qa:overflow" }));
  assert.equal(full.records.length, 3);
  assert.equal(full.nextId, 4);
  invariant(full);
});

check("Unicode names normalize safely and enforce code-point rather than UTF-16 limits", () => {
  for (const [raw, expected] of [
    ["  Zoe\u0308 Moreno  ", "Zo\u00eb Moreno"],
    ["\u5c71\u7530", "\u5c71\u7530"],
    ["\ud83d\ude80".repeat(40), "\ud83d\ude80".repeat(40)],
    ["\ud800A", "\ufffdA"],
  ]) {
    const state = reduceLab(build(), booking(0, { name: raw }));
    assert.equal(state.records.length, 1);
    assert.equal(state.records[0].name, expected);
    assert.doesNotThrow(() => encodeURIComponent(state.records[0].name));
    invariant(state);
  }
  for (const name of [
    "",
    " ",
    "A",
    " \u5c71 ",
    "a".repeat(41),
    "\ud83d\ude80".repeat(41),
    null,
    {},
    [],
    42,
  ]) {
    const state = reduceLab(build(), booking(0, { name }));
    assert.equal(state.records.length, 0, `Invalid name was accepted: ${JSON.stringify(name)}`);
    assert.equal(state.result.ok, false);
    assert.equal(state.events.at(-1).code, "VALIDATION_FAILED");
  }
});

check("invalid slots, keys and actions cannot alter reservations or consume IDs", () => {
  for (const slot of [undefined, null, "10:00", "09:00 ", "__proto__", [], {}]) {
    const state = reduceLab(build(), booking(0, { slot }));
    assert.equal(state.records.length, 0);
    assert.equal(state.nextId, 1);
    assert.equal(state.result.ok, false);
  }
  for (const key of [undefined, null, "", "x".repeat(65), "a b", "<script>", "\u5c71", [], {}]) {
    const state = reduceLab(build(), booking(0, { key }));
    assert.equal(state.records.length, 0);
    assert.equal(state.nextId, 1);
    assert.equal(state.result.ok, false);
  }
  for (const key of ["a", "X".repeat(64), "qa:request_01-test"])
    assert.equal(reduceLab(build(), booking(0, { key })).records.length, 1);
  const original = freeze(online());
  for (const action of [
    null,
    undefined,
    false,
    42,
    "BUILD",
    {},
    { type: "__proto__" },
    { type: "SELECT_MODE", mode: "unknown" },
    { type: "SET_THEME", theme: "__proto__" },
    { type: "FAIL", fault: "unknown" },
  ])
    assert.equal(reduceLab(original, action), original);
});

check(
  "every transition is immutable and short action sequences preserve delivery invariants",
  () => {
    const actions = [
      { type: "BUILD" },
      { type: "CONNECT" },
      { type: "DISCONNECT" },
      { type: "FAIL", fault: "api" },
      { type: "FAIL", fault: "device" },
      { type: "REPAIR" },
      { type: "RESET" },
      booking(0),
      booking(1),
      booking(1, { key: booking(0).key }),
      { type: "SELECT_MODE", mode: "care" },
    ];
    let checked = 0;
    function walk(state, depth) {
      if (!depth) return;
      freeze(state);
      const snapshot = JSON.stringify(state);
      for (const action of actions) {
        const next = reduceLab(state, freeze(action));
        assert.equal(JSON.stringify(state), snapshot, `${action.type} mutated the previous state`);
        invariant(next);
        if (action.type !== "RESET")
          for (const record of state.records.filter((item) => item.status === "delivered"))
            assert.deepEqual(
              next.records.find((item) => item.id === record.id),
              record,
              "A terminal delivery changed",
            );
        checked += 1;
        walk(next, depth - 1);
      }
    }
    walk(createLabState(), 4);
    assert.equal(checked, 16104, "All action sequences up to four steps must run");
  },
);

check("event history is bounded and monotonic, and reset clears private runtime state", () => {
  let state = reduceLab(online(), booking(0, { name: privateMarker }));
  state = reduceLab(state, { type: "SET_THEME", theme: "rose" });
  for (let i = 0; i < 50; i += 1) {
    state = reduceLab(state, { type: "FAIL", fault: i % 2 ? "api" : "device" });
    state = reduceLab(state, { type: "REPAIR" });
  }
  assert.equal(state.events.length, 30);
  assert.ok(state.sequence > 30);
  invariant(state);
  const reset = reduceLab(state, { type: "RESET" });
  assert.deepEqual(reset, createLabState({ theme: "rose" }));
  assert.equal(JSON.stringify(reset).includes(privateMarker), false);
});

check(
  "public configuration is an explicit seven-field allowlist, never private runtime state",
  () => {
    let state = reduceLab(online(), booking(0, { name: privateMarker }));
    state = reduceLab(state, { type: "FAIL", fault: "device" });
    state = reduceLab(state, booking(1, { name: "Private Second Guest" }));
    const poisoned = {
      ...state,
      name: privateMarker,
      notes: privateMarker,
      email: "private-qa@example.test",
      logs: [privateMarker],
      events: [...state.events, { message: privateMarker }],
      unexpected: { token: privateMarker },
    };
    const config = publicLabConfig(freeze(poisoned));
    assert.deepEqual(Object.keys(config).sort(), [...publicKeys].sort());
    assert.deepEqual(config, {
      lab: "1",
      mode: "build",
      theme: "cobalt",
      built: "1",
      api: "1",
      fault: "device",
      sample: "queued",
    });
    assert.ok(Object.values(config).every((value) => typeof value === "string"));
    const encoded = serializeLabConfig(poisoned);
    assert.deepEqual(Object.fromEntries(new URLSearchParams(encoded)), config);
    assert.doesNotMatch(
      decodeURIComponent(encoded),
      /QA_PRIVATE|Private Second Guest|private-qa|name|notes|email|logs|events|records|token/i,
    );
    assert.deepEqual(
      restoreLabConfig(encoded).records.map((record) => record.name),
      ["Sample guest"],
    );
    for (const value of [null, undefined, false, 42, "unexpected", [], {}])
      assert.deepEqual(Object.keys(publicLabConfig(value)).sort(), [...publicKeys].sort());
  },
);

check("every reachable public configuration round-trips with one synthetic sample at most", () => {
  const states = [createLabState(), build(), online()];
  for (const fault of [null, "api", "device"]) {
    let state = online();
    if (fault) state = reduceLab(state, { type: "FAIL", fault });
    states.push(state, reduceLab(state, booking()));
    const disconnected = reduceLab(state, { type: "DISCONNECT" });
    states.push(disconnected, reduceLab(disconnected, booking()));
  }
  let restoredCount = 0;
  for (const original of states) {
    for (const mode of LAB_MODES) {
      for (const theme of Object.keys(LAB_THEMES)) {
        const state = { ...original, mode, theme };
        const config = publicLabConfig(state);
        const query = serializeLabConfig(state);
        for (const value of [
          query,
          `?${query}`,
          `https://levnat.ca/?${query}#system-lab`,
          new URLSearchParams(query),
          config,
        ]) {
          const restored = restoreLabConfig(value);
          assert.deepEqual(publicLabConfig(restored), config);
          assert.ok(restored.records.length <= 1);
          assert.ok(
            restored.records.every(
              (record) => record.name === "Sample guest" && record.key === "shared:sample",
            ),
          );
          invariant(restored);
          restoredCount += 1;
        }
      }
    }
  }
  assert.ok(restoredCount >= 600);
});

check(
  "untrusted share inputs cannot hydrate private fields, invalid selectors or unbounded records",
  () => {
    for (const value of [null, undefined, false, 42, "", "lab=2&built=1", { lab: "2", built: "1" }])
      assert.deepEqual(restoreLabConfig(value), createLabState());
    const malicious = {
      lab: "1",
      built: "1",
      api: "1",
      mode: "__proto__",
      theme: "constructor",
      fault: "<script>",
      sample: "delivered",
      name: privateMarker,
      email: "private-qa@example.test",
      notes: privateMarker,
      records: [{ name: privateMarker }],
      events: [{ message: privateMarker }],
      nextId: 999999,
      sequence: 999999,
    };
    const inputSnapshot = JSON.stringify(malicious);
    const restored = restoreLabConfig(freeze(malicious));
    assert.equal(JSON.stringify(malicious), inputSnapshot);
    assert.equal(restored.mode, "build");
    assert.equal(restored.theme, "cobalt");
    assert.equal(restored.fault, null);
    assert.equal(restored.records.length, 1);
    assert.equal(restored.records[0].name, "Sample guest");
    assert.doesNotMatch(JSON.stringify(restored), /QA_PRIVATE|private-qa/);
    invariant(restored);
  },
);

check("the domain has no browser, network or persistence side effects", () => {
  const source = readFileSync(
    new URL("../../../website/src/studio/lab/state.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|setTimeout|setInterval)\s*\(/,
  );
  assert.doesNotMatch(source, /\b(?:window|document|localStorage|sessionStorage)\s*\./);
  const state = freeze(reduceLab(online(), booking()));
  const before = JSON.stringify(state);
  freeze(deriveLab(state));
  freeze(publicLabConfig(state));
  serializeLabConfig(state);
  assert.equal(JSON.stringify(state), before);
});

check("the authored product has one labeled, progressively enhanced DOM contract", () => {
  const markup = systemWorkbench() + systemLedger();
  const document = parseFragment(markup);
  const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
  const all = (node, predicate) => [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes || []).flatMap((child) => all(child, predicate)),
  ];
  const withAttribute = (name) => all(document, (node) => attribute(node, name) !== undefined);
  const byId = (id) => all(document, (node) => attribute(node, "id") === id)[0];
  const ids = withAttribute("id").map((node) => attribute(node, "id"));
  assert.equal(new Set(ids).size, ids.length, "Product and ledger must not duplicate IDs");
  for (const hook of [
    "data-system-lab",
    "data-lab-action",
    "data-lab-submit",
    "data-lab-share",
    "data-lab-download",
    "data-lab-reset",
    "data-lab-records",
    "data-lab-events",
  ])
    assert.equal(withAttribute(hook).length, 1, `Missing unique ${hook}`);
  assert.deepEqual(
    withAttribute("data-lab-slot").map((node) => attribute(node, "data-lab-slot")),
    LAB_SLOTS,
  );
  assert.deepEqual(
    withAttribute("data-lab-count")
      .map((node) => attribute(node, "data-lab-count"))
      .sort(),
    ["delivered", "pending", "requests"],
  );
  assert.deepEqual(
    withAttribute("data-lab-node")
      .map((node) => attribute(node, "data-lab-node"))
      .sort(),
    ["api", "app", "device"],
  );
  for (const hook of [
    "data-lab-action",
    "data-lab-reset",
    "data-lab-share",
    "data-lab-download",
    "data-lab-slot",
    "data-lab-theme",
  ])
    for (const button of withAttribute(hook)) {
      assert.equal(button.tagName, "button");
      assert.equal(attribute(button, "type"), "button");
    }
  assert.equal(byId("lab-booking-form").tagName, "form");
  assert.ok(
    all(
      byId("lab-booking-form"),
      (node) => node.tagName === "fieldset" && attribute(node, "disabled") !== undefined,
    ).length,
    "No-JS mode must not submit a phantom booking",
  );
  assert.equal(attribute(byId("lab-guest"), "name"), "guest");
  assert.ok(
    all(document, (node) => node.tagName === "label" && attribute(node, "for") === "lab-guest")
      .length,
  );
  assert.notEqual(attribute(byId("lab-guest"), "required"), undefined);
  assert.equal(attribute(byId("lab-status"), "role"), "status");
  assert.notEqual(attribute(byId("lab-share-link"), "readonly"), undefined);
  assert.ok(byId("lab-share-link").parentNode.attrs.some((item) => item.name === "hidden"));
  assert.deepEqual(
    all(byId("lab-fault-type"), (node) => node.tagName === "option").map((node) =>
      attribute(node, "value"),
    ),
    ["api", "device"],
  );
  assert.match(markup, /local|sample|independent/i);
  assert.match(markup, /No booking or message is sent/i);
});

check("build card paints only the public projection, never runtime or inquiry data", () => {
  const painted = [];
  const indicators = [];
  const context = Object.fromEntries(
    ["fillRect", "beginPath", "roundRect", "fill", "moveTo", "lineTo", "stroke"].map((method) => [
      method,
      () => {},
    ]),
  );
  context.fillText = (value) => painted.push(String(value));
  context.roundRect = (_x, _y, width, height) => {
    if (width === 256 && height === 12) indicators.push(context.fillStyle);
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind) => {
      assert.equal(kind, "2d");
      return context;
    },
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag) => {
        assert.equal(tag, "canvas");
        return canvas;
      },
    },
  });
  try {
    const state = {
      ...reduceLab(online(), booking(0, { name: privateMarker })),
      name: privateMarker,
      notes: privateMarker,
      email: "private-qa@example.test",
      logs: [privateMarker],
    };
    assert.equal(createBuildCard(freeze(state)), canvas);
    assert.deepEqual([canvas.width, canvas.height], [1440, 960]);
    assert.ok(painted.some((value) => value.includes("LEVNAT")));
    assert.ok(painted.some((value) => /public configuration/i.test(value)));
    assert.doesNotMatch(painted.join("\n"), /QA_PRIVATE|private-qa|\u5c71\u7530|B01|qa:request/i);
    assert.deepEqual(indicators, ["#4261f2", "#4261f2", "#4261f2"]);
    for (const [fault, expected] of [
      ["device", ["#4261f2", "#4261f2", "#ed735a"]],
      ["api", ["#4261f2", "#ed735a", "#66717d"]],
    ]) {
      indicators.length = 0;
      createBuildCard(reduceLab(state, { type: "FAIL", fault }));
      assert.deepEqual(indicators, expected, "Only the interrupted node should be faulted");
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else delete globalThis.document;
  }
});

console.log(`${passed} system lab checks passed; ${failed} failed. No browser or network used.`);
