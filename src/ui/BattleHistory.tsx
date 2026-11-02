import { useState } from 'react'
import type { Mode } from '../game/board'
import type { PairResults } from '../lib/leagues'
import { ResultsTable } from './ResultsTable'

interface Player {
  userId: string
  displayName: string
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

/**
 * Head to head: every pair of players who have shared a board, as a half
 * matrix (each pair once, below the diagonal). A cell is the row player's wins
 * against the column player, then the column player's; tap it for that pair's
 * full Results table underneath.
 */
export function BattleHistory({
  pairs,
  players,
  leagueName,
  mode,
  currentUserId,
  onBack,
}: {
  pairs: readonly PairResults[]
  /** Everyone, in the order to lay the matrix out (the league Results order). */
  players: readonly Player[]
  leagueName: string
  mode: Mode
  currentUserId: string
  onBack: () => void
}) {
  const byKey = new Map(pairs.map((p) => [pairKey(...p.userIds), p]))
  // Only players who have met someone; a player with no shared day would be an
  // all-empty row and column.
  const met = new Set(pairs.flatMap((p) => p.userIds))
  const shown = players.filter((p) => met.has(p.userId))
  const [selected, setSelected] = useState<string | null>(
    pairs[0] ? pairKey(...pairs[0].userIds) : null,
  )
  const open = selected === null ? undefined : byKey.get(selected)
  const nameOf = new Map(players.map((p) => [p.userId, p.displayName]))
  const you = (id: string) => (id === currentUserId ? ' (you)' : '')

  return (
    <div className="summary">
      <header className="summary-head">
        <h1>Battle history</h1>
        <p className="muted">
          {leagueName} · Mode {mode}
        </p>
      </header>

      {pairs.length === 0 ? (
        <p className="muted">No shared days yet.</p>
      ) : (
        <section className="league-stats">
          <h2 className="section-label">Head to head</h2>
          <div className="stat-table-scroll">
            <table className="stat-table h2h-matrix">
              <thead>
                <tr>
                  <th scope="col" />
                  {shown.slice(0, -1).map((c) => (
                    <th scope="col" key={c.userId} title={c.displayName}>
                      {c.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.slice(1).map((r, ri) => (
                  <tr key={r.userId} className={r.userId === currentUserId ? 'is-you' : undefined}>
                    <th scope="row" title={r.displayName}>
                      {r.displayName}
                    </th>
                    {shown.slice(0, -1).map((c, ci) => {
                      // Below the diagonal only: row ri+1 meets columns 0..ri.
                      if (ci > ri) return <td key={c.userId} />
                      const key = pairKey(r.userId, c.userId)
                      const p = byKey.get(key)
                      if (!p) {
                        return (
                          <td key={c.userId} className="muted">
                            —
                          </td>
                        )
                      }
                      const wins = (id: string) => p.rows.find((x) => x.userId === id)?.firstPlaces ?? 0
                      const rw = wins(r.userId)
                      const cw = wins(c.userId)
                      // The leader's number bold, the other greyed; a tie plain.
                      // Marks the number, not the cell, so it points at
                      // whichever of the two is ahead, row or column.
                      const side = (mine: number, theirs: number) =>
                        mine > theirs ? 'h2h-lead' : mine < theirs ? 'h2h-trail' : undefined
                      return (
                        <td key={c.userId}>
                          <button
                            type="button"
                            className={`h2h-cell${selected === key ? ' is-open' : ''}`}
                            aria-pressed={selected === key}
                            aria-label={`${r.displayName} ${rw}, ${c.displayName} ${cw}, over ${p.days} days`}
                            onClick={() => setSelected(key)}
                          >
                            <span className={side(rw, cw)}>{rw}</span>–
                            <span className={side(cw, rw)}>{cw}</span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted timeline-hint">
            Read across: the row player’s wins first, then the column player’s; the leader’s
            number is in bold. A win is the faster finished solve of the two on a day both played,
            whoever else played too. Tap a pair for its full table.
          </p>

          {open && (
            <>
              <h2 className="section-label section-label-gap">
                {open.userIds.map((id) => `${nameOf.get(id) ?? '—'}${you(id)}`).join(' vs ')}
                <span className="muted">
                  {' '}
                  · {open.days} day{open.days === 1 ? '' : 's'}
                </span>
              </h2>
              <ResultsTable rows={open.rows} mode={mode} currentUserId={currentUserId} />
              <p className="muted timeline-hint">
                Just the days these two both played. 1st is beating the other one.
              </p>
            </>
          )}
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
