import { describe, expect, it } from 'vitest'
import { ditheringMs, findOrderString } from './telemetry'
import type { TelemetryEvent } from './telemetry'

const found = (t: number, setIndex: number): TelemetryEvent => ({
  t_ms: t,
  type: 'set_valid',
  payload: { cards: [0, 1, 2], setIndex },
})
const dup = (t: number, setIndex: number): TelemetryEvent => ({
  t_ms: t,
  type: 'set_duplicate',
  payload: { cards: [0, 1, 2], setIndex },
})
const done = (t: number, complete: boolean, penaltyMs = 0): TelemetryEvent => ({
  t_ms: t,
  type: 'done_attempt',
  payload: { complete, penaltyMs },
})

const bad = (t: number): TelemetryEvent => ({
  t_ms: t,
  type: 'set_invalid',
  payload: { cards: [0, 1, 2] },
})
const end = (t: number, reason: 'completed' | 'abandoned' = 'completed'): TelemetryEvent => ({
  t_ms: t,
  type: 'game_end',
  payload: { reason },
})

/** Sets found in the given order, one second apart. */
const sequence = (indices: number[]) => indices.map((idx, i) => found((i + 1) * 1000, idx))

describe('findOrderString', () => {
  /** A finished game: the given events, then a completed game_end. */
  const done_ = (events: TelemetryEvent[]) => [...events, end(99_000)]

  it('letters the finds in the order they happened', () => {
    expect(findOrderString(done_(sequence([0, 1, 2])))!.text).toBe('ABC')
  })

  describe('the string', () => {
    it('marks a re-submitted set in lower case, in place', () => {
      const o = findOrderString([found(1000, 0), found(2000, 1), dup(2500, 1), found(3000, 2)])!
      expect(o.text).toBe('ABbC')
    })

    it('marks a false set as x, in place', () => {
      // The example from the notes: ABCbDxxEF.
      const o = findOrderString([
        found(1000, 0),
        found(2000, 1),
        found(3000, 2),
        dup(3500, 1),
        found(4000, 3),
        bad(4500),
        bad(4800),
        found(5000, 4),
        found(6000, 5),
      ])!
      expect(o.text).toBe('ABCbDxxEF')
    })

    it('letters beyond F for a board with many sets', () => {
      expect(findOrderString(sequence([6, 7]))!.text).toBe('GH')
    })

    it('is null when nothing was found', () => {
      expect(findOrderString([])).toBeNull()
      expect(findOrderString([bad(1000), done(2000, false, 5000)])).toBeNull()
    })
  })

  describe('the rating', () => {
    it('perfect: a clean scan with no repeats and no false sets', () => {
      const o = findOrderString(done_(sequence([0, 1, 2, 3, 4, 5])))!
      expect(o.text).toBe('ABCDEF')
      expect(o.rating).toBe('perfect')
    })

    it('perfect: an exact reverse sweep counts too', () => {
      expect(findOrderString(done_(sequence([5, 4, 3, 2, 1, 0])))!.rating).toBe('perfect')
    })

    it('almost perfect: a clean scan with a repeat', () => {
      const o = findOrderString(
        done_([found(1000, 0), found(2000, 1), found(3000, 2), dup(3500, 2), found(4000, 3)]),
      )!
      expect(o.text).toBe('ABCcD')
      expect(o.rating).toBe('almost-perfect')
    })

    it('almost perfect in reverse as well', () => {
      const o = findOrderString(
        done_([found(1000, 3), dup(1500, 3), found(2000, 2), found(3000, 1), found(4000, 0)]),
      )!
      expect(o.text).toBe('DdCBA')
      expect(o.rating).toBe('almost-perfect')
    })

    it('one false set rules out both labels, even in perfect order', () => {
      const o = findOrderString(done_([found(1000, 0), bad(1500), found(2000, 1), found(3000, 2)]))!
      expect(o.text).toBe('AxBC')
      expect(o.rating).toBe('other')
    })

    it('a set out of turn is "other", however clean otherwise', () => {
      expect(findOrderString(done_(sequence([0, 1, 2, 5, 3, 4])))!.rating).toBe('other')
    })

    it('an order that changes direction is not a sweep', () => {
      const o = findOrderString(done_(sequence([5, 4, 3, 0, 1, 2])))!
      expect(o.text).toBe('FEDABC')
      expect(o.rating).toBe('other')
    })

    it('a game that was given up earns neither label', () => {
      // A, C, E in order looks tidy, but they did not find everything.
      const o = findOrderString([...sequence([0, 2, 4]), end(9_000, 'abandoned')])!
      expect(o.text).toBe('ACE')
      expect(o.rating).toBe('other')
    })

    it('a log with no ending yet earns neither label', () => {
      expect(findOrderString(sequence([0, 1, 2]))!.rating).toBe('other')
    })

    it('a single find in a completed game is perfect', () => {
      expect(findOrderString(done_(sequence([3])))!.rating).toBe('perfect')
    })
  })
})

describe('ditheringMs', () => {
  it('measures the last set to the winning “done”', () => {
    const events = [found(10_000, 0), found(20_000, 1), done(26_500, true)]
    expect(ditheringMs(events)).toBe(6_500)
  })

  it('ignores premature dones', () => {
    // The 5s press came before the last set was found; only the final,
    // successful press ends the dithering window.
    const events = [
      found(10_000, 0),
      done(15_000, false, 5_000),
      found(30_000, 1),
      done(33_000, true),
    ]
    expect(ditheringMs(events)).toBe(3_000)
  })

  it('is zero when they hit done immediately', () => {
    expect(ditheringMs([found(10_000, 0), done(10_000, true)])).toBe(0)
  })

  it('is null without a successful done — Modes A and B end themselves', () => {
    expect(ditheringMs([found(10_000, 0), found(20_000, 1)])).toBeNull()
  })

  it('is null for a game abandoned after a premature done', () => {
    expect(ditheringMs([found(10_000, 0), done(15_000, false, 5_000)])).toBeNull()
  })

  it('is null when no set was ever found', () => {
    expect(ditheringMs([done(9_000, true)])).toBeNull()
  })

  it('never goes negative', () => {
    // Defensive: a malformed log must not produce a negative "thinking time".
    expect(ditheringMs([found(20_000, 0), done(10_000, true)])).toBe(0)
  })
})
