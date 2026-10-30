import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TimeOfDayChart } from './TimeOfDayChart'
import { deriveStats, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import type { PlayerGame } from '../lib/leagues'

/** A game started at `utc`, ending (completed or not) at `totalMs`. */
function game(id: string, utc: string, totalMs: number, reason: 'completed' | 'abandoned' = 'completed'): PlayerGame {
  const events: TelemetryEvent[] = [
    { t_ms: totalMs - 1_000, type: 'set_valid', payload: { cards: [0, 1, 2], setIndex: 0 } },
    { t_ms: totalMs, type: 'game_end', payload: { reason } },
  ]
  return {
    id,
    puzzleDate: utc.slice(0, 10),
    totalSets: 6,
    startedAtMs: Date.parse(utc),
    stats: deriveStats({ events } as GameRecord),
    events,
  }
}

describe('TimeOfDayChart', () => {
  it('places each finished game at its Singapore start time', () => {
    // 13:30 UTC is 21:30 in Singapore.
    const svg = renderToStaticMarkup(<TimeOfDayChart games={[game('g1', '2026-10-30T13:30:00Z', 83_400)]} />)
    expect(svg).toContain('1:23.4 at 21:30, 2026-10-30')
  })

  it('leaves out games that were given up', () => {
    const svg = renderToStaticMarkup(
      <TimeOfDayChart
        games={[game('g1', '2026-10-30T13:30:00Z', 83_400), game('g2', '2026-10-31T01:00:00Z', 20_000, 'abandoned')]}
      />,
    )
    expect(svg.match(/class="tod-dot"/g)).toHaveLength(1)
  })

  it('fits the time axis to the data', () => {
    const svg = renderToStaticMarkup(
      <TimeOfDayChart games={[game('g1', '2026-10-30T13:30:00Z', 70_000), game('g2', '2026-10-31T02:00:00Z', 90_000)]} />,
    )
    expect(svg).not.toContain('>0:00<')
  })

  it('draws nothing without a finished game', () => {
    expect(renderToStaticMarkup(<TimeOfDayChart games={[]} />)).toBe('')
  })
})
