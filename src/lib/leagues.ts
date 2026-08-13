import { supabase } from './supabase'
import { generateBoard, mulberry32, type Board, type Mode } from '../game/board'
import { deriveStats, type GameRecord, type GameStats, type TelemetryEvent } from '../game/telemetry'

/**
 * League data layer over Supabase. Board generation and stats stay in the pure
 * modules: today_puzzle() hands back a per-day seed and generateBoard() turns it
 * into the same board for everyone; the leaderboard runs deriveStats() over each
 * player's event log. The server stores no derived numbers, so nothing drifts.
 */

export interface League {
  id: string
  name: string
  timezone: string
  mode: Mode
  join_code: string
}

/** Leagues the signed-in user belongs to. */
export async function getMyLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('leagues(id, name, timezone, mode, join_code)')
  if (error) throw error
  const rows = (data ?? []) as unknown as { leagues: League | League[] | null }[]
  const leagues: League[] = []
  for (const row of rows) {
    if (!row.leagues) continue
    if (Array.isArray(row.leagues)) leagues.push(...row.leagues)
    else leagues.push(row.leagues)
  }
  return leagues
}

/** Join a league by its code; returns the league id. */
export async function joinLeague(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_league', { code: code.trim() })
  if (error) throw error
  return data as string
}

export interface TodayPuzzle {
  seed: number
  puzzleDate: string // YYYY-MM-DD, the league's local date
  mode: Mode
  board: Board
}

/** Fetch today's seed for a league and build its board with the pure generator. */
export async function getTodayPuzzle(leagueId: string): Promise<TodayPuzzle> {
  const { data, error } = await supabase.rpc('today_puzzle', { p_league: leagueId })
  if (error) throw error
  const row = data as { seed: number; puzzle_date: string; mode: Mode }
  const seed = Number(row.seed)
  const board = generateBoard(row.mode, mulberry32(seed))
  return { seed, puzzleDate: row.puzzle_date, mode: row.mode, board }
}

/** Post a completed/abandoned league game's event log to the server. */
export async function submitLeagueRecord(args: {
  leagueId: string
  puzzleDate: string
  mode: Mode
  totalSets: number
  startedAtMs: number
  events: TelemetryEvent[]
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('not signed in')
  const { error } = await supabase.from('game_records').insert({
    user_id: userId,
    context: 'league',
    league_id: args.leagueId,
    puzzle_date: args.puzzleDate,
    mode: args.mode,
    total_sets: args.totalSets,
    started_at: new Date(args.startedAtMs).toISOString(),
    events: args.events,
  })
  if (error) throw error
}

export interface LeaderboardRow {
  userId: string
  displayName: string
  stats: GameStats
}

/** Today's standings for a league: every member's game, ranked by solve time. */
export async function getLeaderboard(leagueId: string, puzzleDate: string): Promise<LeaderboardRow[]> {
  const { data: recs, error } = await supabase
    .from('game_records')
    .select('user_id, events')
    .eq('context', 'league')
    .eq('league_id', leagueId)
    .eq('puzzle_date', puzzleDate)
  if (error) throw error
  const records = (recs ?? []) as { user_id: string; events: TelemetryEvent[] }[]

  const userIds = [...new Set(records.map((r) => r.user_id))]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
    for (const p of (profs ?? []) as { id: string; display_name: string }[]) {
      names.set(p.id, p.display_name)
    }
  }

  const rows: LeaderboardRow[] = records.map((r) => ({
    userId: r.user_id,
    displayName: names.get(r.user_id) ?? '—',
    stats: deriveStats({ events: r.events } as GameRecord),
  }))

  // Completed games first, fastest total time first; unfinished games after.
  rows.sort((a, b) => {
    if (a.stats.completed !== b.stats.completed) return a.stats.completed ? -1 : 1
    return (a.stats.totalTimeMs ?? Infinity) - (b.stats.totalTimeMs ?? Infinity)
  })
  return rows
}
