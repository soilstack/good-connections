/**
 * The failure analyzer: which kinds of set a player is slow to see.
 *
 * Two views, both per player, over their FINISHED games only (in a game given
 * up, the hardest set is the one never found, so the last one found is not it):
 *
 * - **Last set.** The last set found in each game — the 6th in Mode A, the
 *   last before Done in C. Counted against what the boards actually offered:
 *   for each feature, `expected` is the sum over games of the share of that
 *   board's sets with the feature. So `last / expected` is a lift — 1 is "no
 *   more often than chance", 2 is "twice as often as the boards would explain".
 *   Without that baseline, a feature that is simply common looks like a
 *   weakness.
 *
 * - **Slowness.** Every set found, scored by how long it took since the
 *   previous find, ranked within its own game: 1 the slowest find of that game,
 *   0 the quickest. Averaged per feature, 0.5 is ordinary. Ranking within the
 *   game makes a slow day and a fast day comparable, and using every set gives
 *   about six times the data of the last-set view.
 *
 * Features of a set: how many of the four attributes differ (1–4); per
 * attribute, same or different and, when same, the shared value; and the three
 * card positions (0–11, top-left first, left to right then down).
 *
 * Pure. The caller supplies boards for CLOSED days only — analysing a day
 * still being played would hand out part of its solution.
 */

import { ATTRIBUTES } from './cards'
import type { Board } from './board'
import type { Card } from './cards'
import type { Triple } from './set'
import type { TelemetryEvent } from './telemetry'

/** Feature keys for one set: 'differ:N', 'colour:same', 'colour=0', 'pos:3', ... */
export function setFeatures(cards: readonly Card[], triple: Triple): string[] {
  const [a, b] = [cards[triple[0]]!, cards[triple[1]]!]
  const out: string[] = []
  let differ = 0
  for (const attr of ATTRIBUTES) {
    if (a[attr] === b[attr]) {
      // In a set an attribute is all-same or all-different; two equal means three.
      out.push(`${attr}:same`, `${attr}=${a[attr]}`)
    } else {
      out.push(`${attr}:diff`)
      differ++
    }
  }
  out.push(`differ:${differ}`)
  for (const p of triple) out.push(`pos:${p}`)
  return out
}

export interface FeatureStat {
  /** Games whose last set had this feature. */
  last: number
  /** What chance would give: the sum over games of the share of that board's sets with it. */
  expected: number
  /** Found sets with this feature that fed the slowness score. */
  finds: number
  /** Mean within-game slowness rank of those finds, 0 quickest – 1 slowest; null with none. */
  slowness: number | null
}

export interface FailureReport {
  /** Finished games analysed. */
  games: number
  features: Map<string, FeatureStat>
}

export function failureReport(games: readonly { board: Board; events: readonly TelemetryEvent[] }[]): FailureReport {
  const acc = new Map<string, { last: number; expected: number; finds: number; slowSum: number }>()
  const get = (k: string) => {
    let s = acc.get(k)
    if (!s) acc.set(k, (s = { last: 0, expected: 0, finds: 0, slowSum: 0 }))
    return s
  }

  let analysed = 0
  for (const { board, events } of games) {
    const completed = events.some((e) => e.type === 'game_end' && e.payload.reason === 'completed')
    const finds = events.flatMap((e) => (e.type === 'set_valid' ? [{ t: e.t_ms, triple: e.payload.cards as Triple }] : []))
    if (!completed || finds.length === 0 || board.sets.length === 0) continue
    analysed++

    // Baseline: the share of this board's sets with each feature.
    for (const set of board.sets) {
      for (const k of setFeatures(board.cards, set)) get(k).expected += 1 / board.sets.length
    }

    // The last set found.
    for (const k of setFeatures(board.cards, finds[finds.length - 1]!.triple)) get(k).last++

    // Slowness: rank each find's gap within the game (ties share the mean rank).
    if (finds.length < 2) continue
    const gaps = finds.map((f, i) => f.t - (i === 0 ? 0 : finds[i - 1]!.t))
    const order = gaps.map((g, i) => ({ g, i })).sort((x, y) => x.g - y.g)
    const rank = new Array<number>(gaps.length)
    for (let i = 0; i < order.length; ) {
      let j = i
      while (j + 1 < order.length && order[j + 1]!.g === order[i]!.g) j++
      for (let k = i; k <= j; k++) rank[order[k]!.i] = (i + j) / 2
      i = j + 1
    }
    finds.forEach((f, i) => {
      const score = rank[i]! / (finds.length - 1)
      for (const k of setFeatures(board.cards, f.triple)) {
        const s = get(k)
        s.finds++
        s.slowSum += score
      }
    })
  }

  const features = new Map<string, FeatureStat>()
  for (const [k, s] of acc) {
    features.set(k, {
      last: s.last,
      expected: s.expected,
      finds: s.finds,
      slowness: s.finds > 0 ? s.slowSum / s.finds : null,
    })
  }
  return { games: analysed, features }
}
