// IDs also identify the semantic models in Galaxy. Studio uses the same order and routes.
export const GALAXY_SERVICES = Object.freeze(
  [
    {
      id: "firmware",
      label: "Website / app",
      heading: "Websites & apps",
      slug: "websites-apps",
      accentKey: "accent",
    },
    {
      id: "backend",
      label: "Backend / API",
      heading: "Backend & API",
      slug: "backend-api",
      accentKey: "api",
    },
    {
      id: "automation",
      label: "Automation",
      heading: "Workflow Automation",
      slug: "automation",
      accentKey: "automation",
    },
    {
      id: "pqc",
      label: "Post-quantum security",
      heading: "Post-Quantum Security",
      slug: "post-quantum-security",
      accentKey: "pqc",
    },
    {
      id: "data",
      label: "Data / logs",
      heading: "Data & Logs",
      slug: "data-logs",
      accentKey: "data",
    },
    {
      id: "hardware",
      label: "Hardware",
      heading: "Hardware & Device Integration",
      slug: "hardware",
      accentKey: "hardware",
    },
    {
      id: "ops",
      label: "Monitoring",
      heading: "Monitoring & Maintenance",
      slug: "monitoring",
      accentKey: "ops",
    },
  ].map((service) => Object.freeze({ ...service, path: `/services/${service.slug}/` })),
);

export const GALAXY_SERVICE_BY_ID = Object.freeze(
  Object.fromEntries(GALAXY_SERVICES.map((service) => [service.id, service])),
);
