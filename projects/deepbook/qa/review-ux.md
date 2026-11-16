# DeepBook UX and Accessibility Source Review

## Scope and Attribution

Independent source audit of the seven local pages, saved original HTML, shared CSS,
Slater scripts, and relevant Webflow runtime modules. No browser was opened or
controlled, and no product file was changed by this audit. Runtime observations
below are explicitly credited to the runtime lead, not independently reproduced.

P1 = a primary workflow is blocked for affected users. P2 = a substantial usability
or accessibility defect with an alternative path or narrower scope.

| Local Page | Saved Original | Shared Navigation Markup Line |
| --- | --- | --- |
| `deepbook/index.html` | `deepbook/source/pages/home.html` | 466 |
| `deepbook/builder-hub/index.html` | `deepbook/source/pages/builder-hub.html` | 496 |
| `deepbook/trader-hub/index.html` | `deepbook/source/pages/trader-hub.html` | 488 |
| `deepbook/deep-token/index.html` | `deepbook/source/pages/deep-token.html` | 446 |
| `deepbook/points/index.html` | `deepbook/source/pages/points.html` | 477 |
| `deepbook/privacy-policy/index.html` | `deepbook/source/pages/privacy-policy.html` | 446 |
| `deepbook/terms-of-use/index.html` | `deepbook/source/pages/terms-of-use.html` | 446 |

The body-tree comparison found no semantic differences on all seven page pairs
after normalizing intended internal URL rewrites and excluding scripts, styles,
and asset attributes. Findings below were also checked against their saved source
counterparts. All listed defects are inherited from the original snapshot; no
mirror-introduced UX defect is established by this audit. This is not proof of
runtime equivalence or a recommendation to change a fidelity snapshot silently.

For shared asset references, `source/assets/` contains the original counterpart
of `assets/` at the same path and line. The inspected Core, Points, Builder
animation, and Webflow tabs/dropdown scripts are byte-identical to those originals.

## Premortem and Safeguards

| Assumed Review Failure | Probability | Impact | Detection | Prevention |
| --- | --- | --- | --- | --- |
| Original deficiencies mislabeled clone regressions | Medium | High | Compare original markup, handlers, and supplied original/local runtime observations | Record provenance per finding; latest controlled comparison supersedes preliminary observations |
| Source inspection presented as proof of browser focus behavior | High | High | Separate static facts from runtime results and pending checks | Attribute lead evidence; defer unobserved focus, screen-reader, and rendering conclusions |
| Accessibility recommendations alter the original appearance during QA | Low | High | Inspect the audit's write scope | Write only this report; recommend separate approval for any remediation |
| Hidden prototype content creates false navigation findings | Medium | Medium | Inspect ancestors and responsive CSS | Exclude hidden footer, community, and old-design slider placeholders |

## Findings

### UX-01 - P1 - Mobile Navigation Cannot Be Opened by Keyboard; Escape Does Not Close It

**Origin:** Inherited. **Status:** Static defect verified; runtime lead confirmed
the local keyboard and Escape failures at 320x568.

All seven headers use a plain `<div id="hamb-button">` with no role, accessible
name, `tabindex`, `aria-expanded`, or controlled-panel relationship. The panel is
a plain `.hamburger-component`. The body-lock listener handles clicks only.
Webflow's accessible navbar behavior targets `.w-nav-button`, not this custom
element, so its built-in keyboard handling does not repair the custom menu.

**Evidence:** Page/original lines in the coverage table;
`deepbook/index.html:654-658` and `deepbook/source/pages/home.html:654-658`;
`deepbook/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/js/webflow.schunk.d3ccbb73ca719876.js:1`
(navbar module selects `.w-nav-button` and binds its keydown handler).
Runtime lead: Tab from header Docs skips the menu and reaches Start Building;
after mouse opening, Escape leaves `body.menu-open=true`.
Capture: `deepbook/qa/team-2026-11-07/mobile-menu-after-escape.jpg`.

**Targeted QA:** At 320x568, Tab from Docs, attempt Enter/Space on the menu, then
mouse-open and press Escape. Also verify focus entry, background focus exclusion,
and focus restoration after close; those transitions remain unverified here.
**Remediation:** One named button and one shared open/close routine must coordinate
animation, expanded state, scroll lock, Escape, and focus. Treat these as one
mobile-menu lifecycle defect, not several clone regressions.

### UX-02 - P1 - Builder Accordion Keyboard State Diverges from Visible Content

**Origin:** Inherited, not a clone regression. **Status:** Static mechanism
verified; original/local runtime comparison supplied by the runtime lead.

The content is `height: 0` unless its ancestor has `dd-active`. Core initializes
the first item and changes `dd-active` only on `click`. Webflow separately handles
Enter/Space and Escape, changing `w--open` and `aria-expanded` without updating
that custom class. This is a CSS/class state split, not a missing GSAP height
tween. Enter can announce expanded while content remains clipped; Escape can
announce collapsed while mouse-opened content remains visible.

**Evidence:** `deepbook/builder-hub/index.html:17-34` and
`deepbook/source/pages/builder-hub.html:17-34`;
`deepbook/assets/slater.app/19933/59952.js:644-668` and
`deepbook/source/assets/slater.app/19933/59952.js:644-668`;
`deepbook/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/js/webflow.6d3149b8.55acc07a84b6834a.js:1`
(dropdown Enter/Space invokes its internal toggle; Escape invokes internal close).
Runtime lead: original mouse opens Margin / How it works to about 75.9px; original
Escape sets expanded=false while leaving `dd-active` and the content visible.
A fresh local mouse-only load also opens correctly; local Enter sets expanded=true
without `dd-active`, leaving height zero.
Capture: `deepbook/qa/team-2026-11-07/builder-keyboard-accordion.jpg`.

**Targeted QA:** Fresh-load Builder Hub, select Margin with ArrowRight, Tab to
How it works (`#w-dropdown-toggle-4`), press Enter, and compare expanded state,
ancestor class, and settled height. Separately mouse-open, then Escape. Test Spot
and Predict too. **Remediation:** Derive visual and accessibility state from one
controller, covering click, keyboard, close events, and initial state.

### UX-03 - P1 - Points Wallet Connection Is Not Keyboard Reachable

**Origin:** Inherited. **Status:** Markup and click-only binding statically verified;
browser and assistive-technology behavior needs runtime confirmation.

`#connectWallet` is an `<a>` without `href`, button semantics, or `tabindex`.
The only connection handler listens for click. A keyboard-only user cannot
normally reach the primary action required to see their balance.

**Evidence:** `deepbook/points/index.html:477` (`a#connectWallet`, column 18207),
`deepbook/points/index.html:575-577`; identical markup and handler in
`deepbook/source/pages/points.html:477` and `:575-577`.

**Targeted QA:** Tab through View Your Balance without connecting a real wallet;
confirm Connect Wallet is skipped. Inspect its accessibility role and name.
**Remediation:** Use a native button, preserve its styling, and retain a visible
keyboard focus indicator. No wallet approval or transaction is needed for this check.

### UX-04 - P2 - FAQs and Mobile Resource Accordions Have Click-Only Div Triggers

**Origin:** Inherited. **Status:** Static defect verified; rendered collapsed states
and hidden-link focus behavior need runtime checks.

The Points FAQs, Builder resources, and Trader learning sections use plain
`div[global-dd-toggle]` controls. They have neither keyboard semantics nor
expanded-state metadata. Core collapses all but the first item below 768px;
the Points page script also applies this behavior on desktop. Users relying on
keyboard activation cannot expose the remaining answers/resources. Closing only
changes height and overflow, so any links in collapsed content are not explicitly
removed from the focus order or accessibility tree.

**Evidence:** `deepbook/points/index.html:477` (`.po-faq_dd-toggle`, starting column
1134287); `deepbook/builder-hub/index.html:513` (`.bh-building_heading-block`,
starting column 951338); `deepbook/trader-hub/index.html:863`
(`.th-learn_heading-block`, starting column 26673);
`deepbook/assets/slater.app/19933/59952.js:361-450`;
`deepbook/assets/slater.app/19933/60565.js:47-84`.
Saved original pages have the same markup at those lines, and both handlers are
unchanged in `deepbook/source/assets/slater.app/19933/`.

**Targeted QA:** Keyboard-open the second Points FAQ at desktop width, then Builder
SDKs and Trader DeepBook Margin at 375px. Tab through collapsed panels and check
for invisible focus stops. **Remediation:** Native disclosure buttons with a shared
state model and explicit collapsed-panel visibility/focus handling.

### UX-05 - P2 - Trading Category Filters Cannot Be Operated by Keyboard

**Origin:** Inherited. **Status:** Visible filter markup and click-only handlers
statically verified; actual keyboard traversal needs runtime confirmation.

The live CMS filter row uses `div.th-platforms_button[data-filter]`, not buttons.
It has no `tabindex`, pressed/selected state, or keyboard handling. The script
changes only the `active` class and card visibility. Keyboard users cannot narrow
the platform list to Spot, Margin, Perps, Lending, or Vault.

**Evidence:** `deepbook/trader-hub/index.html:863`, columns 47041-48430
(live row, not the hidden `.old-design-slider` prototype);
`deepbook/trader-hub/index.html:993-1007`; identical saved original at
`deepbook/source/pages/trader-hub.html:863` and `:993-1007`.

**Targeted QA:** Tab through Where to trade on DeepBook and attempt to select
Lending without a pointer; then mouse-select it and inspect the exposed state.
**Remediation:** Native filter buttons with pressed state; keep unavailable
Predictions explicitly disabled, rather than relying solely on pointer styling.

### UX-06 - P2 - Mobile Builder Explore Docs Opens the Current Page Instead of Docs

**Origin:** Inherited. **Status:** Destination and responsive visibility verified
statically; resulting navigation needs runtime confirmation.

The mobile hero CTA has `href="" target="_blank"`, while the desktop equivalent
has the correct Sui documentation URL. Activating the visible mobile action resolves
to the current page, creating another Builder page rather than documentation.

**Evidence:** `deepbook/builder-hub/index.html:496`, column 15743, and
`deepbook/source/pages/builder-hub.html:496` (`.bh-hero_mob-desc a`);
`deepbook/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css:7873-7877`
exposes that mobile description. The header Docs link is a working alternative
in the source; external service availability was not tested.

**Targeted QA:** At 375px, activate the hero Explore Docs and inspect the new-tab URL.
**Remediation:** Use the desktop CTA's existing documentation destination.

### UX-07 - P2 - Points Fetch Failure Leaves a False Zero and Hides Recovery Feedback

**Origin:** Inherited. **Status:** Error-path logic verified statically; exercise
with mocked wallet/indexer responses, not a real account.

The script hides `#connect-section` (including `#walletStatus` and the connection
control) before the points request completes. If the fetch fails, the catch writes
its error into that hidden status. A valid JSON response of `[]` silently returns,
then reports success in the same hidden element; default Total Points remains 0.
There is no HTTP-status check or visible retry action. This makes unavailable data
indistinguishable from a genuine zero-point balance and hides the recovery path.

**Evidence:** `deepbook/points/index.html:477` (`#walletStatus` inside
`#connect-section`, default `[total-points]` values); `:548-566` and `:595-602`;
same markup and logic in `deepbook/source/pages/points.html` at the same lines.

**Targeted QA:** Mock successful wallet connection, then reject the points request;
repeat with JSON `[]` and a non-2xx response. Check visible error, loading/unknown
balance state, announcement, and retry availability. **Remediation:** Keep status
outside the hidden connection panel; distinguish loading/error/no-data from zero
and expose a retry. This is not a claim that the live indexer is currently down.

### UX-08 - P2 - Reduced Motion Does Not Disable JavaScript Motion

**Origin:** Inherited. **Status:** CSS-only reduced-motion handling and unguarded
JavaScript motion verified; perceived behavior needs runtime confirmation.

The reduced-motion media query shortens CSS animations/transitions only. Core
still starts Lenis smooth scrolling, scroll-driven text reveals, and an infinite
mobile waitlist marquee. Builder starts repeating GSAP timelines and a canvas
draw ticker. These are JavaScript updates, unaffected by the CSS duration override;
the marquee has no pause control, and its dismiss target is a click-only SVG.

**Evidence:** `deepbook/index.html:239-248` and original
`deepbook/source/pages/home.html:239-248`;
`deepbook/assets/slater.app/19933/59952.js:4-14`, `:674-700`, `:785-793`, `:820-845`;
`deepbook/assets/slater.app/19933/60445.js:216`, `:241-243`.
Original scripts at the corresponding `deepbook/source/assets/` paths are identical.

**Targeted QA:** Enable reduced motion before loading Home and Builder at desktop
and 375px; verify scroll interpolation, marquee, reveals, and canvas motion rather
than only computed CSS durations. **Remediation:** Gate these JS systems on the
preference and provide a static readable state; preserve default rendering.

### UX-09 - P2 - Builder Dropdown Keyboard Focus Has No Authored Visible Indicator

**Origin:** Inherited. **Status:** Focus-outline suppression and absence of a
replacement style verified; final visual result needs runtime inspection.

Webflow makes the dropdown toggles keyboard-focusable, but shared CSS explicitly
sets `.w-dropdown-toggle:focus { outline: 0; }`. The custom toggle styles have no
focus replacement. The blue plus is present even when unfocused and reflects
disclosure state, not focus. Tabs also suppress their focus outline; selection
color alone should not be assumed to identify focus once it moves into a panel.

**Evidence:**
`deepbook/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css:1369-1371`,
`:1995-1997`, and `:3632-3639`;
`deepbook/source/assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css`
has the same declarations at the same lines.

**Targeted QA:** With the pointer away, Tab from the selected Builder tab into all
three dropdown toggles. Capture focused versus unfocused states. **Remediation:**
Add a keyboard-only focus indicator without changing pointer/default appearance.

### UX-10 - P2 - Mobile Social Destinations Have No Accessible Names

**Origin:** Inherited. **Status:** Empty link contents and missing naming attributes
verified; accessibility-tree announcement needs runtime confirmation.

The mobile menu's Discord and X links contain only untitled SVG paths, with no
`aria-label`, labelled-by reference, image alt text, or readable text. A screen-reader
user cannot reliably distinguish the two destinations by a meaningful name.

**Evidence:** `deepbook/index.html:466`, columns 11271 and 13798
(`a.social-button.is--blue`), and `deepbook/source/pages/home.html:466`.
The same component appears on all seven pages at the navigation lines in the table.

**Targeted QA:** Mouse-open the mobile menu, inspect both link accessible names,
and navigate them with a screen reader. **Remediation:** Add destination-specific
accessible names without altering the SVG artwork. Do not flag the home logo as
unnamed: Webflow's navbar runtime supplies its `aria-label="home"`.

## Coverage Notes and Deliberate Exclusions

- Home's finance-stack panels are scroll-driven (`59953.js:93-108`), not ordinary
  selectable tabs; lack of clickable pagination dots alone is not a finding.
- Builder's Spot/Margin/Predict tabs receive roles, selected state, and arrow-key
  behavior from Webflow. Runtime lead confirmed ArrowRight selects/focuses Margin.
  Do not report missing roles from pre-initialization HTML as a tab-navigation bug.
- Deep Token's distribution chart is path-only SVG with no title, description,
  textual year-by-year schedule, or accessible data table in `deepbook/deep-token/index.html:446`
  (desktop SVG column 92202; mobile SVG column 223074); the original is identical.
  The surrounding text provides aggregate allocation and a seven-year summary,
  not equivalent chart detail. Check the accessible tree against the visible chart
  before treating this as an additional P2 information-access defect.
- Privacy Policy's `#contact` fragment exists and the contact email is a `mailto:`
  link. Terms also has a usable contact `mailto:`. No additional blocked legal
  navigation workflow was established beyond shared navigation defects.
- Hidden footer product/Education links and hidden old-design trading cards have
  placeholder destinations. Their hidden ancestors were checked, so they are not
  counted as visible dead links. Builder's visible 7K card does have `href="#"`
  (`builder-hub/index.html:513`, original same line); confirm it remains visible at
  the target viewport before adding a lower-priority dead-project-link finding.
- External docs, audits, apps, waitlist, wallet module, indexer, and social links
  remain external by design. Network availability and remote content were not
  tested. `target="_blank"` alone is not reported as a security defect.

## Premortem-Derived QA Checklist

- [x] Inspect all seven local/original page pairs and relevant shared/page scripts.
- [x] Compare inherited versus local source before assigning provenance.
- [x] Correct preliminary Builder regression attribution using the runtime lead's
  final controlled comparison; no clone regression claimed.
- [x] Check hidden ancestors before counting placeholder navigation defects.
- [x] Account for Webflow-injected semantics and keyboard handlers.
- [x] Make no product edits; write this report only.
- [x] Explicitly defer unobserved runtime checks to the main QA agent.
- [ ] Runtime lead: verify menu focus entry, background exclusion, and restoration.
- [ ] Runtime lead: verify Points trigger, FAQ/resource controls, trading filters,
  mobile Docs destination, reduced motion, visible focus, and social names.
- [ ] Runtime lead: mock wallet/indexer failure paths without real authorization.
- [ ] Runtime lead: compare chart accessible information with the visible schedule.

The unchecked items are explicit source-audit limits, not passing runtime results.
