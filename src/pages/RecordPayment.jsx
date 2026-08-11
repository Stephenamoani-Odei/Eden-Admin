import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'

// Normalizes to the same local "0XXXXXXXXX" format the rest of the system
// stores, regardless of how the admin typed it in (with/without country
// code, spaces, dashes, etc.) — this is what lets us reliably match a
// returning client by phone even if their name is typed differently.
function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.startsWith('233')) return '0' + digits.slice(3)
  return digits
}

const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
]

export default function RecordPayment() {
  const { admin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [programs, setPrograms] = useState([])
  const [newClientMode, setNewClientMode] = useState(false)
  const [paidSoFar, setPaidSoFar] = useState(0)
  const [paymentType, setPaymentType] = useState('full') // 'full' | 'part'
  const [partAmount, setPartAmount] = useState('')
  const [clientSummary, setClientSummary] = useState(null) // { totalPaid, totalPending, pendingItems }

  const [form, setForm] = useState({
    clientId: '',
    newClientName: '',
    newClientPhone: '',
    newClientEmail: '',
    newClientRegion: '',
    newClientCity: '',
    programId: '',
    dueDate: '',
    // Only used when no program is selected — there's no price to compare
    // against, so it falls back to a manual amount + status.
    manualAmount: '',
    manualStatus: 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [phoneMatch, setPhoneMatch] = useState(null) // { id, name } if an existing client shares this phone

  // Live check as the admin types a phone number in "Add new client" mode —
  // warns before submit, rather than only catching it at save time.
  useEffect(() => {
    if (!newClientMode) {
      setPhoneMatch(null)
      return
    }
    const normalized = normalizePhone(form.newClientPhone)
    if (normalized.length < 9) {
      setPhoneMatch(null)
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('phone', normalized)
        .maybeSingle()
      setPhoneMatch(data || null)
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.newClientPhone, newClientMode])

  useEffect(() => {
    async function load() {
      const [{ data: clientRows }, { data: programRows }] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('programs').select('id, name, price').eq('is_active', true).order('name'),
      ])
      setClients(clientRows || [])
      setPrograms(programRows || [])
    }
    load()
  }, [])

  const selectedProgram = programs.find((p) => p.id === form.programId)

  // The moment an existing client is picked, pull their whole payment
  // history so the admin sees what they already owe before anything else.
  useEffect(() => {
    async function loadClientSummary() {
      if (newClientMode || !form.clientId) {
        setClientSummary(null)
        return
      }
      const { data } = await supabase
        .from('payments')
        .select('amount, status, program_id, due_date, programs(id, name, price)')
        .eq('client_id', form.clientId)

      const rows = data || []
      const totalPaid = rows
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0)

      // Group paid amounts by program to work out what's genuinely still
      // owed on each one — a part payment is stored as 'paid', so pending
      // can never be read directly off the status column.
      const paidByProgram = new Map()
      rows
        .filter((p) => p.status === 'paid' && p.program_id)
        .forEach((p) => {
          paidByProgram.set(p.program_id, (paidByProgram.get(p.program_id) || 0) + Number(p.amount))
        })

      const programsById = new Map()
      rows.forEach((p) => {
        if (p.program_id && p.programs) programsById.set(p.program_id, p.programs)
      })

      const pendingItems = []
      paidByProgram.forEach((paidAmount, programId) => {
        const program = programsById.get(programId)
        const price = Number(program?.price || 0)
        const remaining = price - paidAmount
        if (remaining > 0) {
          pendingItems.push({ programs: { name: program?.name }, amount: remaining, due_date: null })
        }
      })

      // Standalone invoices (no program) still use their stored status directly.
      rows
        .filter((p) => !p.program_id && (p.status === 'pending' || p.status === 'overdue'))
        .forEach((p) => pendingItems.push(p))

      const totalPending = pendingItems.reduce((sum, p) => sum + Number(p.amount), 0)

      setClientSummary({ totalPaid, totalPending, pendingItems })
    }
    loadClientSummary()
  }, [form.clientId, newClientMode])

  // Whenever an existing client + program are both picked, look up how much
  // has already been paid toward that program so we can compute a balance.
  useEffect(() => {
    async function loadPaidSoFar() {
      if (newClientMode || !form.clientId || !form.programId) {
        setPaidSoFar(0)
        return
      }
      const { data } = await supabase
        .from('payments')
        .select('amount')
        .eq('client_id', form.clientId)
        .eq('program_id', form.programId)
        .eq('status', 'paid')

      const total = (data || []).reduce((sum, p) => sum + Number(p.amount), 0)
      setPaidSoFar(total)
    }
    loadPaidSoFar()
  }, [form.clientId, form.programId, newClientMode])

  const balance = selectedProgram ? Math.max(selectedProgram.price - paidSoFar, 0) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    let clientId = form.clientId

    if (newClientMode) {
      const normalizedPhone = normalizePhone(form.newClientPhone)

      // Same phone number = same person, regardless of how their name was
      // typed this time. Reuse their existing record instead of creating a
      // duplicate client the payment history would then be split across.
      if (normalizedPhone) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id, name')
          .eq('phone', normalizedPhone)
          .maybeSingle()

        if (existing) {
          clientId = existing.id
          showToast(`Matched an existing client by phone number (${existing.name}) — adding this payment to their record instead of creating a duplicate.`)
        }
      }

      if (!clientId) {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: form.newClientName,
            phone: normalizedPhone || null,
            email: form.newClientEmail || null,
            region: form.newClientRegion || null,
            city: form.newClientCity || null,
            added_by: admin?.id,
          })
          .select('id')
          .single()

        if (error) {
          setSaving(false)
          setError(error.message)
          return
        }
        clientId = data.id
      }
    }

    if (!clientId) {
      setSaving(false)
      setError('Choose a client or add a new one.')
      return
    }

    let amount
    let status

    if (selectedProgram) {
      if (paymentType === 'full') {
        amount = balance
      } else {
        const entered = Number(partAmount)
        if (!entered || entered <= 0) {
          setSaving(false)
          setError('Enter how much is being paid now.')
          return
        }
        if (entered > balance) {
          setSaving(false)
          setError(`That's more than the remaining balance (GHS ${balance.toLocaleString()}).`)
          return
        }
        amount = entered
      }
      // Whatever was actually handed over just now is collected money —
      // always 'paid'. The remaining balance isn't a transaction, so it's
      // never stored as its own row; it's calculated live wherever it's
      // shown (this form, Dashboard, Reports).
      status = 'paid'
    } else {
      amount = Number(form.manualAmount)
      status = form.manualStatus
    }

    const { error } = await supabase.from('payments').insert({
      client_id: clientId,
      program_id: form.programId || null,
      amount,
      due_date: form.dueDate || null,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      recorded_by: admin?.id,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/payments')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader title="Record payment" subtitle="Log a payment against a client" />

      <div className="p-4 sm:p-8">
        <form
          onSubmit={handleSubmit}
          className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Client</label>
              <button
                type="button"
                onClick={() => setNewClientMode((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {newClientMode ? 'Choose existing client' : '+ Add new client'}
              </button>
            </div>

            {newClientMode ? (
              <div className="flex flex-col gap-2">
                <input
                  required
                  value={form.newClientName}
                  onChange={(e) => setForm({ ...form, newClientName: e.target.value })}
                  placeholder="Client name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <input
                  value={form.newClientPhone}
                  onChange={(e) => setForm({ ...form, newClientPhone: e.target.value })}
                  placeholder="Phone (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                {phoneMatch && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <span>A client named <strong>{phoneMatch.name}</strong> already has this phone number.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewClientMode(false)
                        setForm((f) => ({ ...f, clientId: phoneMatch.id }))
                        setPhoneMatch(null)
                      }}
                      className="shrink-0 rounded-md bg-amber-100 px-2 py-1 font-medium hover:bg-amber-200"
                    >
                      Use their record
                    </button>
                  </div>
                )}
                <input
                  type="email"
                  value={form.newClientEmail}
                  onChange={(e) => setForm({ ...form, newClientEmail: e.target.value })}
                  placeholder="Email (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={form.newClientRegion}
                    onChange={(e) => setForm({ ...form, newClientRegion: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="">Region (optional)</option>
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.newClientCity}
                    onChange={(e) => setForm({ ...form, newClientCity: e.target.value })}
                    placeholder="Town / city (optional)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
            ) : (
              <select
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {clientSummary && (
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total paid (all programs)</span>
                <span>GHS {clientSummary.totalPaid.toLocaleString()}</span>
              </div>
              <div
                className={`mt-1 flex justify-between border-t border-slate-200 pt-1 font-medium ${
                  clientSummary.totalPending > 0 ? 'text-danger-600' : 'text-slate-800'
                }`}
              >
                <span>Outstanding balance</span>
                <span>GHS {clientSummary.totalPending.toLocaleString()}</span>
              </div>
              {clientSummary.pendingItems.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-500">
                  {clientSummary.pendingItems.map((item, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {item.programs?.name ?? 'General payment'}
                        {item.due_date ? ` · due ${item.due_date}` : ''}
                      </span>
                      <span>GHS {Number(item.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Program</label>
            <select
              value={form.programId}
              onChange={(e) => {
                setForm({ ...form, programId: e.target.value })
                setPaymentType('full')
                setPartAmount('')
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">None</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProgram ? (
            <>
              <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Program price</span>
                  <span>GHS {Number(selectedProgram.price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Already paid</span>
                  <span>GHS {paidSoFar.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-medium text-slate-800">
                  <span>Balance</span>
                  <span>GHS {balance.toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Payment type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      paymentType === 'full'
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Full payment (GHS {balance.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('part')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      paymentType === 'part'
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Part payment
                  </button>
                </div>
              </div>

              {paymentType === 'part' && (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Amount being paid now (GHS)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={balance}
                    required
                    value={partAmount}
                    onChange={(e) => setPartAmount(e.target.value)}
                    placeholder={`Up to ${balance.toLocaleString()}`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Due date for the rest {paymentType === 'full' ? '(not needed)' : '(optional)'}
                </label>
                <input
                  type="date"
                  disabled={paymentType === 'full'}
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </>
          ) : (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount (GHS)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.manualAmount}
                  onChange={(e) => setForm({ ...form, manualAmount: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.manualStatus}
                  onChange={(e) => setForm({ ...form, manualStatus: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="mb-4 text-sm text-danger-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save payment'}
          </button>
        </form>
      </div>
    </div>
  )
}