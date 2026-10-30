import { useState } from 'react'
import type { PlayerGame } from '../lib/leagues'
import { singaporeHours } from '../lib/time'
import { formatTime } from './format'
import { H, M, OffScaleMark, PLOT_W, rangeScale, W, YAxis, Y_CAP_MS } from './paceChart'

/**
 * Does the time of day you play change how fast you solve? One dot per
 * finished game: x is the Singapore clock time it was started, y its total
 * solve time. Mode A only — B/C boards vary too much in size for total time
 * to say anything about the clock.
 *
 * Singapore time for everyone, because most players live there and the app
 * does not know anyone's own timezone. Finished games only, as everywhere: a
 * game given up early is short, and would look like a fast evening.
 *
 * Same box and fitted time axis as the median chart.
 */

const fmtHour = (h: number) => {
  const total = Math.round(h * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function TimeOfDayChart({ games }: { games: readonly PlayerGame[] }) {
  const [detail, setDetail] = useState<string | null>(null)

  const points = games
    .filter((g) => g.stats.completed && g.stats.totalTimeMs !== null)
    .map((g) => ({ id: g.id, date: g.puzzleDate, hour: singaporeHours(g.startedAtMs), timeMs: g.stats.totalTimeMs! }))
  if (points.length === 0) return null

  const scale = rangeScale(Math.min(...points.map((p) => p.timeMs)), Math.max(...points.map((p) => p.timeMs)))
  const { y } = scale
  const x = (hour: number) => M.l + (hour / 24) * PLOT_W

  return (
    <>
      <svg className="pace-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Solve time by time of day">
        <YAxis scale={scale} />
        {[0, 6, 12, 18, 24].map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1={M.t} y2={H - M.b} className="pc-grid" />
            <text x={x(h)} y={H - 8} className="pc-xlabel">
              {h === 24 ? '24:00' : fmtHour(h)}
            </text>
          </g>
        ))}
        {points.map((p) => {
          const text = `${formatTime(p.timeMs, true)} at ${fmtHour(p.hour)}, ${p.date}`
          return (
            <g key={p.id} className="pc-hit" onClick={() => setDetail(text)}>
              {scale.isOffScale(p.timeMs) ? (
                <OffScaleMark cx={x(p.hour)} cy={y(p.timeMs)} className="tod-dot">
                  <title>{text}</title>
                </OffScaleMark>
              ) : (
                <circle cx={x(p.hour)} cy={y(p.timeMs)} r={3.5} className="tod-dot">
                  <title>{text}</title>
                </circle>
              )}
              <circle cx={x(p.hour)} cy={y(p.timeMs)} r={11} fill="transparent" />
            </g>
          )
        })}
      </svg>

      <p className={`pace-detail${detail ? ' is-shown' : ''}`} aria-live="polite">
        {detail ?? 'Tap a dot for detail.'}
      </p>

      <p className="muted pace-caption">
        Each dot is a finished game: when it was started (Singapore time) and how long it took.
        {scale.anyOffScale && ` ▲ is past ${formatTime(Y_CAP_MS)}.`}
      </p>
    </>
  )
}
