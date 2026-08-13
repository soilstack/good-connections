import { useState, useCallback } from 'react'
import { generateBoard, type Board, type Mode } from './game/board'
import { Menu } from './ui/Menu'
import { Game } from './ui/Game'
import { CardThemeProvider } from './ui/CardThemeContext'
import { loadCardTheme, saveCardTheme, type CardTheme } from './ui/cardThemes'
import { useAuth } from './ui/useAuth'
import { SignIn } from './ui/SignIn'
import { DisplayNamePrompt } from './ui/DisplayNamePrompt'

/**
 * App shell. Practice mode works signed-out; signing in (magic link) unlocks
 * league play. Auth screens take over only when there is something to do —
 * picking a display name after first sign-in, or the sign-in form itself.
 */

interface Playing {
  board: Board
  // A key so "play again" remounts the Game (fresh recorder + clock).
  gameId: number
}

export function App() {
  const auth = useAuth()
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cardTheme, setCardTheme] = useState<CardTheme>(loadCardTheme)
  const [showSignIn, setShowSignIn] = useState(false)

  const start = useCallback((mode: Mode) => {
    const board = generateBoard(mode, Math.random)
    setPlaying({ board, gameId: Date.now() })
  }, [])

  const playAgain = useCallback(() => {
    setPlaying((prev) => {
      if (!prev) return prev
      const board = generateBoard(prev.board.mode, Math.random)
      return { board, gameId: Date.now() }
    })
    setRefreshKey((k) => k + 1)
  }, [])

  const toMenu = useCallback(() => {
    setPlaying(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const changeCardTheme = useCallback((theme: CardTheme) => {
    setCardTheme(theme)
    saveCardTheme(theme)
  }, [])

  const wrap = (node: React.ReactNode) => <CardThemeProvider theme={cardTheme}>{node}</CardThemeProvider>

  // First sign-in with no profile yet: must choose a display name before anything else.
  if (auth.state.status === 'needsProfile') {
    return wrap(
      <DisplayNamePrompt email={auth.state.email} onSave={auth.saveDisplayName} onSignOut={auth.signOut} />,
    )
  }

  // Sign-in form, when the user asked for it.
  if (showSignIn && auth.state.status !== 'signedIn') {
    return wrap(<SignIn onSend={auth.sendMagicLink} onCancel={() => setShowSignIn(false)} />)
  }

  if (playing) {
    return wrap(
      <Game key={playing.gameId} board={playing.board} onPlayAgain={playAgain} onMenu={toMenu} />,
    )
  }

  return wrap(
    <Menu
      onStart={start}
      refreshKey={refreshKey}
      cardTheme={cardTheme}
      onCardThemeChange={changeCardTheme}
      auth={auth.state}
      onSignIn={() => setShowSignIn(true)}
      onSignOut={auth.signOut}
    />,
  )
}
