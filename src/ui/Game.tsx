import type { Board } from '../game/board'
import { useSetGame } from './useSetGame'
import { Board as BoardGrid } from './Board'
import { AbandonDialog } from './AbandonDialog'
import { Summary } from './Summary'
import { Card } from './Card'
import { formatTime } from './format'

const FEEDBACK_TEXT: Record<'valid' | 'invalid' | 'duplicate', string> = {
  valid: 'New set!',
  invalid: 'Not a set',
  duplicate: 'Already found',
}

interface GameProps {
  board: Board
  onPlayAgain: () => void
  onMenu: () => void
}

export function Game({ board, onPlayAgain, onMenu }: GameProps) {
  const game = useSetGame(board, 'local')
  const showDenominator = board.mode === 'A'
  const foundSets = [...game.found].map((idx) => board.sets[idx]!)

  if (game.status === 'ended' && game.stats && game.endReason) {
    return (
      <Summary
        board={board}
        stats={game.stats}
        endReason={game.endReason}
        missedSets={game.missedSets}
        onPlayAgain={onPlayAgain}
        onMenu={onMenu}
      />
    )
  }

  return (
    <div className="game">
      <header className="game-head">
        <div className="head-left">
          <span className="mode-badge">Mode {board.mode}</span>
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
