import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { LayoutDashboard, TrendingUp, AlertTriangle, PenLine, ClipboardList, Settings, Sun, Moon, LogOut, FlaskConical } from 'lucide-react'

const links = [
  { to: '/',                 label: 'Dashboard',        icon: LayoutDashboard, roles: ['admin','operateur','lecteur'] },
  { to: '/tendances',        label: 'Tendances',         icon: TrendingUp,      roles: ['admin','operateur','lecteur'] },
  { to: '/points',           label: 'Points/Salles',     icon: TrendingUp,      roles: ['admin','operateur','lecteur'] },
  { to: '/saisie2026',       label: '✏️ Saisie 2026',    icon: TrendingUp,      roles: ['admin','operateur'] },
  { to: '/saisie-personnel', label: '🧤 Saisie Personnel',icon: TrendingUp,     roles: ['admin','operateur'] },
  { to: '/personnel',        label: 'Personnel',         icon: TrendingUp,      roles: ['admin','operateur','lecteur'] },
  { to: '/alertes',          label: 'Alertes',           icon: AlertTriangle,   roles: ['admin','operateur','lecteur'] },
  { to: '/saisie',           label: 'Saisie',            icon: PenLine,         roles: ['admin','operateur'] },
  { to: '/backup',           label: '💾 Sauvegarde',     icon: ClipboardList,   roles: ['admin'] },
  { to: '/audit',            label: 'Audit Trail',       icon: ClipboardList,   roles: ['admin'] },
  { to: '/admin',            label: 'Administration',    icon: Settings,        roles: ['admin'] },
]

export default function Navbar({ alertCount = 0 }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // ── Alerte sauvegarde : Mercredi(3) et Vendredi(5) après 16h45 ──
  const [showBackupAlert, setShowBackupAlert] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function checkBackup() {
      const now = new Date()
      const day = now.getDay()
      const h = now.getHours()
      const m = now.getMinutes()
      const isBackupDay = day === 3 || day === 5
      const isAfter1645 = h > 16 || (h === 16 && m >= 45)
      const isBefore18  = h < 18

      if (isBackupDay && isAfter1645 && isBefore18 && !dismissed) {
        const saved = localStorage.getItem('enviro_last_backup')
        if (saved) {
          try {
            const last = JSON.parse(saved)
            const lastDate = new Date(last.date).toDateString()
            if (lastDate === now.toDateString()) return
          } catch {}
        }
        setShowBackupAlert(true)
      } else {
        setShowBackupAlert(false)
      }
    }
    checkBackup()
    const interval = setInterval(checkBackup, 60000)
    return () => clearInterval(interval)
  }, [dismissed])

  function dismissBackup() {
    setShowBackupAlert(false)
    setDismissed(true)
  }

  const visibleLinks = links.filter(l => l.roles.includes(profile?.role))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Bannière rappel sauvegarde */}
      {showBackupAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#d97706', color: '#fff',
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '13px', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,.2)'
        }}>
          <span>💾 Rappel sauvegarde — Mercredi ou Vendredi : pensez à télécharger la sauvegarde EnviroControl</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { navigate('/backup'); dismissBackup() }}
              style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
                padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Sauvegarder →
            </button>
            <button onClick={dismissBackup}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)',
                cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
          </div>
        </div>
      )}

      <aside className="w-56 shrink-0 min-h-screen flex flex-col bg-navy dark:bg-gray-900 border-r border-navy-light dark:border-gray-800">
        {/* Logo */}
        <div className="p-5 border-b border-navy-light dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-brand rounded-lg p-2">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div>
              <div className="text-white font-extrabold text-sm leading-tight">EnviroControl</div>
              <div className="text-blue-300 text-[10px] tracking-wider">MICROBIOLOGIE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
               ${isActive
                 ? 'bg-brand text-white'
                 : 'text-blue-200 hover:bg-navy-light hover:text-white dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'}`
            }>
              <Icon size={16} />
              <span>{label}</span>
              {label === 'Alertes' && alertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-navy-light dark:border-gray-800 space-y-1">
          <div className="px-3 py-2">
            <div className="text-white text-xs font-semibold truncate">{profile?.full_name}</div>
            <div className="text-blue-300 text-[10px] capitalize">{profile?.role}</div>
          </div>
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-navy-light text-sm transition-colors">
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-red-500/20 hover:text-red-300 text-sm transition-colors">
            <LogOut size={15} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}
