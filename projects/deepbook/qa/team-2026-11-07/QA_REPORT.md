# DeepBook Team QA

Date: 2026-11-07. Local target: http://127.0.0.1:4180/.
Reference: https://deepbook-v2-wip.webflow.io/.

## Verdict

**Snapshot integrity and the exercised mouse workflows pass. UX acceptance does not pass.**

Three independent reviewers audited UI fidelity, UX/accessibility, and functional/resource
reliability. The lead performed live Chromium browser checks and original/local comparisons.
No introduced clone defect was confirmed. The verified interaction and resize defects below
are inherited from the original. Product HTML, CSS, JavaScript, and server code were not
changed during this QA run, preserving the requested copy.

## Prioritized Findings

| ID | Priority | Finding | Evidence and Scope |
| --- | --- | --- | --- |
| QA-01 | P1 | Mobile menu is unreachable with Tab; Escape does not close it | At 320 x 568, `#hamb-button` is a DIV without role, name, or tabindex. Tab from header Docs reaches Start Building. After mouse-open, Escape leaves `body.menu-open=true`. Inherited shared header on all seven pages. |
| QA-02 | P1 | Builder accordion visual and ARIA states diverge under keyboard control | Enter on Margin / How it works sets expanded=true while height remains 0. Original mouse-open followed by Escape leaves height 75.9px and `dd-active`, despite expanded=false. A fresh local mouse-only interaction opens correctly to 75.9px. Inherited, not a missing animation dependency. |
| QA-03 | P1 | Connect Wallet is not keyboard reachable | The visible Points action is `a#connectWallet` with no href, role, or tabindex, and a click-only listener. Rendered DOM and saved-source parity verified; no wallet account was connected. |
| QA-04 | P2 | Mobile Explore Docs targets the current Builder page | At 390px the visible `.bh-hero_mob-desc a` has href empty and target=_blank, width 137.6px / height 50.7px. Its destination resolves to Builder Hub rather than the documentation. Desktop Docs is valid. Inherited responsive duplicate. |
| QA-05 | P2 | Project cards do not recover desktop sizing after mobile initialization | Builder loaded at 390px and resized to 1024px retains `swiper-initialized` and 341.6px inline card widths. A fresh 1024px load has no Swiper class and 256px cards. The resized third card extends past the intended grid. Original inline slider code has the same missing destroy path. |
| QA-06 | P2 | Revealed headings retain stale line breaks after resize | At 1024px, Why builders choose DeepBook retains 3 lines / 113px after a 390px load, versus 2 lines / 75px on fresh load. Everything you need to start building retains 3 lines / 145px versus 2 / 97px. Original SplitText initialization lacks a corresponding rebuild. |
| QA-07 | P2 | Additional filter/disclosure controls have no native keyboard activation | Trader category filters and Points FAQ triggers are DIVs without role/tabindex. Mouse Lending filtering and Points FAQ opening work. Keyboard reachability and source click-only handlers support the accessibility defect; not every individual disclosure was traversed. |
| QA-08 | P3 | Waitlist banner wraps at intermediate mobile width | Fresh original and local 547px loads both render four approximately 115px links with 23.875px two-line height and identical nav position. This is original behavior, not a clone regression. A complete marquee-cycle timing comparison was not performed. |
| QA-09 | P3 / watch | 2px document overflow at 768px on Trader Hub and DEEP Token | Captured in the responsive sweep. Trader top-level sections are all exactly 768px wide; no heading/control clipping or missing content was established. The precise deeper descendant causing the overflow remains unclassified. |

P1 denotes a primary workflow blocked for affected users, especially keyboard users.
P2 denotes a substantive defect with an alternative path or a narrower trigger.
P3 is a lower-impact visual issue or an observation needing further classification.

## Source Evidence

- QA-01: shared header in `deepbook/index.html:466`, click handler at `:654`;
  original counterpart in `deepbook/source/pages/home.html`.
- QA-02: `deepbook/assets/slater.app/19933/59952.js:644`;
  Builder inline disclosure CSS in `deepbook/builder-hub/index.html:17`.
- QA-03: `deepbook/points/index.html:477` and click binding at `:575`.
- QA-04: `deepbook/builder-hub/index.html:496`, mobile description CTA.
- QA-05: `deepbook/source/pages/builder-hub.html:542` and
  `deepbook/source/pages/points.html:509`, `initFinanceSlider()`.
- QA-06: `deepbook/assets/slater.app/19933/59952.js:678`.
- QA-07: Trader live filter row at `deepbook/trader-hub/index.html:863`, handler
  at `:993`; Points FAQ and `deepbook/assets/slater.app/19933/60565.js:47`.

The independent source reports provide expanded references and targeted reproductions:
[UI review](../review-ui.md), [UX review](../review-ux.md),
[Functional review](../review-functional.md).

## Checks That Passed

- Seven routes at 1280 x 720: titles, readable H1s, loaded fonts/images, no measured
  document overflow, and no observed browser console errors.
- Thirty additional page/viewport cases: all seven routes at widths 320, 390, 768,
  and 1024; Home and Builder additionally at 547. Total: **37 cases / six widths**.
- Home actions fit the small 320 x 568 screen: bottom at approximately y=517.
- Main Build navigation, local clean URLs, Builder ArrowRight tab focus/selection,
  fresh mouse accordion opening, and Escape updating Webflow's ARIA state were exercised.
  The ARIA/visual mismatch is correctly retained as a failure above.
- Trader Lending filter produces five visible cards; All restores thirteen.
- Points Why does this program exist disclosure opens with mouse to 98px height.
- Current resource audit: 98 resources and 105 local referenced files, no missing files.
- Functional reviewer: 300 GET/HEAD requests, 716 resource resolutions, 26 JavaScript
  syntax checks, MIME/body/hash checks, and safe handling of missing/traversal paths.
- UI reviewer: all 245 inline SVGs and 37 style blocks are byte-identical; page
  content/classes/styles/IDs match the saved source; 43 of 47 text assets are identical
  and four contain only expected URL rewrites.
- Current pixel analysis verifies nonblank moving hero backgrounds on desktop and
  mobile. Fixed header/marquee rows were excluded from the analyzed regions.

## Triage Corrections

The initial accordion observation appeared to be a clone regression. Controlled
fresh-state comparison showed that keyboard interaction desynchronizes the original
too. No repair was applied on the basis of the preliminary attribution.

Empty/# links in hidden prototype/duplicate footer and Trader markup are not counted
as user-facing dead links. The visible mobile Builder Docs action is the confirmed
exception. The disabled Predictions category displays SOON and is not treated as a
working filter that failed to update.

Small `scrollWidth` excesses on unrevealed headings are not counted as clipped text.
The source uses transformed reveal descendants, and the probe alone cannot establish
lost glyphs. Resize comparisons above use actual line-group and layout changes.

## Additional Source Risks and Limits

The UX review also documents focus-outline suppression, unnamed mobile social links,
unguarded JavaScript motion under reduced-motion preference, and Points error handling
that can leave a false zero balance with hidden recovery feedback. These source findings
are not presented as completed browser/screen-reader/API reproductions.

Wallet authorization, wallet/indexer success or failure, real accounts, trading,
transaction submission, external-service availability, Safari/Firefox, physical touch
devices, and a screen-reader session were not exercised. The Points wallet module
retains a remote ESM import, so offline wallet functionality is not certified.

Complete marquee-cycle timing, the 2px overflow descendant, and a settled glyph-by-glyph
clip audit remain explicitly deferred. No content loss is claimed from those observations.

## Evidence Files

- `browser-results.json`: fresh page metrics, interactions, original/local banner
  measurements, and fresh-versus-resized heading/card data.
- `canvas-results.json` and `canvas-*.png`: analyzed background regions and motion counts.
- `home-desktop.jpg`, `home-320.jpg`, `home-390.jpg`, `home-547.jpg`, `home-768.jpg`,
  `home-1024.jpg`: viewport captures.
- `builder-keyboard-accordion.jpg`, `reference-accordion.jpg`: disclosure observations.
- `builder-after-mobile-desktop-resize.jpg`: stale desktop card widths and clipped row.
- `mobile-menu-after-escape.jpg`: open mobile menu after Escape.
- `trader-lending-filter.jpg`, `points-faq.jpg`: exercised pointer workflows.
- `original-home-547.jpg`, `local-home-547.jpg`: original/local intermediate banner.

## Premortem-Derived Completion Checks

- [x] Fresh live evidence replaced reliance on historical screenshots.
- [x] One lead controlled browsers; reviewers used disjoint report write scopes.
- [x] Original and clone attribution was checked and the preliminary error corrected.
- [x] Coverage included all seven routes, keyboard interactions, six widths, and resize.
- [x] Missing assets, runtime code, MIME, clean routes, and dynamic imports were audited.
- [x] High-impact accessibility and resize candidates were verified or source-qualified.
- [x] External/account/device and remaining low-impact checks were explicitly deferred.
- [x] Temporary QA tabs were closed and the browser viewport override was reset.

Recommended remediation order: mobile menu semantics/focus/Escape, unified accordion
state, keyboard-reachable wallet/filter/FAQ actions, mobile Docs URL, then Swiper and
SplitText resize lifecycle. These can be implemented as a separate remediation pass
while preserving the original visual design.
