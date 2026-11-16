import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';
import { patchPointsInline } from '../tools/patch-points.mjs';

const originalFile = new URL('../source/pages/points.html', import.meta.url);
const originalHtml = await readFile(originalFile, 'utf8');
const tree = parse(originalHtml);
const nodes = [];
function walk(node) {
  nodes.push(node);
  for (const child of node.childNodes || []) walk(child);
}
walk(tree);
const inlineScripts = nodes.filter(node => node.tagName === 'script' &&
  !node.attrs.some(attr => attr.name === 'src'))
  .map(node => node.childNodes.map(child => child.value || '').join(''));
const walletScripts = inlineScripts.filter(source => source.includes('esm.sh/@mysten/wallet-standard'));
assert.equal(walletScripts.length, 1, 'Extract exactly one original wallet module with parse5');
const originalScript = walletScripts[0];
const patchedScript = patchPointsInline(originalScript);
const address = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const endpoint = `https://deepbook-indexer.mainnet.mystenlabs.com/get_points?addresses=${address}`;

// Only the DOM operations used by this inline module are implemented. The two
// section trees come from the immutable snapshot, including the status ancestry.
class Element {
  constructor(node = { tagName: 'div' }) {
    this.tagName = node.tagName.toUpperCase();
    this.attrs = new Map((node.attrs || []).map(attr => [attr.name, attr.value]));
    this.childNodes = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.disabled = false;
    const styles = new Map((this.attrs.get('style') || '').split(';').filter(Boolean)
      .map(value => value.split(':').map(part => part.trim())));
    this.style = {
      setProperty: (name, value) => styles.set(name, String(value)),
      getPropertyValue: name => styles.get(name) || '',
    };
    for (const child of node.childNodes || []) {
      if (child.tagName) this.append(new Element(child));
      else if (child.nodeName === '#text') this.append(child.value);
    }
  }

  append(...children) {
    for (const child of children) {
      if (child instanceof Element) child.parentElement = this;
      this.childNodes.push(child);
    }
  }

  set textContent(value) {
    for (const child of this.childNodes) {
      if (child instanceof Element) child.parentElement = null;
    }
    this.childNodes = [String(value)];
  }

  get textContent() {
    return this.childNodes.map(child => typeof child === 'string' ? child : child.textContent).join('');
  }

  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const match = /^\[([\w-]+)\]$/.exec(selector);
    assert.ok(match, `Unexpected selector: ${selector}`);
    const found = [];
    for (const child of this.childNodes) {
      if (!(child instanceof Element)) continue;
      if (child.attrs.has(match[1])) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

function visible(element) {
  for (let current = element; current; current = current.parentElement) {
    if (current.style.getPropertyValue('display') === 'none' || current.attrs.has('hidden')) return false;
  }
  return true;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (points = 1234.5) => ({ ok: true, json: async () => [{ total_points: points }] });

async function harness({ script = patchedScript, fetchImpl = async () => response(),
  connectImpl = async () => {}, hasWallet = true, accounts = [{ address }] } = {}) {
  const root = new Element();
  const byId = new Map();
  for (const id of ['connect-section', 'balance-section']) {
    const original = nodes.find(node => node.attrs?.some(attr => attr.name === 'id' && attr.value === id));
    assert.ok(original, `Snapshot contains #${id}`);
    root.append(new Element(original));
  }
  const index = element => {
    if (element.getAttribute('id')) byId.set(element.getAttribute('id'), element);
    for (const child of element.childNodes) if (child instanceof Element) index(child);
  };
  index(root);
  const button = byId.get('connectWallet');
  // The mirror owner supplies this conversion, retaining the original label/classes.
  button.tagName = 'BUTTON';
  button.setAttribute('type', 'button');
  button.attrs.delete('target');
  const documentListeners = new Map();
  const registryListeners = new Map();
  const calls = { connect: 0, fetch: [] };
  const wallet = {
    name: 'Slush',
    accounts,
    features: { 'standard:connect': { connect: async () => {
      calls.connect++;
      return connectImpl();
    } } },
  };
  const wallets = hasWallet ? [wallet] : [];
  const window = {};
  const executable = script.replace(
    /import\s*\{\s*getWallets\s*\}\s*from\s*['"]https:\/\/esm\.sh\/@mysten\/wallet-standard['"];?/, '');
  assert.notEqual(executable, script, 'Only the remote wallet import is stripped for VM injection');
  runInNewContext(executable, {
    window,
    document: {
      getElementById: id => byId.get(id) || null,
      querySelectorAll: selector => root.querySelectorAll(selector),
      addEventListener: (name, callback) => documentListeners.set(name, callback),
      createElement: tagName => new Element({ tagName }),
    },
    getWallets: () => ({
      get: () => wallets,
      on: (name, callback) => registryListeners.set(name, callback),
    }),
    fetch: async (...args) => {
      calls.fetch.push(args);
      return fetchImpl(...args);
    },
  }, { filename: 'original-points-wallet.transformed.js', timeout: 1000 });
  await documentListeners.get('DOMContentLoaded')();
  return {
    button, calls, wallet, wallets, window, registryListeners,
    status: byId.get('walletStatus'),
    connectSection: byId.get('connect-section'),
    balanceSection: byId.get('balance-section'),
    points: root.querySelectorAll('[total-points]'),
    click: () => button.listeners.get('click')({ preventDefault() {} }),
  };
}

function assertRecovery(ui, label = 'Retry Points') {
  assert.ok(visible(ui.status), 'Status and its snapshot ancestors stay visible');
  assert.ok(visible(ui.button), 'Recovery control stays visible');
  assert.equal(ui.button.tagName, 'BUTTON');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.textContent, label);
  assert.equal(ui.button.getAttribute('aria-busy'), 'false');
  assert.equal(ui.balanceSection.getAttribute('aria-busy'), 'false');
  assert.equal(ui.status.getAttribute('role'), 'status');
  assert.equal(ui.status.getAttribute('aria-live'), 'polite');
  assert.equal(ui.status.getAttribute('aria-atomic'), 'true');
}

function assertUnknown(ui) {
  assert.equal(ui.points.length, 2, 'Both original points displays are exercised');
  assert.deepEqual(ui.points.map(element => element.textContent), ['--', '--']);
  assert.doesNotMatch(ui.status.textContent, /Points loaded|Wallet connected/);
}

test('patch is scoped, deterministic, idempotent, and leaves the original file immutable', async () => {
  assert.notEqual(patchedScript, originalScript);
  assert.equal(patchPointsInline(originalScript), patchedScript);
  assert.equal(patchPointsInline(patchedScript), patchedScript);
  for (const script of inlineScripts.filter(script => script !== originalScript)) {
    assert.equal(patchPointsInline(script), script);
  }
  for (const script of ['', 'const x = "esm.sh/@mysten/wallet-standard";',
    'import { getWallets } from "https://example.com/wallet-standard";']) {
    assert.equal(patchPointsInline(script), script);
  }
  const originalUrlLine = originalScript.split('\n').find(line => line.includes('const url ='));
  assert.ok(patchedScript.includes(originalUrlLine), 'Service URL construction remains byte-identical');
  assert.ok(patchedScript.startsWith(originalScript.slice(0, originalScript.indexOf('function showBalanceSection()'))));
  assert.ok(patchedScript.endsWith(originalScript.slice(originalScript.indexOf('\non("register"'))));
  assert.throws(() => patchPointsInline(originalScript.replace('const points = data[0].total_points ?? 0;',
    'const points = changedUpstream();')), /no longer matches the original wallet module/);
  assert.equal(await readFile(originalFile, 'utf8'), originalHtml);
});

test('success exposes loading feedback and guards duplicate in-flight fetches', async () => {
  const request = deferred();
  const ui = await harness({ fetchImpl: () => request.promise });
  assertUnknown(ui);
  assert.equal(visible(ui.balanceSection), false);
  assertRecovery(ui, 'Connect Wallet');
  const originalClass = ui.button.getAttribute('class');
  const label = ui.button.querySelector('[global-target]');
  const pending = ui.click();
  await settle();
  assert.equal(ui.calls.connect, 1);
  assert.deepEqual(ui.calls.fetch, [[endpoint]]);
  assert.equal(ui.status.textContent, 'Loading points...');
  assert.ok(visible(ui.status));
  assert.ok(visible(ui.balanceSection));
  assertUnknown(ui);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.button.getAttribute('aria-busy'), 'true');
  assert.equal(ui.balanceSection.getAttribute('aria-busy'), 'true');
  // Dispatch directly even though a native disabled button would suppress clicks.
  await ui.click();
  assert.equal(ui.calls.fetch.length, 1);
  request.resolve(response(9876.125));
  await pending;
  assert.deepEqual(ui.points.map(element => element.textContent), ['9876.125', '9876.125']);
  assert.match(ui.status.textContent, /Points loaded for 0x1234\.\.\.cdef\./);
  assert.equal(ui.window.connectedSuiAddress, address);
  assertRecovery(ui, 'Refresh Points');
  assert.equal(ui.button.getAttribute('class'), originalClass);
  assert.equal(ui.button.querySelector('[global-target]'), label, 'Keep the styled label wrapper');
});

test('returned numbers and numeric strings retain original rendering, including explicit zero', async t => {
  for (const points of [0, '0', '0.0000', 123456.789, '0012345.6700', '900719925474099312345678.00']) {
    await t.test(JSON.stringify(points), async () => {
      const ui = await harness({ fetchImpl: async () => response(points) });
      const baseline = await harness({ script: originalScript, fetchImpl: async () => response(points) });
      await baseline.click();
      await ui.click();
      assert.deepEqual(ui.points.map(element => element.textContent),
        baseline.points.map(element => element.textContent));
      assert.equal(ui.points[0].textContent, String(points));
      assert.match(ui.status.textContent, /Points loaded/);
      assertRecovery(ui, 'Refresh Points');
    });
  }
});

test('rejected fetch is visible and retries the connected address without reauthorization', async () => {
  let attempt = 0;
  const ui = await harness({ fetchImpl: async () => {
    if (++attempt === 1) throw new Error('Mock indexer offline');
    return response(42);
  } });
  await ui.click();
  assertUnknown(ui);
  assert.match(ui.status.textContent, /Could not load points.*Try again/);
  assertRecovery(ui);
  assert.ok(visible(ui.balanceSection));
  await ui.click();
  assert.equal(ui.calls.connect, 1);
  assert.deepEqual(ui.calls.fetch, [[endpoint], [endpoint]]);
  assert.deepEqual(ui.points.map(element => element.textContent), ['42', '42']);
  assertRecovery(ui, 'Refresh Points');
});

test('refresh clears stale success and points before a failed request', async () => {
  const request = deferred();
  let attempt = 0;
  const ui = await harness({ fetchImpl: () => ++attempt === 1 ? response(99) : request.promise });
  await ui.click();
  assert.match(ui.status.textContent, /Points loaded/);
  const pending = ui.click();
  assert.equal(ui.status.textContent, 'Loading points...');
  assertUnknown(ui);
  request.reject(new Error('Mock refresh failure'));
  await pending;
  assertUnknown(ui);
  assertRecovery(ui);
  assert.equal(ui.calls.connect, 1);
});

test('non-2xx responses fail before reading a zero-valued JSON body', async () => {
  let jsonCalls = 0;
  const ui = await harness({ fetchImpl: async () => ({
    ok: false, status: 503,
    json: async () => { jsonCalls++; return [{ total_points: 0 }]; },
  }) });
  await ui.click();
  assert.equal(jsonCalls, 0);
  assertUnknown(ui);
  assert.match(ui.status.textContent, /Could not load points/);
  assertRecovery(ui);
});

test('empty data has a distinct no-data message and can be retried without connecting again', async () => {
  let attempt = 0;
  const ui = await harness({ fetchImpl: async () => ++attempt === 1
    ? { ok: true, json: async () => [] } : response(0) });
  await ui.click();
  assertUnknown(ui);
  assert.match(ui.status.textContent, /No points data was returned/);
  assertRecovery(ui);
  await ui.click();
  assert.deepEqual(ui.points.map(element => element.textContent), ['0', '0']);
  assert.equal(ui.calls.connect, 1);
  assert.equal(ui.calls.fetch.length, 2);
  assertRecovery(ui, 'Refresh Points');
});

test('missing, malformed, or unreadable data never becomes a false zero', async t => {
  const cases = [
    ['missing points', [{}]],
    ['null points', [{ total_points: null }]],
    ['empty points', [{ total_points: '' }]],
    ['whitespace points', [{ total_points: '   ' }]],
    ['boolean points', [{ total_points: false }]],
    ['array points', [{ total_points: [] }]],
    ['nonnumeric points', [{ total_points: 'unavailable' }]],
    ['nonfinite points', [{ total_points: Infinity }]],
    ['non-array body', { total_points: 0 }],
    ['null body', null],
  ];
  for (const [name, data] of cases) {
    await t.test(name, async () => {
      const ui = await harness({ fetchImpl: async () => ({ ok: true, json: async () => data }) });
      await ui.click();
      assertUnknown(ui);
      assertRecovery(ui);
    });
  }
  await t.test('invalid JSON', async () => {
    const ui = await harness({ fetchImpl: async () => ({ ok: true, json: async () => {
      throw new SyntaxError('Mock invalid JSON');
    } }) });
    await ui.click();
    assertUnknown(ui);
    assertRecovery(ui);
  });
});

test('missing wallet gives visible installation feedback and supports later registration', async () => {
  const ui = await harness({ hasWallet: false });
  await ui.click();
  assertUnknown(ui);
  assertRecovery(ui, 'Connect Wallet');
  assert.match(ui.status.textContent, /Slush wallet not found.*Install Slush.*try again/);
  const install = ui.status.childNodes.find(child => child instanceof Element);
  assert.equal(install.tagName, 'A');
  assert.equal(install.href, 'https://chromewebstore.google.com/detail/slush-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil');
  assert.equal(install.rel, 'noopener noreferrer');
  assert.equal(ui.calls.connect, 0);
  assert.equal(ui.calls.fetch.length, 0);
  ui.wallets.push(ui.wallet);
  ui.registryListeners.get('register')();
  await ui.click();
  assert.equal(ui.calls.connect, 1);
  assert.equal(ui.calls.fetch.length, 1);
  assert.match(ui.status.textContent, /Points loaded/);
  assert.doesNotMatch(ui.status.textContent, /not found|Install Slush/);
  assertRecovery(ui, 'Refresh Points');
});

test('canceled connection stays usable and reconnects only when requested again', async () => {
  let attempt = 0;
  const ui = await harness({ connectImpl: async () => {
    if (++attempt === 1) throw new Error('User canceled');
  } });
  await ui.click();
  assertUnknown(ui);
  assert.match(ui.status.textContent, /Wallet connection failed.*User canceled/);
  assertRecovery(ui, 'Connect Wallet');
  assert.equal(ui.calls.fetch.length, 0);
  assert.equal(ui.window.connectedSuiAddress, undefined);
  assert.equal(visible(ui.balanceSection), false);
  await ui.click();
  assert.equal(ui.calls.connect, 2);
  assert.equal(ui.calls.fetch.length, 1);
  assertRecovery(ui, 'Refresh Points');
});

test('no returned account is not success and permits a fresh connection attempt', async () => {
  const ui = await harness({ accounts: [] });
  await ui.click();
  assertUnknown(ui);
  assert.match(ui.status.textContent, /No account was selected/);
  assertRecovery(ui, 'Connect Wallet');
  assert.equal(ui.calls.fetch.length, 0);
  assert.equal(ui.window.connectedSuiAddress, undefined);
  ui.wallet.accounts.push({ address });
  await ui.click();
  assert.equal(ui.calls.connect, 2);
  assert.equal(ui.calls.fetch.length, 1);
  assertRecovery(ui, 'Refresh Points');
});

test('duplicate clicks cannot open multiple wallet connection requests', async () => {
  const connection = deferred();
  const ui = await harness({ connectImpl: () => connection.promise });
  const pending = ui.click();
  assert.equal(ui.status.textContent, 'Connecting to Slush...');
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.calls.connect, 1);
  await ui.click();
  assert.equal(ui.calls.connect, 1);
  assert.equal(ui.calls.fetch.length, 0);
  connection.resolve();
  await pending;
  assert.equal(ui.calls.connect, 1);
  assert.equal(ui.calls.fetch.length, 1);
  assertRecovery(ui, 'Refresh Points');
});
