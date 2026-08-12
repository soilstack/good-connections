export type CardTheme = 'classic' | 'nocturne' | 'atelier' | 'signal'

export interface CardThemeDefinition {
  readonly id: CardTheme
  readonly label: string
  readonly description: string
  readonly palette: readonly [string, string, string]
}

export const CARD_THEMES: readonly CardThemeDefinition[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Reference deck',
    palette: ['#e4002b', '#12a150', '#6c2d9c'],
  },
  {
    id: 'nocturne',
    label: 'Nocturne',
    description: 'Celestial glass',
    palette: ['#ff5a63', '#20d99a', '#a66cff'],
  },
  {
    id: 'atelier',
    label: 'Atelier',
    description: 'Fine letterpress',
    palette: ['#d9442d', '#146247', '#68286f'],
  },
  {
    id: 'signal',
    label: 'Signal',
    description: 'Kinetic modernism',
    palette: ['#ff3f49', '#00a86b', '#701bff'],
  },
] as const

export const CARD_THEME_BY_ID: Readonly<Record<CardTheme, CardThemeDefinition>> = {
  classic: CARD_THEMES[0],
  nocturne: CARD_THEMES[1],
  atelier: CARD_THEMES[2],
  signal: CARD_THEMES[3],
}

const STORAGE_KEY = 'good-connections.card-theme.v1'

export function isCardTheme(value: unknown): value is CardTheme {
  return typeof value === 'string' && Object.hasOwn(CARD_THEME_BY_ID, value)
}

export function loadCardTheme(): CardTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isCardTheme(stored) ? stored : 'classic'
  } catch {
    return 'classic'
  }
}

export function saveCardTheme(theme: CardTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A blocked/quota-limited localStorage should never prevent play.
  }
}
