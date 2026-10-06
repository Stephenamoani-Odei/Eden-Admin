import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Check, X, Pencil } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/ToastContext'

const STATUS_STYLES = {
  paid: 'bg-success-500/10 text-success-600',
  pending: 'bg-slate-100 text-slate-600',
  overdue: 'bg-danger-50 text-danger-600',
  awaiting_approval: 'bg-amber-50 text-amber-600',
  rejected: 'bg-danger-50 text-danger-600',
}

export default function Payments() {
  const { showToast } = useToast()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [actingOn, setActingOn] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ amount: '', transaction_id: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select(
        'id, amount, status, due_date, paid_at, transaction_id, client_id, program_id, edited_by_name, edited_at, clients(name, phone), programs(name)'
      )
      .order('created_at', { ascending: false })

    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (!error) {
      setPayments(data)
    } else {
      showToast(`Couldn't load payments: ${error.message}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

  async function handleApprove(payment) {
    setActingOn(payment.id)

    const { data, error } = await supabase.rpc('admin_approve_payment', {
      p_payment_id: payment.id,
    })

    console.log('admin_approve_payment result:', { data, error })

    if (error) {
      setActingOn(null)
      showToast(`Approve RPC failed: ${error.message}`, 'error')
      return
    }

    if (!data || data.length === 0) {
      setActingOn(null)
      showToast('Payment approved, but the RPC returned no client data — SMS cannot be sent. Check the RPC.', 'error')
      load()
      return
    }

    const result = data[0]
    showToast(`Approved — GHS ${Number(payment.amount).toLocaleString()} for ${payment.clients?.name}.`)

    const clientPhone = result.out_client_phone ?? result.client_phone
    const clientId = result.out_client_id ?? result.client_id
    const clientName = result.out_client_name ?? result.client_name
    const ticketNumber = result.out_ticket_number ?? result.ticket_number
    const programName = result.out_program_name ?? result.program_name
    const amountPaid = result.out_amount_paid ?? result.amount_paid
    const remainingBalance = result.out_remaining_balance ?? result.remaining_balance
    const isFull = result.out_is_full ?? result.is_full

    console.log('Resolved SMS fields:', { clientPhone, clientId, clientName, ticketNumber, programName, amountPaid, remainingBalance, isFull })

    if (!clientPhone) {
      showToast(`No phone number found for ${clientName ?? 'this client'} — SMS not sent. Check the clients table.`, 'error')
      setActingOn(null)
      load()
      return
    }

    showToast(`Calling send-approval-sms for ${clientPhone}…`)

    const { data: smsData, error: smsError } = await supabase.functions.invoke('send-approval-sms', {
      body: {
        clientId,
        clientName,
        clientPhone,
        ticketNumber,
        programName,
        amountPaid,
        remainingBalance,
        isFull,
      },
    })

    console.log('send-approval-sms response:', { smsData, smsError })

    if (smsError) {
      showToast(`SMS call failed: ${smsError.message}`, 'error')
    } else if (smsData?.error) {
      showToast(`SMS failed: ${JSON.stringify(smsData)}`, 'error')
    } else {
      showToast(`SMS sent to ${smsData?.sentTo ?? clientPhone}.`)
    }

    setActingOn(null)
    load()
  }

  async function handleReject(payment) {
    setActingOn(payment.id)
    const { error } = await supabase.rpc('admin_reject_payment', { p_payment_id: payment.id })
    setActingOn(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(`Rejected the submission from ${payment.clients?.name}.`)
    load()
  }

  function openEdit(payment) {
    setEditError('')
    setEditForm({ amount: String(payment.amount), transaction_id: payment.transaction_id || '' })
    setEditing(payment)
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

    setEditing(null)
    showToast(`Updated ${editing.clients?.name}'s payment.`)
    load()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Payments"
        subtitle="Every payment recorded across all clients"
        action={
          <Link
            to="/payments/record"
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Record payment
          </Link>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'awaiting_approval', 'pending', 'paid', 'overdue', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                filter === s
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-white'
              }`}
            >
              {s === 'awaiting_approval' ? 'Awaiting approval' : s}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No payments found.</p>
          ) : (
            <>
              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="divide-y divide-slate-50 sm:hidden">
                {payments.map((p) => (
                  <div key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{p.clients?.name ?? '—'}</p>
                        <p className="truncate text-xs text-slate-500">{p.programs?.name ?? '—'}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status === 'awaiting_approval' ? 'Awaiting approval' : p.status}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="text-right text-slate-700">GHS {Number(p.amount).toLocaleString()}</dd>
                      <dt className="text-slate-500">Transaction ID</dt>
                      <dd className="text-right font-mono text-slate-700">{p.transaction_id || '—'}</dd>
                    </dl>
                    {p.edited_at && (
                      <p className="mt-2 text-[11px] italic text-slate-400">
                        Edited by {p.edited_by_name} · {new Date(p.edited_at).toLocaleString()}
                      </p>
                    )}
                    {p.status === 'awaiting_approval' && (
                      <div className="mt-3 flex gap-1.5">
                        <button
                          onClick={() => handleApprove(p)}
                          disabled={actingOn === p.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-success-500/10 px-2.5 py-1.5 text-xs font-medium text-success-600 hover:bg-success-500/20 disabled:opacity-50"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          disabled={actingOn === p.id}
                          className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleReject(p)}
                          disabled={actingOn === p.id}
                          className="flex items-center justify-center gap-1 rounded-lg bg-danger-50 px-2.5 py-1.5 text-xs font-medium text-danger-600 hover:bg-danger-50/70 disabled:opacity-50"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    )}
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
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Transaction ID</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-6 py-3 text-slate-800">{p.clients?.name ?? '—'}</td>
                        <td className="px-6 py-3 text-slate-500">{p.programs?.name ?? '—'}</td>
                        <td className="px-6 py-3 text-slate-800">GHS {Number(p.amount).toLocaleString()}</td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-600">{p.transaction_id || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status]}`}>
                            {p.status === 'awaiting_approval' ? 'Awaiting approval' : p.status}
                          </span>
                          {p.edited_at && (
                            <p className="mt-1 text-[11px] italic text-slate-400">
                              Edited by {p.edited_by_name} · {new Date(p.edited_at).toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {p.status === 'awaiting_approval' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleApprove(p)}
                                disabled={actingOn === p.id}
                                className="flex items-center gap-1 rounded-lg bg-success-500/10 px-2.5 py-1.5 text-xs font-medium text-success-600 hover:bg-success-500/20 disabled:opacity-50"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => openEdit(p)}
                                disabled={actingOn === p.id}
                                className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <Pencil size={14} /> Edit
                              </button>
                              <button
                                onClick={() => handleReject(p)}
                                disabled={actingOn === p.id}
                                className="flex items-center gap-1 rounded-lg bg-danger-50 px-2.5 py-1.5 text-xs font-medium text-danger-600 hover:bg-danger-50/70 disabled:opacity-50"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          )}
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !savingEdit && setEditing(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Edit pending payment</h2>
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
