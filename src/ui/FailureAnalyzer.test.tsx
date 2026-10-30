import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FailureAnalyzerView } from './FailureAnalyzer'
import type { FailureReport, FeatureStat } from '../game/failures'

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const stat = (last: number, expected: number, finds = 20, slowness: number | null = 0.5): FeatureStat => ({
  last,
  expected,
  finds,
  slowness,
})

describe('FailureAnalyzerView', () => {
  const report: FailureReport = {
    games: 20,
    features: new Map([
      ['differ:4', stat(10, 4, 30, 0.72)], // last set 50% vs 20% on the boards
      ['differ:1', stat(1, 1)], // too thin to read
      ['pos:0', stat(9, 5)],
    ]),
  }

  it('shows last-set share, board share, lift and slowness', () => {
    const t = text(renderToStaticMarkup(<FailureAnalyzerView report={report} />))
    expect(t).toContain('From 20 finished games on closed days.')
    expect(t).toContain('All 4 differ 50% 20% ×2.5 72')
  })

  it('fades rows with too little behind them', () => {
    const html = renderToStaticMarkup(<FailureAnalyzerView report={report} />)
    const row = html.slice(html.indexOf('1 differs'), html.indexOf('2 differ'))
    expect(row).toContain('is-thin')
  })

  it('lays out twelve card positions, card 1 first', () => {
    const html = renderToStaticMarkup(<FailureAnalyzerView report={report} />)
    expect(html.match(/class="fa-cell( is-thin)?"/g)).toHaveLength(12)
    expect(text(html)).toContain('1 ×1.8')
  })

  it('says so when there is nothing to analyse', () => {
    const t = text(renderToStaticMarkup(<FailureAnalyzerView report={{ games: 0, features: new Map() }} />))
    expect(t).toContain('No finished games on closed days yet.')
  })
})
