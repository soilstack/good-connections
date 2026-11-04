import { describe, expect, it } from 'vitest'
import {
  fastestPerSetCount,
  headToHead,
  heroToZero,
  lostWins,
  personalBests,
  recordHeld,
  resultsTable,
  zeroToHero,
  type PbGame,
} from './records'
import { deriveStats, ditheringMs, type GameRecord, type TelemetryEvent } from '../game/telemetry'
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

describe('resultsTable', () => {
  const perfect = (g: PbGame) => ({ ...g, perfect: true })
  const plain = (g: PbGame) => ({ ...g, perfect: false })
  const row = (rows: ReturnType<typeof resultsTable>, id: string) => rows.find((r) => r.userId === id)!

  it('counts games played, finished or not', () => {
    const rows = resultsTable(
      [
        plain(six('mds', '2026-10-01', 50_000, 90_000)),
        plain(game('mds', '2026-10-02', [1_000], { gaveUp: true })),
      ],
      'A',
    )
    expect(row(rows, 'mds').games).toBe(2)
  })

  it('gives each day’s first place to the fastest finished solve, even playing alone', () => {
    const rows = resultsTable(
      [
        plain(six('mds', '2026-10-01', 50_000, 90_000)),
        plain(six('tm', '2026-10-01', 40_000, 80_000)),
        plain(six('mds', '2026-10-02', 50_000, 99_000)), // alone that day
      ],
      'A',
    )
    expect(row(rows, 'tm').firstPlaces).toBe(1)
    expect(row(rows, 'mds').firstPlaces).toBe(1)
  })

  it('never gives first place to someone who gave up, however short their game', () => {
    const rows = resultsTable(
      [plain(game('mds', '2026-10-01', [1_000], { gaveUp: true })), plain(six('tm', '2026-10-01', 50_000, 90_000))],
      'A',
    )
    expect(row(rows, 'mds').firstPlaces).toBe(0)
    expect(row(rows, 'tm').firstPlaces).toBe(1)
  })

  it('shares an exact tie for first', () => {
    const rows = resultsTable(
      [plain(six('mds', '2026-10-01', 50_000, 90_000)), plain(six('tm', '2026-10-01', 40_000, 90_000))],
      'A',
    )
    expect(row(rows, 'mds').firstPlaces).toBe(1)
    expect(row(rows, 'tm').firstPlaces).toBe(1)
  })

  it('counts perfect games', () => {
    const rows = resultsTable(
      [perfect(six('mds', '2026-10-01', 50_000, 90_000)), plain(six('mds', '2026-10-02', 50_000, 90_000))],
      'A',
    )
    expect(row(rows, 'mds').perfects).toBe(1)
  })

  it('keeps the fastest first five sets from a finished game (Mode A)', () => {
    const rows = resultsTable(
      [
        plain(six('mds', '2026-10-01', 50_000, 90_000)),
        plain(six('mds', '2026-10-02', 45_000, 99_000)),
        plain(game('mds', '2026-10-03', [1, 2, 3, 4, 10_000], { gaveUp: true })), // not finished
      ],
      'A',
    )
    expect(row(rows, 'mds').bestFirstFiveMs).toBe(45_000)
  })

  it('has no first-five time outside Mode A', () => {
    expect(row(resultsTable([plain(six('mds', '2026-10-01', 50_000, 90_000))], 'C'), 'mds').bestFirstFiveMs).toBeNull()
  })

  it('counts a day once even if it somehow holds two records', () => {
    const rows = resultsTable(
      [perfect(six('mds', '2026-10-01', 50_000, 90_000)), perfect(six('mds', '2026-10-01', 50_000, 95_000))],
      'A',
    )
    expect(row(rows, 'mds')).toMatchObject({ games: 1, firstPlaces: 1, perfects: 1 })
  })

  it('ranks by first places, then perfects, then games', () => {
    const rows = resultsTable(
      [
        plain(six('a', '2026-10-01', 50_000, 90_000)),
        plain(six('b', '2026-10-01', 50_000, 80_000)), // b wins day 1
        perfect(six('a', '2026-10-02', 50_000, 90_000)), // a wins day 2, perfect
        plain(six('c', '2026-10-03', 50_000, 90_000)), // c wins day 3
      ],
      'A',
    )
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b', 'c'])
  })
})

describe('heroToZero', () => {
  /** A finisher whose fifth set came at `fifth` and who finished at `total`. */
  const p = (id: string, fifth: number, total: number) => {
    const g = six(id, '2026-10-01', fifth, total)
    return { userId: g.userId, stats: g.stats }
  }

  it('names the player fastest to five who finished last', () => {
    expect(heroToZero([p('hero', 30_000, 200_000), p('b', 40_000, 90_000), p('c', 50_000, 100_000)], 'A')).toBe('hero')
  })

  it('is nobody when the fastest to five did not finish last', () => {
    expect(heroToZero([p('a', 30_000, 95_000), p('b', 40_000, 90_000), p('c', 50_000, 100_000)], 'A')).toBeNull()
  })

  it('needs at least three finishers', () => {
    expect(heroToZero([p('hero', 30_000, 200_000), p('b', 40_000, 90_000)], 'A')).toBeNull()
  })

  it('only counts finishers — someone who gave up is not slowest at the sixth set', () => {
    const quit = game('q', '2026-10-01', [1, 2, 3, 4, 60_000], { gaveUp: true })
    const rows = [
      p('hero', 30_000, 200_000),
      p('b', 40_000, 90_000),
      { userId: quit.userId, stats: quit.stats },
    ]
    expect(heroToZero(rows, 'A')).toBeNull() // only two finishers
  })

  it('a tie at either end is no award', () => {
    expect(heroToZero([p('hero', 30_000, 200_000), p('b', 30_000, 90_000), p('c', 50_000, 100_000)], 'A')).toBeNull()
    expect(heroToZero([p('hero', 30_000, 200_000), p('b', 40_000, 200_000), p('c', 50_000, 100_000)], 'A')).toBeNull()
  })

  it('is Mode A only', () => {
    expect(heroToZero([p('hero', 30_000, 200_000), p('b', 40_000, 90_000), p('c', 50_000, 100_000)], 'B')).toBeNull()
  })
})

describe('zeroToHero', () => {
  /** A finisher whose fifth set came at `fifth` and who finished at `total`. */
  const p = (id: string, fifth: number, total: number) => {
    const g = six(id, '2026-10-01', fifth, total)
    return { userId: g.userId, stats: g.stats }
  }

  it('names the player slowest to five who finished first', () => {
    expect(zeroToHero([p('zero', 90_000, 95_000), p('b', 40_000, 100_000), p('c', 50_000, 110_000)], 'A')).toBe('zero')
  })

  it('is nobody when the slowest to five did not finish first', () => {
    expect(zeroToHero([p('a', 90_000, 120_000), p('b', 40_000, 100_000), p('c', 50_000, 110_000)], 'A')).toBeNull()
  })

  it('needs at least three finishers', () => {
    expect(zeroToHero([p('zero', 90_000, 95_000), p('b', 40_000, 100_000)], 'A')).toBeNull()
  })

  it('only counts finishers — someone who gave up was not “slowest to five”', () => {
    const quit = game('q', '2026-10-01', [1, 2, 3, 4, 200_000], { gaveUp: true })
    const rows = [
      p('zero', 90_000, 95_000),
      p('b', 40_000, 100_000),
      { userId: quit.userId, stats: quit.stats },
    ]
    expect(zeroToHero(rows, 'A')).toBeNull() // only two finishers
  })

  it('a tie at either end is no award', () => {
    expect(zeroToHero([p('zero', 90_000, 95_000), p('b', 90_000, 100_000), p('c', 50_000, 110_000)], 'A')).toBeNull()
    expect(zeroToHero([p('zero', 90_000, 95_000), p('b', 40_000, 95_000), p('c', 50_000, 110_000)], 'A')).toBeNull()
  })

  it('is Mode A only', () => {
    expect(zeroToHero([p('zero', 90_000, 95_000), p('b', 40_000, 100_000), p('c', 50_000, 110_000)], 'B')).toBeNull()
  })
})

describe('lostWins — Mode C', () => {
  /**
   * A Mode C finisher: one false Done at 5s costing `penalty`, the last set at
   * `lastSet`, and the winning Done at `done`. Times already include the penalty.
   */
  const c = (userId: string, lastSet: number, done: number, penalty = 0) => {
    const events: TelemetryEvent[] = []
    if (penalty > 0) events.push({ t_ms: 5_000, type: 'done_attempt', payload: { complete: false, penaltyMs: penalty } })
    events.push(
      { t_ms: lastSet, type: 'set_valid', payload: { cards: [0, 1, 2], setIndex: 0 } },
      { t_ms: done, type: 'done_attempt', payload: { complete: true, penaltyMs: 0 } },
      { t_ms: done, type: 'game_end', payload: { reason: 'completed' } },
    )
    return { userId, stats: deriveStats({ events } as GameRecord), ditheringMs: ditheringMs(events) }
  }

  it('names a dither that cost the win', () => {
    // dith: 60s without the 20s dither beats the 70s winner.
    expect(lostWins([c('win', 65_000, 70_000), c('dith', 60_000, 80_000)], 'C')).toEqual({
      dithered: ['dith'],
      cried: [],
    })
  })

  it('names penalties that cost the win', () => {
    // cry: 85s with 20s of penalties → 65s, beating 70s.
    expect(lostWins([c('win', 65_000, 70_000), c('cry', 84_000, 85_000, 20_000)], 'C')).toEqual({
      dithered: [],
      cried: ['cry'],
    })
  })

  it('can name the same player for both', () => {
    expect(lostWins([c('win', 65_000, 70_000), c('both', 60_000, 80_000, 15_000)], 'C')).toEqual({
      dithered: ['both'],
      cried: ['both'],
    })
  })

  it('is nothing when taking it off would only tie or still lose', () => {
    expect(lostWins([c('win', 65_000, 70_000), c('tie', 70_000, 80_000), c('slow', 75_000, 90_000, 10_000)], 'C')).toEqual({
      dithered: [],
      cried: [],
    })
  })

  it('never names the winner', () => {
    expect(lostWins([c('win', 10_000, 70_000, 30_000), c('b', 70_000, 90_000)], 'C').dithered).not.toContain('win')
  })

  it('ignores games given up, as the winner and as the would-be winner', () => {
    const q = c('quit', 1_000, 2_000)
    const quit = { ...q, stats: { ...q.stats, completed: false, abandoned: true } }
    expect(lostWins([quit, c('dith', 60_000, 80_000)], 'C')).toEqual({ dithered: [], cried: [] })
  })

  it('is Mode C only', () => {
    expect(lostWins([c('win', 65_000, 70_000), c('dith', 60_000, 80_000)], 'B')).toEqual({ dithered: [], cried: [] })
  })
})

describe('headToHead', () => {
  const g = (id: string, date: string, total: number) => ({ ...six(id, date, total - 10_000, total), perfect: false })
  const pair = (h: ReturnType<typeof headToHead>, a: string, b: string) =>
    h.find((p) => p.userIds.join('|') === [a, b].sort().join('|'))!
  const row = (p: ReturnType<typeof headToHead>[number], id: string) => p.rows.find((r) => r.userId === id)!

  const games = [
    g('mds', '2026-10-01', 90_000),
    g('rw', '2026-10-01', 80_000), // mds + rw: rw wins
    g('mds', '2026-10-02', 70_000),
    g('rw', '2026-10-02', 80_000),
    g('tm', '2026-10-02', 60_000), // all three: tm, then mds, then rw
    g('tm', '2026-10-03', 50_000), // tm alone
  ]

  it('counts every day a pair both played, whoever else did too', () => {
    const h = headToHead(games, 'A')
    expect(h.map((p) => [p.userIds, p.days])).toEqual([
      [['mds', 'rw'], 2],
      [['mds', 'tm'], 1],
      [['rw', 'tm'], 1],
    ])
  })

  it('gives each day’s 1st to the faster of the two, ignoring anyone else', () => {
    const h = headToHead(games, 'A')
    // Oct 2: tm was fastest overall, but between mds and rw it was mds.
    expect(row(pair(h, 'mds', 'rw'), 'mds')).toMatchObject({ games: 2, firstPlaces: 1 })
    expect(row(pair(h, 'mds', 'rw'), 'rw')).toMatchObject({ games: 2, firstPlaces: 1 })
    expect(row(pair(h, 'mds', 'tm'), 'tm')).toMatchObject({ games: 1, firstPlaces: 1 })
    expect(pair(h, 'mds', 'tm').rows).toHaveLength(2)
  })

  it('leaves out days played alone', () => {
    expect(headToHead([g('mds', '2026-10-01', 90_000), g('rw', '2026-10-02', 80_000)], 'A')).toEqual([])
  })

  it('counts a give-up as playing, and as losing to a finisher', () => {
    const quit = { ...game('rw', '2026-10-01', [1_000], { gaveUp: true }), perfect: false }
    const [p] = headToHead([g('mds', '2026-10-01', 90_000), quit], 'A')
    expect(row(p!, 'rw')).toMatchObject({ games: 1, firstPlaces: 0 })
    expect(row(p!, 'mds')).toMatchObject({ games: 1, firstPlaces: 1 })
  })
})

describe('fastestPerSetCount', () => {
  const s = (setCount: number, userId: string, timeMs: number, date = '2026-10-01') => ({
    setCount,
    record: rec(userId, date, timeMs),
  })

  it('keeps the five fastest for each set count, fastest first', () => {
    const out = fastestPerSetCount([
      s(6, 'a', 90_000), s(6, 'b', 60_000), s(6, 'c', 80_000), s(6, 'd', 70_000),
      s(6, 'e', 100_000), s(6, 'f', 50_000), // six solves: e, the slowest, drops off
      s(2, 'a', 20_000),
    ])
    expect(out.map((o) => o.setCount)).toEqual([2, 6])
    expect(out[1]!.records.map((r) => r.userId)).toEqual(['f', 'b', 'd', 'c', 'a'])
  })

  it('lets one player hold several places', () => {
    const out = fastestPerSetCount([s(4, 'mds', 50_000, '2026-10-01'), s(4, 'mds', 40_000, '2026-10-02'), s(4, 'rw', 45_000)])
    expect(out[0]!.records.map((r) => `${r.userId}@${r.puzzleDate}`)).toEqual([
      'mds@2026-10-02',
      'rw@2026-10-01',
      'mds@2026-10-01',
    ])
  })

  it('ranks the earlier day first on an exact tie', () => {
    const out = fastestPerSetCount([s(3, 'late', 30_000, '2026-10-05'), s(3, 'early', 30_000, '2026-10-02')])
    expect(out[0]!.records.map((r) => r.userId)).toEqual(['early', 'late'])
  })
})
