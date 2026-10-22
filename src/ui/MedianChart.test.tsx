import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MedianChart } from './MedianChart'
import { PLAYER_PALETTE } from './playerColour'

const series = [
  {
    userId: 'tm',
    displayName: 'Telemattic',
    points: [
      { date: '2026-10-01', medianMs: 90_000, games: 1 },
      { date: '2026-10-05', medianMs: 80_000, games: 2 },
    ],
  },
  {
    userId: 'mds',
    displayName: 'MDS',
    points: [{ date: '2026-10-02', medianMs: 70_000, games: 1 }],
  },
]

describe('MedianChart', () => {
  it('draws a line for each player with more than one point', () => {
    const svg = renderToStaticMarkup(<MedianChart series={series} currentUserId="mds" roster={['mds', 'tm']} />)
    expect(svg.match(/<polyline/g)).toHaveLength(1)
    expect(svg).toContain('Telemattic')
    expect(svg).toContain('MDS')
  })

  it('takes colours from the roster, as the pace charts do', () => {
    const svg = renderToStaticMarkup(<MedianChart series={series} currentUserId="mds" roster={['mds', 'tm']} />)
    // tm joined second, so it gets the second colour.
    expect(svg).toContain(`stroke="${PLAYER_PALETTE[1]}"`)
  })

  it('says what a point means in its tooltip', () => {
    const svg = renderToStaticMarkup(<MedianChart series={series} currentUserId="mds" roster={null} />)
    expect(svg).toContain('Telemattic — median 1:20.0 over 2 games, 2026-10-05')
  })

  it('draws lines without dots, except for a player with a single point', () => {
    const svg = renderToStaticMarkup(<MedianChart series={series} currentUserId="mds" roster={['mds', 'tm']} />)
    // Every visible circle is filled with a player colour; touch targets are transparent.
    const visible = svg.match(/<circle[^>]*fill="#[0-9A-Fa-f]{6}"/g) ?? []
    expect(visible).toHaveLength(1) // MDS's single point; Telemattic's two are a line
    expect(visible[0]).toContain(PLAYER_PALETTE[0])
  })

  it('fits the time axis to the data instead of starting at zero', () => {
    const svg = renderToStaticMarkup(<MedianChart series={series} currentUserId="mds" roster={null} />)
    expect(svg).not.toContain('>0:00<')
    // Data runs 1:10–1:30, so the axis sits just around that.
    expect(svg).toContain('>1:05<')
  })

  it('draws nothing with no data', () => {
    expect(renderToStaticMarkup(<MedianChart series={[]} currentUserId="mds" roster={null} />)).toBe('')
  })
})
