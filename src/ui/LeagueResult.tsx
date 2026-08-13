import { useEffect, useState } from 'react'
import type { GameStats } from '../game/telemetry'
import { getLeaderboard, type LeaderboardRow } from '../lib/leagues'
import { formatTime } from './format'

interface LeagueResultProps {
  leagueId: string
  leagueName: string
  puzzleDate: string
  userId: string
  /** The just-finished game's stats, or omitted when the puzzle was already played earlier. */
  stats?: GameStats | null
  endReason?: 'completed' | 'abandoned' | null
  onExit: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

export function LeagueResult({
  leagueId,
  leagueName,
  puzzleDate,
  userId,
  stats,
  endReason,
  onExit,
}: LeagueResultProps) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>{stats ? (endReason === 'completed' ? 'Solved!' : 'Gave up') : 'Today’s puzzle'}</h1>
        <p className="muted">
          {leagueName} · {puzzleDate}
          {!stats && ' · you’ve already played today'}
        </p>
      </header>

      {stats && (
        <div className="stats-grid">
          <Stat
            label="Your time"
            value={stats.completed ? formatTime(stats.totalTimeMs ?? 0, true) : '—'}
          />
          <Stat label="Sets found" value={`${stats.setsFound}`} />
          <Stat label="Mistakes" value={`${stats.errorCount}`} />
        </div>
      )}

      <section className="leaderboard">
        <h2 className="section-label">Today’s leaderboard</h2>
        {error && <p className="auth-error">{error}</p>}
        {!rows && !error && <p className="muted">Loading…</p>}
        {rows && rows.length === 0 && <p className="muted">No entries yet.</p>}
        {rows && rows.length > 0 && (
          <ol className="leader-list">
            {rows.map((r, i) => (
              <li key={r.userId} className={`leader-row${r.userId === userId ? ' is-you' : ''}`}>
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
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="summary-actions">
        <button type="button" className="btn btn-primary" onClick={onExit}>
          Back to menu
        </button>
      </div>
    </div>
  )
}
