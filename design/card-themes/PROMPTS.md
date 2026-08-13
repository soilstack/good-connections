# Image-generation prompts

These are the production prompts used to explore the three themes. The images
are visual references; the shipping card systems were rebuilt as deterministic
Typst and React SVG.

## Nocturne

```text
Use case: ui-mockup
Asset type: high-fidelity vector-friendly design board for a mobile pattern-card game
Primary request: Design a complete premium card visual system called “Nocturne”, shown as exactly twelve separate landscape cards in a perfectly aligned 4-column by 3-row grid.
Scene/backdrop: deep matte midnight-navy presentation surface, quiet and uncluttered
Subject: every card is a 190:140 landscape rounded rectangle, front-facing and identical in size. Across the twelve cards, demonstrate one, two, and three horizontally centered symbols; exactly three canonical symbol silhouettes: a tall slim diamond, a smooth vertical S-curved ribbon/squiggle, and a tall pill-shaped oval; exactly three fill treatments: fully solid, open outline, and evenly spaced horizontal stripes clipped cleanly inside the silhouette. Use three gameplay colors only: luminous coral-red, clear emerald-green, and electric violet-purple.
Style/medium: exceptional contemporary vector UI design; luxury astronomy-instrument aesthetic; frosted obsidian card faces; hairline orbital engraving; restrained spectral-foil edge; subtle inner glow and layered keylines that remain reproducible with vector gradients, strokes, clipping, and transparency
Composition/framing: orthographic flat front view, no perspective, no overlap, generous equal gutters, all twelve full cards visible; symbols large and instantly readable at mobile size
Lighting/mood: controlled nocturnal radiance, elegant and precise rather than flashy
Materials/textures: smooth black glass suggested only with clean vector gradients; very subtle star-map dots and orbital arcs confined to card borders, never behind or inside the main symbols
Constraints: preserve the exact game grammar; all copies of a given shape must have the same silhouette; fills must be unmistakably different; strong color contrast; polished accessibility-first UI; vector-friendly geometry; no photographic texture
Avoid: any text, letters, numbers, logos, watermark, playing-card suits, extra icon types, illustrations, gradients inside striped symbols, illegible tiny detail, tilted cards, perspective, hands, physical tabletop mockup
```

## Atelier

```text
Use case: ui-mockup
Asset type: high-fidelity vector-friendly design board for a mobile pattern-card game
Primary request: Design a complete premium card visual system called “Atelier”, shown as exactly twelve separate landscape cards in a perfectly aligned 4-column by 3-row grid.
Scene/backdrop: warm charcoal-neutral presentation surface, quiet museum-catalog styling
Subject: every card is a 190:140 landscape rounded rectangle, front-facing and identical in size. Across the twelve cards, demonstrate one, two, and three horizontally centered symbols; exactly three canonical symbol silhouettes: a tall slim diamond, a smooth vertical S-curved ribbon/squiggle, and a tall pill-shaped oval; exactly three fill treatments: fully solid, open outline, and evenly spaced horizontal stripes clipped cleanly inside the silhouette. Use three gameplay ink colors only: warm vermilion red, deep botanical green, and rich aubergine purple.
Style/medium: exceptional contemporary vector UI design inspired by fine letterpress stationery, bookbinding, and botanical specimen labels; warm cotton-paper card faces; restrained double-rule border; subtle blind-embossed botanical curves in the corners; rich ink with a tiny deliberate offset impression; timeless, tactile, editorial
Composition/framing: orthographic flat front view, no perspective, no overlap, generous equal gutters, all twelve full cards visible; symbols large and instantly readable at mobile size
Lighting/mood: soft gallery daylight, crafted and calm
Materials/textures: paper and letterpress suggested using sparse vector stipple, linework, shallow offset shadows, and flat color; no photographic fibers
Constraints: preserve the exact game grammar; all copies of a given shape must have the same silhouette; fills must be unmistakably different; strong color contrast; polished accessibility-first UI; every effect reproducible with vector paths, strokes, clipping, dots, and transparency
Avoid: any text, letters, numbers, logos, watermark, playing-card suits, extra icon types, literal flowers or leaf illustrations behind the symbols, noisy texture, illegible tiny detail, tilted cards, perspective, hands, physical tabletop mockup
```

The first Atelier concept drifted to portrait cards. This single-change edit
produced the retained reference:

```text
Use case: precise-object-edit
Input images: Image 1: the “Atelier” card-system concept board to correct
Primary request: change only the physical proportions and layout of the cards so every one of the twelve cards is a 190:140 landscape rounded rectangle, wider than tall, arranged in a perfectly aligned 4-column by 3-row grid on a 16:9 presentation canvas
Constraints: preserve the exact warm cotton-paper material, vermilion/deep-green/aubergine ink palette, double-rule borders, blind-embossed corner ornament, letterpress finish, canonical diamond/S-ribbon/pill silhouettes, counts, open/striped/solid fill treatments, orthographic front view, and equal gutters; keep all twelve cards fully visible; no perspective or overlap; no text, letters, numbers, logo, or watermark; do not add any new motifs
Avoid: portrait cards, square cards, physical tabletop perspective, cropped cards
```

## Signal

```text
Use case: ui-mockup
Asset type: high-fidelity vector-friendly design board for a mobile pattern-card game
Primary request: Design a complete premium card visual system called “Signal”, shown as exactly twelve separate landscape cards in a perfectly aligned 4-column by 3-row grid.
Scene/backdrop: pale cool-gray design-studio presentation surface, minimal and uncluttered
Subject: every card is a 190:140 landscape rounded rectangle, front-facing and identical in size. Across the twelve cards, demonstrate one, two, and three horizontally centered symbols; exactly three canonical symbol silhouettes: a tall slim diamond, a smooth vertical S-curved ribbon/squiggle, and a tall pill-shaped oval; exactly three fill treatments: fully solid, open outline, and evenly spaced horizontal stripes clipped cleanly inside the silhouette. Use three gameplay colors only: vivid signal coral-red, saturated jade-green, and ultraviolet-purple.
Style/medium: exceptional contemporary vector UI design combining Swiss precision, kinetic Bauhaus graphics, and premium consumer-electronics interface polish; porcelain-white card faces; sculpted charcoal outer keyline; small asymmetric registration ticks and cropped concentric arcs at two opposite corners; subtle two-tone offset echo behind the main symbols; decisive geometry, generous whitespace
Composition/framing: orthographic flat front view, no perspective, no overlap, generous equal gutters, all twelve full cards visible; symbols large and instantly readable at mobile size
Lighting/mood: crisp bright studio clarity, energetic and confident
Materials/textures: satin ceramic surface suggested only with restrained vector gradients; accents made solely from clean lines, circles, flat color, and transparency
Constraints: preserve the exact game grammar; all copies of a given shape must have the same silhouette; fills must be unmistakably different; strong color contrast; polished accessibility-first UI; every effect reproducible with vector paths, strokes, clipping, gradients, and transparency
Avoid: any text, letters, numbers, logos, watermark, playing-card suits, extra icon types, confetti, random Memphis shapes, noisy patterns, illegible tiny detail, tilted cards, perspective, hands, physical tabletop mockup
```
