# DeepBook local snapshot

Local copy of the Webflow edition linked by [Awwwards](https://www.awwwards.com/sites/deepbook).
Source: https://deepbook-v2-wip.webflow.io/.
The public deepbook.tech domain now redirects to a different site at deepbook.xyz.

## Open

Current preview: http://127.0.0.1:4180/

To serve this folder independently, run from the workspace root:

```sh
node deepbook/tools/serve.mjs
```

Then open http://127.0.0.1:4180/. The dedicated server preserves the original paths,
including `/builder-hub`, `/trader-hub`, `/deep-token`, and `/points` without redirects.
Use HTTP for animations loaded as JavaScript modules.

## Contents

- `index.html`: Home.
- `builder-hub/`, `trader-hub/`, `deep-token/`, `points/`: Product pages.
- `privacy-policy/`, `terms-of-use/`: Legal pages.
- `assets/`: Local CSS, JavaScript, fonts, images, and Lottie animations.
- `source/pages/`: Unmodified downloaded HTML.
- `source/assets/`: Unmodified downloaded CSS, JavaScript, and animation JSON.
- `mirror-manifest.json`: Source-to-local resource inventory and download status.
- `qa/`: Resource checks and browser verification captures.
- `tools/mirror.mjs`: Repeat the capture using the workspace's `parse5` dependency.
- `tools/check.mjs`: Check local page links, resources, CSS fonts, and Lottie image dependencies.
- `tools/serve.mjs`: Serve this folder as the root site using the original page routes.

```sh
node deepbook/tools/mirror.mjs
node deepbook/tools/check.mjs
```

The mirror reuses the saved source files. Add `--refresh` to download a fresh snapshot.

## Local adjustments

The original HTML is preserved with targeted URL/head edits, without reserializing its
SVGs, embedded styles, text, or markup. Page routes retain their original root-relative
paths. Asset URLs and Slater animation module imports resolve to local files.
Analytics, domain verification, and the remote Google WebFont loader are removed.
Inter font CSS and font files are local. Snapshots carry `noindex,nofollow` metadata.
The Webflow domain setting is local so its runtime preserves the original badge-free rendering.

External destinations (documentation, trading apps, waitlist, social channels, media kit,
and audit reports) remain external links. Those services and the original backend are
not part of this static snapshot. This folder contains the public frontend, not the
original Webflow editor project. Original branding and assets retain their ownership.
