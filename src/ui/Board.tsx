import type { Card as SetCard } from '../game/cards'
import { Card } from './Card'
import type { Feedback } from './useSetGame'

interface BoardProps {
  cards: readonly SetCard[]
  selected: readonly number[]
  feedback: Feedback | null
  disabled: boolean
  onToggle: (i: number) => void
}

export function Board({ cards, selected, feedback, disabled, onToggle }: BoardProps) {
  return (
    <div className="board">
      {cards.map((card, i) => {
        const isSelected = selected.includes(i)
        const fb = feedback && feedback.cards.includes(i) ? feedback.kind : null
        const cls = ['card-btn', isSelected ? 'is-selected' : '', fb ? `fb-${fb}` : '']
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={i}
            type="button"
            className={cls}
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onToggle(i)}
          >
            <Card card={card} />
          </button>
        )
      })}
    </div>
  )
}
