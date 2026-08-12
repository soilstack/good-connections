/**
 * Set detection and enumeration.
 *
 * Pure, dependency-free. The one algorithm that matters: three cards form a
 * set iff, for every attribute independently, the encoded values sum to a
 * multiple of 3.
 */

import { ATTRIBUTES, cardId, type Attr, type Card } from './cards'

/** Indices [i, j, k] into a board's card array, always with i < j < k. */
export type Triple = readonly [number, number, number]

/**
 * Do three cards form a set? For each attribute the three values must be all
 * the same or all different; both cases — and only those — make the sum a
 * multiple of 3. This is the entire detection algorithm.
 */
export function isSet(a: Card, b: Card, c: Card): boolean {
  return ATTRIBUTES.every((attr) => (a[attr] + b[attr] + c[attr]) % 3 === 0)
}

/** The value in [0, 2] that makes x + y + it ≡ 0 (mod 3). */
function completingValue(x: Attr, y: Attr): Attr {
  return ((3 - ((x + y) % 3)) % 3) as Attr
}

/**
 * The unique third card that completes a set with `a` and `b`. Any two cards
 * determine exactly one such card, which is the basis of the O(n²) enumeration
 * below. When `a === b` the completing card is that same card again.
 */
export function completingCard(a: Card, b: Card): Card {
  return {
    count: completingValue(a.count, b.count),
    colour: completingValue(a.colour, b.colour),
    shape: completingValue(a.shape, b.shape),
    fill: completingValue(a.fill, b.fill),
  }
}

/**
 * Brute-force O(n³) enumeration: test every triple. Returns triples in
 * canonical i < j < k lexicographic order. Simple and obviously correct — it
 * exists to cross-check {@link enumerateSets}.
 */
export function enumerateSetsBrute(cards: readonly Card[]): Triple[] {
  const out: Triple[] = []
  const n = cards.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (isSet(cards[i]!, cards[j]!, cards[k]!)) out.push([i, j, k])
      }
    }
  }
  return out
}

/**
 * O(n²) enumeration using the "two cards determine a third" property: for each
 * pair, compute the completing card and look it up. Requires the input cards to
 * be distinct (they always are — a board is dealt without replacement).
 *
 * Each set {p, q, r} is discovered only from its lowest pair (p, q), by
 * accepting the completion only when its index r > q. That yields every set
 * exactly once, in the same canonical i < j < k order as the brute force.
 */
export function enumerateSets(cards: readonly Card[]): Triple[] {
  const indexOf = new Map<number, number>()
  for (let i = 0; i < cards.length; i++) indexOf.set(cardId(cards[i]!), i)

  const out: Triple[] = []
  const n = cards.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const third = completingCard(cards[i]!, cards[j]!)
      const k = indexOf.get(cardId(third))
      if (k !== undefined && k > j) out.push([i, j, k])
    }
  }
  return out
}

/**
 * Count the sets on a board. Same O(n²) method as {@link enumerateSets} but
 * without materialising the triples — this is the hot path in Mode A/B
 * rejection sampling (see board.ts).
 */
export function countSets(cards: readonly Card[]): number {
  const indexOf = new Map<number, number>()
  for (let i = 0; i < cards.length; i++) indexOf.set(cardId(cards[i]!), i)

  let count = 0
  const n = cards.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const third = completingCard(cards[i]!, cards[j]!)
      const k = indexOf.get(cardId(third))
      if (k !== undefined && k > j) count++
    }
  }
  return count
}
