# Saved LEVNAT website

Updated on November 6, 2026. This folder contains the complete source and the ready-built nine-page website, including the interactive Daybook prototype, local fonts, icons, Three.js, Galaxy and Starworld.

## Preview

From this folder, run:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173/. If that port is occupied:

```sh
PORT=4176 node scripts/serve.mjs
```

Open http://127.0.0.1:4176/. Node.js 20 or newer is required. No dependency installation is needed to preview the already-built pages. Serve this folder as the website root; opening index.html directly or hosting it as a nested URL is not supported by its module and asset paths.

## Edit and rebuild

```sh
npm ci
npm run build
npm test
```

Edit page content in `src/studio/pages.js`, appearance in `src/studio/living-system.css`, product behavior in `src/studio/lab/` and the connected 3D system in `src/studio/scene.js`. The generated HTML pages are not the source of truth.

Daybook is an independent local simulation. Build the app, connect its simulated API, book a sample slot, introduce an outage and repair the queue. No real appointment, API call, device or payment is involved. Booking records are memory-only; share links and PNG cards contain public settings rather than names or contact drafts. The case is at `/work/daybook/`.

This is a local snapshot, not an external publication. Git history, installed dependencies, QA captures and deployment metadata or credentials are intentionally excluded. The build may create local Starworld packaging copies; it does not publish them. The reference brief is preserved as `DEVELOPER-WEBSITE-TRAITS.md`; verification limits are recorded in `docs/reviews/living-system-verification-2026-11-06.md`.
