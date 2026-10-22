import { useState } from 'react'
import type { MedianPoint } from '../game/pace'
import { formatTime } from './format'
import { H, M, OffScaleMark, PLOT_W, W, YAxis, Y_CAP_MS, yScale } from './paceChart'
import { playerColours } from './playerColour'

/**
 * Mode A, the whole season: each member's running median solve time against
 * the calendar. A falling line is a player getting faster.
 *
 * Same box, Y scale, 6:00 cap and roster colours as the pace charts, so a
 * player is the same colour here as on every day's board.
 *
 * X is real calendar days from the league's first finished game, not "game
 * number": a gap in the line is a stretch someone did not finish a game.
 */

interface Series {
  userId: string
  name: string
  isYou: boolean
  colour: string
  points: MedianPoint[]
}

interface Detail {
  name: string
  text: string
  colour: string
}

const DAY_MS = 86_400_000
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS

export function MedianChart({
  series: input,
  currentUserId,
  roster,
}: {
  series: { userId: string; displayName: string; points: MedianPoint[] }[]
  currentUserId: string
  /** League members in join order; null when the roster could not be read. */
  roster: readonly string[] | null
}) {
  const [detail, setDetail] = useState<Detail | null>(null)

  const all = input.flatMap((s) => s.points)
  if (all.length === 0) return null

  const ordered = [...input].sort((a, b) => a.userId.localeCompare(b.userId))
  const colours = playerColours(
    ordered.map((s) => s.userId),
    roster,
  )
  const series: Series[] = ordered.map((s) => ({
    userId: s.userId,
    name: s.displayName,
    isYou: s.userId === currentUserId,
    colour: colours.get(s.userId) ?? '#999999',
    points: s.points,
  }))

  const scale = yScale(Math.max(...all.map((p) => p.medianMs), 1))
  const { y } = scale
  const first = Math.min(...all.map((p) => dayNumber(p.date)))
  const last = Math.max(...all.map((p) => dayNumber(p.date)))
  const x = (iso: string) =>
    last > first ? M.l + ((dayNumber(iso) - first) / (last - first)) * PLOT_W : M.l + PLOT_W / 2
  const dates = [...new Set(all.map((p) => p.date))].sort()
  // First and last day, plus the middle one when there is room for it.
  const xTicks = dates.length > 2 ? [dates[0]!, dates[Math.floor(dates.length / 2)]!, dates.at(-1)!] : dates
  const shortDate = (iso: string) => iso.slice(5)

  return (
    <>
      <svg
        className="pace-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Median solve time over the season, by player"
      >
        <YAxis scale={scale} />
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} className="pc-xlabel">
            {shortDate(d)}
          </text>
        ))}
        {series.map((s, si) => {
          const nudge = (si - (series.length - 1) / 2) * 3
          return (
            <g key={s.userId}>
              {s.points.length > 1 && (
                <polyline
                  points={s.points.map((p) => `${x(p.date)},${y(p.medianMs)}`).join(' ')}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={s.isYou ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={s.isYou ? 1 : 0.85}
                />
              )}
              {s.points.map((p) => {
                const text = `median ${formatTime(p.medianMs, true)} over ${p.games} game${
                  p.games === 1 ? '' : 's'
                }, ${p.date}`
                return (
                  <g
                    key={p.date}
                    className="pc-hit"
                    onClick={() => setDetail({ name: s.name, colour: s.colour, text })}
                  >
                    {scale.isOffScale(p.medianMs) ? (
                      <OffScaleMark cx={x(p.date) + nudge} cy={y(p.medianMs)} colour={s.colour}>
                        <title>{`${s.name} — ${text}`}</title>
                      </OffScaleMark>
                    ) : (
                      <circle cx={x(p.date)} cy={y(p.medianMs)} r={s.isYou ? 3.5 : 2.5} fill={s.colour}>
                        <title>{`${s.name} — ${text}`}</title>
                      </circle>
                    )}
                    <circle cx={x(p.date)} cy={y(p.medianMs)} r={11} fill="transparent" />
                  </g>
                )
              })}
            </g>
          )
        })}
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

      <p className={`pace-detail${detail ? ' is-shown' : ''}`} aria-live="polite">
        {detail ? (
          <>
            <span className="pace-swatch" style={{ background: detail.colour }} />
            <b>{detail.name}</b> — {detail.text}
          </>
        ) : (
          'Tap a point for detail.'
        )}
      </p>

      <p className="muted pace-caption">
        Each point is a player’s median solve time over every game they had finished by that day.
        Falling is getting faster.
        {scale.anyOffScale && ` ▲ is past ${formatTime(Y_CAP_MS)}.`}
      </p>
    </>
  )
}
