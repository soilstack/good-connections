import { describe, expect, it } from 'vitest'
import { personalBests, recordHeld, type PbGame } from './records'
import { deriveStats, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import type { SoloRecord } from './leagues'

const rec = (userId: string, puzzleDate: string, timeMs: number): SoloRecord => ({
  userId,
  displayName: userId,
  puzzleDate,
  timeMs,
})

describe('recordHeld — Mode A top five', () => {
  const stats = {
    topSolves: [rec('mds', '2026-10-01', 55_700), rec('tm', '2026-09-30', 58_000), rec('mds', '2026-09-12', 61_000)],
    fastestBySetCount: [],
  }

  it('names the rank of the game on screen', () => {
    expect(recordHeld(stats, 'A', 'mds', '2026-10-01')).toEqual({
      kind: 'top-five',
      rank: 1,
      timeMs: 55_700,
    })
    expect(recordHeld(stats, 'A', 'tm', '2026-09-30')).toMatchObject({ rank: 2 })
  })

  it('goes by the DAY, not just the player — one player can hold two places', () => {
    expect(recordHeld(stats, 'A', 'mds', '2026-09-12')).toMatchObject({ rank: 3 })
    expect(recordHeld(stats, 'A', 'mds', '2026-09-30')).toBeNull()
  })

  it('congratulates fourth and fifth place too', () => {
    const five = {
      ...stats,
      topSolves: [...stats.topSolves, rec('aoife', '2026-10-02', 70_000), rec('tm', '2026-10-03', 71_000)],
    }
    expect(recordHeld(five, 'A', 'aoife', '2026-10-02')).toMatchObject({ rank: 4 })
    expect(recordHeld(five, 'A', 'tm', '2026-10-03')).toMatchObject({ rank: 5 })
  })

  it('is nothing for a game outside the top five', () => {
    const six = {
      ...stats,
      topSolves: [
        ...stats.topSolves,
        rec('aoife', '2026-10-02', 70_000),
        rec('tm', '2026-10-03', 71_000),
        rec('sam', '2026-10-04', 72_000),
      ],
    }
    expect(recordHeld(six, 'A', 'sam', '2026-10-04')).toBeNull()
  })

  it('does not match by display name', () => {
    // Two members called "Sam" must not share each other's records.
    const sams = { topSolves: [{ ...rec('sam-1', '2026-10-01', 50_000), displayName: 'Sam' }], fastestBySetCount: [] }
    expect(recordHeld(sams, 'A', 'sam-2', '2026-10-01')).toBeNull()
  })
})

describe('recordHeld — Modes B and C, fastest by set count', () => {
  const stats = {
    topSolves: [],
    fastestBySetCount: [
      { setCount: 3, record: rec('mds', '2026-10-01', 55_700) },
      { setCount: 5, record: rec('tm', '2026-09-27', 69_700) },
    ],
  }

  it('names the set count the record is for', () => {
    expect(recordHeld(stats, 'C', 'mds', '2026-10-01')).toEqual({
      kind: 'set-count',
      setCount: 3,
      timeMs: 55_700,
    })
  })

  it('works for Mode B too, which shares the listing', () => {
    expect(recordHeld(stats, 'B', 'tm', '2026-09-27')).toMatchObject({ setCount: 5 })
  })

  it('is nothing on a day that holds no record', () => {
    expect(recordHeld(stats, 'C', 'mds', '2026-09-27')).toBeNull()
  })
})

/**
 * One league game: sets found at the given times (ms), then the game ends one
 * second after the last find — completed unless `gaveUp`.
 */
function game(userId: string, puzzleDate: string, finds: number[], opts: { setCount?: number; gaveUp?: boolean } = {}): PbGame {
  const events: TelemetryEvent[] = finds.map((t, i) => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex: i },
  }))
  events.push({
    t_ms: (finds.at(-1) ?? 0) + 1_000,
    type: 'game_end',
    payload: { reason: opts.gaveUp ? 'abandoned' : 'completed' },
  })
  return { userId, puzzleDate, setCount: opts.setCount ?? 6, stats: deriveStats({ events } as GameRecord) }
}
/** Six finds, the fifth at `fifth`, the game ending at `total`. */
const six = (userId: string, date: string, fifth: number, total: number) =>
  game(userId, date, [1, 2, 3, 4, fifth, total - 1_000])

describe('personalBests — Mode A', () => {
  it('flags a solve faster than every earlier one, naming the time it beat', () => {
    const pbs = personalBests([six('mds', '2026-10-01', 50_000, 90_000), six('mds', '2026-10-02', 60_000, 80_000)], 'A')
    expect(pbs).toEqual([
      { userId: 'mds', puzzleDate: '2026-10-02', kind: 'solve', timeMs: 80_000, previousMs: 90_000 },
    ])
  })

  it('never flags a first finished game — there is nothing to beat', () => {
    expect(personalBests([six('mds', '2026-10-01', 50_000, 90_000)], 'A')).toEqual([])
  })

  it('flags the time to the fifth set separately', () => {
    const pbs = personalBests([six('mds', '2026-10-01', 50_000, 90_000), six('mds', '2026-10-02', 40_000, 95_000)], 'A')
    expect(pbs).toEqual([
      { userId: 'mds', puzzleDate: '2026-10-02', kind: 'first-five', timeMs: 40_000, previousMs: 50_000 },
    ])
  })

  it('can be both on one day', () => {
    const pbs = personalBests([six('mds', '2026-10-01', 50_000, 90_000), six('mds', '2026-10-02', 40_000, 80_000)], 'A')
    expect(pbs.map((p) => p.kind).sort()).toEqual(['first-five', 'solve'])
  })

  it('must beat the best so far, not just the day before', () => {
    const pbs = personalBests(
      [
        six('mds', '2026-10-01', 50_000, 70_000),
        six('mds', '2026-10-02', 60_000, 90_000),
        six('mds', '2026-10-03', 55_000, 80_000), // beats yesterday, not the 1st
      ],
      'A',
    )
    expect(pbs).toEqual([])
  })

  it('a tie is not a new best', () => {
    expect(personalBests([six('mds', '2026-10-01', 50_000, 90_000), six('mds', '2026-10-02', 50_000, 90_000)], 'A')).toEqual([])
  })

  it('ignores games given up, both as a best and as something to beat', () => {
    const quit = game('mds', '2026-10-02', [1_000, 2_000], { gaveUp: true }) // short, but not a solve
    const pbs = personalBests([six('mds', '2026-10-01', 50_000, 90_000), quit, six('mds', '2026-10-03', 60_000, 85_000)], 'A')
    expect(pbs).toEqual([
      { userId: 'mds', puzzleDate: '2026-10-03', kind: 'solve', timeMs: 85_000, previousMs: 90_000 },
    ])
  })

  it('keeps players apart', () => {
    expect(personalBests([six('mds', '2026-10-01', 50_000, 90_000), six('tm', '2026-10-02', 40_000, 80_000)], 'A')).toEqual([])
  })

  it('goes by puzzle date, whatever order the rows arrive in', () => {
    const pbs = personalBests([six('mds', '2026-10-02', 60_000, 80_000), six('mds', '2026-10-01', 50_000, 90_000)], 'A')
    expect(pbs.map((p) => p.puzzleDate)).toEqual(['2026-10-02'])
  })
})

describe('personalBests — Modes B and C, by set count', () => {
  it('only compares boards with the same number of sets', () => {
    const pbs = personalBests(
      [
        game('mds', '2026-10-01', [10_000, 20_000], { setCount: 2 }),
        game('mds', '2026-10-02', [5_000, 10_000, 15_000], { setCount: 3 }), // first 3-set game
        game('mds', '2026-10-03', [8_000, 12_000], { setCount: 2 }),
      ],
      'C',
    )
    expect(pbs).toEqual([
      { userId: 'mds', puzzleDate: '2026-10-03', kind: 'solve', timeMs: 13_000, previousMs: 21_000, setCount: 2 },
    ])
  })

  it('has no fifth-set best', () => {
    const pbs = personalBests(
      [
        game('mds', '2026-10-01', [1, 2, 3, 4, 50_000, 60_000], { setCount: 6 }),
        game('mds', '2026-10-02', [1, 2, 3, 4, 40_000, 70_000], { setCount: 6 }),
      ],
      'B',
    )
    expect(pbs).toEqual([])
  })
})
