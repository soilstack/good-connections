import { describe, it, expect } from 'vitest'
import {
  GameRecorder,
  deriveStats,
  deriveTimeline,
  aggregateSolveTimes,
  completionRate,
  matchHighlights,
  scanOrderScore,
  standings,
  summarisePlayer,
  type GameRecord,
  type TelemetryEvent,
} from './telemetry'

/** A fake clock: hand it a list of timestamps and it returns them in order. */
function fakeClock(times: number[]): () => number {
  let i = 0
  return () => times[Math.min(i++, times.length - 1)]!
}

/** Build a minimal completed game record with the given valid/invalid timings. */
function completedGame(opts: {
  id: string
  player: string
  context: 'league' | 'practice'
  mode: 'A' | 'B'
  totalSets: number
  validAt: number[] // t_ms of each set_valid
  invalidAt?: number[] // t_ms of each set_invalid
  endAt: number
}): GameRecord {
  const events: TelemetryEvent[] = []
  for (const t of opts.validAt) {
    events.push({ t_ms: t, type: 'set_valid', payload: { cards: [0, 1, 2], setIndex: 0 } })
  }
  for (const t of opts.invalidAt ?? []) {
    events.push({ t_ms: t, type: 'set_invalid', payload: { cards: [0, 1, 2] } })
  }
  events.push({ t_ms: opts.endAt, type: 'game_end', payload: { reason: 'completed' } })
  events.sort((a, b) => a.t_ms - b.t_ms)
  return {
    id: opts.id,
    player: opts.player,
    context: opts.context,
    mode: opts.mode,
    totalSets: opts.totalSets,
    startedAtMs: 0,
    events,
  }
}

describe('GameRecorder', () => {
  it('stamps events with t_ms relative to board reveal', () => {
    // now() is called once at construction (start=1000), then per event.
    const clock = fakeClock([1000, 1500, 1800, 2000])
    const rec = new GameRecorder({
      id: 'g1',
      player: 'alice',
      context: 'practice',
      mode: 'A',
      totalSets: 6,
      now: clock,
    })
    rec.cardSelect(3) // t=500
    rec.cardSelect(7) // t=800
    rec.setValid([3, 7, 9], 2) // t=1000
    const record = rec.record()
    expect(record.startedAtMs).toBe(1000)
    expect(record.events.map((e) => e.t_ms)).toEqual([500, 800, 1000])
    expect(record.events[0]).toEqual({ t_ms: 500, type: 'card_select', payload: { card: 3 } })
    expect(record.events[2]).toEqual({
      t_ms: 1000,
      type: 'set_valid',
      payload: { cards: [3, 7, 9], setIndex: 2 },
    })
  })

  it('records the game-end reason and near-miss abandon prompts', () => {
    const clock = fakeClock([0, 100, 200, 300])
    const rec = new GameRecorder({
      id: 'g2',
      player: 'alice',
      context: 'practice',
      mode: 'B',
      totalSets: 3,
      now: clock,
    })
    rec.abandonPrompt() // t=100
    rec.abandonCancel() // t=200
    rec.end('abandoned') // t=300
    const stats = deriveStats(rec.record())
    expect(stats.abandonPrompts).toBe(1)
    expect(stats.abandoned).toBe(true)
    expect(stats.completed).toBe(false)
  })

  it('produces a plain-JSON-serialisable record (transport is the only thing that changes later)', () => {
    const clock = fakeClock([0, 50])
    const rec = new GameRecorder({
      id: 'g3',
      player: 'p',
      context: 'league',
      mode: 'A',
      totalSets: 6,
      now: clock,
    })
    rec.setInvalid([1, 2, 3]) // t=50
    const record = rec.record()
    const roundTripped = JSON.parse(JSON.stringify(record))
    expect(roundTripped).toEqual(record)
  })
})

describe('deriveStats', () => {
  it('counts already-found re-selections as duplicates, separate from errors', () => {
    const record: GameRecord = {
      id: 'dup',
      player: 'p',
      context: 'league',
      mode: 'A',
      totalSets: 6,
      startedAtMs: 0,
      events: [
        { t_ms: 100, type: 'set_valid', payload: { cards: [0, 1, 2], setIndex: 0 } },
        { t_ms: 200, type: 'set_duplicate', payload: { cards: [0, 1, 2], setIndex: 0 } },
        { t_ms: 300, type: 'set_invalid', payload: { cards: [3, 4, 5] } },
        { t_ms: 400, type: 'game_end', payload: { reason: 'abandoned' } },
      ],
    }
    const s = deriveStats(record)
    expect(s.duplicateCount).toBe(1)
    expect(s.errorCount).toBe(1)
    expect(s.setsFound).toBe(1)
    // Duplicates are not attempts: error rate is 1 invalid of (1 valid + 1 invalid).
    expect(s.errorRate).toBeCloseTo(1 / 2)
  })

  it('derives time-to-first-set, intervals, totals, and error rate from the log', () => {
    const record = completedGame({
      id: 'g',
      player: 'p',
      context: 'practice',
      mode: 'A',
      totalSets: 6,
      validAt: [1000, 3000, 6000],
      invalidAt: [500, 2000],
      endAt: 8000,
    })
    const s = deriveStats(record)
    expect(s.setsFound).toBe(3)
    expect(s.timeToFirstSetMs).toBe(1000)
    expect(s.setIntervalsMs).toEqual([2000, 3000]) // 3000-1000, 6000-3000
    expect(s.errorCount).toBe(2)
    expect(s.errorRate).toBeCloseTo(2 / 5) // 2 invalid of 5 total attempts
    expect(s.totalTimeMs).toBe(8000)
    expect(s.completed).toBe(true)
    expect(s.abandoned).toBe(false)
  })

  it('reports null time-to-first-set and zero error rate for a game with no attempts', () => {
    const record: GameRecord = {
      id: 'empty',
      player: 'p',
      context: 'practice',
      mode: 'B',
      totalSets: 2,
      startedAtMs: 0,
      events: [{ t_ms: 4200, type: 'game_end', payload: { reason: 'abandoned' } }],
    }
    const s = deriveStats(record)
    expect(s.timeToFirstSetMs).toBeNull()
    expect(s.setIntervalsMs).toEqual([])
    expect(s.errorRate).toBe(0)
    expect(s.totalTimeMs).toBe(4200)
    expect(s.completed).toBe(false)
  })
})

describe('Mode C penalties', () => {
  it('folds penalties into event times and counts premature dones', () => {
    const rec = new GameRecorder({
      id: 'c',
      player: 'p',
      context: 'practice',
      mode: 'C',
      totalSets: 2,
      now: fakeClock([1000, 1200, 1200, 3000]),
    })
    rec.doneAttempt(false, 5000) // t = 1200-1000 + 0 = 200
    rec.addPenalty(5000)
    rec.setValid([0, 1, 2], 0) // t = 1200-1000 + 5000 = 5200
    rec.doneAttempt(true, 0) // t = 3000-1000 + 5000 = 7000
    const record = rec.record()
    expect(record.events.map((e) => [e.type, e.t_ms])).toEqual([
      ['done_attempt', 200],
      ['set_valid', 5200],
      ['done_attempt', 7000],
    ])
    const s = deriveStats(record)
    expect(s.falseDones).toBe(1)
    expect(s.penaltyMs).toBe(5000)
    expect(s.setsFound).toBe(1)
  })
})

describe('deriveTimeline', () => {
  it('reconstructs per-set timing with false and already-found gaps', () => {
    const record: GameRecord = {
      id: 't',
      player: 'p',
      context: 'league',
      mode: 'A',
      totalSets: 6,
      startedAtMs: 0,
      events: [
        { t_ms: 500, type: 'set_invalid', payload: { cards: [0, 1, 2] } },
        { t_ms: 1000, type: 'set_valid', payload: { cards: [3, 4, 5], setIndex: 0 } },
        { t_ms: 1200, type: 'set_duplicate', payload: { cards: [3, 4, 5], setIndex: 0 } },
        { t_ms: 1500, type: 'set_invalid', payload: { cards: [6, 7, 8] } },
        { t_ms: 3000, type: 'set_valid', payload: { cards: [6, 7, 9], setIndex: 1 } },
        { t_ms: 3500, type: 'set_invalid', payload: { cards: [1, 2, 3] } },
        { t_ms: 4000, type: 'game_end', payload: { reason: 'abandoned' } },
      ],
    }
    const t = deriveTimeline(record)
    expect(t.steps).toHaveLength(2)
    expect(t.steps[0]).toMatchObject({ setIndex: 0, atMs: 1000, sincePrevMs: 1000, falseBefore: 1, duplicatesBefore: 0 })
    expect(t.steps[1]).toMatchObject({ setIndex: 1, atMs: 3000, sincePrevMs: 2000, falseBefore: 1, duplicatesBefore: 1 })
    expect(t.trailingFalse).toBe(1)
    expect(t.trailingDuplicates).toBe(0)
    expect(t.endMs).toBe(4000)
    expect(t.completed).toBe(false)
  })
})

describe('aggregation excludes abandoned games from solve times', () => {
  it('averages solve time over completed games only — abandoning must not lower the mean', () => {
    const records: GameRecord[] = [
      completedGame({ id: 'a', player: 'p', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 100000 }),
      completedGame({ id: 'b', player: 'p', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 200000 }),
      // an abandoned game with a deliberately tiny elapsed time
      {
        id: 'c',
        player: 'p',
        context: 'league',
        mode: 'A',
        totalSets: 6,
        startedAtMs: 0,
        events: [{ t_ms: 500, type: 'game_end', payload: { reason: 'abandoned' } }],
      },
    ]
    const agg = aggregateSolveTimes(records, 'league', 'A')
    expect(agg.gamesCompleted).toBe(2)
    expect(agg.meanTotalTimeMs).toBe(150000) // (100000+200000)/2, the 500ms abandon excluded
  })

  it('feeds abandonment into completion rate, where it belongs', () => {
    const records: GameRecord[] = [
      completedGame({ id: 'a', player: 'p', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 100 }),
      {
        id: 'c',
        player: 'p',
        context: 'league',
        mode: 'A',
        totalSets: 6,
        startedAtMs: 0,
        events: [{ t_ms: 500, type: 'game_end', payload: { reason: 'abandoned' } }],
      },
    ]
    expect(completionRate(records, 'league', 'A')).toBeCloseTo(0.5)
  })
})

describe('matchHighlights', () => {
  const found = (t: number, setIndex: number): TelemetryEvent => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex },
  })

  it('names the longest stall between sets, not the slow start', () => {
    // 40s to get going, then 10s, then a 90s wall, then 5s.
    const h = matchHighlights([found(40_000, 2), found(50_000, 0), found(140_000, 5), found(145_000, 3)])
    expect(h.hardest).toEqual({ setIndex: 5, ordinal: 3, atMs: 140_000, sincePrevMs: 90_000 })
  })

  it('reports the last set found, whether or not the game finished', () => {
    const events = [found(10_000, 1), found(25_000, 4)]
    expect(matchHighlights([...events, { t_ms: 30_000, type: 'game_end', payload: { reason: 'abandoned' } }]).last)
      .toEqual({ setIndex: 4, ordinal: 2, atMs: 25_000, sincePrevMs: 15_000 })
  })

  it('has no hardest set until there are two finds to span', () => {
    expect(matchHighlights([found(10_000, 1)])).toEqual({
      hardest: null,
      last: { setIndex: 1, ordinal: 1, atMs: 10_000, sincePrevMs: 10_000 },
    })
    expect(matchHighlights([])).toEqual({ hardest: null, last: null })
  })

  it('keeps the earlier set when two gaps tie', () => {
    const h = matchHighlights([found(10_000, 0), found(70_000, 1), found(130_000, 2)])
    expect(h.hardest?.setIndex).toBe(1)
  })
})

describe('scanOrderScore', () => {
  /** A game whose sets were found in the given board order. */
  const inOrder = (order: number[]): TelemetryEvent[] =>
    order.map((setIndex, i) => ({
      t_ms: 10_000 * (i + 1),
      type: 'set_valid' as const,
      payload: { cards: [0, 1, 2] as [number, number, number], setIndex },
    }))

  it('scores a perfect scan at 1', () => {
    const s = scanOrderScore(inOrder([0, 1, 2, 3, 4, 5]))!
    expect(s.inOrderPairs).toBe(15)
    expect(s.totalPairs).toBe(15)
    expect(s.inOrderRate).toBe(1)
    expect(s.tau).toBe(1)
  })

  it('scores the exact reverse at 0', () => {
    const s = scanOrderScore(inOrder([5, 4, 3, 2, 1, 0]))!
    expect(s.inOrderPairs).toBe(0)
    expect(s.inOrderRate).toBe(0)
    expect(s.tau).toBe(-1)
  })

  it('charges one adjacent swap exactly one pair', () => {
    const s = scanOrderScore(inOrder([1, 0, 2, 3, 4, 5]))!
    expect(s.inOrderPairs).toBe(14)
    expect(s.inOrderRate).toBeCloseTo(14 / 15)
  })

  it('is a rate, so it does not punish a near-perfect run for one late find', () => {
    // Found the last set first, then the rest in order: only 5 pairs inverted,
    // though an exact-position measure would score this at zero.
    const s = scanOrderScore(inOrder([5, 0, 1, 2, 3, 4]))!
    expect(s.inOrderPairs).toBe(10)
    expect(s.inOrderRate).toBeCloseTo(10 / 15)
  })

  it('scores a partial game over the sets actually found', () => {
    const s = scanOrderScore(inOrder([0, 3, 1, 5]))!
    expect(s.setsFound).toBe(4)
    expect(s.totalPairs).toBe(6)
    expect(s.inOrderPairs).toBe(5) // only (3,1) is out of order
  })

  it('refuses to score too few sets, where the number would be noise', () => {
    expect(scanOrderScore(inOrder([0, 1, 2]))).toBeNull()
    expect(scanOrderScore(inOrder([1, 0]))).toBeNull()
    expect(scanOrderScore([])).toBeNull()
  })

  it('ignores everything that is not a find', () => {
    const events: TelemetryEvent[] = [
      { t_ms: 1, type: 'card_select', payload: { card: 4 } },
      ...inOrder([0, 1, 2, 3]),
      { t_ms: 9, type: 'set_invalid', payload: { cards: [0, 1, 2] } },
      { t_ms: 10, type: 'set_duplicate', payload: { cards: [0, 1, 2], setIndex: 0 } },
      { t_ms: 11, type: 'game_end', payload: { reason: 'completed' } },
    ]
    expect(scanOrderScore(events)?.inOrderRate).toBe(1)
  })
})

describe('summarisePlayer', () => {
  const abandoned = (id: string, opts: { validAt: number[]; endAt: number; invalid?: number }): GameRecord => {
    const events: TelemetryEvent[] = opts.validAt.map((t) => ({
      t_ms: t,
      type: 'set_valid' as const,
      payload: { cards: [0, 1, 2] as [number, number, number], setIndex: 0 },
    }))
    for (let i = 0; i < (opts.invalid ?? 0); i++) {
      events.push({ t_ms: 1, type: 'set_invalid', payload: { cards: [0, 1, 2] } })
    }
    events.push({ t_ms: opts.endAt, type: 'game_end', payload: { reason: 'abandoned' } })
    events.sort((a, b) => a.t_ms - b.t_ms)
    return { id, player: 'p', context: 'league', mode: 'A', totalSets: 6, startedAtMs: 0, events }
  }
  const done = (id: string, o: { validAt: number[]; endAt: number; invalidAt?: number[] }) =>
    completedGame({ id, player: 'p', context: 'league', mode: 'A', totalSets: 6, ...o })

  it('counts give-ups without letting them into the averages', () => {
    const s = summarisePlayer(
      [
        done('a', { validAt: [10_000, 40_000], endAt: 100_000 }),
        done('b', { validAt: [20_000, 60_000], endAt: 200_000 }),
        abandoned('c', { validAt: [5_000], endAt: 8_000 }),
      ],
      'league',
      'A',
    )
    expect(s.gamesPlayed).toBe(3)
    expect(s.gamesCompleted).toBe(2)
    expect(s.gamesGivenUp).toBe(1)
    expect(s.completionRate).toBeCloseTo(2 / 3)
    expect(s.meanTotalTimeMs).toBe(150_000) // the 8s give-up is not in here
    expect(s.meanTimeToFirstSetMs).toBe(15_000) // nor its 5s first set
  })

  it('takes the fastest only from games that finished', () => {
    const s = summarisePlayer(
      [
        done('a', { validAt: [1], endAt: 100_000 }),
        abandoned('quit', { validAt: [1], endAt: 900 }), // "fastest" if we were careless
      ],
      'league',
      'A',
    )
    expect(s.fastest).toEqual({ gameId: 'a', value: 100_000 })
  })

  it('draws the worsts from every game, given up or not', () => {
    const s = summarisePlayer(
      [
        done('a', { validAt: [10_000, 20_000], endAt: 30_000, invalidAt: [1_000] }),
        abandoned('c', { validAt: [1_000, 200_000], endAt: 210_000, invalid: 9 }),
      ],
      'league',
      'A',
    )
    expect(s.mostErrors).toEqual({ gameId: 'c', value: 9 })
    expect(s.longestStall).toEqual({ gameId: 'c', value: 199_000 })
  })

  it('is empty, not NaN, for a player with no games', () => {
    const s = summarisePlayer([], 'league', 'A')
    expect(s).toMatchObject({
      gamesPlayed: 0,
      gamesCompleted: 0,
      gamesGivenUp: 0,
      completionRate: 0,
      meanTotalTimeMs: null,
      meanTimeToFirstSetMs: null,
      meanErrorRate: null,
      fastest: null,
      mostErrors: null,
      longestStall: null,
      mostFalseDones: null,
    })
  })

  it('ignores practice games and other modes', () => {
    const records: GameRecord[] = [
      done('L', { validAt: [1], endAt: 100_000 }),
      completedGame({ id: 'P', player: 'p', context: 'practice', mode: 'A', totalSets: 6, validAt: [1], endAt: 1_000 }),
      completedGame({ id: 'B', player: 'p', context: 'league', mode: 'B', totalSets: 3, validAt: [1], endAt: 2_000 }),
    ]
    const s = summarisePlayer(records, 'league', 'A')
    expect(s.gamesPlayed).toBe(1)
    expect(s.meanTotalTimeMs).toBe(100_000)
  })

  it('averages scan order over completed games long enough to score', () => {
    const withOrder = (id: string, order: number[], reason: 'completed' | 'abandoned') => {
      const events: TelemetryEvent[] = order.map((setIndex, i) => ({
        t_ms: 10_000 * (i + 1),
        type: 'set_valid' as const,
        payload: { cards: [0, 1, 2] as [number, number, number], setIndex },
      }))
      events.push({ t_ms: 99_000, type: 'game_end', payload: { reason } })
      return { id, player: 'p', context: 'league', mode: 'A', totalSets: 6, startedAtMs: 0, events } as GameRecord
    }
    const s = summarisePlayer(
      [
        withOrder('perfect', [0, 1, 2, 3, 4, 5], 'completed'), // rate 1
        withOrder('reversed', [5, 4, 3, 2, 1, 0], 'completed'), // rate 0
        withOrder('quit', [0, 1, 2, 3, 4, 5], 'abandoned'), // excluded: not completed
        withOrder('short', [0, 1], 'completed'), // excluded: too few sets
      ],
      'league',
      'A',
    )
    expect(s.scanOrder).toEqual({ rate: 0.5, games: 2 })
  })

  it('has no scan order at all when nothing qualifies', () => {
    expect(summarisePlayer([], 'league', 'A').scanOrder).toBeNull()
  })

  it('reports false dones as a superlative', () => {
    const withDones = (id: string, falseDones: number): GameRecord => ({
      id,
      player: 'p',
      context: 'league',
      mode: 'C',
      totalSets: 4,
      startedAtMs: 0,
      events: [
        ...Array.from({ length: falseDones }, (_, i) => ({
          t_ms: 1_000 * (i + 1),
          type: 'done_attempt' as const,
          payload: { complete: false, penaltyMs: 5_000 },
        })),
        { t_ms: 60_000, type: 'done_attempt', payload: { complete: true, penaltyMs: 0 } },
        { t_ms: 60_000, type: 'game_end', payload: { reason: 'completed' } },
      ],
    })
    const s = summarisePlayer([withDones('x', 1), withDones('y', 3)], 'league', 'C')
    expect(s.mostFalseDones).toEqual({ gameId: 'y', value: 3 })
  })
})

describe('standings never move because of practice games', () => {
  it('is unchanged when the same players practise heavily', () => {
    const league: GameRecord[] = [
      completedGame({ id: 'L1', player: 'alice', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 60000 }),
      completedGame({ id: 'L2', player: 'bob', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 90000 }),
    ]
    const before = standings(league, 'league', 'A')
    expect(before.map((r) => r.player)).toEqual(['alice', 'bob']) // faster first

    // Now seed a pile of blisteringly fast PRACTICE games for both players.
    const withPractice: GameRecord[] = [
      ...league,
      ...Array.from({ length: 40 }, (_, i) =>
        completedGame({
          id: `P${i}`,
          player: i % 2 === 0 ? 'alice' : 'bob',
          context: 'practice',
          mode: 'A',
          totalSets: 6,
          validAt: [1],
          endAt: 1000, // absurdly fast
        }),
      ),
    ]
    const after = standings(withPractice, 'league', 'A')
    expect(after).toEqual(before)
  })

  it('does not mix modes in one leaderboard', () => {
    const records: GameRecord[] = [
      completedGame({ id: 'A1', player: 'alice', context: 'league', mode: 'A', totalSets: 6, validAt: [1], endAt: 50000 }),
      completedGame({ id: 'B1', player: 'bob', context: 'league', mode: 'B', totalSets: 3, validAt: [1], endAt: 10000 }),
    ]
    const modeA = standings(records, 'league', 'A')
    expect(modeA.map((r) => r.player)).toEqual(['alice']) // bob's Mode B game is not here
  })
})
