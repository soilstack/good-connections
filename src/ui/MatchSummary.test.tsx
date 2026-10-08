import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { canRevealSets, MatchSummary } from './MatchSummary'
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

/**
 * The reveal gate. Everyone in a league plays the same board, so showing the
 * solution to someone while another member still has the day ahead of them
 * hands over something they can pass on. These are the cases that must stay
 * shut.
 */
describe('canRevealSets', () => {
  const roster = ['alice', 'bob', 'carol']

  it('stays shut while a member has not played', () => {
    expect(
      canRevealSets({ playedUserIds: ['alice', 'bob'], roster, slotClosed: false }),
    ).toBeNull()
  })

  it('opens once every member has played, even mid-day', () => {
    expect(
      canRevealSets({ playedUserIds: ['alice', 'bob', 'carol'], roster, slotClosed: false }),
    ).toBe('all-played')
  })

  it('opens when the day rolls over, even if someone never played', () => {
    // Otherwise one absent member locks that day's board forever.
    expect(canRevealSets({ playedUserIds: ['alice'], roster, slotClosed: true })).toBe(
      'slot-closed',
    )
  })

  it('names "all played" when both gates are open, since that is the real reason', () => {
    expect(
      canRevealSets({ playedUserIds: roster, roster, slotClosed: true }),
    ).toBe('all-played')
  })

  it('stays shut when the roster is unknown and the day is live', () => {
    // league_members() not installed: the "everyone played" test is
    // unavailable, so fall back to waiting for the slot. Failing open here
    // would leak the board to whoever finished first.
    expect(canRevealSets({ playedUserIds: ['alice'], roster: null, slotClosed: false })).toBeNull()
  })

  it('still opens on slot close when the roster is unknown', () => {
    expect(canRevealSets({ playedUserIds: ['alice'], roster: null, slotClosed: true })).toBe(
      'slot-closed',
    )
  })

  it('treats an empty roster as unknown rather than “everyone has played”', () => {
    // [] would vacuously satisfy every(), which would open the gate on day one
    // of a league before anyone joined. That must not count.
    expect(canRevealSets({ playedUserIds: [], roster: [], slotClosed: false })).toBeNull()
  })

  it('is not fooled by a non-member having played', () => {
    expect(
      canRevealSets({
        playedUserIds: ['alice', 'bob', 'stranger'],
        roster,
        slotClosed: false,
      }),
    ).toBeNull()
  })
})

describe('MatchSummary set reveal', () => {
  const rows = [row('MDS', [[1_000, 0]]), row('Telemattic', [[2_000, 1]])]
  const board = {
    mode: 'A' as const,
    cards: Array.from({ length: 12 }, (_, i) => ({
      count: (i % 3) + 1,
      colour: ['red', 'green', 'purple'][i % 3],
      shape: ['diamond', 'squiggle', 'oval'][i % 3],
      fill: ['solid', 'striped', 'open'][i % 3],
      id: i,
    })),
    sets: [
      [0, 1, 2],
      [3, 4, 5],
    ],
    attempts: 1,
  }

  it('draws no cards while the day is live', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal={null} />,
    )
    expect(svg).not.toContain('set-reveal')
    expect(svg).toContain('stay hidden while the day is live')
  })

  it('draws the lettered sets once the gate opens', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
    )
    expect(svg).toContain('set-reveal')
    expect(svg).toContain('Everyone has played')
    // Two sets, three cards each — counted inside the reveal only, since the
    // full board below now has mini-cards of its own.
    const reveal = svg.slice(svg.indexOf('set-reveal'), svg.indexOf('board-mini-sub'))
    expect(reveal.match(/mini-card/g)?.length).toBe(6)
  })

  it('shows the whole board as dealt under the sets', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
    )
    expect(svg).toContain('Today’s board')
    const grid = svg.slice(svg.indexOf('class="board-mini"'))
    expect(grid.match(/mini-card/g)?.length).toBe(12)
  })

  it('says how many checks a perfect top-left scan needs', () => {
    // Last set is (3,4,5): 55 + 45 + 36 groups pinned on cards 0-2, then it is
    // the very first group pinned on card 3 — 137 of the 220.
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
    )
    expect(text(svg)).toContain('checks 137 of the 220 possible three-card groups')
  })

  it('keeps the board hidden behind the same gate as the sets', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal={null} />,
    )
    expect(svg).not.toContain('board-mini')
  })

  it('titles a past day’s board without "today"', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal="slot-closed" historic />,
    )
    expect(svg).toContain('The board')
    expect(svg).not.toContain('Today’s board')
  })

  it('says the day is over when that was the reason', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary rows={rows} currentUserId="MDS" board={board as any} reveal="slot-closed" />,
    )
    expect(svg).toContain('The day is over')
  })

  it('does not break when the gate is open but the board has not loaded', () => {
    const svg = renderToStaticMarkup(
      <MatchSummary rows={rows} currentUserId="MDS" board={null} reveal="all-played" />,
    )
    expect(svg).not.toContain('set-reveal')
  })
})

describe('canRevealSets — the viewer’s own completed board', () => {
  const roster = ['alice', 'bob', 'carol']

  it('shows the board to someone who found every set, even mid-day', () => {
    // Completing means finding all of them, so this reveals nothing they do
    // not already hold. It is what makes the board visible the moment you
    // finish, instead of waiting on the slowest member.
    expect(
      canRevealSets({
        playedUserIds: ['alice'],
        roster,
        slotClosed: false,
        viewerCompleted: true,
      }),
    ).toBe('you-finished')
  })

  it('does NOT show it to someone who gave up', () => {
    // The whole point of the rule: they have sets they never found, and the
    // day is still live for everyone else.
    expect(
      canRevealSets({
        playedUserIds: ['alice'],
        roster,
        slotClosed: false,
        viewerCompleted: false,
      }),
    ).toBeNull()
  })

  it('defaults to hidden when the caller says nothing about the viewer', () => {
    expect(
      canRevealSets({ playedUserIds: ['alice'], roster, slotClosed: false }),
    ).toBeNull()
  })

  it('still prefers the more public reason when several apply', () => {
    expect(
      canRevealSets({ playedUserIds: roster, roster, slotClosed: true, viewerCompleted: true }),
    ).toBe('all-played')
    expect(
      canRevealSets({
        playedUserIds: ['alice'],
        roster,
        slotClosed: true,
        viewerCompleted: true,
      }),
    ).toBe('slot-closed')
  })
})

describe('MatchSummary order-string remark', () => {
  const finished = (finds: [number, number][], extra: TelemetryEvent[] = []) => {
    const r = row('p', finds)
    // keep game_end last
    const end = r.events.pop()!
    r.events.push(...extra.sort((x, y) => x.t_ms - y.t_ms), end)
    r.events.sort((x, y) => x.t_ms - y.t_ms)
    return r
  }

  it('labels a perfect game, bold and green', () => {
    const html = renderToStaticMarkup(
      <MatchSummary rows={[finished([[1_000, 0], [2_000, 1], [3_000, 2]])]} currentUserId="p" />,
    )
    expect(html).toContain('order-string is-perfect')
    expect(text(html)).toContain('ABC (Perfect!)')
  })

  it('labels an almost-perfect game', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[
          finished(
            [[1_000, 0], [2_000, 1], [3_000, 2]],
            [{ t_ms: 2_500, type: 'set_duplicate', payload: { cards: [0, 1, 2], setIndex: 1 } }],
          ),
        ]}
        currentUserId="p"
      />,
    )
    expect(html).toContain('order-string is-almost-perfect')
    expect(text(html)).toContain('ABbC (Almost perfect!)')
  })

  it('gives no remark, in grey, when there was a false set', () => {
    const html = renderToStaticMarkup(
      <MatchSummary
        rows={[
          finished(
            [[1_000, 0], [2_000, 1], [3_000, 2]],
            [{ t_ms: 1_500, type: 'set_invalid', payload: { cards: [0, 1, 2] } }],
          ),
        ]}
        currentUserId="p"
      />,
    )
    expect(html).toContain('order-string is-other')
    expect(text(html)).toContain('AxBC')
    expect(html).not.toContain('Perfect!')
    expect(html).not.toContain('Almost perfect!')
  })
})
