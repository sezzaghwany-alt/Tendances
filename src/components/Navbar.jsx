import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { LayoutDashboard, TrendingUp, AlertTriangle, PenLine, ClipboardList, Settings, Sun, Moon, LogOut, FlaskConical } from 'lucide-react'

const links = [
  { to: '/',          label: 'Dashboard',    icon: LayoutDashboard,  roles: ['admin','operateur','lecteur'] },
  { to: '/tendances', label: 'Tendances',     icon: TrendingUp,       roles: ['admin','operateur','lecteur'] },
  { to: '/points',          label: 'Points/Salles',    icon: TrendingUp, roles: ['admin','operateur','lecteur'] },
  { to: '/saisie2026',        label: '✏️ Saisie 2026',       icon: TrendingUp, roles: ['admin','operateur'] },
  { to: '/saisie-personnel',  label: '🧤 Saisie Personnel',  icon: TrendingUp, roles: ['admin','operateur'] },
  { to: '/personnel', label: 'Personnel',     icon: TrendingUp,       roles: ['admin','operateur','lecteur'] },
  { to: '/alertes',   label: 'Alertes',       icon: AlertTriangle,    roles: ['admin','operateur','lecteur'] },
  { to: '/saisie',    label: 'Saisie',        icon: PenLine,          roles: ['admin','operateur'] },
  { to: '/audit',     label: 'Audit Trail',   icon: ClipboardList,    roles: ['admin'] },
  { to: '/admin',     label: 'Administration',icon: Settings,         roles: ['admin'] },
]

export default function Navbar({ alertCount = 0 }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const visibleLinks = links.filter(l => l.roles.includes(profile?.role))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
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
        {/* User info */}
        <div className="px-3 py-2">
          <div className="text-white text-xs font-semibold truncate">{profile?.full_name}</div>
          <div className="text-blue-300 text-[10px] capitalize">{profile?.role}</div>
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-navy-light text-sm transition-colors">
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
        </button>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-200 hover:bg-red-500/20 hover:text-red-300 text-sm transition-colors">
          <LogOut size={15} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
