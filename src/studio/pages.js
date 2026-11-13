import { GALAXY_SERVICE_BY_ID, GALAXY_SERVICES } from "../shared/service-catalog.js";
import { systemWorkbench, systemLedger } from "./lab/view.js";
import { SERVICE_LABELS } from "./inquiry.js";
import { DAYBOOK_DEMO_PATH } from "./start-route.js";

const arrow = '<i data-lucide="arrow-up-right" aria-hidden="true"></i>';

const serviceLinks = [
  {
    title: "Websites & applications",
    description:
      "Websites, web apps, customer portals and native iOS experiences. Built around what your users need to do.",
    href: GALAXY_SERVICE_BY_ID.firmware.path,
  },
  {
    title: "APIs & automation",
    description:
      "Connect your interface, data and existing tools. Replace repetitive steps with a workflow you can follow.",
    href: "/services/integrations/",
  },
  {
    title: "Debugging & ongoing support",
    description:
      "Investigate software and device-connected issues, plan fixes, and maintain the system you already have.",
    href: "/services/support/",
  },
];

function serviceRows(links = serviceLinks) {
  return `<div class="service-list">${links
    .map(
      (service, index) => `
    <article class="service-row">
      <span class="service-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <div class="service-content">
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      </div>
      <a class="text-link service-link" href="${service.href}" aria-label="Explore ${service.title}">Explore ${arrow}</a>
    </article>`,
    )
    .join("")}</div>`;
}

function pageIntro(eyebrow, heading, intro) {
  return `<section class="page-intro container">
    <p class="eyebrow">${eyebrow}</p>
    <h1>${heading}</h1>
    <p class="intro">${intro}</p>
  </section>`;
}

function galaxyServiceIntro(service, heading, intro, inquiryAction) {
  return `<section class="galaxy-service-hero">
    <div class="container galaxy-service-hero-layout">
      <div class="galaxy-service-hero-copy">
        <h1>${heading}</h1>
        <p class="galaxy-service-hero-intro">${intro}</p>
        <div class="galaxy-service-hero-actions">
          ${inquiryAction}
          <a class="galaxy-service-hero-return" href="/explore.html" data-galaxy-return>Back to Galaxy</a>
        </div>
      </div>
      <img class="galaxy-service-hero-art" src="/assets/images/galaxy-services/${service}.svg" width="960" height="540" alt="" decoding="async" />
    </div>
  </section>`;
}

function callout(heading, copy, href = "/contact/", label = "Discuss your project") {
  return `<section class="callout-band">
    <div class="container">
      <div><p class="eyebrow">Your next step</p><h2>${heading}</h2><p>${copy}</p></div>
      <a class="button primary" href="${href}">${label} ${arrow}</a>
    </div>
  </section>`;
}

function serviceDive({
  service,
  title,
  key,
  description,
  intro,
  outcome,
  startingPoint,
  flow,
  steps,
  ordered = true,
  note,
  related,
  relatedGalaxyService = false,
  inquiry,
}) {
  const { slug, heading, path } = GALAXY_SERVICE_BY_ID[service];
  const stepsTag = ordered ? "ol" : "ul";
  const [relatedPath, relatedLabel] = related;
  const [inquiryService, inquiryLabel] = inquiry;
  const inquiryAction = `<a class="button primary" href="/contact/?service=${inquiryService}">${inquiryLabel} ${arrow}</a>`;
  return {
    path,
    key: key ?? slug,
    galaxyService: service,
    inquiryService,
    title: title ?? heading,
    description,
    html: `
      ${galaxyServiceIntro(service, heading.replaceAll("&", "&amp;"), intro, inquiryAction)}
      <div class="container galaxy-service-details">
        <dl class="galaxy-service-brief">
          <div><dt>What you get</dt><dd>${outcome}</dd></div>
          <div><dt>What to share</dt><dd>${startingPoint}</dd></div>
        </dl>
        <section aria-labelledby="service-flow-heading">
          <h2 id="service-flow-heading">${flow}</h2>
          <${stepsTag} class="galaxy-service-steps" role="list">
            ${steps
              .map(
                ([icon, label, copy]) => `<li>
              <span class="galaxy-service-step-icon" aria-hidden="true"><i data-lucide="${icon}" aria-hidden="true"></i></span>
              <div><h3>${label}</h3><p>${copy}</p></div>
            </li>`,
              )
              .join("\n            ")}
          </${stepsTag}>
          ${note ? `<p class="galaxy-service-note">${note}</p>` : ""}
          <div class="galaxy-service-actions">
            ${inquiryAction}
            <a class="text-link" href="${relatedPath}"${relatedGalaxyService ? " data-galaxy-related" : ""}>${relatedLabel} ${arrow}</a>
          </div>
        </section>
      </div>
    `,
  };
}

function daybookPreview() {
  return `<figure class="daybook-preview">
    <div class="daybook-preview-heading"><strong>Daybook</strong><span>Independent working prototype</span></div>
    <ol class="daybook-map" aria-label="Daybook system architecture">
      <li><span class="service-number">01</span><strong>Booking</strong><span>Validated name &amp; unique slot</span></li>
      <li><span class="service-number">02</span><strong>Queue</strong><span>Pending requests &amp; safe replay</span></li>
      <li><span class="service-number">03</span><strong>Connection</strong><span>Simulated API &amp; device</span></li>
    </ol>
    <figcaption>One local system. A usable interface, visible delivery state and an inspectable event trail.</figcaption>
  </figure>`;
}

const prices = [
  [
    "Project planning session",
    "CAD $500",
    "Fixed price",
    "A 90-minute working session with preparation and follow-up notes. Identify priorities, risks and the next task. Implementation is separate.",
  ],
  [
    "Website or focused app interface",
    "From CAD $4,000",
    "20+ hours",
    "A responsive website or focused interface, with forms and primary actions. A complete custom app is scoped separately.",
  ],
  [
    "Automation or dashboard",
    "From CAD $8,000",
    "40+ hours",
    "A scoped workflow, integration or dashboard with the agreed data handling, notifications and reporting.",
  ],
  [
    "Web app, portal or backend",
    "From CAD $20,000",
    "100+ hours",
    "A custom application, portal or backend with the agreed screens, API, data model and access controls.",
  ],
  [
    "Debugging & technical support",
    "CAD $200/hour",
    "Scope agreed first",
    "Investigate software behaviour, logs and hardware/software faults. Findings determine the next work; a fix is not guaranteed.",
  ],
  [
    "Ongoing maintenance",
    "From CAD $2,000/month",
    "By agreement",
    "An agreed scope of updates, monitoring and maintenance. Included tasks, availability and response expectations are defined before support starts.",
  ],
];

const pricing = `<section class="section container" id="pricing" aria-labelledby="pricing-heading">
  <div class="section-heading">
    <p class="eyebrow">Starting prices / CAD</p>
    <h2 id="pricing-heading">Know where the work starts.</h2>
    <p>Build estimates use a CAD $200/hour baseline. I agree on scope, deliverables and an estimate before work starts.</p>
  </div>
  <div class="price-grid">${prices
    .map(
      ([name, price, basis, copy]) => `
    <article class="price-item">
      <h3>${name}</h3>
      <p class="price-amount">${price}</p>
      <p class="price-basis">${basis}</p>
      <p>${copy}</p>
    </article>`,
    )
    .join("")}
  </div>
  <p class="pricing-note">Starting prices are not fixed quotes. Scope depends on content, integrations, existing code, hardware access and the amount of rebuilding required. Taxes, hosting, paid tools, device parts and third-party fees are not included. Emergency rebuilds, inherited codebases, unusual hardware and regulated data are quoted after review.</p>
  <a class="text-link" href="/contact/">Request a project quote ${arrow}</a>
</section>`;

export const pages = [
  {
    path: DAYBOOK_DEMO_PATH,
    key: "daybook-demo",
    title: "Daybook Interactive Demo",
    description:
      "Try Daybook, an independent booking prototype with a request queue, a simulated API and a sample device.",
    html: `
      <section class="home-hero living-hero" aria-labelledby="daybook-demo-heading">
        <div id="engineering-scene" class="hero-scene" aria-hidden="true">
          <div class="scene-fallback living-fallback">
            <div class="fallback-system">
              <span class="fallback-system-label">DAYBOOK / LOCAL SYSTEM</span>
              <div class="fallback-system-path">
                <div class="fallback-system-node"><i data-lucide="app-window" aria-hidden="true"></i><strong>Booking</strong><span>Interface</span></div>
                <span class="fallback-system-link"></span>
                <div class="fallback-system-node"><i data-lucide="workflow" aria-hidden="true"></i><strong>Queue</strong><span>Simulated API</span></div>
                <span class="fallback-system-link"></span>
                <div class="fallback-system-node"><i data-lucide="radio" aria-hidden="true"></i><strong>Delivery</strong><span>Sample device</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="living-grid container">
          <div class="hero-content">
            <p class="eyebrow">LEVNAT / Independent prototype</p>
            <h1 class="hero-title" id="daybook-demo-heading">Daybook demo</h1>
            <p class="hero-intro">Try a booking flow, trace the request through a queue, and recover from a simulated connection fault.</p>
            <div class="actions">
              <a class="button primary" href="/contact/">Describe your project ${arrow}</a>
              <a class="text-link" href="/services/">Explore services ${arrow}</a>
            </div>
          </div>
          ${systemWorkbench()}
        </div>
        <div class="hero-controls container">
          <div class="scene-modes" role="group" aria-label="Engineering scene mode">
            <button type="button" data-scene-mode="build" aria-pressed="true">Build</button>
            <button type="button" data-scene-mode="connect" aria-pressed="false">Connect</button>
            <button type="button" data-scene-mode="care" aria-pressed="false">Debug</button>
          </div>
          <button class="icon-button" type="button" data-scene-pause aria-pressed="false" aria-label="Pause 3D motion" title="Pause 3D motion"><i data-lucide="pause" aria-hidden="true"></i></button>
        </div>
      </section>

      <section class="section container daybook-proof" aria-labelledby="home-daybook-heading">
        <div class="section-heading">
          <p class="eyebrow">Selected work / Independent prototype</p>
          <h2 id="home-daybook-heading">Daybook. More than a screen.</h2>
          <p>A working booking interface, a request queue and a simulated connected device. When a connection fails, the request stays visible until it can be delivered.</p>
        </div>
        <div class="daybook-proof-layout">
          ${daybookPreview()}
          <div class="daybook-proof-copy">
            <h3>The interesting part is what happens next.</h3>
            <p>Validation prevents conflicting bookings. A stable request identity keeps a replay from creating another delivery. The product and its 3D system share the same local state.</p>
            <p>Built as an independent experiment, not a commissioned client project. All booking and device activity stays in this prototype.</p>
            <a class="text-link" href="/work/daybook/">Inside Daybook ${arrow}</a>
          </div>
        </div>
      </section>

      ${systemLedger()}

      <section class="section container" aria-labelledby="home-services-heading">
        <div class="section-heading">
          <p class="eyebrow">Development / Integrations / Support</p>
          <h2 id="home-services-heading">Your next build. Or your next fix.</h2>
          <p>A new website, a first app, tools that need connecting, or a fault that needs investigation.</p>
        </div>
        ${serviceRows()}
        <a class="text-link" href="/services/">Services &amp; starting prices ${arrow}</a>
      </section>

      <section class="section container split-section" aria-labelledby="home-approach-heading">
        <div class="section-heading">
          <p class="eyebrow">One direct conversation</p>
          <h2 id="home-approach-heading">Your developer, not a handoff.</h2>
        </div>
        <div>
          <p>I work independently from Toronto and remotely. You speak directly with me about the scope, decisions, implementation and handover.</p>
          <p>A focused website or app interface starts at CAD $4,000. Larger builds, integrations and support have their own scope.</p>
          <a class="text-link" href="/approach/">How I work ${arrow}</a>
        </div>
      </section>
      ${callout("What do you want to build?", "Tell me what exists, what you need next and where you are getting stuck.")}
    `,
  },
  {
    path: "/services/",
    key: "services",
    title: "Development, Integrations & Support Services",
    description:
      "Website, web app and iOS development, APIs, workflow automation, hardware/software debugging and maintenance. View starting prices in CAD.",
    html: `
      ${pageIntro("Services / Build, connect, care", "Development, integrations<br>&amp; ongoing support.", "I build new websites and applications, connect existing tools, and investigate the software and device issues in between.")}
      <section class="section container" aria-labelledby="services-heading">
        <div class="section-heading">
          <h2 id="services-heading">Explore services</h2>
          <a class="text-link" href="/starworld.html">Open Starworld service map ${arrow}</a>
        </div>
        <nav class="actions" aria-labelledby="services-heading">
          ${GALAXY_SERVICES.map(({ path, heading }) => `<a class="button secondary" href="${path}">${heading.replaceAll("&", "&amp;")}</a>`).join("\n          ")}
        </nav>
      </section>
      <section class="section container" aria-labelledby="supporting-services-heading">
        <div class="section-heading">
          <h2 id="supporting-services-heading">Integration &amp; support</h2>
        </div>
        ${serviceRows(serviceLinks.slice(1))}
      </section>
      <section class="section container split-section" aria-labelledby="specialist-heading">
        <div class="section-heading">
          <p class="eyebrow">Specialist requirements</p>
          <h2 id="specialist-heading">Native iOS &amp; product security.</h2>
        </div>
        <div>
          <p>Native iPhone and iPad development with Swift and SwiftUI can be scoped alongside your backend and existing product.</p>
          <p>Product-security reviews and post-quantum readiness planning are separate, scoped engagements. Scope and platform constraints are reviewed first; no certification or compliance guarantee is implied.</p>
          <div class="actions">
            <a class="text-link" href="/contact/?service=ios">Discuss an iOS app ${arrow}</a>
            <a class="text-link" href="/contact/?service=security">Ask about a specialist review ${arrow}</a>
          </div>
        </div>
      </section>
      ${pricing}
      ${callout("Not sure which service fits?", "Describe the project in your own words. An inquiry does not commit you to a paid session or a build.")}
    `,
  },
  serviceDive({
    key: "websites",
    service: "firmware",
    title: "Website, Web App & iOS Development",
    description:
      "Scope and build a responsive website, customer portal, web application or native iOS app. Work directly with an independent developer.",
    intro: "Give users a clear path to book, sign in or get work done.",
    outcome: "An agreed scope, a tested build, and a handover for your team.",
    startingPoint:
      "The main action users need to take, the pages or features you need, and any existing tools.",
    flow: "What I build",
    ordered: false,
    steps: [
      ["app-window", "Websites", "Responsive sites and landing pages with forms and bookings."],
      [
        "panels-top-left",
        "Web apps",
        "Portals, dashboards and internal tools with roles and data.",
      ],
      [
        "smartphone",
        "Native iOS",
        "SwiftUI apps with API integration, device testing and release preparation.",
      ],
    ],
    note: "Websites and focused interfaces from CAD $4,000. Custom web apps and portals from CAD $20,000. Native iOS is quoted by scope.",
    related: ["/services/#pricing", "Full pricing &amp; exclusions"],
    inquiry: ["websites", "Discuss a website or app"],
  }),
  {
    path: "/services/integrations/",
    key: "integrations",
    title: "API Integrations & Workflow Automation",
    description:
      "Connect applications, APIs and data. Scope backend services, workflow automation and dashboards around your existing tools and business processes.",
    html: `
      ${pageIntro("Services / APIs & automation", "Connect your tools.<br>Remove the repeat work.", "I connect applications, build backend services and automate repetitive tasks. The scope starts with how information moves through your existing workflow.")}
      <section class="section container" aria-labelledby="integration-scope-heading">
        <div class="section-heading"><p class="eyebrow">What I can connect</p><h2 id="integration-scope-heading">A workflow, not another workaround.</h2></div>
        <div class="detail-grid">
          <article class="detail-item"><h3>Backend &amp; APIs</h3><p>Data models, endpoints, authentication and access controls that support the product's agreed business logic.</p></article>
          <article class="detail-item"><h3>Existing tools</h3><p>Third-party API connections, webhooks and data exchange between the systems you already use.</p></article>
          <article class="detail-item"><h3>Automation &amp; dashboards</h3><p>Forms, scheduled jobs, notifications, reports and internal views for repetitive or disconnected work.</p></article>
        </div>
      </section>
      <section class="section container split-section" aria-labelledby="integration-review-heading">
        <div class="section-heading"><p class="eyebrow">Before connecting anything</p><h2 id="integration-review-heading">Plan for the unhappy path.</h2></div>
        <ul class="ruled-list">
          <li><h3>Map the source of truth</h3><p>Identify which system owns each record, what must move and who is allowed to access it.</p></li>
          <li><h3>Review external constraints</h3><p>Check API access, subscriptions, rate limits and the quality of the existing data.</p></li>
          <li><h3>Handle failures deliberately</h3><p>Agree on validation, duplicate handling, retries and how a person can investigate a failed run.</p></li>
          <li><h3>Test and document the workflow</h3><p>Check the agreed paths with suitable test data and document configuration and recovery steps.</p></li>
        </ul>
      </section>
      <section class="section container" aria-labelledby="integration-price-heading">
        <div class="section-heading"><p class="eyebrow">Starting scope / CAD</p><h2 id="integration-price-heading">Start with one connected workflow.</h2></div>
        <div class="price-grid">
          <article class="price-item"><h3>Automation or dashboard</h3><p class="price-amount">From CAD $8,000</p><p>A scoped workflow, dashboard or integration. Complexity, data cleanup and third-party access affect the estimate.</p></article>
          <article class="price-item"><h3>Custom backend or product build</h3><p class="price-amount">From CAD $20,000</p><p>A broader application or backend scope with agreed APIs, data models, roles and connected workflows.</p></article>
        </div>
        <p class="pricing-note">Taxes, hosting, paid tools and third-party subscriptions are not included.</p>
        <a class="text-link" href="/services/#pricing">Full pricing &amp; exclusions ${arrow}</a>
      </section>
      ${callout("What are you moving by hand?", "Describe the tools involved, the repetitive steps and where information gets lost or delayed.", "/contact/?service=integrations")}
    `,
  },
  {
    path: "/services/support/",
    key: "support",
    title: "Hardware/Software Debugging & Maintenance",
    description:
      "Investigate software and device-connected faults through logs, signals and application behaviour. Scope fixes, maintenance and ongoing technical support.",
    html: `
      ${pageIntro("Services / Debugging & ongoing support", "Understand the fault.<br>Plan the next fix.", "I investigate existing software and hardware/software issues through logs, device signals and application behaviour. Maintenance and ongoing support are scoped around the system you have.")}
      <section class="section container" aria-labelledby="support-scope-heading">
        <div class="section-heading"><p class="eyebrow">What I can investigate</p><h2 id="support-scope-heading">Follow the evidence across the system.</h2></div>
        <div class="detail-grid">
          <article class="detail-item"><h3>Software faults</h3><p>Reproduce issues in interfaces, APIs and background jobs. Review relevant logs and isolate likely causes.</p></article>
          <article class="detail-item"><h3>Device-connected issues</h3><p>Investigate device events, communication and software behaviour. Hardware access and diagnostic boundaries are agreed first.</p></article>
          <article class="detail-item"><h3>Maintenance</h3><p>Dependency updates, scoped fixes, technical documentation and monitoring work for an existing product.</p></article>
        </div>
      </section>
      <section class="section container split-section" aria-labelledby="support-boundaries-heading">
        <div class="section-heading"><p class="eyebrow">Clear expectations</p><h2 id="support-boundaries-heading">From symptoms to a clear next step.</h2></div>
        <ul class="ruled-list">
          <li><h3>Review the symptoms</h3><p>Share the expected behaviour, what actually happens, when it started and what has already been tried.</p></li>
          <li><h3>Agree on safe access</h3><p>Define access to code, logs, test environments and any physical devices before investigation.</p></li>
          <li><h3>Separate findings from fixes</h3><p>Document evidence, likely causes and open questions. Agree on implementation or further investigation separately.</p></li>
          <li><h3>Define ongoing support</h3><p>Agree on included tasks, availability and response expectations. No 24/7 coverage or emergency response is implied.</p></li>
        </ul>
      </section>
      <section class="section container" aria-labelledby="support-price-heading">
        <div class="section-heading"><p class="eyebrow">Support pricing / CAD</p><h2 id="support-price-heading">A focused investigation or ongoing care.</h2></div>
        <div class="price-grid">
          <article class="price-item"><h3>Debugging &amp; technical support</h3><p class="price-amount">CAD $200/hour</p><p>Investigation and agreed technical work. Findings, access and system condition determine what is possible next.</p></article>
          <article class="price-item"><h3>Ongoing maintenance</h3><p class="price-amount">From CAD $2,000/month</p><p>Maintenance and monitoring within a defined scope. Included work and response expectations are agreed upfront.</p></article>
        </div>
        <p class="pricing-note">Hardware/software debugging does not imply board-level repair, parts replacement or a guaranteed recovery. Taxes, device parts, hosting and third-party fees are extra.</p>
        <a class="text-link" href="/services/#pricing">Full pricing &amp; exclusions ${arrow}</a>
      </section>
      ${callout("What is behaving differently?", "Start with the symptoms and what the system should do. Do not include passwords, access tokens or private device data.", "/contact/?service=support", "Discuss a technical issue")}
    `,
  },
  serviceDive({
    service: "backend",
    description:
      "Build the logic behind a website or app, from the first request through validation, permissions, storage and response.",
    intro: "Give your app the rules, permissions and data it needs to work.",
    outcome: "A tested API workflow with agreed endpoints, permissions, and integration notes.",
    startingPoint:
      "One example request, the response you expect, and the systems that need to connect.",
    flow: "How a booking request works",
    steps: [
      ["log-in", "Validate", "Check the requested time slot and the account’s permissions."],
      ["database", "Save", "Check availability and prevent duplicate bookings."],
      ["circle-check", "Respond", "Confirm the booking or explain how to resolve an error."],
    ],
    related: [GALAXY_SERVICE_BY_ID.firmware.path, "Explore websites &amp; apps"],
    relatedGalaxyService: true,
    inquiry: ["integrations", "Discuss an API"],
  }),
  serviceDive({
    service: "automation",
    description:
      "Turn a repeated handoff into a workflow that shows what ran, what succeeded and what needs a person’s attention.",
    intro: "Automate repetitive handoffs and see when a run needs attention.",
    outcome: "A workflow with a run history and clear rules for retries and human review.",
    startingPoint: "What starts the workflow, which tools it touches, and who handles exceptions.",
    flow: "From form to follow-up",
    steps: [
      ["inbox", "Capture", "Receive a form or webhook and check required fields."],
      ["workflow", "Hand off", "Update the record and notify the person responsible."],
      ["rotate-ccw", "Recover", "Record the failure and follow the agreed retry or review path."],
    ],
    related: [GALAXY_SERVICE_BY_ID.data.path, "Explore data &amp; logs"],
    relatedGalaxyService: true,
    inquiry: ["integrations", "Discuss a workflow"],
  }),
  serviceDive({
    service: "pqc",
    description:
      "Review where your product relies on cryptography, then plan and test a migration within its platform and protocol constraints.",
    intro: "Find where your product uses cryptography and plan a migration.",
    outcome:
      "A cryptography inventory and a prioritized migration plan. Implementation is scoped separately.",
    startingPoint:
      "The clients, APIs, and vendors involved, and how long their data needs protection.",
    flow: "What the readiness review covers",
    steps: [
      [
        "key-round",
        "Map dependencies",
        "Find key exchanges and signatures across clients, APIs and vendors.",
      ],
      [
        "shield-check",
        "Set priorities",
        "Rank systems by how long data must stay private and what partners support.",
      ],
      [
        "flask-conical",
        "Plan validation",
        "Define compatibility and performance checks and a rollback plan.",
      ],
    ],
    related: [GALAXY_SERVICE_BY_ID.backend.path, "Explore backend &amp; API"],
    relatedGalaxyService: true,
    inquiry: ["security", "Discuss a readiness review"],
  }),
  serviceDive({
    service: "data",
    description:
      "Organize product records and technical events so you can trace what happened across an interface, backend and connected device.",
    intro: "See what happened across your app, API and connected devices.",
    outcome: "A trace that links events across systems, with agreed access and retention rules.",
    startingPoint: "A redacted example event, where you see it, and what you need to investigate.",
    flow: "Trace a device event",
    steps: [
      ["file-text", "Capture", "Record time, source and outcome. Keep sensitive data out of logs."],
      ["link", "Connect", "Use a shared ID to follow the event through the API and jobs."],
      ["list-filter", "Review", "Set retention, access and the views needed to investigate."],
    ],
    related: [GALAXY_SERVICE_BY_ID.ops.path, "Explore monitoring"],
    relatedGalaxyService: true,
    inquiry: ["integrations", "Discuss a data project"],
  }),
  serviceDive({
    service: "hardware",
    description:
      "Investigate how a connected device, its firmware and the application exchange signals when behaviour differs from what you expect.",
    intro: "Trace faults from a connected device through its firmware to your app.",
    outcome: "A record of where the signal stopped, the evidence, and the next test to run.",
    startingPoint:
      "The device model, expected and observed behavior, and any redacted logs you can share.",
    flow: "Find a missing device reading",
    steps: [
      ["cpu", "Check the device", "Review inputs and firmware output within the agreed access."],
      [
        "radio",
        "Follow the signal",
        "Compare device events with gateway traffic and backend logs.",
      ],
      [
        "clipboard-list",
        "Record the evidence",
        "Note where the reading stopped and what to test next.",
      ],
    ],
    related: ["/services/support/", "See debugging &amp; support"],
    inquiry: ["support", "Discuss a device issue"],
  }),
  serviceDive({
    service: "ops",
    description:
      "Choose which signals show that a live product is working, then agree on how faults are investigated and who responds.",
    intro: "Know when an important action fails and who should respond.",
    outcome: "A monitoring plan with checks, alert recipients, and recovery steps.",
    startingPoint:
      "One critical action to monitor, who should receive alerts, and your required response window.",
    flow: "From alert to recovery",
    steps: [
      ["activity", "Measure", "Check whether bookings save or a device is still reporting."],
      ["bell-ring", "Alert", "Show the failing action, time and relevant logs."],
      [
        "wrench",
        "Respond",
        "Agree who investigates, when they respond and how to verify recovery.",
      ],
    ],
    related: ["/services/support/", "See maintenance &amp; support"],
    inquiry: ["support", "Discuss monitoring"],
  }),
  {
    path: "/work/",
    key: "work",
    title: "Daybook & Independent Engineering Work",
    description:
      "Explore Daybook, an independent booking and recovery prototype, then smaller interface and systems studies. Working sample products, not client-project claims.",
    html: `
      ${pageIntro("Work / Independent products & experiments", "Working ideas.<br>Inspectable decisions.", "Independent prototypes, built with local sample data. No invented clients, production deployments or business results.")}
      <section class="section container daybook-proof" aria-labelledby="work-daybook-heading">
        <div class="section-heading">
          <p class="eyebrow">Featured / Booking &amp; connected systems</p>
          <h2 id="work-daybook-heading">Daybook</h2>
          <p>A small booking product with a real local workflow: validated requests, a queue, simulated faults and safe recovery.</p>
        </div>
        <div class="daybook-proof-layout">
          ${daybookPreview()}
          <div class="daybook-proof-copy">
            <h3>A request should survive a broken connection.</h3>
            <p>Daybook makes that requirement visible. Bookings can wait for a connection, move through the system, meet an API or device fault, and replay without duplicate delivery.</p>
            <p>The interface, event trail and spatial system react to the same state. Shareable configurations use public settings, not guest names or booking records.</p>
            <div class="actions">
              <a class="button primary" href="/work/daybook/">Read the case ${arrow}</a>
              <a class="text-link" href="${DAYBOOK_DEMO_PATH}#live-system">Open Daybook ${arrow}</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section container" aria-label="Interactive experiments">
        <div class="section-heading">
          <p class="eyebrow">Appendix / Smaller studies</p>
          <h2>One interaction at a time.</h2>
          <p>Earlier, focused studies in interface state and workflow feedback. Sample data only; these are not commissioned client projects.</p>
        </div>
        <div class="work-filters" role="group" aria-label="Filter experiments">
          <button type="button" data-filter="all" aria-pressed="true">All experiments</button>
          <button type="button" data-filter="interface" aria-pressed="false">Interfaces</button>
          <button type="button" data-filter="systems" aria-pressed="false">Systems</button>
        </div>
        <div class="experiments">
          <article class="experiment" id="request-workspace" data-category="interface">
            <div class="experiment-heading">
              <p class="eyebrow">01 / Interface / Independent demo</p>
              <h2>Request workspace</h2>
              <p>A local sample queue for a customer portal or internal tool. No account, server or real requests are involved.</p>
            </div>
            <div class="demo-board">
              <div class="demo-toolbar"><h3>Sample requests</h3><span class="demo-count">Added <output data-demo-count aria-live="polite">2</output></span></div>
              <ul class="demo-requests" data-demo-requests aria-label="Sample request queue" aria-live="polite" aria-relevant="additions">
                <li><span>Sample request 02</span><span class="status-tag">Queued</span></li>
                <li><span>Sample request 01</span><span class="status-tag">In review</span></li>
              </ul>
              <button class="button secondary" type="button" data-demo-request><i data-lucide="plus" aria-hidden="true"></i>Add sample request</button>
              <p class="demo-note">Sample data. Local to this page; resets on reload. Up to 10 requests, with the latest four shown.</p>
            </div>
          </article>
          <article class="experiment" id="connected-workflow" data-category="systems">
            <div class="experiment-heading">
              <p class="eyebrow">02 / Systems / Independent demo</p>
              <h2>Connected workflow</h2>
              <p>A simulated request moving through validation, routing and notification. This illustrates a workflow, not a live API connection.</p>
            </div>
            <div class="demo-workflow">
              <ol class="demo-pipeline" data-demo-pipeline aria-label="Sample workflow stages">
                <li data-state="waiting"><span class="stage-number">01</span><strong>Receive request</strong><span>Sample form data</span></li>
                <li data-state="waiting"><span class="stage-number">02</span><strong>Validate fields</strong><span>Simulated checks</span></li>
                <li data-state="waiting"><span class="stage-number">03</span><strong>Route to a queue</strong><span>Local sample record</span></li>
                <li data-state="waiting"><span class="stage-number">04</span><strong>Prepare notification</strong><span>Nothing is sent</span></li>
              </ol>
              <button class="button secondary" type="button" data-demo-run aria-describedby="workflow-status"><i data-lucide="play" aria-hidden="true"></i>Run sample workflow</button>
              <output id="workflow-status" class="demo-note" data-pipeline-status role="status">Sample data only. No external data is sent.</output>
            </div>
          </article>
          <article class="experiment" id="service-explorers" data-category="systems">
            <div class="experiment-heading">
              <p class="eyebrow">03 / Systems / Independent experiment</p>
              <h2>Engineering in 3D</h2>
              <p>Explore seven service models in Galaxy and see how the services connect in Starworld.</p>
              <p>These are presentation experiments, not technical assessments, delivered client work or tailored implementation plans.</p>
            </div>
            <div class="explorer-links">
              <a class="text-link" href="/explore.html">Open Galaxy ${arrow}</a>
              <a class="text-link" href="/starworld.html">Open Starworld service map ${arrow}</a>
            </div>
          </article>
        </div>
      </section>
      ${callout("Have a real workflow in mind?", "A demonstration is a starting point. Your actual users, data, access requirements and support needs define the build.")}
    `,
  },
  {
    path: "/work/daybook/",
    key: "daybook",
    title: "Daybook: A Booking System That Can Recover",
    description:
      "Inside Daybook, an independent local booking prototype: validated slots, idempotent delivery, API and device faults, replay, a shared 3D state and privacy-safe build artifacts.",
    html: `
      ${pageIntro("Work / Daybook / Independent prototype", "Daybook.<br>Built for the next state.", "A booking interface is the beginning. Daybook explores what happens when a request needs to wait, a connection fails, and the system has to recover without doing the same work twice.")}
      <section class="section container daybook-proof" aria-labelledby="daybook-overview-heading">
        <div class="section-heading">
          <p class="eyebrow">The product</p>
          <h2 id="daybook-overview-heading">A small booking. A whole system behind it.</h2>
          <p>I built Daybook as an independent working prototype for this site. It connects a usable HTML product to a spatial view of its interface, request queue, simulated API and sample device.</p>
        </div>
        ${daybookPreview()}
        <div class="actions">
          <a class="button primary" href="${DAYBOOK_DEMO_PATH}#live-system">Open Daybook ${arrow}</a>
          <a class="text-link" href="/work/">All independent work ${arrow}</a>
        </div>
      </section>

      <section class="section container split-section" aria-labelledby="daybook-problem-heading">
        <div class="section-heading">
          <p class="eyebrow">The question</p>
          <h2 id="daybook-problem-heading">What happens after the booking button?</h2>
        </div>
        <div>
          <p>A convincing screen can hide an unreliable workflow. A booking needs valid input and an available slot. A disconnected service needs a visible queue. A retry needs to deliver the original request, not create another one.</p>
          <p>Daybook brings those decisions into one local system. The interface remains usable without 3D; the spatial view makes the current system state easier to inspect.</p>
        </div>
      </section>

      <section class="section container" aria-labelledby="daybook-capabilities-heading">
        <div class="section-heading">
          <p class="eyebrow">Working scope</p>
          <h2 id="daybook-capabilities-heading">The behaviour is the evidence.</h2>
        </div>
        <div class="detail-grid">
          <article class="detail-item"><h3>Validated bookings</h3><p>Local validation checks the guest name and selected slot. A slot already held by a booking cannot be booked again.</p></article>
          <article class="detail-item"><h3>Visible delivery state</h3><p>Bookings remain pending when the simulated API is disconnected. Connecting it processes eligible requests while retaining their identity.</p></article>
          <article class="detail-item"><h3>Controlled faults</h3><p>Simulated API and device faults interrupt delivery. The affected request stays in the system rather than disappearing behind a success message.</p></article>
          <article class="detail-item"><h3>Repair &amp; replay</h3><p>Recovery retries pending requests. Idempotent handling prevents an already delivered request from being delivered again.</p></article>
          <article class="detail-item"><h3>An inspectable trail</h3><p>Local events record the important transitions. The booking product and 3D system reflect the same domain state.</p></article>
          <article class="detail-item"><h3>A public build artifact</h3><p>A share link restores allowlisted sample settings. A PNG build card captures the public system configuration, excluding guest names, booking records and inquiry drafts.</p></article>
        </div>
      </section>

      <section class="section container split-section" aria-labelledby="daybook-architecture-heading">
        <div class="section-heading">
          <p class="eyebrow">Architecture &amp; responsibility</p>
          <h2 id="daybook-architecture-heading">One state. More than one view.</h2>
        </div>
        <ul class="ruled-list">
          <li><h3>Domain logic owns the workflow</h3><p>Booking validation, request identity, queue transitions and recovery belong to local application state, not to an animation timeline.</p></li>
          <li><h3>HTML owns the product interaction</h3><p>Native form controls, visible records and explicit feedback carry the booking flow. The canvas is an additional view, not the only way to operate the product.</p></li>
          <li><h3>Three.js explains the system</h3><p>The spatial composition responds to the same connection and fault state as the interface. Reduced motion, pause and a static fallback keep the product independent of the spectacle.</p></li>
          <li><h3>Sharing has a separate boundary</h3><p>Only public configuration is serialized. Restored examples use synthetic sample state instead of copying the visitor's private booking data.</p></li>
        </ul>
      </section>

      <section class="section container split-section" aria-labelledby="daybook-limits-heading">
        <div class="section-heading">
          <p class="eyebrow">Scope &amp; limits</p>
          <h2 id="daybook-limits-heading">A prototype, not a production claim.</h2>
        </div>
        <div>
          <p>All bookings, queue processing, API responses and device events are local simulations. There is no backend, real appointment, payment, external notification or connected production device.</p>
          <p>The demo has three fixed sample slots. Request records exist only in this page's memory and are cleared by reset or reload; shared setups restore a synthetic example, not your records.</p>
          <p>This is my independent product experiment, not commissioned client work. It demonstrates a bounded workflow; it does not establish production reliability, security certification or a measured business result.</p>
          <p>A production version would need server-side validation and durable storage, authentication, real integration contracts, monitoring and testing against the agreed deployment environment.</p>
        </div>
      </section>
      ${callout("Have a booking flow to build?", "Tell me who needs to book, what happens next and which tools or devices the product should connect to.", "/contact/?service=websites", "Discuss your app")}
    `,
  },
  {
    path: "/approach/",
    key: "approach",
    title: "Working Directly With Your Developer",
    description:
      "How I scope, build, test and hand over websites, applications and technical investigations. Independent development from Toronto, working remotely.",
    html: `
      ${pageIntro("Approach / One direct working relationship", "Work directly with<br>your developer.", "LEVNAT is my independent development and systems-engineering practice. I work from Toronto and remotely, with scope, priorities and next steps agreed directly with you.")}
      <section class="section container split-section" aria-labelledby="approach-steps-heading">
        <div class="section-heading"><p class="eyebrow">How an engagement works</p><h2 id="approach-steps-heading">Clear steps. Agreed scope.</h2></div>
        <ol class="ruled-list">
          <li><h3>Describe the starting point</h3><p>Tell me what exists, who it serves and what you want to build or improve. An inquiry does not confirm an engagement.</p></li>
          <li><h3>Clarify the next task</h3><p>Review requirements, access and constraints. If deeper planning is needed, agree on a paid working session before proceeding.</p></li>
          <li><h3>Agree on scope and estimate</h3><p>Define deliverables, priorities, assumptions and a schedule before development or debugging starts.</p></li>
          <li><h3>Build or investigate</h3><p>Implement and test the agreed work, or investigate the fault. Review findings and agree on changes to the scope rather than silently expanding it.</p></li>
          <li><h3>Hand over and plan support</h3><p>Document the work and next steps. Maintenance, monitoring and support are optional, separately agreed services.</p></li>
        </ol>
      </section>
      <section class="section container" aria-labelledby="planning-heading">
        <div class="section-heading"><p class="eyebrow">When the project needs more definition</p><h2 id="planning-heading">A focused planning session.</h2><p>For an idea, inherited system or technical issue that needs a closer review before implementation can be scoped.</p></div>
        <div class="split-section">
          <div><p class="price-amount">CAD $500</p><p>A 90-minute working session, including preparation and follow-up notes. Implementation and extended investigation are not included.</p><a class="text-link" href="/contact/?service=planning">Ask about a planning session ${arrow}</a></div>
          <ul class="ruled-list">
            <li><h3>Project overview &amp; constraints</h3><p>Review the goals, existing work, access needs and key technical risks.</p></li>
            <li><h3>A first task to scope</h3><p>Identify the next build, integration, debugging or maintenance task.</p></li>
            <li><h3>Written next steps</h3><p>Record priorities and open questions needed for an implementation estimate. Not a complete technical audit.</p></li>
          </ul>
        </div>
      </section>
      <section class="section container" aria-labelledby="expectations-heading">
        <div class="section-heading"><p class="eyebrow">Before work starts</p><h2 id="expectations-heading">Practical expectations.</h2></div>
        <div class="detail-grid">
          <article class="detail-item"><h3>Timing follows the scope</h3><p>There is no universal launch date. Dependencies, access, content and review time are considered in the agreed schedule.</p></article>
          <article class="detail-item"><h3>Testing has a defined target</h3><p>Browsers, devices, workflows and release requirements are agreed for the project. Test coverage and known limitations are documented at handover.</p></article>
          <article class="detail-item"><h3>Support is explicit</h3><p>Availability, included tasks and response expectations are agreed separately. Ongoing support is not implied by a one-off build.</p></article>
        </div>
      </section>
      ${callout("Start with what you know.", "You do not need a finished specification to make an inquiry. Explain the goal, the existing system and what needs to happen next.")}
    `,
  },
  {
    path: "/contact/",
    key: "contact",
    title: "Discuss Your Website, App or Technical Issue",
    description: "Send an inquiry about your website, app, integration or hardware/software issue.",
    html: `
      ${pageIntro("Contact / Project inquiries", "What do you want<br>to build or fix?", "Tell me what exists, what you need next and any target date. I aim to reply within two business days; this is not an emergency-support channel.")}
      <section class="section container split-section" aria-labelledby="contact-details-heading">
        <div class="contact-details">
          <p class="eyebrow">Direct contact</p>
          <h2 id="contact-details-heading">One conversation to start.</h2>
          <address>
            <p>Toronto, Canada / Remote</p>
          </address>
          <p>Your inquiry does not book a paid session or confirm an engagement. Scope and pricing are agreed before work starts.</p>
          <a class="text-link" href="/services/#pricing">View starting prices ${arrow}</a>
          <noscript>
            <p>Enable JavaScript to submit your inquiry.</p>
          </noscript>
        </div>
        <form id="project-form" method="post" action="/api/inquiries" aria-labelledby="inquiry-heading" aria-describedby="inquiry-privacy-note">
          <h2 id="inquiry-heading">Send your inquiry.</h2>
          <p id="inquiry-privacy-note">You'll receive a reference once your inquiry is saved.</p>
          <div class="form-grid">
            <div class="field">
              <label for="inquiry-name">Name <span>(optional)</span></label>
              <input id="inquiry-name" name="name" type="text" autocomplete="name" maxlength="120">
            </div>
            <div class="field">
              <label for="inquiry-email">Email <span>(required)</span></label>
              <input id="inquiry-email" name="email" type="email" autocomplete="email" maxlength="254" required>
            </div>
            <div class="field full">
              <label for="inquiry-service">What do you need help with?</label>
              <select id="inquiry-service" name="service">
                <option value="unsure">Not sure yet</option>
                <option value="websites">Websites &amp; apps</option>
                <option value="integrations">APIs &amp; automation</option>
                <option value="support">Debugging &amp; ongoing support</option>
                <option value="ios">Native iOS development</option>
                <option value="security">${SERVICE_LABELS.security}</option>
                <option value="planning">Project planning session</option>
              </select>
            </div>
            <div class="field full">
              <label for="inquiry-description">What would you like to build or improve? <span>(required)</span></label>
              <textarea id="inquiry-description" name="description" rows="7" minlength="20" maxlength="4000" required aria-describedby="description-hint" placeholder="What exists, what you need next, and where you need help."></textarea>
              <p id="description-hint" class="field-hint">20 to 4,000 characters. Do not include passwords, API keys or sensitive customer or device data.</p>
            </div>
            <div class="field">
              <label for="inquiry-budget">Budget in CAD <span>(optional)</span></label>
              <input id="inquiry-budget" name="budget" type="text" maxlength="120" placeholder="A range, or not decided">
            </div>
            <div class="field">
              <label for="inquiry-timeline">Target date <span>(optional)</span></label>
              <input id="inquiry-timeline" name="timeline" type="text" maxlength="120" placeholder="A date, or flexible">
            </div>
          </div>
          <div class="form-actions">
            <button class="button primary" type="submit" disabled><i data-lucide="send" aria-hidden="true"></i>Send inquiry</button>
          </div>
          <p id="inquiry-status" role="status"></p>
        </form>
      </section>
    `,
  },
];
