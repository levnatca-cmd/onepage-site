# UI/UX QA evaluation - November 5, 2026

## Verdict

Galaxy is visually distinctive but is not ready to be treated as a reliable project assessment. The main weaknesses are recommendation integrity, progress preservation and the connection between the game and the commercial inquiry. Starworld is the stronger service-selection experience, with reliable brief/export behavior, but still needs accessibility and action-discoverability improvements.

Three P1 findings should be resolved before increasing traffic to Galaxy. No P0 outage or complete loss of the inquiry path was found in the exercised scenarios. This is an evaluation, not a fix release or a conformance certificate.

## Request and team

English translation of the request: **"Assemble a QA team and carry out a comprehensive UI/UX evaluation."**

| Role                                       | Work performed                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Lead QA / visual review                    | Chromium journeys, screenshots, viewport geometry, accessibility scans, downloads, failure recovery, evidence reconciliation |
| Independent UX reviewer (Boyle)            | Galaxy positioning, information architecture, questionnaire recommendations, pricing and inquiry continuity                  |
| Independent accessibility reviewer (Tesla) | Both entries: semantics, keyboard/focus, forms, motion and assistive-input risks                                             |
| Independent frontend reviewer (Harvey)     | State, error recovery, rendering lifecycle, clipboard, settings and brief construction                                       |

Independent reviewers inspected source without changing files. The lead reproduced the consequential findings where possible. The premortem and QA gates are in [the audit plan](../plans/ui-ux-audit-2026-11-05.md).

## Scope and evidence

- Current `index.html` and `src/galaxy/`, cache version `wow49`; current generated `starworld.html` and `src/starworld/`.
- Existing repository, Galaxy and Starworld contract suites passed. Generated Starworld content and local packaging copies matched source; no rebuild or deployment was needed.
- Eight initial viewport runs: both entries at 320, 390, 768 and 1440 CSS pixels; heights 844 or 1000. No horizontal page overflow in those runs.
- Targeted axe WCAG-tagged scans at 390 and 1440 on both initial pages; additional full-rule scans of the Galaxy question screen and the Starworld brief dialog.
- Ten journey/fault runs plus settled-question and Starworld-resilience follow-ups. A completed run means the scenario was exercised, **not** that its observed behavior passed.
- Real Three.js rendering through installed Chrome with software WebGL. Direct framebuffer samples were nonblank on both normal entries; screenshots verify actual objects, not only an HTML shell.
- Initial preview used `http://127.0.0.1:4173`. That pre-existing server stopped during the first journey batch. Those connection failures were discarded as infrastructure failures, then journeys were rerun on an audit-owned server at `http://127.0.0.1:4174`.
- No product source, existing historical review, deployment output or publishing identity was changed. New audit tooling, a package command, this report and the plan were added. Emails were inspected as draft URLs; none were opened or sent.

Raw evidence is under [`artifacts/qa/uiux-2026-11-05/`](../../artifacts/qa/uiux-2026-11-05/). This ignored directory is local evidence and must be retained separately if the audit is committed.

## Heuristic scorecard

These are the lead's evidence-informed design judgments, not measured conversion, user-test scores, reviewer voting or an automated average. Scale: 1 = fundamentally obstructive, 5 = usable with substantial friction, 8 = coherent and polished, 10 = exemplary in the tested scope.

| Dimension                          | Galaxy /10 | Starworld /10 | Assessment                                                                                                                    |
| ---------------------------------- | ---------: | ------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Visual hierarchy and consistency   |          6 |             7 | Galaxy repeats framed panels and telemetry; Starworld has a more consistent scene/list/details composition                    |
| Wow and meaningful interaction     |          5 |             7 | Both render real 3D; Galaxy framing and tiny labels reduce the impact of otherwise recognizable service objects               |
| Service clarity and credibility    |          5 |             7 | Galaxy's generic result and guaranteed 100 score overstate what was assessed; Starworld describes concrete service scope      |
| Task flow and inquiry continuity   |          4 |             6 | Galaxy previews alter results and lose answer context; Starworld builds a coherent brief but buries its add action on mobile  |
| Accessibility and input ergonomics |          5 |             6 | Galaxy result focus and motion controls need work; Starworld has good dialogs but seven visible/accessibility-name mismatches |
| State and failure resilience       |          5 |             8 | Galaxy loses answers on refresh/recovery; Starworld preserves brief/notes and recovers its map, but resets preferences        |

Overall qualitative judgment: **Galaxy approximately 5/10; Starworld approximately 7/10.** Visual sophistication currently exceeds the reliability of Galaxy's product journey.

## Prioritized findings

P1 = fix before promotion/release; P2 = meaningful next-iteration issue; P3 = polish. Evidence labels distinguish browser reproduction, source/data verification and heuristic interpretation.

### G01 - P1: an animation preview rewrites the recommendation and inquiry

**Browser reproduced.** Complete answers `automation`, `businessAutomation`, `manual`, `retry`, `manualOps`. The result is **The Automation Engine**. Click the Hardware debug preview (`data-scenario="manualWorkflow"`). The result becomes **The Hardware Debug Bridge** and the email draft changes, while all five answers and score 100 remain unchanged.

Source: `src/galaxy/js/ui.js:603` (`runScenario` assigns `appState.archetype` and updates result/mail); `src/galaxy/js/ui.js:629` also maps animation of Data/Automation to that hardware scenario.

Impact: a visitor can accidentally send a technically incorrect inquiry by exploring the page. Separate preview state from the answer-derived recommendation. **Acceptance:** after every preview and layer animation, result, badge, export and inquiry must still match unchanged answers.

### G02 - P1: WebGL recovery silently loses the visitor's answers

**Browser reproduced.** Answer Q1 Hardware, request actual context loss and restoration through `WEBGL_lose_context`. The scene recovers, but completion changes from `1 / 5` to `0 / 5`. A normal refresh after all five answers similarly restores the default result and zero checked inputs.

Source: `src/galaxy/js/galaxy.js:307` reloads the document on restoration; `src/galaxy/js/state.js:17` starts with empty answers. No questionnaire hydration exists.

Impact: browser/GPU recovery destroys work. Persist validated answer state in the tab or restore WebGL in place. **Acceptance:** both refresh and context restoration preserve answers, recommendation, scale and progress; explicit reset remains the way to clear the draft.

### G03 - P1: revealing the result leaves keyboard focus off screen

**Browser reproduced.** Complete the 3D hardware path. The result scrolls into view, but focus remains on the final answer control approximately 2,650 CSS pixels above the viewport in the final run. The page also remains in `is-3d-mode` until Exit is activated.

Source: `src/galaxy/js/ui.js:638` (`startCinematicReveal`) scrolls without focusing the result.

Impact: the visible destination and keyboard reading position disagree. End the question state and focus a `tabindex="-1"` result heading after the reveal. **Acceptance:** after completion or Show rescue score, the result heading receives focus and the next Tab reaches a result action.

### G04 - P2: the web/app launch outcome cannot be reached

**Data verified.** Exhaustive enumeration of all 3,125 complete answer combinations using the production scoring and stable tie order produced: handoff 1,057; ghost 330; spreadsheet 610; **bench 0**; hardware 630; ops 498.

Source: `src/galaxy/js/data/quiz-data.js:95` and `src/galaxy/js/ui.js:668`.

Impact: an advertised core service cannot be the final classification. Give explicit project intent appropriate weight and check reachability of every intended outcome. **Acceptance:** at least one documented complete-answer path reaches each intended result, including The Web/App Launch Layer.

### G05 - P2: the stability score measures completion only

**Source/data verified; credibility impact is heuristic.** `getMissionStats()` calculates `min(100, answerCount * 20)`, so every completed questionnaire earns 100 and Legend rank regardless of incidents or project condition. The form calls this System stability.

Source: `index.html:447`; `src/galaxy/js/ui.js:692`.

Use an honest progress label. A completion reward can remain playful, but should not resemble measured system health. **Acceptance:** a complete high-incident answer set is not described as proven stability.

### G06 - P2: the 3D question composition weakens the wow effect

**Visually reproduced after transitions settled.** At 1440 x 1000 the first and last model/label groups extend beyond the viewport. At 390 x 844 several first-row model labels sit under the question panel, while the text answers use a horizontal strip showing only two complete options. Hardware is offscreen in that strip until it is scrolled. The DOM buttons remain usable; this is a framing/discoverability defect, not a total input failure.

Source: fixed spread/scale in `src/galaxy/js/galaxy.js:2962`; mobile answer strip in `src/galaxy/styles/responsive.css:423`.

Evidence: `galaxy-question-settled-1440.png`, `galaxy-question-settled-390.png` and `flows-settled.json`. An earlier immediate-transition screenshot showed temporary overlap and is **not** used as proof of persistent hero-panel obstruction.

Fit the camera/model bounds to a safe area below the HUD. Prefer a compact visible list of all five text options on mobile, or provide a clear scroll affordance. **Acceptance:** all models and labels fit after settling; every answer is discoverable without guessing an overflow gesture.

### G07 - P2: the promised plan and the actual output do not match

**Source verified; expectation impact is heuristic.** The hero promises a build/debug plan after a roughly 60-second mission. The output is predefined archetype prose and generic signals; the tailored map and first implementation slice are part of the CAD 500 working session later on the page.

Source: `index.html:280`, `index.html:699`, `src/galaxy/js/ui.js:861`.

Promise an initial direction and discussion summary, then explain the paid deliverable. **Acceptance:** the visitor can distinguish the free result from the tailored paid plan before starting.

### G08 - P2: inquiry and booking paths lose context and misstate the handoff

**Browser/source verified; conversion impact is heuristic.** The hardware result email includes the archetype summary but not the five actual answers. The contact form sends only the free-text message. Book a working session opens `mailto:` rather than scheduling; Request a quote leads to the same discovery-oriented contact flow.

Source: `src/galaxy/js/ui.js:182`, `src/galaxy/js/ui.js:910`, `index.html:603`, `index.html:771`.

Provide one reviewable project brief containing answers, notes, intent and the agreed price context. Label email actions accurately and differentiate quote inquiries from a paid 90-minute session. **Acceptance:** both entry paths preserve project details and make the next action clear without launching an email client during QA.

### G09 - P2: failed clipboard copying is reported as success

**Browser fault-injection reproduced.** Reject `navigator.clipboard.writeText` and make `document.execCommand('copy')` return false. Copy note still displays **Copied**.

Source: `src/galaxy/js/ui.js:1019`.

Check fallback success and retain selectable text on failure. **Acceptance:** a denied/failed copy never claims success and offers a usable manual-copy route.

### G10 - P2: reduced motion and pausing are incomplete

**Source verified; targeted runtime observation.** Galaxy has no page-level animation pause. The camera still uses pointer offsets in reduced-motion mode. Switching the system preference in the browser correctly changes the media state but leaves five CSS animations running in the targeted run; their user impact requires further motion-specific review.

Source: `src/galaxy/js/galaxy.js:2387`, `src/galaxy/js/galaxy.js:2429`, `src/galaxy/styles/hero.css:56`.

Provide an accessible pause control for both CSS and WebGL; suppress decorative camera movement when motion is reduced. **Acceptance:** after enabling reduced motion, pointer movement does not cause decorative camera translation and Pause stops nonessential movement.

### G11 - P2: Galaxy text does not follow root text enlargement

**Browser reproduced with a root-font diagnostic.** At 320 px, changing the root font from 16 to 32 px leaves Galaxy's H1 at 32 px and its main copy visually unchanged; its nowrap lead also exceeds the text container. Starworld's H1 changes from 26.4 to 52.8 px and reflows without horizontal page overflow.

Source: fixed-pixel typography in `src/galaxy/styles/hud.css:2327` and `src/galaxy/styles/responsive.css:438`.

This is evidence about root text scaling, **not** a claim that every browser zoom mode fails. Use relative text sizing and remove unnecessary nowrap constraints. **Acceptance:** enlarged-text and actual browser-zoom checks both retain readable, unclipped text and actions.

### S01 - P2: seven service buttons have visible/accessibility-name mismatches

**Axe reproduced at 390 and 1440.** `label-content-name-mismatch` reports seven affected service buttons. For example, visible `01 Your product CORE · Plan the product` is replaced by the accessible name `1. Your product, discovery & architecture`.

Source: `src/starworld/app.js:149`.

The service title is still present, so these controls are not wholly unnamed or unusable. However, the full visible wording is not available to speech/assistive input as displayed. Use the visible label as the name and move extra descriptions into `aria-describedby`. **Acceptance:** targeted scans have zero such violations, and visible service names work with speech input in a follow-up device check.

### S02 - P2: selecting a service and adding it to the brief are too far apart

**Geometry reproduced; usability impact is heuristic.** At 390 x 844, Add to brief initially starts at y=1,277 and Review project brief at y=2,036. At 320, these are y=1,430 and y=2,216. Selecting a list service updates the details but does not automatically reveal the add action. The header Project brief control remains available and is a useful alternate route.

Source: `src/starworld/index.html:204`; `src/starworld/styles/layout.css:214`; `src/starworld/app.js:90`.

Place Add alongside each selected service or keep a compact selection/action bar visible on mobile. **Acceptance:** after selecting a service, its add/remove action is visible without an additional search down the page.

### S03 - P2: session settings reset on refresh

**Browser reproduced.** Enable Reduced motion and disable Digital rain, then refresh. Reduced motion returns to false and rain to true. A later system preference change is handled correctly after its event settles. The actual brief remains saved.

Source: `src/starworld/app.js:3`, `src/starworld/app.js:164`, `src/starworld/index.html:338`.

Persist explicit motion/rain preferences in the tab session or describe the current page-lifetime behavior accurately. Keep sound opt-in. **Acceptance:** a tab refresh preserves the user's motion/rain choice, while system-default changes still work when no explicit override is set.

### S04 - P2: membership in the brief is not exposed persistently in the service list

**Source verified.** A service in the brief gets an `in-brief` class and a visual dot; `aria-pressed` denotes the current service selection, not brief membership. Names do not announce inclusion. Add/remove toasts provide event feedback, but revisiting the list does not expose the stored state.

Source: `src/starworld/app.js:204`; `src/starworld/styles/services.css:50`.

Associate an In project brief description with included service buttons. **Acceptance:** assistive-technology users can distinguish selected-for-inspection from included-in-brief without opening another screen.

## Additional risks and lower-priority observations

- **Galaxy contact validation, source/browser confirmed:** empty submission focuses the textarea but leaves `required=false`, no `aria-invalid`, and no persistent associated error. Add a durable inline message; `src/galaxy/js/ui.js:185`.
- **Offscreen rendering, source confirmed; device cost unmeasured:** both scenes continue updating when scrolled offscreen. Starworld handles hidden documents but still renders paused/dialog states on a reduced budget. Profile real hardware before assigning battery, frame-rate or thermal numbers.
- **Starworld render exceptions, reviewer fault probe only:** readiness is declared before a successful frame, and `sceneApi.update()` is outside a protective error boundary. A synthetic render exception can leave a broken scene advertised as available; `src/starworld/app.js:422`.
- **Keyboard shortcuts, source-only AT risk:** Starworld intercepts unmodified letters throughout main/service/rail containers, rather than only the focused canvas. Assistive-input conflicts need VoiceOver/speech testing; `src/starworld/app.js:386`.
- **Galaxy forced-color and live-region risks, source only:** custom selection indicators and multiple simultaneous announcement regions warrant Windows high-contrast and screen-reader checks. Do not count these as reproduced failures.
- **Galaxy question scan, best-practice observations:** full axe scans reported `landmark-unique` and `region`; these were not WCAG-tagged initial-page violations. Give the repeated section landmarks distinct names and review placement of the back-to-top control.
- **Minor telemetry:** one Starworld 320 run logged an unidentified resource 404; it did not recur in the other initial widths or journey page-error logs. No core asset failure or empty scene was established. Do not treat this as a blocking product defect without identifying the request.
- **Long mailto handoff, compatibility risk:** encoded drafts may become long, especially with maximum Unicode notes. The .txt alternative works. Actual client truncation and external-handler launch were not tested.

## What worked

- Both initial layouts rendered without horizontal page overflow at all four tested widths.
- Normal framebuffer sampling verified real nonblank WebGL content. All five Galaxy questions were answerable through DOM controls; start/back/exit and the hardware result path ran without page exceptions.
- Galaxy markdown download completed with a real browser download event. Reset cancellation kept all five answers; accepted reset cleared them. The result draft points to `info@levnat.ca`.
- Starworld selected Applications, iOS & Swift and Security & post-quantum, created a matching draft, and downloaded a real .txt file. Notes containing accents, emoji, ampersands and newlines survived refresh and removing another service.
- Starworld's brief dialog trapped forward/reverse Tab, closed with Escape and restored focus to Project brief. The open dialog had no axe violations in the targeted scan.
- No-WebGL startup retained usable form/brief routes. Starworld disabled four unavailable map actions. Actual Starworld loss/restoration preserved one selected service and produced a nonblank restored scene screenshot; the first direct readback was inconclusive, so a settled screenshot was used instead.
- Live system reduced-motion changes update Starworld after the change event; its explicit settings-reset defect is separate from this working behavior.

## Why the wow effect remains limited

This is a visual/product judgment, not a measured audience response. Galaxy has recognizable web, server, automation, data, hardware and monitoring objects. The surrounding orbit lines, shells, tiny labels and HUD compete for attention. At mobile widths the main service proposition and launch action remain accessible, but most of the 3D scene arrives below the hero copy. In question mode the camera framing cuts the outer objects on desktop and the panel covers some labels on mobile.

A stronger direction is one readable service object per active decision, a visible connection to the visitor's chosen project, and a result worth keeping because it contains the actual brief. Keep the current service metaphor and distinctive palette, reduce decorative telemetry, and make the visitor's choices visibly change a meaningful build/support plan. Adding more glow or more objects alone does not address the observed problems. Virality requires actual sharing/use data and cannot be established by this audit.

## Recommended implementation order

1. Protect recommendation integrity, preserve progress, and align result focus with the visible destination (G01-G03).
2. Repair outcome reachability, score semantics, free/paid expectations and inquiry context (G04-G05, G07-G09).
3. Fit the question scene to real viewport bounds; make all mobile answers and add-to-brief actions discoverable (G06, S02).
4. Resolve accessible names, membership state, text scaling, motion controls and preference persistence (G10-G11, S01, S03-S04).
5. Refine visual hierarchy and measure real leads, completion, abandonment and sharing with an agreed analytics/privacy scope. No tracking was added by this audit.

## Reproduction command

Audit tooling was added as `npm run qa:uiux`. It collects observations and evidence; it is not a release-pass certification. An uncompleted scenario returns a nonzero exit code, while observed product defects remain in the report/JSON for triage.

Dependencies are isolated from the product package:

```sh
npm install --prefix /private/tmp/onepage-uiux-qa-runtime --no-audit --no-fund playwright @axe-core/playwright pngjs
```

Start the existing preview command in one terminal, choosing a free port:

```sh
PORT=4174 npm run dev
```

Run the audit in another:

```sh
QA_BASE_URL=http://127.0.0.1:4174 npm run qa:uiux
```

`QA_CHROME` overrides the installed Chrome executable and `QA_RUNTIME` overrides the isolated dependency directory. `QA_FLOWS_ONLY=1` skips the initial viewport matrix; `QA_FLOW_FILTER=settled` runs only the settled-question follow-up and writes a separate JSON file.

Evidence index: `results.json` (eight initial viewports/scans), `flows.json` (ten journeys/faults), `flows-settled.json` (settled Galaxy question screens), `flows-resilience-followup.json` (Starworld preferences/recovery), `galaxy-result.md`, `starworld-brief.txt`, and the matching PNG files. Downloaded files contain synthetic QA context, not a customer inquiry.

## Explicit verification limits

No physical touch devices, Safari/Firefox compatibility run, VoiceOver/NVDA/speech input session, native email client, production hosting, analytics/conversion experiment or real-user usability study was performed. No Web Vitals, hardware-GPU FPS, battery or thermal score is claimed from software rendering. Root-font enlargement is not equivalent to every browser zoom mode. Selected automated contrast coverage does not certify translucent canvas overlays or all interaction states. Direct picking of every moving 3D model and exhaustive image-collision testing across all camera angles remain deferred.

These limits remain outstanding device/release checks, not completed tests. The new audit does not silently promote the older September review's device and client limits to verified status.
