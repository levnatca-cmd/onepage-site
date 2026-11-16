# DeepBook Functional, Source, and Server Reliability Review

Date: 2026-11-07. Target: <http://127.0.0.1:4180/>. Reference: <https://deepbook-v2-wip.webflow.io/>.

## Result

No confirmed snapshot-introduced defect in the audited route, resource, import, server, or source-content surface. The builder accordion discrepancy reported during review was isolated by the lead to an **inherited keyboard/CSS state bug**, not a clone regression. A fresh local mouse interaction works.

This reviewer did not control a browser, submit forms, connect a wallet, or initiate trades. Runtime observations explicitly attributed to the lead below were supplied during this review. Only this report and the permitted regenerated `qa/static-check.json` were written by this reviewer. Paths below are relative to `deepbook/` unless otherwise stated.

## Premortem and QA Safeguards

| Likely audit failure | Probability | Impact | Detection and prevention incorporated |
| --- | --- | --- | --- |
| Passing HTML-only checks conceal missing dynamic imports or external module dependencies | High | High | Inspect inline loaders and all custom Slater JavaScript; resolve the core import from its module URL; inventory remaining remote imports separately from mirrored assets. |
| Clean routes pass while slash/index URLs resolve relative resources incorrectly | Medium | High | Test every page URL form with GET and HEAD; resolve HTML and inline-loader resources against every actual document URL base. |
| Local timing or rewritten JavaScript changes initialization despite complete downloads | Medium | High | Inspect parser-blocking dependencies, DOMContentLoaded loaders, custom initialization, and source/local changes; compare exact live core source when a runtime discrepancy is reported. |
| An original defect or external service boundary is mislabeled a clone regression | Medium | High | Compare saved source and live source where relevant; incorporate the lead's fresh local/original repro; do not exercise wallet/backend flows. |
| An empty anchor in hidden or duplicate responsive markup is mislabeled a user-facing defect | High | Medium | Trace each cited anchor's ancestors and CSS/media-query display rules; require visible runtime evidence before assigning defect severity. |

- [x] Current static checks rerun, not inferred from old reports.
- [x] All seven routes, alternate forms, query handling, resource URL bases, and dynamic import checked.
- [x] Script dependency ordering and JavaScript syntax checked.
- [x] Missing/malformed/traversal paths checked without writes.
- [x] Builder dropdown discrepancy reclassified using source evidence and lead runtime verification.
- [x] External dependencies and deferred interaction coverage stated explicitly.
- [x] F2 visibility follow-up: hidden footer/Trader placeholders excluded from defects; Builder mobile-only candidate explicitly deferred to lead runtime verification.

## Commands and Current Results

Commands ran from the [repository root](../../..). Ad hoc Node harnesses were supplied over stdin and did not create files. Initial sandboxed localhost fetch returned `EPERM`; the same read-only requests succeeded with the approved network execution permission.

| Command or harness | Current result |
| --- | --- |
| `node deepbook/tools/check.mjs` | PASS: 7 pages, 98 assets, 105 local files, no errors. Generated report timestamp: `2026-11-07T21:35:42.953Z`. |
| `node --input-type=module` HTTP harness using `fs`, `fetch`, and `crypto.createHash` | 276 GET/HEAD checks: 80 page requests plus 196 asset requests. Every response had the expected 200 status, MIME, content length, and GET SHA-256 match to disk. HEAD bodies were empty. No redirects. |
| `node --input-type=module` document/import harness using `parse5`, `new URL`, and `fs.stat` | 716 HTML/inline-loader resource resolutions across 20 document URL forms: no missing or external mirrored resource. One local dynamic core import resolved successfully. |
| `node --input-type=module` dependency/syntax harness; `execFileSync(process.execPath, ['--check', file])` | All 26 mirrored JavaScript files passed syntax checks. All 56 GSAP/plugin/Lenis dependency-order comparisons passed. |
| `node --input-type=module` raw-path harness using `http.request` | 24 additional GET/HEAD requests: missing pages/assets and malformed encodings returned 404, encoded traversal was rejected with 403 or normalized to an in-root 404, query variants returned 200, all HEAD bodies empty. No outside-root content returned. |
| `node --input-type=module` source text / anchor audit using `parse5` | All seven pages' non-script/style text exactly matches the saved original. All nonempty named local hash targets resolve; no missing named anchors. Empty and `#` action destinations are listed separately below. |
| `rg`, `nl -ba`, and direct source reads of `tools/*.mjs`, every custom Slater script, and loader-related Webflow code | Reviewed rewriting, import resolution, request paths, MIME, script timing, and custom controls. No product edits. |
| Follow-up `node --input-type=module` ancestor/CSS harness using `parse5` and `prettier/plugins/postcss.mjs` | Traced cited empty anchors and all 35 footer placeholders across seven routes. Parsed CSS rules, enclosing media queries, and relevant inline styles. Found desktop-hidden mobile Builder duplicate and explicitly hidden Trader/footer placeholders; revised F2 below. |

Page URL forms were `/` and `/index.html`, plus clean, trailing-slash, and `/index.html` forms for `builder-hub`, `trader-hub`, `deep-token`, `points`, `privacy-policy`, and `terms-of-use`. Each was repeated with `?qa=1&ref=a%2Fb#qa-fragment`. Fragments are client-only and are not sent over HTTP; the separate anchor audit covered target existence.

All 98 manifest assets were fetched using URL-encoded path segments, including names with spaces and `@`. JavaScript, CSS, JSON/Lottie, SVG, PNG, WOFF2, and TTF responses were checked against their expected MIME and bytes. CSS font URLs and Lottie image dependencies passed the current static checker. Missing `.js`, `.css`, and `.json` URLs return 404 rather than an HTML SPA fallback.

Representative reproduction commands:

```sh
npm run qa:deepbook
curl -sS -I http://127.0.0.1:4180/builder-hub
curl -sS -I http://127.0.0.1:4180/builder-hub/
curl -sS -I http://127.0.0.1:4180/builder-hub/index.html
curl -sS -I 'http://127.0.0.1:4180/points?qa=1&ref=a%2Fb'
curl -sS -I http://127.0.0.1:4180/assets/not-found.js
curl --path-as-is -sS -I 'http://127.0.0.1:4180/%2e%2e%2fpackage.json'
```

The raw traversal test initially asserted 403 for both traversal shapes. `/assets/%2e%2e/%2e%2e/package.json` instead returned 404 because WHATWG URL parsing normalizes its dot segments before filesystem resolution. This is an acceptable rejection, not a defect or a successful traversal.

## Confirmed Findings

### F1. P2: Builder accordion keyboard state is not synchronized with visible content

**Classification: inherited original defect; not a snapshot regression.**

Repro supplied and verified by the lead: on the original builder page, select Margin, mouse-open `#w-dropdown-toggle-4` (How it works), then press Escape. Webflow sets `aria-expanded=false`, while the list remains about 75.9px high and its parent retains `dd-active`. Enter can change Webflow's open state without changing `dd-active`; subsequent mouse clicks can leave the states inverted. A fresh local reload, Margin selection, and one mouse click correctly opens the list to about 75.9px.

Cause: `assets/slater.app/19933/59952.js:644` defines `initGlobalTabDropdown()`. Its native `click` handler at line 653 exclusively toggles the parent's `dd-active`; it has no keyboard or Webflow open/close event synchronization. The inline CSS in `builder-hub/index.html:17` collapses `.bh-spot_dd-content`, and the selector at line 32 opens it only for `dd-active`. Webflow's separate keyboard handling changes `w--open` and ARIA, not that custom class. Dropdown markup is at `builder-hub/index.html:513`. Webflow keyboard/open/close logic is in `assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/js/webflow.6d3149b8.55acc07a84b6834a.js:1`.

Do not fix this under a clone-regression-only mandate without expanding scope. Any later fix should keep click, Enter, Space, Escape, outside-close, visual height, and ARIA state synchronized, rather than patching only the height.

## Source Visibility Notes

### F2. Revised: Placeholder inventory, not confirmed runtime defects

**The earlier P2 classification is withdrawn.** Empty/`#` targets alone did not establish a visible or actionable defect. Ancestor and CSS inspection confirms that most cited examples are intentionally hidden markup. None is a confirmed clone regression.

CSS line references in this section refer to `assets/cdn.prod.website-files.com/69e7b04d09112b265e2d47d1/css/deepbook-v2-wip.webflow.shared.57c88baf1.css`.

| Anchor and source location | Visibility ancestry and CSS | Correct classification |
| --- | --- | --- |
| Builder Explore Docs, `href=""`, `builder-hub/index.html:496` | `a.cta-button.is--blue` inside `.bh-hero_desc-wrapper.mobile`, inside `.bh-hero_mob-desc`. The outer ancestor has `display:none` at CSS line 4809. At `max-width:767px`, it becomes `display:block` at line 7873 and the inner `.mobile` wrapper becomes `display:flex` at line 7658. | Hidden at 1280px; mobile-only candidate at widths <=767px. Actual mobile visibility/action is pending the lead's runtime filter, so no defect severity is assigned here. |
| Builder desktop Explore Docs, same HTML line | Separate anchor inside `.bh-hero_desc-wrapper` directly under `.bh-hero`, with valid `https://docs.sui.io/onchain-finance/deepbookv3/deepbook` destination. Desktop wrapper is `display:flex` at CSS line 3372 and hidden at <=767px by line 7653. A third valid Docs anchor belongs to the hamburger component. | The lead's valid 1280px AX result corresponds to the desktop anchor, not the empty mobile duplicate. No desktop Docs defect. |
| Trader Explore Trading Apps, `href=""`, `trader-hub/index.html:847` | Anchor itself is `.cta-button.is--blue.hdn`, inside `.th-hero_desc-wrapper.mobile` and `.th-hero_mob-desc`. `.cta-button.is--blue.hdn { display:none }` at CSS line 2476 applies independently of the responsive ancestors. | Hidden placeholder, not an active-user link defect. |
| Trader Explore the Education Hub, `href=""`, `trader-hub/index.html:863` | Anchor itself is `.cta-button.is--blue.hdn` inside `.th-learn`; same explicit `display:none` rule at CSS line 2476. | Hidden placeholder, not an active-user link defect. |
| Footer Spot, Margin, Predict, DEEP Token, all `href="#"` | Each lies inside `div.w-layout-vflex.gap-16.hdn`. `.gap-16.hdn { display:none }` at CSS line 2813 hides the entire product group. | Hidden placeholders, not active footer navigation defects. |
| Footer Education Hub, `href="#"` | Anchor lies inside `li.footer_list-item.hdn`. `.footer_list-item.hdn { display:none }` at CSS line 2840 hides the item. | Hidden placeholder, not an active footer navigation defect. |

The footer ancestry is identical across all seven routes: `index.html:641`, `trader-hub/index.html:863`, `terms-of-use/index.html:446`, `privacy-policy/index.html:446`, `deep-token/index.html:602`, `builder-hub/index.html:513`, and `points/index.html:477`. This accounts for 28 hidden product links and seven hidden Education Hub links. No media-query override of the three cited `.hdn` compound selectors was found, and relevant inline styles do not override their display. No custom Slater code referencing those classes to reveal these placeholders was found.

The same targets and visibility ancestry occur in the saved original source. The Builder mobile candidate is therefore inherited source markup, not a copying defect. Source CSS predicts breakpoint eligibility; it is not a substitute for rendered visibility, hit-testing, or an observed user-facing failure. The lead is checking visible empty/`#` anchors across routes. Do not use the hidden examples above as runtime defect repros or fix targets.

## Builder Regression Investigation: Ruled-Out Causes

- Live `https://deepbook-v2-wip.webflow.io/builder-hub` GET returned 200 and was byte-identical to `source/pages/builder-hub.html`: 997,328 bytes, SHA-256 `d7422e7ce47e154e0a98e3cb69c45d5fdf6e448695824f693b5786634b723c70`.
- Live `https://slater.app/19933.js` was identical to its saved source. Its import is `https://slater.app/19933/59952.js?v=552100`; local `assets/slater.app/19933.js:27` correctly rewrites it to `./19933/59952.js`.
- Both the exact versioned core URL and its unversioned URL returned the same 25,916-byte core as the saved and served local file: SHA-256 `65d82eb2690d9a77f8ee5fcf7e7faf88f2eeb84897a29229ab46da9fa2b6f3ec`. Query stripping in `tools/mirror.mjs:33` did not change this core's content.
- Production `assets.slater.app` endpoints differ from development `slater.app` endpoints, but the specified Webflow source selects `slater.app` on its own host. The local mirror matches that branch, so production/development normalization is not a demonstrated regression for this reference.
- Of 47 saved text assets, 43 are byte-identical to local assets, including the core and all five page-specific Slater scripts. The four changed assets are the shared CSS, Inter CSS, Slater entry module, and Webflow shared chunk; their changes are URL rewrites.
- The `data-wf-domain` adjustment in `tools/mirror.mjs:201` is consumed by Webflow badge/editor logic in the shared chunk, not the custom accordion handler. No evidence supports blaming it for this state mismatch.
- Blocking Webflow, GSAP, plugin, and Lenis scripts precede the DOMContentLoaded-appended custom scripts. The local core module exists and is served as JavaScript. There is no confirmed missing dependency or timing regression.

## External Boundaries and Limits

`points/index.html:538` still statically imports `https://esm.sh/@mysten/wallet-standard`. `fetchPoints()` at line 560 calls the original external Mysten indexer after wallet connection. Wallet discovery/connection, indexer results, docs, partner trading apps, waitlist, social links, audit reports, and media kit are external-service boundaries retained from the source, not services implemented by this snapshot.

The static check's pass does **not** certify offline wallet support: its inline-JavaScript reference check (`tools/check.mjs:58`) does not validate remote ESM `from` imports. The remaining remote wallet module was discovered manually. This is a coverage limit and expected external boundary, not evidence of a broken local asset promise. No wallet connection, account request, authenticated backend call, or transaction was attempted.

The points page also contains duplicate `save-image` IDs and placeholder save/share markup at `points/index.html:477`, with no corresponding export implementation found in the custom scripts. Actual post-connection visibility and export behavior were not exercised; this is a source-inherited residual risk, not an additional runtime-confirmed clone defect.

Browser viewport, animation rendering, dropdown/filter interaction, and keyboard verification remain the lead runtime audit's responsibility. General external destination availability was not exhaustively retested. No open clone-specific fix is justified by this bounded audit.
