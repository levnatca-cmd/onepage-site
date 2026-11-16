import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'parse5';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const controls = await read('local/controls.js');
const generated = parse(await read('builder-hub/index.html'));
const originalCss = await read('source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css');
const originalWebflow = await read('source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/js/webflow.6d3149b8.55acc07a84b6834a.js');
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attributes = node => Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
const generatedNodes = nodes(generated);
const ownedRoots = generatedNodes.filter(node => Object.hasOwn(attributes(node), 'global-tab-dd-item'));

// Execute the immutable dropdown module, not a rewrite of its competing handlers.
const moduleStart = originalWebflow.indexOf('9858:function(');
const moduleEnd = originalWebflow.indexOf(',9078:function', moduleStart);
assert.ok(moduleStart >= 0 && moduleEnd > moduleStart, 'original Webflow dropdown module must exist');
const dropdownModule = originalWebflow.slice(moduleStart + '9858:'.length, moduleEnd);

class MockEvent {
  constructor(type, options = {}) {
    Object.assign(this, { type, bubbles: true, defaultPrevented: false, stopped: false, immediate: false }, options);
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
  stopImmediatePropagation() { this.immediate = this.stopped = true; }
}

class Events {
  listeners = [];
  addEventListener(type, fn, options = {}) {
    const capture = options === true || !!options.capture;
    if (!this.listeners.some(item => item.type === type && item.fn === fn && item.capture === capture)) {
      this.listeners.push({ type, fn, capture, once: !!options.once });
    }
  }
  removeEventListener(type, fn, options = {}) {
    const capture = options === true || !!options.capture;
    this.listeners = this.listeners.filter(item => item.type !== type || item.fn !== fn || item.capture !== capture);
  }
  dispatchEvent(event) {
    event.target = this;
    const path = [];
    for (let node = this; node; node = node.parentNode) path.push(node);
    const invoke = (node, capture) => {
      event.currentTarget = node;
      for (const item of [...node.listeners]) {
        if (item.type !== event.type || item.capture !== capture) continue;
        if (item.once) node.removeEventListener(item.type, item.fn, item.capture);
        item.fn(event);
        if (event.immediate) break;
      }
    };
    for (const node of [...path].reverse()) {
      invoke(node, true);
      if (event.stopped) return !event.defaultPrevented;
    }
    for (const node of event.bubbles ? path : path.slice(0, 1)) {
      invoke(node, false);
      if (event.stopped) break;
    }
    return !event.defaultPrevented;
  }
}

class Element extends Events {
  children = [];
  style = {};
  visible = true;
  scrollHeight = 100;
  constructor(document, tag = 'div', attrs = {}) {
    super();
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.attrs = new Map(Object.entries(attrs));
    this.classList = {
      contains: name => this.classes().has(name),
      add: (...names) => this.setAttribute('class', [...new Set([...this.classes(), ...names])].join(' ')),
      remove: (...names) => this.setAttribute('class', [...this.classes()].filter(name => !names.includes(name)).join(' ')),
      toggle: (name, force = !this.classes().has(name)) => {
        if (force) this.classList.add(name);
        else this.classList.remove(name);
        return force;
      }
    };
  }
  classes() { return new Set((this.getAttribute('class') || '').split(/\s+/).filter(Boolean)); }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { if (value) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get inert() { return this.hasAttribute('inert'); }
  set inert(value) {
    if (value) {
      this.setAttribute('inert', '');
      if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
    } else this.removeAttribute('inert');
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matchesAtom(selector) {
    if (selector.includes(':not(:disabled)')) {
      if (this.disabled) return false;
      selector = selector.replace(':not(:disabled)', '');
    }
    const tag = selector.match(/^[\w-]+/);
    if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    for (const [, id] of selector.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
    for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) if (!this.classes().has(name)) return false;
    for (const [, name, quoted, bare] of selector.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|([^\]]+)))?\]/g)) {
      if (!this.hasAttribute(name)) return false;
      const value = quoted ?? bare;
      if (value !== undefined && this.getAttribute(name) !== value) return false;
    }
    return true;
  }
  matches(selector) {
    return selector.split(',').some(part => {
      const atoms = part.trim().split(/\s+/);
      if (!this.matchesAtom(atoms.pop())) return false;
      let ancestor = this.parentNode;
      while (atoms.length) {
        const atom = atoms.pop();
        while (ancestor && !ancestor.matchesAtom?.(atom)) ancestor = ancestor.parentNode;
        if (!ancestor) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    });
  }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    return selector === '*' ? descendants : descendants.filter(child => child.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let node = this; node?.matches; node = node.parentNode) if (node.matches(selector)) return node;
    return null;
  }
  getClientRects() {
    for (let node = this; node?.attrs; node = node.parentNode) {
      if (!node.visible || node.hidden || node.style.display === 'none' || node.classList.contains('hide')) return [];
      if (node.id === 'hamb-button' && this.ownerDocument.width > 991) return [];
    }
    return [{ width: 100, height: 40 }];
  }
  getBoundingClientRect() { return { width: this.getClientRects().length ? 100 : 0, height: 40 }; }
  focus() {
    if (!this.getClientRects().length || this.disabled || this.closest('[inert]')) return;
    this.ownerDocument.activeElement = this;
  }
  click() { if (!this.disabled) this.dispatchEvent(new MockEvent('click')); }
}

const focusSelector = 'a[href], button:not(:disabled), [tabindex="0"]';
function visibleFocusables(element) {
  return element.querySelectorAll(focusSelector).filter(node => node.getClientRects().length &&
    !node.disabled && !node.closest('[inert]') && node.style.visibility !== 'hidden');
}

function fixture({ width = 1024, legacy = false, bannerRole = 'banner' } = {}) {
  const document = new Events();
  Object.assign(document, { width, readyState: 'loading', activeElement: null });
  const el = (tag, attrs) => new Element(document, tag, attrs);
  document.documentElement = el('html');
  document.documentElement.parentNode = document;
  document.body = document.documentElement.appendChild(el('body'));
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.activeElement = document.body;

  const navbar = document.body.appendChild(el('div', { class: 'navbar', ...(bannerRole ? { role: bannerRole } : {}) }));
  const logo = navbar.appendChild(el('a', { class: 'navbar-logo', href: '/', id: 'fixture-logo' }));
  const dismiss = navbar.appendChild(el('svg', { role: 'button', tabindex: '0', id: 'fixture-dismiss' }));
  const docs = navbar.appendChild(el('a', { href: '/docs', id: 'fixture-docs' }));
  const hidden = navbar.appendChild(el('a', { href: '/hidden', class: 'hide' }));
  const disabled = navbar.appendChild(el('button', { disabled: '' }));
  const menuToggle = navbar.appendChild(el('button', { id: 'hamb-button', type: 'button' }));
  const menu = navbar.appendChild(el('div', { class: 'hamburger-component', inert: '', 'aria-hidden': 'true' }));
  const menuLinks = ['/builder-hub', '/trader-hub', '/deep-token'].map((href, index) =>
    menu.appendChild(el('a', { href, id: `fixture-menu-${index}` })));
  const main = document.body.appendChild(el('main'));
  const footer = document.body.appendChild(el('footer', { inert: '' }));

  const group = main.appendChild(el('div', { 'global-tab-dd': '' }));
  assert.ok(ownedRoots.length >= 2, 'generated Builder accordion items must exist');
  const records = ownedRoots.slice(0, 2).map(node => {
    const item = group.appendChild(el(node.tagName, attributes(node)));
    if (legacy) { item.classList.remove('db-dropdown'); item.classList.add('w-dropdown'); }
    const descendants = nodes(node);
    const toggleNode = descendants.find(child => Object.hasOwn(attributes(child), 'global-tab-dd-toggle'));
    const panelNode = descendants.find(child => (attributes(child).class || '').split(/\s+/).includes('w-dropdown-list'));
    assert.ok(toggleNode && panelNode);
    const toggle = item.appendChild(el(toggleNode.tagName, attributes(toggleNode)));
    const panel = item.appendChild(el(panelNode.tagName, attributes(panelNode)));
    const link = panel.appendChild(el('a', { href: '/details' }));
    return { item, toggle, panel, link };
  });
  const resources = main.appendChild(el('div', { 'global-dd': '' }));
  const resourceItem = resources.appendChild(el('div', { 'global-dd-wrapper': '' }));
  const resourceToggle = resourceItem.appendChild(el('div', { 'global-dd-toggle': '', tabindex: '0' }));
  const resourcePanel = resourceItem.appendChild(el('div', { 'global-dd-content': '' }));
  const resourceLink = resourcePanel.appendChild(el('a', { href: 'https://www.sui.io/mysticeti' }));

  const timers = new Map();
  const frames = new Map();
  const media = new Map();
  const window = new Events();
  let sequence = 0;
  const schedule = fn => { const id = ++sequence; timers.set(id, fn); return id; };
  window.setTimeout = schedule;
  window.clearTimeout = id => timers.delete(id);
  const tweens = new Map();
  window.gsap = {
    killTweensOf(panel) { tweens.get(panel)?.forEach(id => timers.delete(id)); tweens.delete(panel); },
    to(panel, vars) {
      const id = schedule(() => { panel.style.height = `${vars.height}px`; vars.onComplete?.(); });
      if (!tweens.has(panel)) tweens.set(panel, new Set());
      tweens.get(panel).add(id);
      return { kill: () => timers.delete(id) };
    }
  };
  window.ScrollTrigger = { refresh() {} };
  const mediaMatch = query => query.includes('max-width') ? document.width <= Number(query.match(/\d+/)[0]) : false;
  const matchMedia = query => {
    if (!media.has(query)) { const target = new Events(); target.matches = mediaMatch(query); media.set(query, target); }
    return media.get(query);
  };
  const context = vm.createContext({ document, window, location: { pathname: '/builder-hub' }, matchMedia,
    getComputedStyle: node => ({ visibility: node.style.visibility || 'visible' }),
    setTimeout: schedule, clearTimeout: window.clearTimeout,
    requestAnimationFrame: fn => { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id), MouseEvent: MockEvent
  });
  vm.runInContext(controls, context, { filename: 'local/controls.js' });
  document.readyState = 'interactive';
  document.dispatchEvent(new MockEvent('DOMContentLoaded'));

  const h = { document, window, context, navbar, logo, dismiss, docs, hidden, disabled, menuToggle, menu, menuLinks,
    main, footer, records, resourceToggle, resourcePanel, resourceLink, schedule,
    flush() {
      let count = 0;
      while (timers.size) {
        assert.ok(count++ < 1000, 'timer/debounce callbacks must settle');
        const [id, fn] = timers.entries().next().value;
        timers.delete(id); fn();
      }
    },
    frames() {
      let count = 0;
      while (frames.size) {
        assert.ok(count++ < 100, 'menu focus frame retries must settle');
        const [id, fn] = frames.entries().next().value;
        frames.delete(id); fn();
      }
    },
    key(target, key, shiftKey = false) {
      const event = new MockEvent('keydown', { key, shiftKey });
      target.dispatchEvent(event);
      if (key === 'Tab' && !event.defaultPrevented) {
        const list = visibleFocusables(document.documentElement);
        const index = list.indexOf(document.activeElement);
        const next = (index + (shiftKey ? -1 : 1) + list.length) % list.length;
        list[next]?.focus();
      }
      return event;
    },
    mouse(target) {
      target.dispatchEvent(new MockEvent('pointerdown'));
      target.dispatchEvent(new MockEvent('mousedown'));
      target.focus();
      target.dispatchEvent(new MockEvent('mouseup'));
      target.click();
      this.flush();
    },
    resize(nextWidth) {
      document.width = nextWidth;
      for (const [query, target] of media) {
        const matches = mediaMatch(query);
        if (target.matches !== matches) { target.matches = matches; target.dispatchEvent(new MockEvent('change')); }
      }
      window.dispatchEvent(new MockEvent('resize'));
      this.flush(); this.frames();
    },
    openMenu() { menuToggle.click(); this.frames(); this.flush(); }
  };
  return h;
}

function installOriginalDropdown(h) {
  const states = new Map();
  const bindings = [];
  class Query extends Array {
    each(fn) { this.forEach((node, index) => fn(index, node)); return this; }
    find(selector) {
      // This original selector excludes nested dropdown links; the fixture has no nested roots.
      if (selector === 'a:not(.w-dropdown .w-dropdown a)') selector = 'a';
      return $(this.flatMap(node => node.querySelectorAll(selector)));
    }
    children(selector) { return $(this.flatMap(node => node.children.filter(child => child.matches(selector)))); }
    attr(name, value) {
      if (value === undefined) return this[0]?.getAttribute(name);
      this.forEach(node => node.setAttribute(name, value)); return this;
    }
    prop(name) { return this[0]?.[name]; }
    css(name, value) { return value === undefined ? (name === 'z-index' ? '900' : '') : this; }
    on(name, fn) {
      this.forEach(node => {
        const type = name.split('.')[0];
        bindings.push({ node, name, type, fn }); node.addEventListener(type, fn);
      });
      return this;
    }
    off(name, fn) {
      for (let index = bindings.length - 1; index >= 0; index--) {
        const item = bindings[index];
        if (this.includes(item.node) && (item.name === name || item.name.endsWith(name)) && (!fn || item.fn === fn)) {
          item.node.removeEventListener(item.type, item.fn); bindings.splice(index, 1);
        }
      }
      return this;
    }
    closest(selector) { return $(this.map(node => node.closest(selector)).filter(Boolean)); }
    parents(selector) {
      const result = [];
      this.forEach(node => {
        for (let parent = node.parentNode; parent?.matches; parent = parent.parentNode) {
          if (!selector || parent.matches(selector)) result.push(parent);
        }
      });
      return $([...new Set(result)]);
    }
    addClass(name) { this.forEach(node => node.classList.add(name)); return this; }
    removeClass(name) { this.forEach(node => node.classList.remove(name)); return this; }
    is(value) { return value === ':focus' ? this.includes(h.document.activeElement) : this.includes(value); }
    has(value) { return $(this.filter(node => node.contains(value))); }
    index(value) { return this.indexOf(value); }
    triggerHandler(name) {
      this.forEach(node => bindings.filter(item => item.node === node && item.name === name).forEach(item =>
        item.fn(new MockEvent(name.split('.')[0], { target: node }))));
      return this;
    }
    focus() { this[0]?.focus(); return this; }
  }
  function $(value) { return Query.from(Array.isArray(value) ? value : value ? [value] : []); }
  $.data = (node, name, value) => { if (value !== undefined) states.set(node, value); return states.get(node); };
  $.inArray = (value, list) => list.indexOf(value);
  const env = () => false;
  env.touch = false;
  let factory;
  const webflow = { env, redraw: { up() {} }, define(name, fn) { assert.equal(name, 'dropdown'); factory = fn; } };
  const dependencies = { 3949: webflow, 5134: { triggers: { intro() {}, outro() {} }, dispatchCustomEvent() {} } };
  const require = id => { assert.ok(dependencies[id], `unexpected original Webflow dependency ${id}`); return dependencies[id]; };
  vm.runInContext(`(${dropdownModule})`, h.context, { filename: 'original-webflow-dropdown.js' })({ exports: {} }, {}, require);
  factory($, { debounce: fn => {
    let timer;
    return (...args) => {
      h.window.clearTimeout(timer);
      timer = h.schedule(() => fn(...args));
    };
  } }).ready();
  return { states, bindings };
}

function assertDisclosure(record, open) {
  assert.equal(record.toggle.getAttribute('aria-expanded'), String(open));
  assert.equal(record.panel.hidden, !open);
  assert.equal(record.panel.inert, !open);
  assert.equal(record.panel.classList.contains('w--open'), open);
  assert.equal(record.item.classList.contains('dd-active'), open);
}

test('generated Builder roots remove Webflow ownership but preserve styled toggle/list children', () => {
  assert.ok(ownedRoots.length > 0);
  for (const node of ownedRoots) {
    const classes = (attributes(node).class || '').split(/\s+/);
    assert.ok(classes.includes('db-dropdown'), 'regenerate Builder markup with the local dropdown root');
    assert.ok(!classes.includes('w-dropdown'), 'Webflow must not discover a locally owned accordion');
    const descendants = nodes(node);
    assert.ok(descendants.some(child => (attributes(child).class || '').split(/\s+/).includes('w-dropdown-toggle')));
    assert.ok(descendants.some(child => (attributes(child).class || '').split(/\s+/).includes('w-dropdown-list')));
  }
});

test('local dropdown root reproduces every original base declaration at zero specificity', async () => {
  const declarations = text => Object.fromEntries(text.split(';').filter(rule => rule.trim()).map(rule =>
    rule.split(':').map(part => part.trim())));
  const before = originalCss.match(/(?:^|\})\s*\.w-dropdown\s*\{([^}]*)\}/)?.[1];
  const after = (await read('local/controls.css')).match(/:where\(\.db-dropdown\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(before, 'original base dropdown CSS must be present');
  assert.ok(after, 'local dropdown base CSS must use :where(.db-dropdown)');
  assert.deepEqual(declarations(after), declarations(before));
});

test('legacy-class positive control reproduces the original Webflow mixed-input race', () => {
  const h = fixture({ legacy: true });
  const webflow = installOriginalDropdown(h);
  const record = h.records[1];
  assert.equal(webflow.states.size, 2, 'the real original module must initialize legacy roots');
  assert.ok(webflow.bindings.some(item => item.type === 'mouseup'));
  h.key(record.toggle, 'Enter'); h.flush();
  h.mouse(record.toggle);
  assert.equal(record.panel.hidden, true);
  assert.equal(record.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(webflow.states.get(record.item).open, true);
});

for (const key of ['Enter', ' ']) {
  test(`local Builder accordion stays synchronized after ${JSON.stringify(key)} -> mouse with original Webflow loaded`, () => {
    const h = fixture();
    const webflow = installOriginalDropdown(h);
    const record = h.records[1];
    h.key(record.toggle, key); h.flush();
    assertDisclosure(record, true);
    h.mouse(record.toggle);
    assertDisclosure(record, false);
    h.mouse(record.toggle);
    assertDisclosure(record, true);
    assert.equal(webflow.states.size, 0, 'no locally owned .w-dropdown roots may reach Webflow');
    assert.equal(webflow.bindings.length, 0);
    h.key(record.link, 'Escape'); h.flush();
    assertDisclosure(record, false);
    assert.equal(h.document.activeElement, record.toggle);
  });
}

test('Escape from a desktop resource link leaves its disabled disclosure expanded', () => {
  const h = fixture();
  assert.equal(h.resourceToggle.getAttribute('aria-disabled'), 'true');
  assert.equal(h.resourceToggle.getAttribute('tabindex'), '-1');
  h.resourceLink.focus();
  const event = h.key(h.resourceLink, 'Escape'); h.flush();
  assert.equal(h.resourcePanel.hidden, false);
  assert.equal(h.resourcePanel.inert, false);
  assert.equal(h.resourceToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(h.document.activeElement, h.resourceLink);
  assert.equal(event.defaultPrevented, false);
});

test('the same resource link can close its enabled mobile disclosure and restore toggle focus', () => {
  const h = fixture({ width: 390 });
  h.resourceLink.focus();
  h.key(h.resourceLink, 'Escape'); h.flush();
  assert.equal(h.resourcePanel.hidden, true);
  assert.equal(h.resourcePanel.inert, true);
  assert.equal(h.resourceToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, h.resourceToggle);
  h.mouse(h.resourceToggle);
  assert.equal(h.resourcePanel.hidden, false);
});

for (const bannerRole of ['banner', null]) {
  test(`menu dialog exists only while open and restores original role ${bannerRole ?? '(absent)'}`, () => {
    const h = fixture({ width: 390, bannerRole });
    assert.equal(h.navbar.getAttribute('role'), bannerRole);
    assert.equal(h.navbar.hasAttribute('aria-modal'), false);
    assert.equal(h.menu.getAttribute('role'), 'navigation');
    h.openMenu();
    assert.equal(h.navbar.getAttribute('role'), 'dialog');
    assert.equal(h.navbar.getAttribute('aria-modal'), 'true');
    assert.equal(h.menu.getAttribute('role'), 'navigation');
    assert.equal(h.menu.hasAttribute('aria-modal'), false);
    assert.equal(h.menu.closest('[role="dialog"]'), h.navbar);
    assert.equal(h.menuToggle.closest('[role="dialog"]'), h.navbar);
    assert.equal(h.document.activeElement, h.menuLinks[0], 'initial focus must remain the first panel link');
    h.key(h.menuLinks[0], 'Escape'); h.flush(); h.frames();
    assert.equal(h.navbar.getAttribute('role'), bannerRole);
    assert.equal(h.navbar.hasAttribute('aria-modal'), false);
    assert.equal(h.menu.getAttribute('role'), 'navigation');
    assert.equal(h.menu.inert, true);
    assert.equal(h.document.activeElement, h.menuToggle);
  });
}

test('Tab and Shift+Tab visit all visible header controls without leaving the active dialog', () => {
  const h = fixture({ width: 390 });
  h.openMenu();
  assert.equal(h.navbar.getAttribute('role'), 'dialog');
  const expected = visibleFocusables(h.navbar);
  assert.ok(expected.includes(h.logo) && expected.includes(h.dismiss) && expected.includes(h.docs));
  assert.ok(expected.includes(h.menuToggle) && expected.includes(h.menuLinks[0]));
  assert.ok(!expected.includes(h.hidden) && !expected.includes(h.disabled));
  const first = expected[0];
  const last = expected.at(-1);
  last.focus(); h.key(last, 'Tab');
  assert.equal(h.document.activeElement, first, 'wrap to first visible control inside the dialog boundary');
  first.focus(); h.key(first, 'Tab', true);
  assert.equal(h.document.activeElement, last);
  for (const shift of [false, true]) {
    const visited = new Set();
    first.focus();
    for (let index = 0; index < expected.length * 2; index++) {
      const active = h.document.activeElement;
      assert.ok(h.navbar.contains(active), 'trapped focus must stay within the actual role=dialog');
      visited.add(active); h.key(active, 'Tab', shift);
    }
    assert.deepEqual(visited, new Set(expected));
  }
});

test('menu close restores prior background inert state and leaves header controls usable', () => {
  const h = fixture({ width: 390 });
  assert.equal(h.main.inert, false);
  assert.equal(h.footer.inert, true);
  h.openMenu();
  assert.equal(h.main.inert, true);
  assert.equal(h.footer.inert, true);
  assert.equal(h.menu.inert, false);
  assert.equal(h.logo.closest('[inert]'), null);
  h.menuLinks[1].click(); h.flush(); h.frames();
  assert.equal(h.main.inert, false);
  assert.equal(h.footer.inert, true);
  assert.equal(h.navbar.getAttribute('role'), 'banner');
  assert.equal(h.navbar.hasAttribute('aria-modal'), false);
  assert.equal(h.menuToggle.getAttribute('aria-expanded'), 'false');
});

test('390 -> 1024 -> 390 closes the dialog, focuses visible logo, and can reopen cleanly', () => {
  const h = fixture({ width: 390 });
  h.openMenu();
  h.resize(1024);
  assert.equal(h.menuToggle.getClientRects().length, 0);
  assert.equal(h.document.activeElement, h.logo);
  assert.equal(h.menu.inert, true);
  assert.equal(h.main.inert, false);
  assert.equal(h.navbar.getAttribute('role'), 'banner');
  assert.equal(h.navbar.hasAttribute('aria-modal'), false);
  h.resize(390);
  h.openMenu();
  assert.equal(h.document.activeElement, h.menuLinks[0]);
  assert.equal(h.navbar.getAttribute('role'), 'dialog');
  h.key(h.menuLinks[0], 'Escape'); h.flush();
  assert.equal(h.document.activeElement, h.menuToggle);
});

test('initialization is idempotent and rapid menu close cancels pending initial focus', () => {
  const h = fixture({ width: 390 });
  const count = h.document.listeners.length + h.menuToggle.listeners.length;
  vm.runInContext('initialize(); initialize();', h.context);
  assert.equal(h.document.listeners.length + h.menuToggle.listeners.length, count);
  h.menuToggle.click();
  h.menuToggle.click();
  h.frames(); h.flush();
  assert.equal(h.menuToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, h.menuToggle);
  assert.equal(h.menu.inert, true);
  assert.equal(h.navbar.getAttribute('role'), 'banner');
});
