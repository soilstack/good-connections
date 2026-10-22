/**
 * "Did the game on this day set a league record?" — for the congratulations on
 * the results page.
 *
 * Pure, taking the already-fetched league stats, so it is testable without a
 * database and costs no extra query. Type-only imports from ./leagues, which are
 * erased at build time, keep the Supabase client out of this module.
 */
import type { Mode } from '../game/board'
import { timeToSetMs, type GameStats } from '../game/telemetry'
import type { LeagueStats } from './leagues'

/** How many of the fastest Mode A solves the league lists, and congratulates. */
export const TOP_SOLVES = 5

export type RecordHeld =
  /** Mode A: one of the league's five fastest solves ever. */
  | { kind: 'top-five'; rank: 1 | 2 | 3 | 4 | 5; timeMs: number }
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
 * top-five places with different games, and only the one on screen counts.
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
    const i = stats.topSolves.slice(0, TOP_SOLVES).findIndex(mine)
    if (i < 0) return null
    return { kind: 'top-five', rank: (i + 1) as 1 | 2 | 3 | 4 | 5, timeMs: stats.topSolves[i]!.timeMs }
  }

  const hit = stats.fastestBySetCount.find(({ record }) => mine(record))
  return hit ? { kind: 'set-count', setCount: hit.setCount, timeMs: hit.record.timeMs } : null
}

// --- personal bests ---------------------------------------------------------

/** One league game, as much of it as a personal best needs. */
export interface PbGame {
  userId: string
  puzzleDate: string
  /** Sets on that day's board. */
  setCount: number
  stats: GameStats
}

export interface PersonalBest {
  userId: string
  puzzleDate: string
  /** The whole solve, or (Mode A only) the time to the fifth set. */
  kind: 'solve' | 'first-five'
  timeMs: number
  /** The best it beat. */
  previousMs: number
  /** Modes B and C: the board size this best is for. */
  setCount?: number
}

/**
 * Every game that beat its player's own best so far — "set" a personal best,
 * unlike {@link recordHeld}'s "currently holds", because a PB is something that
 * happened on a day and stays true of it after a later one beats it.
 *
 * - Mode A: the solve time, and separately the time to the fifth set.
 * - Modes B and C: the solve time, compared only against boards with the same
 *   number of sets — a 1-set and a 10-set board are not the same race.
 *
 * Completed games only, on both sides of the comparison: a given-up game is
 * short, so letting it count would make quitting look like a best. A player's
 * first finished game is never a best (nothing to beat), and a tie is not one.
 *
 * `games` must already be league games only — getLeagueStats filters on
 * context in its query, so practice can never set a league personal best.
 */
export function personalBests(games: readonly PbGame[], mode: Mode): PersonalBest[] {
  type Run = { date: string; timeMs: number }
  // Keyed by player, kind and (B/C) set count: one running best per key.
  type Entry = { userId: string; kind: PersonalBest['kind']; setCount: number | undefined; runs: Run[] }
  const runs = new Map<string, Entry>()
  const add = (g: PbGame, kind: PersonalBest['kind'], timeMs: number | null) => {
    if (timeMs === null) return
    const setCount = mode === 'A' ? undefined : g.setCount
    const key = `${g.userId}|${kind}|${setCount ?? ''}`
    const entry = runs.get(key) ?? { userId: g.userId, kind, setCount, runs: [] }
    entry.runs.push({ date: g.puzzleDate, timeMs })
    runs.set(key, entry)
  }
  for (const g of games) {
    if (!g.stats.completed) continue
    add(g, 'solve', g.stats.totalTimeMs)
    if (mode === 'A') add(g, 'first-five', timeToSetMs(g.stats, 5))
  }

  const out: PersonalBest[] = []
  for (const { userId, kind, setCount, runs: list } of runs.values()) {
    // One time per day — the day's best, should a day ever hold two records.
    const byDate = new Map<string, number>()
    for (const r of list) byDate.set(r.date, Math.min(r.timeMs, byDate.get(r.date) ?? Infinity))
    const days = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    let best = days[0]?.[1] ?? Infinity
    for (const [date, timeMs] of days.slice(1)) {
      if (timeMs < best) {
        out.push({
          userId,
          puzzleDate: date,
          kind,
          timeMs,
          previousMs: best,
          ...(setCount === undefined ? {} : { setCount }),
        })
        best = timeMs
      }
    }
  }
  return out.sort((a, b) => a.puzzleDate.localeCompare(b.puzzleDate))
}
