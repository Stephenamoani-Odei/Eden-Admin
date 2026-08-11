import { useEffect, useState } from 'react'
import { Check, X as XIcon } from 'lucide-react'
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

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, transaction_id, created_at, clients(name, phone), programs(name)')
      .eq('status', 'awaiting_approval')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Approvals load error:', error)
      showToast(`Couldn't load approvals: ${error.message}`, 'error')
    } else {
      setRows(data)
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Approvals"
        subtitle="Transactions clients say they've made, waiting on your confirmation"
        action={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Nothing waiting right now — new client submissions will show up here.
            </p>
          ) : (
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
                    <td className="px-6 py-3 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
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
    </div>
  )
}