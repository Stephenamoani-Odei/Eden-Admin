import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'


const Dashboard = lazy(() => import('./pages/Dashboard'))
const Programs = lazy(() => import('./pages/Programs'))
const Payments = lazy(() => import('./pages/Payments'))
const Approvals = lazy(() => import('./pages/Approvals'))
const RecordPayment = lazy(() => import('./pages/RecordPayment'))
const Reports = lazy(() => import('./pages/Reports'))
const Admins = lazy(() => import('./pages/Admins'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
    </div>
  )
}

function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
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