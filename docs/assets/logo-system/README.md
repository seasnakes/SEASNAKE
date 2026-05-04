# SEASNAKE Logo System Assets

Master SVGs live in `svg/` and are the source of truth:

- `seasnake-logo-snake.svg`
- `seasnake-logo-triangle.svg`
- `seasnake-logo-wordmark-horizontal.svg`
- `seasnake-logo-snake-two-row.svg`

The snake mark keeps the original stroke geometry at `32`, with the upper-right folded head segment split into two paths so the return stroke no longer overlaps the head stroke and creates a double-thick wedge. The two-row combo uses the same top/bottom angled clipping masks as `../snakelogo-双排.svg`.

Standard preview/export sizes are in `svg/sized/` and `png/`.

Use the master SVGs when possible. PNGs are transparent exports for environments that cannot render SVG cleanly.
