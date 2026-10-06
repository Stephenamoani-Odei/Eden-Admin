import { useEffect, useState } from 'react'
import { Check, X as XIcon, Pencil } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/ToastContext'

export default function Approvals() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingReject, setPendingReject] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ amount: '', transaction_id: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, transaction_id, created_at, edited_by_name, edited_at, clients(name, phone), programs(name)')
      .eq('status', 'awaiting_approval')
      .order('created_at', { ascending: true })
    if (!error) {
      setRows(data)
    } else {
      showToast(`Couldn't load approvals: ${error.message}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleApprove(row) {
    setBusyId(row.id)
    const { error } = await supabase.rpc('admin_approve_payment', { p_payment_id: row.id })
    setBusyId(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    showToast(`Approved ${row.clients?.name}'s payment — ticket + SMS sent automatically.`)
  }

  async function confirmReject() {
    const row = pendingReject
    setPendingReject(null)
    setBusyId(row.id)
    const { error } = await supabase.rpc('admin_reject_payment', {
      p_payment_id: row.id,
      p_reason: 'Transaction ID could not be verified',
    })
    setBusyId(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    showToast(`Rejected ${row.clients?.name}'s claim.`)
  }

  function openEdit(row) {
    setEditError('')
    setEditForm({ amount: String(row.amount), transaction_id: row.transaction_id || '' })
    setEditing(row)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editing) return
    setSavingEdit(true)
    setEditError('')

    const { data, error } = await supabase.rpc('admin_update_awaiting_payment', {
      p_payment_id: editing.id,
      p_amount: Number(editForm.amount),
      p_transaction_id: editForm.transaction_id,
    })

    setSavingEdit(false)

    if (error) {
      setEditError(error.message)
      return
    }

    const out = data?.[0]
    setRows((prev) =>
      prev.map((r) =>
        r.id === editing.id
          ? {
              ...r,
              amount: out?.out_amount ?? Number(editForm.amount),
              transaction_id: out?.out_transaction_id ?? editForm.transaction_id,
              edited_by_name: out?.out_edited_by_name,
              edited_at: out?.out_edited_at,
            }
          : r
      )
    )
    setEditing(null)
    showToast(`Updated ${editing.clients?.name}'s claim.`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Approvals"
        subtitle="Transactions clients say they've made, waiting on your confirmation"
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Nothing waiting right now — new client submissions will show up here.
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="divide-y divide-slate-50 sm:hidden">
                {rows.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{r.clients?.name}</p>
                        <p className="truncate text-xs text-slate-500">{r.clients?.phone}</p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                      <dt className="text-slate-500">Program</dt>
                      <dd className="text-right text-slate-700">{r.programs?.name ?? '—'}</dd>
                      <dt className="text-slate-500">Amount claimed</dt>
                      <dd className="text-right font-medium text-slate-800">
                        GHS {Number(r.amount).toLocaleString()}
                      </dd>
                      <dt className="text-slate-500">Transaction ID</dt>
                      <dd className="text-right font-mono text-slate-700">{r.transaction_id}</dd>
                    </dl>
                    {r.edited_at && (
                      <p className="mt-2 text-[11px] italic text-slate-400">
                        Edited by {r.edited_by_name} · {new Date(r.edited_at).toLocaleString()}
                      </p>
                    )}
                    <div className="mt-3 flex gap-1.5">
                      <button
                        onClick={() => handleApprove(r)}
                        disabled={busyId === r.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-success-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-60"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        disabled={busyId === r.id}
                        className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => setPendingReject(r)}
                        disabled={busyId === r.id}
                        className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-60"
                      >
                        <XIcon size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table, horizontal scroll scoped to just the table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-6 py-3 font-medium">Client</th>
                      <th className="px-6 py-3 font-medium">Program</th>
                      <th className="px-6 py-3 font-medium">Amount claimed</th>
                      <th className="px-6 py-3 font-medium">Transaction ID</th>
                      <th className="px-6 py-3 font-medium">Submitted</th>
                      <th className="px-6 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-6 py-3 text-slate-800">
                          {r.clients?.name}
                          <div className="text-xs text-slate-500">{r.clients?.phone}</div>
                        </td>
                        <td className="px-6 py-3 text-slate-500">{r.programs?.name ?? '—'}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">
                          GHS {Number(r.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-700">{r.transaction_id}</td>
                        <td className="px-6 py-3 text-slate-500">
                          {new Date(r.created_at).toLocaleString()}
                          {r.edited_at && (
                            <p className="mt-1 text-[11px] italic text-slate-400">
                              Edited by {r.edited_by_name} · {new Date(r.edited_at).toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(r)}
                              disabled={busyId === r.id}
                              className="flex items-center gap-1 rounded-lg bg-success-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-60"
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              onClick={() => openEdit(r)}
                              disabled={busyId === r.id}
                              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => setPendingReject(r)}
                              disabled={busyId === r.id}
                              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-60"
                            >
                              <XIcon size={14} /> Reject
                            </button>
                          </div>
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
        open={!!pendingReject}
        title="Reject this claim?"
        message={
          pendingReject
            ? `${pendingReject.clients?.name}'s claim of GHS ${Number(pendingReject.amount).toLocaleString()} with transaction ID "${pendingReject.transaction_id}" will be marked rejected. They can submit again if it was a mistake.`
            : ''
        }
        confirmLabel="Reject"
        onConfirm={confirmReject}
        onCancel={() => setPendingReject(null)}
      />

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !savingEdit && setEditing(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Edit pending claim</h2>
            <p className="mb-5 text-sm text-slate-500">
              {editing.clients?.name} — only the amount and transaction ID can be corrected here.
            </p>

            <form onSubmit={handleSaveEdit}>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount (GHS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />

              <label className="mb-1 block text-sm font-medium text-slate-700">Transaction ID</label>
              <input
                value={editForm.transaction_id}
                onChange={(e) => setEditForm({ ...editForm, transaction_id: e.target.value })}
                className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />

              {editError && <p className="mb-4 text-sm text-danger-600">{editError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={savingEdit}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
