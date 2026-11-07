# UI/UX improvement plan - November 5, 2026

Status: proposed implementation sequence. Planning is complete; implementation and acceptance checks have not started.

Basis: [the current UI/UX audit](../reviews/ui-ux-audit-2026-11-05.md). Product code remains unchanged by this planning task.

## Intended outcome

Make the offer immediately understandable: website and app development, APIs and integrations, with hardware debugging and ongoing support. Preserve the interactive identity while making the result useful enough to keep and discuss.

Galaxy remains the main consulting entry point. Starworld remains the service exploration and brief-building experience. Both should lead to a clear, reviewable inquiry with the visitor's actual context. This plan does not require merging their codebases or publishing either site.

Success is demonstrated by reliable journeys, readable scenes, accessible controls and useful inquiry content. An increased subjective design score is not an acceptance test, and virality is not assumed.

## Premortem

Assume the improvement has shipped and failed to improve the experience.

| ID  | Likely failure                                                                | Probability | Impact | Detection                                                                                         | Prevention incorporated into the plan                                                                                |
| --- | ----------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1  | Attractive previews still change the submitted recommendation                 | High        | High   | Snapshot answers, recommendation, download and draft before/after every preview                   | Separate preview and project state in phase 1; assert invariant payloads                                             |
| R2  | Refresh or GPU recovery loses or corrupts the draft                           | Medium      | High   | Reload/context-loss tests, invalid stored data, denied storage, explicit reset                    | Version and validate session drafts; preserve state before recovery; show honest storage limitations                 |
| R3  | Simplifying the interface removes the playful identity the owner wants        | Medium      | High   | Compare initial, selected-service and completion screenshots plus a recorded interaction          | Keep a deliberate service reveal and completion moment; judge them separately from decorative density                |
| R4  | The larger 3D object crowds mobile controls or causes unreadable labels       | High        | High   | Screen-space bounds and hit testing at 320/390/768/1440 widths, enlarged text and short landscape | Reserve HUD/action safe areas; fit camera to bounds; keep complete text alternatives                                 |
| R5  | 3D motion increases discomfort, battery use or input delay                    | Medium      | High   | Reduced-motion/pause checks and real-device profiling with scene visible/offscreen                | Pause both animation systems; suppress decorative parallax; suspend offscreen work; retain a non-WebGL route         |
| R6  | The free summary still implies a real technical diagnosis or paid deliverable | High        | High   | Compare hero promises, scoring labels, output content and session pricing                         | Use progress rewards and an initial project direction; disclose tailored paid scope before inquiry                   |
| R7  | The result looks personalized but drops answers or notes during email/export  | Medium      | High   | Compare selected values and notes against preview, saved file and decoded email draft             | Build each inquiry route from one validated project payload; test Unicode and long messages                          |
| R8  | Green QA output hides visual or input regressions                             | High        | High   | Review runtime assertions alongside settled screenshots and keyboard journeys                     | Upgrade critical observations to assertions; retain browser/device limits explicitly                                 |
| R9  | Two interfaces drift in wording, draft semantics and service scope            | Medium      | Medium | A service/CTA/draft field comparison during final review                                          | Agree on service names, inquiry intent and summary fields before copy changes; avoid unnecessary shared abstractions |

The phase order below is revised around these risks: first state and regression protection, then honest service flow, then a bounded visual redesign, followed by cross-experience accessibility/performance hardening and a release review.

## Phase 1 - Make the result and draft reliable

Audit coverage: G01, G02, G03, G04, G09. Risks: R1, R2, R7, R8.

Work:

- Capture behavioral regression cases for preview invariance, saved progress, result focus, classification reachability and failed copying.
- Keep preview/scenario state separate from the answer-derived recommendation. Layer animations must not modify the inquiry.
- Persist validated answers, project notes and scale in the current tab. Handle malformed/old drafts and unavailable storage. Explicit reset clears saved state only after confirmation.
- Prefer context recovery in place when practical; if a reload is retained, hydrate the draft before rendering result state.
- End question mode after completion and focus a programmatically focusable result heading. Preserve back/exit behavior while answering.
- Rebalance classification around explicit project intent; retain deterministic ties and verify every intended outcome is reachable.
- Report clipboard failure accurately and offer selectable text when copying is unavailable.

Primary ownership: `src/galaxy/js/state.js`, `src/galaxy/js/ui.js`, the context lifecycle in `src/galaxy/js/galaxy.js`, question data and behavioral QA. Update existing contracts that currently require reload without checking state preservation.

Acceptance:

- [ ] Every preview leaves answers, recommendation, badge, export and email payload unchanged.
- [ ] Refresh and actual WebGL loss/restoration preserve a complete draft; reset cancellation preserves it and accepted reset clears it.
- [ ] Invalid or unavailable storage does not prevent answering or exporting.
- [ ] Completion focuses the visible result; the next Tab reaches a result action.
- [ ] All 3,125 complete combinations remain valid and every intended archetype has a documented reachable path.
- [ ] Denied Clipboard API and failed legacy copying never display a false success message.

## Phase 2 - Make the service offer and inquiry coherent

Audit coverage: G05, G07, G08, S02. Risks: R6, R7, R9.

Work:

- Give the first viewport a literal service headline such as "Websites & apps" with supporting copy covering APIs, integrations, hardware debug and ongoing care.
- Make the principal path a project inquiry; retain an obvious optional interactive exploration path. Choose CTA wording that describes the actual next action.
- Present the free output as an initial project direction and reviewable summary. Explain the tailored working session and its price/duration before the visitor requests it.
- Rename System stability to Mission progress or Questions completed. Completion can unlock a reward, but must not claim measured technical health.
- Assemble answers, chosen services, recommendation, notes and inquiry intent in one reviewable payload for each experience. Derive its email, copy and download forms from that payload.
- Distinguish project quotation from requesting a paid working session. Explicitly describe email-draft actions; a scheduling service is not required for this phase.
- On Starworld mobile, keep the selected service's add/remove action visible near the selection, with a brief count and a direct review action.

Acceptance:

- [ ] Offer, free summary and paid engagement have distinct, consistent wording.
- [ ] A preview, downloadable brief and decoded email draft contain the same relevant choices and notes.
- [ ] Visitors can request a quote without accidentally implying purchase of a paid session.
- [ ] On mobile, selecting a service exposes its add/remove action without searching farther down the page.
- [ ] Browser QA verifies draft generation without sending an email or opening an external handler.

## Phase 3 - Build a focused visual wow moment

Audit coverage: G06 and the visual scorecard. Risks: R3, R4, R5.

Creative direction: a large, unframed, inspectable product assembly. A recognizable application surface is connected to its API/data components and an optional hardware module. Selecting a service brings its relevant component forward and reveals its connection to the product. Use existing Three.js semantic models where they read clearly.

Work:

- Reduce competing orbit lines, nested shells, telemetry, repeated framing and tiny labels. Give the active component the strongest contrast and stable readable labeling.
- Use one featured object per active decision, with secondary components visible at lower emphasis. The scene and text controls represent the same selection.
- Create three deliberate visual states: initial product, selected-service reveal, completed project map. Keep transitions brief, interruptible and responsive to user input.
- Fit camera and object bounds to the available space below/around the HUD; account for labels and hover enlargement, not only model centers.
- Put hero copy directly in the page composition rather than a decorative floating card. Keep the service offer, primary action and meaningful scene visible together where the viewport permits.
- On mobile, provide a compact scene and all five answer choices through an organized visible layout or an explicit accessible expansion. Avoid relying on an undisclosed horizontal swipe.
- Make the completion artifact a readable project map/brief with chosen services and next steps. Provide a user-initiated share/save action; no fabricated diagnostic score or automatic sharing.
- Bring Starworld's visual priorities into alignment through restrained changes to selection emphasis and action placement, retaining its current working list and brief flow.

Acceptance:

- [ ] Initial, selected and complete states are visibly distinct and describe the actual service/project state.
- [ ] At 320/390/768/1440 widths and a short landscape viewport, models, labels and controls fit their safe regions after transitions settle.
- [ ] Hover, selection, long labels and enlarged text do not introduce overlap or layout shifts.
- [ ] Both scene picking and DOM controls select the same services; every core action remains possible without WebGL.
- [ ] Desktop and mobile screenshots show a nonblank, correctly framed scene; frame/pixel checks verify movement where motion is enabled.
- [ ] Reduced motion offers the same information and outcomes without requiring a cinematic transition.

## Phase 4 - Complete accessibility and runtime hardening

Audit coverage: G10, G11, S01, S03, S04 and the audit's additional risks. Risks: R2, R4, R5, R8.

Work:

- Match accessible service names to visible text. Expose membership in the brief independently of the currently inspected service.
- Use relative typography and wrapping; verify text enlargement and actual browser zoom separately.
- Add persistent, associated contact validation, clear focus indicators and concise status announcements. Review live-region duplication and forced-color selection states.
- Provide Pause/Resume for nonessential CSS and WebGL animation. Reduced motion suppresses decorative parallax and reveal zoom.
- Persist explicit motion/rain preferences for the tab session while retaining sound opt-in and respecting system defaults when no override exists.
- Restrict or disable unmodified character shortcuts outside their intended widget.
- Suspend offscreen rendering and reduce static/paused work. Catch first-frame/later rendering failures and preserve the usable form/list fallback.

Acceptance:

- [ ] Targeted axe scans show no visible/accessibility-name mismatches; keyboard journeys and modal focus remain usable.
- [ ] Included services announce their brief membership, independently of inspection state.
- [ ] Empty contact submission exposes a persistent associated error and clears it after correction.
- [ ] Motion/rain choices survive refresh; live system preference changes work when applicable.
- [ ] Pause stops decorative CSS and WebGL movement; reduced motion suppresses decorative pointer translation.
- [ ] Text enlargement, browser zoom and forced-color checks retain readable content and visible focus/selection.
- [ ] Offscreen/paused scenes avoid continuous unnecessary rendering; a render fault produces a usable fallback without draft loss.
- [ ] Real-device profiling records frame behavior and responsiveness before any performance claim is made.

## Phase 5 - Reassess and prepare the release

Risks: all premortem items, especially R8 and R9.

- Run repository contracts, behavioral regressions and `npm run qa:uiux` against the same candidate build. A completed audit scenario is not automatically a passing assertion.
- Compare settled screenshots with the current evidence and review the initial screen, question selection, final summary and inquiry path as one journey.
- Check Chromium plus available Safari/WebKit and Firefox environments, a real mobile device, keyboard and a screen reader. Record unavailable coverage rather than claiming it passed.
- If representative users can participate, run a small task-based study: identify the offer, choose web/app work, add hardware support, prepare a brief and explain the next step. Record hesitation and errors; do not present a small sample as a measured conversion uplift.
- Write a new post-fix review with finding IDs marked verified, unresolved or explicitly deferred. Publication remains a separate action from local implementation and review.

Release acceptance:

- [ ] G01-G03 are reproduced as fixed, with regression coverage.
- [ ] Every phase's high-risk acceptance checks are verified or explicitly deferred with an impact statement.
- [ ] No unreviewed P1 regression remains in the inquiry/result flow.
- [ ] Draft/download contents match what the interface shows.
- [ ] Desktop/mobile visual evidence is captured after transitions settle; browser/device limitations remain explicit.
- [ ] The final review reports actual findings and coverage without promising a score of 8/10, conversion uplift or virality.

## Execution boundaries

Implement phases as reviewable changes, with phase 1 first. Small accessibility improvements belong in the phase touching their component; phase 4 is the cross-experience closure pass, not a reason to postpone basic accessibility.

Use the current root HTML and `src/galaxy/` ownership. Edit Starworld under `src/starworld/` and regenerate its standalone output through the existing build when those sources change. Preserve unrelated dirty-worktree changes. No new backend, tracking, third-party scheduling or deployment is required by this plan.

Progress update: the [scoped content delivery](../reviews/content-update-verification-2026-11-05.md) completes parts of phases 1 and 2, including preview invariance, honest copy feedback, service wording and summary consistency. It does not complete either phase. The scene redesign and broader accessibility/performance work remain outstanding. Do not mark this improvement plan complete until the acceptance checks above are verified or explicitly deferred in the post-fix review.
