# Living System Redesign Verification

Date: November 6, 2026. Canonical local preview: http://127.0.0.1:4177/. Saved-folder preview: http://127.0.0.1:4175/.

## Delivered Experience

The reference brief is implemented as a working product story rather than a decorative animation. Daybook is an independent, explicitly local booking prototype. A visitor can build the app, reserve one of three validated sample slots, queue requests before connecting a simulated API, introduce an API or device fault, inspect events, and repair/replay pending requests without duplicate delivery. The product interface, request workspace and Three.js modules reflect the same immutable domain state.

The three spatial modules are also pointer targets: build the app, connect/disconnect the API, or simulate/repair a device outage. Equivalent ordinary controls remain available to keyboard and touch users. The event inspector sits beside the action; a fuller request/event workspace is available below. Booking inputs never cause an external request.

Share links serialize seven public configuration fields only. They restore at most one synthetic guest, not the visitor's records. The downloadable PNG is a genuine local canvas image of that public configuration, not a screenshot containing names or an inquiry. Copy failure reveals a selectable public link instead of claiming success. Reset clears the sample records, guest field and open inspectors without touching the separate contact draft.

The visual system now uses a light, cool-neutral workspace, charcoal controls, cobalt/citrus accents and coral faults. Three.js modules have machined surfaces, labels, linked paths, state lights and transient delivery signals. Their desktop framing is calculated from module bounds and available space below the offer. Mobile uses a separate scene band rather than placing objects behind the product controls. Motion pauses on request, reduced-motion preference, hidden tab or offscreen state; loss of WebGL does not disable the HTML product.

Nine ordinary routes include a new `/work/daybook/` case with architecture, privacy boundaries and production limitations. Home and Work lead to the usable prototype. Service scope, published CAD prices, direct contact, local inquiry drafts and the two retained explorers remain. The copy does not invent clients, outcomes, a business team or production infrastructure. AI design/QA collaboration is not represented as the consultant's staff.

## Verification

- `npm run build`: nine static LEVNAT pages, local Lucide subset, standalone Starworld and its local packaging copies. No external deployment.
- `npm test`: 62 passing checks: 3 repository, 9 Galaxy, 15 Starworld, 8 content, 12 Studio and 15 System Lab. The domain check includes all 16,104 action sequences up to four steps, bounded history/queue, immutable transitions, validation, exactly-once replay, Unicode and public configuration round-trips.
- `test:studio:browser`: 35/35 passed against the canonical preview. Covers all nine routes at 1440 and 390 px, route identities, navigation, inquiry validation/persistence/handoff, local examples, responsive layout, doubled text, raw canvas pixels, motion, pause, reduced motion, context recovery and no-JavaScript/no-WebGL paths.
- `test:system:browser`: 11/11 passed. Covers direct 3D actions and inline events; complete API/device-fault booking journeys at 1440 and 390 px; malicious input rendered as text; reset isolation; private-marker share round-trip and real PNG; clipboard failure; no-WebGL flow; context loss with pending records; distinct nonblank canvas states; and keyboard use.
- `test:content:browser`: 8/8 retained Galaxy/Starworld cases passed, including 320, 390 and 1440 px and generated inquiry/3D label consistency.
- Axe scans reported no serious or critical violations on the nine routes at desktop/mobile widths or in the checked completed-product states. This is not accessibility certification.
- Responsive checks include 320 x 568, 390 x 844, 768 x 1024, 1440 x 1000 and 1920 x 1080. Checked controls and text have no horizontal overflow or clipped labels; the ordinary-size initial screen leaves a next-section hint. Doubling computed text sizes passed at 390 and 1440 px.
- Desktop/mobile screenshots, the live recovery sequence, event inspector and PNG were manually inspected. Raw canvas checks read the WebGL drawing buffer, not only overlaid HTML, and confirm nonblank, changing state and motion.
- Final public-card indicator regression passed after manual review: a device-only fault leaves the API active; an API fault marks only that node as failed and leaves delivery inactive.
- Formatting checks passed for authored Studio code, the changed build script, Studio/System Lab tests, package metadata and current documentation.

Canonical evidence: `artifacts/qa/living-system-studio-2026-11-06/`, `artifacts/qa/living-system-2026-11-06/` and the refreshed retained-experience results in `artifacts/qa/content-update-2026-11-05/`. No real emails, posts, payments or external demo submissions were sent. Browser share/clipboard handoffs were captured locally by the test harness.

## Saved Copy

The saved project is current at `exports/levnat-website/` and serves as the root of the preview on port 4175. All 117 allowlisted source/build files were copied and compared byte-for-byte with the canonical workspace. The separate start guide was updated and the original reference brief preserved. No symlinks, Git history, installed dependencies, deployment identity, credentials or QA captures were included. The SHA-256 manifest is `artifacts/qa/living-system-saved-2026-11-06/export-integrity.json`.

Both full browser suites were rerun against this saved copy: 35/35 Studio cases and 11/11 System Lab cases passed, including the final PNG indicator correction. Saved-copy evidence is in `artifacts/qa/living-system-saved-studio-2026-11-06/` and `artifacts/qa/living-system-saved-2026-11-06/`. The app queued the final browser preview; its URL and an actual saved-copy screenshot accompany the delivery. Documentation was synchronized again after this verification record was finalized.

## Explicit Limits

- This is a local prototype and static business website. Daybook has no durable backend, account system, real booking, payment, transactional email, production API or physical device integration. Exactly-once claims refer to this bounded local reducer, not a distributed production guarantee.
- Booking records are memory-only and clear on reload. Contact drafts retain the existing browser-local storage behavior; preparing a draft does not send it.
- Automated browser checks use installed Chromium and software WebGL. Physical-device GPU/battery performance, Safari/Firefox, screen-reader testing and a formal accessibility audit are deferred.
- Human comprehension, memorability, perceived wow effect, conversion and viral reach have not been measured. The implemented sharing mechanism is not proof of virality.
- Approved personal imagery, real client case studies and measured business outcomes still require owner-supplied evidence. The independent case is labeled accordingly.
- No Git reset, commit, push or external publication was performed. Unrelated pre-existing worktree changes were retained.

All implementation premortem gates are checked or explicitly deferred in `docs/plans/living-system-redesign-2026-11-06.md`. Local delivery is complete; external publication and the deferred studies are not implied.
