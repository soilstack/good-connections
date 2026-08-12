// Three procedural, editable vector card systems for Good Connections.
//
// Render a presentation board:
//   typst compile --input theme=nocturne --input view=hero card-themes.typ out.svg
//
// Render all 81 cards on one sheet:
//   typst compile --input theme=nocturne --input view=deck card-themes.typ out.svg
//
// Render one exact card (count is 1..3; the other attributes are 0..2):
//   typst compile --input theme=nocturne --input view=card \
//     --input count=3 --input colour=2 --input shape=1 --input fill=1 \
//     card-themes.typ card.svg

#let theme-key = sys.inputs.at("theme", default: "nocturne")
#let view = sys.inputs.at("view", default: "hero")

#let themes = (
  nocturne: (
    name: "Nocturne",
    strap: "Celestial instrument / frosted obsidian",
    canvas: rgb("#080d19"),
    text: rgb("#f4ecda"),
    muted: rgb("#aab4cb"),
    palette: ("#ff5a63", "#20d99a", "#a66cff"),
  ),
  atelier: (
    name: "Atelier",
    strap: "Letterpress / warm cotton stock",
    canvas: rgb("#292824"),
    text: rgb("#fffaf0"),
    muted: rgb("#c8c0b2"),
    palette: ("#d9442d", "#146247", "#68286f"),
  ),
  signal: (
    name: "Signal",
    strap: "Kinetic modernism / satin porcelain",
    canvas: rgb("#dfe6e8"),
    text: rgb("#1f2b31"),
    muted: rgb("#5e6b70"),
    palette: ("#ff3f49", "#00a86b", "#701bff"),
  ),
)

#if not themes.keys().contains(theme-key) {
  panic("unknown theme: " + theme-key)
}

#let theme = themes.at(theme-key)

// Canonical 100 x 250 symbol geometry. Every fill treatment uses these exact
// silhouettes, so solid/open/striped never drift into different shapes.
#let diamond-path = "M50 5 L96 125 L50 245 L4 125 Z"
#let squiggle-path = (
  "M49 7 C81 12 80 50 61 85 " +
  "C43 118 88 140 88 173 " +
  "C88 211 72 238 51 243 " +
  "C19 238 20 200 39 165 " +
  "C57 132 12 110 12 77 " +
  "C12 39 28 12 49 7 Z"
)

#let shape-node(shape, attrs: "") = {
  if shape == 2 {
    "<rect x=\"8\" y=\"4\" width=\"84\" height=\"242\" rx=\"42\" " + attrs + "/>"
  } else {
    let path = if shape == 0 { diamond-path } else { squiggle-path }
    "<path d=\"" + path + "\" " + attrs + "/>"
  }
}

#let stripe-lines(colour) = {
  let lines = ""
  for y in range(17, 244, step: 21) {
    lines += (
      "<line x1=\"-3\" y1=\"" + str(y) + "\" x2=\"103\" y2=\"" + str(y) +
      "\" stroke=\"" + colour + "\" stroke-width=\"6\"/>"
    )
  }
  lines
}

#let echo-node(theme-key, shape, fill, colour) = {
  let attrs = if fill == 2 {
    "fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"11\" opacity=\"0.14\""
  } else {
    "fill=\"" + colour + "\" stroke=\"none\" opacity=\"0.13\""
  }

  if theme-key == "signal" {
    "<g transform=\"translate(8 9)\">" + shape-node(shape, attrs: attrs) + "</g>"
  } else if theme-key == "atelier" {
    "<g transform=\"translate(3 4)\">" + shape-node(shape, attrs: attrs) + "</g>"
  } else {
    shape-node(
      shape,
      attrs: "fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"18\" opacity=\"0.12\"",
    )
  }
}

#let symbol-node(theme-key, shape, fill, colour, index, x) = {
  let clip-id = "clip-" + str(index)
  let main = if fill == 0 {
    shape-node(
      shape,
      attrs: "fill=\"" + colour + "\" stroke=\"" + colour + "\" stroke-width=\"6\" stroke-linejoin=\"round\"",
    )
  } else if fill == 1 {
    (
      "<defs><clipPath id=\"" + clip-id + "\">" + shape-node(shape) + "</clipPath></defs>" +
      "<g clip-path=\"url(#" + clip-id + ")\">" + stripe-lines(colour) + "</g>" +
      shape-node(
        shape,
        attrs: "fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"7\" stroke-linejoin=\"round\"",
      )
    )
  } else {
    shape-node(
      shape,
      attrs: "fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"8\" stroke-linejoin=\"round\"",
    )
  }

  (
    "<g transform=\"translate(" + str(x) + " 20) scale(0.4)\">" +
    echo-node(theme-key, shape, fill, colour) + main +
    "</g>"
  )
}

#let nocturne-frame(colour) = (
  "<defs>" +
  "<linearGradient id=\"face\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
  "<stop offset=\"0\" stop-color=\"#13223d\"/><stop offset=\"0.55\" stop-color=\"#091426\"/>" +
  "<stop offset=\"1\" stop-color=\"#050b17\"/></linearGradient>" +
  "<linearGradient id=\"edge\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
  "<stop offset=\"0\" stop-color=\"#75d8ff\"/><stop offset=\"0.35\" stop-color=\"#d6ad69\"/>" +
  "<stop offset=\"0.7\" stop-color=\"#a66cff\"/><stop offset=\"1\" stop-color=\"#75d8ff\"/>" +
  "</linearGradient></defs>" +
  "<rect x=\"1.5\" y=\"1.5\" width=\"187\" height=\"137\" rx=\"13\" fill=\"url(#face)\" stroke=\"url(#edge)\" stroke-width=\"2.4\"/>" +
  "<rect x=\"6\" y=\"6\" width=\"178\" height=\"128\" rx=\"9\" fill=\"none\" stroke=\"#d9b979\" stroke-opacity=\"0.55\" stroke-width=\"0.8\"/>" +
  "<ellipse cx=\"95\" cy=\"70\" rx=\"76\" ry=\"52\" fill=\"none\" stroke=\"" + colour + "\" stroke-opacity=\"0.23\" stroke-width=\"0.8\"/>" +
  "<ellipse cx=\"95\" cy=\"70\" rx=\"62\" ry=\"43\" fill=\"none\" stroke=\"#d9b979\" stroke-opacity=\"0.25\" stroke-width=\"0.6\" stroke-dasharray=\"2 3\"/>" +
  "<path d=\"M16 70 H30 M160 70 H174\" stroke=\"#d9b979\" stroke-opacity=\"0.7\" stroke-width=\"0.8\"/>" +
  "<circle cx=\"21\" cy=\"70\" r=\"2.3\" fill=\"#e8ca8b\"/><circle cx=\"169\" cy=\"70\" r=\"2.3\" fill=\"#e8ca8b\"/>"
)

#let atelier-frame(colour) = (
  "<defs>" +
  "<linearGradient id=\"paper-base\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">" +
  "<stop offset=\"0\" stop-color=\"#fffaf0\"/><stop offset=\"1\" stop-color=\"#f1eadb\"/>" +
  "</linearGradient>" +
  "<pattern id=\"paper\" width=\"7\" height=\"7\" patternUnits=\"userSpaceOnUse\">" +
  "<circle cx=\"1\" cy=\"2\" r=\"0.35\" fill=\"#a59984\" opacity=\"0.18\"/>" +
  "<circle cx=\"5\" cy=\"6\" r=\"0.25\" fill=\"#fff\" opacity=\"0.75\"/></pattern></defs>" +
  "<rect x=\"1.5\" y=\"1.5\" width=\"187\" height=\"137\" rx=\"12\" fill=\"url(#paper-base)\" stroke=\"#c4bba9\" stroke-width=\"1.3\"/>" +
  "<rect x=\"1.5\" y=\"1.5\" width=\"187\" height=\"137\" rx=\"12\" fill=\"url(#paper)\"/>" +
  "<rect x=\"6\" y=\"6\" width=\"178\" height=\"128\" rx=\"8\" fill=\"none\" stroke=\"" + colour + "\" stroke-opacity=\"0.9\" stroke-width=\"1.1\"/>" +
  "<rect x=\"9\" y=\"9\" width=\"172\" height=\"122\" rx=\"6\" fill=\"none\" stroke=\"#9d927e\" stroke-opacity=\"0.38\" stroke-width=\"0.65\"/>" +
  "<g fill=\"none\" stroke=\"#b8ad98\" stroke-opacity=\"0.38\" stroke-width=\"1\">" +
  "<path d=\"M14 29 C14 19 19 14 29 14 M14 24 C21 24 24 21 24 14 M18 29 C18 22 22 18 29 18\"/>" +
  "<path d=\"M176 29 C176 19 171 14 161 14 M176 24 C169 24 166 21 166 14 M172 29 C172 22 168 18 161 18\"/>" +
  "<path d=\"M14 111 C14 121 19 126 29 126 M14 116 C21 116 24 119 24 126 M18 111 C18 118 22 122 29 122\"/>" +
  "<path d=\"M176 111 C176 121 171 126 161 126 M176 116 C169 116 166 119 166 126 M172 111 C172 118 168 122 161 122\"/>" +
  "</g>"
)

#let signal-frame(colour) = (
  "<defs><linearGradient id=\"porcelain\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
  "<stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\"0.62\" stop-color=\"#f8fbfb\"/>" +
  "<stop offset=\"1\" stop-color=\"#e8f0f1\"/></linearGradient></defs>" +
  "<rect x=\"1.5\" y=\"1.5\" width=\"187\" height=\"137\" rx=\"13\" fill=\"url(#porcelain)\" stroke=\"#26343b\" stroke-width=\"2.2\"/>" +
  "<path d=\"M164 2 A24 24 0 0 0 188 26 M170 2 A18 18 0 0 0 188 20 M176 2 A12 12 0 0 0 188 14\" fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"1.5\" opacity=\"0.8\"/>" +
  "<path d=\"M2 114 A24 24 0 0 1 26 138 M2 120 A18 18 0 0 1 20 138 M2 126 A12 12 0 0 1 14 138\" fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"1.5\" opacity=\"0.8\"/>" +
  "<circle cx=\"14\" cy=\"14\" r=\"3\" fill=\"" + colour + "\"/>" +
  "<circle cx=\"176\" cy=\"126\" r=\"3\" fill=\"" + colour + "\"/>" +
  "<path d=\"M24 13 H28 M31 13 H35 M155 126 H159 M162 126 H166\" stroke=\"#26343b\" stroke-width=\"2.2\"/>"
)

#let card-svg(theme-key, count, colour-index, shape, fill) = {
  let colour = themes.at(theme-key).palette.at(colour-index)
  let frame = if theme-key == "nocturne" {
    nocturne-frame(colour)
  } else if theme-key == "atelier" {
    atelier-frame(colour)
  } else {
    signal-frame(colour)
  }

  let symbol-width = 40
  let gap = if count == 3 { 12 } else { 16 }
  let group-width = count * symbol-width + (count - 1) * gap
  let start-x = (190 - group-width) / 2
  let symbols = ""
  for index in range(count) {
    let x = start-x + index * (symbol-width + gap)
    symbols += symbol-node(theme-key, shape, fill, colour, index, x)
  }

  (
    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 190 140\" width=\"190\" height=\"140\">" +
    frame + symbols + "</svg>"
  )
}

#let card(theme-key, count, colour, shape, fill, width: 190pt) = {
  image(
    bytes(card-svg(theme-key, count, colour, shape, fill)),
    format: "svg",
    width: width,
  )
}

// A deliberately balanced board: every shape, fill, colour, and count appears
// repeatedly, making visual inconsistencies easy to spot during review.
#let hero-cards = (
  (1, 0, 0, 0), (2, 1, 0, 2), (3, 2, 0, 1), (1, 1, 1, 0),
  (2, 2, 1, 2), (3, 0, 1, 1), (1, 2, 2, 0), (2, 0, 2, 2),
  (3, 1, 2, 1), (1, 2, 0, 2), (2, 0, 0, 1), (3, 1, 0, 0),
)

#let complete-deck(theme-key, width) = {
  let cards = ()
  for count-index in range(3) {
    for colour in range(3) {
      for shape in range(3) {
        for fill in range(3) {
          cards.push(card(theme-key, count-index + 1, colour, shape, fill, width: width))
        }
      }
    }
  }
  cards
}

#let title-block(theme, eyebrow) = block[
  #set text(fill: theme.text)
  #text(size: 8pt, weight: "bold", tracking: 1.4pt, fill: theme.muted)[#eyebrow]
  #v(2mm)
  #text(size: 24pt, weight: "bold")[#theme.name]
  #h(5mm)
  #text(size: 10pt, fill: theme.muted)[#theme.strap]
]

#if view == "card" {
  let count = int(sys.inputs.at("count", default: "1"))
  let colour = int(sys.inputs.at("colour", default: "0"))
  let shape = int(sys.inputs.at("shape", default: "0"))
  let fill = int(sys.inputs.at("fill", default: "0"))
  if count < 1 or count > 3 or colour < 0 or colour > 2 or shape < 0 or shape > 2 or fill < 0 or fill > 2 {
    panic("card inputs out of range")
  }
  set page(width: 190pt, height: 140pt, margin: 0pt, fill: none)
  card(theme-key, count, colour, shape, fill, width: 190pt)
} else if view == "deck" {
  set page(width: 330mm, height: 276mm, margin: (x: 13mm, y: 10mm), fill: theme.canvas)
  title-block(theme, "COMPLETE 81-CARD VECTOR DECK")
  v(6mm)
  grid(
    columns: 9,
    gutter: 2mm,
    ..complete-deck(theme-key, 30mm),
  )
} else if view == "hero" {
  set page(width: 340mm, height: 236mm, margin: (x: 14mm, y: 10mm), fill: theme.canvas)
  title-block(theme, "GOOD CONNECTIONS — CARD SYSTEM")
  v(6mm)
  grid(
    columns: 4,
    gutter: 5mm,
    ..hero-cards.map(c => card(theme-key, c.at(0), c.at(1), c.at(2), c.at(3), width: 74mm)),
  )
} else {
  panic("unknown view: " + view)
}
