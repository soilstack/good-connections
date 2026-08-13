import type { Board } from '../game/board'
import type { GameStats } from '../game/telemetry'
import type { Triple } from '../game/set'
import { Card } from './Card'
import { formatTime } from './format'

interface SummaryProps {
  board: Board
  stats: GameStats
  endReason: 'completed' | 'abandoned'
  /** Solution sets the player did not find (already computed by the hook). */
  missedSets: Triple[]
  onPlayAgain: () => void
  onMenu: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function meanInterval(stats: GameStats): string {
  if (stats.setIntervalsMs.length === 0) return '—'
  const mean = stats.setIntervalsMs.reduce((a, b) => a + b, 0) / stats.setIntervalsMs.length
  return formatTime(mean, true)
}

export function Summary({ board, stats, endReason, missedSets, onPlayAgain, onMenu }: SummaryProps) {
  const total = board.sets.length
  const found = stats.setsFound
  const attempts = stats.errorCount + stats.setsFound

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>{endReason === 'completed' ? 'Solved!' : 'Gave up'}</h1>
        <p className="muted">
          {found} of {total} {total === 1 ? 'set' : 'sets'} found in{' '}
          {formatTime(stats.totalTimeMs ?? 0)}
        </p>
      </header>

      <div className="stats-grid">
        <Stat label="Total time" value={formatTime(stats.totalTimeMs ?? 0, true)} />
        <Stat
          label="Time to first"
          value={stats.timeToFirstSetMs === null ? '—' : formatTime(stats.timeToFirstSetMs, true)}
        />
        <Stat label="Avg between sets" value={meanInterval(stats)} />
        <Stat label="Mistakes" value={String(stats.errorCount)} />
        <Stat label="Error rate" value={attempts === 0 ? '—' : `${Math.round(stats.errorRate * 100)}%`} />
        {stats.penaltyMs > 0 && <Stat label="Penalties" value={`+${formatTime(stats.penaltyMs)}`} />}
        <Stat label="Completed" value={stats.completed ? 'Yes' : 'No'} />
      </div>

      {missedSets.length > 0 && (
        <section className="missed">
          <h2>
            {endReason === 'abandoned' ? 'Sets you missed' : 'Remaining sets'} ({missedSets.length})
          </h2>
          <div className="missed-list">
            {missedSets.map((set, si) => (
              <div className="missed-set" key={si}>
                {set.map((ci) => (
                  <div className="mini-card" key={ci}>
                    <Card card={board.cards[ci]!} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="summary-actions">
        <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  )
}
