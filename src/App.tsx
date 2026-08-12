import { useState, useCallback } from 'react'
import { generateBoard, type Board, type Mode } from './game/board'
import { Menu } from './ui/Menu'
import { Game } from './ui/Game'

/**
 * Slice-1 practice app: a menu to pick a mode, then a single fixed-board game
 * ending in a summary. Practice boards are generated fresh here, with no access
 * to any league board (there is none yet) — see CLAUDE.md.
 */

interface Playing {
  board: Board
  // A key so "play again" remounts the Game (fresh recorder + clock).
  gameId: number
}

export function App() {
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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

  if (!playing) return <Menu onStart={start} refreshKey={refreshKey} />

  return <Game key={playing.gameId} board={playing.board} onPlayAgain={playAgain} onMenu={toMenu} />
}
