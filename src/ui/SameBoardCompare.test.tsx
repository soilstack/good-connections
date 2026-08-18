import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SameBoardCompare } from './SameBoardCompare'
import { deriveStats, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import type { LeaderboardRow } from '../lib/leagues'

/**
 * The chart's Y axis is capped at 6:00 so one very slow game can't flatten
 * everyone else's line. These render it to markup and check the geometry.
 */

const CAP_MS = 6 * 60 * 1000
const PLOT_TOP = 12 // = M.t

function row(userId: string, setTimesMs: number[]): LeaderboardRow {
  const events: TelemetryEvent[] = setTimesMs.map((t, i) => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex: i },
  }))
  events.push({
    t_ms: setTimesMs[setTimesMs.length - 1]! + 1,
    type: 'game_end',
    payload: { reason: 'completed' },
  })
  return {
    userId,
    displayName: userId,
    stats: deriveStats({ events, totalSets: setTimesMs.length } as GameRecord),
    events,
  }
}

/** Every y coordinate in the nth polyline (one per player, in userId order). */
function polylineYs(svg: string, n = 0): number[] {
  const pts = [...svg.matchAll(/<polyline points="([^"]+)"/g)][n]?.[1] ?? ''
  return pts
    .split(' ')
    .filter(Boolean)
    .map((p) => Number(p.split(',')[1]))
}

describe('SameBoardCompare Y cap', () => {
  it('scales to the data when everyone is inside the cap', () => {
    const svg = renderToStaticMarkup(
      <SameBoardCompare
        rows={[row('a', [10_000, 60_000, 120_000]), row('b', [20_000, 70_000, 130_000])]}
        currentUserId="a"
      />,
    )
    // Top gridline is labelled with the slowest time, not the cap.
    expect(svg).toContain('>2:10<')
    expect(svg).not.toContain('>6:00<')
    expect(svg).not.toContain('+</text>')
    // No off-scale triangles.
    expect(svg).not.toContain('<path')
  })

  it('clamps a slow player to the top edge and marks the points ▲', () => {
    const slow = 20 * 60 * 1000
    const svg = renderToStaticMarkup(
      <SameBoardCompare
        rows={[row('a', [10_000, 60_000, 120_000]), row('b', [30_000, 400_000, slow])]}
        currentUserId="a"
      />,
    )
    // Axis stops at the cap and says so.
    expect(svg).toContain('6:00+')
    // Two of player b's points are past 6:00 → two triangles.
    expect(svg.match(/<path /g)?.length).toBe(2)
    // The tooltip still carries the true time, not the clamped one.
    expect(svg).toContain('20:00.0')
    // The slow line flattens against the top edge instead of running off it:
    // both off-scale points share the plot-top y.
    const ys = polylineYs(svg, 1)
    expect(ys.slice(1)).toEqual([PLOT_TOP, PLOT_TOP])
  })

  it('never plots above the top edge, whatever the times', () => {
    const svg = renderToStaticMarkup(
      <SameBoardCompare
        rows={[row('a', [10_000, CAP_MS * 4]), row('b', [30_000, 60_000])]}
        currentUserId="a"
      />,
    )
    for (const m of svg.matchAll(/c?y="([-\d.]+)"/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(0)
    }
  })
})
