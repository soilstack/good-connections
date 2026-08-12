import { useId } from 'react'
import { COLOURS, SHAPES, FILLS, type Card as SetCard } from '../game/cards'

/**
 * The one component that draws all 81 cards. It takes a single encoded card
 * ({ count, colour, shape, fill }, each 0|1|2) and renders it as SVG generated
 * from those four attributes — no bitmaps, no sprite sheet.
 *
 * Layout matches docs/reference-cards.png: tall, narrow symbols in a horizontal
 * row on a landscape card, with horizontal stripes. The face is transparent-
 * backed; card framing and the selected state live on the wrapper the play grid
 * provides, so selection never depends on colour.
 */

/** Colour per encoded value: 0 red, 1 green, 2 purple. */
const COLOUR_HEX = ['#e4002b', '#12a150', '#6c2d9c'] as const

/** Each symbol is drawn in this tall-narrow local viewBox (1 : 2.5). */
const VB_W = 100
const VB_H = 250

/** Placement within the card, in card units. */
const SYMBOL_W = 40
const SYMBOL_H = 100
const SYMBOL_GAP = 16
const CARD_W = 190
const CARD_H = 140

/** Stroke + stripe geometry, in symbol-local (viewBox) units. */
const STROKE = 7
const STRIPE_PERIOD = 24
const STRIPE_STROKE = 6

const DIAMOND_PATH = `M50 4 L96 ${VB_H / 2} L50 ${VB_H - 4} L4 ${VB_H / 2} Z`

// Vertical squiggle: a fat, rounded ribbon with 180-degree point symmetry —
// a top lobe leaning left and a bottom lobe leaning right, per
// docs/correct-squiggle.jpeg. The outline's second half is the point-symmetric
// image of the first (each control point p maps to (100-x, 250-y)).
const SQUIGGLE_PATH =
  'M50 8 C82 14, 78 52, 60 86 C44 120, 88 140, 88 172 ' +
  'C88 210, 72 238, 50 242 C18 236, 22 198, 40 164 ' +
  'C56 130, 12 110, 12 78 C12 40, 28 12, 50 8 Z'

function StripePattern({ id, colour }: { id: string; colour: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={VB_W} height={STRIPE_PERIOD}>
      <line x1={0} y1={STRIPE_PERIOD / 2} x2={VB_W} y2={STRIPE_PERIOD / 2} stroke={colour} strokeWidth={STRIPE_STROKE} />
    </pattern>
  )
}

interface SymbolProps {
  shape: number
  fill: number
  colour: string
  x: number
  patternId: string
}

/** One symbol, positioned at horizontal offset `x`, vertically centred. */
function Symbol({ shape, fill, colour, x, patternId }: SymbolProps) {
  // fill: 0 solid, 1 striped, 2 open.
  const fillValue = fill === 0 ? colour : fill === 1 ? `url(#${patternId})` : 'none'
  const common = {
    fill: fillValue,
    stroke: colour,
    strokeWidth: STROKE,
    strokeLinejoin: 'round' as const,
  }
  // shape: 0 diamond, 1 squiggle, 2 oval (stadium).
  const inner =
    shape === 2 ? (
      <rect x={8} y={4} width={VB_W - 16} height={VB_H - 8} rx={(VB_W - 16) / 2} {...common} />
    ) : (
      <path d={shape === 0 ? DIAMOND_PATH : SQUIGGLE_PATH} {...common} />
    )
  return (
    <svg
      x={x}
      y={(CARD_H - SYMBOL_H) / 2}
      width={SYMBOL_W}
      height={SYMBOL_H}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      overflow="visible"
    >
      {inner}
    </svg>
  )
}

export interface CardProps {
  card: SetCard
  /** Accessible label override; defaults to a description of the four attributes. */
  label?: string
}

export function Card({ card, label }: CardProps) {
  const uid = useId()
  const patternId = `stripe-${uid}`
  const colour = COLOUR_HEX[card.colour]!
  const count = card.count + 1 // encoded 0|1|2 -> 1|2|3 symbols

  // Centre the row of `count` symbols; footprint is identical regardless of count.
  const groupW = count * SYMBOL_W + (count - 1) * SYMBOL_GAP
  const startX = (CARD_W - groupW) / 2
  const xs = Array.from({ length: count }, (_, i) => startX + i * (SYMBOL_W + SYMBOL_GAP))

  const describe =
    label ?? `${count} ${COLOURS[card.colour]} ${FILLS[card.fill]} ${SHAPES[card.shape]}`

  return (
    <svg
      className="set-card"
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      role="img"
      aria-label={describe}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>{card.fill === 1 && <StripePattern id={patternId} colour={colour} />}</defs>
      {xs.map((x, i) => (
        <Symbol key={i} shape={card.shape} fill={card.fill} colour={colour} x={x} patternId={patternId} />
      ))}
    </svg>
  )
}
