import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function PaymentsChart({ data = [], currency = 'GHS' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Payments collected</h2>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a9c5c" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1a9c5c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${currency} ${value.toLocaleString()}`, 'Collected']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#1a9c5c"
              strokeWidth={2}
              fill="url(#collected)"
              dot={{ r: 4, fill: '#1a9c5c' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
