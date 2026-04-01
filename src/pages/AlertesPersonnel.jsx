import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NORME = 5
const POSITIONS = ['MD','MG','BD','BG','AVD','AVG']

const STATUT_CFG = {
  ok: { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  nc: { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

export default function AlertesPersonnel() {
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtrePos, setFiltrePos] = useState('ALL')

  useEffect(() => {
    supabase.from('controles_personnel')
      .select('*')
      .gte('germes', NORME)
      .order('date_controle', { ascending: false })
      .limit(100)
      .then(({ data }) => { setAlertes(data || []); setLoading(false) })
  }, [])

  const filtered = filtrePos === 'ALL' ? alertes : alertes.filter(a => a.position === filtrePos)

  const stats = {
    total: alertes.length,
    operateurs: [...new Set(alertes.map(a => a.operateur_nom))].length,
    positions: POSITIONS.map(p => ({
      pos: p,
      count: alertes.filter(a => a.position === p).length,
      max: Math.max(0, ...alertes.filter(a => a.position === p).map(a => a.germes)),
    }))
  }

  function fmtDate(iso) {
    if (!iso) return ''
    const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Alertes — Personnel</h1>
        <p className="text-gray-500 text-sm mt-1">Dépassements empreintes gants · Norme &lt;{NORME} UFC/boîte</p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-extrabold text-red-600">{stats.total}</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">Dépassements</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-extrabold text-amber-600">{stats.operateurs}</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">Opérateurs concernés</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-extrabold text-brand">
            {stats.positions.reduce((a,b) => b.count > a.count ? b : a, {pos:'—',count:0}).pos}
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">Position la plus NC</div>
        </div>
      </div>

      {/* Distribution par position */}
      <div className="card p-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">NC par position</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {stats.positions.map(({ pos, count, max }) => (
            <button key={pos} onClick={() => setFiltrePos(filtrePos === pos ? 'ALL' : pos)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                filtrePos === pos ? 'border-brand bg-brand/5' : 'border-gray-200 dark:border-gray-700'
              }`}>
              <div className="text-lg font-extrabold" style={{ color: count > 0 ? '#dc2626' : '#16a34a' }}>{count}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">{pos}</div>
              {max > 0 && <div className="text-[10px] text-gray-400 font-mono">max: {max}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des dépassements */}
      <div className="card p-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Dépassements {filtrePos !== 'ALL' ? `— Position ${filtrePos}` : ''}</span>
          {filtrePos !== 'ALL' && (
            <button onClick={() => setFiltrePos('ALL')} className="text-gray-400 hover:text-gray-600 text-xs">
              Voir tout ✕
            </button>
          )}
        </div>
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"/>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">
            {alertes.length === 0 ? 'Aucun dépassement enregistré' : 'Aucun dépassement pour cette position'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Opérateur','Position','UFC/boîte','Lot','Produit','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-red-50/30 dark:hover:bg-red-900/5">
                    <td className="py-2 pr-4 font-mono">{fmtDate(r.date_controle)}</td>
                    <td className="py-2 pr-4 font-medium">{r.operateur_nom}</td>
                    <td className="py-2 pr-4 font-mono font-bold text-brand">{r.position}</td>
                    <td className="py-2 pr-4 font-mono font-bold text-red-600">{r.germes}</td>
                    <td className="py-2 pr-4 text-gray-400">{r.lot || '—'}</td>
                    <td className="py-2 pr-4 text-gray-400">{r.produit || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className="font-semibold px-2 py-0.5 rounded-full"
                        style={{ background:STATUT_CFG.nc.bg, border:`1px solid ${STATUT_CFG.nc.border}`, color:STATUT_CFG.nc.txt }}>
                        NC — {r.germes} UFC
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
