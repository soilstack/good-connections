import { describe, it, expect } from 'vitest'
import {
  DECK_SIZE,
  ATTRIBUTES,
  fullDeck,
  cardId,
  cardFromId,
  cardsEqual,
  type Card,
} from './cards'

describe('deck', () => {
  it('contains exactly 81 cards', () => {
    expect(fullDeck()).toHaveLength(DECK_SIZE)
    expect(DECK_SIZE).toBe(81)
  })

  it('contains 81 distinct cards (no duplicates)', () => {
    const ids = fullDeck().map(cardId)
    expect(new Set(ids).size).toBe(81)
  })

  it('covers every id 0..80 exactly once', () => {
    const ids = fullDeck().map(cardId).sort((a, b) => a - b)
    expect(ids).toEqual(Array.from({ length: 81 }, (_, i) => i))
  })

  it('uses only the values 0,1,2 for every attribute', () => {
    for (const card of fullDeck()) {
      for (const attr of ATTRIBUTES) {
        expect([0, 1, 2]).toContain(card[attr])
      }
    }
  })

  it('is the full cartesian product: every attribute takes each value 27 times', () => {
    const deck = fullDeck()
    for (const attr of ATTRIBUTES) {
      for (const value of [0, 1, 2] as const) {
        const n = deck.filter((c) => c[attr] === value).length
        expect(n).toBe(27)
      }
    }
  })
})

describe('cardId / cardFromId', () => {
  it('are inverse for every card in the deck', () => {
    for (const card of fullDeck()) {
      expect(cardFromId(cardId(card))).toEqual(card)
    }
  })

  it('round-trips every id 0..80', () => {
    for (let id = 0; id < 81; id++) {
      expect(cardId(cardFromId(id))).toBe(id)
    }
  })
})

describe('cardsEqual', () => {
  it('is true for identical attributes and false otherwise', () => {
    const a: Card = { count: 0, colour: 1, shape: 2, fill: 0 }
    const b: Card = { count: 0, colour: 1, shape: 2, fill: 0 }
    const c: Card = { count: 1, colour: 1, shape: 2, fill: 0 }
    expect(cardsEqual(a, b)).toBe(true)
    expect(cardsEqual(a, c)).toBe(false)
  })
})
