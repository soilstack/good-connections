import type { Mode } from '../game/board'
import type { LineupResults } from '../lib/leagues'
import { ResultsTable } from './ResultsTable'

/**
 * The league's Results table, split by who turned up. Each day is filed under
 * the exact line-up that played it, so a pair's table is the days only those
 * two played — head to head, with nobody else's day in the mix. Most-played
 * line-up first.
 */
export function BattleHistory({
  battles,
  leagueName,
  mode,
  currentUserId,
  onBack,
}: {
  battles: readonly LineupResults[]
  leagueName: string
  mode: Mode
  currentUserId: string
  onBack: () => void
}) {
  return (
    <div className="summary">
      <header className="summary-head">
        <h1>Battle history</h1>
        <p className="muted">
          {leagueName} · Mode {mode}
        </p>
      </header>

      <p className="muted timeline-hint">
        One Results table for each group of players who have shared a board. A day counts only
        for the exact group that played it — a day all three of you played is in the three-player
        table, not in each pair’s. Days played alone are left out.
      </p>

      {battles.length === 0 ? (
        <p className="muted">No shared days yet.</p>
      ) : (
        <section className="league-stats">
          {battles.map((b) => (
            <div key={b.displayNames.join('|')}>
              <h2 className="section-label section-label-gap">
                {b.displayNames.join(' vs ')}
                <span className="muted">
                  {' '}
                  · {b.days} day{b.days === 1 ? '' : 's'}
                </span>
              </h2>
              <ResultsTable rows={b.rows} mode={mode} currentUserId={currentUserId} />
            </div>
          ))}
        </section>
      )}

      <div className="summary-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}
