# LEVNAT / Systems Engineering websites

This repository contains a multi-page consulting website and two retained interactive experiences:

- **LEVNAT** (`services/`, `work/`, `approach/`, `contact/`): generated static pages for development, integrations and support. The Daybook booking prototype lives at `/work/daybook/demo/`.
- **Galaxy** (`/home/`, `/explore.html`): seven interactive service models with direct links to services and Contact, in light and dark themes.
- **Starworld** (`starworld.html`): a generated, self-contained cyberpunk service map covering software, backend APIs, integrations, support, native iOS/Swift and security/post-quantum readiness.

## Quick start

Use Node.js 20 or newer. Runtime code uses the retained local Three.js distribution; it does not require a framework or a dependency install.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4173/` to start with your device theme, `/home/` for light Galaxy, `/explore.html` for dark Galaxy or `/starworld.html` for Starworld. Stop the preview with Ctrl+C. Set `PORT` to use a different port.

For source formatting, install the locked development tool first:

```sh
npm ci
npm run format:check
```

## Repository map

```text
index.html                    Theme-based start page
home/                         Generated light Galaxy home page
services/, work/, approach/, contact/
                              Generated inner pages and the Daybook demo
explore.html                  Galaxy's maintained HTML entry
starworld.html                Generated offline Starworld deliverable
src/
  studio/
    pages.js                  Authored page definitions and HTML content
    styles.css                Retained shared baseline
    living-system.css         Current responsive visual system
    app.js, inquiry.js        Navigation, demos and inquiry fields
    scene.js                  Interactive, state-connected Three.js modules
    lab/                      Booking state, workbench, controller and public PNG card
  galaxy/
    js/                       State, data and UI
    js/scene/system-models/   3D model builders, including Hardware
    styles/                   Existing main-site CSS layers
  starworld/
    index.html                HTML template and build markers
    data/services.js          Service descriptions and stable IDs
    domain/project-brief.js   Service selection, brief text and inquiry fields
    scene/                    Geometry, label placement and Three.js scene
    styles/                   Base, theme, service and layout layers
    app.js                    UI state, events, settings and local agent tools
assets/images/                First-party images, including the favicon
assets/fonts/                 Self-hosted Manrope and its OFL license
vendor/lucide/                Generated small icon subset from the locked dev dependency
vendor/three/                 Retained Three.js distribution and license header
scripts/                      Build, preview and local packaging commands
tests/
  unit/                       Theme selection and Daybook logic
  functional/                 Browser journeys and interaction regressions
  verification/               Static contracts, resources and UI/UX audits
  support/                    Browser setup and local diagnostic tools
  fixtures/                   Historical baseline, retained unchanged
  run.mjs                     Default LEVNAT test runner
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
exports/                      Archived copy of the November 6 site
robots.txt, sitemap.xml       Main-site search-engine entries
```

## Source ownership

Edit the main website in `src/studio/` and run `npm run build:studio` (or the complete `npm run build`). `scripts/build-studio.mjs` owns the shared HTML shell and generates the site pages. Edit the source templates when changing the shared shell. Page navigation uses ordinary URLs and works without JavaScript. Studio, Galaxy and Starworld send inquiries to a same-origin HTTPS API after confirming transport readiness. The private server returns a receipt after saving an encrypted, signed record. See [strict PQC staging and deployment](deploy/pqc/README.md) for the HTTPS preview, tests and operator setup.

Daybook is an independent local prototype, not commissioned client work or a production booking service. Build the interface, submit a sample request before connecting, connect the simulated API, introduce an API/device fault, then repair and replay the queue. Exactly-once handling is enforced by the domain reducer, not the animation. The three 3D modules offer equivalent pointer actions; ordinary form controls remain the primary accessible path. Booking records live only in page memory and reset on reload. Share links and PNG cards serialize seven allowlisted public settings, never guest names, request records, logs or contact drafts. A shared example restores a synthetic guest. The product remains usable without WebGL.

Edit Galaxy's `explore.html` and `src/galaxy/` directly. `npm run build:studio` generates `/home/` from `explore.html` with the light palette from `src/galaxy/styles/light.css`. Its cache-buster values and relative module imports remain coordinated by the Galaxy contract check.

The Hardware concept image and reconstruction specification live under `assets/concepts/system-galaxy/`. The November 6 website snapshot is available through the [export archive](exports/levnat-website/README.md).

Edit Starworld under `src/starworld/`, then run `npm run build`. Do not hand-edit `starworld.html` or the HTML copies under `deploy/starworld/`: they are generated. The build embeds CSS, the retained engine and the explicitly ordered JavaScript fragments into two inline scripts. Fragments share one private closure so the offline file requires no module server, dynamic imports or runtime downloads. `scripts/lib/starworld-source.mjs` declares their order.

The spatial glyph background is owned by `src/starworld/scene/glyph-field.js`. It uses a generated transparent atlas and a distant point field, controlled by the existing Digital rain setting.

The Starworld CSS order is `base.css` for the hero and scene, `panels.css` for the catalog and dialogs, then `holograms.css` for the service preview.

The theme-based start page is `index.html`, with its routing logic in `src/studio/start-route.js`. Dark mode opens `/starworld.html`, and light mode opens `/home/`. The start page offers links to both versions when JavaScript is disabled. Older Daybook links at `/` and `/home/` open `/work/daybook/demo/` with their query and fragment intact. Direct links open the selected page. **Use device theme** in the footer returns to the start page to check the current preference again.

## Commands

| Command                        | Result                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `npm run build`                | Build the site pages, light Galaxy, standalone Starworld and local packaging copies |
| `npm run build:studio`         | Generate Studio pages, light Galaxy and local icons                                 |
| `npm run build:starworld`      | Generate only root `starworld.html`                                                 |
| `npm run package:starworld`    | Copy the existing generated HTML into the local publishing checkout                 |
| `npm test`                     | Run the default LEVNAT unit and verification suites                                 |
| `npm run test:start`           | Run the theme-based start page unit tests                                           |
| `npm run test:galaxy`          | Check main-site registries, models, cache versions and runtime contracts            |
| `npm run test:starworld`       | Check every service subset, Unicode, drafts, labels and model picking               |
| `npm run test:content`         | Check questionnaire text mirrors, offer wording and all 16,807 summary combinations |
| `npm run test:content:browser` | Verify rendered copy, drafts, downloads, previews and 3D labels in Chromium         |
| `npm run test:studio`          | Verify multi-page metadata, routes, content and inquiry contracts                   |
| `npm run test:studio:browser`  | Verify new routes, responsive layout, navigation, demos, inquiries and 3D           |
| `npm run test:system`          | Verify booking, bounded queue, replay, privacy and workbench contracts              |
| `npm run test:system:browser`  | Verify real booking journeys, 3D actions, sharing, PNG, recovery and keyboard use   |
| `npm run qa:starworld`         | Generate WebGL-loss and no-WebGL diagnostic copies under `artifacts/qa/starworld/`  |
| `npm run qa:uiux`              | Run the browser-based UI/UX audit                                                   |
| `npm run dev`                  | Serve both sites locally on port 4173                                               |
| `npm run build:pqc`            | Build a fresh web root containing only public files                                 |
| `npm run dev:pqc`              | Start the strict HTTPS preview with the configured bundle and NGINX                 |
| `npm run test:pqc`             | Test the private intake, encryption, signatures, and durable receipts               |
| `npm run format`               | Format authored Starworld code, tooling, tests and documentation                    |
| `npm run format:check`         | Check that same formatting scope without modifying files                            |

Build and test scripts resolve paths from their own location rather than the caller's current directory. Run `npm run build` before `npm test` after changing Starworld sources. See the [test folder guide](tests/README.md) for the suite layout and browser commands.

`npm test` includes the structured content checks; run `npm ci` first to install their HTML parser. Browser content tests use an isolated Playwright runtime and an already running local preview:

```sh
npm install --prefix /private/tmp/onepage-uiux-qa-runtime --no-audit --no-fund playwright pngjs @axe-core/playwright
```

Start `npm run dev`, then run `QA_BASE_URL=http://127.0.0.1:4173 npm run test:content:browser` from another terminal. Set `QA_BASE_URL`, `QA_RUNTIME` or `QA_CHROME` for a different preview URL, dependency directory or Chrome executable. Browser evidence is written under `artifacts/qa/content-update-2026-11-05/`. The HTTP preview disables inquiry submission. Use the strict HTTPS preview for intake tests.

Run `QA_BASE_URL=http://127.0.0.1:4173 npm run test:studio:browser` against the same preview for the multi-page design. Browser QA uses the installed Chrome executable and software WebGL. It does not certify physical-device performance, assistive-technology behavior or email delivery.

Run `QA_BASE_URL=http://127.0.0.1:4173 npm run test:system:browser` against the same preview for Daybook. `QA_LAB_FILTER` and `QA_STUDIO_FILTER` select a named case; `QA_LAB_OUTPUT` and `QA_STUDIO_OUTPUT` select evidence folders. The redesign plan and verification record are in `docs/plans/living-system-redesign-2026-11-06.md` and `docs/reviews/living-system-verification-2026-11-06.md`.

## Documentation and language

Project documentation, code comments, prototype UI and test descriptions are English. Unicode coverage remains in tests through accented characters and emoji. `npm test` rejects accidental Cyrillic text in maintained project files; immutable Git history and installed dependencies are outside that check.

Use the [website design reference](docs/website-design-research.md) for mobile and desktop design reviews and the [website mapping reference](docs/website-mapping-research.md) for navigation and user journeys.

Start with the [organization plan](docs/plans/repository-organization.md), [Starworld QA history](docs/reviews/starworld-qa.md), [engineering plan](docs/plans/engineering-console.md) or [roadmap](docs/roadmap.md). Historical audit numbers and deferred device checks remain labeled with their original dates. The historical hash fixture is not rewritten to imply a new original baseline.

## Local publishing checkout

`deploy/starworld/` retains the pre-existing nested Git repository and `.openai/hosting.json` identity. Local build/package commands only refresh files; they do not commit, push, upload or deploy. Follow the existing publication authorization separately when a hosted release is requested.

The standalone HTML can also be opened directly from disk. The current brief stays in page memory and can be saved locally. Inquiry submission requires the protected HTTPS deployment.
