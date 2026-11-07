# Starworld implementation plan

Path migration note (November 5, 2026): File references below use the current repository hierarchy. The implementation history, verification results and deferred checks are preserved.

Build a self-contained HTML game interface in `starworld.html`, preserving the existing dirty website. Use the project's licensed Three.js engine bundled into the HTML, a responsive green-on-black command surface, an orbital 3D star map, system selection, scan/jump actions, and a timed signal collection mission. Support touch and keyboard, sound opt-in, reduced motion and a useful WebGL fallback. No external asset or font requests.

## Premortem (before implementation)

| Failure mode                                              | Probability | Impact | Detection                                                                 | Prevention / QA                                                                                    |
| --------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Existing unfinished website gets overwritten              | Medium      | High   | Compare original file hashes and git diff after work                      | Only add new files; verify old files unchanged                                                     |
| HTML fails when opened directly or offline                | High        | High   | Inspect all resource requests/imports and execute bundled JS syntax check | Inline engine and app, use system fonts; zero runtime imports/fetches                              |
| GPU load makes controls unusable                          | Medium      | High   | Review object counts, frame budget and rendering lifecycle                | Cap pixel ratio and geometry; pause rendering when hidden; reduced-motion option                   |
| Drag selects planets accidentally or touch cannot operate | High        | High   | Check pointer cancellation, drag threshold and keyboard equivalents       | Pointer capture, movement threshold, buttons as equivalent selectors; avoid global scroll blocking |
| Timer continues in background or after replay             | Medium      | High   | Exercise pure mission transitions and monotonic timer                     | Single state machine; pause timer when hidden/paused; reset mission atomically                     |
| Small screens or WebGL failure leave a blank game         | Medium      | High   | Static layout and error-path review                                       | Responsive stacked panels, accessible fallback map and functional mission controls                 |
| Scan/jump actions look active but do nothing              | Medium      | High   | Exercise state transitions for idle, running, complete and failed         | Every control has a visible effect; disable actions where inapplicable                             |

## Implementation and verification

1. Author first usable HTML surface, bundled engine and interactive 3D map.
2. Open local preview after syntax and HTTP checks.
3. Complete mission, keyboard/touch, preferences and fallback paths.
4. Verify resource independence, JS syntax, state transitions, DOM contracts, responsive/reduced-motion rules, and preservation of existing files.
5. Deliver the standalone HTML and working preview. Browser visual QA is deferred because it has not been requested (Sites skill restriction).

## Verification results

- PASS: standalone `starworld.html` built with two syntactically valid inline scripts and no external asset dependencies.
- PASS: ten automated checks, including all four relay configurations, scan-before-recovery, duplicate prevention, pause at expiry, restart resets and terminal states.
- PASS: bundled Three.js r164 initializes and performs real sphere raycasting under Node.
- PASS: all direct DOM references resolve to unique HTML IDs; responsive, keyboard, gesture-cancellation, context-loss, fallback and reduced-motion paths checked in source.
- PASS: all original website files match their pre-implementation SHA-256 hashes.
- PASS: local HTTP preview returns 200 and was opened in Codex.
- PASS: publishing source and static output exactly match the standalone HTML; archive prepared.
- DEFERRED: browser visual/hardware WebGL, touch-device and screen-reader interaction QA, because the Sites skill prohibits browser QA unless the user requests it. Source contract checks are not a claim of real-device verification.
- DEFERRED: optional WebMCP tools are feature-detected; supported browser context was unavailable for contract validation. They are not required for ordinary gameplay.
- BLOCKED PENDING APPROVAL: private Sites upload was rejected by automatic approval review because the user requested creation, not external publication. No source push or deployment completed. Site registration exists privately; resume only on explicit user authorization.

Implementation and automated checks complete. The requested standalone HTML and local preview are ready. Optional private publishing awaits authorization.

## Cyberpunk style update — premortem before editing

Direction: preserve the 3D game and its controls while adding violet-black surfaces, cyan and magenta lighting, acid-yellow primary actions, angular panel edges and restrained glitch accents. Update the HTML/CSS and the existing scene materials together. Rebuild the standalone HTML and refresh its existing preview. No publishing is authorized by this style request.

| Assumed failure                                    | Probability | Impact | Detection                                                                                | Safeguard / QA                                                                                            |
| -------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Neon effects obscure text or selected state        | Medium      | High   | Calculate key text/background contrast; inspect semantic selected/focus styles in source | Keep body text neutral and opaque; confine glow to ornaments/headings; preserve visible focus outline     |
| HUD changes but 3D scene still looks green         | High        | Medium | Check both CSS tokens and Three.js materials                                             | Coordinate planet, orbit, grid, rain and shader colors with HUD                                           |
| Glitch effects reduce comfort or performance       | Medium      | High   | Check animation duration, reduced-motion and geometry count                              | No flashing; one short entrance glitch only; use existing geometry and CSS; preserve reduced-motion rules |
| Rebuild loses gameplay or changes original website | Low         | High   | Existing checks plus original file hashes                                                | Keep mission transitions and bindings unchanged; regenerate the artifact through existing builder         |

QA complete: standalone build and all ten existing checks pass; body/secondary/accent/primary-button contrast exceeds 4.5:1; the mission reducer and GPU geometry count are unchanged; all 28 original website files are preserved. Short entrance animation respects reduced motion. Local publishing copies were refreshed without upload. Existing local preview returned HTTP 200. Automatic tab refresh was unavailable because macOS was locked; the user can refresh the existing tab after unlocking. Browser/device visual checks remain explicitly deferred under the Sites skill restriction. The earlier publishing archive is stale and must be rebuilt if publishing is later authorized.

## Software development and support — premortem before editing

User clarified the business: software development and support. Reframe the cyberpunk 3D interface as an explorable service map with a central product and four service nodes. Replace the fictional mission and telemetry with service descriptions, example deliverables and a project brief. The contact action opens a reviewable email draft to `info@levnat.ca`, verified in the existing website. Keep all changes in the standalone interface; no publication or email sending.

| Assumed failure                                                    | Probability | Impact | Detection                                                                          | Prevention / QA                                                                                        |
| ------------------------------------------------------------------ | ----------- | ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Visitors still mistake the interface for a game or live monitoring | High        | High   | Search visible copy for fictional systems, XP, countdowns, fake metrics and uptime | Remove gameplay state and metrics; explicit software/support offer and service labels                  |
| Selecting a service changes unrelated brief entries or loses notes | Medium      | High   | Exercise add/remove, invalid ids and summary generation                            | One validated set of selected service IDs; notes retained in the dialog; review before contact         |
| Email draft omits scope or sends unexpectedly                      | Medium      | High   | Decode generated mailto for special characters, all selected services and notes    | Pure brief builder, URI-encoded draft, explicit 'Open email draft'; never send through tools           |
| New content exceeds mobile layout or breaks map controls           | Medium      | High   | ID/syntax contracts and responsive rules; keep existing camera code                | Short map labels, wrapping service lists, no new external assets; retain keyboard/touch/fallback paths |
| Claims invent support guarantees or turnaround times               | Medium      | High   | Review copy against known business scope                                           | Only concrete example activities; no SLA, pricing, certifications or invented outcomes                 |

Implementation: service data and brief state, semantic HTML rewrite, retain cyberpunk scene, update focused checks, build and verify local response. Browser visual/device QA remains deferred under the Sites skill restriction. Optional WebMCP runtime validation remains deferred if a supported context is unavailable.

Business adaptation verification: COMPLETE.

- Standalone HTML rebuilt with no external runtime dependencies.
- Eleven checks pass: all 32 scope combinations, idempotent add/remove, invalid IDs, blank brief, bounded notes, Unicode/URI email encoding, removal of game content and fake telemetry, JS/DOM contracts, real Three.js raycasting and existing accessibility/fallback paths.
- Each model represents a named software capability; four relationship lines connect services to the product.
- Email destination is verified against the existing website. The action creates a draft only; a downloadable text brief supports users without a configured email app.
- Narrow-screen header wraps to prevent navigation overflow; service labels and brief content wrap. Browser visual/device verification is explicitly deferred.
- All 28 original website files remain byte-for-byte unchanged. Local publishing copies are refreshed; no upload, publication or email sending was attempted. Prior publishing archive remains stale.
- Optional WebMCP tools now use service/brief semantics; supported-context runtime validation remains deferred.

## Team UI/UX verification — 2026-09-09 premortem

The user explicitly requested browser UI/UX verification, a team audit, and fixes for critical and minor issues. Three independent reviewers cover visual/responsive behavior, user flows, and accessibility/runtime; root verifies in the existing browser tab and implements fixes.

| Failure mode after audit                                           | Probability | Impact | Detection                                                                       | Safeguard / QA                                                                            |
| ------------------------------------------------------------------ | ----------- | ------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tests target the old, stale page rather than current source        | High        | High   | Compare visible title/controls after reload                                     | Restart local preview, reload same tab and confirm service-map version                    |
| The canvas traps page scrolling or hides labels under controls     | High        | High   | Mouse-wheel test and screenshot/geometry checks at desktop and narrow viewports | Preserve normal wheel scrolling; measure labels against HUD and viewport                  |
| Accessibility changes break focus, dialogs or existing shortcuts   | Medium      | High   | Keyboard flow, accessible dialog names and focus return checks                  | Native dialogs with names, focus-scoped or optional shortcuts, explicit focus restoration |
| Draft is lost during review, reload or an email error              | Medium      | High   | Round-trip selection/notes and exported draft checks                            | Preserve locally within this tab when possible; never automatically transmit              |
| WebGL context loss or reduced-motion changes break scene lifecycle | Medium      | High   | Review lifecycle and targeted regression checks                                 | Recover the same scene API after restoration; listen for motion preferences               |
| Fixes overwrite the unrelated existing website or upload it        | Low         | High   | Baseline hashes and exact changed-file review                                   | Only edit the standalone interface and local QA artifacts; no publishing/email sending    |

Before implementation: reproduce source-evident issues where browser capabilities permit, classify severity, then apply bounded fixes. Verify project brief flow, typography/contrast, responsive layout, keyboard dialogs, normal scrolling, reduced motion and rebuilt standalone artifact. Document any browser capability limits instead of claiming unperformed tests.

### Team verification outcomes

Completed the three-reviewer audit, implementation, source re-review and live browser verification. The detailed findings and evidence are in `docs/reviews/starworld-qa.md`.

Premortem checklist:

- VERIFIED: the current business/service-map build was loaded; the original preview tab now shows the updated artifact.
- VERIFIED: ordinary canvas-wheel scrolling, responsive layout at 320/375/800/1280 px, visible label bounds/HUD avoidance, 44 px controls and 200% text reflow. QA-only diagnostic copies tested enlarged fallback content without changing production settings.
- VERIFIED: dialog names, Tab/Shift+Tab cycle, Escape, opener restoration including settings → help, focus-scoped shortcuts and visible numeric-selection focus.
- VERIFIED: selection and multi-line notes survive removal, close/reopen and reload; malformed/boundary Unicode cannot break the draft. Mailto and generated text-export content match. Completed disk download and external mail-client handoff are explicitly DEFERRED because no download event was exposed and the mail client was not opened.
- VERIFIED: real WebGL context loss/restoration using the browser extension on a local diagnostic copy; initial no-engine fallback; disabled camera controls and still-functional service selection/brief. Reduced-motion UI is verified; actual OS media-query changes, BFCache return and long-duration GPU performance are explicitly DEFERRED. Corresponding lifecycle code was independently reviewed.
- VERIFIED: 13 automated checks pass. WebMCP valid/invalid input and read-back pass in the supported browser context.
- VERIFIED: all 28 unrelated original files match the audit baseline. Main standalone HTML and both local packaging copies match. No external upload, publication or email sending took place. Temporary QA tabs are closed and viewport override is reset.
- DEFERRED: physical touch-device and screen-reader sessions; DOM/keyboard checks do not claim those real-device results.

Audit and requested local fixes are complete; the explicitly deferred environment-specific checks are recorded rather than reported as passed.

## iOS / Swift and Security / Post-quantum — 2026-11-04 premortem

Extend the existing local service-map HTML with two services, appending IDs 5 and 6 so saved drafts remain meaningful. Use distinct phone/shield models, short map labels, concrete scopes and contextual technology details. Security covers product protection plus post-quantum readiness, inventory, migration planning and supported pilots. Technical language is checked against primary NIST and Apple sources. Existing local-only publication boundary remains in effect.

| Assumed failure                                                        | Probability | Impact | Detection                                                                                    | Prevention / QA                                                                                                  |
| ---------------------------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| New services are unreachable through keyboard, tools or briefs         | High        | High   | Exercise IDs 5/6, schema limits, counts and all 128 selections                               | Derive runtime limits/counts from service data; update instructions and regression coverage                      |
| Saved service choices point to different work                          | Medium      | High   | Verify original codes/order and mixed old/new selections                                     | Append nodes; retain session key and IDs 0–4                                                                     |
| Seven entries crowd the scene or cause horizontal overflow             | High        | High   | Desktop/narrow layout and label bounds checks where browser tools permit                     | Short map labels, move list below scene at wider breakpoint, retain collision handling                           |
| Security language implies absolute protection or current certification | Medium      | High   | Review copy against NIST/Apple primary sources                                               | Describe concrete review/migration/pilot work; no invented compliance, guarantees or unsupported platform claims |
| Phone/shield rendering or picking breaks sphere assumptions            | Medium      | High   | Parse bundled scripts, raycast both new geometries and inspect source/preview when available | Keep actual pickable mesh per node; use supported Three primitives and preserve selection API                    |
| Changes overwrite the main website or accidentally publish             | Low         | High   | Existing 28-file baseline plus artifact/package equality                                     | Edit only standalone sources, build output and local packaging; no upload                                        |

Implementation: extend service data and meaningful models, update dynamic limits and contextual panel, adapt seven-service layout, rebuild and run focused regression checks; refresh local preview if supported. Record browser capability limits accurately.

### iOS / Security extension verification

COMPLETE: appended two services with stable original IDs, dynamic counts/keyboard/WebMCP limits, contextual descriptions and references, real extruded phone/shield geometry, separate desktop scene/list regions and a wider stacked-layout breakpoint. Phone/shield motion is bounded to preserve recognisability.

Premortem-derived checks verified: all 128 selections and mixed old/new Unicode briefs; original IDs/storage key; direct browser click on both models, numeric shortcuts 6/7, selected details, email content and reload persistence; 320/375/1046/1280 layouts without horizontal overflow; 44 px mobile controls; reviewed standards terminology with Apple/NIST primary sources. Live review caught and fixed scene stretching from the long security panel and empty tablet columns. Fourteen automated checks pass; no browser errors/warnings were captured. All 28 original website files and local-only publication boundary are preserved; packaging copies match. Screenshot saved and viewport override reset. Physical-device/screen-reader checks remain explicitly deferred. Updated report: docs/reviews/starworld-qa.md.
