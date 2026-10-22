import { describe, it, expect } from 'vitest'
import { cardId, cardFromId, fullDeck } from './cards'
import { countSets, enumerateSets, enumerateSetsBrute } from './set'
import { mulberry32, shuffle, BOARD_SIZE } from './board'
import { randomAffineMap, applyAffine, boardFromPool, isInvertibleMod3 } from './relabel'

/** A random 12-card deal, for property tests only. */
function randomBoard(rng: () => number) {
  return shuffle(fullDeck(), rng).slice(0, BOARD_SIZE)
}

describe('isInvertibleMod3', () => {
  it('accepts the identity and rejects a matrix with a zero row', () => {
    const id = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ] as const
    const singular = [
      [1, 2, 0, 1],
      [0, 0, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ] as const
    expect(isInvertibleMod3(id)).toBe(true)
    expect(isInvertibleMod3(singular)).toBe(false)
  })

  it('rejects a matrix whose rows are dependent only mod 3', () => {
    // Row 2 = row 1 + row 3 + row 4 = (4,3,3,3) ≡ (1,0,0,0) mod 3. Over the
    // integers the determinant is -3, so a check that forgot to reduce mod 3
    // would wrongly call this invertible.
    const m = [
      [2, 2, 0, 1],
      [1, 0, 0, 0],
      [2, 0, 1, 0],
      [0, 1, 2, 2],
    ] as const
    expect(isInvertibleMod3(m)).toBe(false)
  })

  it('accepts about 56% of uniform 4x4 matrices, as |GL(4,3)| / 3^16 predicts', () => {
    // |GL(4,3)| = (81-1)(81-3)(81-9)(81-27) = 24261120; 3^16 = 43046721.
    const expected = 24261120 / 43046721
    const rng = mulberry32(2026)
    const trials = 20000
    let ok = 0
    for (let t = 0; t < trials; t++) {
      const m = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.floor(rng() * 3)))
      if (isInvertibleMod3(m)) ok++
    }
    expect(Math.abs(ok / trials - expected)).toBeLessThan(0.015)
  })
})

describe('randomAffineMap', () => {
  it('always returns an invertible matrix and a translation in GF(3)^4', () => {
    const rng = mulberry32(11)
    for (let i = 0; i < 1000; i++) {
      const map = randomAffineMap(rng)
      expect(isInvertibleMod3(map.matrix)).toBe(true)
      expect(map.translation).toHaveLength(4)
      for (const v of [...map.matrix.flat(), ...map.translation]) expect([0, 1, 2]).toContain(v)
    }
  })
})

describe('applyAffine', () => {
  it('is a bijection on the 81-card deck, for 1,000 random maps', () => {
    const rng = mulberry32(81)
    for (let i = 0; i < 1000; i++) {
      const map = randomAffineMap(rng)
      const image = new Set(fullDeck().map((c) => cardId(applyAffine(c, map))))
      expect(image.size).toBe(81)
    }
  })

  it('preserves the set count of 10,000 random boards, and both enumerations agree after mapping', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 10000; i++) {
      const cards = randomBoard(rng)
      const map = randomAffineMap(rng)
      const mapped = cards.map((c) => applyAffine(c, map))
      expect(countSets(mapped)).toBe(countSets(cards))
      expect(enumerateSets(mapped)).toEqual(enumerateSetsBrute(mapped))
    }
  })

  it('maps a set triple to a set triple position-for-position', () => {
    // Stronger than equal counts: the mapped board has the SAME index triples.
    const rng = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const cards = randomBoard(rng)
      const map = randomAffineMap(rng)
      expect(enumerateSets(cards.map((c) => applyAffine(c, map)))).toEqual(enumerateSets(cards))
    }
  })
})

describe('boardFromPool', () => {
  // A known 6-set board: the pinned legacy Mode A board for seed 1.
  const POOL_IDS = [11, 17, 22, 32, 34, 42, 44, 45, 46, 54, 56, 80]

  it('is deterministic: same ids and seed give byte-identical boards', () => {
    const a = boardFromPool('C', POOL_IDS, 987654321)
    const b = boardFromPool('C', POOL_IDS, 987654321)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('gives different cards for different seeds', () => {
    const seen = new Set<string>()
    for (let s = 1; s <= 50; s++) {
      seen.add(JSON.stringify(boardFromPool('B', POOL_IDS, s).cards.map(cardId)))
    }
    expect(seen.size).toBe(50)
  })

  it('yields the same card set whatever order the ids arrive in', () => {
    const reversed = [...POOL_IDS].reverse()
    // The map and shuffle are drawn from the seed alone, but shuffle permutes
    // positions — so a different input order gives a different display order
    // of the same mapped card SET. The server always sends the stored sorted
    // array, so this only documents the contract.
    const a = boardFromPool('B', POOL_IDS, 5).cards.map(cardId).sort((x, y) => x - y)
    const b = boardFromPool('B', reversed, 5).cards.map(cardId).sort((x, y) => x - y)
    expect(a).toEqual(b)
  })

  it('returns 12 distinct cards whose set count equals the pool board N', () => {
    const n = countSets(POOL_IDS.map(cardFromId))
    expect(n).toBe(6)
    for (let s = 0; s < 200; s++) {
      const board = boardFromPool('C', POOL_IDS, s * 7919)
      expect(board.cards).toHaveLength(12)
      expect(new Set(board.cards.map(cardId)).size).toBe(12)
      expect(board.sets.length).toBe(n)
      expect(board.sets).toEqual(enumerateSetsBrute(board.cards))
      expect(board.mode).toBe('C')
      expect(board.attempts).toBe(0)
    }
  })

  it('draws the map before the display order, from the one rng', () => {
    // Recompute by hand in the documented order and compare.
    const seed = 424242
    const rng = mulberry32(seed)
    const map = randomAffineMap(rng)
    const expected = shuffle(
      POOL_IDS.map((id) => applyAffine(cardFromId(id), map)),
      rng,
    )
    expect(boardFromPool('B', POOL_IDS, seed).cards).toEqual(expected)
  })

  it('rejects malformed pool rows loudly', () => {
    expect(() => boardFromPool('B', POOL_IDS.slice(0, 11), 1)).toThrow()
    expect(() => boardFromPool('B', [...POOL_IDS.slice(0, 11), 11], 1)).toThrow()
    expect(() => boardFromPool('B', [...POOL_IDS.slice(0, 11), 81], 1)).toThrow()
    expect(() => boardFromPool('B', [...POOL_IDS.slice(0, 11), 1.5], 1)).toThrow()
  })
})
