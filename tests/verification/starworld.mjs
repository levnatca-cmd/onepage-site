import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import assert from "node:assert/strict";
import { projectPath } from "../../scripts/lib/paths.mjs";
import { readStarworldSource, readStarworldFile } from "../../scripts/lib/starworld-source.mjs";
import "../functional/starworld-holograms.mjs";
const app = readStarworldSource();
const html = readFileSync(projectPath("starworld.html"), "utf8");
const data = readStarworldFile("data/services.js");
const source = [
  "domain/project-brief.js",
  "scene/label-layout.js",
  "scene/geometry.js",
  "scene/glyph-field.js",
]
  .map(readStarworldFile)
  .join("\n");
const context = createContext({ Set, encodeURIComponent });
new Script(
  `${data}\n${source}\nglobalThis.api={worlds,updateBrief,normalizeNotes,placeMapLabel,makeServiceGeometry,createGlyphFieldData,createBriefText,createBriefInquiry};`,
).runInContext(context);
const {
  worlds,
  updateBrief,
  normalizeNotes,
  placeMapLabel,
  makeServiceGeometry,
  createGlyphFieldData,
  createBriefText,
  createBriefInquiry,
} = context.api;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
check("each business service has a distinct role, scope and stable model", () => {
  assert.equal(worlds.length, 7);
  assert.equal(new Set(worlds.map((w) => w.code)).size, worlds.length);
  for (const w of worlds) {
    assert.equal(w.deliverables.length, 3);
    assert.equal(w.position.length, 3);
    assert.ok(w.radius > 0);
    assert.ok(w.info && w.trigger && w.focus && w.brief);
  }
  assert.equal(worlds[4].name, "Support & maintenance");
});
check("adding/removing service scope is idempotent and preserves unrelated choices", () => {
  const initial = new Set([0, 4]);
  const updated = updateBrief(initial, 1, true);
  assert.equal(initial.size, 2);
  assert.equal(updated.size, 3);
  assert.equal(updateBrief(updated, 1, true).size, 3);
  const removed = updateBrief(updated, 1, false);
  assert.ok(removed.has(0) && removed.has(4));
  assert.equal(removed.size, 2);
});
check("invalid service IDs cannot corrupt the brief", () => {
  const original = new Set([0]);
  for (const id of [-1, worlds.length, 1.2, "1", null, NaN])
    assert.throws(() => updateBrief(original, id, true));
  assert.equal(original.size, 1);
});
check("all 128 combinations produce only the selected service descriptions", () => {
  for (let mask = 0; mask < 2 ** worlds.length; mask++) {
    const ids = new Set(worlds.map((_, id) => id).filter((id) => mask & (1 << id)));
    const text = createBriefText(ids, "Existing app: add reporting.");
    worlds.forEach((w, id) => assert.equal(text.includes(`- ${w.name}:`), ids.has(id)));
    assert.ok(text.includes("Existing app: add reporting."));
    if (!mask) assert.ok(text.includes("help choosing the right scope"));
  }
});
check("new services retain original IDs and round-trip mixed briefs without losing notes", () => {
  assert.deepEqual(
    Array.from(worlds.slice(0, 5), (w) => w.code),
    ["CORE", "APP", "API", "LINK", "CARE"],
  );
  assert.equal(worlds[5].model, "phone");
  assert.equal(worlds[6].model, "shield");
  let scope = new Set([0, 4]);
  scope = updateBrief(scope, 5, true);
  scope = updateBrief(scope, 6, true);
  assert.equal(scope.size, 4);
  const notes = "iOS app + security / PQC — update";
  const inquiry = createBriefInquiry(scope, notes, "qa@example.test");
  assert.equal(inquiry.service, "unsure");
  for (const id of scope) assert.ok(inquiry.description.includes(`- ${worlds[id].name}:`));
  assert.ok(inquiry.description.includes(notes));
  scope = updateBrief(scope, 5, false);
  assert.ok(scope.has(6) && scope.has(4) && scope.has(0));
  assert.ok(!scope.has(5));
});
check("protected inquiry preserves Unicode, newlines, punctuation and service selection", () => {
  const notes = "Need API & CRM support?\nC++ + café reports 😀 #1 / 50% <script>alert(1)</script>";
  const email = "qa@example.test";
  const ids = new Set([2, 3]);
  const inquiry = createBriefInquiry(ids, notes, email);
  assert.deepEqual(
    { ...inquiry },
    {
      name: "",
      email,
      service: "integrations",
      description: createBriefText(ids, notes),
      budget: "",
      timeline: "",
    },
  );
  assert.equal(createBriefInquiry(new Set([6]), notes, email).service, "security");
});
check("blank scope is useful and the brief builder bounds overly long notes", () => {
  assert.ok(createBriefText(new Set()).includes("help choosing"));
  assert.ok(!createBriefText(new Set(), "   ").includes("Project context:"));
  const text = createBriefText(new Set(), "x".repeat(1600));
  assert.ok(text.includes("x".repeat(1200)));
  assert.ok(!text.includes("x".repeat(1201)));
});
check("notes never split emoji at the 1,200-unit boundary", () => {
  for (const length of [1198, 1199, 1200]) {
    const notes = "x".repeat(length) + "😀";
    const safe = normalizeNotes(notes);
    assert.ok(safe.length <= 1200);
    assert.ok(!/[\ud800-\udbff]$/.test(safe));
    assert.equal(
      createBriefInquiry(new Set([4]), notes, "qa@example.test").description,
      createBriefText(new Set([4]), notes),
    );
  }
  assert.equal(normalizeNotes("\ud83dhello\udc00"), "\ufffdhello\ufffd");
});
check("map labels remain inside the viewport and avoid controls and other labels", () => {
  const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const width of [320, 375, 800, 1280]) {
    const bounds = { width, height: 330 };
    const obstacles = [{ x: width - 60, y: 60, width: 48, height: 250 }];
    for (const anchor of [
      { x: -10, y: 160 },
      { x: width + 20, y: 90 },
      { x: width / 2, y: 320 },
      { x: width / 2, y: 160 },
      { x: width / 2, y: 160 },
    ]) {
      const box = placeMapLabel(anchor, { width: 135, height: 40 }, bounds, obstacles);
      if (!box) continue;
      assert.ok(
        box.x >= 8 &&
          box.y >= 8 &&
          box.x + box.width <= width - 8 &&
          box.y + box.height <= bounds.height - 8,
      );
      assert.ok(obstacles.every((o) => !overlaps(box, o)));
      obstacles.push(box);
    }
  }
  assert.equal(
    placeMapLabel({ x: 10, y: 10 }, { width: 400, height: 40 }, { width: 320, height: 330 }, []),
    null,
  );
  assert.equal(
    placeMapLabel({ x: 160, y: 150 }, { width: 135, height: 40 }, { width: 320, height: 330 }, [
      { x: 0, y: 0, width: 320, height: 330 },
    ]),
    null,
  );
});
check("glyph background surrounds the camera without a backdrop plane", () => {
  let seed = 7251;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const field = createGlyphFieldData(random);
  assert.equal(field.positions.length, 768 * 3);
  const octants = new Set();
  // The non-normalized orbit reaches radius 75.3 at its maximum allowed tilt.
  const maximumCameraRadius = 47 * 1.19 * Math.sqrt(1 + Math.sin(1.12) ** 2);
  for (let i = 0; i < field.cells.length; i++) {
    const [x, y, z] = field.positions.slice(i * 3, i * 3 + 3);
    const radius = Math.hypot(x, y, z);
    assert.ok(radius >= 88 && radius <= 98);
    assert.ok(radius - 0.65 > maximumCameraRadius);
    assert.ok(radius + 0.65 + maximumCameraRadius < 180);
    octants.add(`${x >= 0}:${y >= 0}:${z >= 0}`);
    assert.ok(Number.isInteger(field.cells[i]) && field.cells[i] >= 0 && field.cells[i] < 64);
  }
  assert.equal(octants.size, 8);
  assert.doesNotMatch(app, /rainPlane|rainCanvas/);
});
check("fictional mission, fake metrics and gameplay API are removed", () => {
  for (const stale of [
    "Ghost in the system",
    "The Source",
    "Zion Prime",
    "98.4%",
    "01:30",
    "+300 XP",
    "Accept mission",
    "star map",
    "ALL SYSTEMS OPERATIONAL",
  ])
    assert.ok(!html.includes(stale), stale);
  assert.doesNotMatch(app, /newMission|missionStep|control_starworld|inspect_starworld/);
  assert.ok(html.includes("Send inquiry"));
  assert.match(html, /<form id="brief-form" method="post" action="\/api\/inquiries">/);
  assert.doesNotMatch(app + html, /mailto:|sessionStorage\.setItem\(/);
  assert.match(app, /sessionStorage\.removeItem\(legacyDraftKey\)/);
  assert.doesNotMatch(app.slice(app.indexOf("const modelContext")), /brief-notes|brief-email/);
  assert.ok(app.includes("application") || html.includes("applications"));
});
check("HTML contains two valid scripts and no external asset dependencies", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  scripts.forEach((s, i) => new Script(s[1], { filename: `inline-${i}.js` }));
  assert.doesNotMatch(html, /<(?:script|img|link|iframe|source)[^>]+(?:src|href)=['"]https?:\/\//i);
  assert.deepEqual(
    [...app.matchAll(/\bimport\s*\("([^"]+)"\)/g)].map((match) => match[1]),
    ["/src/shared/secure-inquiry.js?v=pqc1"],
  );
  assert.match(app, /if \(window\.location\.protocol === "https:"\) \{\s*import\(/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /STARWORLD_(?:ENGINE|APP) -->/);
});
check(
  "bundled real Three.js engine initializes, exports primitives, and raycasts sphere, phone and shield models",
  () => {
    const engine = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const ctx = createContext({ window: {}, console });
    new Script(engine).runInContext(ctx);
    const T = ctx.window.STARWORLD_THREE;
    assert.equal(T.REVISION, "164");
    const ray = new T.Raycaster(new T.Vector3(0.1, 0.1, 12), new T.Vector3(0, 0, -1));
    for (const index of [0, 5, 6]) {
      const geometry = makeServiceGeometry(T, worlds[index], index);
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      assert.ok(
        Number.isFinite(bounds.min.x) && bounds.max.x > bounds.min.x && bounds.max.z > bounds.min.z,
      );
      assert.equal(geometry.type, index === 0 ? "SphereGeometry" : "ExtrudeGeometry");
      const model = new T.Mesh(geometry, new T.MeshBasicMaterial());
      model.updateMatrixWorld();
      assert.ok(
        ray.intersectObject(model).length > 0,
        `model ${worlds[index].model || "sphere"} must be pickable`,
      );
    }
    for (let i = 0; i < worlds.length; i++)
      for (let j = i + 1; j < worlds.length; j++) {
        const distance = new T.Vector3(...worlds[i].position).distanceTo(
          new T.Vector3(...worlds[j].position),
        );
        assert.ok(
          distance > worlds[i].radius + worlds[j].radius,
          `models ${i}/${j} must not intersect`,
        );
      }
  },
);
check("all direct DOM references exist and HTML ids are unique", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of app.matchAll(/\$\(["']([^"']+)["']\)/g))
    assert.ok(ids.includes(match[1]), `missing ${match[1]}`);
});
check("fallback, keyboard, gesture cancellation, hidden-tab and reduced-motion paths exist", () => {
  for (const token of [
    "webglcontextlost",
    "pointercancel",
    "lostpointercapture",
    "visibilitychange",
    "prefers-reduced-motion",
    "keydown",
    "showModal",
  ])
    assert.ok(app.includes(token), token);
  for (const token of [
    "@media(max-width:580px)",
    "@media(prefers-reduced-motion:reduce)",
    "touch-action:pan-y",
    "focus-visible",
    "SERVICE LIST MODE",
  ])
    assert.ok(html.replace(/\s+/g, "").includes(token.replace(/\s+/g, "")), token);
});
console.log(
  `\n${checks} automated checks passed. Live browser results are documented in docs/reviews/starworld-qa.md.`,
);
