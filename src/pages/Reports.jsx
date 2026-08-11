import { useEffect, useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import PaymentsChart from '../components/PaymentsChart'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../lib/ToastContext'
import { Users, HandCoins, AlertTriangle } from 'lucide-react'

function monthLabel(date) {
  return date.toLocaleString('en', { month: 'short', day: 'numeric' })
}

function statusBadgeClass(status) {
  if (status === 'Paid in full') return 'bg-success-500/10 text-success-600'
  if (status === 'Overdue') return 'bg-danger-50 text-danger-600'
  if (status === 'Pending') return 'bg-amber-50 text-amber-600'
  return 'bg-slate-100 text-slate-600'
}

export default function Reports() {
  const { showToast } = useToast()
  const [clients, setClients] = useState([])
  const [payments, setPayments] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function loadAll() {
    const [{ data: clientRows }, { data: paymentRows }, { data: programRows }] = await Promise.all([
      supabase.from('clients').select('id, name, phone, email, region, city, ticket_number, created_at'),
      supabase.from('payments').select('client_id, program_id, amount, status, due_date, paid_at, created_at'),
      supabase.from('programs').select('id, name, price, date').order('created_at', { ascending: true }),
    ])
    setClients(clientRows || [])
    setPayments(paymentRows || [])
    setPrograms(programRows || [])
  }

  useEffect(() => {
    loadAll().then(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const clientsThisMonth = clients.filter((c) => new Date(c.created_at) >= startOfMonth).length

    const paidThisMonth = payments
      .filter((p) => p.status === 'paid' && p.paid_at && new Date(p.paid_at) >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const dailyTotals = new Map()
    payments
      .filter((p) => p.status === 'paid' && p.paid_at)
      .forEach((p) => {
        const dayKey = new Date(p.paid_at).toDateString()
        dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + Number(p.amount))
      })

    const sortedDays = Array.from(dailyTotals.entries()).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    )

    let running = 0
    const allDailyPoints = sortedDays.map(([day, total]) => {
      running += total
      return { label: monthLabel(new Date(day)), amount: running }
    })
    const chartData = allDailyPoints.slice(-8)

    const priceByProgram = new Map(programs.map((p) => [p.id, Number(p.price)]))
    const dateByProgram = new Map(programs.map((p) => [p.id, p.date ? new Date(p.date) : null]))
    const nameByProgram = new Map(programs.map((p) => [p.id, p.name]))

    let overdueTotal = 0

    const clientRows = []

    clients.forEach((client) => {
      const clientPayments = payments.filter((p) => p.client_id === client.id)
      const baseInfo = {
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        region: client.region || '',
        city: client.city || '',
        ticketNumber: client.ticket_number || '',
      }

      if (clientPayments.length === 0) {
        clientRows.push({
          ...baseInfo,
          programKey: '__none__',
          programName: '—',
          paid: 0,
          pending: 0,
          overdue: 0,
          status: 'No payments yet',
        })
        return
      }

      const byProgram = new Map()
      clientPayments.forEach((p) => {
        const key = p.program_id || '__general__'
        if (!byProgram.has(key)) byProgram.set(key, [])
        byProgram.get(key).push(p)
      })

      byProgram.forEach((progPayments, key) => {
        let paid = 0
        let pending = 0
        let overdue = 0

        if (key === '__general__') {
          progPayments.forEach((p) => {
            const amount = Number(p.amount)
            if (p.status === 'paid') paid += amount
            else if (p.status === 'pending') pending += amount
            else if (p.status === 'overdue') overdue += amount
          })
        } else {
          paid = progPayments
            .filter((p) => p.status === 'paid')
            .reduce((sum, p) => sum + Number(p.amount), 0)

          const price = priceByProgram.get(key) || 0
          const remaining = price - paid
          if (remaining > 0) {
            const programDate = dateByProgram.get(key)
            if (programDate && now >= programDate) {
              overdue = remaining
            } else {
              pending = remaining
            }
          }
        }

        overdueTotal += overdue

        const status = overdue > 0 ? 'Overdue' : pending > 0 ? 'Pending' : 'Paid in full'

        clientRows.push({
          ...baseInfo,
          programKey: key,
          programName: key === '__general__' ? 'General' : nameByProgram.get(key) || '—',
          paid,
          pending,
          overdue,
          status,
        })
      })
    })

    return { clientsThisMonth, paidThisMonth, overdueTotal, chartData, clientRows }
  }, [clients, payments, programs])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return stats.clientRows
    return stats.clientRows.filter((c) => c.status === statusFilter)
  }, [stats.clientRows, statusFilter])

  const groupedRows = useMemo(() => {
    const groups = new Map()
    filteredRows.forEach((row) => {
      if (!groups.has(row.programKey)) {
        groups.set(row.programKey, { programKey: row.programKey, programName: row.programName, rows: [] })
      }
      groups.get(row.programKey).rows.push(row)
    })

    const order = [...programs.map((p) => p.id), '__general__', '__none__']
    const ordered = []
    order.forEach((key) => {
      if (groups.has(key)) {
        ordered.push(groups.get(key))
        groups.delete(key)
      }
    })
    groups.forEach((group) => ordered.push(group))

    return ordered.map((group) => ({
      ...group,
      totals: group.rows.reduce(
        (acc, r) => ({
          paid: acc.paid + r.paid,
          pending: acc.pending + r.pending,
          overdue: acc.overdue + r.overdue,
        }),
        { paid: 0, pending: 0, overdue: 0 }
      ),
    }))
  }, [filteredRows, programs])

  function rowsToCsv(rows) {
    return rows.map((c) => ({
      'Client name': c.name,
      Phone: c.phone,
      Email: c.email,
      Region: c.region,
      'Town/City': c.city,
      Ticket: c.ticketNumber,
      Program: c.programName,
      'Total paid (GHS)': c.paid,
      'Pending (GHS)': c.pending,
      'Overdue (GHS)': c.overdue,
      Status: c.status,
    }))
  }

  function handleDownload() {
    downloadCsv(
      `edenplus-client-report-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(filteredRows)
    )
  }

  function handleDownloadProgram(group) {
    const slug = group.programName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    downloadCsv(
      `edenplus-${slug || 'program'}-report-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(group.rows)
    )
  }

  const pendingDeletePaymentCount = useMemo(() => {
    if (!pendingDeleteGroup) return 0
    if (pendingDeleteGroup.programKey === '__general__') {
      return payments.filter((p) => !p.program_id).length
    }
    return payments.filter((p) => p.program_id === pendingDeleteGroup.programKey).length
  }, [pendingDeleteGroup, payments])

  async function confirmDeleteProgramReport() {
    const group = pendingDeleteGroup
    if (!group) return
    setDeleting(true)

    const { data: deletedCount, error } = await supabase.rpc('admin_delete_program_payments', {
      p_program_id: group.programKey === '__general__' ? null : group.programKey,
    })

    if (error) {
      setDeleting(false)
      setPendingDeleteGroup(null)
      showToast(error.message, 'error')
      return
    }

    await loadAll()
    setDeleting(false)
    setPendingDeleteGroup(null)

    showToast(
      group.programKey === '__general__'
        ? `Deleted ${deletedCount} general payment record${deletedCount === 1 ? '' : 's'}.`
        : `Deleted ${deletedCount} payment record${deletedCount === 1 ? '' : 's'} for "${group.programName}". The program itself is untouched.`
    )
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <PageHeader title="Report and stat" subtitle="How the business is doing this month" />
        <p className="p-8 text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Report and stat"
        subtitle="How the business is doing this month"
        action={
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            <Download size={16} />
            {statusFilter === 'all' ? 'Download report' : `Download "${statusFilter}" only`}
          </button>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Clients added this month" value={stats.clientsThisMonth} />
          <StatCard
            icon={HandCoins}
            label="Collected this month"
            value={`GHS ${stats.paidThisMonth.toLocaleString()}`}
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue total"
            value={`GHS ${stats.overdueTotal.toLocaleString()}`}
          />
        </div>

        <div className="mb-6">
          {stats.chartData.length > 0 ? (
            <PaymentsChart data={stats.chartData} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Record a few paid payments and a running trend will show up here.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All clients</h2>
              <p className="text-sm text-slate-500">Who's paid in full, pending, and overdue</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'Paid in full', 'Pending', 'Overdue', 'No payments yet'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    statusFilter === s
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          {filteredRows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              {statusFilter === 'all' ? 'No clients yet.' : `No clients with status "${statusFilter}".`}
            </p>
          ) : (
            groupedRows.map((group) => (
              <div key={group.programKey} className="border-b border-slate-100 last:border-0">
                <div className="flex flex-col gap-2 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-700">
                      {group.programName === '—' ? 'Not registered for a program' : group.programName}
                    </h3>
                    <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-slate-500">
                      <span>
                        {group.rows.length} client{group.rows.length === 1 ? '' : 's'}
                      </span>
                      <span>· Paid GHS {group.totals.paid.toLocaleString()}</span>
                      <span>· Pending GHS {group.totals.pending.toLocaleString()}</span>
                      <span>· Overdue GHS {group.totals.overdue.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button
                      onClick={() => handleDownloadProgram(group)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:flex-none sm:justify-start"
                    >
                      <Download size={14} />
                      Download this program
                    </button>
                    {group.programKey !== '__none__' && (
                      <button
                        onClick={() => setPendingDeleteGroup(group)}
                        aria-label={`Delete report for ${group.programName}`}
                        className="flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-500 hover:border-danger-500/30 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-50 sm:hidden">
                  {group.rows.map((c, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{c.name}</p>
                          {(c.phone || c.email) && (
                            <p className="truncate text-xs text-slate-500">
                              {c.phone}
                              {c.phone && c.email ? ' · ' : ''}
                              {c.email}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(c.status)}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                        <dt className="text-slate-500">Location</dt>
                        <dd className="text-right text-slate-700">
                          {[c.city, c.region].filter(Boolean).join(', ') || '—'}
                        </dd>
                        <dt className="text-slate-500">Ticket</dt>
                        <dd className="text-right text-slate-700">{c.ticketNumber || '—'}</dd>
                        <dt className="text-slate-500">Paid</dt>
                        <dd className="text-right text-slate-700">GHS {c.paid.toLocaleString()}</dd>
                        <dt className="text-slate-500">Pending</dt>
                        <dd className="text-right text-slate-700">GHS {c.pending.toLocaleString()}</dd>
                        <dt className="text-slate-500">Overdue</dt>
                        <dd className="text-right text-slate-700">GHS {c.overdue.toLocaleString()}</dd>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="px-6 py-3 font-medium">Client</th>
                        <th className="px-6 py-3 font-medium">Contact</th>
                        <th className="px-6 py-3 font-medium">Location</th>
                        <th className="px-6 py-3 font-medium">Ticket</th>
                        <th className="px-6 py-3 font-medium">Paid</th>
                        <th className="px-6 py-3 font-medium">Pending</th>
                        <th className="px-6 py-3 font-medium">Overdue</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((c, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-6 py-3 text-slate-800">{c.name}</td>
                          <td className="px-6 py-3 text-slate-500">
                            {c.phone}
                            {c.phone && c.email ? ' · ' : ''}
                            {c.email}
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {[c.city, c.region].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-6 py-3 text-slate-500">{c.ticketNumber || '—'}</td>
                          <td className="px-6 py-3 text-slate-800">GHS {c.paid.toLocaleString()}</td>
                          <td className="px-6 py-3 text-slate-800">GHS {c.pending.toLocaleString()}</td>
                          <td className="px-6 py-3 text-slate-800">GHS {c.overdue.toLocaleString()}</td>
                          <td className="px-6 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(c.status)}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDeleteGroup}
        title={
          pendingDeleteGroup?.programKey === '__general__'
            ? 'Delete these general payments?'
            : 'Delete payment records for this program?'
        }
        message={
          pendingDeleteGroup
            ? pendingDeleteGroup.programKey === '__general__'
              ? `This permanently deletes ${pendingDeletePaymentCount} standalone payment record${
                  pendingDeletePaymentCount === 1 ? '' : 's'
                } that aren't tied to any program, and removes any client left with no payments at all as a result. This can't be undone.`
              : `This permanently deletes all ${pendingDeletePaymentCount} payment record${
                  pendingDeletePaymentCount === 1 ? '' : 's'
                } for "${pendingDeleteGroup.programName}", and removes any client left with no payments at all as a result. The "${pendingDeleteGroup.programName}" program itself is not deleted — it stays in Programs and the payment form. This can't be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={confirmDeleteProgramReport}
        onCancel={() => setPendingDeleteGroup(null)}
      />
    </div>
  )
}