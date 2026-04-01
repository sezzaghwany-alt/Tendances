import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import Navbar from '@/components/Navbar'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Tendances from '@/pages/Tendances'
import Alertes from '@/pages/Alertes'
import Saisie from '@/pages/Saisie'
import AuditTrail from '@/pages/AuditTrail'
import Admin from '@/pages/Admin'
import PointsParSalle from '@/pages/PointsParSalle'
import Personnel from '@/pages/Personnel'
import Saisie2026 from '@/pages/Saisie2026'
import SaisiePersonnel from '@/pages/SaisiePersonnel'
import Backup from '@/pages/Backup'
import SaisieEaux from '@/pages/SaisieEaux'

function Layout() {
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    // Compte les NC en temps réel
    async function countAlerts() {
      const { data: controles } = await supabase.from('controles').select('germes, zone_id, type_controle, zones(code)')
      const { data: normes } = await supabase.from('normes').select('*, zones(code)')
      if (!controles || !normes) return
      const nMap = {}
      normes.forEach(n => { nMap[`${n.zones?.code}_${n.type_controle}`] = n })
      const nc = controles.filter(c => {
        const n = nMap[`${c.zones?.code}_${c.type_controle}`]
        return n && c.germes >= n.alerte
      }).length
      setAlertCount(nc)
    }
    countAlerts()
  }, [])

  return (
    <div className="flex min-h-screen">
      <Navbar alertCount={alertCount} />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/tendances" element={<Tendances />} />
          <Route path="/points"     element={<PointsParSalle />} />
          <Route path="/personnel"  element={<Personnel />} />
          <Route path="/saisie2026" element={<ProtectedRoute requireOperateur><Saisie2026 /></ProtectedRoute>} />
          <Route path="/saisie-personnel" element={<ProtectedRoute requireOperateur><SaisiePersonnel /></ProtectedRoute>} />
          <Route path="/backup" element={<ProtectedRoute requireAdmin><Backup /></ProtectedRoute>} />
          <Route path="/saisie-eaux" element={<ProtectedRoute requireOperateur><SaisieEaux /></ProtectedRoute>} />
          <Route path="/alertes"   element={<Alertes />} />
          <Route path="/saisie"    element={<ProtectedRoute requireOperateur><Saisie /></ProtectedRoute>} />
          <Route path="/audit"     element={<ProtectedRoute requireAdmin><AuditTrail /></ProtectedRoute>} />
          <Route path="/admin"     element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand" />
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/*"     element={user ? <Layout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
