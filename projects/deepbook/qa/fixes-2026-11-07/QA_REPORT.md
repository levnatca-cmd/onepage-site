# DeepBook Fix Verification

Date: 2026-11-07. Preview: http://127.0.0.1:4180/.

## Result

The nine confirmed issues from `../team-2026-11-07/QA_REPORT.md` are fixed.
No remaining P1/P2 issue was found in the verified scope below. This is not a
cross-browser, screen-reader, backend, or complete WCAG certification.

Two independent reviewers examined the controls and motion changes. Their
additional findings were fixed before the final regression run; historical
findings and their dispositions remain in the linked review reports.

## Fixes And Evidence

| Issue | Repair | Verification |
| --- | --- | --- |
| Mobile menu skipped by keyboard; Escape ineffective | Native button, focus loop, background inert state, Escape and focus restoration | Browser Enter/Space/Escape; 14 consecutive Tab checks remained inside the actual modal boundary; resize restored focus to visible logo |
| Builder ARIA and visual accordion state diverged | One local owner; Webflow dropdown registration removed only from owned roots, original base styling retained | Browser mixed keyboard/mouse/Space/Escape; regression tests load the original Webflow module and positively reproduce the old race |
| Points wallet action unreachable by Tab | Native button with visible keyboard focus | Browser Tab reaches `connectWallet`; no wallet was connected |
| Mobile Explore Docs opened the current page | Existing documentation URL applied to mobile action | Generated markup test and browser href inspection |
| Mobile sliders retained stale desktop widths | Destroy and clean Swiper above 991px; reinitialize on return | Builder and Points 390 -> 1024 -> 390; 256px desktop cards match fresh loads; real Points drag followed by desktop cleanup and mobile reentry |
| Revealed headings retained mobile line splits after resize | Revert old splits/triggers and rebuild unrevealed text at the new width | Builder heading heights match fresh 1024px load; entered headings remain readable without replay |
| Resource/FAQ toggles and Trader filters were click-only | Disclosure keyboard state; native filter buttons and pressed/disabled states | Resource Enter, FAQ Space, tabs ArrowRight; Lending shows 5 visible cards and All restores 13; Predictions disabled |
| Announcement wrapped and cached its old marquee width | Nonwrapping moving label; same-mobile resize remeasurement; inert, hidden-from-AT clones | 547px single-line geometry; one accessible original link; dismissal survives resize |
| 2px tablet document overflow | Allow statistics grid items to shrink with `min-width: 0` | No root clipping workaround; all 42 page/viewport cases have zero horizontal document overflow |

Additional fixes: desktop disabled resource panels ignore descendant Escape;
the menu's declared modal boundary contains its close control and focus loop;
SVG announcement dismissal supports keyboard input; icon-only social links have
names. Points now exposes loading, missing-wallet, connection, network, malformed
data, no-data, and retry feedback without falsely displaying zero or connecting
twice. Those wallet/API paths were tested with mocks, not a live account.

Reduced-motion handling covers Lenis, heading reveals, the announcement, Home's
canvas, and Builder's bars. The static announcement removes its fade masks and
allows its original text to wrap. Source/VM tests verify restoration across
preference changes, resize, and dismissal. Rendered OS preference/large-text
verification is explicitly deferred; the normal-preference browser matrix is
not evidence of that mode's rendered appearance.

## Final Checks

- PASS: 74 Node tests, 0 failed, 0 skipped. See `node-tests.tap`.
- PASS: 7 routes x widths 320, 390, 547, 768, 1024, 1280; viewport height 844.
  Each has one visible H1, initialized controls, loaded fonts, no broken visible
  images, and zero horizontal document overflow. See `browser-results.json`.
- PASS: no warning/error console entries observed through the browser log API
  during the final matrix. This is not an independent uncaught-exception trace.
- PASS: 98 original assets and 107 local file references resolve in the static check.
- PASS: GET and HEAD on all 107 local routes/resources: 214 requests, no failures.
- PASS: two cached mirror generations produce identical content for all 107
  generated page/asset/enhancement files. Timestamped manifest metadata is excluded.
  All 54 cached source files remain unchanged; the source tree also has no git diff.
- PASS: original SVG path sequences and H1 text remain unchanged on all 7 pages.
- PASS: Home canvas is nonblank and changing on desktop and mobile. Pixel regions
  exclude the navigation and announcement; see `verification-summary.json`.

Formatting note: whole-mirror `git diff --check` flags whitespace carried from
the preserved/minified source HTML and vendor scripts, including CRLF lines.
The edited mirror tool, README, and all nine new control/patch/test source files
pass their whitespace checks. Upstream markup was not reformatted to silence
that diagnostic.

## Premortem Closure

| Assumed Failure | Probability | Impact | Detection | Safeguard And Disposition |
| --- | --- | --- | --- | --- |
| Old and new handlers both change state | High | High | Mixed Enter/Space/mouse/Escape and settled ARIA/class/hidden checks | Exclusive disclosure ownership; original Webflow positive-control regression; verified |
| Responsive repairs break original animations/layout | Medium | High | Fresh vs resized geometry, mobile drag, screenshots, canvas pixels | Width-aware lifecycle/cleanup, desktop base-style parity test; verified in tested browser |
| Mirror regeneration erases fixes | High | High | Two rebuilds and output/source hashes | Generation-time patches with strict anchors and idempotence tests; verified |
| Native controls change the original appearance | Medium | High | Mobile/desktop screenshots and original SVG path comparisons | Retain layout classes and phrasing wrappers; no concrete regression found in tested browser; Safari native rendering deferred |
| Mock-only tests miss real DOM/CSS | High | High | Independent review against original markup, CSS, and Webflow module | Added real fade siblings and original-module tests; normal-mode rendering verified; reduced-motion large-text rendering explicitly deferred |

## Limits And Reproduction

Live wallet authorization, claims, balances, transactions, indexer availability,
external destination behavior, Safari, Firefox, and screen-reader operation were
not tested. No financial action was performed. Other inherited decorative
carousels, morphs, Webflow effects, and hover effects are not certified motion-free.
The static snapshot still depends on the original external wallet SDK/backend for
live wallet behavior. Original artwork and branding remain unchanged.

From the workspace root:

```sh
node deepbook/tools/mirror.mjs
npm run qa:deepbook
npm run test:deepbook
```

The dedicated preview server is already running. Browser screenshots at 390 and
1280px are saved beside this report, with additional menu, slider, and canvas
captures. See `review-controls.md` and `review-motion.md` for independent review
methods and historical findings.
