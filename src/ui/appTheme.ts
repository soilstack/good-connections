/**
 * Light/dark theme for the app chrome. Separate from the CARD theme in
 * ./cardThemes, which recolours the symbols on the cards — a player can run
 * Signal cards on a light page or Classic cards on a dark one.
 *
 * Three states, not two. 'system' follows the device and is the default;
 * 'light' and 'dark' are deliberate overrides that must survive the device
 * changing its mind. That is why the CSS guards its prefers-color-scheme rule
 * with :not([data-theme='dark']) — an explicit choice has to beat the media
 * query, and a tri-state is the only way to tell "chose light" apart from
 * "happens to be light right now".
 *
 * The decisions are pure functions taking the environment as an argument; only
 * the three thin wrappers at the bottom touch localStorage or the DOM. That
 * keeps the logic testable without pulling in a DOM implementation.
 */
export type AppTheme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'good-connections.app-theme.v1'

/** The browser-chrome colour, matching --bg in each palette. */
const THEME_COLOUR: Record<'light' | 'dark', string> = {
  dark: '#0f1220',
  light: '#e9edf7',
}

/** A stored value, validated. Anything unrecognised falls back to 'system'. */
export function parseAppTheme(raw: string | null): AppTheme {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

/** Which palette `theme` resolves to, given what the device currently asks for. */
export function resolveAppTheme(theme: AppTheme, prefersLight: boolean): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return prefersLight ? 'light' : 'dark'
}

/** The <meta name="theme-color"> value for a resolved palette. */
export function themeColour(resolved: 'light' | 'dark'): string {
  return THEME_COLOUR[resolved]
}

/**
 * What `data-theme` should be: the chosen value, or null to remove it.
 *
 * 'system' removes the attribute rather than writing the resolved value, so the
 * CSS media query stays in charge and the page follows the device live, with no
 * listener to register or leak.
 */
export function themeAttribute(theme: AppTheme): string | null {
  return theme === 'system' ? null : theme
}

// --- environment wrappers --------------------------------------------------

function prefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches
  } catch {
    return false
  }
}

export function loadAppTheme(): AppTheme {
  try {
    return parseAppTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    // Private mode or blocked storage: fall through to the default.
    return 'system'
  }
}

export function saveAppTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A blocked/quota-limited localStorage should never prevent play.
  }
}

/** Put the choice on <html> and keep the iOS status bar in step. */
export function applyAppTheme(theme: AppTheme): void {
  const root = document.documentElement
  const attr = themeAttribute(theme)
  if (attr === null) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', attr)

  // The meta tag cannot follow a media query itself, so it gets the resolved
  // value even when the attribute is being removed.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', themeColour(resolveAppTheme(theme, prefersLight())))
}
