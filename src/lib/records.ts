/**
 * "Did the game on this day set a league record?" — for the congratulations on
 * the results page.
 *
 * Pure, taking the already-fetched league stats, so it is testable without a
 * database and costs no extra query. Type-only imports from ./leagues, which are
 * erased at build time, keep the Supabase client out of this module.
 */
import type { Mode } from '../game/board'
import type { LeagueStats } from './leagues'

export type RecordHeld =
  /** Mode A: one of the league's three fastest solves ever. */
  | { kind: 'top-three'; rank: 1 | 2 | 3; timeMs: number }
  /** Modes B and C: the fastest solve of a board with this many sets. */
  | { kind: 'set-count'; setCount: number; timeMs: number }

/**
 * The record, if any, that `userId`'s game on `puzzleDate` currently holds.
 *
 * "Currently holds", not "set": viewed on a later day, a record that has since
 * been beaten is gone, and one still standing is still worth saying. That is
 * also why nothing here calls it "new".
 *
 * Matches on user id AND date, because a player can hold several of the
 * top-three places with different games, and only the one on screen counts.
 */
export function recordHeld(
  stats: Pick<LeagueStats, 'topSolves' | 'fastestBySetCount'>,
  mode: Mode,
  userId: string,
  puzzleDate: string,
): RecordHeld | null {
  const mine = (r: { userId: string; puzzleDate: string }) =>
    r.userId === userId && r.puzzleDate === puzzleDate

  if (mode === 'A') {
    const i = stats.topSolves.slice(0, 3).findIndex(mine)
    if (i < 0) return null
    return { kind: 'top-three', rank: (i + 1) as 1 | 2 | 3, timeMs: stats.topSolves[i]!.timeMs }
  }

  const hit = stats.fastestBySetCount.find(({ record }) => mine(record))
  return hit ? { kind: 'set-count', setCount: hit.setCount, timeMs: hit.record.timeMs } : null
}
