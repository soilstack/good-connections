import { useEffect, useState } from 'react'
import type { Mode } from '../game/board'
import { getLeagueStats, type LeagueStats } from '../lib/leagues'
import { formatTime } from './format'

interface Props {
  leagueId: string
  mode: Mode
  currentUserId: string
}

export function LeagueStatsView({ leagueId, mode, currentUserId }: Props) {
  const [stats, setStats] = useState<LeagueStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getLeagueStats(leagueId, mode)
      .then((s) => {
        if (active) setStats(s)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId, mode])

  if (error) return <p className="auth-error">{error}</p>
  if (!stats) return <p className="muted">Loading records…</p>

  return (
    <section className="league-stats">
      <h2 className="section-label">{mode === 'A' ? 'Fastest solves' : 'Fastest by set count'}</h2>
      {mode === 'A' ? (
        stats.topSolves.length === 0 ? (
          <p className="muted">No completed solves yet.</p>
        ) : (
          <ol className="record-list">
            {stats.topSolves.map((r, i) => (
              <li key={i} className="record-row">
                <span className="record-rank">{i + 1}</span>
                <span className="record-name">{r.displayName}</span>
                <span className="record-meta">{r.puzzleDate}</span>
                <span className="record-time">{formatTime(r.timeMs, true)}</span>
              </li>
            ))}
          </ol>
        )
      ) : stats.fastestBySetCount.length === 0 ? (
        <p className="muted">No completed solves yet.</p>
      ) : (
        <ol className="record-list">
          {stats.fastestBySetCount.map(({ setCount, record }) => (
            <li key={setCount} className="record-row">
              <span className="record-rank">
                {setCount} set{setCount === 1 ? '' : 's'}
              </span>
              <span className="record-name">{record.displayName}</span>
              <span className="record-meta">{record.puzzleDate}</span>
              <span className="record-time">{formatTime(record.timeMs, true)}</span>
            </li>
          ))}
        </ol>
      )}

      <h2 className="section-label section-label-gap">Members</h2>
      <ol className="member-list">
        {stats.members.map((m) => (
          <li key={m.userId} className={`member-row${m.userId === currentUserId ? ' is-you' : ''}`}>
            <span className="member-name">
              {m.displayName}
              {m.userId === currentUserId ? ' (you)' : ''}
            </span>
            <span className="member-detail">
              {m.bestTimeMs === null ? 'no solve yet' : `best ${formatTime(m.bestTimeMs)}`}
              {` · ${m.gamesCompleted}/${m.gamesPlayed} solved · ${Math.round(m.completionRate * 100)}%`}
              {m.currentStreak > 0 ? ` · streak ${m.currentStreak}` : ''}
            </span>
          </li>
        ))}
      </ol>

      {stats.notables.length > 0 && (
        <>
          <h2 className="section-label section-label-gap">Notable</h2>
          <ol className="member-list">
            {stats.notables.map((n, i) => (
              <li key={i} className="member-row">
                <span className="member-name">{n.label}</span>
                <span className="member-detail">
                  {n.displayName} · {n.unit === 'time' ? formatTime(n.value) : n.value} ·{' '}
                  {n.puzzleDate}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
