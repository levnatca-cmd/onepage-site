import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "parse5";
import { pagePath, websitePath } from "../../scripts/lib/paths.mjs";
import { INQUIRY_EMAIL_DRAFT_URL } from "../../../website/src/studio/inquiry.js";
import {
  PLANET_IDS,
  QUESTION_FLOW,
  SCORE_MAP,
  ARCHETYPES,
} from "../../../website/src/galaxy/js/data/quiz-data.js";
import {
  buildProjectSummary,
  buildProjectShare,
  getProjectAnswers,
  getProjectArchetypeKey,
} from "../../../website/src/galaxy/js/project-summary.js";

const doc = parse(readFileSync(pagePath("explore.html"), "utf8"));
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
  const ui = readFileSync(websitePath("src/galaxy/js/ui.js"), "utf8");
  const main = readFileSync(websitePath("src/galaxy/js/main.js"), "utf8");
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
  for (const path of ["explore.html", "home/index.html"]) {
    const page = path === "explore.html" ? doc : parse(readFileSync(pagePath(path), "utf8"));
    const services = all(page, (node) => attr(node, "id") === "services")[0];
    const bookmark = all(page, (node) => attr(node, "id") === "service-preview");
    assert.equal(bookmark.length, 1, `${path} retains only the old preview bookmark`);
    assert.equal(bookmark[0].tagName, "span");
    assert.ok(services.childNodes.includes(bookmark[0]));
    assert.equal(all(page, (node) => attr(node, "id") === "service-preview-title").length, 0);
  }
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

check("inquiries use the protected endpoint", () => {
  assert.equal(normalize(text(byId("contact-send"))), "Send inquiry");
  assert.equal(attr(byId("contact-send"), "disabled"), "");
  assert.equal(attr(byId("contact-form"), "method"), "post");
  assert.equal(attr(byId("contact-form"), "action"), "/api/inquiries");
  assert.equal(attr(archivedById("planning-inquiry"), "href"), "/contact/?service=planning");
  assert.doesNotMatch(normalize(text(byId("contact-hint"))), /quiz|questionnaire|answers/i);
  assert.doesNotMatch(normalize(text(byId("process"))), /2.8 weeks|1.2 weeks/);
  for (const page of [doc, parse(readFileSync(pagePath("home/index.html"), "utf8"))]) {
    const [contact] = all(page, (node) => attr(node, "id") === "contact");
    const [form] = all(contact, (node) => attr(node, "id") === "contact-form");
    assert.equal(form.parentNode.tagName, "details");
    assert.equal(attr(form.parentNode, "open"), undefined);
    const links = all(
      contact,
      (node) => node.tagName === "a" && attr(node, "href")?.startsWith("mailto:"),
    );
    assert.deepEqual(
      links.map((link) => attr(link, "href")),
      [INQUIRY_EMAIL_DRAFT_URL],
    );
    assert.equal(normalize(text(links[0])), "Email me");
    assert.equal(links[0].parentNode, form.parentNode.parentNode);
  }
});

check("both Galaxy themes publish the hourly rate in pricing and structured data", () => {
  const billingTerms =
    "Before work starts, we agree on an estimate and a maximum number of hours. You pay only for the hours actually worked. Any extra hours require your approval.";
  const legacyPackagePrice =
    /\$\s*(?:500|(?:2|4|8|20|50),?000)\b|\b(?:500|(?:2|4|8|20|50),?000)\s+CAD\b/i;

  for (const path of ["explore.html", "home/index.html"]) {
    const html = readFileSync(pagePath(path), "utf8");
    const page = path === "explore.html" ? doc : parse(html);
    const pricing = all(page, (node) => attr(node, "id") === "pricing")[0];
    assert.ok(pricing, `${path}: pricing anchor`);
    assert.match(normalize(text(pricing)), /\b200 CAD\/hour\b/, path);
    assert.ok(normalize(text(pricing)).includes(billingTerms), `${path}: billing terms`);
    assert.doesNotMatch(html, legacyPackagePrice, `${path}: retired package pricing`);

    const schema = all(
      page,
      (node) => node.tagName === "script" && attr(node, "type") === "application/ld+json",
    )[0];
    const graph = JSON.parse(schema.childNodes.map((node) => node.value || "").join(""));
    const service = graph["@graph"].find((item) => item["@type"] === "ProfessionalService");
    assert.equal(service.hasOfferCatalog, undefined, `${path}: retired offers`);
    const rate = service.makesOffer.priceSpecification;
    assert.equal(rate["@type"], "UnitPriceSpecification", path);
    assert.equal(rate.price, 200, path);
    assert.equal(rate.priceCurrency, "CAD", path);
    assert.equal(rate.unitText, "hour", path);
  }
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

console.log(`${checks} content checks passed.`);
