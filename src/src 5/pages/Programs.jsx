import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'

export default function Programs() {
  const { admin } = useAuth()
  const { showToast } = useToast()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '', location: '', date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  async function loadPrograms() {
    setLoading(true)
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setPrograms(data)
    setLoading(false)
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.from('programs').insert({
      name: form.name,
      description: form.description || null,
      price: Number(form.price) || 0,
      duration: form.duration || null,
      location: form.location || null,
      date: form.date || null,
      created_by: admin?.id,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', description: '', price: '', duration: '', location: '', date: '' })
    setShowForm(false)
    showToast('Program added.')
    loadPrograms()
  }

  async function toggleActive(program) {
    setPrograms((prev) =>
      prev.map((p) => (p.id === program.id ? { ...p, is_active: !program.is_active } : p))
    )
    const { error } = await supabase
      .from('programs')
      .update({ is_active: !program.is_active })
      .eq('id', program.id)
    if (error) {
      showToast(error.message, 'error')
      loadPrograms()
    }
  }

  async function confirmDelete() {
    const program = pendingDelete
    setPendingDelete(null)
    setPrograms((prev) => prev.filter((p) => p.id !== program.id))

    // Uses the same RPC as the Reports page: it removes the program record
    // AND its payment history together, and runs as SECURITY DEFINER so it
    // isn't silently blocked by RLS the way a plain delete could be.
    const { error } = await supabase.rpc('admin_delete_program_and_payments', {
      p_program_id: program.id,
    })
    if (error) {
      showToast(error.message, 'error')
      loadPrograms()
      return
    }
    showToast(`"${program.name}", its payments, and any now-empty clients were deleted.`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Programs"
        subtitle="Courses and programs EdenPlus offers"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Add a program
          </button>
        }
      />

      <div className="p-4 sm:p-8">
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Program name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cambridge IGCSE prep"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Price (GHS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1500"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Duration</label>
              <input
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="6 weeks"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. EdenPlus Accra campus"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {error && <p className="col-span-full text-sm text-danger-600">{error}</p>}

            <div className="col-span-full flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save program'}
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

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : programs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No programs yet. Add your first one above.</p>
          ) : (
            <>
              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="divide-y divide-slate-50 sm:hidden">
                {programs.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={!p.is_active}
                      onChange={() => toggleActive(p)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      aria-label={`Mark ${p.name} as done`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-medium ${p.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}
                      >
                        {p.name}
                      </p>
                      <p className={`text-sm ${p.is_active ? 'text-slate-600' : 'text-slate-400'}`}>
                        GHS {Number(p.price).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[p.duration, p.location].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingDelete(p)}
                      aria-label={`Delete ${p.name}`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table, horizontal scroll scoped to just the table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-6 py-3 font-medium">Done</th>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                      <th className="px-6 py-3 font-medium">Duration</th>
                      <th className="px-6 py-3 font-medium">Location</th>
                      <th className="px-6 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {programs.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-6 py-3">
                          <input
                            type="checkbox"
                            checked={!p.is_active}
                            onChange={() => toggleActive(p)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            aria-label={`Mark ${p.name} as done`}
                          />
                        </td>
                        <td className={`px-6 py-3 ${p.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {p.name}
                        </td>
                        <td className={`px-6 py-3 ${p.is_active ? 'text-slate-800' : 'text-slate-400'}`}>
                          GHS {Number(p.price).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{p.duration || '—'}</td>
                        <td className="px-6 py-3 text-slate-500">{p.location || '—'}</td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => setPendingDelete(p)}
                            aria-label={`Delete ${p.name}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this program?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}", every payment tied to it, and any client left with no payments at all as a result will be permanently removed. This can't be undone.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}