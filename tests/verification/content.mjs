import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { parse } from "parse5";
import { projectPath } from "../../scripts/lib/paths.mjs";
import { readStarworldFile } from "../../scripts/lib/starworld-source.mjs";
import {
  PLANET_IDS,
  QUESTION_FLOW,
  SCORE_MAP,
  ARCHETYPES,
} from "../../src/galaxy/js/data/quiz-data.js";
import {
  buildProjectSummary,
  buildProjectShare,
  getProjectAnswers,
  getProjectArchetypeKey,
} from "../../src/galaxy/js/project-summary.js";

const doc = parse(readFileSync(projectPath("explore.html"), "utf8"));
const star = parse(readFileSync(projectPath("src/starworld/index.html"), "utf8"));
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
function all(node, predicate, includeTemplates = false) {
  const children = includeTemplates && node.content ? node.content.childNodes : node.childNodes;
  return [
    ...(predicate(node) ? [node] : []),
    ...(children || []).flatMap((child) => all(child, predicate, includeTemplates)),
  ];
}
function text(node) {
  if (["script", "style"].includes(node.tagName)) return "";
  return node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
}
const normalize = (value) => value.replace(/\s+/g, " ").trim();
const byId = (id) => all(doc, (n) => attr(n, "id") === id)[0];
const archivedById = (id) =>
  all(byId("galaxy-quiz-archive"), (node) => attr(node, "id") === id, true)[0];
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS content: ${name}`);
}

check("all five questions mirror the seven service choices in the archived text form", () => {
  const fieldsets = all(archivedById("fingerprint-form"), (n) => n.tagName === "fieldset");
  assert.equal(QUESTION_FLOW.length, 5);
  assert.equal(PLANET_IDS.length, 7);
  assert.equal(fieldsets.length, QUESTION_FLOW.length);
  const values = new Set();
  for (const [index, question] of QUESTION_FLOW.entries()) {
    const fieldset = fieldsets[index];
    const legend = all(fieldset, (n) => n.tagName === "legend")[0];
    assert.equal(normalize(text(legend)).replace(/^\d+\.\s*/, ""), question.prompt);
    const labels = all(fieldset, (n) => n.tagName === "label");
    assert.equal(labels.length, question.choices.length);
    assert.deepEqual(
      question.choices.map(({ serviceId }) => serviceId).sort(),
      [...PLANET_IDS].sort(),
    );
    for (const [i, choice] of question.choices.entries()) {
      const input = all(labels[i], (n) => n.tagName === "input")[0];
      assert.equal(attr(input, "name"), question.id);
      assert.equal(attr(input, "value"), choice.value);
      assert.equal(normalize(text(labels[i])), choice.label);
      assert.ok(!values.has(choice.value), `Duplicate answer value: ${choice.value}`);
      values.add(choice.value);
      const scores = Object.entries(SCORE_MAP[choice.value] || {});
      assert.ok(scores.length, `Missing scoring for ${choice.value}`);
      for (const [outcome, score] of scores) {
        assert.ok(Object.hasOwn(ARCHETYPES, outcome), `Unknown outcome: ${outcome}`);
        assert.ok(Number.isFinite(score) && score > 0, `Invalid score for ${choice.value}`);
      }
    }
  }
});

check("legacy answers retain their recommendations and tie order", () => {
  const journeys = [
    ["ghost", "firmware", "crossStack", "users", "patch", "map"],
    ["handoff", "backend", "firmwareBackend", "integrations", "person", "handoff"],
    ["spreadsheet", "automation", "businessAutomation", "manual", "retry", "manualOps"],
    ["hardware", "hardware", "hardwareFirmware", "devices", "logs", "hardwareCare"],
    ["ops", "ops", "backendOps", "incidents", "debate", "monitoring"],
  ];
  for (const [expected, ...values] of journeys) {
    const answers = Object.fromEntries(QUESTION_FLOW.map(({ id }, index) => [id, values[index]]));
    assert.equal(getProjectAnswers(answers).length, 5);
    assert.equal(getProjectArchetypeKey(answers), expected);
  }
  assert.equal(getProjectArchetypeKey({ q1: "backend" }), "handoff");
});

check("a new project has coherent planning and first-version answers", () => {
  const answers = { q1: "firmware", q2: "crossStack", q3: "users", q4: "patch", q5: "map" };
  const rows = getProjectAnswers(answers);
  assert.equal(rows.length, 5);
  assert.match(rows[0].answer, /Website/);
  assert.match(rows[1].answer, /new idea/);
  assert.match(rows[3].answer, /first version/);
  assert.match(rows[4].answer, /Scope/);
  assert.doesNotMatch(
    rows.map((r) => r.question + r.answer).join(" "),
    /usually break|field incidents|real engagement/,
  );
});

check("completion is labeled as progress rather than technical health", () => {
  const ui = readFileSync(projectPath("src/galaxy/js/ui.js"), "utf8");
  const main = readFileSync(projectPath("src/galaxy/js/main.js"), "utf8");
  const forbidden =
    /System stability|Signal score|signal score|Rescue complete|I scored|Full-Stack System Rescue|cinematic rescue score/;
  assert.doesNotMatch(normalize(text(doc)), forbidden);
  assert.doesNotMatch(ui + main, forbidden);
  assert.equal(
    normalize(
      text(
        all(
          archivedById("galaxy-quiz-form").content,
          (n) => attr(n, "class") === "mission-meter-top",
        )[0],
      ),
    ).startsWith("Mission progress"),
    true,
  );
  assert.match(normalize(text(byId("hero-title"))), /Websites & apps/);
  for (const meta of all(doc, (n) => n.tagName === "meta"))
    assert.doesNotMatch(attr(meta, "content") || "", forbidden);
});

check("the quiz archive stays outside the live Galaxy flow", () => {
  assert.equal(byId("galaxy-quiz-archive")?.tagName, "template");
  for (const id of ["quiz-console", "fingerprint-form", "result-title", "completion-status"]) {
    assert.ok(archivedById(id), `Retain the authored quiz content for ${id}`);
    assert.equal(byId(id), undefined, `Do not expose ${id} in the live page`);
  }
  for (const id of ["project-quiz", "quiz-answers", "fingerprint", "result"])
    assert.ok(byId(id), `Retain a native destination for #${id}`);
  assert.ok(byId("service-preview"), "Keep the service preview accessible");
  assert.deepEqual(
    all(byId("services"), (node) => node.tagName === "a" && attr(node, "data-galaxy-service-link"))
      .map((link) => attr(link, "data-galaxy-service-link"))
      .sort(),
    [...PLANET_IDS].sort(),
  );
  assert.equal(all(doc, (node) => attr(node, "data-start-3d") !== undefined).length, 0);
  for (const meta of all(doc, (node) => node.tagName === "meta"))
    assert.doesNotMatch(attr(meta, "content") || "", /answer five questions|3D (?:project )?quiz/i);
});

check("inquiries use the protected endpoint and published prices stay unchanged", () => {
  assert.equal(normalize(text(byId("contact-send"))), "Send inquiry");
  assert.equal(attr(byId("contact-send"), "disabled"), "");
  assert.equal(attr(byId("contact-form"), "method"), "post");
  assert.equal(attr(byId("contact-form"), "action"), "/api/inquiries");
  assert.equal(attr(archivedById("planning-inquiry"), "href"), "/contact/?service=planning");
  assert.doesNotMatch(normalize(text(byId("contact-hint"))), /quiz|questionnaire|answers/i);
  const schema = all(
    doc,
    (n) => n.tagName === "script" && attr(n, "type") === "application/ld+json",
  )[0];
  const graph = JSON.parse(schema.childNodes.map((node) => node.value || "").join(""));
  const offers = graph["@graph"].find((item) => item["@type"] === "ProfessionalService")
    .hasOfferCatalog.itemListElement;
  assert.equal(offers[0].price, "500");
  assert.deepEqual(
    offers.slice(1, 4).map((offer) => offer.priceSpecification.minPrice),
    ["4000", "8000", "20000"],
  );
  assert.match(offers[4].description, /200\/hr.*2,000\/mo/);
  assert.doesNotMatch(normalize(text(byId("process"))), /2.8 weeks|1.2 weeks/);
});

check("empty and invalid answers do not fabricate a recommendation", () => {
  const blank = buildProjectSummary({ archetype: ARCHETYPES.hardware });
  assert.match(blank, /0 \/ 5 answered/);
  assert.doesNotMatch(blank, /Initial recommendation:/);
  assert.match(blank, /not a technical assessment or a tailored plan/);
  assert.deepEqual(getProjectAnswers({ q1: "unknown", q7: "hardware" }), []);
  assert.doesNotMatch(buildProjectShare(), /scored|100|I explored/);
});

check("partial summaries retain choices and Unicode context without inventing answers", () => {
  const notes = "New website & portal\nCaf\u00e9 \ud83d\ude80 <notes>";
  const summary = buildProjectSummary({
    answers: { q1: "firmware", q5: "map" },
    archetype: ARCHETYPES.ghost,
    notes,
  });
  assert.match(summary, /2 \/ 5 answered/);
  assert.ok(summary.includes(notes));
  assert.ok(summary.includes(QUESTION_FLOW[0].choices[0].label));
  assert.ok(summary.includes(QUESTION_FLOW[4].choices[0].label));
  assert.ok(!summary.includes(QUESTION_FLOW[1].prompt));
  assert.doesNotMatch(summary, /undefined|System stability|Signal score|100\/100/);
  const mail = new URL("mailto:info@levnat.ca?body=" + encodeURIComponent(summary));
  assert.equal(mail.searchParams.get("body"), summary);
});

const possibleAnswerSets = QUESTION_FLOW.reduce((total, { choices }) => total * choices.length, 1);
check(`all ${possibleAnswerSets} complete answer sets produce ordered, truthful summaries`, () => {
  let combinations = 0;
  function visit(index, answers) {
    if (index < QUESTION_FLOW.length) {
      const question = QUESTION_FLOW[index];
      for (const choice of question.choices)
        visit(index + 1, { ...answers, [question.id]: choice.value });
      return;
    }
    const archetype = ARCHETYPES[getProjectArchetypeKey(answers)];
    assert.ok(archetype, "A complete answer set must have a recommendation");
    const summary = buildProjectSummary({ answers, archetype });
    const rows = getProjectAnswers(answers);
    assert.equal(rows.length, 5);
    assert.match(summary, /5 \/ 5 answered \(completion only\)/);
    let previous = -1;
    for (const row of rows) {
      const position = summary.indexOf(row.question);
      assert.ok(position > previous);
      assert.ok(summary.includes(row.answer));
      previous = position;
    }
    assert.match(buildProjectShare({ answers, archetype }), /5 of 5 questions answered/);
    assert.doesNotMatch(summary, /100\/100|I scored|System stability/);
    combinations += 1;
  }
  visit(0, {});
  assert.equal(combinations, possibleAnswerSets);
});

check("Starworld keeps stable service IDs and honest scope, draft and preference wording", () => {
  const context = createContext({});
  new Script(readStarworldFile("data/services.js") + ";globalThis.services=worlds;").runInContext(
    context,
  );
  const services = context.services;
  assert.deepEqual(
    Array.from(services, (s) => s.code),
    ["CORE", "APP", "API", "LINK", "CARE", "iOS", "SEC"],
  );
  assert.match(services[1].info, /website/i);
  assert.match(services[4].info, /hardware\/software/);
  assert.match(normalize(text(star)), /I agree on scope with you before work starts/);
  assert.match(normalize(text(star)), /Your brief is held on this page/);
  assert.match(normalize(text(star)), /until you reload this page/);
  assert.doesNotMatch(normalize(text(star)), /HOW WE WORK|Settings apply to this session/);
});

console.log(`${checks} content checks passed.`);
