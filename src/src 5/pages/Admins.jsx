import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'

export default function Admins() {
  const { isSuperAdmin, admin: currentAdmin } = useAuth()
  const { showToast } = useToast()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'admin' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  async function loadAdmins() {
    setLoading(true)
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setAdmins(data)
    setLoading(false)
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.functions.invoke('create-admin', { body: form })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', username: '', password: '', role: 'admin' })
    setShowForm(false)
    showToast('Admin created.')
    loadAdmins()
  }

  async function confirmDelete() {
    const target = pendingDelete
    setPendingDelete(null)
    setAdmins((prev) => prev.filter((row) => row.id !== target.id))

    const { data, error } = await supabase.functions.invoke('delete-admin', {
      body: { id: target.id },
    })

    if (error) {
      showToast(error.message, 'error')
      loadAdmins()
      return
    }
    if (data?.error) {
      showToast(data.error, 'error')
      return
    }
    showToast(`${target.name}'s access removed.`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Admins"
        subtitle="Everyone with access to this dashboard"
        action={
          isSuperAdmin && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} /> Add admin
            </button>
          )
        }
      />

      <div className="p-4 sm:p-8">
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="sena"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Temporary password</label>
              <input
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>

            {error && <p className="col-span-full text-sm text-danger-600">{error}</p>}

            <div className="col-span-full flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create admin'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Username</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  {isSuperAdmin && <th className="px-6 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3 text-slate-800">{a.name}</td>
                    <td className="px-6 py-3 text-slate-500">{a.username}</td>
                    <td className="px-6 py-3 capitalize text-slate-800">{a.role.replace('_', ' ')}</td>
                    {isSuperAdmin && (
                      <td className="px-6 py-3 text-right">
                        {a.id !== currentAdmin?.id && (
                          <button
                            onClick={() => setPendingDelete(a)}
                            aria-label={`Remove ${a.name}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this admin?"
        message={pendingDelete ? `${pendingDelete.name} will lose access to this dashboard immediately.` : ''}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
