# Living System Redesign

Status: complete for local delivery. The saved LEVNAT project was updated and verified; no external publication was requested or performed. Human studies and physical-device/accessibility validation remain explicitly deferred below.

## Creative decision

Implement the reference brief as one original interactive product story. Daybook is an independent booking/workflow prototype, explicitly using local sample data. Visitors build its interface, connect a simulated API, submit a real validated local request, introduce an API/device fault, inspect the event trail and repair/replay pending requests without duplicate delivery. A spatial Three.js system reacts to the same domain state as the usable HTML product. This replaces the generic floating-screen assembly as the main experience.

Ordinary navigation, website/app positioning, services, published CAD prices and contact remain usable independently of the experience. No fabricated client work, biography, success metrics, production integrations or real messages are introduced. Visual direction: a precise, tactile engineering workshop with large authored typography, light/charcoal contrast, cobalt/citrus accents and coral fault states. Not a copy of a reference portfolio or a mandatory game.

## Premortem before implementation

Assume the finished redesign has failed. Probability and impact are planning judgments.

| Failure                                                        | Probability | Impact | Detection                                                                                            | Prevention / release gate                                                                                              |
| -------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| It is another decorative object with shallow controls          | High        | High   | Complete build, submit, queue, fault and repair journey; inspect domain records, not animation alone | Pure tested state machine; one usable DOM product; visible pending/delivered consequences                              |
| Play hides the service and inquiry                             | High        | High   | Initial viewport and keyboard/mobile navigation tasks                                                | Literal website/app headline, ordinary links and ungated contact                                                       |
| The presentation implies real APIs, devices or clients         | Medium      | High   | Copy and request interception review                                                                 | Independent local prototype labels; no external demo requests; honest case-study scope                                 |
| Replaying duplicates or loses requests                         | High        | High   | Exhaustive short action sequences, idempotency, slot validation and replay unit tests                | Unique request keys, bounded queue, immutable transitions and exactly-once terminal delivery                           |
| A shared build leaks names, inquiry text or logs               | Medium      | High   | Adversarial Unicode/private-marker URL and exported-card tests                                       | Public configuration allowlist; synthetic shared sample; no contact or guest fields in artifacts                       |
| 3D blocks controls, clips or stalls on mobile                  | High        | High   | Screenshots, bounding-box checks, actual canvas pixels, touch flows                                  | Responsive art direction, DOM controls outside decorative hit targets, capped DPR and progressive scene loading        |
| Motion and WebGL failures make the site unusable               | High        | High   | Pause, reduced motion, hidden/offscreen, context loss and no-WebGL tests                             | Core demo independent of canvas; explicit pause, frame suspension and recovery without reload                          |
| Existing pages or inquiry drafts regress                       | Medium      | High   | Existing contracts/browser journeys and direct routes                                                | Retain existing core fields, scope preselection and inquiry helper; update tests only for intentional design contracts |
| Preview and saved folder drift                                 | High        | High   | Source/output hashes and standalone export checks                                                    | Build from canonical source, verified export sync and final preview of the saved version                               |
| Automated success is mistaken for creative or commercial proof | Medium      | Medium | Manual review and report wording                                                                     | Inspect actual desktop/mobile output; explicitly defer human recall, physical-device and conversion studies            |

## Implementation sequence and ownership

1. [x] Read the reference brief, current sources, ownership and existing tests.
2. [x] Establish this premortem and a concrete domain/DOM contract before implementation.
3. [x] Main agent: state machine, usable workbench markup/controller, connected Three.js scene and privacy-safe build artifacts.
4. [x] UI specialist: new responsive visual system and experience styling in its own stylesheet.
5. [x] Content specialist: main page, work presentation and honest Daybook case, preserving services/pricing/contact semantics.
6. [x] QA specialist: domain/privacy checks and browser regression coverage for the experience and updated route contracts.
7. [x] Integrate, build, inspect desktop/mobile screenshots and run all required checks; fix observed failures.
8. [x] Synchronize the saved folder, verify its standalone operation, record release limits and show the final preview.

## Technical boundaries

Keep buildless HTML/CSS/JavaScript, local Three.js and generated Lucide icons. No dependency installation, account, backend, analytics or hosting changes are needed. Author page content in `src/studio/pages.js`, shared shell in `scripts/build-studio.mjs`, new experience under `src/studio/lab/`, and replace `src/studio/scene.js`. Retain the legacy explorers. New design CSS lives in `src/studio/living-system.css` after the existing baseline styles until integration is verified.

## Premortem-derived QA gates

- [x] Build and submit before connection produces a genuine pending record; connecting delivers it once.
- [x] API/device fault holds subsequent requests; repair replays each pending record once and repeated repair does not duplicate delivery.
- [x] Invalid names/slots/keys, duplicate slots, malicious values, reset and bounded state behave predictably.
- [x] 3D geometry, connection signals and visible DOM state agree through all transitions.
- [x] Share URLs/cards contain public configuration only and restore a meaningful synthetic state without private fields.
- [x] Header/services/contact remain directly reachable; inquiry validation and draft persistence still work.
- [x] Desktop/mobile/short viewport/enlarged text show no incoherent overlap or horizontal overflow.
- [x] Raw canvas pixels are nonblank, moving and materially different across states; pause/reduced-motion/offscreen stop unnecessary frames.
- [x] No-WebGL and lost-context cases preserve usable local demo state and contact access.
- [x] Static build references, unique metadata, route identities and existing Galaxy/Starworld contracts pass.
- [x] Saved export matches the final authored/build output and serves independently: 117 identical files, preserved reference brief/start guide, and both full browser suites passed on port 4175.
- [x] Human comprehension/recall, physical-device GPU and formal assistive-technology validation are explicitly deferred, not implied by automation.

## Integration findings

The initial browser run exposed changing canvas dimensions between modes, a hidden mobile no-WebGL fallback, an overlong first screen and enlarged-text clipping. Fixed the drawing buffer size independently of product layout, stabilized repeated control dimensions, made the fallback visible, recomposed short viewports and allowed long headings to wrap. Actual module bounds now fit the open desktop area below the offer rather than passing behind the workbench. A final card review caught an API indicator incorrectly dimmed by a device-only fault; public node colors now have a regression assertion.

The completed local build has 62 static/domain checks, 35 Studio browser cases, 11 System Lab browser cases and 8 retained-experience browser cases. Both new browser suites passed again against the saved copy. Evidence and explicit release limits are recorded in `docs/reviews/living-system-verification-2026-11-06.md`. Every premortem-derived gate is verified or explicitly deferred; this does not certify production reliability or human-perceived wow effect.
