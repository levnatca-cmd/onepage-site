import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { parse } from "parse5";
import { projectPath } from "../../scripts/lib/paths.mjs";
import {
  QUESTION_FLOW,
  SCORE_MAP,
  CHOICE_VISUALS,
  ARCHETYPES,
} from "../../src/galaxy/js/data/quiz-data.js";
import {
  buildProjectSummary,
  buildProjectShare,
  getProjectAnswers,
} from "../../src/galaxy/js/project-summary.js";

const html = readFileSync(projectPath("explore.html"), "utf8");
const doc = parse(html);
const star = parse(readFileSync(projectPath("src/starworld/index.html"), "utf8"));
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
function all(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes || []).flatMap((child) => all(child, predicate)),
  ];
}
function text(node) {
  if (["script", "style"].includes(node.tagName)) return "";
  return node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
}
const normalize = (value) => value.replace(/\s+/g, " ").trim();
const byId = (id) => all(doc, (n) => attr(n, "id") === id)[0];
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS content: ${name}`);
}

check("all form questions and answer labels match the 3D registry", () => {
  const fieldsets = all(byId("fingerprint-form"), (n) => n.tagName === "fieldset");
  assert.equal(fieldsets.length, QUESTION_FLOW.length);
  for (const [index, question] of QUESTION_FLOW.entries()) {
    const fieldset = fieldsets[index];
    const legend = all(fieldset, (n) => n.tagName === "legend")[0];
    assert.equal(normalize(text(legend)).replace(/^\d+\.\s*/, ""), question.prompt);
    const labels = all(fieldset, (n) => n.tagName === "label");
    assert.equal(labels.length, question.choices.length);
    for (const [i, choice] of question.choices.entries()) {
      const input = all(labels[i], (n) => n.tagName === "input")[0];
      assert.equal(attr(input, "name"), question.id);
      assert.equal(attr(input, "value"), choice.value);
      assert.equal(normalize(text(labels[i])), choice.label);
      assert.ok(SCORE_MAP[choice.value], `Missing scoring for ${choice.value}`);
      assert.ok(CHOICE_VISUALS[choice.value], `Missing visual for ${choice.value}`);
    }
  }
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
      text(all(byId("fingerprint"), (n) => attr(n, "class") === "mission-meter-top")[0]),
    ).startsWith("Mission progress"),
    true,
  );
  assert.match(normalize(text(byId("hero-title"))), /Websites & apps/);
  for (const meta of all(doc, (n) => n.tagName === "meta"))
    assert.doesNotMatch(attr(meta, "content") || "", forbidden);
});

check("inquiry labels match draft creation and published prices stay unchanged", () => {
  assert.equal(normalize(text(byId("contact-send"))), "Open email draft");
  assert.equal(normalize(text(byId("email-map"))), "Request a working session");
  assert.match(normalize(text(byId("contact-hint"))), /Review and send it there/);
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

check("all 3125 complete answer sets produce ordered, truthful summaries", () => {
  let combinations = 0;
  function visit(index, answers) {
    if (index < QUESTION_FLOW.length) {
      const question = QUESTION_FLOW[index];
      for (const choice of question.choices)
        visit(index + 1, { ...answers, [question.id]: choice.value });
      return;
    }
    const summary = buildProjectSummary({ answers, archetype: ARCHETYPES.handoff });
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
    assert.match(
      buildProjectShare({ answers, archetype: ARCHETYPES.handoff }),
      /5 of 5 questions answered/,
    );
    assert.doesNotMatch(summary, /100\/100|I scored|System stability/);
    combinations += 1;
  }
  visit(0, {});
  assert.equal(combinations, 3125);
});

check("Starworld keeps stable service IDs and honest scope, draft and preference wording", () => {
  const context = createContext({});
  new Script(
    readFileSync(projectPath("src/starworld/data/services.js"), "utf8") +
      ";globalThis.services=worlds;",
  ).runInContext(context);
  const services = context.services;
  assert.deepEqual(
    Array.from(services, (s) => s.code),
    ["CORE", "APP", "API", "LINK", "CARE", "iOS", "SEC"],
  );
  assert.match(services[1].info, /website/i);
  assert.match(services[4].info, /hardware\/software/);
  assert.match(normalize(text(star)), /I agree on scope with you before work starts/);
  assert.match(normalize(text(star)), /Review and send it from your email app/);
  assert.match(normalize(text(star)), /until you reload this page/);
  assert.doesNotMatch(normalize(text(star)), /HOW WE WORK|Settings apply to this session/);
});

console.log(`${checks} content checks passed.`);
