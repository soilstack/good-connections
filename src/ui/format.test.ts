import { describe, expect, it } from 'vitest'
import { formatClock, formatTime, tieBreakDigits } from './format'

describe('formatClock', () => {
  it('shows as many decimal places as asked, truncating rather than rounding', () => {
    expect(formatClock(63_249, 0)).toBe('1:03')
    expect(formatClock(63_249, 1)).toBe('1:03.2')
    expect(formatClock(63_249, 2)).toBe('1:03.24')
    expect(formatClock(63_249, 3)).toBe('1:03.249')
  })

  it('pads the decimals', () => {
    expect(formatClock(63_005, 3)).toBe('1:03.005')
    expect(formatClock(63_050, 2)).toBe('1:03.05')
  })

  it('agrees with formatTime', () => {
    for (const ms of [0, 999, 63_249, 359_999]) {
      expect(formatClock(ms, 0)).toBe(formatTime(ms))
      expect(formatClock(ms, 1)).toBe(formatTime(ms, true))
    }
  })
})

describe('tieBreakDigits', () => {
  it('leaves times in different seconds alone', () => {
    expect(tieBreakDigits([63_200, 89_000, 209_000])).toEqual([0, 0, 0])
  })

  it('adds tenths to two times that share a second', () => {
    // 1:03.2 and 1:03.7, then a clear third.
    expect(tieBreakDigits([63_200, 63_700, 89_000])).toEqual([1, 1, 0])
  })

  it('goes to hundredths, then milliseconds, only as far as needed', () => {
    expect(tieBreakDigits([63_210, 63_250])).toEqual([2, 2])
    expect(tieBreakDigits([63_211, 63_214])).toEqual([3, 3])
  })

  it('looks at both neighbours', () => {
    // The middle time ties the first at tenths and the last at seconds.
    expect(tieBreakDigits([63_210, 63_250, 63_900])).toEqual([2, 2, 1])
  })

  it('stops at milliseconds for an exact tie', () => {
    expect(tieBreakDigits([63_211, 63_211])).toEqual([3, 3])
  })

  it('handles none and one', () => {
    expect(tieBreakDigits([])).toEqual([])
    expect(tieBreakDigits([63_211])).toEqual([0])
  })
})
