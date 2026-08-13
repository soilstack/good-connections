import { createContext, useContext, type ReactNode } from 'react'
import type { CardTheme } from './cardThemes'

const CardThemeContext = createContext<CardTheme>('classic')

export function CardThemeProvider({ theme, children }: { theme: CardTheme; children: ReactNode }) {
  return <CardThemeContext.Provider value={theme}>{children}</CardThemeContext.Provider>
}

export function useCardTheme(): CardTheme {
  return useContext(CardThemeContext)
}
