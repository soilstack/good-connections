import { useEffect, useState } from 'react'
import type { Board, Mode } from '../game/board'
import type { GameStats } from '../game/telemetry'
import {
  getLeaderboard,
  getLeagueDates,
  getLeagueRoster,
  getLeagueStats,
  getPastPuzzleBoard,
  getTodayPuzzle,
  type LeaderboardRow,
  type LeagueStats,
} from '../lib/leagues'
import { recordHeld, type RecordHeld } from '../lib/records'
import { viewableDates } from '../lib/leagueDates'
import { isSlotClosed, zonedDateISO } from '../lib/time'
import { formatTime } from './format'
import { SolveTimelineView } from './SolveTimelineView'
import { LeagueStatsView } from './LeagueStatsView'
import { SameBoardCompare } from './SameBoardCompare'
import { canRevealSets, MatchSummary } from './MatchSummary'
import { NextPuzzle } from './NextPuzzle'
import { Stat } from './Stat'
import { PlayerPerformance } from './PlayerPerformance'

interface LeagueResultProps {
  leagueId: string
  leagueName: string
  /** Today's date in the league's own timezone. */
  puzzleDate: string
  /** IANA zone the league's day rolls over in. */
  timezone: string
  mode: Mode
  userId: string
  /**
   * Whether the viewer has played TODAY's puzzle. Gates today out of the date
   * picker until they have — every member plays the same board, so letting
   * someone browse today's standings first would hand them the answers.
   */
  playedToday?: boolean
  /** The just-finished game's stats, or omitted when the puzzle was already played earlier. */
  stats?: GameStats | null
  endReason?: 'completed' | 'abandoned' | null
  onExit: () => void
}

export function LeagueResult({
  leagueId,
  leagueName,
  puzzleDate,
  timezone,
  mode,
  userId,
  playedToday = true,
  stats,
  endReason,
  onExit,
}: LeagueResultProps) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  // Non-null = the member whose performance page has taken over the screen.
  const [viewing, setViewing] = useState<string | null>(null)
  // League members in join order — drives stable chart colours and the
  // "everyone has played" reveal gate. Null while loading or unavailable.
  const [roster, setRoster] = useState<string[] | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  // All-time league records. Fetched here rather than inside LeagueStatsView
  // because the page header needs them too, to congratulate a record.
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  // Which day is on screen, and every day that may be looked at. `date` stays
  // null until the list arrives when the viewer hasn't played today, since in
  // that case the day to open is "the most recent finished one", not today.
  const [dates, setDates] = useState<string[] | null>(null)
  const [date, setDate] = useState<string | null>(playedToday ? puzzleDate : null)

  const leagueToday = zonedDateISO(timezone, Date.now())
  const viewable = viewableDates(dates ?? [], leagueToday, playedToday)

  // The date list, and the roster. Both per-league, so they survive day changes.
  useEffect(() => {
    let active = true
    getLeagueDates(leagueId)
      .then((d) => {
        if (active) setDates(d)
      })
      .catch(() => {
        if (active) setDates([])
      })
    // The roster is a nice-to-have: a failure softens two features rather than
    // breaking the page, so it never touches `error`.
    getLeagueRoster(leagueId).then((ids) => {
      if (active) setRoster(ids)
    })
    return () => {
      active = false
    }
  }, [leagueId])

  // All-time stats. Per league, not per day, so switching days never refetches.
  // This page only mounts once the just-finished game has been saved, so a
  // record set a moment ago is already in what comes back.
  useEffect(() => {
    let active = true
    getLeagueStats(leagueId, mode)
      .then((st) => {
        if (active) setLeagueStats(st)
      })
      .catch((e) => {
        if (active) setStatsError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId, mode])

  // Land on the newest day the viewer is allowed to see, once we know it.
  useEffect(() => {
    if (date === null && viewable.length > 0) setDate(viewable[0]!)
  }, [date, viewable])

  // The day's leaderboard. Refetched whenever the chosen day changes; the board
  // is cleared with it so a previous day's cards can never linger on screen.
  useEffect(() => {
    if (date === null) return
    let active = true
    setRows(null)
    setBoard(null)
    getLeaderboard(leagueId, date)
      .then((r) => {
        if (active) setRows(r)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId, date])

  const isToday = date === puzzleDate
  const played = rows?.map((r) => r.userId) ?? []
  const reveal =
    rows && date
      ? canRevealSets({
          playedUserIds: played,
          roster,
          slotClosed: isSlotClosed(timezone, date, Date.now()),
          // Read off this day's own leaderboard, not the just-finished game,
          // so it stays right when the viewer flicks to another day.
          viewerCompleted: rows.some((r) => r.userId === userId && r.stats.completed),
        })
      : null

  // Only fetch the board once the sets may actually be shown. Today comes from
  // today_puzzle(); a finished day comes from past_puzzle(), which refuses any
  // date that is not over. Either way generateBoard() computes the solution
  // locally, so this is the same data the game itself had.
  useEffect(() => {
    if (!reveal || board || date === null) return
    let active = true
    const wanted = date
    const load = isToday
      ? getTodayPuzzle(leagueId).then((p) => (p.puzzleDate === wanted ? p.board : null))
      : getPastPuzzleBoard(leagueId, wanted)
    load
      .then((b) => {
        // Guard against a slow response landing after the day was switched.
        if (active && b && wanted === date) setBoard(b)
      })
      .catch(() => {
        /* no board, no cards — the letters still stand on their own */
      })
    return () => {
      active = false
    }
  }, [reveal, board, leagueId, date, isToday])

  if (viewing !== null) {
    return (
      <PlayerPerformance
        leagueId={leagueId}
        leagueName={leagueName}
        mode={mode}
        userId={viewing}
        currentUserId={userId}
        onBack={() => setViewing(null)}
      />
    )
  }

  // The just-finished game's numbers belong to the day it was played, so they
  // disappear as soon as the viewer flicks back to an earlier one.
  const showOwnStats = stats && isToday
  // Whether the viewer's game on the day on screen holds a league record.
  const held = leagueStats && date ? recordHeld(leagueStats, mode, userId, date) : null
  const i = date === null ? -1 : viewable.indexOf(date)
  // viewable is newest-first, so "older" is forward through the array.
  const older = i >= 0 && i < viewable.length - 1 ? viewable[i + 1]! : null
  const newer = i > 0 ? viewable[i - 1]! : null

  if (date === null) {
    return (
      <div className="summary">
        <header className="summary-head">
          <h1>{leagueName}</h1>
        </header>
        <p className="muted">
          {dates === null ? 'Loading…' : 'No finished games to show yet — play today’s puzzle.'}
        </p>
        <div className="summary-actions">
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>
          {showOwnStats
            ? endReason === 'completed'
              ? 'Solved!'
              : 'Gave up'
            : isToday
              ? 'Today’s puzzle'
              : 'Past puzzle'}
        </h1>
        <p className="muted">
          {leagueName} · {date}
          {isToday && !stats && ' · you’ve already played today'}
        </p>
        {isToday && <NextPuzzle timezone={timezone} />}
      </header>

      {viewable.length > 1 && (
        <nav className="day-nav" aria-label="Choose a day">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => older && setDate(older)}
            disabled={older === null}
            aria-label="Older day"
          >
            ←
          </button>
          <select
            className="day-select"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Day"
          >
            {viewable.map((d) => (
              <option key={d} value={d}>
                {d === puzzleDate ? `${d} (today)` : d}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => newer && setDate(newer)}
            disabled={newer === null}
            aria-label="Newer day"
          >
            →
          </button>
        </nav>
      )}

      {held && <RecordBanner held={held} />}

      {showOwnStats && (
        <div className="stats-grid">
          <Stat
            // A given-up game has a real elapsed time and always did —
            // deriveStats reads it off game_end whatever the reason. Printing
            // "—" threw away a number the log already had.
            label={stats.completed ? 'Your time' : 'Gave up at'}
            value={stats.totalTimeMs === null ? '—' : formatTime(stats.totalTimeMs, true)}
          />
          <Stat label="Sets found" value={`${stats.setsFound}`} />
          <Stat label="Mistakes" value={`${stats.errorCount}`} />
          {stats.penaltyMs > 0 && (
            <Stat label="Penalties" value={`+${formatTime(stats.penaltyMs)}`} />
          )}
        </div>
      )}

      <section className="leaderboard">
        <h2 className="section-label">{isToday ? 'Today’s leaderboard' : 'Leaderboard'}</h2>
        {error && <p className="auth-error">{error}</p>}
        {!rows && !error && <p className="muted">Loading…</p>}
        {rows && rows.length === 0 && <p className="muted">No entries yet.</p>}
        {rows && rows.length > 0 && (
          <>
          <ol className="leader-list">
            {rows.map((r, i) => (
              <li key={r.userId} className={`leader-item${r.userId === userId ? ' is-you' : ''}`}>
                <button
                  type="button"
                  className="leader-row"
                  aria-expanded={expanded === r.userId}
                  onClick={() => setExpanded(expanded === r.userId ? null : r.userId)}
                >
                  <span className="leader-rank">{i + 1}</span>
                  <span className="leader-name">
                    {r.displayName}
                    {r.userId === userId ? ' (you)' : ''}
                  </span>
                  <span className="leader-result">
                    {r.stats.completed
                      ? formatTime(r.stats.totalTimeMs ?? 0)
                      : `${r.stats.setsFound} found`}
                    {/* When they gave up matters: "5 found" alone reads the
                        same whether they quit at 40s or fought for six
                        minutes. Kept out of the ranked time above so it can
                        never be mistaken for a solve. */}
                    {!r.stats.completed && r.stats.totalTimeMs !== null && (
                      <span className="leader-sub">
                        gave up at {formatTime(r.stats.totalTimeMs)}
                      </span>
                    )}
                    {/* Penalties are already inside that time; naming them
                        separately shows how much of it was self-inflicted. */}
                    {r.stats.penaltyMs > 0 && (
                      <span className="leader-penalty">
                        incl. +{formatTime(r.stats.penaltyMs)}
                      </span>
                    )}
                  </span>
                </button>
                {expanded === r.userId && <SolveTimelineView events={r.events} />}
              </li>
            ))}
          </ol>
          <p className="muted timeline-hint">Tap a player to see their solve timeline.</p>
          </>
        )}
      </section>

      {rows && rows.length > 0 && (
        <MatchSummary
          rows={rows}
          currentUserId={userId}
          board={board}
          reveal={reveal}
          historic={!isToday}
        />
      )}

      {rows && (
        <SameBoardCompare
          rows={rows}
          currentUserId={userId}
          roster={roster}
          historic={!isToday}
        />
      )}

      <LeagueStatsView
        stats={leagueStats}
        error={statsError}
        mode={mode}
        currentUserId={userId}
        onSelectMember={setViewing}
      />

      <div className="summary-actions">
        <button type="button" className="btn btn-primary" onClick={onExit}>
          Back to menu
        </button>
      </div>
    </div>
  )
}

const RANK_WORD = { 1: 'fastest', 2: 'second-fastest', 3: 'third-fastest' } as const

/**
 * The congratulation. Says what the record IS rather than calling it new: viewed
 * on a later day it is a record the player still holds, which may not be new.
 */
export function RecordBanner({ held }: { held: RecordHeld }) {
  const time = formatTime(held.timeMs, true)
  return (
    <div className="record-banner" role="status">
      <span className="record-banner-icon" aria-hidden="true">
        {held.kind === 'top-three' && held.rank !== 1 ? (held.rank === 2 ? '🥈' : '🥉') : '🏆'}
      </span>
      <span>
        {held.kind === 'top-three' ? (
          <>
            <b>{time}</b> is the league’s <b>{RANK_WORD[held.rank]}</b> solve ever.
          </>
        ) : (
          <>
            {/* "an 8-set", "an 11-set": the article follows how the number
                is said, not how it is written. */}
            <b>{time}</b> is the league record for {held.setCount === 8 || held.setCount === 11 ? 'an' : 'a'}{' '}
            <b>{held.setCount}-set</b> board.
          </>
        )}
      </span>
    </div>
  )
}
