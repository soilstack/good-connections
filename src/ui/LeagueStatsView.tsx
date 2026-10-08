import type { Mode } from '../game/board'
import { MAX_SETS_ON_TWELVE } from '../game/set'
import type { LeagueStats, SoloRecord } from '../lib/leagues'
import { formatTime } from './format'

interface Props {
  /**
   * Fetched by the parent, which also needs it to decide whether today's game
   * earned a congratulation — one query serves both. Null while loading.
   */
  stats: LeagueStats | null
  error?: string | null
  mode: Mode
  currentUserId: string
  /** Open a member's performance page. */
  onSelectMember: (userId: string) => void
}

export function LeagueStatsView({ stats, error, mode, currentUserId, onSelectMember }: Props) {
  if (error) return <p className="auth-error">{error}</p>
  if (!stats) return <p className="muted">Loading records…</p>

  // Every possible set count, 1..14, whether or not anyone has played one yet,
  // so the gaps are visible: an empty row is a record still up for grabs.
  const byCount = new Map(stats.fastestBySetCount.map(({ setCount, record }) => [setCount, record]))
  const countRows: { setCount: number; record: SoloRecord | undefined }[] = Array.from(
    { length: MAX_SETS_ON_TWELVE },
    (_, i) => ({ setCount: i + 1, record: byCount.get(i + 1) }),
  )

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
      ) : (
        <ol className="record-list">
          {countRows.map(({ setCount, record }) =>
            record ? (
              <li key={setCount} className="record-row">
                <span className="record-rank">
                  {setCount} set{setCount === 1 ? '' : 's'}
                </span>
                <span className="record-name">{record.displayName}</span>
                <span className="record-meta">{record.puzzleDate}</span>
                <span className="record-time">{formatTime(record.timeMs, true)}</span>
              </li>
            ) : (
              <li key={setCount} className="record-row is-empty">
                <span className="record-rank">
                  {setCount} set{setCount === 1 ? '' : 's'}
                </span>
                <span className="record-name">—</span>
              </li>
            ),
          )}
        </ol>
      )}

      {/* Mode A only, deliberately. Every Mode A board has exactly six sets, so
          times are comparable and an average means something. Mode B and C
          boards vary in difficulty, where a season-long average mostly measures
          which boards you happened to be dealt. */}
      {mode === 'A' && (
        <>
          <h2 className="section-label section-label-gap">Solve times</h2>
          {stats.members.every((m) => m.spread === null) ? (
            <p className="muted">No completed solves yet.</p>
          ) : (
            <div className="stat-table-scroll">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Best</th>
                    <th scope="col" title="Median">Med</th>
                    <th scope="col" title="95th percentile — a bad day, not the single worst">
                      Worst
                    </th>
                    <th scope="col" title="Standard deviation — lower is more consistent">
                      ±
                    </th>
                    <th scope="col">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.members
                    .filter((m) => m.spread !== null)
                    .map((m) => (
                      <tr
                        key={m.userId}
                        className={m.userId === currentUserId ? 'is-you' : undefined}
                      >
                        <th scope="row" title={m.displayName}>
                          {m.displayName}
                          {m.userId === currentUserId ? ' (you)' : ''}
                        </th>
                        <td>{formatTime(m.spread!.bestMs)}</td>
                        <td>{formatTime(m.spread!.medianMs)}</td>
                        <td>{formatTime(m.spread!.p95Ms)}</td>
                        <td>{formatTime(m.spread!.stdDevMs)}</td>
                        <td>{m.spread!.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted timeline-hint">
            Completed games only — an abandoned game is shorter than a finished one, so counting
            them would make giving up look fast. Med is the median. Worst is the 95th percentile: a bad
            day, without letting one disaster define anyone (with few games it sits near the
            very worst). ± is the
            standard deviation: lower means more consistent.
          </p>
        </>
      )}

      <h2 className="section-label section-label-gap">Members</h2>
      <ol className="member-list">
        {stats.members.map((m) => (
          <li key={m.userId}>
            <button
              type="button"
              className={`member-row is-tappable${m.userId === currentUserId ? ' is-you' : ''}`}
              onClick={() => onSelectMember(m.userId)}
            >
              <span className="member-name">
                {m.displayName}
                {m.userId === currentUserId ? ' (you)' : ''}
              </span>
              <span className="member-detail">
                {m.bestTimeMs === null ? 'no solve yet' : `best ${formatTime(m.bestTimeMs)}`}
                {` · ${m.gamesCompleted}/${m.gamesPlayed} solved · ${Math.round(m.completionRate * 100)}%`}
                {m.currentStreak > 0 ? ` · streak ${m.currentStreak}` : ''}
                {m.penaltyMs > 0 ? ` · +${formatTime(m.penaltyMs)} penalties` : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="muted timeline-hint">Tap a member to see how they’re going.</p>

      {stats.notables.length > 0 && (
        <>
          <h2 className="section-label section-label-gap">Notable</h2>
          <ol className="member-list">
            {stats.notables.map((n, i) => (
              <li key={i} className="member-row">
                <span className="member-name">{n.label}</span>
                <span className="member-detail">
                  {n.displayName} ·{' '}
                  {n.unit === 'time'
                    ? formatTime(n.value)
                    : n.unit === 'percent'
                      ? `${Math.round(n.value * 100)}%`
                      : n.value}{' '}
                  ·{' '}
                  {/* A per-game award names its day; one earned across a whole
                      history says how many games it averages over instead. */}
                  {n.puzzleDate ?? `${n.games ?? 0} game${n.games === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
