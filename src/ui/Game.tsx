import { useEffect, useRef, useState } from 'react'
import type { Board } from '../game/board'
import { useSetGame } from './useSetGame'
import { Board as BoardGrid } from './Board'
import { AbandonDialog } from './AbandonDialog'
import { Summary } from './Summary'
import { LeagueResult } from './LeagueResult'
import { Card } from './Card'
import { formatTime } from './format'
import { saveRecord } from './storage'
import { submitLeagueRecord } from '../lib/leagues'

const FEEDBACK_TEXT: Record<'valid' | 'invalid' | 'duplicate', string> = {
  valid: 'New set!',
  invalid: 'Not a set',
  duplicate: 'Already found',
}

export type GameSession =
  | { kind: 'practice' }
  | { kind: 'league'; leagueId: string; leagueName: string; puzzleDate: string; userId: string }

interface GameProps {
  board: Board
  session: GameSession
  /** Leave the game (back to menu / league list). */
  onExit: () => void
  /** Practice only: start another puzzle. */
  onPlayAgain?: () => void
}

export function Game({ board, session, onExit, onPlayAgain }: GameProps) {
  const game = useSetGame({
    board,
    player: session.kind === 'league' ? session.userId : 'local',
    context: session.kind === 'league' ? 'league' : 'practice',
  })

  const persistedRef = useRef(false)
  const [leagueSubmit, setLeagueSubmit] = useState<'pending' | 'done' | 'error'>('pending')

  // Persist once, when the game ends. Practice -> localStorage. League -> post
  // to the server AND wait for it, so the leaderboard we then load already
  // includes the player's own row.
  useEffect(() => {
    if (game.status !== 'ended' || !game.record || persistedRef.current) return
    persistedRef.current = true
    if (session.kind === 'league') {
      submitLeagueRecord({
        leagueId: session.leagueId,
        puzzleDate: session.puzzleDate,
        mode: game.record.mode,
        totalSets: game.record.totalSets,
        startedAtMs: game.record.startedAtMs,
        events: game.record.events,
      })
        .then(() => setLeagueSubmit('done'))
        .catch(() => setLeagueSubmit('error'))
    } else {
      saveRecord(game.record)
    }
  }, [game.status, game.record, session])

  const showDenominator = board.mode === 'A'
  const objective =
    board.mode === 'A'
      ? `Find all ${game.totalSets} sets`
      : 'Find every set — the count is hidden'
  const foundSets = [...game.found].map((idx) => board.sets[idx]!)

  if (game.status === 'ended' && game.stats && game.endReason) {
    if (session.kind === 'league') {
      if (leagueSubmit === 'pending') {
        return (
          <div className="auth-screen">
            <div className="auth-card">
              <h1>{game.endReason === 'completed' ? 'Solved!' : 'Gave up'}</h1>
              <p className="muted">Saving your result…</p>
            </div>
          </div>
        )
      }
      // No missed-set reveal while the league's daily slot is still open.
      return (
        <LeagueResult
          leagueId={session.leagueId}
          leagueName={session.leagueName}
          puzzleDate={session.puzzleDate}
          userId={session.userId}
          stats={game.stats}
          endReason={game.endReason}
          onExit={onExit}
        />
      )
    }
    return (
      <Summary
        board={board}
        stats={game.stats}
        endReason={game.endReason}
        missedSets={game.missedSets}
        onPlayAgain={onPlayAgain ?? onExit}
        onMenu={onExit}
      />
    )
  }

  return (
    <div className="game">
      <header className="game-head">
        <div className="head-left">
          <div className="head-tags">
            <span className="mode-badge">Mode {board.mode}</span>
            {session.kind === 'league' && <span className="league-tag">{session.leagueName}</span>}
          </div>
          <span className="count">
            {game.foundCount}
            {showDenominator && <span className="count-denom"> / {game.totalSets}</span>}
            <span className="count-label"> found</span>
          </span>
        </div>
        <div className="head-right">
          <span className="timer" aria-label="elapsed time">
            {formatTime(game.elapsedMs)}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={game.openAbandon}>
            Give up
          </button>
        </div>
      </header>

      <p className="objective">{objective}</p>

      <div className="feedback-slot" aria-live="polite">
        {game.feedback && (
          <div className={`feedback-banner fb-${game.feedback.kind}`} role="status">
            {FEEDBACK_TEXT[game.feedback.kind]}
          </div>
        )}
      </div>

      <BoardGrid
        cards={board.cards}
        selected={game.selected}
        feedback={game.feedback}
        disabled={game.abandonOpen}
        onToggle={game.toggleCard}
      />

      {foundSets.length > 0 && (
        <section className="found-strip">
          <h2>
            Found sets <span className="found-count">{foundSets.length}</span>
          </h2>
          <div className="found-list">
            {foundSets.map((set, si) => (
              <div className="found-set" key={si}>
                {set.map((ci) => (
                  <div className="mini-card" key={ci}>
                    <Card card={board.cards[ci]!} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {game.abandonOpen && (
        <AbandonDialog
          elapsedMs={game.elapsedMs}
          foundCount={game.foundCount}
          totalSets={game.totalSets}
          showDenominator={showDenominator}
          onConfirm={game.confirmAbandon}
          onCancel={game.cancelAbandon}
        />
      )}
    </div>
  )
}
