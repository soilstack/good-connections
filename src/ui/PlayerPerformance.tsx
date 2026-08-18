import { useEffect, useState } from 'react'
import type { Mode } from '../game/board'
import type { Superlative } from '../game/telemetry'
import { getPlayerHistory, type PlayerHistory } from '../lib/leagues'
import { formatTime } from './format'
import { PlayerPaceChart } from './PlayerPaceChart'
import { SolveTimelineView } from './SolveTimelineView'
import { Stat } from './Stat'

/**
 * One member's record in a league: how they are trending (the all-games pace
 * chart), what they average, and the games at the extremes. Any member can open
 * any other member — everyone here has already played the same boards.
 *
 * Every number comes from summarisePlayer / deriveStats over the stored event
 * logs. Nothing is precomputed, so nothing can drift.
 */

interface Props {
  leagueId: string
  leagueName: string
  mode: Mode
  userId: string
  /** The signed-in viewer, for the "(you)" marker. */
  currentUserId: string
  onBack: () => void
}

export function PlayerPerformance({
  leagueId,
  leagueName,
  mode,
  userId,
  currentUserId,
  onBack,
}: Props) {
  const [history, setHistory] = useState<PlayerHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setHistory(null)
    getPlayerHistory(leagueId, userId, mode)
      .then((h) => {
        if (active) setHistory(h)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId, userId, mode])

  if (error || !history) {
    return (
      <div className="summary">
        {error ? <p className="auth-error">{error}</p> : <p className="muted">Loading…</p>}
        <BackButton onBack={onBack} />
      </div>
    )
  }

  return (
    <PlayerPerformanceView
      history={history}
      leagueName={leagueName}
      mode={mode}
      isYou={userId === currentUserId}
      onBack={onBack}
    />
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
      ← Back
    </button>
  )
}

/** The page itself, given the data. Split out so it renders without a network. */
export function PlayerPerformanceView({
  history,
  leagueName,
  mode,
  isYou,
  onBack,
}: {
  history: PlayerHistory
  leagueName: string
  mode: Mode
  isYou: boolean
  onBack: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const s = history.summary
  const dateOf = new Map(history.games.map((g) => [g.id, g.puzzleDate]))
  const pct = (v: number) => `${Math.round(v * 100)}%`

  /** A best/worst row, or nothing if the player has no such game. */
  const mark = (label: string, sup: Superlative | null, render: (v: number) => string) =>
    sup === null ? null : (
      <li key={label} className="member-row">
        <span className="member-name">{label}</span>
        <span className="member-detail">
          {render(sup.value)} · {dateOf.get(sup.gameId) ?? '—'}
        </span>
      </li>
    )

  const marks = [
    mark('Fastest solve', s.fastest, (v) => formatTime(v, true)),
    mark('Most mistakes', s.mostErrors, (v) => `${v}`),
    mark('Longest stall between sets', s.longestStall, (v) => formatTime(v)),
    ...(mode === 'C' ? [mark('Most premature “done”s', s.mostFalseDones, (v) => `${v}`)] : []),
  ].filter((m) => m !== null)

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>
          {history.displayName}
          {isYou ? ' (you)' : ''}
        </h1>
        <p className="muted">
          {leagueName} · Mode {mode} · {s.gamesPlayed} game{s.gamesPlayed === 1 ? '' : 's'}
        </p>
      </header>

      {s.gamesPlayed === 0 ? (
        <p className="muted">No league games yet.</p>
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label="Avg solve"
              value={s.meanTotalTimeMs === null ? '—' : formatTime(s.meanTotalTimeMs)}
            />
            <Stat
              label="Avg to 1st set"
              value={s.meanTimeToFirstSetMs === null ? '—' : formatTime(s.meanTimeToFirstSetMs)}
            />
            <Stat
              label="Avg error rate"
              value={s.meanErrorRate === null ? '—' : pct(s.meanErrorRate)}
            />
            <Stat label="Solved" value={`${s.gamesCompleted}/${s.gamesPlayed}`} />
            <Stat label="Completion" value={pct(s.completionRate)} />
            <Stat label="Gave up" value={`${s.gamesGivenUp}`} />
          </div>
          <p className="muted stat-note">
            Averages cover completed games only — an abandoned game is shorter, so counting it
            would make giving up look like getting faster.
          </p>

          <section className="league-stats">
            <h2 className="section-label">Every game</h2>
            <PlayerPaceChart games={history.games} />
          </section>

          {marks.length > 0 && (
            <section className="league-stats">
              <h2 className="section-label section-label-gap">Bests and worsts</h2>
              <ol className="member-list">{marks}</ol>
            </section>
          )}

          <section className="leaderboard">
            <h2 className="section-label section-label-gap">History</h2>
            <ol className="leader-list">
              {history.games.map((g) => (
                <li key={g.id} className="leader-item">
                  <button
                    type="button"
                    className="leader-row no-rank"
                    aria-expanded={expanded === g.id}
                    onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  >
                    <span className="leader-name">{g.puzzleDate}</span>
                    <span className="leader-result">
                      {g.stats.completed
                        ? formatTime(g.stats.totalTimeMs ?? 0)
                        : `gave up · ${g.stats.setsFound}/${g.totalSets}`}
                    </span>
                  </button>
                  {expanded === g.id && <SolveTimelineView events={g.events} />}
                </li>
              ))}
            </ol>
            <p className="muted timeline-hint">Tap a game to see its solve timeline.</p>
          </section>
        </>
      )}

      <div className="summary-actions">
        <BackButton onBack={onBack} />
      </div>
    </div>
  )
}
