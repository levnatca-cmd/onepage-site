import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, sep } from "node:path";
import { parse, parseFragment } from "parse5";
import { publicPath, ROOT } from "../../scripts/lib/paths.mjs";
import { pages } from "../../../website/src/studio/pages.js";
import { buildStudio, renderPage } from "../../scripts/build-studio.mjs";
import { GALAXY_SERVICES } from "../../../website/src/shared/service-catalog.js";
import { DRAFT_KEY, SERVICE_LABELS, sanitizeInquiry } from "../../../website/src/studio/inquiry.js";
import { DAYBOOK_DEMO_PATH, studioRoutes as routes } from "../support/studio-routes.mjs";

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
  publicPath(pathname.endsWith("/") ? `${pathname}index.html` : pathname);
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

check("the start page loads its module and links to both Galaxy themes", () => {
  const document = documentAt("/");
  const links = all(document, (node) => node.tagName === "a");
  assert.deepEqual(
    links.map((node) => attribute(node, "href")),
    ["/home/", "/explore.html"],
  );
  const scripts = all(document, (node) => node.tagName === "script");
  assert.equal(scripts.length, 1);
  assert.equal(attribute(scripts[0], "type"), "module");
  assert.equal(attribute(scripts[0], "src"), "/src/studio/start.js");
});

check("both Galaxy themes share the scene and link directly to the other theme", () => {
  const home = documentAt("/home/");
  const explore = documentAt("/explore.html");
  assert.ok(
    withAttribute(home, "data-galaxy-theme").some(
      (node) => attribute(node, "data-galaxy-theme") === "light",
    ),
  );
  for (const document of [home, explore]) {
    assert.equal(byId(document, "galaxy-canvas")?.tagName, "canvas");
    assert.equal(attribute(byId(document, "galaxy-entry"), "type"), "module");
    const nav = byId(document, "nav-links");
    const links = all(nav, (node) => node.tagName === "a");
    assert.deepEqual(
      links.map((link) => [normalize(text(link)), attribute(link, "href")]),
      [
        ["Galaxy", "#top"],
        ["Services", "/services/"],
        ["Work", "/work/"],
        ["Process", "/approach/"],
        ["Contact", "/contact/"],
      ],
    );
  }
  assert.equal(
    new URL(attribute(byId(home, "galaxy-entry"), "src"), origin + "/home/").href,
    new URL(attribute(byId(explore, "galaxy-entry"), "src"), origin + "/explore.html").href,
  );
  for (const [document, theme, destination] of [
    [home, "Light", "/explore.html"],
    [explore, "Dark", "/home/"],
  ]) {
    const [toggle] = all(document, (node) => attribute(node, "class") === "galaxy-theme-toggle");
    assert.equal(attribute(toggle, "aria-label"), "Color theme");
    const [current] = all(toggle, (node) => attribute(node, "aria-current") === "page");
    assert.equal(current?.tagName, "span");
    assert.equal(normalize(text(current)), theme);
    const links = all(toggle, (node) => node.tagName === "a");
    assert.deepEqual(
      links.map((link) => attribute(link, "href")),
      [destination],
    );
    assert.ok(hasAttribute(links[0], "data-galaxy-context-link"));
  }
  for (const node of all(home, (node) => node.tagName === "link")) {
    if (!["icon", "modulepreload", "stylesheet"].includes(attribute(node, "rel"))) continue;
    const href = attribute(node, "href");
    assert.ok(href.startsWith("/") && !href.startsWith("//"), href);
    assert.ok(existsSync(fileFor(new URL(href, origin).pathname)), href);
  }
});

check("authored routes have stable, distinct page identities", () => {
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

check("Galaxy services open dedicated pages with a native return link", () => {
  for (const [service, path] of [
    ["firmware", "/services/websites-apps/"],
    ["backend", "/services/backend-api/"],
    ["automation", "/services/automation/"],
    ["pqc", "/services/post-quantum-security/"],
    ["data", "/services/data-logs/"],
    ["hardware", "/services/hardware/"],
    ["ops", "/services/monitoring/"],
  ]) {
    const document = documentAt(path);
    const bodies = withAttribute(document, "data-galaxy-service");
    assert.equal(bodies.length, 1, path);
    assert.equal(bodies[0].tagName, "body");
    assert.equal(attribute(bodies[0], "data-galaxy-service"), service);
    const links = withAttribute(document, "data-galaxy-return");
    assert.equal(links.length, 1, path);
    assert.equal(links[0].tagName, "a");
    assert.equal(attribute(links[0], "href"), "/explore.html");
    assert.equal(normalize(text(links[0])), "Back to Galaxy");
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
    const footer = all(document, (node) => node.tagName === "footer")[0];
    for (const region of [header, footer]) {
      const galaxyLinks = all(
        region,
        (node) => node.tagName === "a" && attribute(node, "href") === "/explore.html",
      );
      assert.equal(galaxyLinks.length, 1, `${page.path}: direct Galaxy link in ${region.tagName}`);
    }
    const navigation = all(header, (node) => node.tagName === "nav")[0];
    assert.ok(attribute(navigation, "aria-label"), `${page.path}: named navigation landmark`);
    const links = all(navigation, (node) => node.tagName === "a");
    assert.deepEqual(
      links.map((link) => normalize(text(link))),
      ["Galaxy", "Services", "Work", "Process", "Contact"],
    );
    const hrefs = links.map((node) => attribute(node, "href"));
    for (const path of ["/services/", "/work/", "/approach/"])
      assert.ok(hrefs.includes(path), `${page.path}: missing ${path} navigation link`);
    assert.ok(
      hrefs.every(
        (href) => href === "/explore.html" || routes.includes(new URL(href, origin).pathname),
      ),
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
    assert.equal(current.length, 1, `${page.path}: one current navigation item`);
    assert.equal(attribute(current[0], "href"), expected);
    assert.equal(attribute(current[0], "aria-current"), "page");
    const contactLinks = all(
      header,
      (node) => node.tagName === "a" && attribute(node, "href")?.startsWith("/contact/"),
    );
    assert.equal(contactLinks.length, 1, `${page.path}: one header inquiry action`);
    const contactUrl = new URL(attribute(contactLinks[0], "href"), origin);
    assert.equal(contactUrl.pathname, "/contact/");
    assert.equal(contactUrl.searchParams.get("service"), page.inquiryService ?? null);
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

check("the Services index links directly to every Galaxy service and supporting route", () => {
  const main = byId(documentAt("/services/"), "main-content");
  const [catalog] = all(
    main,
    (node) => node.tagName === "nav" && attribute(node, "aria-labelledby") === "services-heading",
  );
  assert.deepEqual(
    all(catalog, (node) => node.tagName === "a").map((node) => [
      attribute(node, "href"),
      normalize(text(node)),
    ]),
    GALAXY_SERVICES.map(({ path, heading }) => [path, heading]),
  );
  for (const route of ["/services/integrations/", "/services/support/"])
    assert.ok(
      all(main, (node) => node.tagName === "a" && attribute(node, "href") === route).length,
    );
});

check("public pages share one hourly rate and billing policy", () => {
  const billingTerms =
    "Before work starts, we agree on an estimate and a maximum number of hours. You pay only for the hours actually worked. Any extra hours require your approval.";
  const legacyPackagePrice =
    /\$\s*(?:500|(?:2|4|8|20|50),?000)\b|\b(?:500|(?:2|4|8|20|50),?000)\s+CAD\b/i;

  for (const route of routes) {
    assert.doesNotMatch(readFileSync(fileFor(route), "utf8"), legacyPackagePrice, route);
    if (route.startsWith("/services/") || route === "/approach/") {
      const main = byId(documentAt(route), "main-content");
      const copy = normalize(text(main));
      assert.match(copy, /\b200 CAD\/hour\b/, route);
      assert.ok(copy.includes(billingTerms), `${route}: billing terms`);
    }
  }
});

check("service journeys retain service-specific inquiry links", () => {
  for (const [route, service] of [
    ["/services/", "security"],
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
  for (const route of [DAYBOOK_DEMO_PATH, "/work/"])
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
  assert.ok(
    all(
      document,
      (node) =>
        node.tagName === "a" && attribute(node, "href") === DAYBOOK_DEMO_PATH + "#live-system",
    ).length,
    "The case must link directly to the relocated live demo",
  );
});

check("inquiry controls are labeled, validate input and require the protected endpoint", () => {
  const document = documentAt("/contact/");
  const form = byId(document, "project-form");
  assert.equal(form?.tagName, "form");
  assert.equal(form.parentNode.tagName, "details");
  assert.equal(hasAttribute(form.parentNode, "open"), false);
  assert.equal(normalize(text(byId(document, "inquiry-heading"))), "Use secure form");
  assert.equal(attribute(form, "action"), "/api/inquiries");
  assert.equal(attribute(form, "method"), "post");
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
  assert.match(normalize(text(submit[0])), /send inquiry/i);
  assert.ok(hasAttribute(submit[0], "disabled"), "Sending requires transport readiness");
  const status = byId(document, "inquiry-status");
  assert.equal(attribute(status, "role"), "status");
  const drafts = all(
    document,
    (node) => node.tagName === "a" && attribute(node, "href")?.startsWith("mailto:"),
  );
  assert.equal(drafts.length, 1);
  assert.equal(all(form, (node) => node === drafts[0]).length, 0);
  assert.equal(normalize(text(drafts[0])), "Email me");
  const draft = new URL(attribute(drafts[0], "href"));
  assert.equal(draft.pathname, "info@levnat.ca");
  assert.deepEqual([...draft.searchParams.keys()], ["subject", "body"]);
  assert.equal(draft.searchParams.get("subject"), "Project inquiry");
  assert.match(draft.searchParams.get("body"), /I need help with:\r\nTarget date \(optional\):/);
  assert.match(draft.searchParams.get("body"), /Example: Add online booking to my website\./);
});

check("the Daybook demo has independent HTML content and named, stateful controls", () => {
  const document = documentAt(DAYBOOK_DEMO_PATH);
  const mount = byId(document, "engineering-scene");
  assert.ok(mount, "Engineering scene mount must exist");
  assert.match(normalize(text(all(document, (node) => node.tagName === "h1")[0])), /Daybook demo/i);
  assert.ok(byId(document, "live-system"), "Legacy Daybook fragment must remain available");
  assert.ok(byId(document, "system-workbench"), "Shared workbench fragment must remain available");
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
    assert.deepEqual(JSON.parse(JSON.stringify(sanitizeInquiry(value))), value);
    for (const service of Object.keys(SERVICE_LABELS))
      assert.equal(sanitizeInquiry({ ...value, service }).service, service);
  },
);

check("UTF-16 truncation keeps well-formed Unicode within submission limits", () => {
  const limits = { name: 120, email: 254, description: 4000, budget: 120, timeline: 120 };
  for (const [field, limit] of Object.entries(limits)) {
    const value = {
      service: "support",
      description: "Please investigate the device integration and app logs.",
      [field]: "x".repeat(limit - 1) + "\ud83d\ude80",
    };
    const sanitized = sanitizeInquiry(value);
    assert.equal(sanitized[field].length, limit, `${field}: preserve the plain-text length limit`);
    assert.equal(sanitized[field].at(-1), "\uFFFD");
  }
  const malformed = { description: "A device log with an unpaired surrogate: \ud83d" };
  assert.match(sanitizeInquiry(malformed).description, /\uFFFD$/);
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
