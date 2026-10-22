/**
 * Relabelling pool boards so a finite pool never visibly repeats.
 *
 * Identify each card with a vector in GF(3)^4 — its four 0/1/2 attributes
 * (count, colour, shape, fill). Three cards form a set iff their vectors sum to
 * zero mod 3, i.e. iff they are a line of the affine space AG(4,3). Any affine
 * bijection v → Mv + t (M invertible mod 3) maps lines to lines: for a set,
 * M(a+b+c) + 3t ≡ 0. So relabelling a board this way preserves its set count
 * exactly — indeed it preserves which index triples are sets.
 *
 * |AGL(4,3)| = 81 · |GL(4,3)| ≈ 2×10⁹, times 12! display orders, so a few
 * thousand base boards per set count never look the same twice.
 *
 * Pure and deterministic like board.ts: everything is drawn from an explicit
 * RNG, so every member of a league, given the same seed, gets the same board.
 */

import { cardFromId, DECK_SIZE, type Attr, type Card } from './cards'
import { enumerateSets } from './set'
import { shuffle, mulberry32, BOARD_SIZE, type Board, type RNG } from './board'

/** A 4×4 matrix over GF(3), rows then columns, in count/colour/shape/fill order. */
export type Matrix4 = readonly (readonly Attr[])[]

/** v → matrix·v + translation, over GF(3)^4. */
export interface AffineMap {
  readonly matrix: Matrix4
  readonly translation: readonly Attr[]
}

/**
 * Is a 4×4 matrix invertible over GF(3)? Gaussian elimination mod 3. Accepts
 * plain numbers so tests can pass literals; entries are reduced mod 3 first.
 */
export function isInvertibleMod3(matrix: readonly (readonly number[])[]): boolean {
  const m = matrix.map((row) => row.map((v) => ((v % 3) + 3) % 3))
  const n = m.length
  for (let col = 0; col < n; col++) {
    let pivot = -1
    for (let r = col; r < n; r++) {
      if (m[r]![col] !== 0) {
        pivot = r
        break
      }
    }
    if (pivot === -1) return false
    ;[m[col], m[pivot]] = [m[pivot]!, m[col]!]
    // In GF(3) every non-zero element is its own inverse: 1·1 = 1, 2·2 = 4 ≡ 1.
    const inv = m[col]![col]!
    for (let r = col + 1; r < n; r++) {
      const factor = (m[r]![col]! * inv) % 3
      if (factor === 0) continue
      for (let c = col; c < n; c++) {
        m[r]![c] = (((m[r]![c]! - factor * m[col]![c]!) % 3) + 3) % 3
      }
    }
  }
  return true
}

/** A uniform draw from {0, 1, 2}. */
function randomAttr(rng: RNG): Attr {
  return Math.floor(rng() * 3) as Attr
}

/**
 * A uniformly random affine bijection of GF(3)^4. The matrix is sampled entry
 * by entry, row-major, and redrawn whole until it is invertible (about 56% of
 * draws are); then the translation is drawn. The draw order is part of the
 * contract — {@link boardFromPool} depends on it being stable.
 */
export function randomAffineMap(rng: RNG): AffineMap {
  let matrix: Attr[][]
  do {
    matrix = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => randomAttr(rng)))
  } while (!isInvertibleMod3(matrix))
  const translation = Array.from({ length: 4 }, () => randomAttr(rng))
  return { matrix, translation }
}

/** Apply an affine map to one card, using the 0/1/2 attribute encoding. */
export function applyAffine(card: Card, map: AffineMap): Card {
  const v = [card.count, card.colour, card.shape, card.fill]
  const out = map.matrix.map((row, i) => {
    let sum = map.translation[i]!
    for (let j = 0; j < 4; j++) sum += row[j]! * v[j]!
    return (sum % 3) as Attr
  })
  return { count: out[0]!, colour: out[1]!, shape: out[2]!, fill: out[3]! }
}

/**
 * Build a league board from a pool row (Modes B and C, from the cutover date).
 *
 * The server stores each pool board as 12 sorted card ids and hands the client
 * those ids plus the day's seed. From one `mulberry32(seed)` stream, in this
 * order and never another: draw the affine map, apply it to every card, then
 * shuffle the 12 into display order. The set count is the pool row's N.
 *
 * `attempts: 0` marks the board as drawn from the pool rather than dealt.
 *
 * Throws on a malformed row instead of guessing — a wrong board recorded
 * against a league day is worse than no board.
 */
export function boardFromPool(mode: 'B' | 'C', cardIds: readonly number[], seed: number): Board {
  if (cardIds.length !== BOARD_SIZE) {
    throw new Error(`pool board has ${cardIds.length} cards, expected ${BOARD_SIZE}`)
  }
  for (const id of cardIds) {
    if (!Number.isInteger(id) || id < 0 || id >= DECK_SIZE) throw new Error(`pool board has bad card id ${id}`)
  }
  if (new Set(cardIds).size !== BOARD_SIZE) throw new Error('pool board has a repeated card')

  const rng = mulberry32(seed)
  const map = randomAffineMap(rng)
  const cards = shuffle(
    cardIds.map((id) => applyAffine(cardFromId(id), map)),
    rng,
  )
  return { mode, cards, sets: enumerateSets(cards), attempts: 0 }
}
