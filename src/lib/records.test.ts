import { describe, expect, it } from 'vitest'
import { recordHeld } from './records'
import type { SoloRecord } from './leagues'

const rec = (userId: string, puzzleDate: string, timeMs: number): SoloRecord => ({
  userId,
  displayName: userId,
  puzzleDate,
  timeMs,
})

describe('recordHeld — Mode A top three', () => {
  const stats = {
    topSolves: [rec('mds', '2026-10-01', 55_700), rec('tm', '2026-09-30', 58_000), rec('mds', '2026-09-12', 61_000)],
    fastestBySetCount: [],
  }

  it('names the rank of the game on screen', () => {
    expect(recordHeld(stats, 'A', 'mds', '2026-10-01')).toEqual({
      kind: 'top-three',
      rank: 1,
      timeMs: 55_700,
    })
    expect(recordHeld(stats, 'A', 'tm', '2026-09-30')).toMatchObject({ rank: 2 })
  })

  it('goes by the DAY, not just the player — one player can hold two places', () => {
    expect(recordHeld(stats, 'A', 'mds', '2026-09-12')).toMatchObject({ rank: 3 })
    expect(recordHeld(stats, 'A', 'mds', '2026-09-30')).toBeNull()
  })

  it('is nothing for a game outside the top three', () => {
    const four = { ...stats, topSolves: [...stats.topSolves, rec('aoife', '2026-10-02', 70_000)] }
    expect(recordHeld(four, 'A', 'aoife', '2026-10-02')).toBeNull()
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
