# Three procedural card systems

This directory contains three complete, editable card systems for Good
Connections. Each system renders all 81 combinations of count, colour, shape,
and fill from one Typst source. The AI-generated PNGs in `concepts/` are mood
boards only; neither the app nor the final vector deck loads them.

## What the existing game does

Good Connections is a fixed-board implementation of the pattern game Set. A
deck has 81 cards because it is the Cartesian product of four three-valued
attributes:

- count: one, two, or three
- colour: red, green, or purple
- shape: diamond, squiggle, or oval
- fill: solid, horizontally striped, or open

The game deals 12 cards. Mode A rejection-samples a board with exactly six
sets; Mode B deals an ordinary board with at least one set and hides the total.
The player finds every set on the unchanged board while the app records solve
telemetry.

The original cards were already procedural. `src/ui/Card.tsx` generated every
card as inline SVG from the four attributes. `docs/reference-cards.jpg` and
`docs/correct-squiggle.jpeg` are design references, not runtime assets. There
was no bitmap deck, sprite sheet, or per-card artwork to replace.

## Themes

| Theme | Visual language | Small-screen priorities |
| --- | --- | --- |
| Nocturne | Frosted obsidian, restrained celestial instrument lines, spectral edge | Bright silhouettes, quiet orbit detail, no glow filters |
| Atelier | Warm cotton stock, letterpress ink, double rules, blind-embossed corners | High contrast, sparse paper stipple, tiny print offset |
| Signal | Satin porcelain, Swiss/Bauhaus geometry, registration marks, offset echo | Maximum scan speed, decoration confined to corner safe zones |

Classic remains available in the app and remains the default. The three new
systems are selected from the menu and persisted locally.

## Vector source of truth

`card-themes.typ` contains:

- one canonical Bézier path per symbol silhouette;
- one clipped horizontal-stripe algorithm;
- three colour palettes and three frame/material systems;
- a 12-card design-review board;
- a complete 81-card contact sheet; and
- an exact single-card export mode.

All gradients, dots, hatching, offsets, borders, and ornaments are vector
operations. There are no texture bitmaps, fonts on card faces, or generated
image dependencies.

Render every review board and complete deck:

```sh
./design/card-themes/render.sh
```

Render one editable SVG card:

```sh
typst compile \
  --input theme=nocturne \
  --input view=card \
  --input count=3 \
  --input colour=2 \
  --input shape=1 \
  --input fill=1 \
  design/card-themes/card-themes.typ card.svg
```

`count` is 1–3. `colour`, `shape`, and `fill` use the game model's 0–2
encoding. Change any palette, path, or frame token in the Typst source and
rerun the renderer; all dependent cards update together.

## Review notes

The generated mood boards were treated as art direction, not geometry to
trace blindly. The final vectors intentionally remove Nocturne's tiny
starbursts, normalize Atelier's shape silhouettes, and shrink Signal's corner
arcs so they never collide with three-symbol cards. The hero sheets and all
three 81-card contact sheets were visually inspected after rendering.

The runtime implementation mirrors the same dimensions, paths, colours, and
safe zones in `src/ui/Card.tsx`. This preserves the existing zero-network,
zero-card-asset rendering model and keeps selection outlines independent of
the colours that encode gameplay.
