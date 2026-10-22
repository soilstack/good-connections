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
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const base = `${m}:${s.toString().padStart(2, '0')}`
  if (!tenths) return base
  const t = Math.floor((ms % 1000) / 100)
  return `${base}.${t}`
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
