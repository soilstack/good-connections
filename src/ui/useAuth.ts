import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Sign-in state, driven by Supabase magic-link auth. A signed-in user without a
 * display name is in `needsProfile` until they pick one — leaderboards need a
 * name to show.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsProfile'; userId: string; email: string }
  | { status: 'signedIn'; userId: string; email: string; displayName: string }

export interface Auth {
  state: AuthState
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  saveDisplayName: (name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): Auth {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const resolveSession = useCallback(async (session: Session | null) => {
    const user = session?.user
    if (!user) {
      setState({ status: 'signedOut' })
      return
    }
    const email = user.email ?? ''
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (!error && data?.display_name) {
      setState({ status: 'signedIn', userId: user.id, email, displayName: data.display_name })
    } else {
      setState({ status: 'needsProfile', userId: user.id, email })
    }
  }, [])

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void resolveSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveSession(session)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [resolveSession])

  const sendMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error ? error.message : null }
  }, [])

  const saveDisplayName = useCallback(async (name: string) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return { error: 'You are not signed in.' }
    const trimmed = name.trim()
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: trimmed })
    if (error) return { error: error.message }
    setState({ status: 'signedIn', userId: user.id, email: user.email ?? '', displayName: trimmed })
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ status: 'signedOut' })
  }, [])

  return { state, sendMagicLink, saveDisplayName, signOut }
}
