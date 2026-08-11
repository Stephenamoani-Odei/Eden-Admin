export default function PageHeader({ title, subtitle, action }) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 bg-white py-4 pl-16 pr-4 sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-slate-900 lg:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
