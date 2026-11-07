import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { parse, parseFragment } from "parse5";
import { ROOT } from "../../scripts/lib/paths.mjs";
import { pages } from "../../src/studio/pages.js";
import { buildStudio, renderPage } from "../../scripts/build-studio.mjs";
import {
  DRAFT_KEY,
  SERVICE_LABELS,
  sanitizeInquiry,
  buildInquiry,
  inquiryMailto,
} from "../../src/studio/inquiry.js";

const routes = [
  "/",
  "/services/",
  "/services/websites-apps/",
  "/services/integrations/",
  "/services/support/",
  "/work/",
  "/work/daybook/",
  "/approach/",
  "/contact/",
];
const origin = "https://studio.test";
const documents = new Map();
const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const hasAttribute = (node, name) => node.attrs?.some((item) => item.name === name);
const normalize = (value) => value.replace(/\s+/g, " ").trim();
function all(node, predicate) {
  if (!node) return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes || []).flatMap((child) => all(child, predicate)),
  ];
}
function text(node) {
  if (!node || ["script", "style"].includes(node.tagName)) return "";
  return node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join(" ");
}
const byId = (document, id) => all(document, (node) => attribute(node, "id") === id)[0];
const withAttribute = (document, name) => all(document, (node) => hasAttribute(node, name));
const fileFor = (pathname) =>
  resolve(ROOT, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
function documentAt(pathname) {
  const filename = fileFor(pathname);
  if (!documents.has(filename)) {
    assert.ok(existsSync(filename), `${pathname} has no static output; run the main build first.`);
    documents.set(filename, parse(readFileSync(filename, "utf8")));
  }
  return documents.get(filename);
}
function labeled(document, control) {
  const id = attribute(control, "id");
  if (
    id &&
    all(document, (node) => node.tagName === "label" && attribute(node, "for") === id).length
  )
    return true;
  for (let parent = control.parentNode; parent; parent = parent.parentNode) {
    if (parent.tagName === "label" && normalize(text(parent))) return true;
  }
  return Boolean(attribute(control, "aria-label") || attribute(control, "aria-labelledby"));
}
let passed = 0;
let failed = 0;
function check(name, action) {
  try {
    action();
    passed += 1;
    console.log(`PASS studio: ${name}`);
  } catch (error) {
    failed += 1;
    process.exitCode = 1;
    console.error(`FAIL studio: ${name}\n${error.stack}`);
  }
}

check("nine authored routes have stable, distinct page identities", () => {
  assert.equal(pages.length, routes.length);
  assert.deepEqual(pages.map((page) => page.path).sort(), [...routes].sort());
  assert.equal(new Set(pages.map((page) => page.key)).size, routes.length);
  for (const page of pages) {
    for (const field of ["path", "key", "title", "description", "html"])
      assert.equal(typeof page[field], "string", `${page.path}: ${field} must be authored text`);
    assert.ok(page.title.trim() && page.description.trim() && page.html.trim());
    assert.equal(
      all(parseFragment(page.html), (node) => node.tagName === "h1").length,
      1,
      `${page.path}: one authored H1`,
    );
  }
});

check("every output has unique metadata, one H1 and matching authored content", () => {
  const titles = [];
  const headings = [];
  const descriptions = [];
  for (const page of pages) {
    const document = documentAt(page.path);
    const title = all(document, (node) => node.tagName === "title");
    const h1 = all(document, (node) => node.tagName === "h1");
    const main = all(document, (node) => node.tagName === "main");
    assert.equal(title.length, 1, `${page.path}: one title`);
    assert.equal(h1.length, 1, `${page.path}: one H1`);
    assert.equal(main.length, 1, `${page.path}: one main landmark`);
    assert.equal(normalize(text(title[0])), `${page.title} | LEVNAT`);
    assert.equal(
      normalize(text(main[0])),
      normalize(text(parseFragment(page.html))),
      `${page.path}: stale body content`,
    );
    const description = all(
      document,
      (node) => node.tagName === "meta" && attribute(node, "name") === "description",
    );
    assert.equal(description.length, 1);
    assert.equal(attribute(description[0], "content"), page.description);
    const canonical = all(
      document,
      (node) => node.tagName === "link" && attribute(node, "rel") === "canonical",
    );
    assert.equal(canonical.length, 1);
    assert.equal(attribute(canonical[0], "href"), `https://levnat.ca${page.path}`);
    assert.equal(attribute(all(document, (node) => node.tagName === "html")[0], "lang"), "en-CA");
    const ids = withAttribute(document, "id").map((node) => attribute(node, "id"));
    assert.equal(new Set(ids).size, ids.length, `${page.path}: duplicate IDs`);
    titles.push(normalize(text(title[0])));
    headings.push(normalize(text(h1[0])));
    descriptions.push(page.description);
  }
  assert.equal(new Set(titles).size, routes.length, "Titles must distinguish direct routes");
  assert.equal(new Set(headings).size, routes.length, "H1s must distinguish direct routes");
  assert.equal(new Set(descriptions).size, routes.length, "Descriptions must be page-specific");
});

check("shared navigation uses real routes and exposes current section and menu state", () => {
  for (const page of pages) {
    const document = documentAt(page.path);
    const header = all(document, (node) => node.tagName === "header")[0];
    const navigation = byId(document, "primary-navigation");
    assert.equal(navigation?.tagName, "nav", `${page.path}: navigation landmark`);
    const hrefs = all(navigation, (node) => node.tagName === "a").map((node) =>
      attribute(node, "href"),
    );
    for (const path of ["/services/", "/work/", "/approach/"])
      assert.ok(hrefs.includes(path), `${page.path}: missing ${path} navigation link`);
    assert.ok(
      hrefs.every((href) => routes.includes(href)),
      "Primary navigation must not be a one-page anchor menu",
    );
    const toggles = withAttribute(document, "data-menu-toggle");
    assert.equal(toggles.length, 1);
    assert.equal(toggles[0].tagName, "button");
    assert.equal(attribute(toggles[0], "type"), "button");
    assert.equal(attribute(toggles[0], "aria-controls"), "primary-navigation");
    assert.equal(attribute(toggles[0], "aria-expanded"), "false");
    assert.ok(labeled(document, toggles[0]));
    const current = all(
      header,
      (node) => node.tagName === "a" && hasAttribute(node, "aria-current"),
    );
    const expected = page.path.startsWith("/services/")
      ? "/services/"
      : page.path.startsWith("/work/")
        ? "/work/"
        : page.path;
    if (page.path !== "/") {
      assert.equal(current.length, 1, `${page.path}: one current navigation item`);
      assert.equal(attribute(current[0], "href"), expected);
      assert.equal(attribute(current[0], "aria-current"), "page");
    }
    assert.ok(
      all(header, (node) => node.tagName === "a" && attribute(node, "href") === "/contact/").length,
    );
    assert.ok(
      all(document, (node) => node.tagName === "a" && attribute(node, "href") === "#main-content")
        .length,
    );
  }
});

check("all local document, fragment and asset references resolve without generating files", () => {
  const visited = new Set();
  for (const page of pages) {
    const document = documentAt(page.path);
    for (const node of all(
      document,
      (item) => hasAttribute(item, "href") || hasAttribute(item, "src"),
    )) {
      for (const name of ["href", "src"]) {
        const value = attribute(node, name);
        if (value === undefined) continue;
        assert.ok(value.trim(), `${page.path}: empty ${name}`);
        assert.doesNotMatch(value, /^javascript:/i, `${page.path}: executable link`);
        const url = new URL(value, origin + page.path);
        if (url.origin !== origin) continue;
        const filename = fileFor(decodeURIComponent(url.pathname));
        const local = relative(ROOT, filename);
        assert.ok(
          local && !local.startsWith(`..${sep}`) && local !== "..",
          `${page.path}: reference escapes repository`,
        );
        assert.ok(
          existsSync(filename) && statSync(filename).isFile(),
          `${page.path}: missing local reference ${value}`,
        );
        if (url.hash && /\.html$/.test(filename)) {
          const target = documentAt(url.pathname);
          assert.ok(
            byId(target, decodeURIComponent(url.hash.slice(1))),
            `${page.path}: missing fragment ${value}`,
          );
        }
        visited.add(filename);
      }
    }
  }
  assert.ok(visited.size > routes.length, "The crawl must include assets, not just page links");
});

check("service journeys retain published CAD prices and distinguish paid planning", () => {
  const serviceText = normalize(
    routes
      .filter((route) => route.startsWith("/services/"))
      .map((route) => text(documentAt(route)))
      .join(" "),
  );
  assert.match(serviceText, /\bCAD\b/);
  for (const amount of ["500", "4,000", "8,000", "20,000"])
    assert.ok(serviceText.includes(`$${amount}`), `Published price $${amount} must remain visible`);
  assert.match(serviceText, /\$200\s*\/\s*(?:h(?:ou)?r|hour)/i);
  assert.match(serviceText, /\$2,000\s*\/\s*(?:mo(?:nth)?)/i);
  assert.match(serviceText, /90[-\s]?min(?:ute)?/i);
  assert.match(serviceText, /(?:from|starting|scope|estimate|quoted)/i);
  for (const [route, service] of [
    ["/services/websites-apps/", "websites"],
    ["/services/integrations/", "integrations"],
    ["/services/support/", "support"],
  ]) {
    const inquiryLinks = all(
      documentAt(route),
      (node) => node.tagName === "a" && Boolean(attribute(node, "href")),
    )
      .map((node) => new URL(attribute(node, "href"), origin + route))
      .filter((url) => url.origin === origin && url.pathname === "/contact/");
    assert.ok(
      inquiryLinks.some((url) => url.searchParams.get("service") === service),
      `${route}: service-specific inquiry path`,
    );
  }
});

check("work examples are explicitly local demos with functional filter and demo hooks", () => {
  const document = documentAt("/work/");
  const main = byId(document, "main-content");
  const copy = normalize(text(main));
  assert.match(copy, /(?:demo|experiment|prototype)/i);
  assert.match(
    copy,
    /(?:not (?:client|commissioned|customer)|no client|sample data|local (?:demo|experiment)|self[- ]initiated)/i,
  );
  assert.doesNotMatch(
    copy,
    /trusted by|clients worldwide|award[- ]winning|guaranteed results|\b(?:increased|boosted|grew|reduced)\b.{0,45}\d+\s*%/i,
  );
  const filters = withAttribute(document, "data-filter");
  assert.deepEqual(filters.map((node) => attribute(node, "data-filter")).sort(), [
    "all",
    "interface",
    "systems",
  ]);
  assert.ok(
    filters.every((node) => node.tagName === "button" && attribute(node, "type") === "button"),
  );
  assert.equal(filters.filter((node) => attribute(node, "aria-pressed") === "true").length, 1);
  const examples = withAttribute(document, "data-category");
  assert.ok(examples.length >= 2);
  for (const example of examples) {
    assert.ok(["interface", "systems"].includes(attribute(example, "data-category")));
    assert.match(
      normalize(text(example)),
      /demo|experiment|prototype/i,
      "Each example must identify itself honestly",
    );
  }
  for (const hook of [
    "data-demo-request",
    "data-demo-count",
    "data-demo-requests",
    "data-demo-run",
    "data-demo-pipeline",
    "data-pipeline-status",
  ])
    assert.equal(withAttribute(document, hook).length, 1, `Missing unique ${hook}`);
});

check("Daybook is a directly linked, honest product case with an ungated inquiry", () => {
  const document = documentAt("/work/daybook/");
  const copy = normalize(text(byId(document, "main-content")));
  assert.match(copy, /Daybook/i);
  assert.match(copy, /(?:independent|local|sample|prototype)/i);
  assert.match(
    copy,
    /(?:not (?:client|commissioned|customer)|no client|sample data|local (?:demo|prototype)|independent prototype)/i,
  );
  assert.doesNotMatch(
    copy,
    /trusted by|clients worldwide|award[- ]winning|guaranteed results|\b(?:increased|boosted|grew|reduced)\b.{0,45}\d+\s*%/i,
  );
  for (const topic of [
    /problem|challenge|question|what happens/i,
    /(?:scope|constraint|decision|implementation)/i,
    /(?:limit|prototype|sample)/i,
  ])
    assert.match(copy, topic, `The product case must explain ${topic}, not just show an image`);
  for (const route of ["/", "/work/"])
    assert.ok(
      all(
        documentAt(route),
        (node) => node.tagName === "a" && attribute(node, "href") === "/work/daybook/",
      ).length,
      `${route}: the new product case must be discoverable`,
    );
  assert.ok(
    all(
      byId(document, "main-content"),
      (node) => node.tagName === "a" && attribute(node, "href")?.startsWith("/contact/"),
    ).length,
    "The product story must not gate project inquiries on playing the demo",
  );
});

check(
  "inquiry controls are labeled, validate input and describe a draft rather than a sent message",
  () => {
    const document = documentAt("/contact/");
    const form = byId(document, "project-form");
    assert.equal(form?.tagName, "form");
    assert.ok(
      !attribute(form, "action") || new URL(attribute(form, "action"), origin).origin === origin,
      "No external form submission",
    );
    for (const name of ["name", "email", "service", "description", "budget", "timeline"]) {
      const controls = all(form, (node) => attribute(node, "name") === name);
      assert.equal(controls.length, 1, `One ${name} field`);
      assert.ok(labeled(document, controls[0]), `${name} needs a persistent accessible label`);
      if (["email", "description"].includes(name))
        assert.ok(hasAttribute(controls[0], "required"), `${name} is required`);
      if (name === "email") assert.equal(attribute(controls[0], "type"), "email");
      if (name === "description") assert.ok(Number(attribute(controls[0], "minlength")) >= 20);
    }
    const submit = all(
      form,
      (node) => node.tagName === "button" && attribute(node, "type") === "submit",
    );
    assert.equal(submit.length, 1);
    assert.match(normalize(text(submit[0])), /(?:prepare|open) email draft/i);
    const status = byId(document, "inquiry-status");
    assert.equal(attribute(status, "role"), "status");
    const emailLink = byId(document, "email-draft-link");
    assert.equal(emailLink?.tagName, "a");
    assert.ok(hasAttribute(emailLink, "hidden"), "An unprepared email action must not be exposed");
    for (const hook of ["data-copy-inquiry", "data-download-inquiry", "data-clear-draft"]) {
      const buttons = withAttribute(document, hook);
      assert.equal(buttons.length, 1);
      assert.equal(buttons[0].tagName, "button");
      assert.equal(attribute(buttons[0], "type"), "button");
    }
    assert.match(
      normalize(text(byId(document, "main-content"))),
      /(?:nothing (?:is|has been) sent|no (?:message|email).{0,25}sent|review and send|email app)/i,
    );
    assert.ok(
      all(
        document,
        (node) => node.tagName === "a" && attribute(node, "href") === "mailto:info@levnat.ca",
      ).length,
    );
  },
);

check("the home scene has independent HTML content and named, stateful controls", () => {
  const document = documentAt("/");
  const mount = byId(document, "engineering-scene");
  assert.ok(mount, "Engineering scene mount must exist");
  assert.match(
    normalize(text(all(document, (node) => node.tagName === "h1")[0])),
    /(?:website|web|app|development)/i,
  );
  assert.ok(
    all(
      byId(document, "main-content"),
      (node) => node.tagName === "a" && attribute(node, "href")?.startsWith("/contact/"),
    ).length,
  );
  const modes = withAttribute(document, "data-scene-mode");
  assert.deepEqual(modes.map((node) => attribute(node, "data-scene-mode")).sort(), [
    "build",
    "care",
    "connect",
  ]);
  for (const button of [...modes, ...withAttribute(document, "data-scene-pause")]) {
    assert.equal(button.tagName, "button");
    assert.equal(attribute(button, "type"), "button");
    assert.ok(
      labeled(document, button) || normalize(text(button)),
      "Scene control needs an accessible name",
    );
    assert.ok(
      ["true", "false"].includes(attribute(button, "aria-pressed")),
      "Scene control exposes its state",
    );
  }
  assert.equal(withAttribute(document, "data-scene-pause").length, 1);
});

check(
  "inquiry helpers sanitize unknown values, bound fields and retain Unicode consistently",
  () => {
    assert.ok(DRAFT_KEY && typeof DRAFT_KEY === "string");
    for (const invalid of [null, undefined, false, 42, "unexpected", []]) {
      const draft = sanitizeInquiry(invalid);
      assert.equal(draft.service, "unsure");
      assert.equal(draft.description, "");
      assert.doesNotMatch(buildInquiry(invalid), /undefined|\[object Object\]/);
    }
    assert.equal(sanitizeInquiry({ service: "__proto__" }).service, "unsure");
    const bounded = sanitizeInquiry({
      name: "x".repeat(1000),
      description: "x".repeat(12000),
      email: "x".repeat(1000),
    });
    assert.equal(bounded.name.length, 120);
    assert.equal(bounded.email.length, 254);
    assert.equal(bounded.description.length, 4000);
    const value = {
      name: "Zo\u00eb Example",
      email: "qa+studio@example.test",
      service: "support",
      description: "Connect the Caf\u00e9 \ud83d\ude80 portal & device logs.\nKeep <notes> intact.",
      budget: "CAD $4,000-$8,000",
      timeline: "After scope review",
    };
    const summary = buildInquiry(value);
    const mail = new URL(inquiryMailto(value));
    assert.equal(mail.protocol, "mailto:");
    assert.equal(mail.pathname, "info@levnat.ca");
    assert.equal(mail.searchParams.get("body"), summary);
    for (const field of ["name", "email", "description", "budget", "timeline"])
      assert.ok(summary.includes(value[field]), `${field} must survive the brief`);
    assert.ok(summary.includes(SERVICE_LABELS.support));
    assert.match(summary, /No engagement is confirmed/);
    assert.doesNotMatch(summary, /message sent|booking confirmed|payment received/i);
    for (const service of Object.keys(SERVICE_LABELS))
      assert.ok(buildInquiry({ ...value, service }).includes(SERVICE_LABELS[service]));
  },
);

check("UTF-16 truncation cannot break email encoding or change the decoded brief", () => {
  const limits = { name: 120, email: 254, description: 4000, budget: 120, timeline: 120 };
  for (const [field, limit] of Object.entries(limits)) {
    const value = {
      service: "support",
      description: "Please investigate the device integration and app logs.",
      [field]: "x".repeat(limit - 1) + "\ud83d\ude80",
    };
    assert.doesNotThrow(
      () => inquiryMailto(value),
      `${field}: a truncated surrogate pair must remain URI-encodable`,
    );
    assert.equal(
      sanitizeInquiry(value)[field].length,
      limit,
      `${field}: preserve the plain-text length limit`,
    );
    assert.equal(new URL(inquiryMailto(value)).searchParams.get("body"), buildInquiry(value));
  }
  const malformed = { description: "A device log with an unpaired surrogate: \ud83d" };
  assert.doesNotThrow(() => inquiryMailto(malformed));
  assert.equal(new URL(inquiryMailto(malformed)).searchParams.get("body"), buildInquiry(malformed));
});

check("rendering is deterministic and every generated output is current (read-only)", () => {
  for (const page of pages) {
    const first = renderPage(page);
    assert.equal(renderPage(page), first, `${page.path}: repeated render differs`);
    assert.equal(renderPage({ ...page }), first, `${page.path}: equivalent content differs`);
    assert.equal(
      readFileSync(fileFor(page.path), "utf8"),
      first,
      `${page.path}: generated output is stale`,
    );
  }
  buildStudio({ check: true });
});

console.log(`${passed} studio checks passed; ${failed} failed. No build output was written.`);
