# SEASNAKE VI System

Static brand manual and logo asset system for the SEASNAKE personal IP.

## Live Pages

- Preview entry: https://seasnakes.github.io/SEASNAKE/seasnake-logo-preview.html?from=vi
- Brand manual: https://seasnakes.github.io/SEASNAKE/seasnake-ouroboros-concepts.html
- Logo Export Studio: https://seasnakes.github.io/SEASNAKE/logo-export-studio.html

GitHub Pages publishes from `main` branch, `/docs`.

Pushes and pull requests run `.github/workflows/static-site-ci.yml`; successful pushes to `main` then use GitHub Pages' existing build-and-deployment workflow.

## Main Files

- `docs/seasnake-logo-preview.html` - animated VI entry page.
- `docs/seasnake-ouroboros-concepts.html` - full brand manual.
- `docs/logo-export-studio.html` - client-side batch recolor plus static and motion export studio.
- `docs/assets/logo-export-studio.js` - SVG recoloring, high-resolution PNG rasterization, and dependency-free ZIP packaging.
- `docs/assets/logo-motion-export.js` - browser-native MANUAL arrival and dynamic VI MP4 / WebM / GIF export.
- `docs/assets/gif-encoder.js` - dependency-free, local-only GIF frame encoding for shareable motion previews.
- `docs/assets/logo-system/svg/` - clean master SVG marks.
- `docs/assets/logo-system/png/` - transparent PNG exports.

## Current Defaults

- Default color role: `竹叶`.
- In the animated preview, the default stop is the middle position: scroll up to `青蓝`, scroll down to `赤练`.
- Color roles: `青蓝`, `竹叶`, `赤练`.
- Day mode uses explicit dark ink for key logos and text so mobile browsers do not wash the marks out through filter or transparency compositing.
- The manual keeps color switching live: active navigation, atmosphere panels, and banner details follow the selected role.
- The color and three-serpent story live together in the `三蛇色系` chapter.

## Asset Notes

- `Snake + two-row wordmark` is included in the size system and uses the same transparent presentation style as the other rows.
- Avatar and small-icon snake marks follow the selected role color.
- Replace files under `docs/assets/logo-system/svg/` when updating source logos; the manual references those assets directly where possible.
- The Export Studio processes everything in the browser. It does not upload logos or require a backend.
- Exported ZIPs use one folder per brand color, with separate `png/` and `svg/` folders when both formats are selected.
- The standard PNG set uses 512, 1024, 2048, and 4096 px widths; custom widths remain available up to 8192 px.

## Local Check

Open these files directly:

```text
file:///Users/seasnake/Documents/New%20project/docs/seasnake-logo-preview.html?from=vi
file:///Users/seasnake/Documents/New%20project/docs/seasnake-ouroboros-concepts.html?from=preview#top
```

After pushing, GitHub Pages may take a short moment to refresh. On mobile, force refresh if the old light-mode colors are still cached.

The Export Studio fetches the master SVG files, so use the GitHub Pages URL or a local static server instead of opening that page through `file://`.
