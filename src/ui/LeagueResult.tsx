import { useEffect, useState } from 'react'
import type { Mode } from '../game/board'
import type { GameStats } from '../game/telemetry'
import { getLeaderboard, type LeaderboardRow } from '../lib/leagues'
import { formatTime } from './format'
import { SolveTimelineView } from './SolveTimelineView'
import { LeagueStatsView } from './LeagueStatsView'
import { SameBoardCompare } from './SameBoardCompare'
import { MatchSummary } from './MatchSummary'
import { NextPuzzle } from './NextPuzzle'
import { Stat } from './Stat'
import { PlayerPerformance } from './PlayerPerformance'

interface LeagueResultProps {
  leagueId: string
  leagueName: string
  puzzleDate: string
  /** IANA zone the league's day rolls over in. */
  timezone: string
  mode: Mode
  userId: string
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
  stats,
  endReason,
  onExit,
}: LeagueResultProps) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  // Non-null = the member whose performance page has taken over the screen.
  const [viewing, setViewing] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getLeaderboard(leagueId, puzzleDate)
      .then((r) => {
        if (active) setRows(r)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId, puzzleDate])

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

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>{stats ? (endReason === 'completed' ? 'Solved!' : 'Gave up') : 'Today’s puzzle'}</h1>
        <p className="muted">
          {leagueName} · {puzzleDate}
          {!stats && ' · you’ve already played today'}
        </p>
        <NextPuzzle timezone={timezone} />
      </header>

      {stats && (
        <div className="stats-grid">
          <Stat
            label="Your time"
            value={stats.completed ? formatTime(stats.totalTimeMs ?? 0, true) : '—'}
          />
          <Stat label="Sets found" value={`${stats.setsFound}`} />
          <Stat label="Mistakes" value={`${stats.errorCount}`} />
          {stats.penaltyMs > 0 && (
            <Stat label="Penalties" value={`+${formatTime(stats.penaltyMs)}`} />
          )}
        </div>
      )}

      <section className="leaderboard">
        <h2 className="section-label">Today’s leaderboard</h2>
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

      {rows && rows.length > 0 && <MatchSummary rows={rows} currentUserId={userId} />}

      {rows && <SameBoardCompare rows={rows} currentUserId={userId} />}

      <LeagueStatsView
        leagueId={leagueId}
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
