import { useEffect, useState } from 'react'
import { Archive, Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { Users, HandCoins } from 'lucide-react'

export default function History() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('program_history')
        .select('*')
        .order('archived_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setRecords(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalClients = records.reduce((sum, r) => sum + (r.total_clients || 0), 0)
  const totalAmount = records.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

  function handleDownload() {
    downloadCsv(
      `edenplus-program-history-${new Date().toISOString().slice(0, 10)}.csv`,
      records.map((r) => ({
        'Program name': r.program_name,
        'Program date': r.program_date,
        Clients: r.total_clients,
        'Total amount (GHS)': r.total_amount,
        'Archived on': new Date(r.archived_at).toLocaleDateString(),
      }))
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="History"
        subtitle="Programs that finished, 7+ days ago, and were auto-archived"
        action={
          records.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Download size={14} />
              Download history
            </button>
          )
        }
      />

      <div className="p-4 sm:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Archive} label="Archived programs" value={records.length.toLocaleString()} />
          <StatCard icon={Users} label="Total clients (all-time archived)" value={totalClients.toLocaleString()} />
          <StatCard icon={HandCoins} label="Total collected (archived)" value={`GHS ${totalAmount.toLocaleString()}`} />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-sm text-danger-600">
            Couldn't load history: {error}. If this is your first time here, make sure the
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">program_history</code>
            migration has been run in Supabase.
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Nothing archived yet. Programs move here automatically 7 days after their date —
            client and payment details are removed at that point, but the program's name, date,
            client count, and total collected stay here permanently.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">Program</th>
                    <th className="px-6 py-3 font-medium">Program date</th>
                    <th className="px-6 py-3 font-medium">Clients</th>
                    <th className="px-6 py-3 font-medium">Total collected</th>
                    <th className="px-6 py-3 font-medium">Archived on</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-6 py-3 font-medium text-slate-800">{r.program_name}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {r.program_date ? new Date(r.program_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{r.total_clients}</td>
                      <td className="px-6 py-3 text-slate-600">
                        GHS {Number(r.total_amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {new Date(r.archived_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
