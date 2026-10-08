import { describe, expect, it } from 'vitest'
import { deriveStats, finalSetGapMs, timeToSetMs, type GameRecord, type TelemetryEvent } from './telemetry'

/** Sets found at the given times, then the game ends as given. */
function game(times: number[], reason: 'completed' | 'abandoned' = 'completed') {
  const events: TelemetryEvent[] = times.map((t, i) => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex: i },
  }))
  events.push({ t_ms: (times.at(-1) ?? 0) + 1, type: 'game_end', payload: { reason } })
  return deriveStats({ events } as GameRecord)
}

describe('timeToSetMs', () => {
  const six = game([5_000, 12_000, 20_000, 31_000, 44_000, 90_000])

  it('is when the fifth set was found, whatever the sixth took', () => {
    expect(timeToSetMs(six, 5)).toBe(44_000)
  })

  it('agrees with the set times for every n', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => timeToSetMs(six, n))).toEqual([
      5_000, 12_000, 20_000, 31_000, 44_000, 90_000,
    ])
  })

  it('is null for a game that was given up, however fast the first five', () => {
    expect(timeToSetMs(game([5_000, 6_000, 7_000, 8_000, 9_000], 'abandoned'), 5)).toBeNull()
  })

  it('is null when the board had fewer sets than asked for', () => {
    expect(timeToSetMs(game([5_000, 9_000]), 5)).toBeNull()
  })

  it('is null for nonsense n', () => {
    expect(timeToSetMs(six, 0)).toBeNull()
  })
})

describe('finalSetGapMs', () => {
  it('is the gap before the last find', () => {
    expect(finalSetGapMs(game([5_000, 12_000, 20_000, 31_000, 44_000, 90_000]))).toBe(46_000)
  })

  it('is the whole time to first set on a one-set board', () => {
    // The final set and the first set are the same set.
    expect(finalSetGapMs(game([37_000]))).toBe(37_000)
  })

  it('is null for a game that was given up — the final set was never found', () => {
    expect(finalSetGapMs(game([5_000, 12_000], 'abandoned'))).toBeNull()
  })

  it('is null when nothing was found', () => {
    expect(finalSetGapMs(game([], 'abandoned'))).toBeNull()
  })
})
