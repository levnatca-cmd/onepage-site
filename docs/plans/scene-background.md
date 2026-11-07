# Replace the flat Matrix backdrop

Date: 2026-11-05. The visible rectangular glyph wall breaks the depth of the service map. Replace it with a sparse, camera-surrounding 3D field of glyphs, preserving the existing Digital rain control, pause/reduced-motion behavior, service picking and the current color direction.

## Premortem before implementation

| Assumed failure                                                   | Probability | Impact | Detection                                                             | Prevention / QA                                                                                                  |
| ----------------------------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The new background still exposes edges while orbiting or resizing | High        | High   | Inspect wide/narrow views and camera rotation                         | Distribute glyphs around the entire scene on a distant spherical shell; no backdrop plane                        |
| Glyphs cover service models, labels or controls                   | Medium      | High   | Inspect readability and picking in the browser                        | Keep glyphs outside the camera/model bounds, use low opacity and normal depth testing; exclude them from picking |
| Added draw calls or texture loads hurt responsiveness             | Medium      | Medium | Review resource count and dependency checks                           | One Points object, one small generated atlas, no external assets, shader-based motion                            |
| Toggle, pause or reduced motion becomes misleading                | Medium      | Medium | Exercise settings and pause in the browser                            | Use the existing enabled state and frozen scene time; disable background movement under reduced motion           |
| Shader/atlas or resize mistakes leave a broken/blank scene        | Medium      | High   | Parse shaders/build, check real browser errors and inspect the result | Isolate field creation/update/disposal, constrain point sizes, retain useful WebGL fallback                      |

## Completion checklist

- The flat glyph plane is removed and no replacement rectangle is visible.
- Background covers supported camera directions and responsive scene shapes.
- Digital rain toggle, paused/reduced motion and service controls remain useful.
- Existing repository, Galaxy and Starworld checks pass; packaging copies match.
- Browser screenshots and limitations are recorded accurately.

## Verification outcomes

Completed on 2026-11-05.

- Removed the opaque rectangular glyph texture and its backdrop plane.
- Added `scene/glyph-field.js`: 768 transparent glyph sprites distributed through all eight spatial octants on a distant shell, with one generated atlas and one Points object. There are no external resources or square background tiles.
- Added a geometric regression covering the actual non-normalized camera envelope, the 180-unit far plane, bounded drift, atlas indices and full spatial coverage. All 15 Starworld checks, 9 Galaxy contracts and repository checks pass.
- Live browser verification confirmed successful WebGL shader compilation with no console errors/warnings, a working 3D map, desktop orbit and maximum zoom-out, and a 375 px mobile layout without horizontal overflow. No rectangular background edge was visible in the inspected views.
- Checked the Digital rain toggle, reduced-motion setting, pause/resume and service selection while paused. The animation clock is gated by visibility and motion state, preserving the last background pose. Initial settings and the normal viewport were restored.
- Independent source review found no new shader, geometry, picking, motion or disposal regression. The new texture, material and geometry are explicitly disposed.
- Final screenshot: `artifacts/screenshots/spatial-glyph-background.jpg`. The existing preview tab was refreshed and retained; local package copies match the standalone HTML.

This is a targeted background/rendering check. Physical-device performance and a new full accessibility audit were not performed.
