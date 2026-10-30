import { describe, expect, it } from 'vitest'
import { mockingRoll } from './mocking'

describe('mockingRoll', () => {
  it('is the same every time for the same player and day', () => {
    expect(mockingRoll('mds', '2026-10-30')).toEqual(mockingRoll('mds', '2026-10-30'))
  })

  it('rolls separately for each player and each day', () => {
    // Over a handful of keys, not every roll can come out identical.
    const rolls = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((u) => JSON.stringify(mockingRoll(u, '2026-10-30')))
    expect(new Set(rolls).size).toBeGreaterThan(1)
    const days = ['01', '02', '03', '04', '05', '06', '07', '08'].map((d) =>
      JSON.stringify(mockingRoll('mds', `2026-10-${d}`)),
    )
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('comes out about 30% SpongeBob, 20% Ha HAW!, 50% silent', () => {
    const n = 20_000
    const counts = { spongebob: 0, haw: 0, silent: 0 }
    for (let i = 0; i < n; i++) counts[mockingRoll(`player-${i}`, '2026-10-30').verdict]++
    expect(counts.spongebob / n).toBeCloseTo(0.3, 1)
    expect(counts.haw / n).toBeCloseTo(0.2, 1)
    expect(counts.silent / n).toBeCloseTo(0.5, 1)
  })

  it('spells "perfect play?" with every character its own colour', () => {
    const { letters } = mockingRoll('mds', '2026-10-30')
    expect(letters.map((l) => l.ch).join('').toLowerCase()).toBe('perfect play?')
    expect(new Set(letters.map((l) => l.colour)).size).toBe(letters.length)
  })
})
