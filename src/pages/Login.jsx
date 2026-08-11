import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { session, signIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)


  useEffect(() => {
    if (!submitting) return
    setProgress(8)
    const interval = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.15))
    }, 150)
    return () => clearInterval(interval)
  }, [submitting])

  if (!loading && session) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await signIn(username, password)

    if (error) {
      console.error('Login error:', error)
      setSubmitting(false)
      setProgress(0)
      setError(error.message || 'Incorrect username or password. Try again.')
      return
    }

    setProgress(100)
    // Brief pause so the bar visibly reaches full before navigating away.
    setTimeout(() => navigate('/'), 250)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-sm font-semibold text-white">
            EP
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">EdenPlus</p>
            <p className="text-[11px] text-slate-500">Education consult</p>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">Use the admin account you were given.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}

          {submitting && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-150 ease-out"
                  style={{ width: `${Math.round(progress)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-slate-400">{Math.round(progress)}%</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}