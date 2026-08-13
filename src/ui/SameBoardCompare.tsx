import { deriveTimeline, type GameRecord } from '../game/telemetry'
import type { LeaderboardRow } from '../lib/leagues'
import { formatTime } from './format'

/**
 * Per-set pace vs. the field on today's identical board. Because every member
 * plays the same seed, set indices line up exactly across players, so we can
 * compare "time to find set #k" directly. Only shown once the viewer has
 * completed the puzzle, so it reveals nothing they haven't already seen.
 */

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function SameBoardCompare({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string
}) {
  const me = rows.find((r) => r.userId === currentUserId)
  if (!me || !me.stats.completed || rows.length < 2) return null

  const bySet = new Map<number, number[]>()
  const mine = new Map<number, number>()
  for (const r of rows) {
    for (const step of deriveTimeline({ events: r.events } as GameRecord).steps) {
      const arr = bySet.get(step.setIndex) ?? []
      arr.push(step.atMs)
      bySet.set(step.setIndex, arr)
      if (r.userId === currentUserId) mine.set(step.setIndex, step.atMs)
    }
  }

  const data = [...bySet.keys()]
    .sort((a, b) => a - b)
    .map((si) => ({ si, med: median(bySet.get(si)!), mine: mine.get(si) ?? null }))
  if (data.length === 0) return null

  const hardest = data.reduce((h, r) => (r.med > h.med ? r : h), data[0]!)

  return (
    <section className="league-stats">
      <h2 className="section-label">Today’s board — your pace vs the field</h2>
      <ol className="compare-list">
        {data.map((r) => (
          <li key={r.si} className="compare-row">
            <span className="compare-set">Set {r.si + 1}</span>
            <span className="compare-mine">{r.mine === null ? '—' : formatTime(r.mine, true)}</span>
            <span className="compare-med">median {formatTime(r.med, true)}</span>
            <span className={r.mine !== null && r.mine <= r.med ? 'pace-fast' : 'pace-slow'}>
              {r.mine === null ? '' : r.mine <= r.med ? 'ahead' : 'behind'}
            </span>
          </li>
        ))}
      </ol>
      <p className="muted compare-hardest">
        Hardest set today: <strong>Set {hardest.si + 1}</strong> — group median{' '}
        {formatTime(hardest.med, true)}
      </p>
    </section>
  )
}
