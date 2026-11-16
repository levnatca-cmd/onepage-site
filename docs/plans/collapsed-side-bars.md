# Collapsed service side bars

Date: 2026-11-08.

Collapse the service catalog and service overview into compact bars by default. Preserve the existing 3D scene, holographic windows and project-brief workflow. On phones, use compact horizontal bars so the canvas retains its available width.

## Premortem before implementation

Assume this change has failed after implementation.

| Likely failure                                                                   | Probability | Impact | Detection                                                              | Prevention and QA                                                                                                        |
| -------------------------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hidden controls receive keyboard focus or navigation opens an invisible overview | High        | High   | Exercise numeric selection, Explore, navigation and hologram details   | Open the overview before focusing it; keep focus outside a closed catalog; restore toggle focus when closing from within |
| Collapsed panels still occupy their previous width or reveal content             | Medium      | High   | Inspect initial desktop layout and actual hidden state                 | Use explicit hidden content wrappers, compact reserved columns and an expanded class; verify both initial states         |
| Bars or expanded panels overflow small screens or enlarged text                  | High        | High   | Inspect 320px, 390px and tablet layouts, plus 200% text                | Use horizontal mobile bars, wrapping labels and normal-flow content; check page/card overflow                            |
| New layout breaks hologram placement or camera gestures                          | Medium      | High   | Open holograms with both panels collapsed and expanded; orbit and zoom | Keep the existing scene untouched; retain the scene column and observed catalog envelope; inspect the smaller canvas row |
| Escape interferes with native dialogs or loses focus                             | Medium      | Medium | Exercise Escape from each panel and from settings/brief dialogs        | Keep the existing modal guard first; close only the panel containing the event target, with focus restoration            |
| Unrelated scene or project work changes                                          | Low         | High   | Compare scene hashes and review scoped diff                            | Edit only Starworld UI/layout, source assembly and this record; preserve unrelated DeepBook changes                      |

## Implementation sequence

1. Add compact, named toggle buttons and initially hidden wrappers to the existing catalog and overview containers.
2. Add a small shared disclosure controller with expanded state, focus restoration and scoped Escape. Integrate explicit overview navigation and preserve keyboard selection without opening the catalog unnecessarily.
3. Add a final stylesheet for compact desktop columns and horizontal mobile bars. Preserve all scene source files and existing service content.
4. Build and synchronize local standalone copies, run existing project checks and inspect actual browser layout/interactions. Record premortem-derived QA results below before completion.

## Scene baseline

```text
caebc1e9fc0fad42b846115313488b4055c122482a3c5a081b1d94460bcb21c4  scene/geometry.js
d8e0786e729a6050d8e114291787f2a4040e1269a78317b5010d48a31f57b828  scene/glyph-field.js
26c5526512873b9fa26cdf66a86e9b40fe4608d6692425928ef1824f60d93108  scene/label-layout.js
70c6f3499a420a8891b71fcbc106a4d73d0fc8285908a1bb5792299fcac9dbf5  scene/service-map.js
```

## Verification outcomes

Completed on 2026-11-08.

- Both content wrappers are initially hidden and absent from the visible accessibility tree. At the 1265px desktop test width, the catalog and overview reserve only 52px each when collapsed. The existing quick-control rail is also compact. Both disclosures expose their expanded state and retain all service content.
- Verified pointer and keyboard opening/closing, all seven catalog choices, numeric selection with the catalog closed, and scoped Escape with focus restoration. Numeric selection keeps canvas focus rather than focusing a hidden service button.
- Verified automatic overview expansion through navigation, Explore, the hologram View details action and the keyboard skip link. The project brief remains available; closing its native dialog leaves the surrounding panel open. Settings Escape closes the native dialog without dismissing the holograms.
- Fixed hologram focus restoration when its original opener belongs to a subsequently collapsed catalog. The browser returns focus to the visible hologram toggle, and a new regression exercises that exact case.
- Inspected open and closed panels at 320px, 390px, 800px, 900px and 1265px, with holograms visible. Neither the page nor the hologram cards overflow horizontally. At 900px the catalog scrolls inside its fixed 450px row instead of covering lower controls. Phones use horizontal bars and retain the 330px canvas height.
- Checked 200% root text at 320px, 900px and 1265px in both panel states without horizontal page overflow. Corrected vertical label sizing found during desktop browser verification.
- Verified actual core clicking, exposed-canvas orbit, zoom and reset with both side panels collapsed. Holograms still open while the side bars stay closed. The no-WebGL diagnostic page supports catalog selection and automatic overview expansion without overflow.
- All four scene source hashes match the baseline. No model, shader, camera, picking or scene source was changed. Layout resizing uses the existing renderer resize behavior.
- The full `npm test` suite passed, including eight hologram controller checks and the existing 15 Starworld checks. Authored changes pass formatting and whitespace checks; standalone and local packaging copies match. The regular preview reported no browser console errors.
- Saved `artifacts/screenshots/starworld/collapsed-side-bars-desktop.jpg` and `artifacts/screenshots/starworld/collapsed-side-bars.jpg`. Returned the existing preview tab to the main page with both panels collapsed, an empty brief and the original viewport restored.

All premortem-derived checks were verified. A full accessibility audit, physical-device performance and other browser engines are explicitly deferred; this task received targeted interaction and responsive verification. No publication or commit was requested or performed.
