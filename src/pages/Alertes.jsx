import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AlertTriangle, Filter } from 'lucide-react'

function getStatut(germes, n) {
  if (!n) return 'C'
  if (germes >= n.action) return 'NC_ACTION'
  if (germes >= n.alerte) return 'NC_ALERTE'
  return 'C'
}

export default function Alertes() {
  const [controles, setControles] = useState([])
  const [normes, setNormes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL') // ALL | NC_ACTION | NC_ALERTE

  useEffect(() => {
    async function load() {
      const [c, n] = await Promise.all([
        supabase.from('controles').select('*, zones(code,label,icon), profiles(full_name)').order('date_controle', { ascending: false }),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setControles(c.data || [])
      setNormes(n.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => { map[`${n.zones?.code}_${n.type_controle}`] = n })
    return map
  }, [normes])

  const alertes = useMemo(() => {
    return controles
      .map(c => ({ ...c, statut: getStatut(c.germes, normesMap[`${c.zones?.code}_${c.type_controle}`]), normes: normesMap[`${c.zones?.code}_${c.type_controle}`] }))
      .filter(c => c.statut !== 'C')
      .filter(c => filter === 'ALL' || c.statut === filter)
      .sort((a, b) => {
        if (a.statut === 'NC_ACTION' && b.statut !== 'NC_ACTION') return -1
        if (b.statut === 'NC_ACTION' && a.statut !== 'NC_ACTION') return 1
        return b.date_controle.localeCompare(a.date_controle)
      })
  }, [controles, normesMap, filter])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Alertes & Non-conformités</h1>
          <p className="text-gray-500 text-sm mt-1">{alertes.length} non-conformité(s) détectée(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {['ALL','NC_ACTION','NC_ALERTE'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                ${filter === f
                  ? f === 'NC_ACTION' ? 'bg-red-500 text-white' : f === 'NC_ALERTE' ? 'bg-yellow-500 text-white' : 'bg-navy text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {f === 'ALL' ? 'Tout' : f === 'NC_ACTION' ? '⛔ Action' : '⚠️ Alerte'}
            </button>
          ))}
        </div>
      </div>

      {alertes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-green-600 font-bold text-lg">Aucune non-conformité</div>
          <div className="text-gray-400 text-sm mt-1">Tous les contrôles sont dans les limites acceptables.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alertes.map(c => (
            <div key={c.id} className={`card p-4 border-l-4 ${c.statut === 'NC_ACTION' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.zones?.icon}</span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
                      {c.zones?.label} — {c.type_controle} — Point {c.point}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-x-3">
                      <span>📅 {c.date_controle}</span>
                      <span>👤 {c.profiles?.full_name || 'N/A'}</span>
                      {c.observations && <span>💬 {c.observations}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={c.statut === 'NC_ACTION' ? 'badge-action' : 'badge-alerte'}>
                    {c.statut === 'NC_ACTION' ? '⛔ Limite d\'action' : '⚠️ Limite d\'alerte'}
                  </span>
                  <div className="mt-1.5 flex items-center gap-2 justify-end text-xs text-gray-400">
                    <span className="font-mono font-bold text-red-500 text-base">{c.germes} UFC</span>
                    <span>/ limite : {c.normes?.action}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
