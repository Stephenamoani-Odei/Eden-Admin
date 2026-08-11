import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, usernameToEmail } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadAdminProfile(userId) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to load admin profile:', error.message)
      setAdmin(null)
      return
    }
    setAdmin(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await loadAdminProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await loadAdminProfile(session.user.id)
      } else {
        setAdmin(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(username, password) {
    const email = usernameToEmail(username)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    admin, // row from public.admins — has role, name, email
    loading,
    signIn,
    signOut,
    isSuperAdmin: admin?.role === 'super_admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
