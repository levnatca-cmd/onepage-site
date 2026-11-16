import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse, serialize } from 'parse5';
import { patchInteractionScript } from './patch-controls.mjs';
import { patchMotionScript, patchMotionInline } from './patch-motion.mjs';
import { patchPointsInline } from './patch-points.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://deepbook-v2-wip.webflow.io';
const run = promisify(execFile);
const pages = new Map();
const assets = new Map();
const failures = [];
const siteHosts = new Set(['deepbook-v2-wip.webflow.io', 'www.deepbook.tech', 'deepbook.tech']);
const assetHosts = new Set(['cdn.prod.website-files.com', 'assets.website-files.com',
  'uploads-ssl.webflow.com', 'd3e54v103j8qbb.cloudfront.net', 'fonts.googleapis.com',
  'fonts.gstatic.com', 'slater.app', 'assets.slater.app', 'unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com']);

function urlOf(value, base) {
  if (!value || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(value)) return null;
  try { return new URL(value, base); } catch { return null; }
}

function assetUrl(value, base) {
  const url = urlOf(value, base);
  if (!url || !assetHosts.has(url.hostname)) return null;
  url.hash = '';
  if (url.hostname === 'assets.slater.app') {
    url.hostname = 'slater.app';
    url.pathname = url.pathname.replace(/^\/slater\//, '/');
  }
  if (url.hostname === 'slater.app') url.search = '';
  return url;
}

function assetPath(url) {
  let name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (url.search) {
    const hash = createHash('sha256').update(url.search).digest('hex').slice(0, 10);
    const ext = extname(name) || (url.hostname === 'fonts.googleapis.com' ? '.css' : '');
    name = `${ext ? name.slice(0, name.length - extname(name).length) : name}-${hash}${ext}`;
  }
  return `assets/${url.hostname}/${name || 'index'}`;
}

function register(value, base) {
  const url = assetUrl(value, base);
  if (!url) return;
  const key = url.href;
  if (!assets.has(key)) assets.set(key, { url: key, file: assetPath(url), state: 'pending' });
}

async function save(file, content) {
  const destination = resolve(root, file);
  if (!destination.startsWith(`${root}/`)) throw new Error('Destination outside deepbook');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

async function download(url, file) {
  const destination = resolve(root, file);
  await mkdir(dirname(destination), { recursive: true });
  if (!process.argv.includes('--refresh')) {
    const cached = file.startsWith('assets/') && /\.(?:css|js|mjs|json)$/.test(file)
      ? resolve(root, 'source', file) : destination;
    try {
      if ((await stat(cached)).size) {
        if (cached !== destination) await writeFile(destination, await readFile(cached));
        return;
      }
    } catch { /* Download resources that are not in the snapshot yet. */ }
  }
  await run('curl', ['-L', '--fail', '--silent', '--show-error', '--retry', '2',
    '--max-time', '90', '--user-agent', 'Mozilla/5.0', url, '-o', destination], { maxBuffer: 2 ** 20 });
}

function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
  if (node.content) walk(node.content, callback);
}

function text(node) { return (node.childNodes || []).map(child => child.value || '').join(''); }
function attr(node, name) { return node.attrs?.find(attribute => attribute.name === name)?.value; }
function setAttr(node, name, value) {
  const existing = node.attrs.find(attribute => attribute.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

function addClass(node, name) {
  const classes = new Set((attr(node, 'class') || '').split(/\s+/).filter(Boolean));
  classes.add(name);
  setAttr(node, 'class', [...classes].join(' '));
}

function plainText(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(plainText).join('');
}

function makeButton(node) {
  node.tagName = node.nodeName = 'button';
  setAttr(node, 'type', 'button');
  addClass(node, 'db-native-control');
  // Keep the original visual wrappers, using phrasing elements inside native buttons.
  walk(node, child => {
    if (child !== node && child.tagName === 'div') child.tagName = child.nodeName = 'span';
  });
}

function hasAncestorClass(node, name) {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if ((attr(parent, 'class') || '').split(/\s+/).includes(name)) return true;
  }
  return false;
}

function enhanceControl(node, pageFile) {
  if (attr(node, 'global-tab-dd-item') != null) {
    // Keep the Webflow base styling without registering a second disclosure owner.
    const classes = (attr(node, 'class') || '').split(/\s+/).filter(Boolean);
    setAttr(node, 'class', classes.map(name => name === 'w-dropdown' ? 'db-dropdown' : name).join(' '));
  }
  if (attr(node, 'id') === 'hamb-button') {
    makeButton(node);
    setAttr(node, 'aria-label', 'Open menu');
    setAttr(node, 'aria-expanded', 'false');
  } else if (attr(node, 'id') === 'connectWallet') {
    makeButton(node);
  } else if ((attr(node, 'class') || '').split(/\s+/).includes('th-platforms_button') && attr(node, 'data-filter') != null) {
    makeButton(node);
    setAttr(node, 'aria-pressed', String((attr(node, 'class') || '').split(/\s+/).includes('active')));
    if (attr(node, 'data-filter').toLowerCase() === 'predictions') {
      setAttr(node, 'disabled', '');
      setAttr(node, 'aria-disabled', 'true');
      addClass(node, 'is-disabled');
    }
  }
  if (attr(node, 'global-dd-toggle') != null || attr(node, 'global-tab-dd-toggle') != null) {
    setAttr(node, 'role', 'button');
    setAttr(node, 'tabindex', '0');
    setAttr(node, 'data-db-control', 'disclosure');
  }
  if ((attr(node, 'class') || '').split(/\s+/).includes('hamburger-component')) {
    setAttr(node, 'aria-hidden', 'true');
    setAttr(node, 'inert', '');
  }
  if (node.tagName === 'svg' && (attr(node, 'class') || '').split(/\s+/).includes('icon-x')) {
    setAttr(node, 'role', 'button');
    setAttr(node, 'tabindex', '0');
    setAttr(node, 'aria-label', 'Dismiss announcement');
  }
  if (node.tagName === 'a' && pageFile === 'builder-hub/index.html' &&
    !attr(node, 'href') && hasAncestorClass(node, 'bh-hero_mob-desc') && /Explore\s*Docs/.test(plainText(node))) {
    setAttr(node, 'href', 'https://docs.sui.io/onchain-finance/deepbookv3/deepbook');
  }
  if (node.tagName === 'a' && !plainText(node).trim() && !attr(node, 'aria-label')) {
    const href = attr(node, 'href') || '';
    if (href.includes('discord.com')) setAttr(node, 'aria-label', 'Discord');
    if (/https?:\/\/(?:x|twitter)\.com/.test(href)) setAttr(node, 'aria-label', 'X / Twitter');
  }
}

function cssUrls(content, base) {
  for (const match of content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) register(match[1].trim(), base);
}

function scriptUrls(content, base) {
  for (const match of content.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) {
    const url = assetUrl(match[1], base);
    if (url && /\.(?:js|mjs|css|json|woff2?|png|webp|svg|mp4)(?:\?|$)/i.test(url.href)) register(url.href, base);
  }
  for (const match of content.matchAll(/(?:import\s*\(|from\s+)["']([^"']+)["']/g)) {
    if (/^(?:https?:\/\/|\.\.?\/)/.test(match[1]) && /\.m?js(?:\?|$)/.test(match[1])) register(match[1], base);
  }
}

function gatherHtml(document, base) {
  walk(document, node => {
    const tag = node.tagName;
    for (const attribute of node.attrs || []) {
      const { name, value } = attribute;
      if (['src', 'poster', 'data-src', 'data-poster-url'].includes(name)) register(value, base);
      if (name === 'srcset') for (const candidate of value.split(',')) register(candidate.trim().split(/\s+/)[0], base);
      if (name === 'data-video-urls') for (const value of attribute.value.split(',')) register(value, base);
      if (name === 'style') cssUrls(value, base);
    }
    if (tag === 'link' && /stylesheet|icon/.test(attr(node, 'rel') || '')) register(attr(node, 'href'), base);
    if (tag === 'meta' && /^(?:og:image|twitter:image)$/.test(attr(node, 'property') || attr(node, 'name') || '')) register(attr(node, 'content'), base);
    if (tag === 'style') cssUrls(text(node), base);
    if (tag === 'script' && !attr(node, 'src')) scriptUrls(text(node), base);
  });
}

function local(value, base, from) {
  const url = assetUrl(value, base);
  const entry = url && assets.get(url.href);
  if (!entry || entry.state !== 'done') return value;
  let path = relative(dirname(from), entry.file).split('\\').join('/');
  if (!path.startsWith('.')) path = `./${path}`;
  return path.split('/').map(part => encodeURIComponent(part)).join('/') + (urlOf(value, base)?.hash || '');
}

function rewriteCss(content, base, from) {
  return content.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,
    (all, quote, value) => `url("${local(value.trim(), base, from)}")`);
}

function rewriteJs(content, base, from) {
  return content.replace(/(["'`])(https?:\/\/[^"'`\s]+)\1/g,
    (all, quote, value) => `${quote}${local(value, base, from)}${quote}`);
}

function preserveSource(original, document, rewrite) {
  const before = [];
  walk(document, node => before.push({ node, tagName: node.tagName, value: node.value,
    attrs: node.attrs?.map(attribute => ({ ...attribute })) }));
  rewrite();
  const active = new Set();
  walk(document, node => active.add(node));
  const edits = [];
  const add = (start, end, value) => edits.push({ start, end, value });
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  for (const item of before) {
    const { node } = item;
    const location = node.sourceCodeLocation;
    if (!location) continue;
    if (!active.has(node)) {
      if (active.has(node.parentNode)) add(location.startOffset, location.endOffset, '');
      continue;
    }
    if (typeof item.value === 'string' && item.value !== node.value) {
      add(location.startOffset, location.endOffset, node.value);
    }
    if (item.tagName && node.tagName !== item.tagName) {
      add(location.startTag.startOffset + 1, location.startTag.startOffset + 1 + item.tagName.length, node.tagName);
      if (location.endTag) add(location.endTag.startOffset + 2,
        location.endTag.startOffset + 2 + item.tagName.length, node.tagName);
    }
    for (const attribute of item.attrs || []) {
      const current = node.attrs.find(value => value.name === attribute.name && value.prefix === attribute.prefix);
      if (current?.value === attribute.value) continue;
      const name = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
      const range = location.attrs?.[name];
      if (range) add(range.startOffset, range.endOffset, current ? `${name}="${escape(current.value)}"` : '');
    }
    for (const attribute of node.attrs || []) {
      if (item.attrs?.some(value => value.name === attribute.name)) continue;
      const end = location.startTag?.endOffset;
      if (end) add(end - (original.slice(end - 2, end) === '/>' ? 2 : 1),
        end - (original.slice(end - 2, end) === '/>' ? 2 : 1), ` ${attribute.name}="${escape(attribute.value)}"`);
    }
    if (node.tagName === 'head') {
      const additions = node.childNodes.filter(child => !child.sourceCodeLocation);
      if (additions.length) add(location.endTag.startOffset, location.endTag.startOffset,
        additions.map(child => serialize({ nodeName: '#document-fragment', childNodes: [child] })).join(''));
    }
  }
  let output = original;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  }
  return output;
}

function rewriteHtml(document, base, from) {
  walk(document, node => {
    if (node.childNodes) node.childNodes = node.childNodes.filter(child => {
      if (child.tagName === 'link' && /preconnect|dns-prefetch/.test(attr(child, 'rel') || '')) return false;
      if (child.tagName === 'meta' && /google-site-verification/.test(attr(child, 'name') || '')) return false;
      if (child.tagName !== 'script') return true;
      const source = attr(child, 'src') || '';
      return !source.includes('/wvxwa') && !source.includes('/webfont/') &&
        !/google_tags_first_party|dataLayer|WebFont\.load\(/.test(text(child)) &&
        !(text(child).includes("getElementById('hamb-button')") && text(child).includes("classList.toggle('menu-open')"));
    });
    if (!node.attrs) return;
    enhanceControl(node, from);
    if (node.tagName === 'html') {
      setAttr(node, 'data-wf-domain', 'deepbook.local');
      node.attrs = node.attrs.filter(attribute => attribute.name !== 'data-wf-status');
    }
    for (const attribute of node.attrs) {
      const { name, value } = attribute;
      if (name === 'href' && node.tagName === 'a') {
        const url = urlOf(value, base);
        const page = url && siteHosts.has(url.hostname) && pages.get(url.pathname.replace(/\/$/, '') || '/');
        if (page) {
          attribute.value = `${url.pathname}${url.search}${url.hash}`;
        }
      } else if (['src', 'href', 'poster', 'data-src', 'data-poster-url', 'content'].includes(name)) {
        attribute.value = local(value, base, from);
      } else if (name === 'srcset') {
        attribute.value = value.split(',').map(candidate => {
          const [url, ...size] = candidate.trim().split(/\s+/);
          return [local(url, base, from), ...size].join(' ');
        }).join(', ');
      } else if (name === 'data-video-urls') attribute.value = value.split(',').map(url => local(url, base, from)).join(',');
      else if (name === 'style') attribute.value = rewriteCss(value, base, from);
    }
    node.attrs = node.attrs.filter(attribute => !['integrity', 'crossorigin'].includes(attribute.name));
    if (node.tagName === 'script' && !attr(node, 'src')) {
      for (const child of node.childNodes || []) if (child.value) {
        child.value = patchPointsInline(patchMotionInline(rewriteJs(child.value, base, from), from));
      }
    }
    if (node.tagName === 'style') {
      for (const child of node.childNodes || []) if (child.value) child.value = rewriteCss(child.value, base, from);
    }
    if (node.tagName === 'head') {
      const additions = parse('<head><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="' +
        local('https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700&display=swap', base, from) +
        '"><link rel="stylesheet" href="/local/controls.css"><script type="module" src="/local/controls.js"></script></head>');
      const html = additions.childNodes.find(n => n.tagName === 'html');
      const head = html.childNodes.find(n => n.tagName === 'head');
      for (const child of head.childNodes) { child.parentNode = node; node.childNodes.push(child); }
    }
  });
}

const slugs = ['', 'builder-hub', 'trader-hub', 'deep-token', 'points', 'privacy-policy', 'terms-of-use'];
await Promise.allSettled(slugs.map(async slug => {
  const url = `${origin}/${slug}`;
  const rawFile = `source/pages/${slug || 'home'}.html`;
  const file = slug ? `${slug}/index.html` : 'index.html';
  await download(url, rawFile);
  const html = await readFile(resolve(root, rawFile), 'utf8');
  if (!html.includes('data-wf-page=')) throw new Error(`Not a Webflow page: ${url}`);
  const document = parse(html, { sourceCodeLocationInfo: true });
  pages.set(`/${slug}`, { url, file, rawFile, document, html });
  gatherHtml(document, url);
  console.log(`Page: /${slug}`);
})).then(results => results.forEach((result, i) => {
  if (result.status === 'rejected') failures.push({ url: `${origin}/${slugs[i]}`, error: result.reason.message });
}));

register('https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700&display=swap', origin);
for (;;) {
  const pending = [...assets.values()].filter(entry => entry.state === 'pending').slice(0, 6);
  if (!pending.length) break;
  await Promise.allSettled(pending.map(async entry => {
    entry.state = 'loading';
    try {
      await download(entry.url, entry.file);
      entry.bytes = (await stat(resolve(root, entry.file))).size;
      if (/\.(?:css|js|mjs|json)$/.test(entry.file)) {
        entry.text = await readFile(resolve(root, entry.file), 'utf8');
        await save(`source/${entry.file}`, entry.text);
        if (/\.css$/.test(entry.file)) cssUrls(entry.text, entry.url);
        if (/\.(?:js|mjs)$/.test(entry.file)) scriptUrls(entry.text, entry.url);
      }
      entry.state = 'done';
    } catch (error) {
      entry.state = 'failed';
      failures.push({ url: entry.url, error: error.message });
    }
  }));
  console.log(`Assets: ${[...assets.values()].filter(entry => entry.state === 'done').length}/${assets.size}`);
}

for (const entry of assets.values()) {
  if (!entry.text || entry.state !== 'done') continue;
  let output = entry.text;
  if (/\.css$/.test(entry.file)) output = rewriteCss(output, entry.url, entry.file);
  if (/\.(?:js|mjs)$/.test(entry.file)) {
    output = patchInteractionScript(patchMotionScript(rewriteJs(output, entry.url, entry.file), entry.url), entry.url);
  }
  await save(entry.file, output);
}
for (const page of pages.values()) {
  const output = preserveSource(page.html, page.document,
    () => rewriteHtml(page.document, page.url, page.file));
  await save(page.file, output);
}
const manifest = {
  source: origin,
  reference: 'https://www.awwwards.com/sites/deepbook',
  capturedAt: new Date().toISOString(),
  pages: [...pages.values()].map(({ url, file, rawFile }) => ({ url, file, rawFile })),
  assets: [...assets.values()].map(({ text, ...entry }) => entry),
  failures,
  localEnhancements: ['local/controls.css', 'local/controls.js'],
  htmlMode: 'Original source with targeted URL/head edits; no HTML reserialization',
  adjustments: ['Original root-relative page routes and local asset URLs', 'Removed analytics and Google verification',
    'Self-hosted Inter font CSS instead of remote WebFont loader', 'Local snapshots marked noindex,nofollow',
    'Set snapshot Webflow domain to deepbook.local to preserve the original badge-free rendering',
    'Local QA fixes: accessible controls, synchronized disclosure states, Docs URL, resize and Points recovery'],
};
await save('mirror-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ pages: pages.size, assets: assets.size, failures: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
