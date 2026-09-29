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

/** Sets found in the given order, one second apart. */
const sequence = (indices: number[]) => indices.map((idx, i) => found((i + 1) * 1000, idx))

describe('findOrderString', () => {
  it('letters the finds in the order they happened', () => {
    expect(findOrderString(sequence([0, 1, 2]))!.text).toBe('ABC')
  })

  it('marks a canonical scan as perfect', () => {
    const o = findOrderString(sequence([0, 1, 2, 3, 4, 5]))!
    expect(o.text).toBe('ABCDEF')
    expect(o.perfect).toBe(true)
  })

  it('marks an exact REVERSE sweep as perfect too', () => {
    // Working the board bottom-up is just as systematic as top-down; only the
    // direction differs. Scan order still records which way they swept.
    const o = findOrderString(sequence([5, 4, 3, 2, 1, 0]))!
    expect(o.text).toBe('FEDCBA')
    expect(o.perfect).toBe(true)
  })

  it('is not perfect when one set comes out of turn', () => {
    expect(findOrderString(sequence([0, 1, 2, 5, 3, 4]))!.perfect).toBe(false)
    expect(findOrderString(sequence([1, 0, 2, 3, 4, 5]))!.perfect).toBe(false)
  })

  it('is not perfect for an order that changes direction', () => {
    // Descending then ascending is not one sweep, however tidy each half looks.
    const o = findOrderString(sequence([5, 4, 3, 0, 1, 2]))!
    expect(o.text).toBe('FEDABC')
    expect(o.perfect).toBe(false)
  })

  it('is not perfect for a scrambled order', () => {
    const o = findOrderString(sequence([5, 2, 0, 4, 1, 3]))!
    expect(o.text).toBe('FCAEBD')
    expect(o.perfect).toBe(false)
  })

  it('marks a re-submitted set in lower case, in place', () => {
    const o = findOrderString([found(1000, 0), found(2000, 1), dup(2500, 1), found(3000, 2)])!
    expect(o.text).toBe('ABbC')
  })

  it('does not let a repeat spoil a clean sweep', () => {
    // Re-finding a set is wasted time, not an ordering mistake — and scan
    // order, the metric of record, ignores repeats too.
    const o = findOrderString([found(1000, 0), dup(1500, 0), found(2000, 1), found(3000, 2)])!
    expect(o.text).toBe('AaBC')
    expect(o.perfect).toBe(true)
  })

  it('does not let a repeat spoil a clean REVERSE sweep either', () => {
    // Same rule in both directions: the repeat is shown, but only first finds
    // decide whether the sweep was clean.
    const o = findOrderString([found(1000, 3), dup(1500, 3), found(2000, 2), found(3000, 1), found(4000, 0)])!
    expect(o.text).toBe('DdCBA')
    expect(o.perfect).toBe(true)
  })

  it('still fails a reverse sweep that is genuinely out of order', () => {
    const o = findOrderString([found(1000, 3), dup(1500, 3), found(2000, 1), found(3000, 2), found(4000, 0)])!
    expect(o.text).toBe('DdBCA')
    expect(o.perfect).toBe(false)
  })

  it('handles a partial game, where the player gave up', () => {
    const o = findOrderString(sequence([0, 2, 4]))!
    expect(o.text).toBe('ACE')
    expect(o.perfect).toBe(true) // what they found, they found in order
  })

  it('is null when nothing was found', () => {
    expect(findOrderString([])).toBeNull()
    expect(findOrderString([done(1000, false, 5000)])).toBeNull()
  })

  it('treats a single find as perfect', () => {
    const o = findOrderString(sequence([3]))!
    expect(o.text).toBe('D')
    expect(o.perfect).toBe(true)
  })

  it('letters beyond F for a board with many sets', () => {
    expect(findOrderString(sequence([6, 7]))!.text).toBe('GH')
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
