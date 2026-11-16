# Holographic service windows

Date: 2026-11-07.

Preserve the current Starworld scene exactly. Add an HTML interface layer that presents the existing sphere as a conceptual quantum computer: selecting the core or a service projects readable holographic windows. Keep all service content in English and retain the existing project-brief workflow.

## Premortem before implementation

Assume the interface has failed after implementation.

| Likely failure                                                   | Probability | Impact | Detection                                                  | Prevention and required QA                                                                                                                        |
| ---------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The existing scene, camera, models or initial view changes       | Medium      | High   | Compare scene source hashes and inspect the closed state   | Do not edit any scene files or service geometry/data; keep windows closed initially; verify all four original scene hashes                        |
| Panels intercept orbit gestures or cover camera controls         | High        | High   | Drag exposed canvas, zoom and reset with windows open      | Use a separate noninteractive projection layer with interactive cards only; reserve the right control strip; verify desktop interaction           |
| Panels hide the sphere or overflow on phones and enlarged text   | High        | High   | Inspect 320px, 390px, tablet and desktop layouts           | Use floating panels only where space permits; put panels in normal flow below the unchanged canvas on narrower layouts; check horizontal overflow |
| Keyboard selection steals focus or closing loses it              | Medium      | High   | Exercise selection, toggle, Tab, Escape and native dialogs | Use a named nonmodal region, an explicit expanded-state toggle, no automatic focus on selection, and close restoration only when focus was inside |
| Decorative motion ignores pause or reduced-motion settings       | Medium      | Medium | Inspect computed animations while paused and reduced       | Use one short opening animation, no persistent flicker; connect to existing pause/reduced classes and media query                                 |
| Holograms show stale services or suggest real quantum operations | Medium      | Medium | Select all seven services and inspect their content        | Render existing service records; label the interface conceptual; avoid fabricated telemetry or runtime security claims                            |
| Fallback or brief behavior breaks                                | Medium      | High   | Test the interface without WebGL and add/remove scope      | Keep overlay independent from renderer availability; reuse existing selection and brief handlers; verify generated standalone parity              |

## Implementation sequence

1. Record scene hashes and preserve the source boundary. Add a dedicated hologram content/controller fragment and stylesheet; register both in the standalone assembly.
2. Add a discoverable open/close control and a named nonmodal window group. Render a service window and supporting architecture/scope windows from the existing service records. Connect selection through the existing UI handler without editing the scene.
3. Add projection styling and a brief opening transition. Keep small layouts in normal flow and respect all existing motion preferences.
4. Run focused behavior checks, the project checks and build/package parity. Verify actual browser selection, canvas orbit, keyboard/focus, mobile layouts, reduced motion, pause and fallback. Record results and remaining limitations below.

## Scene baseline

SHA-256 before implementation:

```text
caebc1e9fc0fad42b846115313488b4055c122482a3c5a081b1d94460bcb21c4  scene/geometry.js
d8e0786e729a6050d8e114291787f2a4040e1269a78317b5010d48a31f57b828  scene/glyph-field.js
26c5526512873b9fa26cdf66a86e9b40fe4608d6692425928ef1824f60d93108  scene/label-layout.js
70c6f3499a420a8891b71fcbc106a4d73d0fc8285908a1bb5792299fcac9dbf5  scene/service-map.js
```

## Verification outcomes

Completed on 2026-11-07.

- All four scene hashes match the baseline above. Service data, models, shaders, camera, picking and existing scene styles were not edited. At the default preview width, the initial and open-state canvas both measured 633 × 644.109375 CSS pixels. Initial windows remain closed.
- Added a dedicated HTML controller and stylesheet. Core raycast clicks, all seven service buttons and numeric selection open two windows with the existing service descriptions and deliverables. The H shortcut and explicit toggle also open them; Escape and the close button dismiss them.
- Verified actual core picking, exposed-canvas orbit, zoom and camera reset with windows open. Decorative projection beams do not intercept pointer input. The panels stay within the scene row and leave the camera controls available.
- Verified all seven service titles and their three deliverables in the browser. Window actions add and remove the same scope as the main brief controls. View details focuses the existing service overview.
- Verified Tab navigation, explicit opening, close focus restoration and selection without focus stealing. Escape closes an active native settings dialog before affecting the holograms. Explicit open/close now lets the browser reveal the focused control instead of retaining offscreen focus.
- Verified the existing reduced-motion setting and pause: both disable the opening transition while keeping newly opened windows readable and actionable. There is no repeating hologram animation.
- Inspected 320px, 390px and 800px layouts. Windows flow beneath the canvas, the phone canvas remains 330px high, and neither the page nor the cards have horizontal overflow. Also checked 200% root text at desktop and 320px width. Desktop panels use bounded internal scrolling for long enlarged content; their rectangles do not overlap.
- Verified the generated no-WebGL diagnostic page: windows are visually hidden initially, service selection opens populated windows, and closing returns to `display: none`. Corrected a fallback CSS specificity issue found during independent review. The regular preview reported no browser console errors.
- The full `npm test` suite passed, including seven new controller behavior checks and the existing 15 Starworld checks. After the final opening-animation adjustment, all 22 focused Starworld/controller checks passed again. Changed source files pass formatting checks, and generated standalone/local package copies match.
- Screenshot: `artifacts/screenshots/starworld/quantum-holographic-windows.jpg`. Browser viewport overrides and temporary preferences were reset. The preview was returned to the main Starworld page with the product windows open and an empty brief.

All premortem-derived checks above were verified. Physical-device performance, other browser engines and a full accessibility audit are explicitly deferred; this change received focused browser and controller verification. The quantum workspace remains a conceptual interface and introduces no quantum computation, remote monitoring or cryptographic runtime claims.
