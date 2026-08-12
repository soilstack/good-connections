/**
 * Telemetry: the append-only event log and the statistics derived from it.
 *
 * This is the reason the app exists. It is pure and dependency-free — the clock
 * is injected, storage is someone else's job — so the exact same records that
 * go to localStorage in slice 1 are POSTed to the server unchanged in slice 3.
 * Only the transport changes.
 *
 * Two rules keep practice out of league scoring, and both are enforced here:
 *   1. Every record carries an explicit `context`. One pipeline, one schema —
 *      practice is a flag, never a parallel system.
 *   2. Every aggregate takes `context` (and `mode`) as REQUIRED arguments, so
 *      forgetting to filter is a compile error, not a silently wrong number.
 */

import type { Mode } from './board'

/** League play and practice share one pipeline; this flag is what separates them. */
export type GameContext = 'league' | 'practice'

/** Board index of a card (0..boardSize-1), not its deck id. Events are board-relative. */
export type CardIndex = number

/**
 * One entry in the append-only log. `t_ms` is milliseconds since board reveal;
 * `type` and `payload` describe what happened. Everything is derived from this
 * — nothing summary is stored, so nothing can drift from the log.
 */
export type TelemetryEvent =
  | { t_ms: number; type: 'card_select'; payload: { card: CardIndex } }
  | { t_ms: number; type: 'card_deselect'; payload: { card: CardIndex } }
  | { t_ms: number; type: 'set_valid'; payload: { cards: [CardIndex, CardIndex, CardIndex]; setIndex: number } }
  | { t_ms: number; type: 'set_invalid'; payload: { cards: [CardIndex, CardIndex, CardIndex] } }
  | { t_ms: number; type: 'deal'; payload: { added: number } }
  | { t_ms: number; type: 'abandon_prompt'; payload: Record<string, never> }
  | { t_ms: number; type: 'abandon_cancel'; payload: Record<string, never> }
  | { t_ms: number; type: 'game_end'; payload: { reason: 'completed' | 'abandoned' } }

export type TelemetryEventType = TelemetryEvent['type']

/**
 * One game's record: the event log plus the minimal metadata needed to place it
 * (who, which context, which mode). No derived statistics live here — those are
 * computed on read by {@link deriveStats}. `totalSets` is a property of the
 * board (the system always knows it), not a summary, so it is safe to store.
 */
export interface GameRecord {
  readonly id: string
  readonly player: string
  readonly context: GameContext
  readonly mode: Mode
  /** Total sets on the board. Mode A is always 6; Mode B is system-known. */
  readonly totalSets: number
  /** Wall-clock epoch ms at board reveal, for ordering a player's history. */
  readonly startedAtMs: number
  /** Optional link to a stored league board (slice 3). */
  readonly boardId?: string
  readonly events: TelemetryEvent[]
}

/**
 * Accumulates the event log for a single game. Pure given its injected clock:
 * `now()` supplies wall-clock ms, and every event is stamped relative to the
 * reveal time captured at construction. No React, no storage, no globals.
 */
export class GameRecorder {
  private readonly id: string
  private readonly player: string
  private readonly context: GameContext
  private readonly mode: Mode
  private readonly totalSets: number
  private readonly boardId: string | undefined
  private readonly now: () => number
  private readonly startedAtMs: number
  private readonly events: TelemetryEvent[] = []

  constructor(opts: {
    id: string
    player: string
    context: GameContext
    mode: Mode
    totalSets: number
    now: () => number
    boardId?: string
  }) {
    this.id = opts.id
    this.player = opts.player
    this.context = opts.context
    this.mode = opts.mode
    this.totalSets = opts.totalSets
    this.boardId = opts.boardId
    this.now = opts.now
    this.startedAtMs = opts.now()
  }

  /** Milliseconds since board reveal, per the injected clock. */
  private t(): number {
    return this.now() - this.startedAtMs
  }

  cardSelect(card: CardIndex): void {
    this.events.push({ t_ms: this.t(), type: 'card_select', payload: { card } })
  }

  cardDeselect(card: CardIndex): void {
    this.events.push({ t_ms: this.t(), type: 'card_deselect', payload: { card } })
  }

  setValid(cards: [CardIndex, CardIndex, CardIndex], setIndex: number): void {
    this.events.push({ t_ms: this.t(), type: 'set_valid', payload: { cards, setIndex } })
  }

  setInvalid(cards: [CardIndex, CardIndex, CardIndex]): void {
    this.events.push({ t_ms: this.t(), type: 'set_invalid', payload: { cards } })
  }

  deal(added: number): void {
    this.events.push({ t_ms: this.t(), type: 'deal', payload: { added } })
  }

  abandonPrompt(): void {
    this.events.push({ t_ms: this.t(), type: 'abandon_prompt', payload: {} })
  }

  abandonCancel(): void {
    this.events.push({ t_ms: this.t(), type: 'abandon_cancel', payload: {} })
  }

  end(reason: 'completed' | 'abandoned'): void {
    this.events.push({ t_ms: this.t(), type: 'game_end', payload: { reason } })
  }

  /** Snapshot the accumulated record. The events array is copied defensively. */
  record(): GameRecord {
    const record: GameRecord = {
      id: this.id,
      player: this.player,
      context: this.context,
      mode: this.mode,
      totalSets: this.totalSets,
      startedAtMs: this.startedAtMs,
      events: this.events.slice(),
    }
    return this.boardId === undefined ? record : { ...record, boardId: this.boardId }
  }
}

/** Everything worth knowing about one game, all derived from its event log. */
export interface GameStats {
  /** t_ms of game_end, or null if the game never ended. */
  totalTimeMs: number | null
  /** t_ms of the first valid set, or null if none was found. */
  timeToFirstSetMs: number | null
  /** Gaps between consecutive valid sets (length = setsFound - 1). */
  setIntervalsMs: number[]
  setsFound: number
  /** Number of invalid set attempts. */
  errorCount: number
  /** Invalid attempts as a fraction of all attempts; 0 when there were none. */
  errorRate: number
  completed: boolean
  abandoned: boolean
  /** How many times the give-up prompt was opened (near-misses included). */
  abandonPrompts: number
}

/** Derive a game's statistics from its log. Never stored — computed on read. */
export function deriveStats(record: GameRecord): GameStats {
  const validTimes: number[] = []
  let errorCount = 0
  let abandonPrompts = 0
  let totalTimeMs: number | null = null
  let completed = false
  let abandoned = false

  for (const ev of record.events) {
    switch (ev.type) {
      case 'set_valid':
        validTimes.push(ev.t_ms)
        break
      case 'set_invalid':
        errorCount++
        break
      case 'abandon_prompt':
        abandonPrompts++
        break
      case 'game_end':
        totalTimeMs = ev.t_ms
        completed = ev.payload.reason === 'completed'
        abandoned = ev.payload.reason === 'abandoned'
        break
      default:
        break
    }
  }

  const setIntervalsMs: number[] = []
  for (let i = 1; i < validTimes.length; i++) {
    setIntervalsMs.push(validTimes[i]! - validTimes[i - 1]!)
  }

  const attempts = validTimes.length + errorCount
  return {
    totalTimeMs,
    timeToFirstSetMs: validTimes.length > 0 ? validTimes[0]! : null,
    setIntervalsMs,
    setsFound: validTimes.length,
    errorCount,
    errorRate: attempts > 0 ? errorCount / attempts : 0,
    completed,
    abandoned,
    abandonPrompts,
  }
}

/**
 * Records matching a context and mode. The obvious place for a silent bug is a
 * query that forgets this filter, so `context` and `mode` are required and there
 * is no default — omitting either fails to compile. Modes are never mixed in one
 * aggregate (a 2-set and a 5-set Mode B board are different games).
 */
function select(records: readonly GameRecord[], context: GameContext, mode: Mode): GameRecord[] {
  return records.filter((r) => r.context === context && r.mode === mode)
}

export interface SolveTimeAggregate {
  gamesCompleted: number
  meanTotalTimeMs: number | null
  meanTimeToFirstSetMs: number | null
}

/**
 * Aggregate solve times over COMPLETED games only. An abandoned game has a
 * shorter elapsed time, so counting it would reward giving up — it is excluded
 * here and shows up only in {@link completionRate}.
 */
export function aggregateSolveTimes(
  records: readonly GameRecord[],
  context: GameContext,
  mode: Mode,
): SolveTimeAggregate {
  const completed = select(records, context, mode)
    .map(deriveStats)
    .filter((s) => s.completed)

  if (completed.length === 0) {
    return { gamesCompleted: 0, meanTotalTimeMs: null, meanTimeToFirstSetMs: null }
  }

  const meanTotalTimeMs = mean(completed.map((s) => s.totalTimeMs ?? 0))
  const firstSetTimes = completed
    .map((s) => s.timeToFirstSetMs)
    .filter((t): t is number => t !== null)

  return {
    gamesCompleted: completed.length,
    meanTotalTimeMs,
    meanTimeToFirstSetMs: firstSetTimes.length > 0 ? mean(firstSetTimes) : null,
  }
}

/**
 * Fraction of games (in the given context and mode) that were completed rather
 * than abandoned. This is where abandonment belongs, and the reason the
 * statistic is worth having.
 */
export function completionRate(
  records: readonly GameRecord[],
  context: GameContext,
  mode: Mode,
): number {
  const games = select(records, context, mode).map(deriveStats)
  const ended = games.filter((s) => s.completed || s.abandoned)
  if (ended.length === 0) return 0
  return ended.filter((s) => s.completed).length / ended.length
}

export interface StandingRow {
  player: string
  gamesCompleted: number
  meanTotalTimeMs: number
}

/**
 * League standings for one context and mode: mean solve time per player over
 * their completed games, fastest first. Practice records filter out by
 * construction, so no amount of practising can move a league leaderboard.
 */
export function standings(
  records: readonly GameRecord[],
  context: GameContext,
  mode: Mode,
): StandingRow[] {
  const byPlayer = new Map<string, number[]>()
  for (const record of select(records, context, mode)) {
    const stats = deriveStats(record)
    if (!stats.completed || stats.totalTimeMs === null) continue
    const times = byPlayer.get(record.player) ?? []
    times.push(stats.totalTimeMs)
    byPlayer.set(record.player, times)
  }

  const rows: StandingRow[] = []
  for (const [player, times] of byPlayer) {
    rows.push({ player, gamesCompleted: times.length, meanTotalTimeMs: mean(times) })
  }
  // Fastest mean first; ties broken by player id for a stable, deterministic order.
  rows.sort((a, b) => a.meanTotalTimeMs - b.meanTotalTimeMs || a.player.localeCompare(b.player))
  return rows
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
