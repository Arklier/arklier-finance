"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('🔍 Getting initial session...')
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('📋 Initial session result:', { session: !!session, error: error?.message })
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, { user: session?.user?.email, session: !!session })
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    console.log('🔑 Sign in result:', { 
      success: !error, 
      error: error?.message, 
      user: data.user?.email,
      session: !!data.session 
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    console.log('📝 Attempting sign up for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    console.log('📋 Sign up result:', { 
      success: !error, 
      error: error?.message, 
      user: data.user?.email,
      session: !!data.session 
    })
    return { error }
  }

  const signOut = async () => {
    console.log('🚪 Signing out...')
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
