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
import type { LeagueStats, SoloRecord } from './leagues'

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

/**
 * Modes B and C: the {@link TOP_SOLVES} fastest completed solves for each
 * board size, fastest first, set counts in ascending order. Only set counts
 * someone has finished appear. A player may hold several places, as in Mode A's
 * top five; on an exact tie the earlier day ranks first.
 *
 * `solves` must be completed league games only.
 */
export function fastestPerSetCount(
  solves: readonly { setCount: number; record: SoloRecord }[],
): { setCount: number; records: SoloRecord[] }[] {
  const byCount = new Map<number, SoloRecord[]>()
  for (const { setCount, record } of solves) byCount.set(setCount, [...(byCount.get(setCount) ?? []), record])
  return [...byCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setCount, records]) => ({
      setCount,
      records: [...records]
        .sort((a, b) => a.timeMs - b.timeMs || a.puzzleDate.localeCompare(b.puzzleDate))
        .slice(0, TOP_SOLVES),
    }))
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

// --- the Results table --------------------------------------------------------

/** A league game for the Results table: a {@link PbGame} plus its rating. */
export interface ResultsGame extends PbGame {
  /** Rated "Perfect Play!" by findOrderString. */
  perfect: boolean
}

export interface ResultsRow {
  userId: string
  /** Days played, finished or not. */
  games: number
  /** Days with the fastest finished solve — shared on an exact tie, and still
   * a first place on a day nobody else played. */
  firstPlaces: number
  perfects: number
  /** Mode A: fastest time to the fifth set in a finished game. Null otherwise. */
  bestFirstFiveMs: number | null
}

/**
 * Each member's season in four numbers. Every count is per DAY, not per game
 * record, so a day that somehow holds two records still counts once.
 *
 * Times are recorded to the millisecond, so a tie for first is practically
 * impossible — but if one happens, both players get it.
 *
 * Like {@link personalBests}, `games` must be league games only.
 */
export function resultsTable(games: readonly ResultsGame[], mode: Mode): ResultsRow[] {
  // Fastest finished solve each day.
  const winning = new Map<string, number>()
  for (const g of games) {
    const t = g.stats.completed ? g.stats.totalTimeMs : null
    if (t !== null && t < (winning.get(g.puzzleDate) ?? Infinity)) winning.set(g.puzzleDate, t)
  }

  const byUser = new Map<string, { days: Set<string>; wins: Set<string>; perfect: Set<string>; five: number | null }>()
  for (const g of games) {
    const u = byUser.get(g.userId) ?? { days: new Set(), wins: new Set(), perfect: new Set(), five: null }
    u.days.add(g.puzzleDate)
    if (g.stats.completed && g.stats.totalTimeMs === winning.get(g.puzzleDate)) u.wins.add(g.puzzleDate)
    if (g.perfect) u.perfect.add(g.puzzleDate)
    const five = mode === 'A' ? timeToSetMs(g.stats, 5) : null
    if (five !== null && (u.five === null || five < u.five)) u.five = five
    byUser.set(g.userId, u)
  }

  return [...byUser.entries()]
    .map(([userId, u]) => ({
      userId,
      games: u.days.size,
      firstPlaces: u.wins.size,
      perfects: u.perfect.size,
      bestFirstFiveMs: u.five,
    }))
    .sort(
      (a, b) =>
        b.firstPlaces - a.firstPlaces ||
        b.perfects - a.perfects ||
        b.games - a.games ||
        a.userId.localeCompare(b.userId),
    )
}

// --- Hero to Zero -------------------------------------------------------------

/**
 * Mode A's notorious collapse: the player who was fastest to the fifth set and
 * then finished slowest of the day. Returns their user id, or null.
 *
 * Finishers only — someone who gave up never found the sixth set, so they are
 * not "slowest at it" — and at least three of them, because with two it only
 * means the lead changed hands. Both ends must be outright: a shared fastest or
 * shared slowest is no award.
 *
 * The caller decides WHEN to show it: the answer can change while people are
 * still playing, so only once everyone has played or the day is over.
 */
export function heroToZero(
  rows: readonly { userId: string; stats: GameStats }[],
  mode: Mode,
): string | null {
  return turnaround(rows, mode, 'hero-to-zero')
}

/**
 * Hero to Zero's mirror: the player who was slowest to the fifth set and then
 * finished fastest of the day. Same rules — Mode A, finishers only, at least
 * three of them, both ends outright — and the same caller rule on when.
 */
export function zeroToHero(
  rows: readonly { userId: string; stats: GameStats }[],
  mode: Mode,
): string | null {
  return turnaround(rows, mode, 'zero-to-hero')
}

function turnaround(
  rows: readonly { userId: string; stats: GameStats }[],
  mode: Mode,
  which: 'hero-to-zero' | 'zero-to-hero',
): string | null {
  if (mode !== 'A') return null
  const finishers = rows.flatMap((r) => {
    const five = timeToSetMs(r.stats, 5)
    const total = r.stats.totalTimeMs
    return r.stats.completed && five !== null && total !== null ? [{ userId: r.userId, five, total }] : []
  })
  if (finishers.length < 3) return null

  // Hero to Zero goes fastest-at-five to slowest-at-the-end; Zero to Hero the
  // other way round.
  const [atFive, atEnd] = which === 'hero-to-zero' ? [Math.min, Math.max] : [Math.max, Math.min]
  const fiveMark = atFive(...finishers.map((f) => f.five))
  const endMark = atEnd(...finishers.map((f) => f.total))
  const starts = finishers.filter((f) => f.five === fiveMark)
  const ends = finishers.filter((f) => f.total === endMark)
  if (starts.length !== 1 || ends.length !== 1) return null
  return starts[0]!.userId === ends[0]!.userId ? starts[0]!.userId : null
}

// --- Mode C: the win that got away ----------------------------------------------

export interface LostWins {
  /** Would have won with a zero dither: "Sat on your thumb too long!" */
  dithered: string[]
  /** Would have won with no false-Done penalties: "Cried 'Done!' too often!" */
  cried: string[]
}

/**
 * Mode C's two what-ifs: who lost the day to their own Done button. Each takes
 * ONE thing off a finisher's own time and leaves everyone else's as it was:
 *
 * - `dithered`: their final dither (finding the last set to pressing Done);
 * - `cried`: every penalty their premature Dones cost them.
 *
 * Only for someone who did not already win, and only when the reduced time
 * would win outright — matching the winner is not winning. A player can be in
 * both lists. Finishers only, on both sides: a give-up is no time to beat.
 *
 * Like {@link heroToZero}, the caller shows these only once the field is
 * complete, since a later finisher can change who won.
 */
export function lostWins(
  rows: readonly { userId: string; stats: GameStats; ditheringMs: number | null }[],
  mode: Mode,
): LostWins {
  const out: LostWins = { dithered: [], cried: [] }
  if (mode !== 'C') return out
  const finishers = rows.filter((r) => r.stats.completed && r.stats.totalTimeMs !== null)
  if (finishers.length < 2) return out
  const winning = Math.min(...finishers.map((r) => r.stats.totalTimeMs!))
  for (const r of finishers) {
    const total = r.stats.totalTimeMs!
    if (total === winning) continue
    if (r.ditheringMs !== null && r.ditheringMs > 0 && total - r.ditheringMs < winning) out.dithered.push(r.userId)
    if (r.stats.penaltyMs > 0 && total - r.stats.penaltyMs < winning) out.cried.push(r.userId)
  }
  return out
}

// --- Battle history: head to head ---------------------------------------------

/** Two players, and how it has gone on the days they both played. */
export interface HeadToHead {
  /** The pair, sorted by id. */
  userIds: [string, string]
  /** Days both of them played, whoever else did too. */
  days: number
  /**
   * The {@link resultsTable} over just those days and just these two, so a
   * "1st" is beating the other one: the faster finished solve of the pair.
   */
  rows: ResultsRow[]
}

/**
 * The Results table for every pair of players who have shared a board. Each
 * pair counts every day both played, regardless of who else did, so a day
 * three people played counts once for each of its three pairs.
 *
 * Most-shared pair first. Like {@link resultsTable}, `games` must be league
 * games only.
 */
export function headToHead(games: readonly ResultsGame[], mode: Mode): HeadToHead[] {
  const byDate = new Map<string, ResultsGame[]>()
  for (const g of games) byDate.set(g.puzzleDate, [...(byDate.get(g.puzzleDate) ?? []), g])

  const byPair = new Map<string, { userIds: [string, string]; dates: Set<string>; games: ResultsGame[] }>()
  for (const [date, day] of byDate) {
    const ids = [...new Set(day.map((g) => g.userId))].sort()
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const userIds: [string, string] = [ids[i]!, ids[j]!]
        const key = userIds.join('|')
        const p = byPair.get(key) ?? { userIds, dates: new Set(), games: [] }
        p.dates.add(date)
        p.games.push(...day.filter((g) => g.userId === userIds[0] || g.userId === userIds[1]))
        byPair.set(key, p)
      }
    }
  }

  return [...byPair.values()]
    .map((p) => ({ userIds: p.userIds, days: p.dates.size, rows: resultsTable(p.games, mode) }))
    .sort((a, b) => b.days - a.days || a.userIds.join('|').localeCompare(b.userIds.join('|')))
}
