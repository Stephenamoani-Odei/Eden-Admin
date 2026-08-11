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

export default function App() {
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
