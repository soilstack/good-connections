import { useState, type FormEvent } from 'react'

interface DisplayNamePromptProps {
  email: string
  onSave: (name: string) => Promise<{ error: string | null }>
  onSignOut: () => void
}

export function DisplayNamePrompt({ email, onSave, onSignOut }: DisplayNamePromptProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    setSaving(true)
    setError(null)
    const result = await onSave(value)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Choose a display name</h1>
        <p className="muted">
          Signed in as {email}. This is how you’ll appear on league leaderboards.
        </p>
        <input
          className="auth-input"
          maxLength={40}
          placeholder="e.g. Michael"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-actions">
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Sign out
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}
