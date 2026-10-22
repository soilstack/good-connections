import { describe, it, expect } from 'vitest'
import { cardId } from './cards'
import { generateModeA, generateModeB, generateModeC, mulberry32, type Board } from './board'

/**
 * Regression guard for seed-based boards. Every league day issued before the
 * board pool (and every Mode A day, always) is rebuilt on read from its stored
 * seed via generateBoard(mode, mulberry32(seed)). If mulberry32, shuffle, deal or
 * a generator changes in any way, past boards silently become different boards
 * and their recorded telemetry no longer matches the cards it was played on.
 *
 * These outputs were captured from main @ 043850c. They must never change. If
 * this test fails, revert the change that broke it — do not update the numbers.
 */
const PINNED: { seed: number; mode: 'A' | 'B' | 'C'; ids: number[]; sets: number; attempts: number }[] = [
  { seed: 1, mode: 'A', ids: [56, 54, 80, 34, 44, 46, 42, 32, 45, 17, 11, 22], sets: 6, attempts: 12 },
  { seed: 1, mode: 'B', ids: [25, 17, 44, 56, 36, 31, 16, 57, 43, 24, 50, 55], sets: 2, attempts: 2 },
  { seed: 1, mode: 'C', ids: [25, 17, 44, 56, 36, 31, 16, 57, 43, 24, 50, 55], sets: 2, attempts: 2 },
  { seed: 42, mode: 'A', ids: [15, 18, 55, 66, 46, 38, 68, 37, 67, 42, 11, 40], sets: 6, attempts: 114 },
  { seed: 42, mode: 'B', ids: [2, 19, 26, 42, 62, 32, 16, 27, 77, 55, 66, 14], sets: 5, attempts: 2 },
  { seed: 42, mode: 'C', ids: [2, 19, 26, 42, 62, 32, 16, 27, 77, 55, 66, 14], sets: 5, attempts: 2 },
  { seed: 123456789, mode: 'B', ids: [0, 59, 80, 78, 73, 52, 79, 13, 60, 17, 55, 29], sets: 6, attempts: 1 },
  { seed: 1999999999, mode: 'A', ids: [44, 12, 65, 40, 5, 17, 43, 10, 13, 14, 18, 66], sets: 6, attempts: 40 },
  { seed: 1999999999, mode: 'B', ids: [70, 64, 10, 18, 36, 61, 65, 77, 66, 27, 67, 74], sets: 5, attempts: 2 },
  { seed: 1999999999, mode: 'C', ids: [70, 64, 10, 18, 36, 61, 65, 77, 66, 27, 67, 74], sets: 5, attempts: 2 },
]

const GENERATORS: Record<'A' | 'B' | 'C', (rng: () => number) => Board> = {
  A: generateModeA,
  B: generateModeB,
  C: generateModeC,
}

describe('legacy seed-based boards never drift', () => {
  for (const p of PINNED) {
    it(`mode ${p.mode}, seed ${p.seed}`, () => {
      const board = GENERATORS[p.mode](mulberry32(p.seed))
      expect(board.mode).toBe(p.mode)
      expect(board.cards.map(cardId)).toEqual(p.ids)
      expect(board.sets.length).toBe(p.sets)
      expect(board.attempts).toBe(p.attempts)
    })
  }
})
