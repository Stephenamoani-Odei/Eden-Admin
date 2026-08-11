export default function Topbar({ title, subtitle, user }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white py-4 pl-16 pr-4 lg:px-8 lg:py-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-slate-900 lg:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-9 w-9 shrink-0 rounded-full object-cover lg:h-10 lg:w-10"
          />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
        </div>
      )}
    </header>
  )
}
