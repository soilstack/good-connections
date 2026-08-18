import type { ReactNode } from 'react'
import type { LeaderboardRow } from '../lib/leagues'
import { formatTime } from './format'

/**
 * Pace chart for today's identical board: cumulative time (Y) vs sets found
 * (X), one line per player. Because everyone plays the same seed the lines are
 * directly comparable. Mode C "Done" presses are marked too — premature ones as
 * red rings, the final (correct) one as a square that carries the penalty time.
 * Only shown once the viewer has completed, so it reveals nothing new.
 *
 * The Y axis stops at 6:00. One player who stared at the board for twenty
 * minutes would otherwise squash everyone else's line into the bottom eighth of
 * the chart; past the cap the line flattens against the top edge and each
 * off-scale point becomes a ▲ whose tooltip still carries the real time.
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

interface DoneMark {
  setsAt: number
  atMs: number
  complete: boolean
}
interface Series {
  userId: string
  name: string
  isYou: boolean
  colour: string
  setPoints: { n: number; atMs: number }[]
  dones: DoneMark[]
}

const W = 360
const H = 210
const M = { l: 46, r: 14, t: 12, b: 28 }
const PLOT_W = W - M.l - M.r
const PLOT_H = H - M.t - M.b

/** Y axis never runs past this; anything slower clamps to the top edge. */
const Y_CAP_MS = 6 * 60 * 1000

/** Upward triangle marking a point that sits above the Y cap. */
function OffScaleMark({
  cx,
  cy,
  colour,
  premature,
  children,
}: {
  cx: number
  cy: number
  colour: string
  premature?: boolean
  children: ReactNode
}) {
  return (
    <path
      d={`M ${cx} ${cy - 5.5} L ${cx + 5} ${cy + 3.5} L ${cx - 5} ${cy + 3.5} Z`}
      {...(premature ? { className: 'pc-premdone' } : { fill: colour })}
    >
      {children}
    </path>
  )
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

  const ordered = [...rows].sort((a, b) => a.userId.localeCompare(b.userId))
  const series: Series[] = ordered.map((r, i) => {
    const setPoints: { n: number; atMs: number }[] = []
    const dones: DoneMark[] = []
    let setsFound = 0
    for (const ev of r.events) {
      if (ev.type === 'set_valid') {
        setsFound++
        setPoints.push({ n: setsFound, atMs: ev.t_ms })
      } else if (ev.type === 'done_attempt') {
        dones.push({ setsAt: setsFound, atMs: ev.t_ms, complete: ev.payload.complete })
      }
    }
    return {
      userId: r.userId,
      name: r.displayName,
      isYou: r.userId === currentUserId,
      colour: PALETTE[i % PALETTE.length]!,
      setPoints,
      dones,
    }
  })

  const maxN = Math.max(...series.map((s) => s.setPoints.length), 1)
  const dataMaxT = Math.max(
    ...series.flatMap((s) => [...s.setPoints.map((p) => p.atMs), ...s.dones.map((d) => d.atMs)]),
    1,
  )
  const maxT = Math.min(dataMaxT, Y_CAP_MS)
  const anyOffScale = dataMaxT > maxT
  // Sets sit on integer x (1..n); each "done" gets its own slot half a step
  // after the set count when it happened, so dones never stack on a set.
  const doneXs = series.flatMap((s) => s.dones.map((d) => d.setsAt + 0.5))
  const xMin = Math.min(1, ...doneXs)
  const xMax = Math.max(maxN, ...doneXs)
  const x = (v: number) => (xMax > xMin ? M.l + ((v - xMin) / (xMax - xMin)) * PLOT_W : M.l + PLOT_W / 2)
  const doneTickXs = [...new Set(doneXs)].sort((a, b) => a - b)
  const y = (t: number) => M.t + (1 - Math.min(t, maxT) / maxT) * PLOT_H

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, value: maxT * f }))
  const xTicks = Array.from({ length: maxN }, (_, i) => i + 1)
  const anyDones = series.some((s) => s.dones.length > 0)

  return (
    <section className="league-stats">
      <h2 className="section-label">Today’s board — pace</h2>
      <svg className="pace-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Solve pace by player">
        {yTicks.map((t) => (
          <g key={t.f}>
            <line x1={M.l} x2={W - M.r} y1={y(t.value)} y2={y(t.value)} className="pc-grid" />
            <text x={M.l - 6} y={y(t.value)} className="pc-ylabel">
              {formatTime(t.value)}
              {anyOffScale && t.f === 1 ? '+' : ''}
            </text>
          </g>
        ))}
        {xTicks.map((n) => (
          <text key={n} x={x(n)} y={H - 8} className="pc-xlabel">
            {n}
          </text>
        ))}
        {doneTickXs.map((v) => (
          <text key={`dt${v}`} x={x(v)} y={H - 8} className="pc-xlabel pc-donelabel">
            {v - 0.5 >= maxN ? 'done' : 'false done'}
          </text>
        ))}

        {series.map((s, si) => {
          const finalDone = s.dones.find((d) => d.complete)
          const linePts = s.setPoints.map((p) => `${x(p.n)},${y(p.atMs)}`)
          if (finalDone) linePts.push(`${x(finalDone.setsAt + 0.5)},${y(finalDone.atMs)}`)
          // Off-scale markers all sit on the top edge, so fan them out sideways
          // by series to keep two slow players from drawing the same triangle.
          const nudge = (si - (series.length - 1) / 2) * 3
          return (
            <g key={s.userId}>
              {linePts.length > 1 && (
                <polyline
                  points={linePts.join(' ')}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={s.isYou ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={s.isYou ? 1 : 0.85}
                />
              )}
              {s.setPoints.map((p) => {
                // One interpolated string, not mixed children: React renders a
                // <title> with an array of children as empty, killing the tooltip.
                const title = <title>{`${s.name} — set ${p.n} at ${formatTime(p.atMs, true)}`}</title>
                return p.atMs > maxT ? (
                  <OffScaleMark key={p.n} cx={x(p.n) + nudge} cy={y(p.atMs)} colour={s.colour}>
                    {title}
                  </OffScaleMark>
                ) : (
                  <circle key={p.n} cx={x(p.n)} cy={y(p.atMs)} r={s.isYou ? 4 : 3} fill={s.colour}>
                    {title}
                  </circle>
                )
              })}
              {s.dones.map((d, di) => {
                const cx = x(d.setsAt + 0.5)
                const title = (
                  <title>
                    {`${s.name} — ${d.complete ? 'finished' : 'premature “done”'} at ${formatTime(
                      d.atMs,
                      true,
                    )}`}
                  </title>
                )
                if (d.atMs > maxT) {
                  return (
                    <OffScaleMark
                      key={`d${di}`}
                      cx={cx + nudge}
                      cy={y(d.atMs)}
                      colour={s.colour}
                      premature={!d.complete}
                    >
                      {title}
                    </OffScaleMark>
                  )
                }
                return d.complete ? (
                  <rect key={`d${di}`} x={cx - 4} y={y(d.atMs) - 4} width={8} height={8} fill={s.colour}>
                    {title}
                  </rect>
                ) : (
                  <circle key={`d${di}`} cx={cx} cy={y(d.atMs)} r={4.5} className="pc-premdone">
                    {title}
                  </circle>
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
      <p className="muted pace-caption">
        X = sets found, Y = elapsed time (incl. penalties).
        {anyDones && ' ▢ done · ◯ false done.'}
        {anyOffScale && ` ▲ past ${formatTime(Y_CAP_MS)} — hover for the real time.`} Hover a point
        for detail.
      </p>
    </section>
  )
}
