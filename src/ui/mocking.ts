import { mulberry32 } from '../game/board'

/**
 * What a "mocked" game (see OrderRating in game/telemetry) actually gets:
 * 30% the SpongeBob "pErFeCt PlAy?", 20% a bold "Ha HAW!", 50% nothing at all.
 *
 * Rolled once per player per day, from a seed made of the two, so the verdict
 * is the same on every refresh and for everyone who looks at that game — and
 * each player's botched game gets its own roll. The SpongeBob letters and
 * colours come from the same stream, so they hold still too.
 *
 * Uses mulberry32 as it is; nothing here may change it (CLAUDE.md).
 */

export type MockingVerdict = 'spongebob' | 'haw' | 'silent'

export interface MockingRoll {
  verdict: MockingVerdict
  /** The SpongeBob letters, whether or not the verdict uses them. */
  letters: { ch: string; colour: string }[]
}

/** FNV-1a: a stable 32-bit number from a string. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mockingRoll(userId: string, puzzleDate: string): MockingRoll {
  const rng = mulberry32(hash(`mocking|${userId}|${puzzleDate}`))
  const r = rng()
  const verdict: MockingVerdict = r < 0.3 ? 'spongebob' : r < 0.5 ? 'haw' : 'silent'

  const chars = [...'perfect play?']
  // Evenly spaced hues from a random start, shuffled, so no two match.
  const start = rng() * 360
  const hues = chars.map((_, i) => (start + (i * 360) / chars.length) % 360)
  for (let i = hues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[hues[i], hues[j]] = [hues[j]!, hues[i]!]
  }
  const letters = chars.map((ch, i) => ({
    ch: rng() < 0.5 ? ch.toUpperCase() : ch,
    colour: `hsl(${Math.round(hues[i]!)} 80% 50%)`,
  }))
  return { verdict, letters }
}
