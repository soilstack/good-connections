import { deriveTimeline, type GameRecord } from '../game/telemetry'
import type { LeaderboardRow } from '../lib/leagues'
import { formatTime } from './format'

/**
 * Pace chart for today's identical board: cumulative time (Y) vs the number of
 * sets found (X), one line per player. Because every member plays the same
 * seed, the lines are directly comparable. Wrong and already-found attempts are
 * a secondary channel (small red / amber satellite dots), never on the line
 * colour. Only shown once the viewer has completed, so it reveals nothing new.
 *
 * Colours: Okabe-Ito categorical palette (published colourblind-safe order).
 */
const PALETTE = [
  '#56B4E9',
  '#E69F00',
  '#009E73',
  '#F0E442',
  '#CC79A7',
  '#D55E00',
  '#0072B2',
  '#999999',
] as const

interface Series {
  userId: string
  name: string
  isYou: boolean
  colour: string
  points: { n: number; atMs: number; falseBefore: number; dupBefore: number }[]
}

const W = 360
const H = 210
const M = { l: 46, r: 14, t: 12, b: 28 }
const PLOT_W = W - M.l - M.r
const PLOT_H = H - M.t - M.b

export function SameBoardCompare({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string
}) {
  const me = rows.find((r) => r.userId === currentUserId)
  if (!me || !me.stats.completed || rows.length < 2) return null

  // Stable colour-by-entity: order players by id, current user emphasised.
  const ordered = [...rows].sort((a, b) => a.userId.localeCompare(b.userId))
  const series: Series[] = ordered.map((r, i) => ({
    userId: r.userId,
    name: r.displayName,
    isYou: r.userId === currentUserId,
    colour: PALETTE[i % PALETTE.length]!,
    points: deriveTimeline({ events: r.events } as GameRecord).steps.map((s, idx) => ({
      n: idx + 1,
      atMs: s.atMs,
      falseBefore: s.falseBefore,
      dupBefore: s.duplicatesBefore,
    })),
  }))

  const maxN = Math.max(...series.map((s) => s.points.length), 1)
  const maxT = Math.max(...series.flatMap((s) => s.points.map((p) => p.atMs)), 1)
  const x = (n: number) => (maxN > 1 ? M.l + ((n - 1) / (maxN - 1)) * PLOT_W : M.l + PLOT_W / 2)
  const y = (t: number) => M.t + (1 - t / maxT) * PLOT_H

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, value: maxT * f }))
  const xTicks = Array.from({ length: maxN }, (_, i) => i + 1)

  return (
    <section className="league-stats">
      <h2 className="section-label">Today’s board — pace</h2>
      <svg className="pace-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Solve pace by player">
        {/* horizontal gridlines + time labels */}
        {yTicks.map((t) => (
          <g key={t.f}>
            <line x1={M.l} x2={W - M.r} y1={y(t.value)} y2={y(t.value)} className="pc-grid" />
            <text x={M.l - 6} y={y(t.value)} className="pc-ylabel">
              {formatTime(t.value)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((n) => (
          <text key={n} x={x(n)} y={H - 8} className="pc-xlabel">
            {n}
          </text>
        ))}

        {/* one line per player */}
        {series.map((s) => (
          <g key={s.userId}>
            {s.points.length > 1 && (
              <polyline
                points={s.points.map((p) => `${x(p.n)},${y(p.atMs)}`).join(' ')}
                fill="none"
                stroke={s.colour}
                strokeWidth={s.isYou ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={s.isYou ? 1 : 0.85}
              />
            )}
            {s.points.map((p) => (
              <circle key={p.n} cx={x(p.n)} cy={y(p.atMs)} r={s.isYou ? 4 : 3} fill={s.colour}>
                <title>
                  {s.name} — set {p.n} at {formatTime(p.atMs, true)}
                  {p.falseBefore > 0 ? ` · ${p.falseBefore} wrong` : ''}
                  {p.dupBefore > 0 ? ` · ${p.dupBefore} repeat` : ''}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>

      <div className="pace-legend">
        {series.map((s) => (
          <span key={s.userId} className={`pace-key${s.isYou ? ' is-you' : ''}`}>
            <span className="pace-swatch" style={{ background: s.colour }} />
            {s.name}
            {s.isYou ? ' (you)' : ''}
          </span>
        ))}
      </div>
      <p className="muted pace-caption">
        X = sets found, Y = elapsed time. Hover a point for wrong / repeat detail.
      </p>
    </section>
  )
}
