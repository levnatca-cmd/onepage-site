const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileResources = matchMedia('(max-width: 767px)');
const mobileMenu = matchMedia('(max-width: 991px)');
const disclosures = new Map();
let nextId = 0;

function identifier(element, prefix) {
  if (!element.id) element.id = `db-${prefix}-${++nextId}`;
  return element.id;
}

function setDisclosure(record, open, animate = true) {
  const { toggle, panel, item, group, tab } = record;
  record.open = open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-controls', identifier(panel, 'panel'));
  panel.setAttribute('aria-labelledby', identifier(toggle, 'toggle'));
  panel.setAttribute('role', 'region');
  panel.inert = !open;
  item.classList.toggle(tab ? 'dd-active' : 'is-open', open);
  if (tab) {
    panel.classList.toggle('w--open', open);
    toggle.classList.toggle('w--open', open);
    toggle.removeAttribute('aria-haspopup');
  }
  const gsap = window.gsap;
  gsap?.killTweensOf(panel);
  if (open) panel.hidden = false;
  const finish = () => {
    panel.hidden = !open;
    panel.style.height = open ? 'auto' : '0px';
    window.ScrollTrigger?.refresh();
  };
  if (gsap && animate && !reducedMotion.matches && panel.getBoundingClientRect().width) {
    panel.style.overflow = 'hidden';
    gsap.to(panel, {
      height: open ? panel.scrollHeight : 0,
      duration: tab ? 0.3 : 0.4,
      ease: tab ? 'none' : 'power2.inOut',
      onComplete: finish,
    });
  } else finish();
  if (open && group?.enabled) {
    for (const other of group.records) {
      if (other !== record && other.open) setDisclosure(other, false, animate);
    }
  }
}

function installDisclosures() {
  const groups = [];
  document.querySelectorAll('[global-tab-dd], [global-dd]').forEach(element => {
    const tab = element.hasAttribute('global-tab-dd');
    const group = { element, tab, enabled: null, records: [] };
    const selector = tab ? '[global-tab-dd-item]' : '[global-dd-wrapper]';
    element.querySelectorAll(selector).forEach(item => {
      if (item.closest(tab ? '[global-tab-dd]' : '[global-dd]') !== element) return;
      const toggle = item.querySelector(tab ? '[global-tab-dd-toggle]' : '[global-dd-toggle]');
      const panel = item.querySelector(tab ? '.w-dropdown-list' : '[global-dd-content]');
      if (!toggle || !panel) return;
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('data-db-control', 'disclosure');
      panel.setAttribute('data-db-panel', '');
      const record = { item, toggle, panel, tab, group, open: false };
      group.records.push(record);
      disclosures.set(toggle, record);
    });
    if (group.records.length) groups.push(group);
  });

  const update = () => {
    for (const group of groups) {
      const enabled = group.tab || location.pathname.includes('/points') || mobileResources.matches;
      if (enabled === group.enabled) continue;
      group.enabled = enabled;
      group.records.forEach((record, index) => {
        record.toggle.setAttribute('tabindex', enabled ? '0' : '-1');
        record.toggle.setAttribute('aria-disabled', String(!enabled));
        setDisclosure(record, enabled ? index === 0 : true, false);
      });
    }
  };
  update();
  mobileResources.addEventListener('change', update);

  const activate = toggle => {
    const record = disclosures.get(toggle);
    if (record?.group.enabled) setDisclosure(record, !record.open);
  };
  document.addEventListener('click', event => {
    const toggle = event.target.closest?.('[data-db-control="disclosure"]');
    if (!toggle) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activate(toggle);
  }, true);
  document.addEventListener('keydown', event => {
    const toggle = event.target.closest?.('[data-db-control="disclosure"]');
    if (!toggle) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopImmediatePropagation();
      activate(toggle);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const record = disclosures.get(toggle);
      if (record?.group.enabled) setDisclosure(record, false);
    } else event.stopImmediatePropagation();
  }, true);
  document.addEventListener('keyup', event => {
    if (event.target.closest?.('[data-db-control="disclosure"]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  // Closing a panel must not leave focus inside its inert content.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const record of disclosures.values()) {
      if (record.group.enabled && record.open && record.panel.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDisclosure(record, false);
        record.toggle.focus({ preventScroll: true });
        break;
      }
    }
  }, true);
  window.addEventListener('load', () => {
    for (const record of disclosures.values()) setDisclosure(record, record.open, false);
  }, { once: true });
}

function installMenu() {
  const toggle = document.querySelector('#hamb-button');
  const panel = document.querySelector('.hamburger-component');
  if (!toggle || !panel) return;
  const boundary = toggle.closest('.navbar');
  if (!boundary?.contains(panel)) return;
  const boundaryAttributes = ['role', 'aria-label', 'aria-modal'].map(name => [name, boundary.getAttribute(name)]);
  toggle.setAttribute('aria-controls', identifier(panel, 'navigation'));
  toggle.setAttribute('aria-haspopup', 'dialog');
  panel.setAttribute('role', 'navigation');
  panel.setAttribute('aria-label', 'Main navigation');
  panel.setAttribute('tabindex', '-1');
  const background = [...document.querySelectorAll('main, footer')]
    .filter(element => !element.contains(panel))
    .map(element => ({ element, inert: element.inert }));
  let open = false;
  let focusFrame;

  const focusable = scope => [...scope.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const apply = () => {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    if (open) {
      boundary.setAttribute('role', 'dialog');
      boundary.setAttribute('aria-label', 'Main navigation');
      boundary.setAttribute('aria-modal', 'true');
    } else {
      for (const [name, value] of boundaryAttributes) {
        if (value == null) boundary.removeAttribute(name);
        else boundary.setAttribute(name, value);
      }
    }
    for (const entry of background) entry.element.inert = open || entry.inert;
  };
  const close = () => { if (open) toggle.click(); };
  toggle.addEventListener('click', () => {
    open = !open;
    apply();
    cancelAnimationFrame(focusFrame);
    if (open) {
      let attempts = 0;
      const enter = () => {
        if (!open) return;
        const first = focusable(panel)[0];
        if (first) first.focus({ preventScroll: true });
        else if (attempts++ < 30) focusFrame = requestAnimationFrame(enter);
        else panel.focus({ preventScroll: true });
      };
      focusFrame = requestAnimationFrame(enter);
    } else {
      const target = toggle.getClientRects().length ? toggle : document.querySelector('.navbar-logo');
      target?.focus({ preventScroll: true });
    }
  });
  panel.addEventListener('click', event => {
    if (event.target.closest('a[href]')) close();
  });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    } else if (event.key === 'Tab') {
      const nodes = focusable(boundary);
      if (!nodes.length) return;
      const index = nodes.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault(); nodes.at(-1).focus();
      } else if (!event.shiftKey && (index < 0 || index === nodes.length - 1)) {
        event.preventDefault(); nodes[0].focus();
      }
    }
  }, true);
  document.addEventListener('pointerdown', event => {
    if (open && !boundary.contains(event.target)) close();
  });
  mobileMenu.addEventListener('change', () => { if (!mobileMenu.matches) close(); });
  apply();
}

function installFilters() {
  const filters = [...document.querySelectorAll('.th-platforms_button[data-filter]')];
  const update = () => filters.forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    if (button.getAttribute('data-filter')?.toLowerCase() === 'predictions') {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    }
  });
  filters.forEach(button => button.addEventListener('click', update));
  update();
}

function installBanner() {
  document.addEventListener('click', event => {
    const close = event.target.closest?.('[nav-banner] .icon-x');
    if (!close) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close.closest('[nav-banner]').hidden = true;
    document.querySelector('.navbar-logo')?.focus({ preventScroll: true });
  }, true);
  document.addEventListener('keydown', event => {
    const close = event.target.closest?.('[nav-banner] .icon-x');
    if (close && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
}

function initialize() {
  if (document.documentElement.hasAttribute('data-db-controls-ready')) return;
  document.documentElement.setAttribute('data-db-controls-ready', '');
  installMenu();
  installDisclosures();
  installFilters();
  installBanner();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
