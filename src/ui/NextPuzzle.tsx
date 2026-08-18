import { useEffect, useState } from 'react'
import { formatClock, formatCountdown, nextMidnightMs } from '../lib/time'

/**
 * "Next puzzle in 7h 12m" — counts down to the next midnight in the league's
 * own timezone, which is when today_puzzle() starts handing out a new seed.
 * Renders nothing if the league's timezone is unusable.
 */
export function NextPuzzle({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const next = nextMidnightMs(timezone, now)
  if (next === null) return null
  const remaining = next - now

  return (
    <p className="next-puzzle">
      <span className="next-puzzle-label">Next puzzle in</span>{' '}
      <strong className="next-puzzle-time">{formatCountdown(remaining)}</strong>{' '}
      <span className="muted">— at {formatClock(next)}</span>
    </p>
  )
}
