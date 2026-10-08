import { deriveTimeline, ditheringMs, type GameRecord, type TelemetryEvent } from '../game/telemetry'
import { formatTime } from './format'

/**
 * Play-by-play of a single solve: when each set was found, the gap since the
 * previous one, and how many wrong / already-found attempts happened in that
 * gap. Cards are intentionally not shown, so this leaks no solution.
 */
export function SolveTimelineView({ events }: { events: TelemetryEvent[] }) {
  const t = deriveTimeline({ events } as GameRecord)
  // Mode C only: the wait between the last set and the winning "Done". Null in
  // Modes A and B, which end themselves on the last set.
  const dither = ditheringMs(events)
  const lastAt = t.steps.length > 0 ? t.steps[t.steps.length - 1]!.atMs : null

  if (t.steps.length === 0) {
    return <p className="muted timeline-empty">No sets found.</p>
  }

  return (
    <ol className="timeline">
      {t.steps.map((s, i) => (
        <li className="timeline-step" key={i}>
          <span className="ts-num">Set {i + 1}</span>
          <span className="ts-at">{formatTime(s.atMs, true)}</span>
          <span className="ts-gap">
            {i === 0 ? 'to first' : `+${formatTime(s.sincePrevMs, true)}`}
            {(s.falseBefore > 0 || s.duplicatesBefore > 0) && (
              <span className="ts-misses">
                {s.falseBefore > 0 && ` · ${s.falseBefore} wrong`}
                {s.duplicatesBefore > 0 && ` · ${s.duplicatesBefore} repeat`}
              </span>
            )}
          </span>
        </li>
      ))}
      {(t.trailingFalse > 0 || t.trailingDuplicates > 0) && (
        <li className="timeline-step timeline-trailing">
          <span className="ts-num">after</span>
          <span className="ts-at" />
          <span className="ts-gap ts-misses">
            {t.trailingFalse > 0 && `${t.trailingFalse} wrong`}
            {t.trailingDuplicates > 0 &&
              `${t.trailingFalse > 0 ? ' · ' : ''}${t.trailingDuplicates} repeat`}
          </span>
        </li>
      )}
      {/* Last, because any attempts after the final set (the "after" row) happen
          before the winning press. */}
      {dither !== null && lastAt !== null && (
        <li className="timeline-step timeline-done">
          <span className="ts-num">Done</span>
          <span className="ts-at">{formatTime(lastAt + dither, true)}</span>
          <span className="ts-gap">+{formatTime(dither, true)} sat on it</span>
        </li>
      )}
    </ol>
  )
}
