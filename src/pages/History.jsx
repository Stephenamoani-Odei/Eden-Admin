import { useEffect, useState } from 'react'
import { Archive, Download, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { Users, HandCoins } from 'lucide-react'

export default function History() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedClients, setSelectedClients] = useState([])
  const [selectedLoading, setSelectedLoading] = useState(false)

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

  useEffect(() => {
    if (!selected) {
      setSelectedClients([])
      return
    }
    async function loadClients() {
      setSelectedLoading(true)
      const { data, error } = await supabase
        .from('program_history_clients')
        .select('*')
        .eq('history_id', selected.id)
        .order('client_name')

      if (!error) setSelectedClients(data || [])
      setSelectedLoading(false)
    }
    loadClients()
  }, [selected])

  function handleDownloadSelectedClients() {
    if (!selected) return
    const slug = selected.program_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    downloadCsv(
      `edenplus-${slug || 'program'}-clients.csv`,
      selectedClients.length > 0
        ? selectedClients.map((c) => ({
            'Client name': c.client_name || '—',
            Phone: c.phone || '',
            Email: c.email || '',
            Region: c.region || '',
            'Town/City': c.city || '',
            Ticket: c.ticket_number || '',
            'Paid (GHS)': c.paid_amount,
            'Pending (GHS)': c.pending_amount,
          }))
        : [{ 'Client name': 'No clients registered for this program' }]
    )
  }

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
        subtitle="Programs that have finished — archived automatically after 7 days, or manually"
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
            Nothing archived yet. Programs move here automatically 7 days after their date, or
            immediately if you mark one done manually. Client details move with them — nothing
            is deleted, it just becomes read-only history.
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
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.program_name}</h2>
                <p className="text-sm text-slate-500">
                  Ran on{' '}
                  {selected.program_date
                    ? new Date(selected.program_date).toLocaleDateString()
                    : 'an unrecorded date'}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xl font-semibold text-slate-900">{selected.total_clients}</p>
                <p className="text-xs font-medium text-slate-500">Clients trained</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xl font-semibold text-slate-900">
                  GHS {Number(selected.total_amount).toLocaleString()}
                </p>
                <p className="text-xs font-medium text-slate-500">Total collected</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xl font-semibold text-slate-900">
                  GHS{' '}
                  {selected.total_clients > 0
                    ? Math.round(Number(selected.total_amount) / selected.total_clients).toLocaleString()
                    : 0}
                </p>
                <p className="text-xs font-medium text-slate-500">Avg. per client</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xl font-semibold text-slate-900">
                  {new Date(selected.archived_at).toLocaleDateString()}
                </p>
                <p className="text-xs font-medium text-slate-500">Archived on</p>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Client details</p>
              {selectedClients.length > 0 && (
                <button
                  onClick={handleDownloadSelectedClients}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Download size={13} />
                  Download CSV
                </button>
              )}
            </div>

            {selectedLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : selectedClients.length === 0 ? (
              <p className="text-sm text-slate-500">No client records were saved for this program.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-2 font-medium">Client</th>
                        <th className="px-4 py-2 font-medium">Contact</th>
                        <th className="px-4 py-2 font-medium">Ticket</th>
                        <th className="px-4 py-2 font-medium">Paid</th>
                        <th className="px-4 py-2 font-medium">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClients.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-800">{c.client_name || '—'}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {c.phone || c.email || '—'}
                          </td>
                          <td className="px-4 py-2 text-slate-600">{c.ticket_number || '—'}</td>
                          <td className="px-4 py-2 text-slate-600">GHS {Number(c.paid_amount).toLocaleString()}</td>
                          <td className="px-4 py-2 text-slate-600">GHS {Number(c.pending_amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
