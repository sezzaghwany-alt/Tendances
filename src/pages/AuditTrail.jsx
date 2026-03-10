import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ClipboardList } from 'lucide-react'

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('audit_trail')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      setLogs(data || [])
      setLoading(false)
    }
    load()

    // Realtime
    const channel = supabase.channel('audit').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_trail' }, payload => {
      setLogs(prev => [payload.new, ...prev])
    }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const filtered = logs.filter(l => filter === 'ALL' || l.action === filter)

  const actionColor = (a) => a === 'INSERT' ? 'badge-ok' : a === 'UPDATE' ? 'badge-alerte' : 'badge-action'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="text-gray-500 text-sm mt-1">Historique complet de toutes les modifications — qui, quand, quoi</p>
        </div>
        <div className="flex gap-2">
          {['ALL','INSERT','UPDATE','DELETE'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                ${filter === f ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
              {f === 'ALL' ? 'Tout' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-left">
              {['Date / Heure','Utilisateur','Action','Table','Champ','Avant','Après','Justification'].map(h => (
                <th key={h} className="label px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucun enregistrement</td></tr>
            )}
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-xs font-medium">{l.user_name || l.profiles?.full_name || '—'}</td>
                <td className="px-4 py-3"><span className={actionColor(l.action)}>{l.action}</span></td>
                <td className="px-4 py-3 text-xs font-mono text-gray-400">{l.table_name}</td>
                <td className="px-4 py-3 text-xs font-mono">{l.field_name || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-red-400">{l.old_value ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-green-500">{l.new_value ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{l.justification || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
