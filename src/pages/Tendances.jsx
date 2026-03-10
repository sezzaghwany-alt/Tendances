import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { fullStats, interpretSeries } from '@/lib/statsUtils'
import ChartInterpretation from '@/components/ChartInterpretation'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const TYPES = ['ACTIF','PASSIF','SURFACE']
const TYPE_LABELS = { ACTIF:'🌬️ Actif (air)', PASSIF:'📦 Passif (boîtes)', SURFACE:'🧴 Surfaces' }

function StatRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-bold text-gray-800 dark:text-white ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function Tendances() {
  const [controles, setControles] = useState([])
  const [zones, setZones] = useState([])
  const [normes, setNormes] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c, z, n] = await Promise.all([
        supabase.from('controles').select('*, zones(code,label,classe,icon,color)').order('date_controle'),
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setControles(c.data || [])
      setZones(z.data || [])
      setNormes(n.data || [])
      if (z.data?.length) setSelectedZone(z.data[0].code)
      setLoading(false)
    }
    load()
  }, [])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => { map[`${n.zones?.code}_${n.type_controle}`] = n })
    return map
  }, [normes])

  const chartDataByType = useMemo(() => {
    if (!selectedZone) return {}
    const zc = controles.filter(c => c.zones?.code === selectedZone)
    const result = {}
    TYPES.forEach(type => {
      const filtered = zc.filter(c => c.type_controle === type)
      const map = {}
      filtered.forEach(c => {
        const m = new Date(c.date_controle).getMonth()
        if (!map[m]) map[m] = { mois: MOIS[m], values: [] }
        map[m].values.push(c.germes)
      })
      result[type] = Object.entries(map)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, v]) => ({ mois: v.mois, moy: +(v.values.reduce((s,x)=>s+x,0)/v.values.length).toFixed(2) }))
    })
    return result
  }, [controles, selectedZone])

  const statsAndInterpret = useMemo(() => {
    if (!selectedZone) return {}
    const result = {}
    TYPES.forEach(type => {
      const key = `${selectedZone}_${type}`
      const n = normesMap[key]
      const values = controles
        .filter(c => c.zones?.code === selectedZone && c.type_controle === type)
        .map(c => c.germes)
      if (!values.length || !n) return
      result[type] = {
        stats: fullStats(values, n.alerte, n.action),
        interpretation: interpretSeries(values, n.alerte, n.action),
        normes: n,
      }
    })
    return result
  }, [controles, selectedZone, normesMap])

  const selectedZoneObj = zones.find(z => z.code === selectedZone)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tendances</h1>
        <p className="text-gray-500 text-sm mt-1">Analyse statistique et interprétation automatique par zone</p>
      </div>

      {/* Zone selector */}
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

      {/* Charts per type */}
      {TYPES.map(type => {
        const data = chartDataByType[type] || []
        const sa = statsAndInterpret[type]
        if (!sa) return null
        const { stats, interpretation, normes: n } = sa

        return (
          <div key={type} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 dark:text-white">{TYPE_LABELS[type]}</h2>
              <span className="text-xs text-gray-400 font-mono">{n.unite}</span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Chart */}
              <div className="col-span-2">
                <ResponsiveContainer width="100%" height={180}>
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
                    <Tooltip/>
                    <ReferenceLine y={n.alerte} stroke="#d97706" strokeDasharray="4 4" label={{ value:'Alerte', fill:'#d97706', fontSize:9, position:'right' }}/>
                    <ReferenceLine y={n.action} stroke="#dc2626" strokeDasharray="4 4" label={{ value:'Action', fill:'#dc2626', fontSize:9, position:'right' }}/>
                    <Area type="monotone" dataKey="moy" name="Moy. UFC" stroke={selectedZoneObj?.color || '#1d6fa4'} strokeWidth={2.5} fill={`url(#g${type})`} dot={{ r: 4 }} connectNulls/>
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
    </div>
  )
}
