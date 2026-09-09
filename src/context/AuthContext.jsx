import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  // Starts true so guarded routes wait for the stored session to be read back
  // instead of flashing the login page on every refresh.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,

      signUp: async ({ email, password, fullName }) => {
        if (!isSupabaseConfigured) return { error: notConfigured }
        return supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName ?? '' },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        })
      },

      signIn: async ({ email, password }) => {
        if (!isSupabaseConfigured) return { error: notConfigured }
        return supabase.auth.signInWithPassword({ email, password })
      },

      signOut: async () => {
        if (!isSupabaseConfigured) return { error: notConfigured }
        return supabase.auth.signOut()
      },

      resetPassword: async (email) => {
        if (!isSupabaseConfigured) return { error: notConfigured }
        return supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })
      },
    }),
    [session, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const notConfigured = {
  message:
    'Authentication is not configured yet. Add your Supabase keys to .env.local and restart the dev server.',
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
