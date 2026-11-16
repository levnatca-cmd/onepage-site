// Generation-time repairs only; the immutable Slater/Webflow snapshot stays untouched.
const marker = '// DeepBook motion/resize QA patch v1';

function replaceOnce(source, before, after, label) {
  const start = source.indexOf(before);
  if (start < 0 || source.indexOf(before, start + before.length) >= 0) {
    throw new Error(`DeepBook motion patch: expected one ${label}`);
  }
  return source.slice(0, start) + after + source.slice(start + before.length);
}

function replaceSection(source, start, end, replacement, label) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`DeepBook motion patch: missing ${label}`);
  return replaceOnce(source, source.slice(from, to), replacement, label);
}

const lenisSetup = `const deepbookMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lenis = null;
const lenisScrollHandlers = new Set([ScrollTrigger.update]);
function onLenisScroll(handler) {
  if (lenisScrollHandlers.has(handler)) return;
  lenisScrollHandlers.add(handler);
  lenis?.on('scroll', handler);
}
const tickLenis = (time) => { lenis?.raf(time * 1000); };
function syncLenisMotion() {
  gsap.ticker.remove(tickLenis);
  if (deepbookMotion.matches) {
    lenis?.destroy();
    lenis = null;
    return;
  }
  if (!lenis) {
    lenis = new Lenis({ autoRaf: false, anchors: true, stopInertiaOnNavigate: true });
    lenisScrollHandlers.forEach(handler => lenis.on('scroll', handler));
  }
  gsap.ticker.add(tickLenis);
}
deepbookMotion.addEventListener('change', syncLenisMotion);
syncLenisMotion();

`;

const textReveal = `(function () {
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('suiEase', 'M0,0 C0.19,1 0.22,1 1,1');

  document.fonts.ready.then(() => {
    const records = Array.from(document.querySelectorAll('[data-reveal]'), el => ({
      el, split: null, tween: null, trigger: null, revealed: false
    }));
    if (!records.length) return;

    const cleanup = (record) => {
      record.trigger?.kill();
      record.tween?.kill();
      record.split?.revert();
      record.trigger = record.tween = record.split = null;
    };
    const rebuild = () => {
      records.forEach(record => {
        cleanup(record);
        const { el } = record;
        // Once entered (including an interrupted reveal), never hide/replay the heading.
        if (record.revealed || deepbookMotion.matches) {
          record.revealed = true;
          el.classList.add('is-ready');
          return;
        }
        const split = record.split = SplitText.create(el, { type: 'lines' });
        gsap.set(split.lines, { transformPerspective: 600 });
        gsap.set(split.lines, { yPercent: 100, rotateX: -45, opacity: 0 });
        el.classList.add('is-ready');
        record.trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            record.revealed = true;
            record.tween = gsap.to(split.lines, {
              yPercent: 0,
              rotateX: 0,
              opacity: 1,
              duration: 0.937,
              ease: 'suiEase',
              stagger: 0.08
            });
          }
        });
      });
      ScrollTrigger.refresh();
    };
    let width = window.innerWidth;
    let timer;
    window.addEventListener('resize', () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(rebuild, 150);
    });
    deepbookMotion.addEventListener('change', rebuild);
    document.fonts.addEventListener?.('loadingdone', rebuild);
    rebuild();
  });
})();

`;

const nav = `let currentBreakpoint = null;
let marqueeAnimation = null;
let bannerTrack = null;
let navCleanups = [];
let navWidth = window.innerWidth;

function getBreakpoint() {
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function cleanupNav() {
  marqueeAnimation?.kill();
  marqueeAnimation = null;
  navCleanups.forEach(cleanup => cleanup());
  navCleanups = [];
  if (bannerTrack) {
    const banner = bannerTrack.querySelector('[data-banner]');
    if (banner && bannerTrack.parentNode) {
      bannerTrack.parentNode.insertBefore(banner, bannerTrack);
    }
    bannerTrack.remove();
    bannerTrack = null;
  }
}

function initNav() {
  cleanupNav();
  const navWrapper = document.querySelector('[nav-banner]');
  if (!navWrapper) return;
  const isMobile = getBreakpoint() === 'mobile';
  const navClose = navWrapper.querySelector('.icon-x');
  if (navClose) {
    const close = () => gsap.set(navWrapper, { display: 'none' });
    navClose.addEventListener('click', close);
    navCleanups.push(() => navClose.removeEventListener('click', close));
  }

  if (!isMobile) {
    navWrapper.querySelectorAll('[data-nav-link]').forEach(el => {
      const underline = document.createElement('span');
      underline.setAttribute('data-deepbook-nav-underline', '');
      underline.setAttribute('aria-hidden', 'true');
      underline.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left center;';
      const position = el.style.position;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.appendChild(underline);
      let hoverTween;
      const animate = (scaleX, transformOrigin) => {
        hoverTween?.kill();
        if (deepbookMotion.matches) return;
        hoverTween = gsap.to(underline, { scaleX, duration: 0.45, transformOrigin });
      };
      const enter = () => animate(1, 'left center');
      const leave = () => animate(0, 'right center');
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      navCleanups.push(() => {
        hoverTween?.kill();
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        underline.remove();
        el.style.position = position;
      });
    });
    return;
  }

  const wrapper = navWrapper.querySelector('[data-wrapper-banner]');
  const banner = wrapper?.querySelector('[data-banner]');
  if (!wrapper || !banner) return;
  if (deepbookMotion.matches) {
    const setStaticStyles = (el, styles) => {
      if (!el) return;
      const previous = Object.keys(styles).map(property => [
        property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property)
      ]);
      Object.entries(styles).forEach(([property, value]) => el.style.setProperty(property, value));
      navCleanups.push(() => previous.forEach(([property, value, priority]) => {
        if (value) el.style.setProperty(property, value, priority);
        else el.style.removeProperty(property);
      }));
    };
    // Let larger text grow the original flex chain without changing dismissal state.
    setStaticStyles(navWrapper, { height: 'auto', 'max-height': 'none' });
    setStaticStyles(navWrapper.querySelector('.pencil-wrapper'), {
      flex: '1 1 0%', 'min-width': '0', width: 'auto', height: 'auto', 'max-height': 'none'
    });
    setStaticStyles(wrapper, {
      display: 'block', 'min-width': '0', width: '100%', 'max-width': '100%',
      height: 'auto', 'max-height': 'none', overflow: 'visible'
    });
    setStaticStyles(banner, {
      display: 'block', 'min-width': '0', width: '100%', 'max-width': '100%',
      height: 'auto', 'max-height': 'none', 'white-space': 'normal',
      'overflow-wrap': 'anywhere', 'line-height': '1.4'
    });
    wrapper.querySelectorAll('.mob_fader').forEach(fader => setStaticStyles(fader, { display: 'none' }));
    return;
  }
  const track = bannerTrack = document.createElement('div');
  track.setAttribute('data-deepbook-banner-track', '');
  track.style.cssText = 'display:flex;gap:0.5em;will-change:transform;backface-visibility:hidden;perspective:1000px;width:fit-content;';
  wrapper.insertBefore(track, banner);
  track.appendChild(banner);
  const gap = parseFloat(getComputedStyle(track).gap) || 0;
  const bannerWidth = Math.max(banner.getBoundingClientRect().width, banner.scrollWidth) + gap;
  if (!Number.isFinite(bannerWidth) || bannerWidth <= 0) {
    wrapper.insertBefore(banner, track);
    track.remove();
    bannerTrack = null;
    return;
  }
  const copies = Math.ceil(wrapper.offsetWidth / bannerWidth) + 2;
  for (let i = 0; i < copies; i++) {
    const clone = banner.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.setAttribute('tabindex', '-1');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    track.appendChild(clone);
  }
  marqueeAnimation = gsap.to(track, {
    x: -bannerWidth,
    duration: 10,
    ease: 'none',
    repeat: -1,
    modifiers: { x: gsap.utils.unitize(x => parseFloat(x) % bannerWidth) }
  });
}

function handleResizes() {
  const next = getBreakpoint();
  if (next !== currentBreakpoint || (next === 'mobile' && window.innerWidth !== navWidth)) {
    currentBreakpoint = next;
    navWidth = window.innerWidth;
    initNav();
  }
}

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleResizes, 150);
});
deepbookMotion.addEventListener('change', initNav);
document.fonts.ready.then(() => { if (getBreakpoint() === 'mobile') initNav(); });
document.fonts.addEventListener?.('loadingdone', () => {
  if (getBreakpoint() === 'mobile') initNav();
});
currentBreakpoint = getBreakpoint();
initNav();
`;

function patchCore(source) {
  source = replaceSection(source, 'const lenis = new Lenis({', 'gsap.ticker.lagSmoothing(0);', lenisSetup, 'Lenis setup');
  source = replaceOnce(source, "  lenis.on('scroll', () => {", "  onLenisScroll(() => {", 'carousel Lenis subscription');
  source = replaceSection(source, "(function () {\n  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);", 'let currentBreakpoint = null;', textReveal, 'text reveal');
  return replaceOnce(source, source.slice(source.indexOf('let currentBreakpoint = null;')), nav, 'nav lifecycle');
}

function patchHome(source) {
  source = replaceOnce(source, "    const ctx = canvas.getContext('2d');", `    const ctx = canvas.getContext('2d');
    const heroMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let heroRaf = null;`, 'Home canvas context');
  source = replaceOnce(source, '      offY = (H - REF_H * SCALE) / 2;', `      offY = (H - REF_H * SCALE) / 2;
      if (heroMotion.matches) draw(performance.now());`, 'Home canvas resize');
  source = replaceOnce(source, '      phase += CFG.omega * dt;', '      if (!heroMotion.matches) phase += CFG.omega * dt;', 'Home canvas phase');
  source = replaceOnce(source, '      requestAnimationFrame(draw);', '      if (!heroMotion.matches) heroRaf = requestAnimationFrame(draw);', 'Home canvas frame loop');
  return replaceOnce(source, '    resize();\n    requestAnimationFrame(draw);', `    heroMotion.addEventListener('change', () => {
      if (heroRaf !== null) cancelAnimationFrame(heroRaf);
      heroRaf = null;
      lastTime = performance.now();
      draw(lastTime);
    });
    resize();
    if (!heroMotion.matches) heroRaf = requestAnimationFrame(draw);`, 'Home canvas startup');
}

function patchBuilder(source) {
  source = replaceOnce(source, "    const ctx = canvas.getContext('2d');", `    const ctx = canvas.getContext('2d');
    const barsMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const blinkCalls = new Set();`, 'Builder canvas context');
  source = replaceOnce(source, '    gsap.ticker.add(draw);', '', 'Builder draw ticker');
  source = replaceOnce(source, '      if (blinkTl) blinkTl.kill();', `      if (blinkTl) blinkTl.kill();
      leftTl = middleTl = rightTl = blinkTl = null;
      blinkCalls.forEach(call => call.kill());
      blinkCalls.clear();
      if (barsMotion.matches) {
        draw();
        return;
      }`, 'Builder timeline cleanup');
  source = replaceOnce(source, '            gsap.delayedCall(0.8 + Math.random() * 0.6, () => { dash.isBlue = false; });', `            const call = gsap.delayedCall(0.8 + Math.random() * 0.6, () => {
              dash.isBlue = false;
              blinkCalls.delete(call);
            });
            blinkCalls.add(call);`, 'Builder blink ownership');
  return replaceOnce(source, "resize();\nwindow.addEventListener('resize', onResize);", `const syncBarsMotion = () => {
  gsap.ticker.remove(draw);
  if (!barsMotion.matches) gsap.ticker.add(draw);
  resize();
};
barsMotion.addEventListener('change', syncBarsMotion);
syncBarsMotion();
window.addEventListener('resize', onResize);`, 'Builder startup');
}

/** Transform only the owned original Slater assets (query strings are permitted). */
export function patchMotionScript(source, url) {
  if (source.includes(marker)) return source;
  const path = String(url).replace(/[?#].*$/, '');
  const id = path.match(/\/(?:slater\/)?19933\/(59952|59953|60445)\.js$/)?.[1];
  if (!id || !source.startsWith('// This file was generated by Slater.app - ')) return source;
  const patch = { 59952: patchCore, 59953: patchHome, 60445: patchBuilder }[id];
  return `${marker}\n${patch(source.replaceAll('\r\n', '\n'))}`;
}

/** Transform only the project-card Swiper script on Builder Hub and Points. */
export function patchMotionInline(source, pageFile) {
  if (source.includes(marker) || !/(?:^|\/)(?:builder-hub|points)(?:\.html|\/index\.html|\/?)$/.test(String(pageFile))) return source;
  if (!source.includes('function initFinanceSlider() {')) return source;
  const before = `function initFinanceSlider() {
  if (window.innerWidth > 991) return;
  const slider = document.querySelector('#projects-slider');
  if (!slider) return;
  if (slider.classList.contains('swiper-initialized')) return;
  new Swiper(slider, {`;
  const after = `function initFinanceSlider() {
  const slider = document.querySelector('#projects-slider');
  if (!slider) return;
  const instance = slider.swiper;
  if (window.innerWidth > 991) {
    if (instance && !instance.destroyed) instance.destroy(true, true);
    if (slider._deepbookFinanceActive || slider.classList.contains('swiper-initialized')) {
      const track = slider.querySelector('.global-projects_grid');
      ['transform', 'transition-duration', 'transition-delay', 'width'].forEach(prop => track?.style.removeProperty(prop));
      slider.querySelectorAll('.global-projects_grid-item').forEach(slide => {
        ['width', 'margin-right', 'margin-left'].forEach(prop => slide.style.removeProperty(prop));
      });
      slider.classList.remove('swiper-initialized', 'swiper-horizontal', 'swiper-vertical', 'swiper-backface-hidden');
    }
    slider._deepbookFinanceActive = false;
    return;
  }
  if (instance && !instance.destroyed) return;
  slider._deepbookFinanceActive = true;
  new Swiper(slider, {`;
  return `${marker}\n${replaceOnce(source.replaceAll('\r\n', '\n'), before, after, 'finance slider setup')}`;
}
