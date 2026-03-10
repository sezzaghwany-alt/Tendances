import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import StatCard from '@/components/StatCard'

function getStatut(germes, normes) {
  if (!normes) return 'C'
  if (germes >= normes.action) return 'NC_ACTION'
  if (germes >= normes.alerte) return 'NC_ALERTE'
  return 'C'
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default function Dashboard() {
  const [controles, setControles] = useState([])
  const [zones, setZones] = useState([])
  const [normes, setNormes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c, z, n] = await Promise.all([
        supabase.from('controles').select('*, zones(code,label,classe,icon,color)').order('date_controle', { ascending: false }).limit(5000),
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setControles(c.data || [])
      setZones(z.data || [])
      setNormes(n.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => {
      const key = `${n.zones?.code}_${n.type_controle}`
      map[key] = n
    })
    return map
  }, [normes])

  const enriched = useMemo(() =>
    controles.map(c => ({
      ...c,
      statut: getStatut(c.germes, normesMap[`${c.zones?.code}_${c.type_controle}`])
    })), [controles, normesMap])

  const totalNC = enriched.filter(c => c.statut !== 'C').length
  const totalAction = enriched.filter(c => c.statut === 'NC_ACTION').length
  const txConformite = enriched.length ? Math.round((enriched.filter(c => c.statut === 'C').length / enriched.length) * 100) : 100

  const zoneStats = useMemo(() => zones.map(z => {
    const zc = enriched.filter(c => c.zones?.code === z.code)
    const derniere = zc[0]
    return {
      ...z,
      total: zc.length,
      conformes: zc.filter(c => c.statut === 'C').length,
      alertes: zc.filter(c => c.statut === 'NC_ALERTE').length,
      actions: zc.filter(c => c.statut === 'NC_ACTION').length,
      dernierStatut: derniere ? getStatut(derniere.germes, normesMap[`${z.code}_${derniere.type_controle}`]) : 'C',
    }
  }), [zones, enriched, normesMap])

  const monthlyData = useMemo(() => {
    const map = {}
    enriched.forEach(c => {
      const m = new Date(c.date_controle).getMonth()
      if (!map[m]) map[m] = { mois: MOIS[m], Conformes: 0, Alertes: 0, Actions: 0 }
      if (c.statut === 'C') map[m].Conformes++
      else if (c.statut === 'NC_ALERTE') map[m].Alertes++
      else map[m].Actions++
    })
    return Object.values(map)
  }, [enriched])

  const badgeClass = (s) => s === 'NC_ACTION' ? 'badge-action' : s === 'NC_ALERTE' ? 'badge-alerte' : 'badge-ok'
  const badgeLabel = (s) => s === 'NC_ACTION' ? '⛔ Action' : s === 'NC_ALERTE' ? '⚠️ Alerte' : '✅ Conforme'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tableau de bord</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Vue globale de toutes les zones — 2025</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Mesures totales" value={enriched.length} icon="📊" />
        <StatCard label="Non-conformités" value={totalNC} color="text-red-500" icon="🚨" />
        <StatCard label="Dépass. action" value={totalAction} color="text-red-600" icon="⛔" />
        <StatCard label="Taux conformité" value={`${txConformite}%`} color="text-green-600" icon="✅" />
      </div>

      {/* Zones */}
      <div className="grid grid-cols-3 gap-4">
        {zoneStats.map(z => (
          <div key={z.id} className={`card p-5 border-l-4`}
            style={{ borderLeftColor: z.actions > 0 ? '#dc2626' : z.alertes > 0 ? '#d97706' : '#16a34a' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-xl mb-0.5">{z.icon}</div>
                <div className="font-bold text-gray-900 dark:text-white">{z.label}</div>
                <div className="text-xs text-gray-400">Classe {z.classe}</div>
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
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">📈 Évolution mensuelle — Toutes zones</h2>
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
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">🕐 Derniers contrôles saisis</h2>
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
              {enriched.slice(0, 10).map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 pr-4">{c.zones?.icon} {c.zones?.label}</td>
                  <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{c.date_controle}</td>
                  <td className="py-2 pr-4">{c.type_controle}</td>
                  <td className="py-2 pr-4 font-mono">{c.point}</td>
                  <td className="py-2 pr-4 font-mono font-bold">{c.germes}</td>
                  <td className="py-2"><span className={badgeClass(c.statut)}>{badgeLabel(c.statut)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
