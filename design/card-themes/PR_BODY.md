## Summary

- add three complete procedural SVG card themes: Nocturne, Atelier, and Signal
- add a compact menu picker and persist the chosen style in local storage
- retain Classic as the unchanged default renderer
- add editable Typst masters, 12-card review boards, and full 81-card sheets
- include the image-generation prompts and concept boards as design provenance

The gameplay model is unchanged. Count, colour, shape, and fill are still the
only card inputs, and all 81 cards in every theme come from the same React SVG
component. No concept image is loaded at runtime.

## Design constraints

- one canonical silhouette per shape in every premium theme
- solid, clipped horizontal-stripe, and open treatments share that silhouette
- card footprint remains 190:140 at every count
- selection remains a non-colour-dependent outline/lift treatment
- decorative geometry stays outside the three-symbol safe zone

## Test plan

- `npm test -- --run` — 50 tests pass
- `npm run build` — strict TypeScript and production Vite build pass
- `./design/card-themes/render.sh` — all hero and 81-card vector sheets render
- visually reviewed all three generated concept boards, Typst hero boards, and
  all 243 cards on the complete-deck sheets

## Review images

- `design/card-themes/rendered/nocturne-hero.png`
- `design/card-themes/rendered/atelier-hero.png`
- `design/card-themes/rendered/signal-hero.png`

The Typst source and exact regeneration commands are documented in
`design/card-themes/README.md`.
