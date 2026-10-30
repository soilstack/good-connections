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
    const t = text(renderToStaticMarkup(<FailureAnalyzerView report={report} who={{ name: 'Ling', isYou: false }} />))
    expect(t).toContain('From 20 of Ling’s finished games on closed days.')
    expect(t).toContain('the last set Ling found had it')
    // Someone else's page never says "you" or "your".
    expect(t).not.toMatch(/\byour?\b/i)
    expect(t).toContain('All 4 differ 50% 20% ×2.5 72')
  })

  it('fades rows with too little behind them', () => {
    const html = renderToStaticMarkup(<FailureAnalyzerView report={report} who={{ name: 'Ling', isYou: false }} />)
    const row = html.slice(html.indexOf('1 differs'), html.indexOf('2 differ'))
    expect(row).toContain('is-thin')
  })

  it('lays out twelve card positions, card 1 first', () => {
    const html = renderToStaticMarkup(<FailureAnalyzerView report={report} who={{ name: 'Ling', isYou: false }} />)
    expect(html.match(/class="fa-cell( is-thin)?"/g)).toHaveLength(12)
    expect(text(html)).toContain('1 ×1.8')
  })

  it('says so when there is nothing to analyse', () => {
    const t = text(renderToStaticMarkup(<FailureAnalyzerView report={{ games: 0, features: new Map() }} who={{ name: 'Ling', isYou: false }} />))
    expect(t).toContain('No finished games on closed days for Ling yet.')
  })
})

describe('FailureAnalyzerView — heat colours', () => {
  const report: FailureReport = {
    games: 20,
    features: new Map([
      ['differ:4', stat(10, 4, 30, 0.8)], // ×2.5 and slow 80: both full-strength red
      ['differ:3', stat(4, 4, 30, 0.5)], // ×1.0 and slow 50: ordinary, no colour
      ['differ:2', stat(2, 4, 30, 0.35)], // ×0.5: full-strength green; slow 35: half green
    ]),
  }
  const html = renderToStaticMarkup(<FailureAnalyzerView report={report} who={{ name: 'MDS', isYou: true }} />)

  it('shades harder-than-ordinary cells red, deeper and bold when strong', () => {
    expect(html).toMatch(/class="is-strong" style="background:color-mix\(in srgb, var\(--bad\) 45%, var\(--surface\)\)">×2\.5/)
    expect(html).toMatch(/class="is-strong" style="background:color-mix\(in srgb, var\(--bad\) 45%, var\(--surface\)\)">80/)
  })

  it('leaves ordinary cells unshaded', () => {
    expect(html).toMatch(/<td>×1\.0<\/td>/)
    expect(html).toMatch(/<td>50<\/td>/)
  })

  it('shades easier-than-ordinary cells green, by how far from ordinary', () => {
    expect(html).toMatch(/var\(--ok\) 45%, var\(--surface\)\)">×0\.5/)
    expect(html).toMatch(/<td style="background:color-mix\(in srgb, var\(--ok\) 23%, var\(--surface\)\)">35<\/td>/)
  })

  it('says "you" on your own page', () => {
    expect(text(html)).toContain('From 20 of your finished games')
  })
})
