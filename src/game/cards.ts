/**
 * Card representation and deck generation.
 *
 * Pure, dependency-free. No React, no I/O. Everything a league server would
 * need to reproduce a board lives here so this module can move server-side in
 * slice 3 without a rewrite.
 *
 * Each of the four attributes is encoded as 0 | 1 | 2. This encoding is the
 * whole reason set-detection is three lines (see set.ts): three cards form a
 * set iff, for every attribute, (a + b + c) % 3 === 0.
 */

/** An attribute value, encoded as 0, 1, or 2. */
export type Attr = 0 | 1 | 2

/** A single card: four attributes, each an encoded 0 | 1 | 2. */
export interface Card {
  readonly count: Attr
  readonly colour: Attr
  readonly shape: Attr
  readonly fill: Attr
}

/**
 * The four attribute keys, in the canonical low-to-high significance order
 * used by {@link cardId}. `keyof Card`, so indexing a card by one of these
 * yields an {@link Attr}.
 */
export const ATTRIBUTES = ['count', 'colour', 'shape', 'fill'] as const
export type Attribute = (typeof ATTRIBUTES)[number]

/**
 * Human-readable labels for each encoded value. The logic never needs these —
 * they exist so the eventual <Card> renderer and any debug output can map an
 * encoded card back to its meaning. Index by the encoded {@link Attr}.
 */
export const COUNTS = [1, 2, 3] as const
export const COLOURS = ['red', 'green', 'purple'] as const
export const SHAPES = ['diamond', 'squiggle', 'oval'] as const
export const FILLS = ['solid', 'striped', 'open'] as const

/** The deck is exactly 81 cards: 3^4 attribute combinations. */
export const DECK_SIZE = 81

/**
 * Map a card to a stable id in [0, 80]. Mixed-radix base-3 over the attributes
 * in {@link ATTRIBUTES} order, so the mapping is a bijection with its inverse
 * {@link cardFromId}.
 */
export function cardId(card: Card): number {
  return ((card.count * 3 + card.colour) * 3 + card.shape) * 3 + card.fill
}

/** Inverse of {@link cardId}: reconstruct a card from an id in [0, 80]. */
export function cardFromId(id: number): Card {
  const fill = (id % 3) as Attr
  const shape = (Math.floor(id / 3) % 3) as Attr
  const colour = (Math.floor(id / 9) % 3) as Attr
  const count = (Math.floor(id / 27) % 3) as Attr
  return { count, colour, shape, fill }
}

/**
 * The complete 81-card deck, in id order. A fresh array on every call, so
 * callers may shuffle or slice it freely without disturbing anyone else.
 */
export function fullDeck(): Card[] {
  const deck: Card[] = new Array(DECK_SIZE)
  for (let id = 0; id < DECK_SIZE; id++) deck[id] = cardFromId(id)
  return deck
}

/** Structural equality of two cards (all four attributes match). */
export function cardsEqual(a: Card, b: Card): boolean {
  return (
    a.count === b.count &&
    a.colour === b.colour &&
    a.shape === b.shape &&
    a.fill === b.fill
  )
}
