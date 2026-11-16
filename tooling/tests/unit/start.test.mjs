import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAYBOOK_DEMO_PATH,
  resolveStartDestination,
} from "../../../website/src/studio/start-route.js";

const origin = "https://studio.test";
const light = "/home/";
const dark = "/explore.html";

function destination(path, matchMedia) {
  return resolveStartDestination({ location: new URL(path, origin), matchMedia });
}

test("opens dark Galaxy when the browser reports a dark device theme", () => {
  const browser = {
    location: new URL("/", origin),
    matchMedia(query) {
      assert.equal(this, browser);
      assert.equal(query, "(prefers-color-scheme: dark)");
      return { matches: true };
    },
  };
  assert.equal(resolveStartDestination(browser), dark);
});

test("opens the light home when the browser reports a light device theme", () => {
  assert.equal(
    destination("/", () => ({ matches: false })),
    light,
  );
});

const unavailableThemeApis = [
  ["unavailable", undefined],
  ["not callable", {}],
  ["returns no result", () => null],
  ["returns no boolean preference", () => ({ matches: "false" })],
  [
    "throws",
    () => {
      throw new Error("Media queries unavailable");
    },
  ],
];
for (const [name, matchMedia] of unavailableThemeApis) {
  test(`falls back to the light home when matchMedia ${name}`, () => {
    assert.equal(destination("/", matchMedia), light);
  });
}

test("checks the browser preference again on a new start", () => {
  let prefersDark = true;
  const matchMedia = () => ({ matches: prefersDark });
  assert.equal(destination("/", matchMedia), dark);
  prefersDark = false;
  assert.equal(destination("/", matchMedia), light);
});

test("preserves the query and fragment when opening either version", () => {
  const suffix = "?utm_source=demo%20link&ref=%2F#section";
  assert.equal(
    destination("/" + suffix, () => ({ matches: true })),
    dark + suffix,
  );
  assert.equal(
    destination("/" + suffix, () => ({ matches: false })),
    light + suffix,
  );
});

test("a Starworld bookmark keeps its explicit Galaxy theme and URL context", () => {
  const context = "&layout=planets&focus=automation&utm_source=demo%20link#services";
  for (const [theme, target, prefersDark] of [
    ["light", light, true],
    ["dark", dark, false],
  ]) {
    const suffix = `?theme=${theme}${context}`;
    assert.equal(
      destination("/starworld.html" + suffix, () => ({ matches: prefersDark })),
      target + suffix,
    );
  }
});

test("a Starworld bookmark without an explicit theme follows the device theme", () => {
  assert.equal(
    destination("/starworld.html", () => ({ matches: true })),
    dark,
  );
  assert.equal(
    destination("/starworld.html", () => ({ matches: false })),
    light,
  );
});

for (const suffix of [
  "#live-system",
  "#system-workbench",
  "?lab=1",
  "?lab=1&mode=build#system-workbench",
]) {
  test(`preserves the older Daybook link /${suffix} even in dark mode`, () => {
    assert.equal(
      destination("/" + suffix, () => ({ matches: true })),
      DAYBOOK_DEMO_PATH + suffix,
    );
  });
}

test("an unrelated lab parameter does not override the device theme", () => {
  assert.equal(
    destination("/?lab=10", () => ({ matches: true })),
    dark + "?lab=10",
  );
});
