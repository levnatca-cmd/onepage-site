# Independent Motion QA Review

Date: 2026-11-07

## Findings

### MOTION-01 - P2 - Reduced-Motion Mobile CTA Remains Under the Marquee Fade Overlays

Location: `deepbook/tools/patch-motion.mjs:179`.

The reduced-motion branch returns after restoring the original announcement link
to its wrapper, but does not disable the wrapper's two `.mob_fader` siblings.
At phone widths, the shipped stylesheet displays those siblings as foreground,
absolutely positioned, 2em-wide left/right gradient overlays with `z-index: 1`:
`deepbook/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css:9436`
and `:9445`. The wrapper remains overflow-hidden (`:9404`), and
`deepbook/local/controls.css:54` keeps the link nonwrapping at mobile widths.
Neither stylesheet supplies a reduced-motion exception for the fades.

Consequently, the stationary link starts beneath the left fade instead of passing
through an unobscured part of the marquee. Its leading text remains masked, and
the foreground div intercepts pointer input in that part of the link. Any label
overflow caused by larger text also remains clipped indefinitely. Stopping the
marquee is correct; retaining its visual masks is a new static-mode regression,
not a claim that the original animated marquee had no accessibility issues.

Evidence: a read-only Node VM probe reused the worker harness with the actual
generated home nav's parse5-extracted element structure, including both fades.
At reduced-first 390px, and after normal -> reduced -> 320px, it confirmed one
original link directly inside the wrapper, no moving track, and two attached fade
elements without hidden/display overrides. The masking/hit-target conclusion is
from the shipped CSS and DOM stacking, not a browser screenshot or hit test.

Test gap: `deepbook/tests/motion.test.mjs:265` constructs the announcement without
either fade sibling. The reduced-motion test at `:442` checks link count and
animation ownership, so it cannot detect this layout regression.

Recommended correction: disable the fades and allow the complete static label to
fit or wrap in reduced-motion mobile mode; restore animated-mode styling when
the preference changes back. Add the actual fade siblings to the fixture. Manual
follow-up should check the complete label and pointer/keyboard access at 320px
and 390px, including larger text and preference changes.

## Scope and Method

Reviewed `deepbook/tools/patch-motion.mjs`, `deepbook/tests/motion.test.mjs`, and
the motion call sites in `deepbook/tools/mirror.mjs`. Compared relevant immutable
Slater originals, saved Swiper 11 / GSAP 3.15 implementations, generated scripts,
nav markup, and associated CSS. No browser was opened or automated. No mirror
build, external request, wallet operation, or implementation edit was performed.
This report is the only file written by this review.

No additional concrete defect was found in the reviewed Swiper teardown/reentry,
reveal cleanup, or mobile marquee remeasurement paths under these limits.

## Checks and Results

- `node --test deepbook/tests/motion.test.mjs`: 14 passed, 0 failed.
- `node --test deepbook/tests/motion.test.mjs deepbook/tests/controls.test.mjs deepbook/tests/points.test.mjs`:
  53 passed, 0 failed.
- `node --check deepbook/tools/patch-motion.mjs` and
  `node --check deepbook/tools/mirror.mjs`: passed.
- Read-only integration comparison: generated Slater assets 59952, 59953, and
  60445 exactly equal their originals transformed with `patchMotionScript`, then
  `patchInteractionScript`. These originals contain no URL literals requiring an
  additional `rewriteJs` substitution. This agrees with `mirror.mjs:365`.
- Parse5-extracted generated finance-slider inline scripts on Builder Hub and
  Points exactly equal `patchMotionInline` applied to the original inline code.
  This agrees with `mirror.mjs:303` and the source-preserving write at `:370`.
- `git diff --name-only -- deepbook/source`: empty; originals remain unchanged.
- The extra nav-structure probe passed its structural assertions and exposed the
  retained-fade condition in MOTION-01. Its first attempted data-module load
  failed to resolve the bare `parse5` import; resolving that import to its local
  module URL in memory allowed the probe to run. No repository file was changed.

## Premortem and Disposition

| Assumed Review Failure | Probability | Impact | Detection | Safeguard / Result |
| --- | --- | --- | --- | --- |
| Mock-only tests hide real DOM/CSS or library behavior | High | High | Inspect shipped markup/CSS and saved library teardown contracts | Verified Swiper destroy cleanup and SplitText revert behavior; actual nav structure exposed MOTION-01 |
| An inherited issue is mislabeled a patch regression | Medium | High | Compare immutable original control flow | MOTION-01 is tied to the newly introduced static reduced-motion branch; broader inherited motion is not labeled new |
| Unit success is mistaken for mirror integration coverage | Medium | High | Compare generated bytes and inspect build call sites | Three generated assets and two finance inline scripts matched; no rebuild was performed |
| Review causes unrelated worktree changes | Low | High | Restrict all writes and avoid write-producing checks/builds | Only this report was written with apply_patch |

## Remaining Risks

- Browser-only checks are explicitly deferred by the no-browser instruction:
  real Swiper drag/reflow and listener ordering across 991/992px, actual line
  wrapping/visibility during interrupted GSAP reveals and font loads, marquee
  continuity after same-mobile resize, and canvas pixels/performance. VM mocks
  establish ownership/state transitions, not rendered results.
- Reduced-motion coverage here applies to the patched Lenis, heading reveals,
  announcement marquee, Home hero canvas, and Builder bars. Untouched grid/divider
  reveals, continuous carousels, Home illustration morphs, and other Webflow/hover
  effects are not certified motion-free. Several remain unguarded in the original
  code; that is residual inherited scope, not a newly demonstrated regression.
- The generated-output comparisons establish the current artifacts, not an
  independently rerun mirror build. MOTION-01 remains open despite passing tests.

## Fixed Disposition - 2026-11-07

MOTION-01 is **fixed in source and source-and-VM verified**. The original finding,
review results, and pre-fix disposition above are retained as historical evidence;
this section supersedes the earlier open status for the source defect only.

- `deepbook/tools/patch-motion.mjs` now applies local inline styles in reduced-motion
  mobile mode: the original announcement content can shrink horizontally, the
  wrapper/link can wrap and expand vertically, and both foreground fades are
  hidden. The original link, destination, text, and font size are retained.
- Inspection of the immutable nav confirmed that the announcement's container
  chain has no fixed stylesheet height. The repair provides auto height and no
  maximum height along that chain, plus bounded link width, normal whitespace,
  long-token wrapping, and visible wrapper overflow. No CSS edit was needed.
- Each changed inline property's prior value and priority is saved and restored
  through `navCleanups`. Restoration happens before normal marquee measurement.
  The announcement's own display/hidden dismissal state is not reset.
- `deepbook/tests/motion.test.mjs` now includes the real `.pencil-wrapper` hierarchy
  and both `.mob_fader` siblings, with a parse5 comparison against the original
  markup. Tests cover reduced-first 320/390/767px, larger-text style contracts,
  normal -> reduced -> resize -> normal, font/repeated initialization, inline
  value/priority restoration, desktop cycles, and dismissal preservation.
- Red/green verification: the new regression checks failed before the repair and
  passed afterward. Independently run motion suite: **21 passed, 0 failed**;
  combined motion/controls/Points run at that point: **61 passed, 0 failed**.
  The lead subsequently reported the expanded full suite at **74 passed** with
  this patch. Both changed JavaScript files also passed `node --check`.
- Existing strict-anchor and idempotence tests passed. The immutable source tree
  remained unchanged. Implementation edits were limited to the two owned motion
  files; this disposition is the only additional report edit.

Ready for the lead's regeneration/build and final browser42 verification. Those
steps were not run by this worker. Actual large-text wrapping, expanded banner
height, fade removal, and pointer/keyboard access still require the lead's rendered
checks; this disposition does not claim browser verification or regenerated assets.
