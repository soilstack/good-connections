import { describe, expect, it } from 'vitest'
import {
  parseAppTheme,
  resolveAppTheme,
  themeAttribute,
  themeColour,
  type AppTheme,
} from './appTheme'

describe('parseAppTheme', () => {
  it('accepts the three real values', () => {
    for (const t of ['system', 'light', 'dark'] as AppTheme[]) {
      expect(parseAppTheme(t)).toBe(t)
    }
  })

  it('falls back to following the system', () => {
    expect(parseAppTheme(null)).toBe('system')
    expect(parseAppTheme('chartreuse')).toBe('system')
    expect(parseAppTheme('')).toBe('system')
  })
})

describe('resolveAppTheme', () => {
  it('passes an explicit choice through, whatever the device wants', () => {
    // This is the point of having three states rather than two: a player who
    // chose dark keeps dark on a phone set to light.
    expect(resolveAppTheme('dark', true)).toBe('dark')
    expect(resolveAppTheme('light', false)).toBe('light')
  })

  it('follows the device when set to system', () => {
    expect(resolveAppTheme('system', true)).toBe('light')
    expect(resolveAppTheme('system', false)).toBe('dark')
  })
})

describe('themeAttribute', () => {
  it('names the palette for an explicit choice', () => {
    expect(themeAttribute('light')).toBe('light')
    expect(themeAttribute('dark')).toBe('dark')
  })

  it('is null for system, so the media query stays in charge', () => {
    // Writing the resolved value would freeze the page at whatever the device
    // wanted on load, and it would stop following live changes.
    expect(themeAttribute('system')).toBeNull()
  })
})

describe('themeColour', () => {
  it('matches --bg in each palette', () => {
    expect(themeColour('dark')).toBe('#0f1220')
    expect(themeColour('light')).toBe('#e9edf7')
  })
})
