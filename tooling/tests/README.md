# Test suites

LEVNAT tests live here, with browser captures and generated reports under [`artifacts/qa/`](../../artifacts/qa/). [DeepBook tests](../../projects/deepbook/tests/) and their [reports](../../projects/deepbook/qa/) live alongside the snapshot.

| Folder                        | What it covers                                                           |
| ----------------------------- | ------------------------------------------------------------------------ |
| [Unit](unit/)                 | Theme selection and Daybook booking, replay and privacy logic.           |
| [Functional](functional/)     | Browser journeys for Studio, Galaxy and Daybook.                         |
| [Verification](verification/) | Routes, markup, content, 3D scene contracts, assets and the UI/UX audit. |
| [Support](support/)           | Shared browser configuration, deployment checks and route definitions.   |

## Run from the repository root

| Command                                                                                     | Suite                                                                                   |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm test`                                                                                  | Default LEVNAT checks, including unit tests.                                            |
| `npm run test:start`                                                                        | Theme selection unit tests only.                                                        |
| `npm run test:galaxy`, `npm run test:content`, `npm run test:studio`, `npm run test:system` | Individual LEVNAT suites.                                                               |
| `npm run test:deepbook`                                                                     | DeepBook regression tests.                                                              |
| `npm run qa:deepbook`                                                                       | Static asset and link verification. Refreshes `projects/deepbook/qa/static-check.json`. |

For browser tests, build the site and start `npm run dev`. In another terminal, run the desired command with the preview URL.

```sh
export QA_BASE_URL=http://127.0.0.1:4173
npm run test:galaxy:browser
npm run test:studio:browser
npm run test:content:browser
npm run test:system:browser
npm run qa:uiux
```

Browser tests use Chrome and a separate Playwright runtime. Setup and runtime overrides are documented in the [project README](../../README.md#commands).

The Galaxy browser suite covers 320 and 390 px mobile viewports, both layouts, live focus and simulation effects, rendered PQC packet motion, and touch navigation. Failures save a screenshot under `artifacts/qa/galaxy/`.
