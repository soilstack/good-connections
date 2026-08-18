/**
 * Name a set by its position in the board's solution: A, B, C…
 *
 * The letter is a label, not a hint — it says nothing about which cards the set
 * is made of. It is worth having because every player in a league slot gets the
 * identical board, so the same letter means the same set for everyone.
 */
export function setLabel(setIndex: number): string {
  return String.fromCharCode(65 + (setIndex % 26))
}

/** Format a duration in ms as m:ss (or m:ss.t with tenths). */
export function formatTime(ms: number, tenths = false): string {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const base = `${m}:${s.toString().padStart(2, '0')}`
  if (!tenths) return base
  const t = Math.floor((ms % 1000) / 100)
  return `${base}.${t}`
}
