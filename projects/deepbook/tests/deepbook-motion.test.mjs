import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'parse5';
import { patchMotionInline, patchMotionScript } from '../tools/patch-motion.mjs';

const root = new URL('../', import.meta.url);
const originals = new Map(await Promise.all(['59952', '59953', '60445'].map(async id => [
  id, await readFile(new URL(`source/assets/slater.app/19933/${id}.js`, root), 'utf8')
])));
const scriptUrl = id => `https://slater.app/19933/${id}.js?v=original`;
const patched = id => patchMotionScript(originals.get(id), scriptUrl(id));

function nodes(node) {
  return [node, ...(node.childNodes || []).flatMap(nodes)];
}

async function financeSource(page) {
  const html = await readFile(new URL(`source/pages/${page}.html`, root), 'utf8');
  return nodes(parse(html)).filter(node => node.tagName === 'script')
    .map(node => node.childNodes.map(child => child.value || '').join(''))
    .find(source => source.includes('function initFinanceSlider() {'));
}

class Events {
  listeners = new Map();
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name) { for (const fn of [...(this.listeners.get(name) || [])]) fn({ type: name }); }
  listenerCount(name) { return this.listeners.get(name)?.size || 0; }
}

const camel = name => name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
function style() {
  const values = {};
  const priorities = {};
  return new Proxy(values, {
    get: (target, key) => key === 'removeProperty' ? name => {
      const property = camel(name);
      const previous = target[property] || '';
      delete target[property];
      delete priorities[property];
      return previous;
    }
      : key === 'getPropertyValue' ? name => target[camel(name)] || ''
      : key === 'getPropertyPriority' ? name => priorities[camel(name)] || ''
      : key === 'setProperty' ? (name, value, priority = '') => {
        target[camel(name)] = value;
        priorities[camel(name)] = priority;
      }
      : target[key] || '',
    set(target, key, value) {
      target[key] = value;
      delete priorities[key];
      if (key === 'cssText') for (const rule of value.split(';')) {
        const [name, val] = rule.split(':');
        if (val !== undefined) target[camel(name.trim())] = val.trim();
      }
      return true;
    }
  });
}

class Element extends Events {
  children = [];
  attrs = new Map();
  style = style();
  classes = new Set();
  classList = {
    add: (...names) => names.forEach(name => this.classes.add(name)),
    remove: (...names) => names.forEach(name => this.classes.delete(name)),
    contains: name => this.classes.has(name)
  };
  offsetWidth = 264;
  scrollWidth = 264;
  clientWidth = 390;
  clientHeight = 700;
  textContent = 'Original heading';
  constructor(tag = 'div', attrs = {}) {
    super();
    this.tagName = tag;
    for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
    this.classList.add(...(attrs.class || '').split(/\s+/).filter(Boolean));
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  get firstChild() { return this.children[0] || null; }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, before) {
    child.remove();
    const index = before ? this.children.indexOf(before) : this.children.length;
    assert.ok(index >= 0);
    this.children.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    const attr = selector.match(/^([a-z]+)?\[([\w-]+)\]$/);
    if (attr) return (!attr[1] || this.tagName === attr[1]) && this.hasAttribute(attr[2]);
    return this.tagName === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { width: this.offsetWidth, top: 0, bottom: 100 }; }
  cloneNode(deep) {
    const clone = new Element(this.tagName, Object.fromEntries(this.attrs));
    clone.classes = new Set(this.classes);
    clone.offsetWidth = this.offsetWidth;
    clone.scrollWidth = this.scrollWidth;
    if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode(true)));
    return clone;
  }
}

function harness({ width = 390, reduced = false } = {}) {
  const window = new Events();
  Object.assign(window, { innerWidth: width, innerHeight: 844, devicePixelRatio: 1 });
  const document = new Element('document');
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.querySelector(`#${id}`);
  document.fonts = new Events();
  document.fonts.ready = Promise.resolve();
  const media = new Map();
  window.matchMedia = query => {
    if (!media.has(query)) {
      const result = new Events();
      result.matches = query.includes('prefers-reduced-motion') ? reduced
        : /max-width:\s*(\d+)/.test(query) ? width <= Number(query.match(/\d+/)[0]) : false;
      media.set(query, result);
    }
    return media.get(query);
  };
  const timers = new Map();
  const frames = new Map();
  const ticker = new Set();
  const handles = [];
  const splits = [];
  const lenises = [];
  let sequence = 0;
  let refreshes = 0;
  const handle = (kind, vars, targets) => {
    const value = { kind, vars, targets, killed: false, kills: 0, callbacks: [],
      kill() { this.killed = true; this.kills++; },
      steps: [],
      to(...args) { this.steps.push(args); return this; }, set() { return this; },
      eventCallback() { return this; },
      call(fn) { this.callbacks.push(fn); return this; }
    };
    handles.push(value);
    return value;
  };
  const gsap = {
    registerPlugin() {}, defaults() {},
    ticker: { add: fn => ticker.add(fn), remove: fn => ticker.delete(fn), lagSmoothing() {} },
    utils: { toArray: value => typeof value === 'string' ? document.querySelectorAll(value) : Array.from(value),
      unitize: fn => value => `${fn(value)}px` },
    set(targets, vars) {
      for (const target of Array.isArray(targets) ? targets : [targets]) {
        if (target?.style) for (const [name, val] of Object.entries(vars)) target.style[name] = val;
      }
    },
    to: (targets, vars) => handle('tween', vars, targets),
    timeline: vars => handle('timeline', vars),
    delayedCall: (delay, fn) => handle('delayed', { delay, fn })
  };
  const ScrollTrigger = {
    update() {}, config() {}, refresh() { refreshes++; },
    create: vars => handle('trigger', vars)
  };
  class SplitText {
    static create(el, vars) { return new SplitText(el, vars); }
    constructor(el) {
      assert.ok(!el.activeSplit, 'must revert the old split before recreating');
      this.el = el;
      this.reverts = 0;
      this.original = [...el.children];
      this.lines = Array.from({ length: window.innerWidth < 768 ? 3 : 2 }, () => new Element());
      this.original.forEach(child => child.remove());
      this.lines.forEach(line => el.appendChild(line));
      el.activeSplit = this;
      splits.push(this);
    }
    revert() {
      assert.equal(++this.reverts, 1, 'a split must only be reverted once');
      this.lines.forEach(line => line.remove());
      this.original.forEach(child => this.el.appendChild(child));
      this.el.activeSplit = null;
    }
  }
  class Lenis {
    constructor(options) { this.options = options; this.events = new Map(); lenises.push(this); }
    on(name, fn) {
      if (!this.events.has(name)) this.events.set(name, []);
      this.events.get(name).push(fn);
    }
    raf() {}
    destroy() { this.destroyed = true; this.events.clear(); }
  }
  const context = vm.createContext({ window, document, gsap, ScrollTrigger, SplitText, Lenis,
    CustomEase: { create() {} }, Draggable: {}, InertiaPlugin: {},
    MorphSVGPlugin: {}, DrawSVGPlugin: {}, performance: { now: () => 1000 },
    matchMedia: window.matchMedia,
    getComputedStyle: el => ({ gap: el.style.gap === '0.5em' ? '8px' : '0px', position: el.style.position || 'static' }),
    setTimeout: fn => { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  return { window, document, context, handles, splits, lenises, ticker, frames,
    get refreshes() { return refreshes; },
    run: source => vm.runInContext(source, context),
    async ready() { await Promise.resolve(); await Promise.resolve(); },
    flush() {
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
    },
    resize(nextWidth) { window.innerWidth = nextWidth; window.dispatch('resize'); this.flush(); },
    reduce(matches) {
      reduced = matches;
      for (const [query, result] of media) if (query.includes('prefers-reduced-motion')) {
        result.matches = matches;
        result.dispatch('change');
      }
    },
    live: kind => handles.filter(item => item.kind === kind && !item.killed)
  };
}

function financeFixture(h) {
  const slider = h.document.appendChild(new Element('div', { id: 'projects-slider' }));
  const track = slider.appendChild(new Element());
  track.classList.add('global-projects_grid');
  const slides = Array.from({ length: 3 }, () => {
    const slide = track.appendChild(new Element());
    slide.classList.add('global-projects_grid-item');
    return slide;
  });
  const instances = [];
  h.context.Swiper = class {
    constructor(el, options) {
      this.options = options;
      this.destroyed = false;
      el.swiper = this;
      el.classList.add('swiper-initialized', 'swiper-horizontal');
      track.style.transform = 'translate3d(-349px, 0, 0)';
      track.style.transitionDuration = '300ms';
      slides.forEach(slide => { slide.style.width = '341px'; slide.style.marginRight = '8px'; });
      instances.push(this);
    }
    destroy(...args) {
      assert.equal(this.destroyed, false, 'must not destroy twice');
      this.destroyArgs = args;
      this.destroyed = true;
      delete slider.swiper;
      // Deliberately leave dirty styles to exercise our explicit desktop cleanup.
    }
  };
  return { slider, track, slides, instances };
}

function navFixture(h) {
  const nav = h.document.appendChild(new Element('div', {
    'nav-banner': '', class: 'w-layout-hflex pencil_layout'
  }));
  const content = nav.appendChild(new Element('div', { class: 'w-layout-hflex pencil-wrapper' }));
  const wrapper = content.appendChild(new Element('div', {
    'data-wrapper-banner': '', class: 'mw-264 overflowhidden'
  }));
  const banner = wrapper.appendChild(new Element('a', {
    'data-banner': '', 'data-nav-link': '', id: 'waitlist',
    class: 'ts-12px letter-spacing_05 navbar-pencil_link',
    href: 'https://waitlist.deepbook.tech/', target: '_blank'
  }));
  banner.textContent = 'Join the DeepBook App waitlist \u2192';
  banner.scrollWidth = banner.offsetWidth = 250;
  const faders = ['align_left', 'align_right'].map(alignment =>
    wrapper.appendChild(new Element('div', { class: `mob_fader ${alignment}` })));
  const close = nav.appendChild(new Element('svg'));
  close.classList.add('icon-x');
  return { nav, content, wrapper, banner, faders, close };
}

function assertStaticNav(h, { nav, content, wrapper, banner, faders, close }) {
  for (const element of [nav, content, wrapper, banner]) {
    assert.equal(element.style.height, 'auto', 'wrapped text must be able to expand its container');
    assert.equal(element.style.maxHeight, 'none');
  }
  assert.equal(content.style.flex, '1 1 0%');
  assert.equal(content.style.minWidth, '0');
  assert.equal(content.style.width, 'auto');
  assert.equal(wrapper.style.display, 'block');
  assert.equal(wrapper.style.width, '100%');
  assert.equal(wrapper.style.maxWidth, '100%');
  assert.equal(wrapper.style.minWidth, '0');
  assert.equal(wrapper.style.overflow, 'visible', 'do not clip wrapped text or the link focus outline');
  assert.equal(banner.style.display, 'block');
  assert.equal(banner.style.width, '100%');
  assert.equal(banner.style.maxWidth, '100%');
  assert.equal(banner.style.minWidth, '0');
  assert.equal(banner.style.whiteSpace, 'normal');
  assert.equal(banner.style.overflowWrap, 'anywhere');
  assert.equal(banner.style.lineHeight, '1.4');
  assert.equal(faders.length, 2);
  faders.forEach(fader => {
    assert.equal(fader.parentNode, wrapper, 'retain the original fade nodes for animated-mode restoration');
    assert.equal(fader.style.display, 'none', 'a foreground fade must not mask or intercept the static link');
  });
  assert.equal(banner.parentNode, wrapper);
  assert.equal(banner.hasAttribute('inert'), false);
  assert.equal(banner.hasAttribute('aria-hidden'), false);
  assert.equal(wrapper.querySelectorAll('[data-banner]').length, 1);
  assert.equal(wrapper.querySelectorAll('[data-deepbook-banner-track]').length, 0);
  assert.equal(h.live('tween').filter(tween => tween.vars.repeat === -1).length, 0);
  assert.equal(close.listenerCount('click'), 1);
}

function inlineStyleState(element) {
  return Object.entries(element.style).filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, value,
      element.style.getPropertyPriority(name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`))]);
}

function canvasFixture(h, attribute) {
  const canvas = h.document.appendChild(new Element('canvas', { [attribute]: '' }));
  const ink = { fills: 0, lines: 0 };
  canvas.getContext = () => ({
    setTransform() {}, clearRect() {}, beginPath() {}, stroke() {},
    fillRect() { ink.fills++; }, moveTo() {}, lineTo() { ink.lines++; },
    createLinearGradient: () => ({ addColorStop() {} })
  });
  return { canvas, ink };
}

test('patch dispatch is scoped, deterministic, idempotent, and syntax-valid', async () => {
  for (const [id, source] of originals) {
    const output = patched(id);
    assert.notEqual(output, source);
    assert.equal(patchMotionScript(output, scriptUrl(id)), output);
    assert.equal(patchMotionScript(source, 'https://slater.app/99999/unrelated.js'), source);
    assert.equal(patchMotionScript('const unrelated = true;\r\n', scriptUrl(id)), 'const unrelated = true;\r\n');
    assert.equal(patchMotionScript(source, `https://assets.slater.app/slater/19933/${id}.js`), output);
    new vm.Script(output);
  }
  const original = await financeSource('builder-hub');
  const output = patchMotionInline(original, 'builder-hub/index.html');
  assert.equal(patchMotionInline(output, 'builder-hub/index.html'), output);
  assert.equal(patchMotionInline(original, 'home.html'), original);
  assert.equal(patchMotionInline('const other = 1;', 'points/index.html'), 'const other = 1;');
  assert.throws(() => patchMotionScript(originals.get('59952').replace('const lenis =', 'const changedLenis ='), scriptUrl('59952')), /missing Lenis setup/);
});

for (const page of ['builder-hub', 'points']) {
  test(`${page}: original inline Swiper survives 390 -> 1024 -> 390 without duplicate listeners`, async () => {
    const h = harness();
    const { slider, track, slides, instances } = financeFixture(h);
    h.run(patchMotionInline(await financeSource(page), `${page}/index.html`));
    h.window.dispatch('load');
    h.resize(390);
    h.run('initFinanceSlider(); initFinanceSlider();');
    assert.equal(instances.length, 1);
    assert.equal(instances[0].options.breakpoints[0].slidesPerView, 1.05);
    assert.equal(instances[0].options.breakpoints[768].slidesPerView, 2.3);
    assert.equal(instances[0].options.spaceBetween, 8);
    h.resize(1024);
    h.run('initFinanceSlider();');
    assert.deepEqual(instances[0].destroyArgs, [true, true]);
    assert.equal(slider.classList.contains('swiper-initialized'), false);
    assert.equal(track.style.transform, '');
    assert.equal(track.style.transitionDuration, '');
    slides.forEach(slide => { assert.equal(slide.style.width, ''); assert.equal(slide.style.marginRight, ''); });
    h.resize(390);
    assert.equal(instances.length, 2);
    assert.equal(instances[1].destroyed, false);
    assert.equal(h.window.listenerCount('load'), 1);
    assert.equal(h.window.listenerCount('resize'), 1);
    h.resize(991);
    assert.equal(instances.length, 2);
    h.resize(992);
    assert.equal(instances[1].destroyed, true);
  });
}

test('Swiper repairs orphaned styles/classes and tolerates missing sliders', async () => {
  const h = harness({ width: 1024 });
  const source = patchMotionInline(await financeSource('points'), 'source/pages/points.html');
  h.run(source);
  h.window.dispatch('load');
  const { slider, track, slides } = financeFixture(h);
  slider.classList.add('swiper-initialized');
  track.style.transform = 'translateX(-100px)';
  slides[0].style.width = '341px';
  h.run('initFinanceSlider(); initFinanceSlider();');
  assert.equal(track.style.transform, '');
  assert.equal(slides[0].style.width, '');
  h.resize(390);
  assert.ok(slider.swiper);
});

test('reveals rebuild unrevealed lines, kill old handles, and retain entered headings after resize', async () => {
  const h = harness();
  const entered = h.document.appendChild(new Element('h2', { 'data-reveal': '' }));
  const pending = h.document.appendChild(new Element('h2', { 'data-reveal': '' }));
  h.run(patched('59952'));
  await h.ready();
  const initialTriggers = h.live('trigger');
  assert.equal(initialTriggers.length, 2);
  assert.equal(entered.activeSplit.lines.length, 3);
  initialTriggers[0].vars.onEnter();
  const tween = h.live('tween')[0];
  assert.equal(tween.vars.duration, 0.937);
  assert.equal(tween.vars.stagger, 0.08);
  assert.equal(tween.vars.ease, 'suiEase');
  assert.equal(initialTriggers[0].vars.start, 'top 85%');
  h.resize(1024);
  assert.equal(tween.killed, true, 'interrupt the in-flight tween before reverting');
  assert.ok(initialTriggers.every(trigger => trigger.killed));
  assert.equal(entered.activeSplit, null);
  assert.equal(entered.children.length, 0, 'revealed text returns to its natural line layout');
  assert.ok(entered.classList.contains('is-ready'));
  assert.equal(pending.activeSplit.lines.length, 2);
  assert.equal(h.live('trigger').length, 1);
  h.resize(390);
  assert.equal(entered.activeSplit, null, 'must not hide or replay an entered heading');
  assert.equal(pending.activeSplit.lines.length, 3);
  const splitCount = h.splits.length;
  h.resize(390);
  assert.equal(h.splits.length, splitCount, 'height-only resize must not resplit');
  h.document.fonts.dispatch('loadingdone');
  assert.equal(h.live('trigger').length, 1);
  assert.ok(h.splits.filter(split => split !== pending.activeSplit).every(split => split.reverts === 1));
});

test('same-mobile nav resize remeasures the banner; desktop cycles and cleanup are idempotent', async () => {
  const h = harness();
  const { nav, wrapper, banner, close } = navFixture(h);
  h.run(patched('59952'));
  await h.ready();
  const marquee = () => h.live('tween').filter(tween => tween.vars.repeat === -1);
  assert.equal(marquee().length, 1);
  assert.equal(marquee()[0].vars.x, -258);
  assert.equal(marquee()[0].vars.duration, 10);
  const previous = marquee()[0];
  banner.scrollWidth = 300;
  wrapper.offsetWidth = 400;
  h.resize(547);
  assert.equal(previous.killed, true);
  assert.equal(marquee().length, 1);
  assert.equal(marquee()[0].vars.x, -308);
  assert.equal(wrapper.querySelectorAll('[data-deepbook-banner-track]').length, 1);
  const clones = wrapper.querySelectorAll('[data-banner]').filter(el => el !== banner);
  assert.equal(clones.length, Math.ceil(400 / 308) + 2);
  clones.forEach(clone => {
    assert.equal(clone.getAttribute('aria-hidden'), 'true');
    assert.ok(clone.hasAttribute('inert'));
    assert.equal(clone.getAttribute('tabindex'), '-1');
    assert.equal(clone.hasAttribute('id'), false);
  });
  h.resize(1024);
  assert.equal(marquee().length, 0);
  assert.equal(wrapper.querySelectorAll('[data-banner]').length, 1);
  assert.equal(banner.querySelectorAll('[data-deepbook-nav-underline]').length, 1);
  banner.dispatch('mouseenter');
  assert.equal(h.live('tween')[0].vars.duration, 0.45);
  h.run('initNav(); initNav();');
  assert.equal(banner.listenerCount('mouseenter'), 1);
  assert.equal(banner.listenerCount('mouseleave'), 1);
  assert.equal(close.listenerCount('click'), 1);
  assert.equal(banner.querySelectorAll('[data-deepbook-nav-underline]').length, 1);
  assert.equal(h.live('tween').length, 0, 'cleanup also kills desktop hover tweens');
  close.dispatch('click');
  h.resize(390);
  assert.equal(nav.style.display, 'none', 'resize must not reopen a dismissed banner');
  assert.equal(marquee().length, 1);
  h.run('cleanupNav(); cleanupNav();');
  assert.equal(marquee().length, 0);
  assert.equal(banner.parentNode, wrapper);
  assert.equal(close.listenerCount('click'), 0);
});

test('zero-width banner cannot allocate infinite clones or leave an empty track', async () => {
  const h = harness();
  const { banner, wrapper } = navFixture(h);
  banner.offsetWidth = banner.scrollWidth = 0;
  // A real flex gap is nonzero, so also exercise a hidden/unstyled track measurement.
  h.context.getComputedStyle = () => ({ gap: '0px', position: 'static' });
  h.run(patched('59952'));
  await h.ready();
  assert.equal(banner.parentNode, wrapper);
  assert.equal(wrapper.querySelectorAll('[data-deepbook-banner-track]').length, 0);
});

test('nav fixture retains the original content wrapper and both foreground fade siblings', async () => {
  const html = await readFile(new URL('source/pages/home.html', root), 'utf8');
  const original = nodes(parse(html)).find(node => node.attrs?.some(attr => attr.name === 'data-wrapper-banner'));
  const fixture = navFixture(harness());
  assert.equal(fixture.content.getAttribute('class'),
    original.parentNode.attrs.find(attr => attr.name === 'class').value);
  assert.deepEqual(fixture.wrapper.children.map(element => [element.tagName, element.getAttribute('class')]),
    original.childNodes.filter(node => node.tagName)
      .map(node => [node.tagName, node.attrs.find(attr => attr.name === 'class').value]));
});

test('reduced-first mobile nav supports wrapping, auto height, and unmasked access at larger text sizes', async t => {
  for (const width of [320, 390, 767]) {
    await t.test(`${width}px`, async () => {
      const h = harness({ width, reduced: true });
      const fixture = navFixture(h);
      const { nav, content, wrapper, banner, faders } = fixture;
      const elements = [nav, content, wrapper, banner, ...faders];
      banner.style.fontSize = '32px';
      banner.textContent = 'Join the DeepBook App waitlist with a deliberately long unbroken label: DeepBookAppWaitlist';
      const originalText = banner.textContent;
      const before = elements.map(element => inlineStyleState(element));
      h.run(patched('59952'));
      await h.ready();
      assertStaticNav(h, fixture);
      assert.equal(banner.style.fontSize, '32px', 'fit the original text without shrinking its font');
      assert.equal(banner.textContent, originalText);
      assert.equal(banner.getAttribute('href'), 'https://waitlist.deepbook.tech/');
      h.resize(width === 320 ? 390 : 320);
      h.document.fonts.dispatch('loadingdone');
      h.run('initNav(); initNav();');
      assertStaticNav(h, fixture);
      h.run('cleanupNav(); cleanupNav();');
      assert.deepEqual(elements.map(element => inlineStyleState(element)), before,
        'remove temporary declarations that had no original inline value');
    });
  }
});

test('normal -> reduced -> resize -> normal restores inline values and priorities before marquee measurement', async () => {
  const h = harness();
  const fixture = navFixture(h);
  const { nav, content, wrapper, banner, faders, close } = fixture;
  const elements = [nav, content, wrapper, banner, ...faders];
  const seed = (element, properties) => Object.entries(properties)
    .forEach(([name, value]) => element.style.setProperty(name, value, 'important'));
  seed(nav, { height: '1.75em', 'max-height': '4em' });
  seed(content, { flex: '0 1 auto', 'min-width': '20px', width: '90%', height: '1.5em', 'max-height': '2em' });
  seed(wrapper, { display: 'flex', width: '85%', 'min-width': '10px', 'max-width': '22em',
    height: '1.25em', 'max-height': '3em', overflow: 'hidden' });
  seed(banner, { display: 'inline-block', width: 'max-content', 'min-width': '2em', 'max-width': 'none',
    height: '1em', 'max-height': '2em', 'white-space': 'nowrap', 'overflow-wrap': 'normal', 'line-height': '1' });
  seed(faders[0], { display: 'block' });
  faders[1].style.opacity = '0.7';
  banner.style.fontSize = '26px';
  wrapper.style.color = 'cyan';
  const before = elements.map(element => inlineStyleState(element));
  const measure = banner.getBoundingClientRect.bind(banner);
  banner.getBoundingClientRect = () => {
    assert.equal(banner.style.whiteSpace, 'nowrap', 'restore animated sizing before remeasuring');
    assert.equal(banner.style.getPropertyPriority('white-space'), 'important');
    return measure();
  };
  const marquee = () => h.live('tween').filter(tween => tween.vars.repeat === -1);
  h.run(patched('59952'));
  await h.ready();
  assert.equal(marquee().length, 1);
  const previous = marquee()[0];
  h.reduce(true);
  assert.equal(previous.killed, true);
  assertStaticNav(h, fixture);
  h.resize(320);
  h.document.fonts.dispatch('loadingdone');
  assertStaticNav(h, fixture);
  h.reduce(false);
  assert.deepEqual(elements.map(element => inlineStyleState(element)), before);
  assert.equal(marquee().length, 1);
  assert.equal(marquee()[0].vars.x, -258);
  assert.equal(marquee()[0].vars.duration, 10);
  assert.equal(close.listenerCount('click'), 1);
  h.resize(547);
  assert.equal(marquee().length, 1);
  h.run('cleanupNav(); cleanupNav();');
  assert.deepEqual(elements.map(element => inlineStyleState(element)), before);
  assert.equal(marquee().length, 0);
  assert.equal(close.listenerCount('click'), 0);
});

test('static nav styles restore across desktop cycles without reopening a dismissed announcement', async () => {
  const h = harness({ reduced: true });
  const fixture = navFixture(h);
  const { nav, content, wrapper, banner, faders, close } = fixture;
  nav.style.height = '24px';
  const elements = [nav, content, wrapper, banner, ...faders];
  h.run(patched('59952'));
  await h.ready();
  assertStaticNav(h, fixture);
  close.dispatch('click');
  nav.setAttribute('hidden', '');
  h.resize(1024);
  assert.equal(nav.style.display, 'none');
  assert.equal(nav.style.height, '24px');
  assert.equal(wrapper.style.overflow, '');
  assert.equal(banner.style.whiteSpace, '');
  assert.ok(faders.every(fader => fader.style.display === ''));
  h.resize(390);
  assertStaticNav(h, fixture);
  assert.equal(nav.style.display, 'none');
  assert.equal(nav.hasAttribute('hidden'), true);
  h.reduce(false);
  assert.equal(nav.style.display, 'none');
  assert.equal(nav.style.height, '24px');
  assert.equal(nav.hasAttribute('hidden'), true);
  h.run('cleanupNav();');
  const before = elements.map(element => inlineStyleState(element));
  h.run('cleanupNav();');
  assert.deepEqual(elements.map(element => inlineStyleState(element)), before);
});

test('reduced core motion leaves all headings visible with native scrolling and a single nav link', async () => {
  const h = harness({ reduced: true });
  const heading = h.document.appendChild(new Element('h2', { 'data-reveal': '' }));
  const { wrapper } = navFixture(h);
  h.run(patched('59952'));
  await h.ready();
  assert.equal(h.lenises.length, 0);
  assert.equal(h.ticker.size, 0);
  assert.equal(h.splits.length, 0);
  assert.ok(heading.classList.contains('is-ready'));
  assert.equal(h.live('trigger').length, 0);
  assert.equal(wrapper.querySelectorAll('[data-banner]').length, 1);
  h.reduce(false);
  assert.equal(h.lenises.length, 1);
  assert.equal(h.ticker.size, 1);
  assert.equal(h.splits.length, 0, 'already visible headings must not replay when preference changes');
  h.reduce(true);
  assert.ok(h.lenises[0].destroyed);
  assert.equal(h.ticker.size, 0);
  h.resize(1024);
  h.resize(390);
  assert.equal(h.live('tween').length, 0);
});

test('switching to reduced motion cleans active reveal splits, triggers, Lenis, and marquee', async () => {
  const h = harness();
  const heading = h.document.appendChild(new Element('h2', { 'data-reveal': '' }));
  navFixture(h);
  h.run(patched('59952'));
  await h.ready();
  h.live('trigger')[0].vars.onEnter();
  h.reduce(true);
  assert.equal(heading.activeSplit, null);
  assert.ok(heading.classList.contains('is-ready'));
  assert.equal(h.live('trigger').length, 0);
  assert.equal(h.live('tween').length, 0);
  assert.equal(h.ticker.size, 0);
  h.reduce(false);
  assert.equal(h.lenises.length, 2);
  assert.equal(h.ticker.size, 1);
});

test('Lenis recreation retains scroll subscribers exactly once, including reduced-first load', async () => {
  for (const reduced of [false, true]) {
    const h = harness({ reduced });
    h.run(patched('59952'));
    await h.ready();
    const probe = () => {};
    h.context.scrollProbe = probe;
    h.run('onLenisScroll(scrollProbe); onLenisScroll(scrollProbe);');
    h.reduce(false);
    let active = h.lenises.at(-1);
    assert.equal(active.events.get('scroll').length, 2);
    assert.ok(active.events.get('scroll').includes(probe));
    h.reduce(true);
    assert.equal(active.events.size, 0);
    h.reduce(false);
    active = h.lenises.at(-1);
    assert.equal(active.events.get('scroll').length, 2);
    assert.ok(active.events.get('scroll').includes(probe));
    assert.equal(h.ticker.size, 1);
  }
});

for (const reduced of [false, true]) {
  test(`Home canvas draws ${reduced ? 'static' : 'animated'} original geometry and stops/restarts one RAF`, () => {
    const h = harness({ reduced });
    const { ink } = canvasFixture(h, 'data-hero-canvas');
    const output = patched('59953');
    // Isolate the owned IIFE; unrelated Home systems require their own DOM fixtures.
    const start = output.indexOf('(() => {\n  const initHeroCanvas =');
    const end = output.indexOf('document.fonts.ready.then(init);', start);
    h.run(output.slice(start, end));
    assert.equal(h.frames.size, reduced ? 0 : 1);
    if (reduced) assert.ok(ink.lines > 0, 'static mode must still draw the hero artwork');
    h.reduce(true);
    assert.equal(h.frames.size, 0);
    const lines = ink.lines;
    h.resize(1024);
    assert.ok(ink.lines > lines, 'static artwork redraws on resize');
    h.reduce(false);
    assert.equal(h.frames.size, 1);
    const [id, frame] = [...h.frames][0];
    h.frames.delete(id);
    frame(1016);
    assert.equal(h.frames.size, 1, 'one callback schedules exactly one successor');
    h.reduce(true);
    assert.equal(h.frames.size, 0);
  });

  test(`Builder bars ${reduced ? 'start static' : 'keep default timings'} and own their timelines/blink callbacks`, () => {
    const h = harness({ reduced });
    const { ink } = canvasFixture(h, 'data-bars-canvas');
    h.run(patched('60445'));
    assert.equal(h.ticker.size, reduced ? 0 : 1);
    assert.equal(h.live('timeline').length, reduced ? 0 : 4);
    if (reduced) assert.ok(ink.fills > 0, 'static bars must remain drawn');
    h.reduce(false);
    assert.equal(h.ticker.size, 1);
    const timelines = h.live('timeline');
    assert.equal(timelines.length, 4);
    assert.ok(timelines.every(timeline => timeline.vars.repeat === -1));
    assert.equal(timelines[0].steps[0][1].duration, 0.15);
    assert.equal(timelines[0].steps[0][1].ease, 'none');
    assert.ok(timelines[3].steps[0][1].duration >= 0.12);
    assert.ok(timelines[3].steps[0][1].duration <= 0.32);
    timelines[3].callbacks[0]();
    assert.ok(h.live('delayed').length > 0);
    h.reduce(true);
    assert.equal(h.live('timeline').length, 0);
    assert.equal(h.live('delayed').length, 0);
    assert.equal(h.ticker.size, 0);
    const fills = ink.fills;
    h.resize(1024);
    for (const [id, frame] of [...h.frames]) { h.frames.delete(id); frame(); }
    assert.ok(ink.fills > fills);
    assert.equal(h.live('timeline').length, 0);
    h.reduce(false);
    assert.equal(h.live('timeline').length, 4);
    assert.equal(h.ticker.size, 1);
  });
}
