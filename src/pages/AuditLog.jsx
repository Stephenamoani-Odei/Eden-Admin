import { useEffect, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'

const ACTION_STYLES = {
  insert: 'bg-success-500/10 text-success-600',
  update: 'bg-slate-100 text-slate-600',
  delete: 'bg-danger-50 text-danger-600',
}

export default function AuditLog() {
  const { isSuperAdmin } = useAuth()
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action_type, target_table, created_at, admins(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) {
      setLogs(data)
    } else {
      showToast(`Couldn't load the audit log: ${error.message}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
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

  async function confirmDeleteOne() {
    const target = pendingDelete
    setPendingDelete(null)
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_audit_log', { p_id: target.id })
    setDeleting(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setLogs((prev) => prev.filter((l) => l.id !== target.id))
    showToast('Entry deleted.')
  }

  async function confirmDeleteAll() {
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_all_audit_logs')
    setDeleting(false)
    setPendingDeleteAll(false)
    setConfirmText('')
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setLogs([])
    showToast('Audit log cleared.')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageHeader
        title="Audit log"
        subtitle="Every create, edit, and delete across the system"
        action={
          <div className="flex flex-wrap gap-2">
            {logs.length > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              >
                <Download size={16} /> Download log
              </button>
            )}
            {isSuperAdmin && logs.length > 0 && (
              <button
                onClick={() => setPendingDeleteAll(true)}
                className="flex items-center gap-2 rounded-lg border border-danger-500/30 px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50"
              >
                <Trash2 size={16} /> Delete all
              </button>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No activity yet.</p>
          ) : (
            <>
              {/* Mobile: stacked cards, no horizontal scrolling */}
              <div className="divide-y divide-slate-50 sm:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{log.admins?.name ?? 'System'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.target_table} · {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_STYLES[log.action_type]}`}
                      >
                        {log.action_type}
                      </span>
                      {isSuperAdmin && (
                        <button
                          onClick={() => setPendingDelete(log)}
                          aria-label="Delete entry"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table, horizontal scroll scoped to just the table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="px-6 py-3 font-medium">Admin</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                      <th className="px-6 py-3 font-medium">Table</th>
                      <th className="px-6 py-3 font-medium">When</th>
                      {isSuperAdmin && <th className="px-6 py-3 font-medium"></th>}
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
                        {isSuperAdmin && (
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => setPendingDelete(log)}
                              aria-label="Delete entry"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
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
        title="Delete this entry?"
        message="This audit log entry will be permanently removed. This can't be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={confirmDeleteOne}
        onCancel={() => setPendingDelete(null)}
      />

      {pendingDeleteAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !deleting && (setPendingDeleteAll(false), setConfirmText(''))}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Delete the entire audit log?</h2>
            <p className="mb-4 text-sm text-slate-600">
              This permanently deletes every entry in the audit log. This can't be undone. Type{' '}
              <span className="font-mono font-semibold">DELETE ALL</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE ALL"
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-danger-500 focus:ring-2 focus:ring-danger-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPendingDeleteAll(false)
                  setConfirmText('')
                }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAll}
                disabled={deleting || confirmText !== 'DELETE ALL'}
                className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
