# Galaxy development workflow

Use this workflow for changes to the Galaxy scene, service identities, model behavior, and the controls that represent them. Follow the [project planning rules](README.md) before implementation.

## Source ownership

| Area                                                                 | Source                                                                                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored markup for both themes                                      | [Galaxy template](../website/src/galaxy/index.html)                                                                                                 |
| Browser runtime and interaction                                      | [Scene](../website/src/galaxy/js/galaxy.js), [main entry](../website/src/galaxy/js/main.js), and [styles](../website/src/galaxy/styles/)            |
| Seven service IDs, routes, and display names                         | [Shared service catalog](../website/src/shared/service-catalog.js)                                                                                  |
| Orbit parameters, scenario data, and archived questionnaire mappings | [Galaxy data](../website/src/galaxy/js/data/quiz-data.js)                                                                                           |
| Scene presentations and model builders                               | [Presentations](../website/src/galaxy/js/data/scene-presentations.js) and [builder registry](../website/src/galaxy/js/scene/system-models/index.js) |
| Generated visitor entry points                                       | [Dark Galaxy](../website/pages/explore.html) and [Light Galaxy](../website/pages/home/index.html)                                                   |

## Editing and verification

1. Locate the current markup and registries. Trace the affected service IDs across the catalog, scene data, model builders, and links. Keep those IDs stable unless the change calls for a migration.
2. Edit the authored template and shared sources. Preserve both theme routes and the HTML service links that work without WebGL. Change the archived questionnaire only when the task calls for it.
3. Run `npm run build:studio` to regenerate both Galaxy pages. Run `npm run test:galaxy` to verify the service IDs, scene contracts, and asset links.
4. For interaction changes, use `npm run test:galaxy:browser` against a running local preview. Check affected desktop and phone flows in the relevant layouts and themes. Browser setup is documented in the [test guide](../tooling/tests/README.md).
