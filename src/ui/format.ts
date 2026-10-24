/**
 * Set naming lives in game/telemetry, because the find-order string is built
 * from it and `game/` must not import from `ui/`. Re-exported here so the UI
 * keeps its single import point for formatting helpers.
 */
export { setLabel } from '../game/telemetry'
import { COLOURS, FILLS, SHAPES, type Attribute } from '../game/cards'
import type { BrokenAttribute } from '../game/set'

/** Format a duration in ms as m:ss (or m:ss.t with tenths). */
export function formatTime(ms: number, tenths = false): string {
  return formatClock(ms, tenths ? 1 : 0)
}

/**
 * m:ss with 0–3 decimal places. Truncates, like a stopwatch, so a time never
 * displays as later than it was — and so two times in order stay in order.
 */
export function formatClock(ms: number, digits: 0 | 1 | 2 | 3): string {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const base = `${m}:${s.toString().padStart(2, '0')}`
  if (digits === 0) return base
  const frac = Math.floor((ms % 1000) / 10 ** (3 - digits))
  return `${base}.${frac.toString().padStart(digits, '0')}`
}

/**
 * For a list of times sorted fastest first: how many decimal places each needs
 * so it reads differently from the times either side of it. Usually 0 — only
 * a near-tie, like two solves both shown as 1:03, gets tenths, and only as far
 * as hundredths or milliseconds if tenths still match. Times are recorded to
 * the millisecond, so an exact tie is the only thing left showing equal.
 */
export function tieBreakDigits(sortedMs: readonly number[]): (0 | 1 | 2 | 3)[] {
  const at = (ms: number, d: number) => Math.floor(ms / 10 ** (3 - d))
  return sortedMs.map((ms, i) => {
    const neighbours = [sortedMs[i - 1], sortedMs[i + 1]].filter((n): n is number => n !== undefined)
    for (const d of [0, 1, 2] as const) {
      if (neighbours.every((n) => at(n, d) !== at(ms, d))) return d
    }
    return 3
  })
}

/** How one value of each attribute reads in a sentence, as [singular, plural]. */
const VALUE_WORDS: Record<Attribute, readonly (readonly [string, string])[]> = {
  count: [
    ['single', 'singles'],
    ['double', 'doubles'],
    ['triple', 'triples'],
  ],
  colour: COLOURS.map((c) => [c, c] as const),
  shape: SHAPES.map((s) => [s, `${s}s`] as const),
  fill: FILLS.map((f) => [f, f] as const),
}

/** "two red, one green" — why one attribute breaks a would-be set. */
export function describeBroken(b: BrokenAttribute): string {
  const words = VALUE_WORDS[b.attribute]
  return `two ${words[b.pair]![1]}, one ${words[b.odd]![0]}`
}
