import { describe, it, expect } from 'vitest'
import { fullDeck, cardId, type Card } from './cards'
import {
  isSet,
  completingCard,
  enumerateSets,
  enumerateSetsBrute,
  countSets,
  type Triple,
} from './set'
import { mulberry32, shuffle } from './board'

// Total number of sets in a complete 81-card deck is a known constant: 1080.
const SETS_IN_FULL_DECK = 1080

describe('isSet', () => {
  it('accepts three cards that are all-same in every attribute (trivially a set)', () => {
    const a: Card = { count: 0, colour: 0, shape: 0, fill: 0 }
    const b: Card = { count: 0, colour: 0, shape: 0, fill: 0 }
    const c: Card = { count: 0, colour: 0, shape: 0, fill: 0 }
    expect(isSet(a, b, c)).toBe(true)
  })

  it('accepts three cards that are all-different in every attribute', () => {
    const a: Card = { count: 0, colour: 0, shape: 0, fill: 0 }
    const b: Card = { count: 1, colour: 1, shape: 1, fill: 1 }
    const c: Card = { count: 2, colour: 2, shape: 2, fill: 2 }
    expect(isSet(a, b, c)).toBe(true)
  })

  it('accepts a mix: same on some attributes, all-different on others', () => {
    // count all-different, colour all-same, shape all-different, fill all-same
    const a: Card = { count: 0, colour: 1, shape: 0, fill: 2 }
    const b: Card = { count: 1, colour: 1, shape: 1, fill: 2 }
    const c: Card = { count: 2, colour: 1, shape: 2, fill: 2 }
    expect(isSet(a, b, c)).toBe(true)
  })

  it('rejects a triple where exactly one attribute is two-same-one-different', () => {
    // colour is 0,0,1 -> not all same, not all different -> not a set
    const a: Card = { count: 0, colour: 0, shape: 0, fill: 0 }
    const b: Card = { count: 1, colour: 0, shape: 1, fill: 1 }
    const c: Card = { count: 2, colour: 1, shape: 2, fill: 2 }
    expect(isSet(a, b, c)).toBe(false)
  })

  it('does not depend on the order of the three cards', () => {
    const a: Card = { count: 0, colour: 1, shape: 0, fill: 2 }
    const b: Card = { count: 1, colour: 1, shape: 1, fill: 2 }
    const c: Card = { count: 2, colour: 1, shape: 2, fill: 2 }
    for (const [x, y, z] of [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ] as const) {
      expect(isSet(x, y, z)).toBe(true)
    }
  })
})

describe('completingCard', () => {
  it('returns a card that forms a set with the two inputs, for every pair in the deck', () => {
    const deck = fullDeck()
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const a = deck[i]!
        const b = deck[j]!
        const c = completingCard(a, b)
        expect(isSet(a, b, c)).toBe(true)
      }
    }
  })

  it('is the unique third card (distinct from both inputs when inputs differ)', () => {
    const deck = fullDeck()
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const a = deck[i]!
        const b = deck[j]!
        const c = completingCard(a, b)
        // two distinct cards always complete to a third distinct card
        expect(cardId(c)).not.toBe(cardId(a))
        expect(cardId(c)).not.toBe(cardId(b))
      }
    }
  })

  it('returns the same card for three-identical (a completes with itself)', () => {
    const a: Card = { count: 2, colour: 0, shape: 1, fill: 2 }
    expect(completingCard(a, a)).toEqual(a)
  })

  it('is symmetric in its arguments', () => {
    const a: Card = { count: 0, colour: 2, shape: 1, fill: 0 }
    const b: Card = { count: 2, colour: 1, shape: 1, fill: 2 }
    expect(completingCard(a, b)).toEqual(completingCard(b, a))
  })
})

function sortTriples(ts: readonly Triple[]): Triple[] {
  return [...ts].sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2])
}

describe('set enumeration', () => {
  it('returns triples in canonical i<j<k order', () => {
    const board = shuffle(fullDeck(), mulberry32(1)).slice(0, 15)
    for (const [i, j, k] of enumerateSets(board)) {
      expect(i).toBeLessThan(j)
      expect(j).toBeLessThan(k)
    }
  })

  it('every enumerated triple really is a set', () => {
    const board = shuffle(fullDeck(), mulberry32(42)).slice(0, 15)
    for (const [i, j, k] of enumerateSets(board)) {
      expect(isSet(board[i]!, board[j]!, board[k]!)).toBe(true)
    }
  })

  it('O(n^2) and O(n^3) enumerations agree on the full deck', () => {
    const deck = fullDeck()
    const fast = sortTriples(enumerateSets(deck))
    const brute = sortTriples(enumerateSetsBrute(deck))
    expect(fast).toEqual(brute)
    expect(fast).toHaveLength(SETS_IN_FULL_DECK)
  })

  it('O(n^2) and O(n^3) enumerations agree across 200 random boards', () => {
    const rng = mulberry32(12345)
    const deck = fullDeck()
    for (let t = 0; t < 200; t++) {
      const size = 12 + (t % 7) // 12..18
      const board = shuffle(deck, rng).slice(0, size)
      const fast = sortTriples(enumerateSets(board))
      const brute = sortTriples(enumerateSetsBrute(board))
      expect(fast).toEqual(brute)
    }
  })

  it('countSets matches the number of enumerated sets', () => {
    const rng = mulberry32(777)
    const deck = fullDeck()
    for (let t = 0; t < 50; t++) {
      const board = shuffle(deck, rng).slice(0, 12)
      expect(countSets(board)).toBe(enumerateSets(board).length)
    }
  })

  it('reports zero sets for a board with none', () => {
    // A "cap" of 4 mutually non-completing cards has no sets; here we just
    // assert the functions agree on emptiness for a hand-built setless board.
    const board: Card[] = [
      { count: 0, colour: 0, shape: 0, fill: 0 },
      { count: 0, colour: 0, shape: 0, fill: 1 },
      { count: 0, colour: 0, shape: 1, fill: 0 },
      { count: 0, colour: 1, shape: 0, fill: 0 },
    ]
    expect(countSets(board)).toBe(0)
    expect(enumerateSets(board)).toEqual([])
    expect(enumerateSetsBrute(board)).toEqual([])
  })
})
