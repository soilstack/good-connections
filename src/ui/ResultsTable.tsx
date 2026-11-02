import type { Mode } from '../game/board'
import type { ResultsRow } from '../lib/records'
import { formatTime } from './format'

/**
 * The Results table: games, first places, perfects and (Mode A) best first five.
 * Shared by the league page's all-in table and Battle history's per-line-up ones,
 * so the two can never drift apart.
 */
export function ResultsTable({
  rows,
  mode,
  currentUserId,
}: {
  rows: readonly (ResultsRow & { displayName: string })[]
  mode: Mode
  currentUserId: string
}) {
  return (
    <div className="stat-table-scroll">
      <table className="stat-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" title="Days played, finished or not">
              Games
            </th>
            <th scope="col" title="Days with the fastest finished solve">
              1st
            </th>
            <th scope="col" title="“Perfect Play!” games">
              Perfect
            </th>
            {mode === 'A' && (
              <th scope="col" title="Fastest time to the fifth set, in a finished game">
                5 sets
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className={r.userId === currentUserId ? 'is-you' : undefined}>
              <th scope="row" title={r.displayName}>
                {r.displayName}
                {r.userId === currentUserId ? ' (you)' : ''}
              </th>
              <td>{r.games}</td>
              <td>
                {r.firstPlaces}
                {r.games > 0 && `(${Math.round((r.firstPlaces / r.games) * 100)}%)`}
              </td>
              <td>{r.perfects}</td>
              {mode === 'A' && (
                <td>{r.bestFirstFiveMs === null ? '—' : formatTime(r.bestFirstFiveMs, true)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
