import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const POSITIONS = [
  { code:'MD',  label:'Main droite',      emoji:'🤜', side:'right' },
  { code:'MG',  label:'Main gauche',       emoji:'🤛', side:'left' },
  { code:'BD',  label:'Bras droit',        emoji:'💪', side:'right' },
  { code:'BG',  label:'Bras gauche',       emoji:'💪', side:'left' },
  { code:'AVD', label:'Avant-bras droit',  emoji:'🦾', side:'right' },
  { code:'AVG', label:'Avant-bras gauche', emoji:'🦾', side:'left' },
]
const NORME = 5

export default function SaisiePersonnel() {
  const [zones, setZones]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState({ text:'', type:'' })

  // Formulaire
  const [zoneId,     setZoneId]     = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [operateur,  setOperateur]  = useState('')
  const [newOp,      setNewOp]      = useState('')
  const [lot,        setLot]        = useState('')
  const [produit,    setProduit]    = useState('')
  const [values,     setValues]     = useState({ MD:'', MG:'', BD:'', BG:'', AVD:'', AVG:'' })

  // Historique opérateurs
  const [operateurs, setOperateurs] = useState([])
  // Historique contrôles
  const [historique, setHistorique] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: z } = await supabase.from('zones').select('*').eq('actif', true)
      setZones(z || [])
      // Zone stérilisation par défaut
      const ster = (z||[]).find(x => x.code === 'REMPLISSAGE')
      if (ster) setZoneId(ster.id)

      // Opérateurs existants
      const { data: ops } = await supabase
        .from('controles_personnel')
        .select('operateur_nom')
        .not('operateur_nom', 'is', null)
      const uniq = [...new Set((ops||[]).map(o => o.operateur_nom).filter(Boolean))].sort()
      setOperateurs(uniq)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { loadHistorique() }, [zoneId])

  async function loadHistorique() {
    if (!zoneId) return
    setLoadingHist(true)
    const { data } = await supabase
      .from('controles_personnel')
      .select('*')
      .eq('zone_id', zoneId)
      .order('date_controle', { ascending: false })
      .limit(100)
    setLoadingHist(false)

    if (!data) return setHistorique([])
    // Pivoter : regrouper par date+opérateur+lot
    const grouped = {}
    data.forEach(r => {
      const key = `${r.date_controle}_${r.operateur_nom}_${r.lot||''}`
      if (!grouped[key]) grouped[key] = {
        date: r.date_controle, operateur: r.operateur_nom,
        lot: r.lot, produit: r.produit, positions: {}
      }
      grouped[key].positions[r.position] = r.germes
    })
    setHistorique(Object.values(grouped).slice(0, 30))
  }

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  const nomOperateur = operateur === '__new__' ? newOp.trim() : operateur

  // Stats
  const stats = useMemo(() => {
    const vals = Object.values(values).filter(v => v !== '')
    const nc = vals.filter(v => parseFloat(v) >= NORME).length
    const max = vals.length ? Math.max(...vals.map(v => parseFloat(v)||0)) : 0
    return { renseignes: vals.length, nc, max }
  }, [values])

  async function handleSave() {
    if (!zoneId)       return showMsg('Zone obligatoire', 'error')
    if (!date)         return showMsg('Date obligatoire', 'error')
    if (!nomOperateur) return showMsg('Nom opérateur obligatoire', 'error')
    const renseignes = Object.entries(values).filter(([,v]) => v !== '')
    if (renseignes.length === 0) return showMsg('Aucune valeur saisie', 'warn')

    setSaving(true)
    const rows = renseignes.map(([pos, val]) => ({
      zone_id: zoneId,
      date_controle: date,
      position: pos,
      germes: parseFloat(val) || 0,
      operateur_nom: nomOperateur,
      lot: lot || null,
      produit: produit || null,
    }))

    const { error } = await supabase.from('controles_personnel').insert(rows)
    if (error) { setSaving(false); return showMsg(error.message, 'error') }

    setSaving(false)
    showMsg(`✅ ${rows.length} position(s) enregistrées pour ${nomOperateur}`)
    setValues({ MD:'', MG:'', BD:'', BG:'', AVD:'', AVG:'' })
    setLot(''); setProduit('')
    // Ajouter l'opérateur à la liste si nouveau
    if (operateur === '__new__' && !operateurs.includes(nomOperateur)) {
      setOperateurs(prev => [...prev, nomOperateur].sort())
      setOperateur(nomOperateur)
    }
    loadHistorique()
  }

  function fmtDate(iso) {
    if (!iso) return ''
    const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie personnel</h1>
        <p className="text-gray-500 text-sm mt-1">Empreintes gants · Norme &lt;{NORME} UFC/boîte</p>
      </div>

      {/* ── Formulaire ── */}
      <div className="card p-5">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Nouveau contrôle
        </div>

        {/* Infos générales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Zone *</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="input py-1.5 text-sm">
              <option value="">— Sélectionner —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.icon} {z.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input py-1.5 text-sm"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">N° Lot</label>
            <input type="text" value={lot} onChange={e => setLot(e.target.value)}
              placeholder="Ex: 2601001P" className="input py-1.5 text-sm"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Produit</label>
            <input type="text" value={produit} onChange={e => setProduit(e.target.value)}
              placeholder="Ex: PFF017" className="input py-1.5 text-sm"/>
          </div>
        </div>

        {/* Opérateur */}
        <div className="mb-5">
          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Opérateur *</label>
          <div className="flex gap-2 flex-wrap items-center">
            {operateurs.map(op => (
              <button key={op} onClick={() => setOperateur(op)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                  operateur===op
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'border-gray-200 text-gray-600 dark:text-gray-300 dark:border-gray-700 hover:border-teal-400'
                }`}>{op}</button>
            ))}
            <button onClick={() => setOperateur('__new__')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                operateur==='__new__'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'border-dashed border-gray-300 text-gray-400 hover:border-teal-400'
              }`}>+ Nouveau</button>
          </div>
          {operateur === '__new__' && (
            <input type="text" value={newOp} onChange={e => setNewOp(e.target.value)}
              placeholder="Prénom Nom de l'opérateur"
              className="input mt-2 text-sm py-1.5 w-64" autoFocus/>
          )}
        </div>

        {/* Grille des positions — style mains */}
        <div className="mb-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">
            Résultats par position (UFC/boîte)
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-lg">
            {/* Gauche + Droite */}
            {[
              ['AVG','AVD'],
              ['BG','BD'],
              ['MG','MD'],
            ].map(([left, right]) => {
              const posL = POSITIONS.find(p => p.code === left)
              const posR = POSITIONS.find(p => p.code === right)
              return (
                <div key={left} className="contents">
                  {/* Gauche */}
                  <div>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      parseFloat(values[left]||0) >= NORME
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{posL.label}</div>
                        <div className="text-xs font-bold text-brand font-mono">{left}</div>
                      </div>
                      <input type="number" min="0" step="1"
                        value={values[left]}
                        onChange={e => setValues(v => ({...v, [left]: e.target.value}))}
                        placeholder="0"
                        className={`w-14 text-center font-mono font-bold text-sm px-2 py-1 border rounded-lg outline-none ${
                          parseFloat(values[left]||0) >= NORME
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-gray-200 focus:border-brand dark:bg-gray-800 dark:text-white dark:border-gray-700'
                        }`}/>
                      {parseFloat(values[left]||0) >= NORME && <span className="text-red-500">⛔</span>}
                    </div>
                  </div>
                  {/* Droite */}
                  <div>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      parseFloat(values[right]||0) >= NORME
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{posR.label}</div>
                        <div className="text-xs font-bold text-brand font-mono">{right}</div>
                      </div>
                      <input type="number" min="0" step="1"
                        value={values[right]}
                        onChange={e => setValues(v => ({...v, [right]: e.target.value}))}
                        placeholder="0"
                        className={`w-14 text-center font-mono font-bold text-sm px-2 py-1 border rounded-lg outline-none ${
                          parseFloat(values[right]||0) >= NORME
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-gray-200 focus:border-brand dark:bg-gray-800 dark:text-white dark:border-gray-700'
                        }`}/>
                      {parseFloat(values[right]||0) >= NORME && <span className="text-red-500">⛔</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mini résumé */}
          <div className="flex gap-4 mt-3 text-xs">
            <span className="text-gray-400">{stats.renseignes}/6 positions renseignées</span>
            {stats.nc > 0 && <span className="text-red-600 font-bold">⛔ {stats.nc} NC (max:{stats.max} UFC)</span>}
            {stats.nc === 0 && stats.renseignes > 0 && <span className="text-green-600 font-bold">✅ Conforme</span>}
          </div>
        </div>

        {/* Feedback */}
        {msg.text && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium mb-4 ${
            msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700' :
            msg.type==='warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                 'bg-green-50 border border-green-200 text-green-700'
          }`}>{msg.text}</div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5">
          {saving
            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
            : <>💾 Enregistrer</>
          }
        </button>
      </div>

      {/* ── Historique ── */}
      <div className="card p-5">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Historique récent
        </div>
        {loadingHist ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"/>
        ) : historique.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">Aucun contrôle enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Opérateur','Lot','Produit','MD','MG','BD','BG','AVD','AVG','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {historique.map((r, i) => {
                  const nc = POSITIONS.filter(p => parseFloat(r.positions[p.code]||0) >= NORME).length
                  return (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${nc>0?'bg-red-50/30 dark:bg-red-900/5':''}`}>
                      <td className="py-2 pr-3 font-mono">{fmtDate(r.date)}</td>
                      <td className="py-2 pr-3 font-medium">{r.operateur}</td>
                      <td className="py-2 pr-3 text-gray-400">{r.lot||'—'}</td>
                      <td className="py-2 pr-3 text-gray-400">{r.produit||'—'}</td>
                      {POSITIONS.map(p => {
                        const val = r.positions[p.code]
                        const isNC = parseFloat(val||0) >= NORME
                        return (
                          <td key={p.code} className="py-2 pr-3 font-mono font-bold text-center"
                            style={{ color: isNC?'#dc2626': val!==undefined?'#16a34a':'#ccc' }}>
                            {val !== undefined ? val : '—'}
                          </td>
                        )
                      })}
                      <td className="py-2 pr-3">
                        {nc > 0
                          ? <span className="text-red-600 font-bold text-[10px]">⛔ {nc} NC</span>
                          : <span className="text-green-600 font-bold text-[10px]">✅ OK</span>
                        }
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
