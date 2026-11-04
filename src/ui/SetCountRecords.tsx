import type { Mode } from '../game/board'
import type { SoloRecord } from '../lib/leagues'
import { TOP_SOLVES } from '../lib/records'
import { formatTime } from './format'

/**
 * Modes B and C: the five fastest solves of boards with one particular number
 * of sets — the Mode A "Fastest solves" list, for a single board size. Opened
 * from a row of "Fastest by set count".
 */
export function SetCountRecords({
  setCount,
  records,
  leagueName,
  mode,
  currentUserId,
  onBack,
}: {
  setCount: number
  /** Fastest first, at most TOP_SOLVES. */
  records: readonly SoloRecord[]
  leagueName: string
  mode: Mode
  currentUserId: string
  onBack: () => void
}) {
  const sets = `${setCount} set${setCount === 1 ? '' : 's'}`
  return (
    <div className="summary">
      <header className="summary-head">
        <h1>Fastest on {sets}</h1>
        <p className="muted">
          {leagueName} · Mode {mode}
        </p>
      </header>

      <section className="league-stats">
        <h2 className="section-label">Top {TOP_SOLVES}</h2>
        {records.length === 0 ? (
          <p className="muted">No completed solves of a {setCount}-set board yet.</p>
        ) : (
          <ol className="record-list">
            {records.map((r, i) => (
              <li key={i} className={`record-row${r.userId === currentUserId ? ' is-you' : ''}`}>
                <span className="record-rank">{i + 1}</span>
                <span className="record-name">
                  {r.displayName}
                  {r.userId === currentUserId ? ' (you)' : ''}
                </span>
                <span className="record-meta">{r.puzzleDate}</span>
                <span className="record-time">{formatTime(r.timeMs, true)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="muted timeline-hint">
          Completed games on boards with exactly {sets}. One player can hold several places.
        </p>
      </section>

      <div className="summary-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back to records
        </button>
      </div>
    </div>
  )
}
