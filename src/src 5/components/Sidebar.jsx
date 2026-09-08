import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import logo from '../assets/logo.jpg'
import {
  LayoutDashboard,
  PlusCircle,
  CalendarClock,
  ClipboardList,
  HandCoins,
  UserCog,
  FileClock,
  Inbox,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

const mainLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/programs/new', label: 'Add a program', icon: PlusCircle },
  { to: '/payments', label: 'Payment', icon: CalendarClock },
  { to: '/approvals', label: 'Approvals', icon: Inbox },
  { to: '/reports', label: 'Report and stat', icon: ClipboardList },
  { to: '/payments/record', label: 'Record payment', icon: HandCoins },
]

const quickActions = [
  { to: '/admins', label: 'Admins', icon: UserCog },
  { to: '/audit', label: 'Audit log', icon: FileClock },
]

function NavItem({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
          isActive
            ? 'bg-brand-600 text-white font-medium'
            : 'text-slate-300 hover:bg-navy-800 hover:text-white'
        }`
      }
    >
      <Icon size={18} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}

export default function Sidebar({ orgName = 'EdenPlus', orgTagline = 'Education consult' }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const closeOnMobile = () => setIsOpen(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900 text-white shadow-sm lg:hidden"
      >
        <Menu size={20} />
      </button>

      {isOpen && (
        <div
          onClick={closeOnMobile}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col bg-navy-900 px-3 py-4 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={logo} alt={orgName} className="h-10 w-10 shrink-0 rounded-md object-cover" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{orgName}</p>
            <p className="truncate text-[11px] text-slate-400">{orgTagline}</p>
          </div>
          <button
            onClick={closeOnMobile}
            aria-label="Close menu"
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {mainLinks.map((link) => (
            <NavItem key={link.to} {...link} onNavigate={closeOnMobile} />
          ))}
        </nav>

        <p className="mt-6 mb-1 px-4 text-xs font-medium text-slate-500">Quick action</p>
        <nav className="flex flex-col gap-1">
          {quickActions.map((link) => (
            <NavItem key={link.to} {...link} onNavigate={closeOnMobile} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4">
          <NavItem to="/settings" label="Settings" icon={Settings} onNavigate={closeOnMobile} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-navy-800 hover:text-white"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
