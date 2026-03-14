import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import StatCard from '@/components/StatCard'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const CLASSES = ['A','B','C','D']

function getTrimestreRange(t) {
  const ranges = {
    'T1': ['2025-01-01', '2025-03-31'],
    'T2': ['2025-04-01', '2025-06-30'],
    'T3': ['2025-07-01', '2025-09-30'],
    'T4': ['2025-10-01', '2025-12-31'],
  }
  return ranges[t] || null
}

function getStatut(germes, normes) {
  if (!normes) return 'C'
  if (germes >= normes.action) return 'NC_ACTION'
  if (germes >= normes.alerte) return 'NC_ALERTE'
  return 'C'
}

export default function Dashboard() {
  const [zones, setZones] = useState([])
  const [normes, setNormes] = useState([])
  const [controles, setControles] = useState([])   // pour tableau + graph
  const [derniers, setDerniers] = useState([])     // 15 derniers
  const [loading, setLoading] = useState(true)
  const [filtreZone, setFiltreZone] = useState('ALL')
  const [filtreClasse, setFiltreClasse] = useState('ALL')
  const [filtreType, setFiltreType] = useState('ALL')
  const [filtreTrimestre, setFiltreTrimestre] = useState('ALL')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  useEffect(() => {
    async function load() {
      // Charger zones, normes, et TOUS les contrôles sans limite
      const [z, n] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setZones(z.data || [])
      setNormes(n.data || [])

      // Charger TOUS les contrôles en plusieurs passes si nécessaire
      let allControles = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('controles')
          .select('id, date_controle, zone_id, type_controle, point, germes, classe, zones(code,label,classe,icon,color)')
          .order('date_controle', { ascending: false })
          .range(from, from + pageSize - 1)
        if (error || !data || data.length === 0) break
        allControles = [...allControles, ...data]
        if (data.length < pageSize) break
        from += pageSize
      }
      setControles(allControles)

      // 15 derniers avec opérateur
      const { data: d } = await supabase
        .from('controles')
        .select('*, zones(code,label,classe,icon,color), profiles(full_name)')
        .order('date_controle', { ascending: false })
        .limit(15)
      setDerniers(d || [])
      setLoading(false)
    }
    load()
  }, [])

  function handleTrimestreChange(t) {
    setFiltreTrimestre(t)
    if (t === 'ALL') { setDateDebut(''); setDateFin('') }
    else {
      const range = getTrimestreRange(t)
      if (range) { setDateDebut(range[0]); setDateFin(range[1]) }
    }
  }
  function handleDateChange(field, val) {
    if (field === 'debut') setDateDebut(val)
    else setDateFin(val)
    setFiltreTrimestre('CUSTOM')
  }

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => { map[`${n.zones?.code}_${n.type_controle}`] = n })
    return map
  }, [normes])

  const enriched = useMemo(() =>
    controles.map(c => ({
      ...c,
      statut: getStatut(c.germes, normesMap[`${c.zones?.code}_${c.type_controle}`])
    })), [controles, normesMap])

  const filtered = useMemo(() => enriched.filter(c => {
    if (filtreZone !== 'ALL' && c.zones?.code !== filtreZone) return false
    if (filtreClasse !== 'ALL' && c.classe !== filtreClasse) return false
    if (filtreType !== 'ALL' && c.type_controle !== filtreType) return false
    if (dateDebut && c.date_controle < dateDebut) return false
    if (dateFin && c.date_controle > dateFin) return false
    return true
  }), [enriched, filtreZone, filtreClasse, filtreType, dateDebut, dateFin])

  const totalNC = filtered.filter(c => c.statut !== 'C').length
  const totalAction = filtered.filter(c => c.statut === 'NC_ACTION').length
  const txConformite = filtered.length ? Math.round((filtered.filter(c => c.statut === 'C').length / filtered.length) * 100) : 100

  const zoneStats = useMemo(() => {
    const stats = []
    zones.forEach(z => {
      const zc = filtered.filter(c => c.zones?.code === z.code)
      const classes = [...new Set(zc.map(c => c.classe).filter(Boolean))].sort()
      if (classes.length <= 1) {
        const derniere = zc[0]
        stats.push({
          ...z,
          classeLabel: classes[0] || z.classe,
          total: zc.length,
          conformes: zc.filter(c => c.statut === 'C').length,
          alertes: zc.filter(c => c.statut === 'NC_ALERTE').length,
          actions: zc.filter(c => c.statut === 'NC_ACTION').length,
          dernierStatut: derniere ? getStatut(derniere.germes, normesMap[`${z.code}_${derniere.type_controle}`]) : 'C',
          key: z.code,
        })
      } else {
        classes.forEach(cl => {
          const cc = zc.filter(c => c.classe === cl)
          const derniere = cc[0]
          stats.push({
            ...z,
            classeLabel: cl,
            total: cc.length,
            conformes: cc.filter(c => c.statut === 'C').length,
            alertes: cc.filter(c => c.statut === 'NC_ALERTE').length,
            actions: cc.filter(c => c.statut === 'NC_ACTION').length,
            dernierStatut: derniere ? getStatut(derniere.germes, normesMap[`${z.code}_${derniere.type_controle}`]) : 'C',
            key: `${z.code}_${cl}`,
          })
        })
      }
    })
    return stats
  }, [zones, filtered, normesMap])

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

  const badgeClass = s => s === 'NC_ACTION' ? 'badge-action' : s === 'NC_ALERTE' ? 'badge-alerte' : 'badge-ok'
  const badgeLabel = s => s === 'NC_ACTION' ? '⛔ Action' : s === 'NC_ALERTE' ? '⚠️ Alerte' : '✅ Conforme'

  const activeFilters = [
    filtreZone !== 'ALL', filtreClasse !== 'ALL', filtreType !== 'ALL', dateDebut || dateFin
  ].filter(Boolean).length

  function resetFilters() {
    setFiltreZone('ALL'); setFiltreClasse('ALL'); setFiltreType('ALL')
    setFiltreTrimestre('ALL'); setDateDebut(''); setDateFin('')
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
      <div className="text-sm text-gray-400">Chargement de toutes les données...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tableau de bord</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {controles.length} mesures chargées — 2025
          </p>
        </div>
        {activeFilters > 0 && (
          <button onClick={resetFilters} className="text-xs text-brand hover:underline mt-1">
            ✕ Réinitialiser les filtres ({activeFilters})
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔍 Filtres</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold whitespace-nowrap">Zone</label>
            <select value={filtreZone} onChange={e => setFiltreZone(e.target.value)} className="input py-1.5 text-sm w-44">
              <option value="ALL">Toutes les zones</option>
              {zones.map(z => <option key={z.code} value={z.code}>{z.icon} {z.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Classe</label>
            <select value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ALL">Toutes classes</option>
              {CLASSES.map(c => <option key={c} value={c}>Classe {c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold whitespace-nowrap">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ALL">Tous les types</option>
              <option value="ACTIF">🌬️ Actif</option>
              <option value="PASSIF">📦 Passif</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-gray-400 font-mono">{filtered.length} / {enriched.length} mesures</div>
        </div>

        {/* Filtre temporel */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">📅 Période</span>
          <div className="flex gap-1.5">
            {['ALL','T1','T2','T3','T4'].map(t => (
              <button key={t} onClick={() => handleTrimestreChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filtreTrimestre === t && t !== 'ALL'
                    ? 'bg-brand text-white'
                    : t === 'ALL' && filtreTrimestre === 'ALL'
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>
                {t === 'ALL' ? "Toute l'année" : t}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">ou</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Du</label>
            <input type="date" value={dateDebut} onChange={e => handleDateChange('debut', e.target.value)} className="input py-1.5 text-sm w-36" />
            <label className="text-xs text-gray-500 font-semibold">Au</label>
            <input type="date" value={dateFin} onChange={e => handleDateChange('fin', e.target.value)} className="input py-1.5 text-sm w-36" />
          </div>
          {(dateDebut || dateFin) && (
            <span className="text-xs bg-brand/10 text-brand px-2 py-1 rounded-full font-medium">
              {dateDebut && dateFin ? `${dateDebut.split('-').reverse().join('/')} → ${dateFin.split('-').reverse().join('/')}` : dateDebut ? `Depuis ${dateDebut.split('-').reverse().join('/')}` : `Jusqu'au ${dateFin.split('-').reverse().join('/')}`}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Mesures filtrées" value={filtered.length} icon="📊" />
        <StatCard label="Non-conformités" value={totalNC} color="text-red-500" icon="🚨" />
        <StatCard label="Dépass. action" value={totalAction} color="text-red-600" icon="⛔" />
        <StatCard label="Taux conformité" value={`${txConformite}%`} color="text-green-600" icon="✅" />
      </div>

      {/* Zones */}
      <div className="grid grid-cols-3 gap-4">
        {zoneStats.filter(z => filtreZone === 'ALL' || z.code === filtreZone).map(z => (
          <div key={z.key} className="card p-5 border-l-4"
            style={{ borderLeftColor: z.actions > 0 ? '#dc2626' : z.alertes > 0 ? '#d97706' : '#16a34a' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-xl mb-0.5">{z.icon}</div>
                <div className="font-bold text-gray-900 dark:text-white">{z.label}</div>
                <div className="text-xs text-gray-400">Classe {z.classeLabel}</div>
              </div>
              <span className={badgeClass(z.dernierStatut)}>{badgeLabel(z.dernierStatut)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { v: z.conformes, l: 'Conformes', c: 'text-green-600' },
                { v: z.alertes,   l: 'Alertes',   c: 'text-yellow-600' },
                { v: z.actions,   l: 'Actions',   c: 'text-red-600' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                  <div className={`font-extrabold font-mono text-lg ${s.c}`}>{s.v}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Graphique mensuel */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">
          📈 Évolution mensuelle
          {activeFilters > 0 && <span className="ml-2 text-xs text-brand font-normal">(données filtrées)</span>}
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Conformes" stackId="a" fill="#16a34a" />
            <Bar dataKey="Alertes"   stackId="a" fill="#d97706" />
            <Bar dataKey="Actions"   stackId="a" fill="#dc2626" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Derniers contrôles */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">🕐 Derniers contrôles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100 dark:border-gray-800">
                {['Zone','Date','Type','Point','UFC','Statut'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {derniers.map(c => {
                const statut = getStatut(c.germes, normesMap[`${c.zones?.code}_${c.type_controle}`])
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 pr-4 whitespace-nowrap">{c.zones?.icon} {c.zones?.label}</td>
                    <td className="py-2 pr-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {c.date_controle ? c.date_controle.split('-').reverse().join('/') : ''}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{c.type_controle}</td>
                    <td className="py-2 pr-4 font-mono">{c.point}</td>
                    <td className="py-2 pr-4 font-mono font-bold">{c.germes}</td>
                    <td className="py-2 whitespace-nowrap"><span className={badgeClass(statut)}>{badgeLabel(statut)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
