import { useState, type FormEvent } from 'react'

interface SignInProps {
  onSend: (email: string) => Promise<{ error: string | null }>
  onCancel: () => void
}

export function SignIn({ onSend, onCancel }: SignInProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setStatus('sending')
    setError(null)
    const result = await onSend(value)
    if (result.error) {
      setError(result.error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="muted">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish
            signing in.
          </p>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Sign in</h1>
        <p className="muted">
          For league play. We’ll email you a one-tap sign-in link — no password to remember.
        </p>
        <input
          className="auth-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        {status === 'error' && error && <p className="auth-error">{error}</p>}
        <div className="auth-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={status === 'sending' || !email.trim()}>
            {status === 'sending' ? 'Sending…' : 'Send link'}
          </button>
        </div>
      </form>
    </div>
  )
}
