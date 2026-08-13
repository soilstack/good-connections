import { describe, it, expect } from 'vitest'
import {
  GameRecorder,
  deriveStats,
  deriveTimeline,
  aggregateSolveTimes,
  completionRate,
  standings,
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
