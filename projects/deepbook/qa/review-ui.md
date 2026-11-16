# Independent UI Fidelity Audit

Reviewed 2026-11-07. Scope: Home, Builder Hub, Trader Hub, DEEP Token, Points, Privacy Policy, Terms of Use. No browser control or product edits. This report is the only file written by this reviewer.

## Verdict

No introduced visual regression is established by the current source comparison. Two inherited resize lifecycle risks are supported by code, but their visible effects still need browser confirmation. Small heading-width excesses are not evidence of clipped text. The lead's current runtime evidence records only a 2px document overflow on Trader Hub and DEEP Token at 768 x 1024; content loss is not demonstrated.

## Findings

### UI-01: P2 - Project carousel survives the desktop breakpoint

- Origin: inherited, not introduced by copying. The inline scripts are unchanged except asset URL localization.
- Evidence: [Builder Hub source:542](../source/pages/builder-hub.html#L542), [Points source:509](../source/pages/points.html#L509). `initFinanceSlider()` returns above 991px without destroying the existing Swiper instance. Its highest breakpoint remains 768 / 2.3 slides per view. The original stylesheet switches `.global-projects_grid` from desktop grid to flex only below 992px ([CSS:3893](../source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css#L3893), CSS:6976).
- Reproduce: load at 390 or 768px, drag the project carousel, then resize to 1024px without navigation. Compare with a fresh 1024px load. Retained slide widths/track transforms can conflict with the restored three-column grid, clipping or misaligning cards inside the section.
- Confirmed source behavior: a read-only VM harness running each original inline script at 390 then 1024 produced one initialization, zero destroys, and an initialized slider at 1024. This is not a rendered-browser reproduction.

### UI-02: P2 - Revealed headings retain stale line groups after resize

- Origin: inherited. The relevant Core script is byte-identical in source and output.
- Evidence: [Core:678](../source/assets/slater.app/19933/59952.js#L678) calls `SplitText.create(el, { type: 'lines' })` once after fonts are ready; it supplies neither `autoSplit` nor a resize/revert handler for these targets. The bundled [SplitText:11](../source/assets/cdn.prod.website-files.com/gsap/3.15.0/SplitText.min.js#L11) defaults `autoSplit` to false and creates block-level line wrappers. Other resize handlers in Core do not rebuild this reveal instance.
- Reproduce: load at 390px, reveal a multiline heading such as Home's "The teams below...", then widen through 547, 768, and 1024px without reloading. Compare line count/section height with a fresh load at the destination width. Old block boundaries can retain unnecessary breaks or rewrap within an old line.
- Scope: `[data-reveal]` targets occur on all seven pages, including legal H1s. Not every short heading will exhibit a visible difference. Home's separate swiper word-splitting code has its own resize handler and is not this finding. Visible impact remains unverified by this reviewer.

### UI-03: P3 - Header banner wraps at 547px; same-mobile resize keeps cached geometry

- Observed local evidence: [home-547.jpg](team-2026-11-07/home-547.jpg) shows several repeated waitlist messages, each wrapping onto two lines. The inspected 320, 390, and 768px hero images do not show this same two-line banner pattern. Hero text/actions remain inside the inspected viewports; the lead also confirmed the 320px actions end at y=517 within 568px.
- Origin: the relevant CSS/JS behavior is present in the saved original; a live original 547px screenshot has not been compared here. Do not classify it as a copy regression yet.
- Evidence: [Core:815](../source/assets/slater.app/19933/59952.js#L815) caches banner width/gap for the repeating translation. [Core:853](../source/assets/slater.app/19933/59952.js#L853) rebuilds only when crossing 768px, not during 320 -> 390 -> 547 resizing. The `.navbar-pencil_link` max-content sizing override is restricted to <=479px ([CSS:8779](../source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css#L8779)), although the marquee runs through 767px.
- Risk: same-mobile resizing can leave a stale repeat distance; the 480-767px wrapping behavior is already visible locally. Inspect a full 10-second cycle against the original before proposing any change.

### UI-04: P3 - 2px tablet overflow is measured, but its cause is not established

- Current evidence: [browser-results.json:675](team-2026-11-07/browser-results.json#L675) and [browser-results.json:705](team-2026-11-07/browser-results.json#L705), Trader Hub and DEEP Token at 768 x 1024. No broken images are recorded; font status is loaded. The lead reports zero document overflow at the other requested widths.
- Origin: undetermined at runtime; no changed layout rule was found in the copy. There is no evidence yet of unreadable content, missing controls, or a clipped glyph. A 2px value alone does not prove benign border rounding either.
- Footer context: the original [CSS:2764](../source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css#L2764) intentionally clips `.footer`; `.footer-logo` is absolutely positioned at the bottom at width 100% (CSS:2774). A cropped decorative footer logo is not by itself a defect. No footer screenshot establishing content loss was supplied to this reviewer.

## Heading Probe: Avoid A False Positive

The reveal code at Core:680-695 applies `transformPerspective: 600`, `yPercent: 100`, `rotateX: -45`, and opacity zero, then animates to the settled state over 0.937s plus 0.08s per additional line. Transformed descendants can enlarge scrollable bounds before being revealed. The saved runtime probe does not record scroll position, transform state, or clipping ancestors.

There is **no mask option or horizontal padding in this shared reveal call**. The word masks in Home's swiper are a different implementation. The inline reveal CSS explicitly disables text-box trimming on the heading and its child divs ([Home source:403](../source/pages/home.html#L403)); the 0.15em padding nearby belongs to the separate `textStagger` hover effect and is vertical.

The probe even flags "Spot" as client=315 / scroll=320 ([results:350](team-2026-11-07/browser-results.json#L350)), despite that short word not filling the container. This supports a wrapper-geometry explanation, not demonstrated glyph clipping. Larger warnings also occur at 768px, so do not blanket-ignore everything below an arbitrary pixel threshold. Scroll the target into view, wait for the complete stagger, and compare actual text ranges with clipping-ancestor bounds and the original before filing a visual defect. No text shrinking, padding changes, or overflow suppression is justified by these numbers alone.

## Current Integrity Checks

Independently recomputed around 21:36-21:40 UTC, not copied from older reports:

| Check | Current result |
| --- | --- |
| Seven source/output pages | All 245 inline SVGs and 37 style blocks byte-identical |
| Parsed page content | Style attributes, classes, IDs, and non-script/style text-node sequences identical on all seven pages |
| 47 source-backed text assets | 43 byte-identical; four exactly match the mirror's expected URL rewrites; no other differences |
| All manifest resources | 98 present/nonempty; manifest has no failed downloads |
| Active server, HTTP only | All seven clean routes return 200 and match disk bytes; all 98 assets return 200 and match disk bytes with appropriate MIME types |

The four rewritten text assets are shared Webflow CSS, `webflow.schunk.d3ccbb73ca719876.js`, `slater.app/19933.js`, and Google Fonts CSS. The remaining 51 binary assets have no separate raw-source copy here: their availability/served bytes were checked, not independently authenticated against the live original. WebFont replacement and the domain/head edits are documented mirror adjustments, not newly discovered visual changes.

The original body-size formula is preserved, including its non-monotonic breakpoints: approximately 13.65 / 16.64 / 15.91 / 14.73 / 11.38px at widths 320 / 390 / 547 / 768 / 1024. Different type scale at these widths is not itself a mirror regression ([Home source:24](../source/pages/home.html#L24)).

## Evidence Limits And Main-Agent Checks

Inspected saved `exact-home-desktop.jpg`, `exact-home-mobile.jpg`, `mobile-menu.png`, and team Home 320/547/768 plus Builder desktop screenshots. Home 547/768 show no obvious hero text/button clipping. Older `exact-comparison.json` reports matching heading/section geometry at 1280 and 390 on all seven pages, but is historical evidence, not a new runtime pass or pixel-diff proof. The current team JSON supplies fresh local metrics at 1280, 320, 390, 768, 1024 across all seven routes; its saved 547px entries currently cover Home and Builder Hub only. The lead's broader 547px summary is noted separately. This reviewer did not generate browser captures, inspect every scrolled section, or compare fresh original/copy frames.

Two consolidated checks remain delegated to the main agent:

1. **Resize lifecycle:** compare fresh versus resized 390 -> 547 -> 768 -> 1024 states on Home and Builder Hub/Points, after reveals settle and after dragging project cards. This addresses UI-01/02 and the cached banner geometry without redesigning inherited behavior.
2. **Header/footer artifacts:** compare the original and local header at 547px over a complete banner cycle. At 768 x 1024 on Trader Hub and DEEP Token, identify the element responsible for the extra 2px after animations settle and inspect footer links plus the decorative logo. If only a border/decorative edge extends and no content is lost, retain UI-04 as P3; do not claim the cause without that check.

Hamburger semantics and accordion keyboard behavior belong to the UX reviewer and are not duplicated here. External wallet/indexer behavior and authenticated Points states were not tested.

## Premortem Safeguards

| Failure mode | Probability / impact | Detection and prevention | Disposition |
| --- | --- | --- | --- |
| Stale evidence produces a false pass | High / High | Recompute current file/HTTP checks; label historical versus current team evidence | Verified for source/serving; visual resize checks explicitly delegated above |
| An original defect is called a mirror regression | Medium / High | Trace each candidate to saved original HTML/CSS/JS before classification | Source-origin checks complete; live-original banner/overflow classification deferred |
| Transformed reveal bounds are mistaken for clipped text | High / Medium | Inspect the actual reveal implementation; require settled glyph/clip evidence | Probe is not accepted as a confirmed clipping defect; settled check delegated |

Review delivered within scope. Full 1:1 runtime acceptance is not asserted, and no inherited design or behavior was modified.
