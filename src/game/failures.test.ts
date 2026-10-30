import { describe, expect, it } from 'vitest'
import { failureReport, setFeatures } from './failures'
import type { Board } from './board'
import type { Card } from './cards'
import { enumerateSets } from './set'
import type { TelemetryEvent } from './telemetry'

const c = (count: 0 | 1 | 2, colour: 0 | 1 | 2, shape: 0 | 1 | 2, fill: 0 | 1 | 2): Card => ({ count, colour, shape, fill })

describe('setFeatures', () => {
  // Cards 0,1,2: same colour (red) and shape (diamond), different count and fill.
  const cards = [c(0, 0, 0, 0), c(1, 0, 0, 1), c(2, 0, 0, 2)]

  it('counts the attributes that differ', () => {
    expect(setFeatures(cards, [0, 1, 2])).toContain('differ:2')
  })

  it('names same/different per attribute, and the shared value when same', () => {
    const f = setFeatures(cards, [0, 1, 2])
    expect(f).toEqual(expect.arrayContaining(['count:diff', 'colour:same', 'colour=0', 'shape:same', 'shape=0', 'fill:diff']))
    expect(f).not.toContain('count:same')
  })

  it('names the three card positions', () => {
    expect(setFeatures(cards, [0, 1, 2])).toEqual(expect.arrayContaining(['pos:0', 'pos:1', 'pos:2']))
  })
})

/**
 * A tiny six-card board with exactly two sets, built by hand:
 *   set P = cards 0,1,2 (only count differs: differ:1)
 *   set Q = cards 3,4,5 (all four attributes differ: differ:4)
 */
function twoSetBoard(): Board {
  const cards: Card[] = [
    c(0, 0, 0, 0),
    c(1, 0, 0, 0),
    c(2, 0, 0, 0), // P
    c(0, 1, 2, 1),
    c(1, 2, 0, 2),
    c(2, 0, 1, 0), // Q
  ]
  return { mode: 'A', cards, sets: enumerateSets(cards), attempts: 1 }
}

const found = (t: number, cards: [number, number, number], setIndex: number): TelemetryEvent => ({
  t_ms: t,
  type: 'set_valid',
  payload: { cards, setIndex },
})
const end = (t: number, reason: 'completed' | 'abandoned' = 'completed'): TelemetryEvent => ({
  t_ms: t,
  type: 'game_end',
  payload: { reason },
})

describe('failureReport', () => {
  const board = twoSetBoard()
  const P = board.sets.findIndex((s) => s.join() === '0,1,2')
  const Q = board.sets.findIndex((s) => s.join() === '3,4,5')

  it('the fixture really has the two intended sets', () => {
    expect(board.sets.length).toBe(2)
    expect(P).toBeGreaterThanOrEqual(0)
    expect(Q).toBeGreaterThanOrEqual(0)
  })

  /** P found quickly, then Q found slowly and last. */
  const qLast = [found(5_000, [0, 1, 2], P), found(60_000, [3, 4, 5], Q), end(61_000)]

  it('counts the last set found against what the boards offered', () => {
    const r = failureReport([{ board, events: qLast }])
    const d4 = r.features.get('differ:4')!
    expect(r.games).toBe(1)
    expect(d4.last).toBe(1) // the last set was the 4-different one
    expect(d4.expected).toBeCloseTo(0.5) // half of this board's sets are
    const d1 = r.features.get('differ:1')!
    expect(d1.last).toBe(0)
    expect(d1.expected).toBeCloseTo(0.5)
  })

  it('scores slowness by rank within each game: 1 slowest, 0 quickest', () => {
    const r = failureReport([{ board, events: qLast }])
    expect(r.features.get('differ:4')!.slowness).toBeCloseTo(1)
    expect(r.features.get('differ:1')!.slowness).toBeCloseTo(0)
    expect(r.features.get('differ:4')!.finds).toBe(1)
  })

  it('ranks by the gap since the previous find, not by order', () => {
    // Q found first but after a long hunt; P second, quickly.
    const events = [found(50_000, [3, 4, 5], Q), found(52_000, [0, 1, 2], P), end(53_000)]
    const r = failureReport([{ board, events }])
    expect(r.features.get('differ:4')!.slowness).toBeCloseTo(1)
    expect(r.features.get('differ:1')!.last).toBe(1) // but P was still the last set
  })

  it('counts card positions', () => {
    const r = failureReport([{ board, events: qLast }])
    expect(r.features.get('pos:3')!.last).toBe(1)
    expect(r.features.get('pos:0')!.last).toBe(0)
    expect(r.features.get('pos:0')!.expected).toBeCloseTo(0.5)
  })

  it('skips games that were not finished', () => {
    const quit = [found(5_000, [0, 1, 2], P), end(9_000, 'abandoned')]
    const r = failureReport([{ board, events: quit }])
    expect(r.games).toBe(0)
    expect(r.features.get('differ:1')?.last ?? 0).toBe(0)
  })

  it('adds up across games', () => {
    const pLast = [found(5_000, [3, 4, 5], Q), found(40_000, [0, 1, 2], P), end(41_000)]
    const r = failureReport([
      { board, events: qLast },
      { board, events: pLast },
    ])
    expect(r.games).toBe(2)
    expect(r.features.get('differ:4')!.last).toBe(1)
    expect(r.features.get('differ:4')!.expected).toBeCloseTo(1)
  })
})
