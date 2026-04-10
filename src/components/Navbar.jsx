import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { LayoutDashboard, Settings, ClipboardList, Save, Sun, Moon, LogOut, FlaskConical } from 'lucide-react'

const BLOCS = [
  {
    id: 'env',
    label: 'Environnement',
    icon: '🔬',
    color: '#7c3aed',
    roles: ['admin','operateur','lecteur'],
    links: [
      { to: '/saisie2026',  label: 'Saisie 2026',    roles: ['admin','operateur'] },
      { to: '/tendances',   label: 'Tendances',       roles: ['admin','operateur','lecteur'] },
      { to: '/points',      label: 'Points / Salles', roles: ['admin','operateur','lecteur'] },
      { to: '/alertes',     label: 'Alertes',         roles: ['admin','operateur','lecteur'], badge: true },
    ]
  },
  {
    id: 'eaux',
    label: 'Eaux',
    icon: '💧',
    color: '#0284c7',
    roles: ['admin','operateur','lecteur'],
    links: [
      { to: '/saisie-eaux',      label: 'Saisie eaux',       roles: ['admin','operateur'] },
      { to: '/liste-eaux',       label: 'Liste des données', roles: ['admin','operateur','lecteur'] },
      { to: '/tendances-eaux',   label: 'Tendances eaux',    roles: ['admin','operateur','lecteur'] },
      { to: '/alertes-eaux',     label: 'Alertes eaux',      roles: ['admin','operateur','lecteur'], badge: true },
    ]
  },
  {
    id: 'personnel',
    label: 'Personnel',
    icon: '🧤',
    color: '#0d9488',
    roles: ['admin','operateur','lecteur'],
    links: [
      { to: '/saisie-personnel',    label: 'Saisie personnel',    roles: ['admin','operateur'] },
      { to: '/personnel',           label: 'Analyse personnel',   roles: ['admin','operateur','lecteur'] },
      { to: '/alertes-personnel',   label: 'Alertes personnel',   roles: ['admin','operateur','lecteur'] },
    ]
  },
]

const BOTTOM_LINKS = [
  { to: '/admin',   label: 'Administration', icon: Settings,      roles: ['admin'] },
  { to: '/backup',  label: 'Sauvegarde',     icon: Save,          roles: ['admin'] },
  { to: '/audit',   label: 'Audit Trail',    icon: ClipboardList, roles: ['admin'] },
]

function useBackupAlert() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    function check() {
      const now = new Date()
      const day = now.getDay()
      const h = now.getHours(), m = now.getMinutes()
      if ((day === 3 || day === 5) && (h > 16 || (h === 16 && m >= 45)) && h < 18 && !dismissed) {
        const saved = localStorage.getItem('enviro_last_backup')
        if (saved) {
          try { if (new Date(JSON.parse(saved).date).toDateString() === now.toDateString()) return } catch {}
        }
        setShow(true)
      } else { setShow(false) }
    }
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [dismissed])
  return { show, dismiss: () => { setShow(false); setDismissed(true) } }
}

export default function Navbar({ alertCount = 0 }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { show: showBackupAlert, dismiss: dismissBackup } = useBackupAlert()

  // Déterminer quel bloc est actif selon la route courante
  function getBlocActif() {
    const path = location.pathname
    if (['/saisie2026','/tendances','/points','/alertes'].some(p => path.startsWith(p))) return 'env'
    if (['/saisie-eaux','/tendances-eaux','/alertes-eaux'].some(p => path.startsWith(p))) return 'eaux'
    if (['/saisie-personnel','/personnel','/alertes-personnel'].some(p => path.startsWith(p))) return 'personnel'
    return null
  }

  const [openBlocs, setOpenBlocs] = useState(() => {
    const actif = getBlocActif()
    return { env: actif === 'env' || actif === null, eaux: actif === 'eaux', personnel: actif === 'personnel' }
  })

  // Ouvrir automatiquement le bloc de la route active
  useEffect(() => {
    const actif = getBlocActif()
    if (actif) setOpenBlocs(prev => ({ ...prev, [actif]: true }))
  }, [location.pathname])

  function toggleBloc(id) {
    setOpenBlocs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initiales = profile?.full_name
    ?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'

  return (
    <>
      {/* Bannière backup */}
      {showBackupAlert && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:9999,
          background:'#d97706', color:'#fff',
          padding:'10px 20px', display:'flex', alignItems:'center',
          justifyContent:'space-between', fontSize:'13px', fontWeight:600,
          boxShadow:'0 2px 8px rgba(0,0,0,.2)'
        }}>
          <span>💾 Rappel sauvegarde — Mercredi ou Vendredi : pensez à télécharger la sauvegarde</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { navigate('/backup'); dismissBackup() }}
              style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:12 }}>
              Sauvegarder →
            </button>
            <button onClick={dismissBackup}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,.7)',
                cursor:'pointer', fontSize:16, padding:'0 4px' }}>✕</button>
          </div>
        </div>
      )}

      <aside className="w-56 shrink-0 min-h-screen flex flex-col bg-navy dark:bg-gray-900 border-r border-navy-light dark:border-gray-800">

        {/* Logo */}
        <div className="p-4 border-b border-navy-light dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-brand rounded-lg p-2">
              <FlaskConical size={18} className="text-white"/>
            </div>
            <div>
              <div className="text-white font-extrabold text-sm leading-tight">EnviroControl</div>
              <div className="text-blue-300 text-[9px] tracking-widest">MICROBIOLOGIE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto space-y-0.5">

          {/* Dashboard */}
          <NavLink to="/" end className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
             ${isActive ? 'bg-brand text-white' : 'text-blue-200 hover:bg-navy-light hover:text-white dark:text-gray-400 dark:hover:bg-gray-800'}`
          }>
            <LayoutDashboard size={15}/>
            <span>Dashboard</span>
          </NavLink>

          <div className="border-t border-navy-light dark:border-gray-800 my-1.5"/>

          {/* Blocs */}
          {BLOCS.map(bloc => {
            if (!bloc.roles.includes(profile?.role)) return null
            const visibleLinks = bloc.links.filter(l => l.roles.includes(profile?.role))
            if (!visibleLinks.length) return null
            const isOpen = openBlocs[bloc.id]
            const blocAlertCount = bloc.id === 'env' ? alertCount : 0

            return (
              <div key={bloc.id} className="rounded-lg overflow-hidden">
                {/* En-tête bloc */}
                <button onClick={() => toggleBloc(bloc.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
                    ${isOpen ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center text-xs"
                      style={{ background: `${bloc.color}33` }}>
                      {bloc.icon}
                    </div>
                    <span className="text-sm font-semibold text-white/90">{bloc.label}</span>
                    {blocAlertCount > 0 && (
                      <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                        {blocAlertCount}
                      </span>
                    )}
                  </div>
                  <span className="text-white/30 text-[10px] transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                </button>

                {/* Liens du bloc */}
                {isOpen && (
                  <div className="mt-0.5 ml-2 pl-2 border-l border-white/10 space-y-0.5 pb-1">
                    {visibleLinks.map(link => (
                      <NavLink key={link.to} to={link.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                           ${isActive
                             ? 'text-white font-semibold'
                             : 'text-blue-200/70 hover:text-white hover:bg-white/5 dark:text-gray-500 dark:hover:text-white'}`
                        }>
                        {({ isActive }) => (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                              style={{ background: isActive ? bloc.color : 'rgba(255,255,255,0.2)' }}/>
                            <span>{link.label}</span>
                            {link.badge && alertCount > 0 && (
                              <span className="ml-auto text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                {alertCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="border-t border-navy-light dark:border-gray-800 my-1.5"/>

          {/* Liens bas */}
          {BOTTOM_LINKS.map(({ to, label, icon: Icon, roles }) => {
            if (!roles.includes(profile?.role)) return null
            return (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? 'bg-brand text-white' : 'text-blue-200 hover:bg-navy-light hover:text-white dark:text-gray-400 dark:hover:bg-gray-800'}`
              }>
                <Icon size={14}/>
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-navy-light dark:border-gray-800 space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-brand/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initiales}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{profile?.full_name}</div>
              <div className="text-blue-300 text-[10px] capitalize">{profile?.role}</div>
            </div>
          </div>
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-blue-200 hover:bg-navy-light text-xs transition-colors">
            {theme === 'light' ? <Moon size={13}/> : <Sun size={13}/>}
            <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-blue-200 hover:bg-red-500/20 hover:text-red-300 text-xs transition-colors">
            <LogOut size={13}/>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}
