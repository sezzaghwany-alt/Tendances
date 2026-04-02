import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import StatCard from '@/components/StatCard'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const CLASSES = ['A','B','C','D']
const ANNEES = [2025, 2026, 2027]

// ── Icônes personnalisées par zone ──────────────────────────────────────────
const ZONE_ICONS = {
  LABO_MICRO:  { type:'emoji', val:'🧫' },
  PREPARATION: { type:'img',   val:'/icon_poches.webp' },
  PRELEVEMENT: { type:'img',   val:'/icon_prelevement.png' },
  CARTOUCHE:   { type:'emoji', val:'🫙' },
  DIALYSE:     { type:'img',   val:'/icon_dialyse.webp' },
}

// Zones à fusionner sous "Préparation Poches Stériles"
const ZONES_POCHES = ['PREPARATION','REMPLISSAGE','PREP_REMPL']

function ZoneIcon({ code, size = 28 }) {
  const cfg = ZONE_ICONS[code]
  if (!cfg) return <span style={{ fontSize: size }}>🏭</span>
  if (cfg.type === 'img') return (
    <img src={cfg.val} alt={code} style={{ width: size, height: size, objectFit:'contain' }}/>
  )
  return <span style={{ fontSize: size }}>{cfg.val}</span>
}

function getStatut(germes, normes) {
  if (!normes) return 'C'
  if (normes.norme  > 0 && germes >= normes.norme)  return 'NC'
  if (normes.action > 0 && germes >= normes.action) return 'NC_ACTION'
  if (normes.alerte > 0 && germes >= normes.alerte) return 'NC_ALERTE'
  return 'C'
}

// Taux de conformité : conforme = germes strictement < alerte
// NC alerte = alerte <= germes < action
// NC action = action <= germes < norme
// NC = germes >= norme

function getTrimestreRange(t, annee) {
  const a = annee || new Date().getFullYear()
  const ranges = {
    'T1': [`${a}-01-01`, `${a}-03-31`],
    'T2': [`${a}-04-01`, `${a}-06-30`],
    'T3': [`${a}-07-01`, `${a}-09-30`],
    'T4': [`${a}-10-01`, `${a}-12-31`],
  }
  return ranges[t] || null
}

export default function Dashboard() {
  const [zones,    setZones]    = useState([])
  const [normes,   setNormes]   = useState([])
  const [controles,setControles]= useState([])
  const [loading,  setLoading]  = useState(true)

  const [annee,           setAnnee]           = useState(2025)  // Démarrer sur 2025
  const [filtreZone,      setFiltreZone]      = useState('ALL')
  const [filtreClasse,    setFiltreClasse]    = useState('ALL')
  const [filtreType,      setFiltreType]      = useState('ALL')
  const [filtreTrimestre, setFiltreTrimestre] = useState('ALL')
  const [dateDebut,       setDateDebut]       = useState('')
  const [dateFin,         setDateFin]         = useState('')

  const filtreRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [z, n] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setZones(z.data || [])
      setNormes(n.data || [])

      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('controles')
          .select('id, date_controle, zone_id, type_controle, point, germes, classe, zones(code,label,classe,icon,color)')
          .order('date_controle', { ascending: false })
          .range(from, from + 999)
        if (error || !data?.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      setControles(all)
      setLoading(false)
    }
    load()
  }, [])

  // Reset trimestre quand année change
  useEffect(() => {
    if (filtreTrimestre !== 'ALL' && filtreTrimestre !== 'CUSTOM') {
      const range = getTrimestreRange(filtreTrimestre, annee)
      if (range) { setDateDebut(range[0]); setDateFin(range[1]) }
    }
  }, [annee])

  function handleTrimestreChange(t) {
    setFiltreTrimestre(t)
    if (t === 'ALL') { setDateDebut(''); setDateFin('') }
    else {
      const range = getTrimestreRange(t, annee)
      if (range) { setDateDebut(range[0]); setDateFin(range[1]) }
    }
  }

  function handleAnneeChange(a) {
    setAnnee(a)
    setFiltreTrimestre('ALL')
    setDateDebut('')
    setDateFin('')
  }

  function handleDateChange(field, val) {
    if (field === 'debut') setDateDebut(val)
    else setDateFin(val)
    setFiltreTrimestre('CUSTOM')
  }

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => {
      const code = n.zones?.code
      if (!code) return
      // Clé principale : zone_code + type
      const key = `${code}_${n.type_controle}`
      if (!map[key]) map[key] = n
      // Clé avec classe
      if (n.classe) map[`${code}_${n.type_controle}_${n.classe}`] = n
    })
    return map
  }, [normes])

  function getNormes(zoneCode, typeControle, classe) {
    return normesMap[`${zoneCode}_${typeControle}_${classe}`]
        || normesMap[`${zoneCode}_${typeControle}`]
        || null
  }

  const enriched = useMemo(() =>
    controles.map(c => ({
      ...c,
      zoneGroupCode: ZONES_POCHES.includes(c.zones?.code) ? 'PREPARATION' : c.zones?.code,
      statut: getStatut(
        c.germes,
        getNormes(c.zones?.code, c.type_controle, c.classe)
      ),
    }))
  , [controles, normesMap])

  // Filtre par année automatique si pas de date personnalisée
  const filtered = useMemo(() => enriched.filter(c => {
    // Filtrer par année sélectionnée (ou par dates personnalisées)
    const yr = c.date_controle?.slice(0, 4)
    if (dateDebut && c.date_controle < dateDebut) return false
    if (dateFin   && c.date_controle > dateFin)   return false
    if (!dateDebut && !dateFin && String(annee) !== yr) return false

    const codeZone = c.zoneGroupCode
    if (filtreZone !== 'ALL' && codeZone !== filtreZone) return false
    if (filtreClasse !== 'ALL' && c.classe !== filtreClasse) return false
    if (filtreType   !== 'ALL' && c.type_controle !== filtreType) return false
    return true
  }), [enriched, filtreZone, filtreClasse, filtreType, dateDebut, dateFin, annee])

  const totalNC      = filtered.filter(c => c.statut !== 'C').length
  const totalAction  = filtered.filter(c => c.statut === 'NC_ACTION').length
  const txConformite = filtered.length
    ? Math.round((filtered.filter(c => c.statut === 'C').length / filtered.length) * 100)
    : 100

  // ── Zones fusionnées pour les cartes ──────────────────────────────────────
  const zonesAffichees = useMemo(() => {
    const groupes = {}
    const pochesMerged = {
      code:  'PREPARATION',
      label: 'Préparation Poches Stériles',
      icon:  '💊',
      color: '#1d6fa4',
      isMerged: true,
    }

    zones.forEach(z => {
      if (ZONES_POCHES.includes(z.code)) {
        if (!groupes['PREPARATION']) groupes['PREPARATION'] = { ...pochesMerged, sourcesCodes: [...ZONES_POCHES] }
      } else {
        groupes[z.code] = { ...z, sourcesCodes: [z.code] }
      }
    })
    return Object.values(groupes)
  }, [zones])

  // ── Stats par zone fusionnée ───────────────────────────────────────────────
  const zoneStats = useMemo(() => {
    return zonesAffichees.map(z => {
      const zc = filtered.filter(c => z.sourcesCodes?.includes(c.zones?.code) || c.zoneGroupCode === z.code)

      // Regrouper par classe si multiple
      const classes = [...new Set(zc.map(c => c.classe).filter(Boolean))].sort()
      const parClasse = classes.map(cl => {
        const cc = zc.filter(c => c.classe === cl)
        return {
          classe: cl,
          total:     cc.length,
          conformes: cc.filter(c => c.statut === 'C').length,
          alertes:   cc.filter(c => c.statut === 'NC_ALERTE').length,
          actions:   cc.filter(c => c.statut === 'NC_ACTION').length,
          nc:        cc.filter(c => c.statut === 'NC').length,
        }
      })

      const total     = zc.length
      const conformes = zc.filter(c => c.statut === 'C').length
      const alertes   = zc.filter(c => c.statut === 'NC_ALERTE').length
      const actions   = zc.filter(c => c.statut === 'NC_ACTION').length
      const nc        = zc.filter(c => c.statut === 'NC').length
      const tx = total ? Math.round((conformes / total) * 100) : 100
      const statut = actions > 0 || nc > 0 ? 'NC_ACTION' : alertes > 0 ? 'NC_ALERTE' : 'C'

      return { ...z, total, conformes, alertes, actions, nc, tx, statut, parClasse, multiClasse: classes.length > 1 }
    })
  }, [zonesAffichees, filtered])

  const monthlyData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const m = new Date(c.date_controle).getMonth()
      if (!map[m]) map[m] = { mois: MOIS[m], ordre: m, Conformes: 0, Alertes: 0, Actions: 0 }
      if (c.statut === 'C') map[m].Conformes++
      else if (c.statut === 'NC_ALERTE') map[m].Alertes++
      else map[m].Actions++
    })
    return Object.values(map).sort((a, b) => a.ordre - b.ordre)
  }, [filtered])

  const badgeClass = s => s === 'NC_ACTION' || s === 'NC' ? 'badge-action' : s === 'NC_ALERTE' ? 'badge-alerte' : 'badge-ok'
  const badgeLabel = s => s === 'NC_ACTION' || s === 'NC' ? '⛔ Action' : s === 'NC_ALERTE' ? '⚠️ Alerte' : '✅ Conforme'

  const activeFilters = [
    filtreZone !== 'ALL', filtreClasse !== 'ALL', filtreType !== 'ALL',
    filtreTrimestre !== 'ALL'
  ].filter(Boolean).length

  function resetFilters() {
    setFiltreZone('ALL'); setFiltreClasse('ALL'); setFiltreType('ALL')
    setFiltreTrimestre('ALL'); setDateDebut(''); setDateFin('')
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
      <div className="text-sm text-gray-400">Chargement des données...</div>
    </div>
  )

  // Zones visibles dans le filtre (fusionnées)
  const zonesFiltreOptions = zonesAffichees

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tableau de bord</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {filtered.length} mesures · Environnement {annee}
          </p>
        </div>
        {activeFilters > 0 && (
          <button onClick={resetFilters} className="text-xs text-brand hover:underline mt-1">
            ✕ Réinitialiser les filtres ({activeFilters})
          </button>
        )}
      </div>

      {/* ── Filtres sticky ───────────────────────────────────────────────── */}
      <div ref={filtreRef} className="card p-4 space-y-3 sticky top-0 z-30" style={{ boxShadow:"0 2px 12px rgba(0,0,0,.08)", backdropFilter:"blur(8px)" }}>

        {/* Ligne 1 : Année + Zone + Classe + Type */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔍 Filtres</span>

          {/* Sélecteur année */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-semibold">Année</label>
            <div className="flex gap-1">
              {ANNEES.map(a => (
                <button key={a} onClick={() => handleAnneeChange(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    annee === a ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
                  }`}>{a}</button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"/>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold whitespace-nowrap">Zone</label>
            <select value={filtreZone} onChange={e => setFiltreZone(e.target.value)} className="input py-1.5 text-sm w-52">
              <option value="ALL">Toutes les zones</option>
              {zonesFiltreOptions.map(z => (
                <option key={z.code} value={z.code}>{z.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Classe</label>
            <select value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)} className="input py-1.5 text-sm w-32">
              <option value="ALL">Toutes</option>
              {CLASSES.map(c => <option key={c} value={c}>Classe {c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-32">
              <option value="ALL">Tous</option>
              <option value="ACTIF">Actif</option>
              <option value="PASSIF">Passif</option>
              <option value="SURFACE">Surface</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-gray-400 font-mono">{filtered.length} mesures</div>
        </div>

        {/* Ligne 2 : Trimestres + dates */}
        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">📅 Période</span>
          <div className="flex gap-1">
            {['ALL','T1','T2','T3','T4'].map(t => (
              <button key={t} onClick={() => handleTrimestreChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filtreTrimestre === t && t !== 'ALL'
                    ? 'bg-brand text-white'
                    : t === 'ALL' && filtreTrimestre === 'ALL'
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
                }`}>
                {t === 'ALL' ? `${annee}` : t}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">ou</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Du</label>
            <input type="date" value={dateDebut} onChange={e => handleDateChange('debut', e.target.value)} className="input py-1.5 text-sm w-36"/>
            <label className="text-xs text-gray-500 font-semibold">Au</label>
            <input type="date" value={dateFin} onChange={e => handleDateChange('fin', e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Mesures filtrées" value={filtered.length}          icon="📊"/>
        <StatCard label="Non-conformités"  value={totalNC}   color="text-red-500"   icon="🚨"/>
        <StatCard label="Dépass. action"   value={totalAction} color="text-red-600" icon="⛔"/>
        <StatCard label="Taux conformité"  value={`${txConformite}%`} color="text-green-600" icon="✅"/>
      </div>

      {/* ── Cartes zones environnement ───────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          🔬 Environnement
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {zoneStats
            .filter(z => filtreZone === 'ALL' || z.code === filtreZone)
            .filter(z => z.total > 0 || true)
            .map(z => (
            <div key={z.code} className="card p-5 border-l-4"
              style={{ borderLeftColor: z.actions > 0 || z.nc > 0 ? '#dc2626' : z.alertes > 0 ? '#d97706' : '#16a34a' }}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <ZoneIcon code={z.code} size={32}/>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{z.label}</div>
                    <div className="text-xs text-gray-400">
                      {z.multiClasse ? `Classes ${z.parClasse.map(p=>p.classe).join('+')}` : `Classe ${z.parClasse[0]?.classe || z.classe || '—'}`}
                    </div>
                  </div>
                </div>
                <span className={badgeClass(z.statut) + ' text-xs'}>{badgeLabel(z.statut)}</span>
              </div>

              {/* Multi-classe : détail par classe */}
              {z.multiClasse ? (
                <div className="space-y-1.5 mt-2">
                  {z.parClasse.map(cl => (
                    <div key={cl.classe} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-bold text-gray-500">Cl.{cl.classe}</span>
                      <div className="flex gap-3 text-xs font-mono">
                        <span className="text-green-600 font-bold">{cl.conformes}✓</span>
                        {cl.alertes > 0 && <span className="text-amber-500 font-bold">{cl.alertes}⚠</span>}
                        {(cl.actions + cl.nc) > 0 && <span className="text-red-600 font-bold">{cl.actions + cl.nc}⛔</span>}
                        <span className="text-gray-400">{cl.total > 0 ? Math.round(cl.conformes/cl.total*100) : 100}%</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">{z.total} mesures</span>
                    <span className="text-sm font-extrabold" style={{ color: z.tx >= 95 ? '#16a34a' : z.tx >= 80 ? '#d97706' : '#dc2626' }}>
                      {z.tx}%
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { v: z.conformes,        l:'Conformes', c:'text-green-600' },
                      { v: z.alertes,          l:'Alertes',   c:'text-amber-500' },
                      { v: z.actions + z.nc,   l:'Actions',   c:'text-red-600' },
                    ].map((s, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                        <div className={`font-extrabold font-mono text-lg ${s.c}`}>{s.v}</div>
                        <div className="text-[10px] text-gray-400 font-semibold">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">{z.total} mesures</span>
                    <span className="text-sm font-extrabold" style={{ color: z.tx >= 95 ? '#16a34a' : z.tx >= 80 ? '#d97706' : '#dc2626' }}>
                      {z.tx}%
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Eaux ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          💧 Eaux pharmaceutiques
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {['EA','EPU','EPPI'].map(type => (
            <div key={type} className="card p-5 border-l-4 border-l-blue-400">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">💧</span>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm">
                    {type === 'EA' ? 'Eau alimentation' : type === 'EPU' ? 'Eau purifiée' : 'Eau injectable'}
                  </div>
                  <div className="text-xs text-gray-400">{type}</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 italic">Données disponibles après saisie 2026</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Personnel ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          🧤 Personnel
        </h2>
        <PersonnelStats annee={annee}/>
      </div>

      {/* ── Graphique mensuel ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">
          📈 Évolution mensuelle — Environnement {annee}
          {activeFilters > 0 && <span className="ml-2 text-xs text-brand font-normal">(données filtrées)</span>}
        </h2>
        {monthlyData.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Aucune donnée pour {annee}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top:4, right:10, left:-20, bottom:0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
              <XAxis dataKey="mois" tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip/>
              <Legend wrapperStyle={{ fontSize:12 }}/>
              <Bar dataKey="Conformes" stackId="a" fill="#16a34a"/>
              <Bar dataKey="Alertes"   stackId="a" fill="#d97706"/>
              <Bar dataKey="Actions"   stackId="a" fill="#dc2626" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── Composant stats personnel ─────────────────────────────────────────────
function PersonnelStats({ annee }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const NORME = 5

  useEffect(() => {
    supabase.from('controles_personnel')
      .select('*')
      .gte('date_controle', `${annee}-01-01`)
      .lte('date_controle', `${annee}-12-31`)
      .then(({ data: d }) => {
        setData(d || [])
        setLoading(false)
      })
  }, [annee])

  if (loading) return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand"/>
  if (!data?.length) return (
    <div className="card p-5 border-l-4 border-l-teal-400">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧤</span>
        <div className="text-sm text-gray-400 italic">Aucune donnée personnel pour {annee}</div>
      </div>
    </div>
  )

  const total = data.length
  const nc = data.filter(d => d.germes >= NORME).length
  const conformes = total - nc
  const tx = Math.round((conformes / total) * 100)
  const positions = ['MD','MG','BD','BG','AVD','AVG']
  const pStats = positions.map(p => ({
    pos: p,
    nc: data.filter(d => d.position === p && d.germes >= NORME).length,
    total: data.filter(d => d.position === p).length,
  }))
  const worstPos = pStats.reduce((a, b) => b.nc > a.nc ? b : a, { pos:'—', nc:0 })

  return (
    <div className="card p-5 border-l-4" style={{ borderLeftColor: nc > 0 ? '#dc2626' : '#16a34a' }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🧤</span>
        <div>
          <div className="font-bold text-gray-900 dark:text-white">Empreintes gants</div>
          <div className="text-xs text-gray-400">Norme &lt;{NORME} UFC/boîte · {total} contrôles</div>
        </div>
        <div className="ml-auto text-2xl font-extrabold" style={{ color: tx >= 95 ? '#16a34a' : tx >= 80 ? '#d97706' : '#dc2626' }}>
          {tx}%
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {pStats.map(p => (
          <div key={p.pos} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-center">
            <div className="text-xs font-bold text-gray-500">{p.pos}</div>
            <div className={`font-extrabold font-mono text-sm ${p.nc > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {p.nc > 0 ? p.nc : '✓'}
            </div>
            <div className="text-[9px] text-gray-400">{p.nc > 0 ? 'NC' : 'OK'}</div>
          </div>
        ))}
      </div>
      {worstPos.nc > 0 && (
        <div className="mt-3 text-xs text-red-600 font-medium">
          Position la plus NC : {worstPos.pos} ({worstPos.nc} dépassements)
        </div>
      )}
    </div>
  )
}
