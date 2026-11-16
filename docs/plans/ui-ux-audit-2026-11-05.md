# UI/UX audit plan - November 5, 2026

## Request

English translation: "Assemble a QA team and carry out a comprehensive UI/UX evaluation."

Scope: the current Galaxy root site and the generated Starworld service map. Evaluation only; do not change product code, publish, send email, or overwrite historical reviews.

## Premortem

Assume the audit has failed and given the owner misleading confidence.

| Failure mode                                                                | Probability | Impact | Detection                                                    | Prevention                                                                                                 |
| --------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Reviewing an old build or the wrong entry point                             | High        | High   | Record entry URLs and build integrity checks                 | Inspect current ownership, test both root entries, retain historical reviews as history                    |
| Mistaking source review or a headless limitation for observed user behavior | High        | High   | Separate reproduced, source-only and deferred evidence       | Capture live browser state and screenshots; label software rendering and device limits                     |
| Missing mobile, keyboard or reduced-motion failures                         | Medium      | High   | Explicit viewport and input matrix                           | Check 320/390/768/1440 widths, keyboard, dialogs and reduced motion                                        |
| Impressive 3D hides a broken inquiry flow                                   | Medium      | High   | Complete questionnaire and multi-service brief journeys      | Verify result, export and email-draft contents without sending anything                                    |
| Reviewers duplicate work or contradict each other                           | Medium      | Medium | Consolidate independently produced findings against evidence | Assign disjoint review roles; deduplicate and reproduce critical findings                                  |
| Automated checks are reported as usability or WCAG certification            | High        | High   | Review report wording and coverage                           | Report heuristics as judgments and a11y scans as targeted checks; explicitly defer human/device testing    |
| QA changes the user's dirty worktree or publishes data                      | Low         | High   | Inspect git status and touched files                         | Write only new audit tooling/evidence/docs; no production edits, rebuild or deploy without a specific need |

## Revised execution plan

1. Establish current entry points, repository state, existing tests and browser tooling.
2. Delegate independent UX/conversion, accessibility and frontend quality reviews while the lead performs live browser QA.
3. Run existing contracts and build-integrity checks without rebuilding product output; capture desktop/mobile evidence and runtime diagnostics.
4. Exercise navigation, questionnaire/start/back/exit/result/reset, service selection, project brief, persistence, export, keyboard dialogs, reduced motion and WebGL failure recovery where feasible.
5. Reproduce and prioritize findings, score heuristic categories with an explicit rubric, and write a new report plus evidence index.

## Premortem-derived QA gates

- [x] Current Galaxy and Starworld entry points recorded; generated-output integrity checked.
- [x] Each finding labeled reproduced, source-only, heuristic or deferred.
- [x] Mobile/desktop, keyboard and reduced-motion checks completed or explicitly deferred.
- [x] Inquiry/result/brief flows completed or explicit failures recorded.
- [x] Independent reviews reconciled and duplicate findings removed.
- [x] No claims of WCAG certification, human usability testing or real-device coverage.
- [x] No product edits, publication, external messages or unrelated worktree changes.

Status: audit complete, not a product release approval. Evidence and explicit device/browser/assistive-technology limits are recorded in [the audit report](../reviews/ui-ux-audit-2026-11-05.md). The initial shared preview stopped externally; affected journeys were rerun against an audit-owned preview. Only new audit tooling/documentation and a package command were added. Product findings remain unresolved.
