import { useId } from 'react'
import { COLOURS, SHAPES, FILLS, type Card as SetCard } from '../game/cards'

/**
 * The one component that draws all 81 cards. It takes a single encoded card
 * ({ count, colour, shape, fill }, each 0|1|2) and renders it as SVG generated
 * from those four attributes — no bitmaps, no sprite sheet.
 *
 * The face is transparent-backed; card framing and the selected state live on
 * the wrapper the play grid provides, so selection never depends on colour.
 */

/** Colour per encoded value: 0 red, 1 green, 2 purple. */
const COLOUR_HEX = ['#e4002b', '#12a150', '#6c2d9c'] as const

/** Symbol geometry, in the card's own coordinate units. */
const SYMBOL_W = 100
const SYMBOL_H = 46
const SYMBOL_GAP = 14
const SYMBOL_X = 20 // left inset so 100-wide symbols sit in a 140-wide card
const CARD_W = 140
const CARD_H = 200
const STROKE = 2.6

/** Native path for each shape, drawn in a 0 0 100 46 box. */
const DIAMOND_PATH = 'M50 1 L99 23 L50 45 L1 23 Z'
// A closed S-curve with the squiggle's characteristic point symmetry.
// PLACEHOLDER geometry — tune against docs/reference-cards.png.
const SQUIGGLE_PATH =
  'M18 10 C 6 16, 8 30, 20 32 C 33 34, 41 24, 54 23 ' +
  'C 70 22, 78 30, 88 26 C 98 22, 96 12, 84 12 ' +
  'C 71 12, 63 21, 50 22 C 34 23, 28 14, 18 10 Z'

interface StripePatternProps {
  id: string
  colour: string
}

/** Horizontal-line fill, per the spec, as a real SVG <pattern>. */
function StripePattern({ id, colour }: StripePatternProps) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={SYMBOL_W} height={6}>
      <line x1={0} y1={3} x2={SYMBOL_W} y2={3} stroke={colour} strokeWidth={2} />
    </pattern>
  )
}

interface SymbolProps {
  shape: number
  fill: number
  colour: string
  y: number
  patternId: string
}

/** One symbol, positioned at vertical offset `y` inside the card. */
function Symbol({ shape, fill, colour, y, patternId }: SymbolProps) {
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
      <rect x={1} y={1} width={SYMBOL_W - 2} height={SYMBOL_H - 2} rx={(SYMBOL_H - 2) / 2} {...common} />
    ) : (
      <path d={shape === 0 ? DIAMOND_PATH : SQUIGGLE_PATH} {...common} />
    )
  return (
    <svg x={SYMBOL_X} y={y} width={SYMBOL_W} height={SYMBOL_H} viewBox={`0 0 ${SYMBOL_W} ${SYMBOL_H}`} overflow="visible">
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

  // Centre the stack of `count` symbols vertically; footprint is identical
  // regardless of count.
  const groupH = count * SYMBOL_H + (count - 1) * SYMBOL_GAP
  const startY = (CARD_H - groupH) / 2
  const ys = Array.from({ length: count }, (_, i) => startY + i * (SYMBOL_H + SYMBOL_GAP))

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
      {ys.map((y, i) => (
        <Symbol key={i} shape={card.shape} fill={card.fill} colour={colour} y={y} patternId={patternId} />
      ))}
    </svg>
  )
}
