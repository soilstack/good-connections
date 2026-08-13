import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getMyLeagues, joinLeague, type League } from '../lib/leagues'

interface LeaguesPanelProps {
  onSelectLeague: (league: League) => void
}

export function LeaguesPanel({ onSelectLeague }: LeaguesPanelProps) {
  const [leagues, setLeagues] = useState<League[] | null>(null)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getMyLeagues()
      .then(setLeagues)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const join = async (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    setJoining(true)
    setError(null)
    try {
      await joinLeague(value)
      setCode('')
      load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        /no league with that code/i.test(msg)
          ? 'No league found for that code. Check it and try again.'
          : msg,
      )
    } finally {
      setJoining(false)
    }
  }

  return (
    <section className="leagues-section">
      <h2 className="section-label">Leagues</h2>

      {leagues && leagues.length > 0 && (
        <div className="league-list">
          {leagues.map((l) => (
            <button
              type="button"
              key={l.id}
              className="league-card"
              onClick={() => onSelectLeague(l)}
            >
              <span className="league-name">{l.name}</span>
              <span className="league-meta">Mode {l.mode} · play today’s puzzle →</span>
            </button>
          ))}
        </div>
      )}
      {leagues && leagues.length === 0 && (
        <p className="muted">You haven’t joined a league yet. Enter a code below.</p>
      )}

      <form className="join-form" onSubmit={join}>
        <input
          className="auth-input"
          placeholder="League code (e.g. SG-TEST)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={joining || !code.trim()}>
          {joining ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}
    </section>
  )
}
