import { useEffect, useState } from 'react'
import type { Board } from '../game/board'
import { ATTRIBUTES, type Attribute } from '../game/cards'
import { failureReport, type FailureReport, type FeatureStat } from '../game/failures'
import { getPastBoards, PAST_BOARDS_MISSING, type PlayerGame } from '../lib/leagues'

/**
 * Which kinds of set this player is slow to see, across their finished games
 * on closed days in this league. The analysis is game/failures; this fetches
 * the closed days' boards (one call) and draws the tables and the heat map.
 */
export function FailureAnalyzer({ leagueId, games }: { leagueId: string; games: readonly PlayerGame[] }) {
  const [boards, setBoards] = useState<Map<string, Board> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getPastBoards(leagueId)
      .then((b) => {
        if (active) setBoards(b)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [leagueId])

  if (error === PAST_BOARDS_MISSING) {
    return <p className="muted">Not set up yet: run supabase/add-past-puzzles-fn.sql in Supabase.</p>
  }
  if (error) return <p className="auth-error">{error}</p>
  if (!boards) return <p className="muted">Loading…</p>

  // Closed days only: `boards` never holds a day still being played.
  const analysed = games.flatMap((g) => {
    const board = boards.get(g.puzzleDate)
    return board ? [{ board, events: g.events }] : []
  })
  return <FailureAnalyzerView report={failureReport(analysed)} />
}

/** Too little behind a number to read anything into it. */
const THIN_EXPECTED = 2
const THIN_FINDS = 5

const ATTR_WORDS: Record<Attribute, { same: string; diff: string; values: [string, string, string] }> = {
  count: { same: 'Same count', diff: 'Different counts', values: ['All singles', 'All doubles', 'All triples'] },
  colour: { same: 'Same colour', diff: 'Different colours', values: ['All red', 'All green', 'All purple'] },
  shape: { same: 'Same shape', diff: 'Different shapes', values: ['All diamonds', 'All squiggles', 'All ovals'] },
  fill: { same: 'Same fill', diff: 'Different fills', values: ['All solid', 'All striped', 'All open'] },
}

const DIFFER_WORDS = ['1 differs', '2 differ', '3 differ', 'All 4 differ']

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—')
const lift = (s: FeatureStat) => (s.expected > 0 ? s.last / s.expected : null)

function Row({ label, stat, games, sub }: { label: string; stat: FeatureStat | undefined; games: number; sub?: boolean }) {
  const s = stat ?? { last: 0, expected: 0, finds: 0, slowness: null }
  const l = lift(s)
  const thinLast = s.expected < THIN_EXPECTED
  const thinSlow = s.finds < THIN_FINDS
  return (
    <tr className={sub ? 'fa-sub' : undefined}>
      <th scope="row">{label}</th>
      <td className={thinLast ? 'is-thin' : undefined}>{pct(s.last, games)}</td>
      <td className={thinLast ? 'is-thin' : undefined}>{pct(s.expected, games)}</td>
      <td className={thinLast ? 'is-thin' : l !== null && l >= 1.5 ? 'is-hot' : undefined}>
        {l === null ? '—' : `×${l.toFixed(1)}`}
      </td>
      <td className={thinSlow ? 'is-thin' : s.slowness !== null && s.slowness >= 0.65 ? 'is-hot' : undefined}>
        {s.slowness === null ? '—' : Math.round(s.slowness * 100)}
      </td>
    </tr>
  )
}

function Head() {
  return (
    <thead>
      <tr>
        <th scope="col">Kind of set</th>
        <th scope="col" title="How often your last set had it">
          Last
        </th>
        <th scope="col" title="How often the boards offered it">
          Boards
        </th>
        <th scope="col" title="Last ÷ Boards: above 1, your last set had it more often than chance">
          ×
        </th>
        <th scope="col" title="Every find, ranked within its game by time taken: 50 is ordinary, higher is slower">
          Slow
        </th>
      </tr>
    </thead>
  )
}

export function FailureAnalyzerView({ report }: { report: FailureReport }) {
  const { games, features } = report
  if (games === 0) {
    return <p className="muted">No finished games on closed days yet.</p>
  }
  const f = (k: string) => features.get(k)

  return (
    <div className="failure-analyzer">
      <p className="muted stat-note">
        From {games} finished game{games === 1 ? '' : 's'} on closed days. <b>Last</b> is how often the last
        set you found had it, <b>Boards</b> how often the boards offered it, and <b>×</b> the ratio: above 1,
        it was your last set more often than chance. <b>Slow</b> scores every find by time taken within its
        game: 50 is ordinary, higher is slower. Faded numbers rest on too few games to mean much.
      </p>

      <h3 className="fa-heading">How many attributes differ</h3>
      <div className="stat-table-scroll">
        <table className="stat-table fa-table">
          <Head />
          <tbody>
            {[1, 2, 3, 4].map((n) => (
              <Row key={n} label={DIFFER_WORDS[n - 1]!} stat={f(`differ:${n}`)} games={games} />
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="fa-heading">By attribute</h3>
      <div className="stat-table-scroll">
        <table className="stat-table fa-table">
          <Head />
          <tbody>
            {ATTRIBUTES.map((attr) => {
              const w = ATTR_WORDS[attr]
              return [
                <Row key={`${attr}d`} label={w.diff} stat={f(`${attr}:diff`)} games={games} />,
                <Row key={`${attr}s`} label={w.same} stat={f(`${attr}:same`)} games={games} />,
                ...w.values.map((v, i) => (
                  <Row key={`${attr}${i}`} label={v} stat={f(`${attr}=${i}`)} games={games} sub />
                )),
              ]
            })}
          </tbody>
        </table>
      </div>

      <h3 className="fa-heading">By card position</h3>
      <div className="fa-grid" aria-label="Card positions, laid out like the board">
        {Array.from({ length: 12 }, (_, i) => {
          const s = f(`pos:${i}`) ?? { last: 0, expected: 0, finds: 0, slowness: null }
          const l = lift(s)
          const thin = s.expected < THIN_EXPECTED
          // Warm for "more often than chance", cool for less, faint when thin.
          const strength = l === null || thin ? 0 : Math.min(Math.abs(Math.log2(Math.max(l, 0.01))), 1)
          const tone = l !== null && l >= 1 ? 'var(--bad)' : 'var(--ok)'
          return (
            <div
              key={i}
              className={`fa-cell${thin ? ' is-thin' : ''}`}
              style={{ background: `color-mix(in srgb, ${tone} ${Math.round(strength * 45)}%, var(--surface))` }}
              title={`Card ${i + 1}: in your last set ${s.last} time${s.last === 1 ? '' : 's'}, ${s.expected.toFixed(1)} expected`}
            >
              <span className="fa-cell-num">{i + 1}</span>
              <span className="fa-cell-lift">{l === null ? '—' : `×${l.toFixed(1)}`}</span>
              <span className="fa-cell-slow">slow {s.slowness === null ? '—' : Math.round(s.slowness * 100)}</span>
            </div>
          )
        })}
      </div>
      <p className="muted timeline-hint">
        Card 1 is top-left, left to right then down, as on the board. × compares how often each card was in
        your last set with how often it was in the boards’ sets; red is more often than chance, green less.
      </p>
    </div>
  )
}
