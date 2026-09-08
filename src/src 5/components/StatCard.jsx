export default function StatCard({ icon: Icon, label, value, onClick, accent = 'brand' }) {
  const bg = accent === 'brand' ? 'bg-brand-600' : 'bg-slate-900'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${bg} text-white`}>
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {value && <p className="truncate text-xl font-semibold text-slate-900">{value}</p>}
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>
      </div>
    </button>
  )
}
