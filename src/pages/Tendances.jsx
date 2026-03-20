import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { fullStats, interpretSeries } from '@/lib/statsUtils'
import ChartInterpretation from '@/components/ChartInterpretation'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const TYPES = ['ACTIF','PASSIF','SURFACE']
const TYPE_LABELS = { ACTIF:'🌬️ Actif (air)', PASSIF:'📦 Passif (boîtes)', SURFACE:'🧴 Surfaces' }

const TRIMESTRES = {
  T1: ['2025-01-01','2025-03-31'],
  T2: ['2025-04-01','2025-06-30'],
  T3: ['2025-07-01','2025-09-30'],
  T4: ['2025-10-01','2025-12-31'],
}

function StatRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-bold text-gray-800 dark:text-white ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

async function loadAllControles(zoneCode, filtres) {
  let all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    let q = supabase
      .from('controles')
      .select('date_controle, type_controle, point, germes, classe, zones(code,label,classe,icon,color)')
      .eq('zones.code', zoneCode)
      .order('date_controle', { ascending: true })
      .range(from, from + pageSize - 1)

    if (filtres.trimestre !== 'ALL' && TRIMESTRES[filtres.trimestre]) {
      q = q.gte('date_controle', TRIMESTRES[filtres.trimestre][0])
           .lte('date_controle', TRIMESTRES[filtres.trimestre][1])
    } else {
      if (filtres.dateDebut) q = q.gte('date_controle', filtres.dateDebut)
      if (filtres.dateFin)   q = q.lte('date_controle', filtres.dateFin)
    }
    if (filtres.classe !== 'ALL') q = q.eq('classe', filtres.classe)
    if (filtres.point) q = q.ilike('point', `%${filtres.point}%`)

    const { data, error } = await q
    if (error || !data || data.length === 0) break
    // Filtrer côté client car .eq('zones.code') ne fonctionne pas toujours via FK
    const filtered = data.filter(c => c.zones?.code === zoneCode)
    all = [...all, ...filtered]
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export default function Tendances() {
  const [controles, setControles] = useState([])
  const [zones, setZones] = useState([])
  const [normes, setNormes] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingControles, setLoadingControles] = useState(false)

  // Filtres
  const [filtreType, setFiltreType] = useState('ALL')   // ALL = tous les types affichés
  const [filtreClasse, setFiltreClasse] = useState('ALL')
  const [filtrePoint, setFiltrePoint] = useState('')
  const [filtreTrimestre, setFiltreTrimestre] = useState('ALL')
  const [filtreMode, setFiltreMode] = useState('trimestre') // 'trimestre' | 'dates'
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  // Charger zones et normes
  useEffect(() => {
    async function load() {
      const [z, n] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setZones(z.data || [])
      setNormes(n.data || [])
      if (z.data?.length) setSelectedZone(z.data[0].code)
      setLoading(false)
    }
    load()
  }, [])

  // Charger les contrôles quand zone ou filtres changent
  useEffect(() => {
    if (!selectedZone) return
    setLoadingControles(true)
    const filtres = {
      trimestre: filtreMode === 'trimestre' ? filtreTrimestre : 'ALL',
      dateDebut: filtreMode === 'dates' ? dateDebut : '',
      dateFin: filtreMode === 'dates' ? dateFin : '',
      classe: filtreClasse,
      point: filtrePoint,
    }
    loadAllControles(selectedZone, filtres).then(data => {
      setControles(data)
      setLoadingControles(false)
    })
  }, [selectedZone, filtreTrimestre, filtreMode, dateDebut, dateFin, filtreClasse, filtrePoint])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => {
      // clé avec classe pour zones multi-classes (ex: LABO_MICRO)
      map[`${n.zones?.code}_${n.type_controle}`] = n          // fallback sans classe
      if (n.classe) map[`${n.zones?.code}_${n.classe}_${n.type_controle}`] = n
    })
    return map
  }, [normes])

  // Norme applicable selon classe filtrée
  function getNorme(type) {
    if (filtreClasse !== 'ALL')
      return normesMap[`${selectedZone}_${filtreClasse}_${type}`] || normesMap[`${selectedZone}_${type}`]
    return normesMap[`${selectedZone}_${type}`]
  }

  // Types à afficher (filtrés si filtreType !== ALL)
  const typesAffiches = filtreType === 'ALL' ? TYPES : [filtreType]

  const chartDataByType = useMemo(() => {
    const result = {}
    TYPES.forEach(type => {
      const filtered = controles.filter(c => c.type_controle === type)
      const map = {}
      filtered.forEach(c => {
        const d = new Date(c.date_controle)
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
        if (!map[key]) map[key] = { mois: MOIS[d.getMonth()], values: [], key }
        map[key].values.push(c.germes)
      })
      result[type] = Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({
          mois: v.mois,
          moy: +(v.values.reduce((s,x) => s+x, 0) / v.values.length).toFixed(2),
          max: Math.max(...v.values),
          n: v.values.length,
        }))
    })
    return result
  }, [controles])

  const statsAndInterpret = useMemo(() => {
    const result = {}
    TYPES.forEach(type => {
      const n = filtreClasse !== 'ALL'
        ? normesMap[`${selectedZone}_${filtreClasse}_${type}`] || normesMap[`${selectedZone}_${type}`]
        : normesMap[`${selectedZone}_${type}`]
      const values = controles.filter(c => c.type_controle === type).map(c => c.germes)
      if (!values.length || !n) return
      result[type] = {
        stats: fullStats(values, n.alerte, n.action),
        interpretation: interpretSeries(values, n.alerte, n.action),
        normes: n,
      }
    })
    return result
  }, [controles, selectedZone, normesMap, filtreClasse])

  const selectedZoneObj = zones.find(z => z.code === selectedZone)

  function handleTrimestreClick(t) {
    setFiltreMode('trimestre')
    setFiltreTrimestre(t)
  }
  function handleDateChange(field, val) {
    setFiltreMode('dates')
    setFiltreTrimestre('ALL')
    if (field === 'debut') setDateDebut(val)
    else setDateFin(val)
  }
  function resetFiltres() {
    setFiltreType('ALL'); setFiltreClasse('ALL'); setFiltrePoint('')
    setFiltreTrimestre('ALL'); setFiltreMode('trimestre'); setDateDebut(''); setDateFin('')
  }

  // Classes disponibles dans les contrôles chargés
  const classesDispos = useMemo(() =>
    [...new Set(controles.map(c => c.classe).filter(Boolean))].sort()
  , [controles])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tendances</h1>
        <p className="text-gray-500 text-sm mt-1">Analyse statistique par zone — {controles.length} mesures chargées</p>
      </div>

      {/* Sélecteur de zone */}
      <div className="flex gap-2 flex-wrap">
        {zones.map(z => (
          <button key={z.code} onClick={() => setSelectedZone(z.code)}
            style={{ borderColor: selectedZone === z.code ? z.color : 'transparent', background: selectedZone === z.code ? z.color : undefined }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selectedZone === z.code ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔍 Filtres</span>
          <button onClick={resetFiltres} className="text-xs text-brand hover:underline">Réinitialiser</button>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Période */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t => (
                <button key={t} onClick={() => handleTrimestreClick(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtreMode === 'trimestre' && filtreTrimestre === t
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}>{t === 'ALL' ? 'Toute l\'année' : t}</button>
              ))}
            </div>
          </div>
          {/* Dates libres */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
              <input type="date" value={dateDebut} onChange={e => handleDateChange('debut', e.target.value)} className="input py-1.5 text-sm w-36" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
              <input type="date" value={dateFin} onChange={e => handleDateChange('fin', e.target.value)} className="input py-1.5 text-sm w-36" />
            </div>
          </div>
          {/* Type */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ALL">Tous les types</option>
              <option value="ACTIF">🌬️ Actif</option>
              <option value="PASSIF">📦 Passif</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>
          {/* Classe — toujours visible */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Classe</label>
            <select value={filtreClasse} onChange={e => { setFiltreClasse(e.target.value) }} className="input py-1.5 text-sm w-28">
              <option value="ALL">Toutes</option>
              {['A','B','C','D'].map(c => <option key={c} value={c}>Classe {c}</option>)}
            </select>
            {filtreClasse !== 'ALL' && <div className="text-[9px] text-brand mt-0.5">{controles.filter(c=>c.classe===filtreClasse).length} mesures</div>}
          </div>
          {/* Point */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Point</label>
            <input type="text" placeholder="ex: A1, S3..." value={filtrePoint}
              onChange={e => setFiltrePoint(e.target.value)} className="input py-1.5 text-sm w-28" />
          </div>
        </div>
        {loadingControles && <div className="text-xs text-brand animate-pulse">Chargement des données...</div>}
      </div>

      {/* Graphiques par type */}
      {!loadingControles && typesAffiches.map(type => {
        const data = chartDataByType[type] || []
        const sa = statsAndInterpret[type]
        if (!sa) return null
        const { stats, interpretation, normes: n } = sa

        return (
          <div key={type} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 dark:text-white text-lg">{TYPE_LABELS[type]}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{stats.n} mesures</span>
                <span className="text-xs text-gray-400 font-mono">{n.unite}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Chart */}
              <div className="col-span-2">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`g${type}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedZoneObj?.color || '#1d6fa4'} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={selectedZoneObj?.color || '#1d6fa4'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                    <XAxis dataKey="mois" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v, name) => [v, name === 'moy' ? 'Moy. UFC' : 'Max UFC']}/>
                    <ReferenceLine y={n.alerte} stroke="#d97706" strokeDasharray="4 4" label={{ value:'Alerte', fill:'#d97706', fontSize:9, position:'right' }}/>
                    <ReferenceLine y={n.action} stroke="#dc2626" strokeDasharray="4 4" label={{ value:'Action', fill:'#dc2626', fontSize:9, position:'right' }}/>
                    <Area type="monotone" dataKey="moy" name="moy" stroke={selectedZoneObj?.color || '#1d6fa4'} strokeWidth={2.5} fill={`url(#g${type})`} dot={{ r: 4 }} connectNulls/>
                    <Area type="monotone" dataKey="max" name="max" stroke="#dc2626" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls/>
                  </AreaChart>
                </ResponsiveContainer>
                <ChartInterpretation interpretation={interpretation} />
              </div>

              {/* Stats */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Statistiques</div>
                <StatRow label="N mesures"  value={stats.n} mono />
                <StatRow label="Moyenne"    value={stats.mean.toFixed(2)} mono />
                <StatRow label="Médiane"    value={stats.median.toFixed(2)} mono />
                <StatRow label="Écart-type" value={stats.stdDev.toFixed(2)} mono />
                <StatRow label="Min / Max"  value={`${stats.min} / ${stats.max}`} mono />
                <StatRow label="P95"        value={stats.p95.toFixed(2)} mono />
                <StatRow label="Cp"         value={stats.cp?.toFixed(2) ?? '—'} mono />
                <StatRow label="Cpk"        value={stats.cpk?.toFixed(2) ?? '—'} mono />
                <StatRow label="% > alerte" value={`${stats.pctAlerte.toFixed(1)}%`} mono />
                <StatRow label="% > action" value={`${stats.pctAction.toFixed(1)}%`} mono />
              </div>
            </div>
          </div>
        )
      })}

      {!loadingControles && controles.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          Aucune donnée pour cette sélection.
        </div>
      )}
    </div>
  )
}
