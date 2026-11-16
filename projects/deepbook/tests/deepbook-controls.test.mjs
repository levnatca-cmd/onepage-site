import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { patchInteractionScript } from '../tools/patch-controls.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('mirror-manifest.json', root), 'utf8'));
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attrs = node => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
const content = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(content).join('');

for (const page of manifest.pages) {
  test(`${page.file}: generated header is keyboard accessible without changing icon paths`, async () => {
    const output = nodes(parse(await readFile(new URL(page.file, root), 'utf8')));
    const source = nodes(parse(await readFile(new URL(page.rawFile, root), 'utf8')));
    const hamburger = output.find(n => attrs(n).id === 'hamb-button');
    assert.equal(hamburger.tagName, 'button');
    assert.equal(attrs(hamburger).type, 'button');
    assert.equal(attrs(hamburger)['aria-label'], 'Open menu');
    assert.equal(attrs(hamburger)['aria-expanded'], 'false');
    const panel = output.find(n => (attrs(n).class || '').split(/\s+/).includes('hamburger-component'));
    assert.ok(Object.hasOwn(attrs(panel), 'inert'));
    assert.equal(attrs(panel)['aria-hidden'], 'true');
    assert.ok(output.some(n => n.tagName === 'script' && attrs(n).src === '/local/controls.js'));
    assert.ok(output.some(n => n.tagName === 'link' && attrs(n).href === '/local/controls.css'));
    assert.deepEqual(output.filter(n => n.tagName === 'path').map(n => attrs(n).d),
      source.filter(n => n.tagName === 'path').map(n => attrs(n).d));
    assert.deepEqual(output.filter(n => n.tagName === 'h1').map(content), source.filter(n => n.tagName === 'h1').map(content));
  });
}

test('mobile Builder documentation action uses the existing documentation destination', async () => {
  const all = nodes(parse(await readFile(new URL('builder-hub/index.html', root), 'utf8')));
  const links = all.filter(n => n.tagName === 'a' && /Explore\s*Docs/.test(content(n)));
  assert.ok(links.length >= 2);
  for (const link of links) assert.equal(attrs(link).href, 'https://docs.sui.io/onchain-finance/deepbookv3/deepbook');
});

test('Builder disclosures keep original styles without Webflow dropdown event ownership', async () => {
  const all = nodes(parse(await readFile(new URL('builder-hub/index.html', root), 'utf8')));
  const items = all.filter(n => Object.hasOwn(attrs(n), 'global-tab-dd-item'));
  assert.equal(items.length, 9);
  for (const item of items) {
    const classes = (attrs(item).class || '').split(/\s+/);
    assert.ok(classes.includes('db-dropdown'));
    assert.ok(!classes.includes('w-dropdown'));
    assert.ok(nodes(item).some(n => (attrs(n).class || '').split(/\s+/).includes('w-dropdown-toggle')));
    assert.ok(nodes(item).some(n => (attrs(n).class || '').split(/\s+/).includes('w-dropdown-list')));
  }
});

test('Points primary action and Trader filters are native buttons', async () => {
  const points = nodes(parse(await readFile(new URL('points/index.html', root), 'utf8')));
  const connect = points.find(n => attrs(n).id === 'connectWallet');
  assert.equal(connect.tagName, 'button');
  assert.equal(attrs(connect).type, 'button');
  const trader = nodes(parse(await readFile(new URL('trader-hub/index.html', root), 'utf8')));
  const filters = trader.filter(n => (attrs(n).class || '').split(/\s+/).includes('th-platforms_button') && Object.hasOwn(attrs(n), 'data-filter'));
  assert.ok(filters.length >= 7);
  for (const filter of filters) {
    assert.equal(filter.tagName, 'button');
    assert.ok(Object.hasOwn(attrs(filter), 'aria-pressed'));
    if (attrs(filter)['data-filter'].toLowerCase() === 'predictions') assert.ok(Object.hasOwn(attrs(filter), 'disabled'));
  }
});

test('legacy disclosure initializers are disabled once and fail closed on unexpected source', async () => {
  const url = 'https://slater.app/19933/59952.js';
  const raw = await readFile(new URL('source/assets/slater.app/19933/59952.js', root), 'utf8');
  const output = patchInteractionScript(raw, url);
  assert.equal(patchInteractionScript(output, url), output);
  assert.ok(output.includes('function initMobileDropdown()'));
  assert.ok(output.includes('function initGlobalTabDropdown()'));
  assert.throws(() => patchInteractionScript('upstream changed', url));
  assert.equal(patchInteractionScript('unrelated', 'https://example.com/other.js'), 'unrelated');
});
