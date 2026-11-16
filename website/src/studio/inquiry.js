export const DRAFT_KEY = "levnat.project-inquiry.v1";
const emailTemplate = [
  "Hi LEVNAT,",
  "",
  "I need help with:",
  "Target date (optional):",
  "",
  "Example: Add online booking to my website.",
].join("\r\n");

export const INQUIRY_EMAIL_DRAFT_URL =
  `mailto:info@levnat.ca?subject=${encodeURIComponent("Project inquiry")}` +
  `&body=${encodeURIComponent(emailTemplate)}`;

export const SERVICE_LABELS = {
  unsure: "Not sure yet",
  websites: "Websites & apps",
  integrations: "APIs & automation",
  support: "Debugging & ongoing support",
  ios: "Native iOS development",
  security: "Product security and post-quantum readiness",
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
