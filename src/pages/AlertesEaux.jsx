import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const DEPASSEMENTS_2025 = [
  { date:'25/11/2025', type_eau:'EPU', point:'S24.41',   parametre:'DGAT', valeur:'59 UFC/mL',    statut:'action', oos:null,        commentaire:'Résultat isolé — max non récurrent' },
  { date:'03/11/2025', type_eau:'EPU', point:'PeS658',   parametre:'DGAT', valeur:'Indénombrable', statut:'nc',     oos:'OOS-25/14', commentaire:'Contamination probable lors prélèvement. OOS clôturé.' },
  { date:'14/11/2025', type_eau:'EPU', point:'PeS658',   parametre:'DGAT', valeur:'79 UFC/mL',    statut:'action', oos:'OOS-25/14', commentaire:'Dépassement limite action (50)' },
  { date:'27/10/2025', type_eau:'EPU', point:'PeS717',   parametre:'DGAT', valeur:'Indénombrable', statut:'nc',     oos:'OOS-25/xxx',commentaire:'Confirmé 03/11 et 10/11. OOS en cours.' },
  { date:'24/11/2025', type_eau:'EPU', point:'PeS717',   parametre:'DGAT', valeur:'98 UFC/mL',    statut:'action', oos:'OOS-25/xxx',commentaire:'Dépassement limite action (50)' },
  { date:'03/02/2025', type_eau:'EPU', point:'PeS658',   parametre:'G. pathogènes', valeur:'Présence', statut:'nc', oos:'OOS-25/03', commentaire:'Contamination technicien CQ. OOS clôturé.' },
  { date:'03/02/2025', type_eau:'EPU', point:'PeS632',   parametre:'G. pathogènes', valeur:'Présence', statut:'nc', oos:'OOS-25/03', commentaire:'Contamination technicien CQ. OOS clôturé.' },
  { date:'06/01/2025', type_eau:'EPPI',point:'Pes359',   parametre:'DGAT', valeur:'7 UFC/mL',     statut:'action', oos:null,        commentaire:'Dépassement limite action (5). Isolé sans récurrence.' },
  { date:'03/02/2025', type_eau:'EPPI',point:'V438A.4.4',parametre:'G. pathogènes', valeur:'Présence', statut:'nc', oos:'OOS-25/02', commentaire:'Contamination technicien CQ. OOS clôturé.' },
  { date:'03/02/2025', type_eau:'EPPI',point:'Pes359',   parametre:'G. pathogènes', valeur:'Présence', statut:'nc', oos:'OOS-25/02', commentaire:'Contamination technicien CQ. OOS clôturé.' },
]

const STATUT_CFG = {
  ok:     { label:'Conforme',       bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',         bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',         bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'Non conforme',   bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

const OOS_STATUS = {
  'OOS-25/14':  { statut:'Clôturé', color:'#16a34a' },
  'OOS-25/03':  { statut:'Clôturé', color:'#16a34a' },
  'OOS-25/02':  { statut:'Clôturé', color:'#16a34a' },
  'OOS-25/xxx': { statut:'En cours', color:'#d97706' },
}

export default function AlertesEaux() {
  const [filtre, setFiltre] = useState('ALL')
  const [filtreType, setFiltreType] = useState('ALL')
  const [donneesLive, setDonneesLive] = useState([])

  useEffect(() => {
    supabase.from('controles_eaux')
      .select('*')
      .in('statut', ['alerte','action','nc'])
      .order('date_controle', { ascending: false })
      .limit(50)
      .then(({ data }) => setDonneesLive(data || []))
  }, [])

  const historique = DEPASSEMENTS_2025.filter(d => {
    if (filtreType !== 'ALL' && d.type_eau !== filtreType) return false
    if (filtre === 'oos' && !d.oos) return false
    if (filtre !== 'ALL' && filtre !== 'oos' && d.statut !== filtre) return false
    return true
  })

  const stats = {
    total:  DEPASSEMENTS_2025.length,
    nc:     DEPASSEMENTS_2025.filter(d => d.statut === 'nc').length,
    action: DEPASSEMENTS_2025.filter(d => d.statut === 'action').length,
    oos_ouverts:  DEPASSEMENTS_2025.filter(d => d.oos && OOS_STATUS[d.oos]?.statut === 'En cours').length,
    oos_clotures: DEPASSEMENTS_2025.filter(d => d.oos && OOS_STATUS[d.oos]?.statut === 'Clôturé').length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Alertes — Eaux 2025</h1>
        <p className="text-gray-500 text-sm mt-1">Dépassements de limites · Investigations OOS · Suivi actions</p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Dépass. action', val: stats.action, color:'#d97706' },
          { label:'Non conformes',  val: stats.nc,     color:'#dc2626' },
          { label:'OOS ouverts',    val: stats.oos_ouverts,  color:'#f59e0b' },
          { label:'OOS clôturés',   val: stats.oos_clotures, color:'#16a34a' },
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
          {[['ALL','Tous'],['EPU','EPU'],['EPPI','EPPI']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltreType(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filtreType===v ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>{l}</button>
          ))}
        </div>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"/>
        <div className="flex gap-1 flex-wrap">
          {[['ALL','Tous'],['action','Action'],['nc','NC'],['oos','Avec OOS']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltre(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filtre===v ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{historique.length} résultat(s)</span>
      </div>

      {/* Données live si disponibles */}
      {donneesLive.length > 0 && (
        <div className="card p-4 border-l-4 border-l-brand">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Dépassements récents — Données en temps réel ({donneesLive.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Type','Point','Paramètre','Valeur','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donneesLive.map((r, i) => {
                  const s = STATUT_CFG[r.statut] || STATUT_CFG.alerte
                  return (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 pr-3 font-mono">{r.date_controle?.split('-').reverse().join('/')}</td>
                      <td className="py-2 pr-3 font-bold text-brand">{r.type_eau}</td>
                      <td className="py-2 pr-3 font-mono">{r.point_code}</td>
                      <td className="py-2 pr-3">{r.parametre}</td>
                      <td className="py-2 pr-3 font-mono font-bold">{r.valeur ?? r.valeur_text} {r.unite}</td>
                      <td className="py-2 pr-3">
                        <span className="font-semibold px-2 py-0.5 rounded-full"
                          style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historique 2025 */}
      <div className="card p-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Historique 2025 — Revue annuelle
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Date','Type','Point','Paramètre','Valeur','OOS','Statut','Commentaire'].map(h => (
                  <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historique.map((d, i) => {
                const s = STATUT_CFG[d.statut]
                const oos = d.oos ? OOS_STATUS[d.oos] : null
                return (
                  <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30`}
                    style={{ background: d.statut==='nc' ? '#fef2f210' : d.statut==='action' ? '#fff7ed30' : undefined }}>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{d.date}</td>
                    <td className="py-2 pr-3">
                      <span className="font-bold text-xs px-1.5 py-0.5 rounded"
                        style={{ background: d.type_eau==='EPU' ? '#E8F4FD' : '#F3E8FF',
                                 color: d.type_eau==='EPU' ? '#185FA5' : '#6B21A8' }}>
                        {d.type_eau}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono font-bold text-brand">{d.point}</td>
                    <td className="py-2 pr-3">{d.parametre}</td>
                    <td className="py-2 pr-3 font-mono font-bold" style={{ color: s?.txt }}>{d.valeur}</td>
                    <td className="py-2 pr-3">
                      {d.oos ? (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ color: oos?.color, background: `${oos?.color}15` }}>
                          {d.oos}
                          <span className="ml-1 normal-case font-normal">({oos?.statut})</span>
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background:s?.bg, border:`1px solid ${s?.border}`, color:s?.txt }}>
                        {s?.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-400 max-w-xs">{d.commentaire}</td>
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
