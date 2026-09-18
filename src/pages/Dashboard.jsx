import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, HandCoins, Clock3, PlusCircle } from 'lucide-react'
import Topbar from '../components/Topbar'
import StatCard from '../components/StatCard'
import OverduePayments from '../components/OverduePayments'
import PaymentsChart from '../components/PaymentsChart'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Dashboard() {
  const { admin } = useAuth()
  const navigate = useNavigate()

  const [payments, setPayments] = useState([])
  const [programs, setPrograms] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fallback sweep: the real automatic archiving runs on a daily
      // Supabase cron job (see migrations/add_program_history.sql). This
      // call is just a safety net so archiving still happens even if that
      // job isn't set up yet — it's a no-op when nothing is due.
      supabase.rpc('archive_completed_programs').then(({ error }) => {
        if (error) console.error('Archive sweep failed:', error.message)
      })

      const [{ data: allPayments }, { data: programRows }, { data: clientRows }] = await Promise.all([
        supabase.from('payments').select('client_id, program_id, amount, status, due_date, paid_at'),
        supabase.from('programs').select('id, price, date'),
        supabase.from('clients').select('id, name'),
      ])
      setPayments(allPayments || [])
      setPrograms(programRows || [])
      setClients(clientRows || [])
      setLoading(false)
    }
    load()
  }, [])

  const { totalCollected, totalClients, pendingTotal, overdueTotal, overdueList, chartData } = useMemo(() => {
    const now = new Date()

    // All-time total collected across every client and program — not
    // scoped to any date range, since this card is meant to represent the
    // program's total, not a single month's slice of it.
    const totalCollected = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const totalClients = clients.length

    const priceByProgram = new Map(programs.map((p) => [p.id, Number(p.price)]))
    const dateByProgram = new Map(programs.map((p) => [p.id, p.date ? new Date(p.date) : null]))
    const nameByClient = new Map(clients.map((c) => [c.id, c.name]))

    // Build the set of client+program pairs from ALL payments referencing a
    // program — not just the 'paid' ones. A client who's registered but
    // hasn't paid anything yet only has a 'pending' record, and still needs
    // to show up here with 0 paid / full balance owed. Filtering to 'paid'
    // payments before building the key set would silently drop them.
    const paidByClientProgram = new Map()
    const clientProgramKeys = new Set()
    payments
      .filter((p) => p.program_id)
      .forEach((p) => {
        const key = `${p.client_id}::${p.program_id}`
        clientProgramKeys.add(key)
        if (p.status === 'paid') {
          paidByClientProgram.set(key, (paidByClientProgram.get(key) || 0) + Number(p.amount))
        }
      })

    let pendingTotal = 0
    let overdueTotal = 0
    const overdueList = []

    clientProgramKeys.forEach((key) => {
      const [clientId, programId] = key.split('::')
      const price = priceByProgram.get(programId) || 0
      const paidAmount = paidByClientProgram.get(key) || 0
      const remaining = price - paidAmount
      if (remaining <= 0) return

      const programDate = dateByProgram.get(programId)
      const isOverdue = programDate && now >= programDate

      if (isOverdue) {
        overdueTotal += remaining
        overdueList.push({
          id: key,
          clientName: nameByClient.get(clientId) ?? 'Unknown client',
          amount: remaining,
          currency: 'GHS',
          dueDate: programDate.toLocaleDateString(),
          sortDate: programDate,
        })
      } else {
        pendingTotal += remaining
      }
    })

    // Standalone (no-program) invoices still use their stored status directly.
    payments
      .filter((p) => !p.program_id && p.status === 'pending')
      .forEach((p) => {
        pendingTotal += Number(p.amount)
      })

    payments
      .filter((p) => !p.program_id && p.status === 'overdue')
      .forEach((p) => {
        overdueTotal += Number(p.amount)
        overdueList.push({
          id: `manual-${p.client_id}-${p.due_date}`,
          clientName: nameByClient.get(p.client_id) ?? 'Unknown client',
          amount: Number(p.amount),
          currency: 'GHS',
          dueDate: p.due_date ?? '—',
          sortDate: p.due_date ? new Date(p.due_date) : new Date(0),
        })
      })

    overdueList.sort((a, b) => a.sortDate - b.sortDate)

    // Group by calendar day so multiple payments on the same day become one
    // point, not one point each — the cumulative total still stays correct.
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
      return {
        label: new Date(day).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        amount: running,
      }
    })
    const chartData = allDailyPoints.slice(-8)

    return { totalCollected, totalClients, pendingTotal, overdueTotal, overdueList, chartData }
  }, [payments, programs, clients])

  const user = admin && {
    name: admin.name,
    role: admin.role === 'super_admin' ? 'Super admin' : 'Admin',
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(admin.name)}`,
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Topbar
        title="Dashboard"
        subtitle={user ? `Welcome back, ${user.name}` : ''}
        user={user}
      />

      <div className="p-4 sm:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total clients" value={totalClients.toLocaleString()} />
          <StatCard
            icon={HandCoins}
            label="Payment collected"
            value={`GHS ${totalCollected.toLocaleString()}`}
          />
          <StatCard
            icon={Clock3}
            label="Pending payment"
            value={`GHS ${pendingTotal.toLocaleString()}`}
          />
          <StatCard icon={PlusCircle} label="Add a program" onClick={() => navigate('/programs/new')} />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <OverduePayments items={overdueList.slice(0, 5)} totalCount={overdueList.length} />
            {chartData.length > 0 ? (
              <PaymentsChart data={chartData} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Record a few paid payments and a running trend will show up here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
