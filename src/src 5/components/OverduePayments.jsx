import { Link } from 'react-router-dom'

export default function OverduePayments({ items = [], totalCount = 0 }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Overdue payments</h2>
        {totalCount > 0 && (
          <span className="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-600">
            {totalCount}
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-slate-500">
            <th className="pb-2 font-medium">Client</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Due date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0">
              <td className="py-2.5 text-slate-800">{row.clientName}</td>
              <td className="py-2.5 text-slate-800">
                {row.currency} {row.amount.toLocaleString()}
              </td>
              <td className="py-2.5 text-slate-500">{row.dueDate}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Link
        to="/payments?status=overdue"
        className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View all overdue payments →
      </Link>
    </div>
  )
}
