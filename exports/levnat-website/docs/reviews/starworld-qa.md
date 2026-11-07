# UI/UX verification — Systems Engineering

Path migration note (November 5, 2026): Commands and file references below use the current repository hierarchy. The audit dates, results and verification limits remain historical.

Date: September 9, 2026. The standalone `starworld.html` was reviewed: a cyberpunk service map for software development and support. Three independent reviewers examined visual layout, user flows and accessibility. The primary agent implemented the fixes, and the team reviewed them again.

No blocking P0 issues were found in the scenarios tested. The table below lists the resolved issues, including those discovered during the follow-up review.

## Fixes

| Priority | Issue                                                                                                 | Change and verification                                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Scrolling over the scene intercepted page scrolling                                                   | Removed the `wheel` handler; map zoom uses its buttons. In the browser, scrolling over the canvas changed `scrollY` from 0 to 812.                                                                                                                                                 |
| P1       | Object labels overlapped controls, and mobile panels competed for space                               | Moved the heading and hints into separate rows. On narrow screens, the list sits below the scene. Labels are measured, avoid the HUD and one another, and hide when no space is available; all services remain accessible through the list. Geometry and screenshots were checked. |
| P1       | An emoji at the 1,200-character boundary could be split and cause a `URIError` when creating an email | Normalization preserves complete Unicode code points and bounds the field value, storage and export. Tested boundaries at 1198–1200, lone surrogates and actual browser input.                                                                                                     |
| P2       | The map did not recover after WebGL context loss, and inactive controls remained available            | Retained the scene API and handled context restoration. Unavailable buttons and keyboard actions are disabled. Actual context loss and restoration through `WEBGL_lose_context` were tested on a local diagnostic copy.                                                            |
| P2       | Dialogs lacked accessible names, and Shift+Tab in the current browser moved focus to BODY             | Added `aria-labelledby`, explicit Tab/Shift+Tab cycling and focus restoration. Tested both directions, Escape and the settings → guide → original button flow.                                                                                                                     |
| P2       | Single-character commands worked globally, and numeric selection could move focus off screen          | Commands are scoped to the map and service panels; text inputs and open dialogs are excluded. Numeric selection reveals the selected button. Tested from the mobile panel and outside the command area.                                                                            |
| P2       | Enlarged text overflowed navigation, cards, headings and the fallback screen                          | Text sizes use rem, grids respond to text size, and long words wrap. At 320 px with a 32 px root text size, cards use one column. Dialogs and the fallback screen scroll vertically without horizontal overflow.                                                                   |
| P2       | Service selection and notes were lost after a page refresh                                            | The draft is saved in the current tab's `sessionStorage`. An accurate hint appears if storage is unavailable. Browser tests confirmed that selections and multiline notes survive removing another service, closing the dialog and reloading.                                      |
| P2       | Selection announcements were duplicated or appeared outside the active modal                          | One notification region is used outside dialogs, with a separate status inside the brief dialog; stale status is cleared when it opens. The source was reviewed again.                                                                                                             |
| P2       | Changes to the system reduced-motion preference after loading were ignored                            | Added a media-query change handler. The interface toggle was tested in the browser; the system handler was checked in source.                                                                                                                                                      |
| P2       | Entering BFCache permanently aborted registration of the optional WebMCP tools                        | Registration is aborted only on `pagehide` without `persisted`. Source was checked; an actual BFCache return was not reproduced separately.                                                                                                                                        |
| P3       | Controls were small, the field border was weak, and some line breaks were awkward                     | Primary controls are at least 44×44 px, and action buttons are at least 48 px tall. The field border is stronger; the notes counter and storage hint are visible. Button geometry was checked at 320 px.                                                                           |
| P3       | Navigating to a long service panel could scroll past its beginning                                    | Navigation aligns the start of the panel and focuses it. The mobile transition to Support & maintenance was tested.                                                                                                                                                                |
| P3       | The visual pause did not fully match the scene state                                                  | CSS scanning pauses, and the selection angle no longer resets when paused. Pause-button states were tested in the browser; animation consistency was checked in source.                                                                                                            |

## Completed checks

- **13 automated checks**: all 32 service combinations, idempotent add/remove, invalid IDs, Unicode/URI handling, notes boundaries, label placement, unique DOM IDs, inline-script syntax, absence of external resources, bundled Three.js initialization and an actual sphere raycast.
- **Live browser**: widths of 320, 375, 800 and 1280 px, with screenshot and DOM-geometry checks. No horizontal page overflow. At 1280 px, all five visible labels stayed within the scene and did not intersect the HUD or one another; the equivalent visible-label check passed at 320 px.
- **200% text**: a local diagnostic copy with a 32 px root text size at a width of 320 px. Cards, the brief and the fallback screen were checked. This verifies enlarged text, rather than claiming coverage of every browser zoom mode.
- **User flows**: selecting and removing services, notes persistence after reload, correct `mailto` content addressed to `info@levnat.ca`, Tab/Shift+Tab/Escape, focus restoration, sound/motion/rain settings, the guide, rotation, zoom, camera reset and pause.
- **Export**: the generated text-file Blob was captured in the diagnostic copy and exactly matched the email draft body, including Cyrillic characters and `&`.
- **3D failures**: actual WebGL context loss and restoration were checked; startup with the engine unavailable was tested separately. Service selection and adding services to the brief work in both fallback scenarios.
- **WebMCP**: adding, reading and removing a service were tested through the page tools. An invalid ID was rejected without changing state.
- **Selected color contrast**: main text/panel 17.13:1, secondary text/panel 7.85:1, primary-button text 17.84:1 and notes border/field background 5.06:1. These are targeted checks, not full WCAG certification.
- No browser-console errors or warnings appeared in the ordinary page after the final actions.
- All **28 original main-site files** matched their saved SHA-256 hashes. The standalone HTML and both local packaging copies were synchronized. The original tab was updated, test tabs were closed and the preview viewport was reset.

## Verification limits

The in-app browser did not expose a completed-download event, so saving the `.txt` file to disk was not confirmed; file creation and content were verified. The external email client was not opened, and no email was sent. Physical touch devices, VoiceOver/NVDA, system-level reduced-motion changes, actual BFCache transitions and sustained GPU load were not tested. These checks are explicitly deferred; source review does not replace them.

## Reproduction

From the project root:

```sh
node scripts/build-starworld.mjs
node tests/starworld/check.mjs
node scripts/prepare-starworld-qa.mjs
```

The main deliverable is `starworld.html`. The diagnostic generator creates local `artifacts/qa/starworld/runtime.html` and `artifacts/qa/starworld/no-webgl.html` copies with visible QA buttons. These copies are excluded from Git and site packaging. No deployment or external publication was performed.

## Update: iOS / Swift and Security / Post-quantum — November 4, 2026

Added `iOS & Swift` (ID 5) and `Security & post-quantum` (ID 6). Original IDs 0–4 and the draft storage key were preserved. The service count, keyboard range and WebMCP limit are derived from the data. The map represents the new services with three-dimensional phone and shield models; their rotation is bounded to keep their shapes recognizable.

iOS covers Swift/SwiftUI, API integration and TestFlight/App Store preparation. Security covers product protection review, a cryptography inventory, migration planning and supported standards-based pilots. Additional panels explain the deliverables and link to official material. Wording was checked against [Apple SwiftUI](https://developer.apple.com/swiftui/), [Apple: quantum-secure cryptography](https://developer.apple.com/videos/play/wwdc2025/314/) and [NIST PQC standards](https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards).

Verified for this update:

- 14 automated checks: all 128 service sets, original IDs, mixed original/new service briefs, Unicode in the email draft, actual Three.js raycasts for the sphere, phone and shield, nonintersecting node geometry, build integrity and DOM contracts.
- In the browser: selection of iOS and Security through the list, keys 6/7 and direct clicks on the new 3D models. Both services appear in the email draft; the address and notes are correct. Selection and notes survive reload. Test data was removed.
- No horizontal overflow at 320, 375, 1046 or 1280 px. On mobile, the list sits below the scene; checked buttons are at least 44 px. Contextual panels and the long Security title fit within the panel.
- Fixed camera stretching caused by the long Security text, discovered during visual review: the map size no longer depends on the adjacent panel's height. At tablet widths, ordinary services use the panel's full width without an empty second column.
- No errors or warnings in the updated page's browser console. The preview viewport was reset. Result screenshot: `artifacts/screenshots/security-ios-preview.jpg`.
- All 28 original main-site files were preserved; the standalone HTML and both local packaging copies are identical. No external publication was performed.

This verifies the new service presentation and brief flows. It does not verify an actual post-quantum cryptography implementation or a native application; those systems were outside this HTML project's scope. A physical iOS device and a screen reader were not tested for this update.

## Background depth update — November 5, 2026

The former 2D glyph wall has been replaced with a sparse 3D glyph field covering orbit directions around the scene. Its atlas is transparent, so neither a rectangular wall nor square glyph tiles appear behind the service models. Existing Digital rain, reduced motion and pause controls remain connected.

Fifteen Starworld checks now pass, including a new shell/camera/far-plane invariant. Browser checks covered real shader rendering, camera rotation, maximum zoom-out, the 375 px layout, effect visibility and paused service selection. No browser errors or warnings were captured. See `docs/plans/scene-background.md` for the premortem and targeted verification, and `artifacts/screenshots/spatial-glyph-background.jpg` for the result.
