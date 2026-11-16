# Snapshot verification

Source: https://deepbook-v2-wip.webflow.io/, the Webflow edition linked by Awwwards.

## Direct original comparison

The exact-source version is served at http://127.0.0.1:4180/ with the original
root-relative page paths. Source HTML uses targeted edits without reserialization.

- All seven pages were compared directly against the live original at 1280 x 720
  and 390 x 844. Section positions, dimensions, background colors, and heading
  typography/dimensions matched in all 14 comparisons.
- All 245 inline SVGs and 37 inline style blocks are byte-identical to the original.
- The saved home source SHA-256 matches a fresh download of the original home page.
- The clean `/builder-hub` link and Margin tab were exercised on the dedicated server.
- `exact-comparison.json` records the reference and local measurements.
- `source-fidelity.json` records per-page SVG/style byte comparisons.
- `exact-home-desktop.jpg` and `exact-home-mobile.jpg` capture the updated copy.

The first mobile Trader Hub measurement occurred during asynchronous widget
initialization. The settled recheck matched the original without CSS changes.

### Exact-copy premortem checks

| Failure mode | Probability | Impact | Detection and prevention | Result |
| --- | --- | --- | --- | --- |
| HTML serialization changes inline SVG or style data | Medium | High | Preserve source spans and compare the original embedded blocks byte for byte | Passed: 245 SVGs and 37 style blocks identical |
| Animation phase is mistaken for a layout difference | High | Medium | Compare measured layout/typography and settle asynchronous widgets; retain the original animation code | Passed: all desktop/mobile measurements match |
| Serving under a subfolder changes original page routing | Medium | High | Dedicated root server preserving clean routes; exercise primary navigation | Passed: `/builder-hub` and its tabs work locally |

## Premortem and safeguards

| Failure mode | Probability | Impact | Detection and prevention | Result |
| --- | --- | --- | --- | --- |
| Missing fonts, images, animation files, or scripts | High | High | Recursively collect resource dependencies; parse every page and CSS resource; check files against the manifest | Passed: 98 resources downloaded, 105 local files verified, no missing references |
| Animation stops on a local domain | Medium | High | Rewrite Slater module imports; compare the rendered homepage; inspect animation frames and Lottie SVGs | Passed: visible, changing canvas pixels on desktop and mobile; Builder Hub Lotties render |
| Navigation opens the original site | Medium | Medium | Rewrite the seven sitemap routes to relative local HTML files; exercise the Build link and tabs | Passed: all seven routes opened locally; Margin and Predict tabs selected successfully |
| Mobile layout or menu breaks | Medium | Medium | Check a 390 x 844 viewport, open/close the menu, inspect product routes | Passed: no horizontal overflow or broken images on Home, Builder Hub, Trader Hub, DEEP Token, Points |
| Existing workspace files are overwritten | Low | High | Keep the snapshot, source copies, tools, and QA in deepbook/ | Passed: all task writes are inside deepbook/ |

## Evidence

- `static-check.json`: Page, resource, stylesheet, module, and Lottie image dependency checks.
- `browser-check.json`: Seven desktop routes, five mobile routes, menu and tab interactions, console checks.
- `canvas-check.json`: Pixel analysis of two animation frames at each viewport.
- `home-desktop.png`, `home-mobile.png`, `mobile-menu.png`: Browser screenshots.
- `canvas-*-first.png`, `canvas-*-second.png`: Matching canvas regions used for motion checks.

The desktop canvas sample had 21,845 non-background pixels and 24,251 changed pixels.
The mobile sample had 2,553 non-background pixels and 4,608 changed pixels.
No browser console errors were observed in the checked local pages.

External documentation, audit PDFs, media kit, waitlist, social destinations, and trading
services are preserved as external links. Their backends are outside the local snapshot
and have not been recreated or transaction-tested. Legal pages were checked on desktop;
separate mobile screenshots for those two text pages were not collected.
