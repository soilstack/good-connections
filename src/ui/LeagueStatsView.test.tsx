import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LeagueStatsView } from './LeagueStatsView'
import { BattleHistory } from './BattleHistory'
import { PersonalBestBanner, RecordBanner } from './LeagueResult'
import type { LeagueStats, SoloRecord } from '../lib/leagues'

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const rec = (userId: string, timeMs: number, date = '2026-10-01'): SoloRecord => ({
  userId,
  displayName: userId,
  timeMs,
  puzzleDate: date,
})
const base: LeagueStats = {
  mode: 'C',
  topSolves: [],
  fastestBySetCount: [],
  members: [],
  notables: [],
  personalBests: [],
  results: [],
  headToHead: [],
  medianSeries: [],
}
const noop = () => {}

describe('LeagueStatsView — fastest by set count', () => {
  it('lists every set count from 1 to 10, with the gaps showing', () => {
    const stats = {
      ...base,
      fastestBySetCount: [
        { setCount: 3, record: rec('MDS', 55_700) },
        { setCount: 7, record: rec('Telemattic', 317_200) },
      ],
    }
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={stats} mode="C" currentUserId="MDS" onSelectMember={noop} />,
    )
    expect(html.match(/class="record-row/g)?.length).toBe(10)
    expect(html.match(/record-row is-empty/g)?.length).toBe(8)
    expect(text(html)).toContain('1 set')
    expect(text(html)).toContain('10 sets')
    expect(text(html)).not.toContain('11 sets')
    expect(text(html)).toContain('3 sets MDS')
  })

  it('still shows all ten before anyone has finished', () => {
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={base} mode="C" currentUserId="MDS" onSelectMember={noop} />,
    )
    expect(html.match(/record-row is-empty/g)?.length).toBe(10)
  })
})

describe('LeagueStatsView — Mode A solve times', () => {
  it('has the requested columns', () => {
    const stats: LeagueStats = {
      ...base,
      mode: 'A',
      members: [
        {
          userId: 'MDS',
          displayName: 'MDS',
          gamesPlayed: 3,
          gamesCompleted: 3,
          completionRate: 1,
          bestTimeMs: 50_000,
          spread: {
            bestMs: 50_000,
            worstMs: 90_000,
            meanMs: 63_333,
            medianMs: 50_000,
            p95Ms: 86_000,
            stdDevMs: 18_856,
            count: 3,
          },
          penaltyMs: 0,
          currentStreak: 3,
        },
      ],
    }
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={stats} mode="A" currentUserId="MDS" onSelectMember={noop} />,
    )
    const head = text(html.slice(html.indexOf('<thead'), html.indexOf('</thead>')))
    expect(head).toContain('Player Best Med Worst ± Games')
    expect(text(html)).toContain('0:50 0:50 1:26 0:18 3') // best, median, p95, sd, games
  })
})

describe('RecordBanner', () => {
  it('names the Mode A rank', () => {
    expect(text(renderToStaticMarkup(<RecordBanner held={{ kind: 'top-five', rank: 1, timeMs: 55_700 }} />))).toContain(
      '0:55.7 is the league’s fastest solve ever',
    )
    expect(text(renderToStaticMarkup(<RecordBanner held={{ kind: 'top-five', rank: 2, timeMs: 58_000 }} />))).toContain(
      'second-fastest',
    )
    expect(text(renderToStaticMarkup(<RecordBanner held={{ kind: 'top-five', rank: 5, timeMs: 70_000 }} />))).toContain(
      '1:10.0 is the league’s fifth-fastest solve ever',
    )
  })

  it('names the set count in Modes B and C', () => {
    expect(
      text(renderToStaticMarkup(<RecordBanner held={{ kind: 'set-count', setCount: 3, timeMs: 55_700 }} />)),
    ).toContain('0:55.7 is the league record for a 3-set board')
  })

  it('says "an" for eight and eleven', () => {
    for (const n of [8, 11]) {
      expect(
        text(renderToStaticMarkup(<RecordBanner held={{ kind: 'set-count', setCount: n, timeMs: 60_000 }} />)),
      ).toContain(`record for an ${n}-set board`)
    }
  })

  it('never calls it "new" — a record still standing on a later day is not new', () => {
    const html = renderToStaticMarkup(<RecordBanner held={{ kind: 'top-five', rank: 1, timeMs: 1 }} />)
    expect(html.toLowerCase()).not.toContain('new')
  })
})

describe('PersonalBestBanner', () => {
  it('names the time and the best it beat', () => {
    const html = renderToStaticMarkup(
      <PersonalBestBanner
        pbs={[
          { userId: 'p', puzzleDate: 'd', kind: 'solve', timeMs: 62_300, previousMs: 65_000 },
          { userId: 'p', puzzleDate: 'd', kind: 'first-five', timeMs: 48_200, previousMs: 50_000 },
        ]}
      />,
    )
    expect(text(html)).toContain('Personal Best!')
    expect(text(html)).toContain('Solved in 1:02.3 , beating your 1:05.0')
    expect(text(html)).toContain('First five sets in 0:48.2 , beating your 0:50.0')
  })

  it('names the board size in Modes B and C', () => {
    const html = renderToStaticMarkup(
      <PersonalBestBanner pbs={[{ userId: 'p', puzzleDate: 'd', kind: 'solve', timeMs: 41_200, previousMs: 45_000, setCount: 8 }]} />,
    )
    expect(text(html)).toContain('on an 8-set board')
  })
})

describe('LeagueStatsView — Results', () => {
  const results = [
    { userId: 'MDS', displayName: 'MDS', games: 12, firstPlaces: 5, perfects: 2, bestFirstFiveMs: 41_300 },
    { userId: 'TM', displayName: 'TM', games: 10, firstPlaces: 4, perfects: 0, bestFirstFiveMs: null },
  ]

  it('has the requested columns in Mode A', () => {
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={{ ...base, mode: 'A', results }} mode="A" currentUserId="MDS" onSelectMember={noop} />,
    )
    const table = html.slice(html.indexOf('Results'))
    expect(text(table)).toContain('Player Games 1st Perfect 5 sets')
    expect(text(table)).toContain('MDS (you) 12 5(42%) 2 0:41.3')
    expect(text(table)).toContain('TM 10 4(40%) 0 —')
  })

  it('drops the five-set column in Modes B and C', () => {
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={{ ...base, results }} mode="C" currentUserId="MDS" onSelectMember={noop} />,
    )
    const table = html.slice(html.indexOf('Results'))
    expect(text(table)).toContain('Player Games 1st Perfect MDS')
    expect(text(table)).not.toContain('5 sets')
    expect(text(table)).toContain('MDS (you) 12 5(42%) 2')
  })

  it('links to Battle history only when there is a shared day to show', () => {
    const headToHead = [{ userIds: ['MDS', 'TM'] as [string, string], days: 3, rows: results }]
    const withBattles = renderToStaticMarkup(
      <LeagueStatsView stats={{ ...base, results, headToHead }} mode="C" currentUserId="MDS" onSelectMember={noop} onOpenBattles={noop} />,
    )
    expect(withBattles).toContain('Battle history')
    const without = renderToStaticMarkup(
      <LeagueStatsView stats={{ ...base, results }} mode="C" currentUserId="MDS" onSelectMember={noop} onOpenBattles={noop} />,
    )
    expect(without).not.toContain('Battle history')
  })
})

describe('BattleHistory', () => {
  const row = (id: string, games: number, firstPlaces: number) => ({
    userId: id,
    displayName: id,
    games,
    firstPlaces,
    perfects: 0,
    bestFirstFiveMs: null,
  })
  const players = ['MDS', 'RW', 'TM', 'NEW'].map((id) => ({ userId: id, displayName: id }))
  const pairs = [
    { userIds: ['MDS', 'RW'] as [string, string], days: 4, rows: [row('RW', 4, 3), row('MDS', 4, 1)] },
    { userIds: ['MDS', 'TM'] as [string, string], days: 2, rows: [row('MDS', 2, 2), row('TM', 2, 0)] },
  ]
  const render = () =>
    renderToStaticMarkup(
      <BattleHistory pairs={pairs} players={players} leagueName="Orc Style" mode="C" currentUserId="MDS" onBack={noop} />,
    )

  it('lays the pairs out as a half matrix, row player’s wins first', () => {
    const t = text(render())
    // Columns MDS, RW; rows RW, TM. NEW never met anyone, so is left out.
    expect(t).toContain('MDS RW RW 3 – 1')
    expect(t).toContain('TM 0 – 2 —')
    expect(t).not.toContain('NEW')
  })

  it('bolds the leader’s number, whichever side of the cell it is on', () => {
    const html = render()
    // RW (row) leads MDS (column) 3–1; that pair opens first.
    expect(html).toContain('h2h-cell is-open" aria-pressed="true" aria-label="RW 3, MDS 1, over 4 days"><span class="h2h-lead">3</span>–<span class="h2h-trail">1</span>')
    // MDS (column) leads TM (row) 2–0: the bold goes on the right-hand number.
    expect(html).toContain('<span class="h2h-trail">0</span>–<span class="h2h-lead">2</span>')
  })

  it('leaves a tie plain', () => {
    const tied = [{ userIds: ['MDS', 'RW'] as [string, string], days: 2, rows: [row('RW', 2, 1), row('MDS', 2, 1)] }]
    const html = renderToStaticMarkup(
      <BattleHistory pairs={tied} players={players} leagueName="x" mode="C" currentUserId="MDS" onBack={noop} />,
    )
    expect(html).toContain('<span>1</span>–<span>1</span>')
  })

  it('opens the most-shared pair’s full table underneath', () => {
    expect(text(render())).toContain('MDS (you) vs RW · 4 days Player Games 1st Perfect RW 4 3(75%) 0 MDS (you) 4 1(25%) 0')
  })
})
