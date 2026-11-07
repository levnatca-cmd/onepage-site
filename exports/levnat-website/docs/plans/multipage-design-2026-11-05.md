# Multi-page design implementation

Status: complete. Implementation and premortem gates verified on November 6, 2026; explicit external validation limits are recorded below and in the verification report.

## Design team and direction

Three independent agents cover UX, UI/art direction and content/positioning. The owning agent integrates implementation and QA. This is an AI design team, not a claim about the consultant's business staffing.

Research references, checked on November 5, 2026: [Bruno Simon](https://bruno-simon.com/) (memorable 3D and a separate HTML route), [Brittany Chiang](https://brittanychiang.com/) (clear role and structured project evidence), [Josh Comeau](https://www.joshwcomeau.com/) (interactive details and specific content), [Lee Robinson](https://leerob.com/) (concise personal voice). These are recognizable references, not a measured popularity ranking. Do not copy their identity, content or layouts.

Direction: LEVNAT, the existing domain-derived identity, with Systems Engineering as the business descriptor. Charcoal full-bleed 3D home, off-white editorial content, acid-lime actions, cobalt and pink supporting accents. Literal service headline; no invented clients, projects, performance results, personal credentials or agency size. English public content follows the repository convention.

## Premortem

Assume the redesign has failed after release.

| Failure mode                                                             | Probability | Impact | Detection                                                         | Prevention and QA gate                                                                                                 |
| ------------------------------------------------------------------------ | ----------- | ------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The 3D object hides the business offer or contact action                 | High        | High   | Desktop/mobile screenshots and first viewport bounds              | Headline and CTA stay outside canvas; independently readable HTML; verify 320/390/768/1440 widths                      |
| A multi-page shell is only another anchor-based one-pager                | Medium      | High   | Direct HTTP loads, unique title/H1 and navigation traversal       | Build separate static documents for eight routes; verify refresh and back navigation                                   |
| Existing Galaxy functionality or Starworld build breaks during migration | High        | High   | Existing contract, content and browser regression tests           | Preserve Galaxy as explore.html; update explicit entry ownership and test URLs; leave Starworld source/build unchanged |
| Experiments are mistaken for delivered client projects                   | High        | High   | Visible copy review                                               | Label all examples as local demos/experiments; no fabricated outcomes, logos or testimonials                           |
| Contact silently loses a draft or claims an email was sent               | Medium      | High   | Reload, invalid-submit, Unicode and mailto/download browser tests | Local-only saved draft, native validation, visible draft semantics, manual email and download fallbacks                |
| Animation is expensive, inaccessible or blank                            | High        | High   | Canvas pixel/frame checks, reduced motion, no-WebGL tests         | Capped DPR, render only in view, pause control, static HTML fallback, no mandatory 3D interaction                      |
| Menu, filters or demos are merely decorative                             | Medium      | High   | Keyboard/mobile flow and state assertions                         | Real links, actual filters and bounded usable demos; Escape and focus handling                                         |
| New shared styling causes mobile overflow or low contrast                | High        | High   | Bounding-box checks, screenshots and axe scan                     | Responsive grids and stable controls; contrast and 200% text checks                                                    |
| Build output drifts from shared authored content                         | Medium      | Medium | Deterministic build check and local reference crawler             | Shared source template and generator, authored-source ownership documented                                             |

## Revised implementation plan

1. [x] Inspect the repository, preserve existing work and research live reference sites.
2. [x] Establish team roles, route/content contract and this premortem before implementation.
3. [x] Build shared static shell, navigation/footer, eight real pages and service-detail journeys.
4. [x] Implement original Three.js engineering object with three modes, pause, reduced-motion and fallback behavior.
5. [x] Add honest interactive experiments and local project-inquiry drafting with downloadable brief.
6. [x] Preserve Galaxy at explore.html, update ownership/tests, retain the Starworld build.
7. [x] Run unit/contracts, build determinism, direct routes and complete browser QA; inspect actual desktop/mobile screenshots.
8. [x] Record verified/deferred premortem checks and provide the local preview.

## Route contract

Home `/`; services `/services/`; website/app detail `/services/websites-apps/`; integration detail `/services/integrations/`; debug/support detail `/services/support/`; experiments `/work/`; approach `/approach/`; contact `/contact/`. Legacy interactive entries `/explore.html` and `/starworld.html` remain accessible.

`src/studio/pages.js` owns page-specific HTML/content, `src/studio/styles.css` owns shared visual design, `src/studio/app.js` owns navigation/demos/inquiry behavior, `src/studio/scene.js` owns Three.js, `scripts/build-studio.mjs` owns static output. No external submission, analytics, CRM or backend is implied. Contact opens a user-reviewed email draft.

## Acceptance checklist

- [x] Eight direct routes, unique metadata/H1, working internal links and active navigation.
- [x] First viewport business clarity and visible action; no horizontal overflow at target widths.
- [x] WebGL nonblank and moving; all modes materially change it; pause/reduced-motion/offscreen stop motion.
- [x] No-WebGL fallback retains services and contact access.
- [x] Mobile menu, Escape/focus, keyboard navigation and demo/filter behavior work.
- [x] Contact validation, scope preselection, draft reload/clear, Unicode summary, email and download match.
- [x] No serious/critical automated accessibility violations on new routes.
- [x] Existing repository/Galaxy/Starworld/content checks and selected browser regressions pass.
- [x] Generated output is deterministic and references resolve.
- [x] Honest content review and explicit residual limitations recorded.

## Verification and explicit deferrals

`npm run build`, `npm test`, 32/32 Studio browser checks and 8/8 retained content browser checks passed. Actual WebGL drawing-buffer samples, not only composited HTML screenshots, were checked at three widths in all three modes. First-section hints and first-viewport inquiry actions were verified at normal-size target viewports, including 320 x 568.

Human five-second comprehension studies, measured conversion/virality, physical-device GPU performance, Safari/Firefox and assistive-technology certification are explicitly deferred. The business-clarity gate is a content/layout review, not a claim about measured visitor comprehension. No external publication or real email submission was performed. Old root hash bookmarks are not automatically redirected; the retained explorer has an explicit new URL.

See [verification report](../reviews/multipage-design-verification-2026-11-06.md).
