import assert from "node:assert/strict";
import { Script, createContext } from "node:vm";
import { parse } from "parse5";
import { readStarworldFile } from "../../scripts/lib/starworld-source.mjs";

/* Test premortem: a permissive fake DOM could hide integration failures (medium/high).
 * Build the test tree from the real template, fail on unsupported selectors, and exercise
 * registered handlers. Browser QA remains responsible for layout, hit testing and motion.
 * Stale scope/focus regressions (medium/high) are checked across all seven real services,
 * external brief changes, disconnected/hidden openers and focus inside/outside the windows.
 */
const template = parse(readStarworldFile("index.html"));
const source = `${readStarworldFile("data/services.js")}\n${readStarworldFile("ui/holograms.js")}\nglobalThis.api = { makeHolograms, worlds };`;

function fixture() {
  const document = { activeElement: null };
  const ids = new Map();

  class Element {
    constructor(tagName, attributes = [], text = "") {
      this.tagName = tagName;
      this.attributes = new Map(attributes.map(({ name, value }) => [name, value]));
      this.children = [];
      this.parentElement = null;
      this.listeners = new Map();
      this.ownText = text;
      this.focusCalls = [];
      const classes = new Set((this.getAttribute("class") || "").split(/\s+/).filter(Boolean));
      this.classList = {
        add: (value) => classes.add(value),
        remove: (value) => classes.delete(value),
        contains: (value) => classes.has(value),
      };
    }
    get hidden() {
      return this.attributes.has("hidden");
    }
    set hidden(value) {
      if (value) this.attributes.set("hidden", "");
      else this.attributes.delete("hidden");
    }
    get textContent() {
      return this.ownText + this.children.map((child) => child.textContent).join("");
    }
    set textContent(value) {
      this.replaceChildren();
      this.ownText = String(value);
    }
    get isConnected() {
      return this === document.documentElement || Boolean(this.parentElement?.isConnected);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
    contains(element) {
      return Boolean(element && (element === this || this.contains(element.parentElement)));
    }
    querySelector(selector) {
      assert.match(selector, /^#[\w-]+$/, "the DOM double supports ID selectors only");
      const element = ids.get(selector.slice(1));
      return this.contains(element) ? element : null;
    }
    closest(selector) {
      assert.ok(
        [".map-stage", "[hidden]"].includes(selector),
        "the DOM double supports map-stage and hidden ancestors only",
      );
      if (selector === "[hidden]" ? this.hidden : this.classList.contains("map-stage")) return this;
      return this.parentElement?.closest(selector) || null;
    }
    replaceChildren(...children) {
      for (const child of this.children) child.parentElement = null;
      this.children = children;
      this.ownText = "";
      for (const child of children) child.parentElement = this;
    }
    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }
    click() {
      for (const listener of this.listeners.get("click") || []) listener({ target: this });
    }
    focus(options) {
      assert.ok(this.isConnected, "focus target must remain in the document");
      document.activeElement = this;
      this.focusCalls.push(options);
    }
    remove() {
      if (!this.parentElement) return;
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }

  function fromMarkup(node) {
    const element = new Element(
      node.tagName,
      node.attrs,
      (node.childNodes || [])
        .filter((child) => child.nodeName === "#text")
        .map((child) => child.value)
        .join(""),
    );
    const id = element.getAttribute("id");
    if (id) ids.set(id, element);
    for (const child of (node.childNodes || []).filter((child) => child.tagName)) {
      const descendant = fromMarkup(child);
      descendant.parentElement = element;
      element.children.push(descendant);
    }
    return element;
  }

  document.documentElement = fromMarkup(
    template.childNodes.find((node) => node.tagName === "html"),
  );
  document.activeElement = ids.get("universe");
  document.createElement = (tagName) => new Element(tagName);
  const context = createContext({ document });
  new Script(source, { filename: "hologram-controller.js" }).runInContext(context);
  const { makeHolograms, worlds } = context.api;
  const brief = new Set();
  const detailsCalls = [];
  const scopeCalls = [];
  const briefReads = [];
  const controller = makeHolograms({
    panel: ids.get("holograms"),
    toggle: ids.get("hologram-toggle"),
    status: ids.get("hologram-status"),
    services: worlds,
    onDetails: (id) => detailsCalls.push(id),
    onScope: (id) => {
      scopeCalls.push(id);
      if (brief.has(id)) brief.delete(id);
      else brief.add(id);
      controller.syncBrief();
    },
    inBrief: (id) => {
      briefReads.push(id);
      return brief.has(id);
    },
  });
  return {
    controller,
    document,
    worlds,
    brief,
    detailsCalls,
    scopeCalls,
    briefReads,
    get: (id) => {
      assert.ok(ids.has(id), `missing template element: ${id}`);
      return ids.get(id);
    },
  };
}

let checks = 0;
function check(name, run) {
  run(fixture());
  checks++;
  console.log(`PASS ${name}`);
}

check(
  "holograms start closed without changing initial focus or reading an absent selection",
  (f) => {
    assert.equal(f.controller.isOpen(), false);
    assert.equal(f.get("holograms").hidden, true);
    assert.equal(f.get("hologram-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(f.get("hologram-toggle").getAttribute("aria-controls"), "holograms");
    assert.ok(f.get("holograms").getAttribute("aria-label"));
    const initialStatus = f.get("hologram-status").textContent;
    f.controller.syncBrief();
    f.controller.close();
    assert.deepEqual(f.briefReads, []);
    assert.equal(f.get("hologram-status").textContent, initialStatus);
    assert.equal(f.document.activeElement, f.get("universe"));
  },
);

check(
  "all seven real services replace window content and dispatch actions for the active ID",
  (f) => {
    assert.equal(f.worlds.length, 7);
    for (let id = 0; id < f.worlds.length; id++) {
      const service = f.worlds[id];
      f.controller.open(id);
      assert.equal(f.controller.isOpen(), true);
      assert.equal(f.get("hologram-title").textContent, service.name);
      assert.equal(f.get("hologram-description").textContent, service.info);
      assert.equal(f.get("hologram-path").textContent, service.type);
      assert.deepEqual(
        f.get("hologram-modules").children.map((child) => child.textContent),
        Array.from(service.deliverables),
      );
      assert.ok(f.get("map-stage").classList.contains("holograms-open"));
      assert.equal(f.get("hologram-toggle").getAttribute("aria-expanded"), "true");
      assert.ok(f.get("hologram-status").textContent.includes(service.name));
      assert.equal(f.document.activeElement, f.get("universe"));
      f.get("hologram-details").click();
      f.get("hologram-scope").click();
      assert.equal(f.detailsCalls.at(-1), id);
      assert.equal(f.scopeCalls.at(-1), id);
      assert.ok(f.brief.has(id));
      assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "true");
      f.get("hologram-scope").click();
      assert.ok(!f.brief.has(id));
      assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "false");
    }
    assert.equal(f.detailsCalls.length, 7);
    assert.equal(f.scopeCalls.length, 14);
  },
);

check("invalid IDs preserve closed state and cannot replace an existing valid selection", (f) => {
  const invalid = [-1, f.worlds.length, 1.2, "1", null, undefined, NaN, Infinity, {}, true];
  for (const id of invalid) f.controller.open(id, { focus: true });
  assert.equal(f.controller.isOpen(), false);
  assert.equal(f.document.activeElement, f.get("universe"));
  assert.deepEqual(f.briefReads, []);
  f.controller.open(5);
  const status = f.get("hologram-status").textContent;
  for (const id of invalid) f.controller.open(id, { focus: true });
  assert.equal(f.get("hologram-title").textContent, f.worlds[5].name);
  assert.equal(f.get("hologram-status").textContent, status);
  f.get("hologram-details").click();
  assert.deepEqual(f.detailsCalls, [5]);
});

check("external brief changes and service switches synchronize the scope button", (f) => {
  f.brief.add(6);
  f.controller.open(6);
  assert.equal(f.get("hologram-scope").textContent, "Remove from brief −");
  assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "true");
  f.brief.delete(6);
  f.controller.syncBrief();
  assert.equal(f.get("hologram-scope").textContent, "Add to brief +");
  assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "false");
  f.brief.add(2);
  f.controller.open(2);
  assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "true");
  f.controller.open(4);
  assert.equal(f.get("hologram-scope").getAttribute("aria-pressed"), "false");
  assert.deepEqual([...f.brief], [2]);
});

check(
  "explicit opening focuses the close control and its click restores the original opener",
  (f) => {
    f.get("hologram-toggle").focus();
    f.controller.open(0, { focus: true });
    assert.equal(f.document.activeElement, f.get("hologram-close"));
    f.get("hologram-scope").focus();
    f.controller.open(3);
    assert.equal(f.document.activeElement, f.get("hologram-scope"));
    f.get("hologram-close").focus();
    f.get("hologram-close").click();
    assert.equal(f.controller.isOpen(), false);
    assert.equal(f.document.activeElement, f.get("hologram-toggle"));
    assert.equal(f.get("hologram-toggle").getAttribute("aria-expanded"), "false");
    assert.ok(!f.get("map-stage").classList.contains("holograms-open"));
    assert.equal(f.get("hologram-status").textContent, "Service preview closed.");
  },
);

check("selection and closing never steal focus from controls outside the holograms", (f) => {
  const outside = f.get("recenter");
  outside.focus();
  f.controller.open(2);
  assert.equal(f.document.activeElement, outside);
  f.get("zoom-in").focus();
  f.controller.close();
  assert.equal(f.document.activeElement, f.get("zoom-in"));
  assert.equal(outside.focusCalls.length, 1);
});

check("closing falls back to the toggle when the original opener has been removed", (f) => {
  f.get("recenter").focus();
  f.controller.open(1, { focus: true });
  f.get("recenter").remove();
  f.controller.close();
  assert.equal(f.document.activeElement, f.get("hologram-toggle"));
});

check("closing falls back to the toggle when the opener is inside a collapsed catalog", (f) => {
  const catalog = f.get("services-content");
  catalog.hidden = false;
  const serviceButton = f.document.createElement("button");
  f.get("world-list").replaceChildren(serviceButton);
  serviceButton.focus();
  f.controller.open(2, { focus: true });
  assert.equal(f.document.activeElement, f.get("hologram-close"));
  catalog.hidden = true;
  assert.equal(serviceButton.isConnected, true);
  assert.equal(serviceButton.closest("[hidden]"), catalog);
  f.get("hologram-close").click();
  assert.equal(f.controller.isOpen(), false);
  assert.ok(
    f.document.activeElement === f.get("hologram-toggle"),
    "closing must restore the visible hologram toggle instead of the hidden catalog button",
  );
  assert.equal(serviceButton.focusCalls.length, 1);
});

console.log(`\n${checks} hologram controller behavior checks passed.`);
