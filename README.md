# LEVNAT / Systems Engineering websites

This repository contains a multi-page consulting website and two retained interactive experiences:

- **LEVNAT** (`index.html`, `services/`, `work/`, `approach/`, `contact/`): nine generated static pages for development, integrations and support. The home page contains Daybook, a usable local booking prototype whose interface and interactive Three.js modules share one state.
- **Galaxy** (`explore.html`): the retained interactive system models, questionnaire and project results.
- **Starworld** (`starworld.html`): a generated, self-contained cyberpunk service map covering software, backend APIs, integrations, support, native iOS/Swift and security/post-quantum readiness.

## Quick start

Use Node.js 20 or newer. Runtime code uses the retained local Three.js distribution; it does not require a framework or a dependency install.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4173/` for the multi-page site, `/explore.html` for Galaxy or `/starworld.html` for Starworld. Stop the preview with Ctrl+C. Set `PORT` to use a different port.

For source formatting, install the locked development tool first:

```sh
npm ci
npm run format:check
```

## Repository map

```text
index.html                    Generated LEVNAT home page
services/, work/, approach/, contact/
                              Generated inner pages, including three service details
explore.html                  Galaxy's maintained HTML entry
starworld.html                Generated offline Starworld deliverable
src/
  studio/
    pages.js                  Nine authored page definitions and HTML content
    styles.css                Retained shared baseline
    living-system.css         Current responsive visual system
    app.js, inquiry.js        Navigation, demos and local inquiry drafts
    scene.js                  Interactive, state-connected Three.js modules
    lab/                      Booking state, workbench, controller and public PNG card
  galaxy/
    js/                       State, data, UI and semantic 3D models
    styles/                   Existing main-site CSS layers
  starworld/
    index.html                HTML template and build markers
    data/services.js          Service descriptions and stable IDs
    domain/project-brief.js   Selection, notes, text and mailto generation
    scene/                    Geometry, label placement and Three.js scene
    styles/                   Base, theme, service and layout layers
    app.js                    UI state, events, settings and local agent tools
assets/images/                First-party images, including the favicon
assets/fonts/                 Self-hosted Manrope and its OFL license
vendor/lucide/                Generated small icon subset from the locked dev dependency
vendor/three/                 Retained Three.js distribution and license header
scripts/                      Build, preview, QA and local packaging commands
tests/
  galaxy/                     Main-site scene contracts
  starworld/                  Service, brief, Unicode and geometry contracts
  content/                    Form/3D copy contracts and browser output journeys
  studio/                     Multi-page structure, inquiry and browser journeys
  system-lab/                 Daybook domain, privacy, rendering and recovery checks
  fixtures/                   Historical baseline, retained unchanged
docs/
  plans/                      Implementation plans and premortems
  reviews/                    Design and QA findings with verification limits
  roadmap.md                  Existing product backlog
  refactor-paths.json         Old-to-new folder mapping
prototypes/pqc-motion/        English motion study and its preview wrapper
artifacts/
  screenshots/                Captured QA evidence
  qa/                         Generated diagnostic pages; ignored by Git
deploy/starworld/             Existing publishing checkout and Site identity
robots.txt, sitemap.xml       Main-site search-engine entries
```

## Source ownership

Edit the main website in `src/studio/` and run `npm run build:studio` (or the complete `npm run build`). `scripts/build-studio.mjs` owns the shared HTML shell and outputs nine documents. Do not hand-edit generated pages. Page navigation uses ordinary URLs and works without JavaScript. Inquiry drafts remain in this browser's local storage; the website does not submit data to a server. Preparing a draft reveals a user-reviewed email link. Copy and download are alternative handoff methods.

Daybook is an independent local prototype, not commissioned client work or a production booking service. Build the interface, submit a sample request before connecting, connect the simulated API, introduce an API/device fault, then repair and replay the queue. Exactly-once handling is enforced by the domain reducer, not the animation. The three 3D modules offer equivalent pointer actions; ordinary form controls remain the primary accessible path. Booking records live only in page memory and reset on reload. Share links and PNG cards serialize seven allowlisted public settings, never guest names, request records, logs or contact drafts. A shared example restores a synthetic guest. The product remains usable without WebGL.

Edit Galaxy's `explore.html` and `src/galaxy/` directly. Its existing cache-buster values and relative module imports remain coordinated by the Galaxy contract check.

Edit Starworld under `src/starworld/`, then run `npm run build`. Do not hand-edit `starworld.html` or the HTML copies under `deploy/starworld/`: they are generated. The build embeds CSS, the retained engine and the explicitly ordered JavaScript fragments into two inline scripts. Fragments share one private closure so the offline file requires no module server, dynamic imports or runtime downloads. `scripts/lib/starworld-source.mjs` declares their order.

The spatial glyph background is owned by `src/starworld/scene/glyph-field.js`. It uses a generated transparent atlas and a distant point field, controlled by the existing Digital rain setting.

The CSS order is `base.css`, `theme.css`, `services.css`, then `layout.css`. It preserves the existing cascade while making each layer readable and owned.

The new multi-page site now owns `/`. Galaxy intentionally moved to `/explore.html`; Starworld remains `/starworld.html`. The old root hash links are not redirects to the explorer. All new pages link to the retained experiments in their footer.

## Commands

| Command                        | Result                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `npm run build`                | Build nine LEVNAT pages, standalone Starworld and local packaging copies           |
| `npm run build:studio`         | Generate only the nine shared-shell LEVNAT pages and local icons                   |
| `npm run build:starworld`      | Generate only root `starworld.html`                                                |
| `npm run package:starworld`    | Copy the existing generated HTML into the local publishing checkout                |
| `npm test`                     | Check repository references/language, Galaxy contracts and Starworld contracts     |
| `npm run test:galaxy`          | Check main-site registries, models, cache versions and runtime contracts           |
| `npm run test:starworld`       | Check every service subset, Unicode, drafts, labels and model picking              |
| `npm run test:content`         | Check questionnaire text mirrors, offer wording and all 3,125 summary combinations |
| `npm run test:content:browser` | Verify rendered copy, drafts, downloads, previews and 3D labels in Chromium        |
| `npm run test:studio`          | Verify multi-page metadata, routes, content and inquiry contracts                  |
| `npm run test:studio:browser`  | Verify new routes, responsive layout, navigation, demos, inquiries and 3D          |
| `npm run test:system`          | Verify booking, bounded queue, replay, privacy and workbench contracts             |
| `npm run test:system:browser`  | Verify real booking journeys, 3D actions, sharing, PNG, recovery and keyboard use  |
| `npm run qa:starworld`         | Generate WebGL-loss and no-WebGL diagnostic copies under `artifacts/qa/starworld/` |
| `npm run dev`                  | Serve both sites locally on port 4173                                              |
| `npm run format`               | Format authored Starworld code, tooling, tests and documentation                   |
| `npm run format:check`         | Check that same formatting scope without modifying files                           |

Build and test scripts resolve paths from their own location rather than the caller's current directory. Run `npm run build` before `npm test` after changing Starworld sources.

`npm test` includes the structured content checks; run `npm ci` first to install their HTML parser. Browser content tests use an isolated Playwright runtime and an already running local preview:

```sh
npm install --prefix /private/tmp/onepage-uiux-qa-runtime --no-audit --no-fund playwright pngjs @axe-core/playwright
```

Start `PORT=4175 npm run dev`, then run `npm run test:content:browser` from another terminal. Set `QA_BASE_URL`, `QA_RUNTIME` or `QA_CHROME` for a different preview URL, dependency directory or Chrome executable. Browser evidence is written under `artifacts/qa/content-update-2026-11-05/`; email/share actions are captured locally rather than transmitted. These tests assert content behavior but do not certify all UI/UX audit findings as fixed.

Run `npm run test:studio:browser` against the same preview for the multi-page design. Browser QA uses the installed Chrome executable and software WebGL. It does not certify physical-device performance, assistive-technology behavior or email delivery.

Run `QA_BASE_URL=http://127.0.0.1:4177 npm run test:system:browser` against the current preview for Daybook. `QA_LAB_FILTER` and `QA_STUDIO_FILTER` select a named case; `QA_LAB_OUTPUT` and `QA_STUDIO_OUTPUT` select evidence folders. The redesign plan and verification record are in `docs/plans/living-system-redesign-2026-11-06.md` and `docs/reviews/living-system-verification-2026-11-06.md`.

## Documentation and language

Project documentation, code comments, prototype UI and test descriptions are English. Unicode coverage remains in tests through accented characters and emoji. `npm test` rejects accidental Cyrillic text in maintained project files; immutable Git history and installed dependencies are outside that check.

Start with the [organization plan](docs/plans/repository-organization.md), [Starworld QA history](docs/reviews/starworld-qa.md), [engineering plan](docs/plans/engineering-console.md) or [roadmap](docs/roadmap.md). Historical audit numbers and deferred device checks remain labeled with their original dates. The historical hash fixture is not rewritten to imply a new original baseline.

## Local publishing checkout

`deploy/starworld/` retains the pre-existing nested Git repository and `.openai/hosting.json` identity. Local build/package commands only refresh files; they do not commit, push, upload or deploy. Follow the existing publication authorization separately when a hosted release is requested.

The standalone HTML can also be opened directly from disk. Browser tab session storage keeps a draft through reload when available; contact opens a reviewable email draft.
