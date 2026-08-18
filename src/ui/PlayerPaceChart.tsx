import type { PlayerGame } from '../lib/leagues'
import { formatTime } from './format'
import { H, M, OffScaleMark, PLOT_W, W, YAxis, Y_CAP_MS, yScale } from './paceChart'

/**
 * One player's whole league history on a single pace chart: X = sets found,
 * Y = elapsed time, one line per game. The most recent game is drawn last, in
 * red, over progressively fainter older games — so "am I getting faster" is a
 * question you answer by looking, not by reading a table.
 *
 * Only the recent game gets point markers. With thirty games on the chart,
 * markers on all of them would be a cloud rather than a trend.
 *
 * Same box, Y scale and 6:00 cap as the same-board chart (./paceChart).
 */

/** Points for one game, in order found. */
function points(game: PlayerGame): { n: number; atMs: number }[] {
  const out: { n: number; atMs: number }[] = []
  let n = 0
  for (const ev of game.events) {
    if (ev.type === 'set_valid') out.push({ n: ++n, atMs: ev.t_ms })
  }
  return out
}

export function PlayerPaceChart({ games }: { games: PlayerGame[] }) {
  // Newest first in, oldest first out: the newest must paint last, on top.
  const series = games.map((g) => ({ game: g, pts: points(g) })).filter((s) => s.pts.length > 0)
  if (series.length === 0) return null
  const oldestFirst = [...series].reverse()
  const recent = series[0]!

  const maxN = Math.max(...series.map((s) => s.pts.length), 1)
  const scale = yScale(Math.max(...series.flatMap((s) => s.pts.map((p) => p.atMs)), 1))
  const { y } = scale
  const x = (v: number) => (maxN > 1 ? M.l + ((v - 1) / (maxN - 1)) * PLOT_W : M.l + PLOT_W / 2)
  const line = (pts: { n: number; atMs: number }[]) =>
    pts.map((p) => `${x(p.n)},${y(p.atMs)}`).join(' ')

  return (
    <>
      <svg
        className="pace-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Solve pace across every game"
      >
        <YAxis scale={scale} />
        {Array.from({ length: maxN }, (_, i) => i + 1).map((n) => (
          <text key={n} x={x(n)} y={H - 8} className="pc-xlabel">
            {n}
          </text>
        ))}

        {oldestFirst.map(({ game, pts }, i) =>
          game.id === recent.game.id ? null : (
            <polyline
              key={game.id}
              points={line(pts)}
              className={`ppc-line${game.stats.abandoned ? ' is-abandoned' : ''}`}
              // Oldest faintest: the most recent five or so stay legible behind
              // the red line, the long tail recedes into background texture.
              opacity={0.15 + 0.4 * (i / Math.max(oldestFirst.length - 1, 1))}
            >
              <title>{`${game.puzzleDate} — ${
                game.stats.completed ? formatTime(game.stats.totalTimeMs ?? 0) : 'gave up'
              }`}</title>
            </polyline>
          ),
        )}

        <polyline
          points={line(recent.pts)}
          className={`ppc-line is-recent${recent.game.stats.abandoned ? ' is-abandoned' : ''}`}
        />
        {recent.pts.map((p) => {
          const title = (
            <title>{`${recent.game.puzzleDate} — set ${p.n} at ${formatTime(p.atMs, true)}`}</title>
          )
          return scale.isOffScale(p.atMs) ? (
            <OffScaleMark key={p.n} cx={x(p.n)} cy={y(p.atMs)} className="ppc-dot is-recent">
              {title}
            </OffScaleMark>
          ) : (
            <circle key={p.n} cx={x(p.n)} cy={y(p.atMs)} r={3.5} className="ppc-dot is-recent">
              {title}
            </circle>
          )
        })}
      </svg>
      <p className="muted pace-caption">
        X = sets found, Y = elapsed time. One line per game, most recent in red, older games
        fainter. Dashed = gave up.
        {scale.anyOffScale && ` Axis caps at ${formatTime(Y_CAP_MS)}.`}
        {/* The ▲ only ever appears on the recent line, so only mention it then. */}
        {recent.pts.some((p) => scale.isOffScale(p.atMs)) && ' ▲ is past the cap.'}
      </p>
    </>
  )
}
