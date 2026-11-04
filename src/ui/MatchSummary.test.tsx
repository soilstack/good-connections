import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { canRevealSets, MatchSummary } from './MatchSummary'
import { mockingRoll } from './mocking'
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
/** The text of one player's row in the match list. */
const rowText = (html: string, name: string) =>
  text(html.split('<li ').find((li) => li.includes(`member-name">${name}`))?.split('</li>')[0] ?? '')

describe('MatchSummary', () => {
  it('names each player’s hardest and last set by board letter', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A"
        rows={[row('aoife', [[10_000, 0], [30_000, 2], [150_000, 4]])]}
        currentUserId="aoife"
      />,
    )
    // The 120s gap before set index 4 (= "E") is the wall; E is also last.
    expect(text(html)).toContain('hardest E +2:00 · last E at 2:30')
  })

  it('calls out the set that stalled most players', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A"
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
      <MatchSummary mode="A"
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
      <MatchSummary mode="A"
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
    const body = text(renderToStaticMarkup(<MatchSummary mode="A" rows={[withCards]} currentUserId="aoife" />))
    expect(body).toContain('hardest F')
    for (const card of ['7', '9', '11']) expect(body).not.toContain(card)
  })

  it('handles a player who found one set, or none', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A"
        rows={[row('aoife', [[10_000, 3]]), row('ben', [])]}
        currentUserId="aoife"
      />,
    )
    expect(text(html)).toContain('last D at 0:10')
    expect(text(html)).not.toContain('hardest')
    expect(text(html)).toContain('no sets found')
  })

  it('renders nothing when nobody found anything', () => {
    expect(renderToStaticMarkup(<MatchSummary mode="A" rows={[row('aoife', [])]} currentUserId="aoife" />)).toBe(
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
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal={null} />,
    )
    expect(svg).not.toContain('set-reveal')
    expect(svg).toContain('stay hidden while the day is live')
  })

  it('draws the lettered sets once the gate opens', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
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
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
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
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal="all-played" />,
    )
    expect(text(svg)).toContain('checks 137 of the 220 possible three-card groups')
  })

  it('keeps the board hidden behind the same gate as the sets', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal={null} />,
    )
    expect(svg).not.toContain('board-mini')
  })

  it('titles a past day’s board without "today"', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal="slot-closed" historic />,
    )
    expect(svg).toContain('The board')
    expect(svg).not.toContain('Today’s board')
  })

  it('says the day is over when that was the reason', () => {
    const svg = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={board as any} reveal="slot-closed" />,
    )
    expect(svg).toContain('The day is over')
  })

  it('does not break when the gate is open but the board has not loaded', () => {
    const svg = renderToStaticMarkup(
      <MatchSummary mode="A" rows={rows} currentUserId="MDS" board={null} reveal="all-played" />,
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
      <MatchSummary mode="A" rows={[finished([[1_000, 0], [2_000, 1], [3_000, 2]])]} currentUserId="p" />,
    )
    expect(html).toContain('order-string is-perfect')
    expect(text(html)).toContain('ABC Perfect Play!')
  })

  it('labels an almost-perfect game', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A"
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
    expect(text(html)).toContain('ABbC Almost perfect...sigh')
  })

  it('gives no remark, in grey, when there was a false set', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A"
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
    expect(html).not.toContain('Perfect Play!')
    expect(html).not.toContain('Almost perfect')
  })

  // Nine errors, three of them false sets: enough to be "mocked".
  const botched: TelemetryEvent[] = [
    ...[1_100, 1_200, 1_300].map(
      (t): TelemetryEvent => ({ t_ms: t, type: 'set_invalid', payload: { cards: [0, 1, 2] } }),
    ),
    ...[1_400, 1_500, 1_600, 1_700, 1_800, 1_900].map(
      (t): TelemetryEvent => ({ t_ms: t, type: 'set_duplicate', payload: { cards: [0, 1, 2], setIndex: 0 } }),
    ),
  ]
  const DAY = '2026-10-30'
  /** A botched game by the first player whose roll for DAY comes out `verdict`. */
  const botchedBy = (verdict: 'spongebob' | 'haw' | 'silent') => {
    let i = 0
    while (mockingRoll(`p${i}`, DAY).verdict !== verdict) i++
    const r = finished([[1_000, 0], [2_000, 1]], [...botched])
    return { ...r, userId: `p${i}`, displayName: `p${i}` }
  }

  it('SpongeBob: one coloured letter at a time', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={[botchedBy('spongebob')]} currentUserId="x" puzzleDate={DAY} />,
    )
    expect(html).toContain('order-string is-mocked')
    const letters = [...html.matchAll(/<span style="color:(hsl\([^)]*\))" aria-hidden="true">(.)<\/span>/g)]
    expect(letters.map((m) => m[2]).join('').toLowerCase()).toBe('perfect play?')
    // Every character its own colour.
    expect(new Set(letters.map((m) => m[1])).size).toBe(letters.length)
  })

  it('Ha HAW!: bold, in the skin’s text colour', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={[botchedBy('haw')]} currentUserId="x" puzzleDate={DAY} />,
    )
    expect(html).toContain('<span class="order-remark order-remark-haw">Ha HAW!</span>')
  })

  it('silent: no remark at all', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={[botchedBy('silent')]} currentUserId="x" puzzleDate={DAY} />,
    )
    expect(html).toContain('order-string is-mocked')
    expect(html).not.toContain('order-remark')
  })

  it('the same game gets the same verdict every time', () => {
    const row = botchedBy('haw')
    const render = () =>
      renderToStaticMarkup(<MatchSummary mode="A" rows={[row]} currentUserId="x" puzzleDate={DAY} />)
    expect(render()).toBe(render())
  })

  it('does not mock the same game in Mode B', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="B" rows={[botchedBy('spongebob')]} currentUserId="x" puzzleDate={DAY} />,
    )
    expect(html).toContain('order-string is-other')
    expect(html).not.toContain('order-remark')
  })
})

describe('MatchSummary Hero to Zero', () => {
  /** Six finds, the fifth at `fifth`, finishing at `total`. */
  const p = (name: string, fifth: number, total: number) =>
    row(name, [[1, 0], [2, 1], [3, 2], [4, 3], [fifth, 4], [total - 1_000, 5]])
  const field = [p('hero', 30_000, 200_000), p('bea', 40_000, 90_000), p('cal', 50_000, 100_000)]

  it('names the hero once everyone has played', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={field} currentUserId="bea" reveal="all-played" />,
    )
    expect(rowText(html, 'hero')).toContain('Hero to Zero! Fastest to five sets, then finished last.')
    expect(rowText(html, 'bea')).not.toContain('Hero to Zero')
  })

  it('and once the day is over', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={field} currentUserId="bea" reveal="slot-closed" />,
    )
    expect(text(html)).toContain('Hero to Zero')
  })

  it('not while the day is live, even to someone who has finished', () => {
    for (const reveal of [null, 'you-finished'] as const) {
      const html = renderToStaticMarkup(
        <MatchSummary mode="A" rows={field} currentUserId="bea" reveal={reveal} />,
      )
      expect(html).not.toContain('Hero to Zero')
    }
  })

  it('never in Modes B or C, even on a field that would qualify', () => {
    const zeroField = [p('zed', 90_000, 95_000), p('bea', 40_000, 100_000), p('cal', 50_000, 110_000)]
    for (const mode of ['B', 'C'] as const) {
      for (const rows of [field, zeroField]) {
        const html = renderToStaticMarkup(<MatchSummary mode={mode} rows={rows} currentUserId="bea" reveal="all-played" />)
        expect(html).not.toMatch(/Hero to Zero|Zero to Hero/)
      }
    }
  })

  it('needs three finishers: two plus a give-up is not enough', () => {
    const quit = p('cal', 50_000, 100_000)
    quit.stats = { ...quit.stats, completed: false, abandoned: true }
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={[field[0]!, field[1]!, quit]} currentUserId="bea" reveal="all-played" />,
    )
    expect(html).not.toMatch(/Hero to Zero|Zero to Hero/)
  })
})

describe('MatchSummary Zero to Hero', () => {
  const p = (name: string, fifth: number, total: number) =>
    row(name, [[1, 0], [2, 1], [3, 2], [4, 3], [fifth, 4], [total - 1_000, 5]])
  const field = [p('zed', 90_000, 95_000), p('bea', 40_000, 100_000), p('cal', 50_000, 110_000)]

  it('names the comeback once the field is complete', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={field} currentUserId="zed" reveal="all-played" />,
    )
    expect(rowText(html, 'zed')).toContain('Zero to Hero! Slowest to five sets, then finished first.')
    expect(html).not.toContain('Hero to Zero')
  })

  it('not while the day is live', () => {
    const html = renderToStaticMarkup(
      <MatchSummary mode="A" rows={field} currentUserId="zed" reveal="you-finished" />,
    )
    expect(html).not.toContain('Zero to Hero')
  })
})

describe('MatchSummary Mode C lost wins', () => {
  /** One set found at `lastSet`, Done at `done`, after a false Done costing `penalty`. */
  const c = (name: string, lastSet: number, done: number, penalty = 0): LeaderboardRow => {
    const events: TelemetryEvent[] = []
    if (penalty > 0) events.push({ t_ms: 500, type: 'done_attempt', payload: { complete: false, penaltyMs: penalty } })
    events.push(
      { t_ms: lastSet, type: 'set_valid', payload: { cards: [0, 1, 2], setIndex: 0 } },
      { t_ms: done, type: 'done_attempt', payload: { complete: true, penaltyMs: 0 } },
      { t_ms: done, type: 'game_end', payload: { reason: 'completed' } },
    )
    return { userId: name, displayName: name, stats: deriveStats({ events } as GameRecord), events }
  }
  const field = [c('win', 65_000, 70_000), c('dith', 60_000, 80_000), c('cry', 84_000, 85_000, 20_000)]

  it('mocks a dither and a Done-crier once the field is complete', () => {
    const html = renderToStaticMarkup(<MatchSummary mode="C" rows={field} currentUserId="win" reveal="slot-closed" />)
    expect(rowText(html, 'dith')).toContain('Sat on your thumb too long! Dithered 0:20 before Done')
    expect(rowText(html, 'cry')).toContain('Cried “Done!” too often! Paid 0:20 in penalties')
    expect(rowText(html, 'win')).not.toMatch(/thumb|too often/)
  })

  it('says nothing while the day is live', () => {
    for (const reveal of [null, 'you-finished'] as const) {
      const html = renderToStaticMarkup(<MatchSummary mode="C" rows={field} currentUserId="win" reveal={reveal} />)
      expect(html).not.toContain('Sat on your thumb')
      expect(html).not.toContain('too often')
    }
  })
})
