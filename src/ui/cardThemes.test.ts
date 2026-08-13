import { describe, expect, it } from 'vitest'
import { CARD_THEMES, CARD_THEME_BY_ID, isCardTheme } from './cardThemes'

describe('card theme registry', () => {
  it('contains the classic renderer plus exactly three premium themes', () => {
    expect(CARD_THEMES.map((theme) => theme.id)).toEqual([
      'classic',
      'nocturne',
      'atelier',
      'signal',
    ])
  })

  it('defines exactly three gameplay colours for every renderer', () => {
    for (const theme of CARD_THEMES) {
      expect(theme.palette).toHaveLength(3)
      expect(new Set(theme.palette).size).toBe(3)
      expect(CARD_THEME_BY_ID[theme.id]).toBe(theme)
    }
  })

  it('rejects unknown persisted values', () => {
    expect(isCardTheme('nocturne')).toBe(true)
    expect(isCardTheme('classic')).toBe(true)
    expect(isCardTheme('')).toBe(false)
    expect(isCardTheme('future-theme')).toBe(false)
    expect(isCardTheme(null)).toBe(false)
  })
})
