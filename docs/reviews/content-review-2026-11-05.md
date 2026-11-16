# Website content review - November 5, 2026

## Verdict and scope

The English is generally understandable. The main weakness is positioning and precision: Galaxy repeatedly presents development as rescuing a broken system, while the business offer also includes building new websites and apps. Several messages promise more than the free questionnaire or a single working session delivers. Starworld's service descriptions and email-draft disclosure are clearer, but its service coverage differs from Galaxy.

Reviewed: Galaxy's maintained root HTML, metadata and structured-data copy, questionnaire, archetype descriptions, dynamic status/share/email/export strings, pricing, process and contact; Starworld's HTML template, all seven service descriptions, brief builder and dynamic messages. The generated Starworld file was not treated as an editable source.

This is a source-based editorial review. Severity describes content impact, not a newly reproduced technical failure. No copy was applied to product files, no capabilities/prices were changed, and no external contact was made. Market-rate validity, actual response capacity, credentials and technical-standard currency were not independently verified.

## Highest-priority findings

### C01 - High: new-build clients are addressed as if they already have a broken system

Sources: `index.html:262`, `index.html:472`, `src/galaxy/js/data/quiz-data.js:139`.

Full-Stack System Rescue, Where does the chain usually break?, field incidents and debugging language suit an existing product with problems. A founder who needs a first website or app has no natural answer to several questions. A new project should be a first-class route, alongside improvement, integration, debugging and support.

Suggested headline: **Websites & apps. Built, connected and supported.** Supporting copy should explicitly introduce hardware/software debugging as an additional service. Keep the interactive mission language in the exploration experience rather than making rescue the entire offer.

A new-project option and branching questions require coordinated questionnaire/scoring work; changing the question heading alone will not fix the answer set.

### C02 - High: the free result is described as a tailored plan

Sources: `index.html:280`, `index.html:422`, `src/galaxy/js/ui.js:861`.

The hero promises a build/debug plan in approximately 60 seconds. The proof band says Leave with a system map, not just a pretty score. Current output consists of predefined archetype prose rather than a project-specific architecture, scope or implementation plan.

Suggested promise: **Answer five questions to get an initial project direction.** Add: **A tailored plan and estimate follow a review of your project.** The exact paid-session deliverables should remain aligned with the price card.

### C03 - High: a planning session is described as producing a finished system

Sources: `index.html:645`, `index.html:701`, `index.html:789`.

The service introduction says The working session turns it into a website, app, backend, dashboard... The CAD 500 offer is a 90-minute planning session with preparation and notes. The section currently blurs planning and implementation.

Suggested introduction: **Start with a focused review of your project. Agree on priorities, then scope the design, development or debugging work.**

### C04 - High: stability and rescue completion imply an assessment or repair

Sources: `index.html:447`, `src/galaxy/js/ui.js:692`, `src/galaxy/js/ui.js:801`, `src/galaxy/js/ui.js:897`.

System stability and I scored 100/100 suggest evaluated system health. The score is only answer count multiplied by 20. Rescue complete can imply that a fault has been resolved, although no real system was inspected.

Use **Mission progress** or **Questions completed**. Completion can remain playful: **Project direction unlocked**. A truthful share message is **I explored the services my project needs.** Avoid claiming a bespoke map until the saved artifact actually includes the visitor's choices.

### C05 - Medium: booking/sending labels overstate what the buttons do

Sources: `index.html:603`, `index.html:829`, `index.html:831`, `src/galaxy/js/ui.js:190`.

Book a working session creates an email draft; it does not reserve a time. Send via email opens the visitor's email application; no message has yet been sent. Contact requests are all titled Working session inquiry, even after Request a quote.

Use **Request a working session** for the session action and **Open email draft** for the contact form. Keep quote and paid-session intent distinct in the email subject/body. The existing contact hint is useful and should remain accurate after relabeling.

### C06 - Medium: the response-time sentence addresses the wrong person

Source: `index.html:814`.

Reply within two business days is an imperative addressed to the visitor. If it is an owner commitment, write **I aim to reply within two business days.** Use a firmer promise only if the owner can consistently meet it.

### C07 - Medium: technical shorthand obscures the deliverable

Sources: `index.html:643`, `index.html:706`, `index.html:712`, `src/galaxy/js/data/quiz-data.js:277`.

Phrases such as app surface, first build/debug slice, follow-up estimate path, maintenance loop, system signal and real-world layer are understandable internally but make business customers interpret the offer. Backend/API and hardware terms are appropriate when tied to recognizable work; repeated abstract metaphors are less helpful.

Use a concrete deliverable first, with technical detail as support. Examples are in the replacement table below. These are clarity improvements, not claims that every original phrase is grammatically incorrect.

### C08 - Medium: the questionnaire's language and answer categories do not line up

Sources: `index.html:438`, `index.html:472`, `index.html:494`, `index.html:505`, `src/galaxy/js/data/quiz-data.js:125`.

- Answer in plain language describes free-form input, but the form is multiple choice. Use **Choose the answer closest to your project.**
- What should become visible? has answers including Fragile first version and Who owns each layer. These mix product state, visibility and ownership.
- What should the real engagement turn into? is unnecessarily formal. Use **What would you like help with first?**, with an appropriately aligned answer set.
- Each choice adds a 3D object describes internal presentation mechanics and is not consistently visible while using the separate HTML form. Explain the useful output instead.

The HTML form, `QUESTION_FLOW`, 3D choice labels and result generation must be revised together. Preserve stable values only where their meanings remain valid.

### C09 - Medium: the support and timeline descriptions need boundaries

Sources: `index.html:754`, `index.html:790`, `index.html:796`, `index.html:801`.

Maintain is labeled 1-2 weeks even though support is offered monthly. If this is post-launch handover, call it **Launch support & handover**; if it is maintenance, describe it as **Ongoing, by agreement**. The 2-8-week Build label reads like a general delivery commitment across very different scopes. Qualify it as an indicative range after scoping, or omit it until the scope is known.

The CAD 2,000/month starting price does not explain included work, response expectations or exclusions. Add only commercially approved terms. Do not infer ten included hours merely from the CAD 200 hourly rate.

### C10 - Medium: the two experiences present different service portfolios

Sources: `index.html:651`, `src/starworld/data/services.js:20`, `src/starworld/data/services.js:93`, `src/starworld/data/services.js:116`.

Galaxy foregrounds websites and hardware debugging. Starworld foregrounds software, native iOS and security/post-quantum readiness, with no explicit website or hardware-debugging service. A client can infer different businesses or lose their original project category when switching experiences.

If both are intended to represent the same offer, agree on a shared service vocabulary and explain any intentionally narrower scope. Do not add an eighth service or advertise additional capabilities solely to make the lists match. Hardware debugging should be described at its real hardware/software boundary, not ambiguously as any kind of device repair.

## Additional editorial observations

- **Provider voice:** Galaxy uses What I build, while Starworld uses HOW WE WORK and we can discuss the scope. Both can be valid, but choose a consistent individual/agency voice for the brand. Do not imply a team that has not been established.
- **Evidence and trust:** the hero-proof strip lists Plan first, Build/debug and Support loop. These are process labels, not proof of results. Add only real project examples, deliverables or verifiable experience. Do not invent customers, testimonials, conversion gains or certifications.
- **Metadata:** Galaxy's description repeats the free-plan overpromise, and Twitter copy sells a cinematic rescue score. Lead search/social copy with the development/support offer and use the interactive experience as a secondary attraction. Keep metadata, visible headings and structured offers consistent.
- **Pricing arithmetic:** CAD 4,000 for 20+ hours, CAD 8,000 for 40+ hours and CAD 20,000 for 100+ hours are consistent with the stated CAD 200/hour baseline. The CAD 500 session includes preparation and notes, so comparing it only with 90 minutes of meeting time is not evidence of a pricing error. Prices were not market-benchmarked.
- **Starworld wording:** The scope is agreed around your product sounds stiff; prefer **We agree on scope before work starts** or the approved individual-voice equivalent. Connected functionality can become **Backend services that support your workflows**. Preserve the existing accurate email-draft disclosure and saved-tab limitation.
- **Settings promise:** Settings apply to this session is broader than the current refresh behavior found in the UI/UX audit. Until preferences are persisted, use **Settings apply until you reload this page.**
- **Security scope:** retain qualified language about reviews, readiness and supported platforms. Do not upgrade it to quantum-proof, guaranteed secure or compliance claims. Technical-standard currency and the provider's qualifications were not verified by this editorial review.

## Suggested first-screen copy

This draft reflects the stated offer and is not applied to the website.

**Headline**

Websites & apps.
Built, connected and supported.

**Supporting copy**

I build websites and applications, connect APIs and automate workflows. I also help debug hardware/software issues and maintain existing systems.

**Primary action**

Discuss your project

**Interactive action**

Explore your project in 3D

**Questionnaire introduction**

Answer five questions to get an initial project direction. Review the summary before sharing it with me.

The reviewable visitor-specific summary requires the inquiry work described in the improvement plan. Until that exists, use **See an initial recommendation based on your answers** instead of promising a complete brief.

## Targeted replacement table

| Current                           | Suggested replacement                   | Note                                                                      |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| Rescue score                      | Project explorer                        | Keeps the interactive route visible without implying diagnosis            |
| Website or app surface            | Website or focused app interface        | Clarifies UI scope without promising an entire app for the starting price |
| First build/debug slice           | First implementation or debugging task  | Names the deliverable                                                     |
| Follow-up estimate path           | Recommended next steps and estimate     | Use only if an estimate is actually part of the offer                     |
| This is the system signal         | Your initial project direction          | Accurately describes the current result                                   |
| The Hardware Debug Bridge         | Hardware & software debugging           | Can be the plain-language subtitle of a retained game archetype           |
| The Monitoring & Maintenance Loop | Monitoring & ongoing support            | Describes a service rather than an internal metaphor                      |
| Your problem in plain text        | Tell me about your project              | Includes new builds and does not frame every customer as having a problem |
| Book a working session            | Request a working session               | Matches an email inquiry                                                  |
| Send via email                    | Open email draft                        | Matches the actual handoff                                                |
| Download .md                      | Download summary (.md)                  | Keeps the actual format explicit                                          |
| Share score                       | Share project direction                 | Update generated share text and payload as well                           |
| Reply within two business days    | I aim to reply within two business days | Owner must confirm this operating commitment                              |
| Maintain / 1-2 weeks              | Launch support & handover               | Use Ongoing support instead if that is the intended service               |

## Questionnaire content direction

Suggested structure for a later coordinated flow update:

1. **What would you like to build or improve?** Website; web app/portal; native app if offered; integration/automation; existing device-backed system.
2. **What stage is the project at?** New idea; design/prototype; existing product; existing product with a fault; unsure.
3. **What matters most right now?** Launching; improving a user flow; connecting systems; reducing manual work; diagnosing a problem.
4. **What do you already have?** Requirements/designs; existing code; APIs/data; device access/logs; none yet. Allow multiple answers if the flow supports it.
5. **What help do you need next?** Scope/estimate; design/development; integration; debugging; ongoing support.

This is a proposed content structure, not a replacement scoring algorithm. Validate each answer set, branching path and resulting recommendation before implementation; do not copy new labels onto incompatible old values.

## What to preserve

Concrete lists of services and deliverables; clear CAD pricing/exclusions; the hardware/software connection; Starworld's readable brief notes prompt; its review-before-email language; its save-a-copy alternative; and the playful service-map identity where it helps visitors understand their project.

The copy can be clearer without removing the interactive character. The strongest messages should name the actual work, show an honest deliverable and explain the next action.
