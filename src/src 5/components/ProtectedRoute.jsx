import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, admin, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Session exists but there's no matching admins row — access was revoked.
  if (!admin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <p className="text-sm text-slate-600">Your access to this dashboard has been removed.</p>
        <button
          onClick={signOut}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign out
        </button>
      </div>
    )
  }

  return children
}
