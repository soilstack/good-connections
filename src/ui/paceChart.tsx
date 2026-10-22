import type { ReactNode } from 'react'
import { formatTime } from './format'

/**
 * Shared plumbing for the pace charts (time against sets found). Both charts —
 * one line per player on today's board, one line per game on a player's page —
 * use the same box, the same Y scale and the same off-scale treatment, so a
 * shape means the same thing wherever you see it.
 *
 * The Y axis stops at 6:00. One twenty-minute game would otherwise squash every
 * other line into the bottom eighth of the chart; past the cap a line flattens
 * against the top edge and each off-scale point becomes a ▲ whose tooltip still
 * carries the real time.
 */

export const Y_CAP_MS = 6 * 60 * 1000

export const W = 360
export const H = 210
export const M = { l: 46, r: 14, t: 12, b: 28 }
export const PLOT_W = W - M.l - M.r
export const PLOT_H = H - M.t - M.b

export interface YScale {
  /** Bottom of the axis: 0 for the pace charts, near the data for {@link rangeScale}. */
  minT: number
  /** Top of the axis: the data max, or the cap if the data runs past it. */
  maxT: number
  /** True when at least one point is above the cap. */
  anyOffScale: boolean
  /** ms → svg y, clamped to the plot area. */
  y: (t: number) => number
  isOffScale: (t: number) => boolean
}

export function yScale(dataMaxMs: number): YScale {
  const maxT = Math.min(Math.max(dataMaxMs, 1), Y_CAP_MS)
  return {
    minT: 0,
    maxT,
    anyOffScale: dataMaxMs > maxT,
    y: (t) => M.t + (1 - Math.min(t, maxT) / maxT) * PLOT_H,
    isOffScale: (t) => t > maxT,
  }
}

/**
 * A Y scale fitted to the data rather than starting at zero, for charts where
 * the interesting thing is the difference between lines, not their height —
 * the season median chart, where every line sits between one and three
 * minutes. Padded a little either side so no line runs along an edge; still
 * capped at {@link Y_CAP_MS}.
 */
export function rangeScale(dataMinMs: number, dataMaxMs: number): YScale {
  const hi = Math.min(dataMaxMs, Y_CAP_MS)
  const lo = Math.min(dataMinMs, hi)
  const pad = Math.max((hi - lo) * 0.08, 5_000)
  const minT = Math.max(0, lo - pad)
  const maxT = Math.min(hi + pad, Y_CAP_MS)
  const clamp = (t: number) => Math.min(Math.max(t, minT), maxT)
  return {
    minT,
    maxT,
    anyOffScale: dataMaxMs > maxT,
    y: (t) => M.t + (1 - (clamp(t) - minT) / (maxT - minT)) * PLOT_H,
    isOffScale: (t) => t > maxT,
  }
}

/** Horizontal gridlines at quarters of the axis, labelled with the time. */
export function YAxis({ scale }: { scale: YScale }) {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const value = scale.minT + (scale.maxT - scale.minT) * f
        return (
          <g key={f}>
            <line x1={M.l} x2={W - M.r} y1={scale.y(value)} y2={scale.y(value)} className="pc-grid" />
            <text x={M.l - 6} y={scale.y(value)} className="pc-ylabel">
              {formatTime(value)}
              {scale.anyOffScale && f === 1 ? '+' : ''}
            </text>
          </g>
        )
      })}
    </>
  )
}

/** Upward triangle marking a point that sits above the Y cap. */
export function OffScaleMark({
  cx,
  cy,
  colour,
  className,
  children,
}: {
  cx: number
  cy: number
  colour?: string
  className?: string
  children: ReactNode
}) {
  return (
    <path
      d={`M ${cx} ${cy - 5.5} L ${cx + 5} ${cy + 3.5} L ${cx - 5} ${cy + 3.5} Z`}
      {...(className ? { className } : { fill: colour })}
    >
      {children}
    </path>
  )
}
