# Independent Controls Review

Date: 2026-11-07. Scope: `local/controls.js`, `local/controls.css`,
`tools/patch-controls.mjs`, and controls-related code in `tools/mirror.mjs`.
Implementation was not edited. No mirror generation or browser automation was run.

## Findings

### P2: Webflow mouseup handler still owns Builder dropdown state

- Locations: `deepbook/local/controls.js:90`, `deepbook/tools/patch-controls.mjs:12`,
  `deepbook/tools/mirror.mjs:138`.
- The patch disables Slater initializers, but keeps Builder's `.w-dropdown` classes
  and Webflow dropdown module. On non-touch desktops that module registers
  `mouseup.w-dropdown`, not `click`. Capturing the later click cannot cancel the
  already queued Webflow debounce callback, and keyboard activation does not update
  Webflow's internal `open` flag.
- Confirmed in a VM using the actual controller and the original Webflow module
  9858 from `webflow.6d3149b8.55acc07a84b6834a.js`: open the second accordion with
  Enter, then send mouseup and click. After queued callbacks run, the local panel
  is `hidden=true`, while `aria-expanded=true`, `w--open=true`, and Webflow
  `open=true`. The original ARIA/visual divergence remains on mixed-input use.
- Give the local controller exclusive ownership of these dropdowns, including
  Webflow mouseup/outside-close/initialization paths; suppressing click alone is
  insufficient. Browser QA should repeat Enter/Space -> pointer click -> Escape.

### P2: Escape can permanently close a disabled desktop resource panel

- Location: `deepbook/local/controls.js:121`.
- Desktop non-tab groups are expanded with disabled, untabbable toggles at
  lines 73-79. The panel-descendant Escape handler does not check `group.enabled`.
  Focus the Lightning Settlement panel's Mysticeti link on desktop and press
  Escape: the panel becomes hidden/inert, but its toggle remains disabled and
  cannot reopen it. It stays closed until a breakpoint change or reload.
- Confirmed in the controller VM: before Escape, disabled=true/expanded=true;
  afterward, disabled=true/expanded=false/hidden=true/inert=true. Clicking the
  toggle does not recover the content. Require an enabled disclosure before
  handling panel Escape, just as the toggle Escape handler already does.

### P2: Menu focus loop crosses its declared modal boundary

- Locations: `deepbook/local/controls.js:143`, `deepbook/local/controls.js:145`,
  `deepbook/local/controls.js:191`.
- `.hamburger-component` is the `aria-modal` dialog, but `#hamb-button` is outside
  that element in generated markup. The trap prepends this external toggle and
  explicitly focuses it when tabbing past the last menu link. Only main/footer
  are made inert, leaving the remaining header outside the modal boundary active.
- Confirmed in the controller VM: Tab from the final link focuses the toggle,
  and `dialog.contains(document.activeElement)` becomes false while
  `aria-modal=true`. This is a modal accessibility-contract defect, not a claim
  that ordinary Tab can escape anywhere on the page. Put the close control inside
  the declared dialog boundary (or expand that boundary consistently) and trap
  only within it. Screen-reader behavior remains for primary QA.

## Expected Refinements Observed

- Primary reports the 42-case browser matrix passes after replacing root overflow
  clipping with `.global_info-grid > .global_info-item { min-width: 0; }`.
  The current stylesheet contains that targeted fix; root clipping is gone.
- Primary observed BODY focus when an open menu closes during 390 -> 1024 resize,
  because the hamburger is hidden. Current `controls.js:177` now selects
  `.navbar-logo` when the toggle has no client rects. A focused VM check passes
  for that fallback. Primary should repeat the browser resize check; this is no
  longer reported as an unfixed source issue.
- No concrete native-button geometry regression was established by this review.
  Retained classes supply explicit sizing/padding, and button children are
  converted to phrasing elements. Pixel geometry is not certified by DOM mocks.

## Checks And Additional Premortem Risks

- PASS: `node --test deepbook/tests/controls.test.mjs`: 10 passed, 0 failed.
  These tests inspect generated markup and patch idempotence, not runtime focus
  or competing Webflow handlers.
- PASS: `node --check deepbook/local/controls.js` and
  `node --check deepbook/tools/patch-controls.mjs`.
- CONFIRMED FAILURES: ad hoc Node ESM/VM checks reproduced all three findings
  against the current controller; dropdown tests evaluated original Webflow code
  with mocked DOM/jQuery/debounce, not a reimplementation of dropdown logic.
- HIGH RISK, medium probability/high impact: dual event ownership. Detect with
  mixed keyboard/mouse activation and settled hidden/inert/ARIA/class assertions;
  prevent by one authoritative disclosure owner. Failed in VM, finding above.
- HIGH RISK, medium probability/high impact: breakpoint/menu focus or inert state
  becomes stale. Check open-menu 390 -> 547 -> 800 -> 1024 -> 390, delayed Webflow
  animations, focus restoration, and restoration of pre-existing inert state.
  Primary browser checks remain responsible for these layout-dependent cases.
- MEDIUM RISK, medium probability/medium impact: DIV/A -> BUTTON conversion changes
  intrinsic geometry or native appearance. Compare hamburger dots, filter buttons,
  and Connect Wallet bounds/padding at mobile/desktop widths; include Safari
  native appearance when available. Independent rendered verification deferred.

The reported browser matrix is primary-provided evidence. This review adds source
and VM evidence only and does not claim a browser or screen-reader reproduction.

## Final Resolution

All three findings above are fixed. Builder's owned roots now use `db-dropdown`
instead of Webflow's registration class, with every original base declaration
retained at zero specificity. Descendant Escape checks the enabled group state.
The modal boundary is the shared navbar containing both the toggle and menu;
its original banner role is restored on close, and all trapped focus remains
inside that boundary. Thirteen permanent runtime tests cover these behaviors,
including the actual original Webflow module and a positive control reproducing
the pre-fix race. The final full suite passed 74 tests. Lead browser verification
also confirmed mixed-input state, disabled desktop Escape, 14 Tab containment
checks, Escape/resize focus restoration, and the 42-case normal-motion matrix.
These resolutions supersede the historical open findings, not the stated
cross-browser and screen-reader verification limits.
