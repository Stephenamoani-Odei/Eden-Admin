import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'

const ACTION_STYLES = {
  insert: 'bg-success-500/10 text-success-600',
  update: 'bg-slate-100 text-slate-600',
  delete: 'bg-danger-50 text-danger-600',
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action_type, target_table, created_at, admins(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error) setLogs(data)
      setLoading(false)
    }
    load()
  }, [])

  function handleDownload() {
    downloadCsv(
      `edenplus-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      logs.map((log) => ({
        Admin: log.admins?.name ?? 'System',
        Action: log.action_type,
        Table: log.target_table,
        When: new Date(log.created_at).toLocaleString(),
      }))
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Audit log"
        subtitle="Every create, edit, and delete across the system"
        action={
          logs.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              <Download size={16} /> Download log
            </button>
          )
        }
      />

      <div className="p-4 sm:p-8">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No activity yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Admin</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Table</th>
                  <th className="px-6 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3 text-slate-800">{log.admins?.name ?? 'System'}</td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_STYLES[log.action_type]}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 capitalize text-slate-600">{log.target_table}</td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
