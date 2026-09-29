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

  it('grades a canonical scan as perfect', () => {
    const o = findOrderString(sequence([0, 1, 2, 3, 4, 5]))!
    expect(o.text).toBe('ABCDEF')
    expect(o.displaced).toBe(0)
    expect(o.grade).toBe('perfect')
  })

  it('grades one set found out of turn as near', () => {
    // ABCFDE — F came early. Removing F alone restores the scan order, so
    // exactly one set is displaced, however many pairs that inverts.
    const o = findOrderString(sequence([0, 1, 2, 5, 3, 4]))!
    expect(o.text).toBe('ABCFDE')
    expect(o.displaced).toBe(1)
    expect(o.grade).toBe('near')
  })

  it('grades a genuinely scrambled order as jumbled', () => {
    const o = findOrderString(sequence([5, 2, 0, 4, 1, 3]))!
    expect(o.text).toBe('FCAEBD')
    expect(o.displaced).toBeGreaterThan(1)
    expect(o.grade).toBe('jumbled')
  })

  it('counts displacement by longest increasing run, not by inversions', () => {
    // A straight swap of two neighbours displaces one set, not two: BACDEF
    // reads as "B came early", which is the same shape of mistake as ABCFDE.
    const o = findOrderString(sequence([1, 0, 2, 3, 4, 5]))!
    expect(o.text).toBe('BACDEF')
    expect(o.displaced).toBe(1)
    expect(o.grade).toBe('near')
  })

  it('marks a re-submitted set in lower case, in place', () => {
    const o = findOrderString([found(1000, 0), found(2000, 1), dup(2500, 1), found(3000, 2)])!
    expect(o.text).toBe('ABbC')
  })

  it('ignores repeats when grading the order', () => {
    // A repeat is wasted time, not a scan-order mistake — the set was already
    // found in the right place.
    const clean = findOrderString(sequence([0, 1, 2]))!
    const withDup = findOrderString([found(1000, 0), dup(1500, 0), found(2000, 1), found(3000, 2)])!
    expect(withDup.grade).toBe(clean.grade)
    expect(withDup.displaced).toBe(clean.displaced)
  })

  it('handles a partial game, where the player gave up', () => {
    const o = findOrderString(sequence([0, 2, 4]))!
    expect(o.text).toBe('ACE')
    expect(o.grade).toBe('perfect') // what they did find, they found in order
  })

  it('is null when nothing was found', () => {
    expect(findOrderString([])).toBeNull()
    expect(findOrderString([done(1000, false, 5000)])).toBeNull()
  })

  it('handles a single find', () => {
    const o = findOrderString(sequence([3]))!
    expect(o.text).toBe('D')
    expect(o.grade).toBe('perfect')
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
