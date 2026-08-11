import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Settings() {
  const { admin } = useAuth()
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setMessage('Password updated.')
    setPassword('')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader title="Settings" subtitle="Your account" />

      <div className="p-4 sm:p-8">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-medium text-slate-700">Signed in as</p>
          <p className="mb-6 text-sm text-slate-500">
            {admin?.name} · {admin?.username} · {admin?.role.replace('_', ' ')}
          </p>

          <form onSubmit={handleSubmit}>
            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />

            {message && <p className="mb-4 text-sm text-success-600">{message}</p>}
            {error && <p className="mb-4 text-sm text-danger-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
