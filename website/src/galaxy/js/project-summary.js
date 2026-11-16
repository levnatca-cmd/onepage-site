// Shared wording for the reviewable inquiry, saved summary and share action.
import { QUESTION_FLOW, SCORE_MAP } from "./data/quiz-data.js?v=wow60&rev=galaxy-seven-quiz1";

export function getProjectArchetypeKey(answers = {}) {
  const totals = { handoff: 0, ghost: 0, spreadsheet: 0, bench: 0, hardware: 0, ops: 0 };
  for (const answer of Object.values(answers)) {
    for (const [key, points] of Object.entries(SCORE_MAP[answer] || {})) {
      totals[key] += points;
    }
  }
  // The existing order above breaks ties consistently across the two quiz interfaces.
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
}

export function getProjectAnswers(answers = {}) {
  return QUESTION_FLOW.flatMap(function (question) {
    const choice = question.choices.find(function (item) {
      return item.value === answers[question.id];
    });
    return choice ? [{ question: question.prompt, answer: choice.label }] : [];
  });
}

export function buildProjectSummary({ answers = {}, archetype, notes = "" } = {}) {
  const selected = getProjectAnswers(answers);
  const lines = [
    "Project inquiry",
    "Questionnaire progress: " + selected.length + " / " + QUESTION_FLOW.length + " answered (completion only)."
  ];
  if (selected.length && archetype) {
    lines.push("Initial recommendation: " + archetype.name, archetype.summary);
  } else {
    lines.push("No questionnaire recommendation yet. Describe the project below or answer the questions.");
  }
  if (selected.length) {
    lines.push("Selected answers:", selected.map(function (item, index) {
      return (index + 1) + ". " + item.question + "\n   " + item.answer;
    }).join("\n"));
  }
  const context = String(notes).trim();
  if (context) lines.push("Project context:", context);
  if (selected.length && archetype) lines.push("Suggested next step: " + archetype.action);
  lines.push("This is an initial recommendation, not a technical assessment or a tailored plan.");
  return lines.join("\n\n");
}

export function buildProjectShare({ answers = {}, archetype } = {}) {
  const selected = getProjectAnswers(answers);
  if (!selected.length || !archetype) return "Explore the development and support services your project needs.";
  return "My initial project direction: " + archetype.name + ". " + selected.length + " of " + QUESTION_FLOW.length + " questions answered.";
}
