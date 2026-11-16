import assert from "node:assert/strict";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import { studioRoutes } from "../support/studio-routes.mjs";

const [pagesRoot, pqcRoot] = process.argv.slice(2);
assert.ok(
  pagesRoot && pqcRoot,
  "Usage: node tooling/tests/verification/pages.mjs <pages-output> <pqc-output>",
);

const origin = "https://levnat.ca";
const galaxyRoutes = ["/home/", "/explore.html"];
const legacyRoute = "/starworld.html";
const contactRoutes = ["/contact/", ...galaxyRoutes];
const routes = ["/", legacyRoute, ...galaxyRoutes, ...studioRoutes];
const privatePaths = [
  ".git",
  ".github",
  ".env",
  "artifacts",
  "deploy",
  "docs",
  "node_modules",
  "projects",
  "src/server",
  "website",
];

function routeFile(root, pathname) {
  return join(root, pathname.slice(1), ...(pathname.endsWith("/") ? ["index.html"] : []));
}

function assertFile(root, pathname, context) {
  assert.ok(
    lstatSync(routeFile(root, pathname), { throwIfNoEntry: false })?.isFile(),
    `${context}: missing ${pathname}`,
  );
}

function documentAt(root, pathname) {
  return parse(readFileSync(routeFile(root, pathname), "utf8"));
}

function elements(node, name) {
  return [
    ...(node.tagName === name ? [node] : []),
    ...(node.childNodes ?? []).flatMap((child) => elements(child, name)),
  ];
}

const attr = (node, name) => node?.attrs?.find((attribute) => attribute.name === name)?.value;

function assertLink(document, href, context) {
  assert.ok(
    elements(document, "a").some((link) => attr(link, "href") === href),
    `${context}: missing native link to ${href}`,
  );
}

function assertModule(root, document, pathname, expectedSource, context) {
  const script = elements(document, "script").find((item) => {
    const source = attr(item, "src");
    if (!source || attr(item, "type") !== "module") return false;
    const url = new URL(source, origin + pathname);
    return url.origin === origin && url.pathname === expectedSource;
  });
  assert.ok(script, `${context}: missing ${expectedSource} module`);
  assertFile(root, expectedSource, context);
}

for (const [label, root, secure] of [
  ["Pages", pagesRoot, false],
  ["PQC", pqcRoot, true],
]) {
  for (const pathname of routes) assertFile(root, pathname, label);
  for (const path of privatePaths) {
    assert.equal(
      lstatSync(join(root, path), { throwIfNoEntry: false }),
      undefined,
      `${label}: unexpected ${path}`,
    );
  }

  const start = documentAt(root, "/");
  for (const pathname of galaxyRoutes) assertLink(start, pathname, `${label} /`);
  assertModule(root, start, "/", "/src/studio/start.js", `${label} /`);
  const legacy = documentAt(root, legacyRoute);
  assertLink(legacy, "/explore.html", `${label} ${legacyRoute}`);
  assertModule(root, legacy, legacyRoute, "/src/studio/start.js", `${label} ${legacyRoute}`);
  assertFile(root, "/src/studio/start-route.js", label);

  for (const pathname of contactRoutes) {
    const context = `${label} ${pathname}`;
    const document = documentAt(root, pathname);
    assert.ok(
      elements(document, "a").some((item) =>
        /^mailto:info@levnat\.ca(?:\?|$)/i.test(attr(item, "href") ?? ""),
      ),
      `${context}: missing native email link`,
    );
    const forms = elements(document, "form").filter((form) => {
      if (["contact-form", "project-form"].includes(attr(form, "id"))) return true;
      const action = attr(form, "action");
      return action && new URL(action, origin + pathname).pathname === "/api/inquiries";
    });
    assert.equal(forms.length, secure ? 1 : 0, `${context}: unexpected secure form count`);
    if (secure) {
      assert.equal(attr(forms[0], "action"), "/api/inquiries", `${context}: secure endpoint`);
      assert.equal(attr(forms[0], "method")?.toLowerCase(), "post", `${context}: secure method`);
    } else {
      assert.ok(
        !elements(document, "details").some((item) =>
          (attr(item, "class") ?? "").split(/\s+/).includes("inquiry-options"),
        ),
        `${context}: unused secure form disclosure`,
      );
    }
    if (galaxyRoutes.includes(pathname)) {
      assertLink(
        document,
        galaxyRoutes.find((other) => other !== pathname),
        context,
      );
      assertModule(root, document, pathname, "/src/galaxy/js/main.js", context);
    }
  }
  console.log(`PASS ${label}: public routes, theme links, native email, and inquiry controls`);
}
