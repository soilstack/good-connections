import { useMemo } from 'react'
import type { Mode } from '../game/board'
import { aggregateSolveTimes, completionRate } from '../game/telemetry'
import { loadRecords } from './storage'
import { formatTime } from './format'

interface MenuProps {
  onStart: (mode: Mode) => void
  /** Bumped after each game so the history re-reads from storage. */
  refreshKey: number
}

function ModeCard({
  mode,
  title,
  blurb,
  played,
  meanMs,
  completion,
  onStart,
}: {
  mode: Mode
  title: string
  blurb: string
  played: number
  meanMs: number | null
  completion: number
  onStart: (mode: Mode) => void
}) {
  return (
    <button type="button" className="mode-card" onClick={() => onStart(mode)}>
      <span className="mode-card-title">{title}</span>
      <span className="mode-card-blurb">{blurb}</span>
      <span className="mode-card-stats">
        {played === 0
          ? 'No games yet'
          : `${played} completed · avg ${meanMs === null ? '—' : formatTime(meanMs)} · ${Math.round(
              completion * 100,
            )}% finished`}
      </span>
    </button>
  )
}

export function Menu({ onStart, refreshKey }: MenuProps) {
  const records = useMemo(() => loadRecords(), [refreshKey])
  const aggA = aggregateSolveTimes(records, 'practice', 'A')
  const aggB = aggregateSolveTimes(records, 'practice', 'B')

  return (
    <div className="menu">
      <header className="menu-head">
        <h1>Set</h1>
        <p className="muted">Practice — find every set on the board.</p>
      </header>

      <div className="mode-cards">
        <ModeCard
          mode="A"
          title="Mode A · Six sets"
          blurb="The board has exactly 6 sets. You can see how many remain."
          played={aggA.gamesCompleted}
          meanMs={aggA.meanTotalTimeMs}
          completion={completionRate(records, 'practice', 'A')}
          onStart={onStart}
        />
        <ModeCard
          mode="B"
          title="Mode B · Unknown"
          blurb="An ordinary deal. You are not told how many sets exist."
          played={aggB.gamesCompleted}
          meanMs={aggB.meanTotalTimeMs}
          completion={completionRate(records, 'practice', 'B')}
          onStart={onStart}
        />
      </div>
    </div>
  )
}
