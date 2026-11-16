import assert from 'node:assert/strict';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'mirror-manifest.json'), 'utf8'));
const errors = [];
const references = new Set();
const externalLinks = new Set();

async function checkReference(value, from, allowExternal = false) {
  if (!value || /^(?:#|data:|blob:|mailto:|tel:)/.test(value)) return;
  if (/^https?:\/\//.test(value)) {
    if (allowExternal) externalLinks.add(value);
    else errors.push(`${from}: remote resource ${value}`);
    return;
  }
  const url = value.startsWith('/')
    ? new URL(`.${value}`, pathToFileURL(`${root}/index.html`))
    : new URL(value, pathToFileURL(resolve(root, from)));
  if (url.protocol !== 'file:') return;
  let target = fileURLToPath(url);
  if (!target.startsWith(`${root}/`)) errors.push(`${from}: reference outside snapshot ${value}`);
  try {
    let info = await stat(target);
    if (info.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target); }
    if (!info.isFile() || !info.size) errors.push(`${from}: empty/non-file reference ${value}`);
    references.add(relative(root, target));
  } catch { errors.push(`${from}: missing reference ${value}`); }
}

async function checkCss(css, from) {
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await checkReference(match[1].trim(), from);
}

function allNodes(node) {
  return [node, ...(node.childNodes || []).flatMap(allNodes), ...(node.content ? allNodes(node.content) : [])];
}

const pageResults = [];
for (const page of manifest.pages) {
  const html = await readFile(resolve(root, page.file), 'utf8');
  const nodes = allNodes(parse(html));
  const headings = nodes.filter(node => node.tagName === 'h1');
  assert.ok(headings.length, `${page.file}: missing page heading`);
  for (const node of nodes) {
    const attrs = Object.fromEntries((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
    for (const name of ['src', 'poster', 'data-src', 'data-poster-url']) if (attrs[name]) await checkReference(attrs[name], page.file);
    if (attrs.srcset) for (const candidate of attrs.srcset.split(',')) await checkReference(candidate.trim().split(/\s+/)[0], page.file);
    if (attrs['data-video-urls']) for (const url of attrs['data-video-urls'].split(',')) await checkReference(url, page.file);
    if (node.tagName === 'link' && /stylesheet|icon/.test(attrs.rel || '')) await checkReference(attrs.href, page.file);
    if (node.tagName === 'a') await checkReference(attrs.href, page.file, true);
    if (attrs.style) await checkCss(attrs.style, page.file);
    const content = (node.childNodes || []).map(child => child.value || '').join('');
    if (node.tagName === 'style') await checkCss(content, page.file);
    if (node.tagName === 'script' && !attrs.src) {
      assert.ok(!/google_tags_first_party|gtag\(|WebFont\.load/.test(content), `${page.file}: remote loader/tracking remains`);
      for (const match of content.matchAll(/["'](\.\.?\/[^"']+\.js)["']/g)) await checkReference(match[1], page.file);
    }
  }
  pageResults.push({ file: page.file, headings: headings.length, bytes: Buffer.byteLength(html) });
}

for (const asset of manifest.assets) {
  if (asset.state !== 'done') errors.push(`Asset download incomplete: ${asset.url}`);
  await checkReference(`./${asset.file}`, 'index.html');
  if (asset.file.endsWith('.css')) await checkCss(await readFile(resolve(root, asset.file), 'utf8'), asset.file);
  if (asset.file.endsWith('.json')) {
    const json = JSON.parse(await readFile(resolve(root, asset.file), 'utf8'));
    for (const image of json.assets || []) {
      if (image.p && !image.e) await checkReference(`${image.u || ''}${image.p}`, asset.file);
    }
  }
  if (asset.file.startsWith('assets/slater.app/') && asset.file.endsWith('.js')) {
    const code = await readFile(resolve(root, asset.file), 'utf8');
    for (const match of code.matchAll(/import\(['"]([^'"]+)['"]\)/g)) await checkReference(match[1], asset.file);
  }
}
assert.deepEqual(manifest.failures, [], 'Mirror has failed downloads');
const report = { checkedAt: new Date().toISOString(), passed: errors.length === 0,
  pages: pageResults, assets: manifest.assets.length, checkedLocalFiles: references.size,
  externalLinks: [...externalLinks].sort(), errors };
await mkdir(resolve(root, 'qa'), { recursive: true });
await writeFile(resolve(root, 'qa/static-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, pages: pageResults.length,
  assets: report.assets, checkedLocalFiles: references.size, errors }, null, 2));
if (errors.length) process.exitCode = 1;
