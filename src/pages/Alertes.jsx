import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ZONES_POCHES = ['PREPARATION','REMPLISSAGE','PREP_REMPL']

const STATUT_CFG = {
  ok:     { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',   bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',   bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function Alertes() {
  const [alertes,    setAlertes]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filtreZone, setFiltreZone] = useState('ALL')
  const [filtreType, setFiltreType] = useState('ALL')
  const [filtreStatut,setFiltreStatut] = useState('ALL')

  const annee = new Date().getFullYear()

  useEffect(() => {
    supabase.from('controles')
      .select('*, zones(code, label), salles(label)')
      .in('statut', ['alerte','action','nc'])
      .gte('date_controle', `${annee}-01-01`)
      .lte('date_controle', `${annee}-12-31`)
      .order('date_controle', { ascending: false })
      .limit(500)
      .then(({ data }) => { setAlertes(data || []); setLoading(false) })
  }, [])

  const filtered = alertes.filter(a => {
    const code = ZONES_POCHES.includes(a.zones?.code) ? 'PREPARATION' : a.zones?.code
    if (filtreZone !== 'ALL' && code !== filtreZone) return false
    if (filtreType !== 'ALL' && a.type_controle !== filtreType) return false
    if (filtreStatut !== 'ALL' && a.statut !== filtreStatut) return false
    return true
  })

  const stats = {
    total:  alertes.length,
    alerte: alertes.filter(a => a.statut === 'alerte').length,
    action: alertes.filter(a => a.statut === 'action').length,
    nc:     alertes.filter(a => a.statut === 'nc').length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Alertes — Environnement {annee}</h1>
        <p className="text-gray-500 text-sm mt-1">Dépassements de limites · Contrôles ACTIF, PASSIF, SURFACE</p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total dépassements', val:stats.total,  color:'#374151' },
          { label:'Alertes',            val:stats.alerte, color:'#d97706' },
          { label:'Actions',            val:stats.action, color:'#dc2626' },
          { label:'Non conformes',      val:stats.nc,     color:'#991b1b' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-extrabold" style={{ color }}>{val}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {['ALL','alerte','action','nc'].map(s => (
            <button key={s} onClick={() => setFiltreStatut(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filtreStatut===s ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>
              {s==='ALL' ? 'Tous' : s==='alerte' ? 'Alertes' : s==='action' ? 'Actions' : 'NC'}
            </button>
          ))}
        </div>
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-xs w-28">
          <option value="ALL">Tous types</option>
          <option value="ACTIF">Actif</option>
          <option value="PASSIF">Passif</option>
          <option value="SURFACE">Surface</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} résultat(s)</span>
      </div>

      {/* Tableau */}
      <div className="card p-4">
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"/>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">
            {alertes.length === 0 ? `Aucun dépassement enregistré en ${annee}` : 'Aucun résultat pour ce filtre'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Zone','Salle','Point','Type','Cl.','Germes (UFC)','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const s = STATUT_CFG[a.statut]
                  const zoneLabel = ZONES_POCHES.includes(a.zones?.code) ? 'Prép. Poches' : a.zones?.label
                  return (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      style={{ background: a.statut==='nc' ? '#fef2f210' : a.statut==='action' ? '#fff7ed30' : undefined }}>
                      <td className="py-2 pr-4 font-mono whitespace-nowrap">{fmtDate(a.date_controle)}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{zoneLabel}</td>
                      <td className="py-2 pr-4 text-gray-400">{a.salles?.label || '—'}</td>
                      <td className="py-2 pr-4 font-mono font-bold text-brand">{a.point}</td>
                      <td className="py-2 pr-4 text-gray-500">{a.type_controle}</td>
                      <td className="py-2 pr-4 font-bold">{a.classe}</td>
                      <td className="py-2 pr-4 font-mono font-bold" style={{ color: s?.txt }}>{a.germes}</td>
                      <td className="py-2 pr-4">
                        <span className="font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background:s?.bg, border:`1px solid ${s?.border}`, color:s?.txt }}>
                          {s?.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
