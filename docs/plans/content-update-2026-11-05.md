# Content update and regression checks - November 5, 2026

Status: scoped content implementation complete. Verification and explicit limits are recorded in [the follow-up review](../reviews/content-update-verification-2026-11-05.md).

Scope: apply the content review to Galaxy and Starworld, including metadata, visible copy, questionnaire mirrors, result/share/export/email text and appropriate regression tests. Keep published prices, service IDs and the current 3D interaction. The wider UI/UX redesign, persistence, outcome rebalancing and scene framing remain separate work.

## Premortem

Assume the copy update shipped and failed.

| Failure                                                                           | Probability | Impact | Detection                                                                                                   | Prevention                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML and 3D questions disagree or changed labels misrepresent old values          | High        | High   | Parse HTML and compare every prompt/value/label against QUESTION_FLOW; exercise a new-project path          | Update both mirrors together, retain answer meanings and IDs, test their pairing                                                                                                      |
| Old diagnostic/repair promises remain in generated shares, downloads or metadata  | High        | High   | Content contracts plus browser download/draft/share checks                                                  | Update all authored output paths and regenerate Starworld; describe progress rather than measured health                                                                              |
| New wording promises services, deadlines or support terms not agreed by the owner | Medium      | High   | Compare offers and prices before/after                                                                      | Preserve prices and existing scope; describe scope/response terms as agreed rather than inventing commitments                                                                         |
| Longer English breaks mobile headings, CTA buttons or scene labels                | High        | Medium | Desktop/mobile screenshots and overflow/geometry checks                                                     | Use concise labels, responsive fixed typography breakpoints where needed, and verify 320/390/1440 widths                                                                              |
| A new project still has no sensible response in a fault-oriented questionnaire    | High        | High   | Complete a website planning path from form and 3D choices                                                   | Make planning an explicit option within the existing architecture answer, use neutral clarity/priorities prompts, do not paste an incompatible five-question redesign onto old values |
| Inquiry text and exported summary disagree or omit selected choices               | Medium      | High   | Pure summary tests with partial/complete answers and Unicode, plus actual browser draft/download assertions | Use shared pure summary formatting for generated text and include the actual choices                                                                                                  |
| Generated Starworld output is stale or the existing dirty tree is overwritten     | Medium      | High   | Build integrity tests and changed-file review                                                               | Edit source ownership only, run the established build, preserve unrelated changes                                                                                                     |

## Revised sequence

1. Update root content/metadata, question mirrors, archetype copy and truthful progress/action labels.
2. Consolidate generated project-summary/share wording and include choices/optional notes without claiming a full technical plan.
3. Align Starworld's website/support descriptions and individual voice; preserve service IDs and existing email disclosure; rebuild generated outputs.
4. Add structured content/summary regression tests, run all repository/scene/service tests, then exercise rendered desktop/mobile and output journeys.
5. Record verified/deferred checks. Do not claim wider audit defects were fixed by copy changes.

## Acceptance gates

- [x] HTML and QUESTION_FLOW prompts/labels/values match, and a planning-first project path is answerable.
- [x] Visible copy, metadata and generated output avoid stability/diagnosis or completed-repair claims.
- [x] Email actions describe draft creation and distinguish project inquiries from a paid session request.
- [x] Existing prices and service IDs remain unchanged; commercial limits do not invent hours, SLAs or credentials.
- [x] Summary, share and download tests cover actual answers, empty/partial state and Unicode notes.
- [x] Generated Starworld and local packaging match authored source.
- [x] Desktop/mobile screenshots show readable headings/actions and no horizontal overflow introduced by copy.
- [x] Full automated checks pass; actual-device/AT/email-client verification is explicitly deferred if unavailable.
