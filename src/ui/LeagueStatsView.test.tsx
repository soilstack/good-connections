import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LeagueStatsView } from './LeagueStatsView'
import { RecordBanner } from './LeagueResult'
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
}
const noop = () => {}

describe('LeagueStatsView — fastest by set count', () => {
  it('lists every set count from 1 to 14, with the gaps showing', () => {
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
    expect(html.match(/class="record-row/g)?.length).toBe(14)
    expect(html.match(/record-row is-empty/g)?.length).toBe(12)
    expect(text(html)).toContain('1 set')
    expect(text(html)).toContain('14 sets')
    expect(text(html)).toContain('3 sets MDS')
  })

  it('still shows all fourteen before anyone has finished', () => {
    const html = renderToStaticMarkup(
      <LeagueStatsView stats={base} mode="C" currentUserId="MDS" onSelectMember={noop} />,
    )
    expect(html.match(/record-row is-empty/g)?.length).toBe(14)
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
    expect(head).toContain('Player Best Median Worst95 ± Games')
    expect(text(html)).toContain('0:50 0:50 1:26 0:18 3') // best, median, p95, sd, games
  })
})

describe('RecordBanner', () => {
  it('names the Mode A rank', () => {
    expect(text(renderToStaticMarkup(<RecordBanner held={{ kind: 'top-three', rank: 1, timeMs: 55_700 }} />))).toContain(
      '0:55.7 is the league’s fastest solve ever',
    )
    expect(text(renderToStaticMarkup(<RecordBanner held={{ kind: 'top-three', rank: 2, timeMs: 58_000 }} />))).toContain(
      'second-fastest',
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
    const html = renderToStaticMarkup(<RecordBanner held={{ kind: 'top-three', rank: 1, timeMs: 1 }} />)
    expect(html.toLowerCase()).not.toContain('new')
  })
})
