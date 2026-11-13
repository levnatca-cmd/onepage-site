# Test suites

The workspace keeps its maintained tests here. Browser captures and generated QA reports live under `artifacts/qa/`.

| Folder                        | What it covers                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Unit](unit/)                 | Theme selection and Daybook booking, replay and privacy logic.                                                                   |
| [Functional](functional/)     | Browser journeys for Studio, Galaxy, Starworld and Daybook, plus focused interaction tests for Starworld holograms. |
| [Verification](verification/) | Routes, markup, content, 3D scene contracts, assets and the UI/UX audit.                                                         |
| [Support](support/)           | Shared browser configuration and local Starworld diagnostics.                                                                    |
| [Fixtures](fixtures/)         | Historical Starworld file hashes used as a reference.                                                                            |

## Run from the repository root

| Command                                                                                                               | Suite                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm test`                                                                                                            | Default LEVNAT checks, including unit tests and Starworld hologram tests.      |
| `npm run test:start`                                                                                                  | Theme selection unit tests only.                                               |
| `npm run test:galaxy`, `npm run test:starworld`, `npm run test:content`, `npm run test:studio`, `npm run test:system` | Individual LEVNAT suites.                                                      |
| `npm run qa:starworld`                                                                                                | Generates local diagnostic pages.                                              |

For browser tests, build the site and start `npm run dev`. In another terminal, run the desired command with the preview URL.

```sh
export QA_BASE_URL=http://127.0.0.1:4173
npm run test:galaxy:browser
npm run test:studio:browser
npm run test:content:browser
npm run test:system:browser
npm run qa:uiux
```

Browser tests use Chrome and a separate Playwright runtime. Setup and runtime overrides are documented in the [project README](../README.md#commands).

The Galaxy browser suite covers 320 and 390 px mobile viewports, both layouts, live focus and simulation effects, rendered PQC packet motion, and touch navigation. Failures save a screenshot under `artifacts/qa/galaxy/`.
