# LEVNAT multi-page design verification

Date: November 6, 2026. Local preview: http://127.0.0.1:4175/.

## Delivered design

Three AI specialists handled UX, UI/art direction and content. The owning agent integrated the shared shell, build, Three.js scene, behavior and final verification. This describes the design collaboration, not the consultant's business team size.

The new site has eight separate static documents: home, services, three service details, Lab, approach and contact. Ordinary links support direct loads, reload, back/forward and service-specific inquiry preselection. Directory URLs without trailing slashes redirect locally while retaining query parameters.

The domain-derived LEVNAT wordmark sits alongside the existing Systems Engineering business identity. A charcoal home hero contrasts with light editorial pages, lime actions, cobalt diagrams and restrained pink experiment accents. Manrope is self-hosted with its OFL license. A generated Lucide subset is about 1.2 KB rather than shipping the complete icon runtime. The site retains plain HTML/CSS/JavaScript and local Three.js, with no framework migration or external runtime font/CDN dependency.

The home object is an original layered browser/app/engineering assembly with three meaningful modes, pointer response and restrained motion. Its framing fits the actual space between HTML copy and controls on mobile and enlarged-text layouts. Pause, reduced motion, offscreen suspension, fallback graphics and context recovery are implemented. Services and contact never require interacting with the canvas.

Lab contains working local queue and workflow demonstrations, explicitly labeled as independent examples with sample data. No clients, case-study outcomes, testimonials, team size or certifications were invented. Existing CAD prices and individual voice remain. Repeated generic footer pitching was removed in favor of page-specific next steps.

The inquiry tool validates input, saves a bounded local draft, restores and clears it, preselects the chosen service once, and produces consistent Unicode-safe email/copy/download content. Preparing a draft reveals a reviewable email link; it does not claim a message was sent. Without JavaScript, the form is hidden and direct email/phone links remain available. Storage/clipboard failure has honest recovery text.

Galaxy is preserved at `/explore.html`; its maintained HTML, assets and questionnaire are retained, with a link back to the new home. Starworld remains at `/starworld.html`, generated from its existing source. The pre-existing deployment identity and unrelated dirty files were not reverted, committed, pushed or published.

## Reference interpretation

Live primary sites were checked during design research: [Bruno Simon](https://bruno-simon.com/), [Brittany Chiang](https://brittanychiang.com/), [Josh Comeau](https://www.joshwcomeau.com/) and [Lee Robinson](https://leerob.com/). The design interprets memorable interaction, clear project organization, thoughtful details and concise voice. It does not copy their work or claim a measured popularity ranking.

## Verification evidence

- `npm run build`: eight pages, small local icon subset, generated Starworld and local packaging copies.
- `npm test`: repository path/language checks; 9 Galaxy scene contracts; 15 Starworld checks; 8 content checks including 3,125 answer combinations; 11 new Studio checks. All passed.
- `npm run test:content:browser`: 8/8 retained Galaxy/Starworld browser cases passed after the route migration.
- `npm run test:studio:browser`: final 32/32 cases passed, including all eight routes at 1440 and 390 px, unique identities, internal navigation, native validation, draft persistence, unavailable storage/clipboard, Unicode handoff and local demos.
- Responsive cases: 320 x 568, 390 x 844, 768 x 1024, 1440 x 1000 and 1920 x 1080. No horizontal overflow or clipped control labels in the checked states. Primary home actions and next-section content remain visible in the initial normal-size viewport.
- Text stress: computed text sizes and line heights doubled at 390 and 1440 px. An additional manual root-font-size check at 390 px had no horizontal overflow. These are stress checks, not WCAG certification.
- Axe scans: no serious or critical violations across the eight new routes at desktop/mobile widths.
- Scene checks: real motion/pixel change, distinct modes, stable render counts while paused/offscreen/reduced-motion, context recovery preserving mode/pause, and useful no-WebGL fallback.
- Raw canvas verification: nine WebGL drawing-buffer PNGs across 1440, 390 and 320 px, each in build/connect/care modes. Nonblank checks do not rely on HTML text overlaid on a screenshot.
- Desktop/mobile viewport screenshots were inspected manually, including the short 320 x 568 viewport. Final route screenshots include the complete internal-page layouts.

Browser evidence: `artifacts/qa/studio-2026-11-05/results.json`, per-route axe JSON and screenshots. Additional viewport evidence: `artifacts/qa/multipage-2026-11-05/`. Retained content evidence: `artifacts/qa/content-update-2026-11-05/`. Folder dates identify the work's starting date; final verification ran on November 6.

## Limits and release notes

- Preview is local, not an external deployment. No real emails, shares or form submissions were sent during QA.
- Browser verification used installed Chromium with software WebGL. Physical-device performance, Safari/Firefox, assistive-technology testing and a formal accessibility audit remain deferred.
- No backend, CRM, account system, analytics or transactional email service was added. Drafts remain on the device until cleared.
- Existing root hash bookmarks are not automatically redirected to Galaxy. Its intentional new entry is `/explore.html`; README and QA entry points have been updated.
- Real client case studies, approved personal biography/portrait and measured business outcomes require owner-supplied material. Current Lab examples remain honest demos.
- Human comprehension, conversion uplift and viral reach were not measured or promised. Existing issues inside the optional legacy explorer are not all resolved by this redesign.

All implementation premortem gates were verified or explicitly deferred in the linked plan. No unobserved production or real-device outcome is claimed.
