# LEVNAT / Systems Engineering websites

## Repository map

```text
onepage-site/
├── website/                          LEVNAT, Galaxy, and Daybook
│   ├── pages/                        Files served at the public site root
│   │   ├── index.html                Startup page and device-theme selection
│   │   ├── explore.html              Generated dark Galaxy
│   │   ├── home/index.html           Generated light Galaxy
│   │   ├── starworld.html            Legacy address that opens Galaxy
│   │   ├── services/                 Overview and service pages
│   │   │   ├── index.html
│   │   │   ├── automation/
│   │   │   ├── backend-api/
│   │   │   ├── data-logs/
│   │   │   ├── hardware/
│   │   │   ├── integrations/
│   │   │   ├── monitoring/
│   │   │   ├── post-quantum-security/
│   │   │   ├── support/
│   │   │   └── websites-apps/
│   │   ├── work/                     Portfolio, Daybook case and demo
│   │   │   ├── index.html
│   │   │   └── daybook/
│   │   │       ├── index.html
│   │   │       └── demo/index.html
│   │   ├── approach/index.html        Delivery process
│   │   ├── contact/index.html         Inquiry page
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   ├── src/                          Authored website and inquiry code
│   │   ├── galaxy/
│   │   │   ├── index.html            Template for both Galaxy themes
│   │   │   ├── js/
│   │   │   │   ├── data/             Service and scene definitions
│   │   │   │   └── scene/            Geometry, motion and service models
│   │   │   └── styles/               Layout, typography and themes
│   │   ├── studio/
│   │   │   ├── pages.js              Studio page content
│   │   │   ├── app.js                Navigation and demo interactions
│   │   │   ├── scene.js              Interactive Three.js modules
│   │   │   ├── styles.css
│   │   │   ├── living-system.css
│   │   │   └── lab/                  Daybook state and UI
│   │   ├── shared/                   Service catalog and inquiry client
│   │   └── server/                   Private inquiry handler and storage
│   ├── assets/
│   │   ├── images/                   Favicon and service illustrations
│   │   ├── fonts/                    Local fonts and licenses
│   │   └── concepts/system-galaxy/   Model references and specifications
│   ├── vendor/
│   │   ├── lucide/                   Generated subset of icons
│   │   └── three/                    Retained Three.js distribution
│   └── prototypes/
│       ├── galaxy-model-review/      Model and component inspection
│       └── pqc-motion/               Post-quantum motion studies
├── projects/
│   └── deepbook/                     Independent DeepBook static mirror
│       ├── assets/                   Assets used by the mirror
│       ├── local/                    Local browser helpers
│       ├── qa/                       DeepBook verification records
│       ├── source/                   Captured upstream pages and assets
│       ├── tests/                    DeepBook checks
│       ├── tools/                    Mirror, patch and preview scripts
│       └── index.html                Mirror entry point
├── tooling/
│   ├── scripts/                      Main site build, packaging and preview
│   │   └── lib/                      Paths and source loading
│   └── tests/
│       ├── unit/                     Theme, Daybook and inquiry checks
│       ├── functional/               Browser journeys and interaction checks
│       ├── verification/             Static contracts, paths and UI/UX audits
│       ├── support/                  Browser setup and diagnostic tools
│       ├── fixtures/                 Historical baselines
│       └── run.mjs                   Default main site test runner
├── deploy/
│   ├── pqc/                          HTTPS staging and deployment
│   └── starworld/                    Separate standalone publishing checkout
├── docs/
│   ├── architecture/                 Repository path migration map
│   ├── research/                     Reusable design and navigation research
│   ├── plans/                        Implementation plans and premortems
│   ├── reviews/                      Design reviews and verification records
│   ├── archive/                      Historical documentation
│   └── roadmap.md                    Product backlog
├── artifacts/
│   ├── screenshots/                  Captures grouped by experience
│   ├── qa/                           Generated local diagnostics
│   ├── build/                        Generated static bundles
│   ├── surveys/                      Design survey materials
│   └── archives/website/             Saved website exports
├── agent-rules/
│   ├── README.md                     Project planning and verification rules
│   ├── galaxy.md                     Current Galaxy workflow
│   └── archive/                      Historical agent instructions
├── .github/workflows/pages.yml        Static GitHub Pages publishing workflow
├── AGENTS.md                          Entry point for project agent rules
├── README.md                          Repository map and commands
├── package.json                       Root build, preview and test commands
└── package-lock.json                  Locked development dependencies
```

Repository paths and visitor URLs are distinct. The local server and public bundle expose the files in `website/pages/` at the site root.

| URL                                               | File in the repository                       | What to edit                                                              |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                               | `website/pages/index.html`                   | Startup markup and `website/src/studio/start-route.js`                    |
| `/home/`                                          | `website/pages/home/index.html`              | `website/src/galaxy/index.html` and `website/src/galaxy/styles/light.css` |
| `/explore.html`                                   | `website/pages/explore.html`                 | `website/src/galaxy/index.html`                                           |
| `/starworld.html`                                 | `website/pages/starworld.html`               | Legacy address handled by the Galaxy startup router                       |
| `/services/`, `/work/`, `/approach/`, `/contact/` | Matching folders under `website/pages/`      | `website/src/studio/pages.js` and the Studio build                        |
| `/work/daybook/demo/`                             | `website/pages/work/daybook/demo/index.html` | Studio page definition and `website/src/studio/lab/`                      |

## Quick start

Use Node.js 20 or newer and run these commands from the repository root.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open [the local preview](http://127.0.0.1:4173/). The startup page uses the device theme to select light or dark Galaxy. Open `/explore.html` directly for dark Galaxy. The Daybook demo is at `/work/daybook/demo/`. Stop the preview with Ctrl+C or set `PORT` to use a different port.

## Source ownership

- **Studio and Daybook.** Edit `website/src/studio/` and run `npm run build:studio`. The shared page shell is in `tooling/scripts/build-studio.mjs`. Daybook is an independent booking prototype using sample data. Booking records stay in page memory. Share links and PNG cards contain only public demo settings.
- **Galaxy.** Edit `website/src/galaxy/index.html` and its associated source files, then run `npm run build:studio` to regenerate both themes. The seven service identities and routes are in `website/src/shared/service-catalog.js`. Hardware references and specifications are in `website/assets/concepts/system-galaxy/`.
- **DeepBook.** The mirror has its own tools, sources and tests. Its usage and ownership are documented separately. [DeepBook guide](projects/deepbook/README.md)
- **Agent rules.** The root `AGENTS.md` points to the dedicated rules folder. [Project rules](agent-rules/README.md) · [Galaxy workflow](agent-rules/galaxy.md)

## Commands

| Command                 | Result                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| `npm run build`         | Generate Studio pages, both Galaxy themes and local icons                   |
| `npm run build:studio`  | Generate Studio pages, both Galaxy themes and local icons                   |
| `npm run dev`           | Serve the site locally on port 4173                                         |
| `npm run build:pages`   | Assemble a public bundle in a fresh folder under `artifacts/build/`         |
| `npm run build:pqc`     | Build the public bundle for the protected HTTPS server                      |
| `npm run dev:pqc`       | Start the configured protected HTTPS preview                                |
| `npm test`              | Run the main site unit and verification suites                              |
| `npm run test:galaxy`   | Verify scene contracts, service definitions, cache versions and asset paths |
| `npm run test:content`  | Verify form content, offers and all 16,807 summary combinations             |
| `npm run test:start`    | Verify device-theme routing                                                 |
| `npm run test:studio`   | Verify page metadata, routes, content and inquiry contracts                 |
| `npm run test:system`   | Verify Daybook booking, replay, privacy and controls                        |
| `npm run test:pqc`      | Verify the private intake, encryption, signatures and durable receipts      |
| `npm run test:deepbook` | Run DeepBook interaction and markup regression checks                       |
| `npm run qa:deepbook`   | Verify DeepBook routes and assets and regenerate its static report          |
| `npm run qa:uiux`       | Run the browser-based UI and UX audit                                       |
| `npm run format`        | Format the configured source, tools, tests and documentation                |
| `npm run format:check`  | Check formatting without writing files                                      |

Browser checks use an installed Chrome and a separate Playwright runtime. Install the runtime once, then keep `npm run dev` running while launching a browser suite from another terminal.

```sh
npm install --prefix /private/tmp/onepage-uiux-qa-runtime --no-audit --no-fund playwright pngjs @axe-core/playwright
QA_BASE_URL=http://127.0.0.1:4173 npm run test:galaxy:browser
```

Set `QA_BASE_URL`, `QA_RUNTIME`, or `QA_CHROME` to use a different preview, runtime directory, or browser executable. The test guide lists the remaining browser commands and output locations. [Test guide](tooling/tests/README.md)

## Hosting

Run `npm run build:pages` to export the public site into a fresh folder under `artifacts/build/`. To name the folder yourself, pass a new path such as `npm run build:pages -- artifacts/build/pages`. The local preview also serves the DeepBook mirror and review prototypes.

The GitHub Pages workflow runs on manual dispatch and deploys the public bundle when run from `main`. The first release using the new folder structure requires **Settings → Pages → Build and deployment → Source → GitHub Actions** in the GitHub repository. [Pages workflow](.github/workflows/pages.yml)

The protected inquiry API uses a separate Node.js intake process behind NGINX. Static hosting serves the pages. The protected HTTPS server also accepts and stores inquiries. [PQC staging and deployment](deploy/pqc/README.md)

The `deploy/starworld/` checkout has its own Git repository and hosting configuration, separate from the LEVNAT build.

## Documentation

Start with the [design research](docs/research/website-design-research.md), [navigation research](docs/research/website-mapping-research.md), [repository migration map](docs/architecture/refactor-paths.json), [Starworld QA history](docs/reviews/starworld-qa.md) or [roadmap](docs/roadmap.md). The [saved website export](artifacts/archives/website/README.md) contains the November 6 snapshot.

Project documentation, code comments, prototype UI and test descriptions use English. The tests retain Unicode coverage through accented characters and emoji.
