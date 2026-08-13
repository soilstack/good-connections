import { useCallback } from 'react'
import type { Board } from '../game/board'
import type { GameRecord } from '../game/telemetry'
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
  const persist = useCallback(
    (record: GameRecord) => {
      if (session.kind === 'league') {
        void submitLeagueRecord({
          leagueId: session.leagueId,
          puzzleDate: session.puzzleDate,
          mode: record.mode,
          totalSets: record.totalSets,
          startedAtMs: record.startedAtMs,
          events: record.events,
        })
      } else {
        saveRecord(record)
      }
    },
    [session],
  )

  const game = useSetGame({
    board,
    player: session.kind === 'league' ? session.userId : 'local',
    context: session.kind === 'league' ? 'league' : 'practice',
    onPersist: persist,
  })

  const showDenominator = board.mode === 'A'
  const foundSets = [...game.found].map((idx) => board.sets[idx]!)

  if (game.status === 'ended' && game.stats && game.endReason) {
    if (session.kind === 'league') {
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
          <span className="mode-badge">
            {session.kind === 'league' ? session.leagueName : `Mode ${board.mode}`}
          </span>
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
