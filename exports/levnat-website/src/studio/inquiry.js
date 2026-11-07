export const DRAFT_KEY = "levnat.project-inquiry.v1";
export const SERVICE_LABELS = {
  unsure: "Not sure yet",
  websites: "Websites & apps",
  integrations: "APIs & automation",
  support: "Debugging & ongoing support",
  ios: "Native iOS development",
  planning: "Project planning session",
};
const limits = { name: 120, email: 254, description: 4000, budget: 120, timeline: 120 };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sanitizeInquiry(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const result = {
    service: Object.hasOwn(SERVICE_LABELS, source.service) ? source.service : "unsure",
  };
  for (const [key, limit] of Object.entries(limits)) {
    result[key] =
      typeof source[key] === "string"
        ? decoder.decode(encoder.encode(source[key].slice(0, limit)))
        : "";
  }
  return result;
}

export function buildInquiry(value) {
  const draft = sanitizeInquiry(value);
  return [
    "Project inquiry / LEVNAT",
    "",
    `Service: ${SERVICE_LABELS[draft.service]}`,
    ...(draft.name.trim() ? [`Name: ${draft.name.trim()}`] : []),
    ...(draft.email.trim() ? [`Reply to: ${draft.email.trim()}`] : []),
    ...(draft.budget.trim() ? [`Budget: ${draft.budget.trim()}`] : []),
    ...(draft.timeline.trim() ? [`Target date: ${draft.timeline.trim()}`] : []),
    "",
    "What I would like to build or improve:",
    draft.description.trim(),
    "",
    "Please help clarify the scope and next steps. No engagement is confirmed by this inquiry.",
  ].join("\n");
}

export function inquiryMailto(value) {
  const draft = sanitizeInquiry(value);
  const subject = `Project inquiry: ${SERVICE_LABELS[draft.service]}`;
  return `mailto:info@levnat.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildInquiry(draft))}`;
}
