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
