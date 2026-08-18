import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlayerPaceChart } from './PlayerPaceChart'
import { deriveStats, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import type { PlayerGame } from '../lib/leagues'

function game(
  puzzleDate: string,
  setTimesMs: number[],
  reason: 'completed' | 'abandoned' = 'completed',
): PlayerGame {
  const events: TelemetryEvent[] = setTimesMs.map((t, i) => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex: i },
  }))
  events.push({ t_ms: (setTimesMs.at(-1) ?? 0) + 1_000, type: 'game_end', payload: { reason } })
  return {
    id: puzzleDate,
    puzzleDate,
    totalSets: 6,
    stats: deriveStats({ events } as GameRecord),
    events,
  }
}

/** Games are handed to the chart newest first, as the data layer sorts them. */
const HISTORY = [
  game('2026-08-18', [10_000, 40_000, 80_000]),
  game('2026-08-17', [15_000, 50_000, 95_000]),
  game('2026-08-16', [20_000, 60_000], 'abandoned'),
]

describe('PlayerPaceChart', () => {
  it('paints the most recent game last, in the highlight class', () => {
    const svg = renderToStaticMarkup(<PlayerPaceChart games={HISTORY} />)
    const lines = [...svg.matchAll(/<polyline[^>]*>/g)].map((m) => m[0])
    expect(lines).toHaveLength(3)
    // Last in document order = drawn on top.
    expect(lines.at(-1)).toContain('is-recent')
    expect(lines.slice(0, -1).every((l) => !l.includes('is-recent'))).toBe(true)
  })

  it('fades older games out', () => {
    const svg = renderToStaticMarkup(<PlayerPaceChart games={HISTORY} />)
    const opacities = [...svg.matchAll(/<polyline[^>]*opacity="([\d.]+)"/g)].map((m) => Number(m[1]))
    // Two faded lines, oldest (drawn first) faintest.
    expect(opacities).toHaveLength(2)
    expect(opacities[0]).toBeLessThan(opacities[1]!)
  })

  it('dashes a game that was given up', () => {
    const svg = renderToStaticMarkup(<PlayerPaceChart games={HISTORY} />)
    const abandoned = [...svg.matchAll(/<polyline[^>]*>/g)].map((m) => m[0]!)[0]!
    expect(abandoned).toContain('is-abandoned')
    // Its tooltip says so rather than showing a time.
    expect(svg).toContain('2026-08-16 — gave up')
  })

  it('marks points on the recent game only', () => {
    const svg = renderToStaticMarkup(<PlayerPaceChart games={HISTORY} />)
    expect(svg.match(/<circle/g)).toHaveLength(3) // the newest game's three sets
    expect(svg).toContain('2026-08-18 — set 3 at 1:20.0')
  })

  it('caps the axis and marks off-scale points, like the same-board chart', () => {
    const svg = renderToStaticMarkup(
      <PlayerPaceChart games={[game('2026-08-18', [10_000, 900_000]), game('2026-08-17', [9_000])]} />,
    )
    expect(svg).toContain('6:00+')
    expect(svg.match(/<path /g)).toHaveLength(1)
    expect(svg).toContain('set 2 at 15:00.0')
  })

  it('renders nothing when no game has a set in it', () => {
    expect(renderToStaticMarkup(<PlayerPaceChart games={[game('2026-08-18', [], 'abandoned')]} />)).toBe(
      '',
    )
  })
})
