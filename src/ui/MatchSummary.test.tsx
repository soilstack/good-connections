import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatchSummary } from './MatchSummary'
import { deriveStats, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import type { LeaderboardRow } from '../lib/leagues'

/** A player's day: [t_ms, setIndex] pairs, in the order they found them. */
function row(name: string, finds: [number, number][]): LeaderboardRow {
  const events: TelemetryEvent[] = finds.map(([t, setIndex]) => ({
    t_ms: t,
    type: 'set_valid',
    payload: { cards: [0, 1, 2], setIndex },
  }))
  events.push({ t_ms: (finds.at(-1)?.[0] ?? 0) + 1_000, type: 'game_end', payload: { reason: 'completed' } })
  return {
    userId: name,
    displayName: name,
    stats: deriveStats({ events } as GameRecord),
    events,
  }
}

const text = (svgOrHtml: string) => svgOrHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('MatchSummary', () => {
  it('names each player’s hardest and last set by board letter', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[row('aoife', [[10_000, 0], [30_000, 2], [150_000, 4]])]}
        currentUserId="aoife"
      />,
    )
    // The 120s gap before set index 4 (= "E") is the wall; E is also last.
    expect(text(html)).toContain('hardest E +2:00 · last E at 2:30')
  })

  it('calls out the set that stalled most players', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[
          row('aoife', [[10_000, 0], [20_000, 1], [140_000, 3]]),
          row('ben', [[15_000, 1], [25_000, 0], [180_000, 3]]),
          row('cleo', [[12_000, 0], [130_000, 3], [140_000, 1]]),
        ]}
        currentUserId="aoife"
      />,
    )
    expect(text(html)).toContain('Set D was the wall — the longest stall for 3 of 3')
    expect(text(html)).toContain('Set D was the last to fall for 2 of 3 finishers')
  })

  it('leaves an abandoned game out of “last to fall” — where they stopped is not the end', () => {
    const quit = row('cleo', [[10_000, 3], [20_000, 3]])
    quit.events.at(-1)!.payload = { reason: 'abandoned' }
    quit.stats = { ...quit.stats, completed: false, abandoned: true }
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[row('aoife', [[10_000, 0], [20_000, 5]]), row('ben', [[10_000, 0], [20_000, 1]]), quit]}
        currentUserId="aoife"
      />,
    )
    // Only aoife and ben finished, and their last sets differ — no consensus.
    expect(html).not.toContain('last to fall')
    // Cleo still gets her own row.
    expect(text(html)).toContain('cleo')
  })

  it('says nothing about consensus when there is none', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[
          row('aoife', [[10_000, 0], [140_000, 1]]),
          row('ben', [[10_000, 2], [140_000, 3]]),
        ]}
        currentUserId="aoife"
      />,
    )
    expect(html).not.toContain('was the wall')
    expect(html).not.toContain('last to fall')
  })

  it('identifies sets by letter and never by their cards', () => {
    const withCards = row('aoife', [[10_000, 0], [90_000, 5]])
    // Distinctive board positions, so a leak would be unmistakable.
    for (const ev of withCards.events) {
      if (ev.type === 'set_valid') ev.payload.cards = [7, 9, 11]
    }
    const body = text(renderToStaticMarkup(<MatchSummary rows={[withCards]} currentUserId="aoife" />))
    expect(body).toContain('hardest F')
    for (const card of ['7', '9', '11']) expect(body).not.toContain(card)
  })

  it('handles a player who found one set, or none', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[row('aoife', [[10_000, 3]]), row('ben', [])]}
        currentUserId="aoife"
      />,
    )
    expect(text(html)).toContain('last D at 0:10')
    expect(text(html)).not.toContain('hardest')
    expect(text(html)).toContain('no sets found')
  })

  it('renders nothing when nobody found anything', () => {
    expect(renderToStaticMarkup(<MatchSummary rows={[row('aoife', [])]} currentUserId="aoife" />)).toBe(
      '',
    )
  })
})
