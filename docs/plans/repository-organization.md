# Repository organization and English-language cleanup

Date: 2026-11-05. Preserve the existing behavior and uncommitted user work while making the repository navigable. Keep `/index.html` and `/starworld.html` entry URLs stable. This task organizes the current implementations; it does not add new business features or publish the site.

## Proposed hierarchy

- `src/galaxy/{js,styles}`: main site's existing modules and styles; root `index.html` remains its maintained entry.
- `src/starworld/{data,domain,scene,styles}`: service data, brief logic, scene code and authored CSS, with an HTML template and UI entry.
- `assets/images` and `vendor/three`: first-party images and the retained Three.js distribution.
- `scripts`: build, QA generation and local packaging tools.
- `tests/{galaxy,starworld,fixtures}`: existing contracts, focused repository-path/language validation and historical fixtures.
- `docs/{plans,reviews}`: project plans, review history and the translated QA report; root README documents commands and ownership.
- `prototypes/pqc-motion`: retained motion exploration and its preview, translated into English.
- `artifacts/{screenshots,qa}`: captured evidence and generated local diagnostics.
- `deploy/starworld`: the existing private publishing checkout, including its unchanged Site identity and nested Git metadata.

## Premortem before implementation

Assume the refactor has failed. The most likely failures are:

| Failure mode                                                                  | Probability | Impact | Detection                                                                                                          | Prevention and required QA                                                                                   |
| ----------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Moving files breaks CSS, module imports, favicon or vendor loading            | High        | High   | Resolve every local HTML/CSS/module reference; run both app contracts and HTTP/browser smoke checks when available | Keep entry URLs stable, update relative paths from actual destination directories, verify both apps          |
| Splitting Starworld changes scope/order or includes helpers twice             | Medium      | High   | Existing 128-combination, Unicode, geometry and HTML-script checks; compare service data/behavior                  | Concatenate explicit ordered source modules inside one existing closure; keep pure helpers independent       |
| Existing uncommitted work is lost or publishing identity changes              | Medium      | High   | Capture pre-move content hashes and path mapping; compare normalized unchanged files and nested Git/Site identity  | Move rather than recreate original app files; retain all assets/history; no Git reset/checkout or deployment |
| Translations alter animation behavior or remove non-ASCII testing             | Medium      | Medium | Scan every text file for Cyrillic, parse affected scripts and inspect multilingual test coverage                   | Translate prose/UI strings only; retain Unicode coverage with English text, accented characters and emoji    |
| Build/test commands silently depend on the old current directory              | High        | High   | Run documented commands from root and a different cwd; compare standalone/package bytes                            | Resolve files relative to script/module locations; add one root package command surface                      |
| Documents and local skill references still point to removed paths             | High        | Medium | Search old path names and validate current references                                                              | Update documentation and local skill maps, keep historical audit results explicitly historical               |
| Generated bundles, screenshots and diagnostic copies obscure source ownership | High        | Medium | Inspect final tree and ignore rules                                                                                | Document authored vs generated files; centralize artifacts; make generation deterministic                    |

## Required completion checks

1. Existing Galaxy contracts and Starworld contracts pass after relocation and splitting.
2. All local runtime module/asset references resolve; public root entry URLs remain available.
3. Starworld builds deterministically and local publishing copies match it; Site identity and Git metadata are preserved.
4. Cyrillic search returns no project prose, comments, UI strings or fixtures (excluding immutable Git history and binary assets).
5. README lists the real hierarchy and reproducible commands; old path references are updated or explicitly historical.
6. Record any browser/environment verification limitation accurately; do not claim unperformed tests.

## Verification outcomes

Completed on 2026-11-05.

- Preserved the root `index.html` and `starworld.html` URLs. Both pages were opened in the live browser after migration.
- All repository path/language/source-ownership checks pass, along with 9 Galaxy contracts and 14 Starworld checks covering all 128 service subsets.
- Build and the complete test runner also pass when invoked by absolute path from `/tmp`.
- Verified 32 main-site, asset, vendor, Site-identity and historical-baseline files against the pre-refactor snapshot. Only the documented module/asset URL substitutions differ; substantive main-site content and the historical hash fixture are preserved.
- The standalone build is deterministic; both local publishing HTML copies match the generated root file. The publishing builder uses only its own checkout files and works from another current directory.
- Starworld now has six ordered JavaScript fragments and four readable CSS layers. Its shared private closure, stable service IDs, notes logic, settings and actual Three.js scene remain functional.
- Translated the complete QA report, both PQC motion files (including escaped preview content), two test fixtures and both local skill descriptions into English. Updated relocated source/tool references. The project-language check finds no Cyrillic outside immutable Git history and installed dependencies.
- Browser smoke verification: Galaxy loads the new module path, applies its styles, initializes a canvas, and updates answer progress from 0/5 to 1/5. Starworld loads the freshly assembled source, renders seven services, selects iOS and opens its named brief dialog with a valid email-draft link. Neither page reported console errors or warnings.
- Screenshots are retained in `artifacts/screenshots/refactor-galaxy.jpg` and `artifacts/screenshots/refactor-starworld.jpg`. The temporary Galaxy tab was closed; the existing Starworld tab was retained.
- The existing nested Git repository and Site identity were retained. No commit, push, upload, publication or email sending was performed.

The premortem-derived checks above are verified. A new physical-device, screen-reader or complete interaction audit was not required for this structural change; earlier device-specific limitations remain documented in the historical QA report.
