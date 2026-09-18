import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Programs from './pages/Programs'
import Payments from './pages/Payments'
import Approvals from './pages/Approvals'
import RecordPayment from './pages/RecordPayment'
import Reports from './pages/Reports'
import Admins from './pages/Admins'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

const SYSTEM_UPDATE_IN_PROGRESS = true

function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      {children}
    </div>
  )
}

function withLayout(page) {
  return (
    <ProtectedRoute>
      <AppLayout>{page}</AppLayout>
    </ProtectedRoute>
  )
}

function SystemUpdateDialog() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-slate-800">System update in progress</p>
      <p className="max-w-sm text-sm text-slate-500">
        We're working on the dashboard right now. Please check back later.
      </p>
    </div>
  )
}

export default function App() {
  if (SYSTEM_UPDATE_IN_PROGRESS) {
    return <SystemUpdateDialog />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={withLayout(<Dashboard />)} />
      <Route path="/programs/new" element={withLayout(<Programs />)} />
      <Route path="/payments" element={withLayout(<Payments />)} />
      <Route path="/approvals" element={withLayout(<Approvals />)} />
      <Route path="/payments/record" element={withLayout(<RecordPayment />)} />
      <Route path="/reports" element={withLayout(<Reports />)} />
      <Route path="/admins" element={withLayout(<Admins />)} />
      <Route path="/audit" element={withLayout(<AuditLog />)} />
      <Route path="/settings" element={withLayout(<Settings />)} />
    </Routes>
  )
}
