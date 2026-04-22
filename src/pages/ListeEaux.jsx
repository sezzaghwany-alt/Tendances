import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STATUT_CFG = {
  ok:     { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',   bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',   bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

const TYPE_STYLE = {
  EPU:  { bg:'#E8F4FD', txt:'#185FA5' },
  EPPI: { bg:'#F3E8FF', txt:'#6B21A8' },
  EA:   { bg:'#E1F5EE', txt:'#0F6E56' },
}

// Paramètres par type/logbook pour recalculer le statut après modif
const PARAMS_CONFIG = {
  'EPU_LB1': [
    { id:'aspect',       type:'select', conformeIf: v => v==='Limpide et incolore' },
    { id:'conductivite', type:'number', norme:5.1, la:1.5, lac:2.6 },
  ],
  'EPU_LB2': [
    { id:'dgat',       type:'number', norme:100, la:30, lac:50 },
    { id:'germes_path',type:'select', conformeIf: v => v==='Absence' },
  ],
  'EPU_LB3': [
    { id:'lal', type:'lal', conformeIf: v => v==='< 0.125 UI/mL — Conforme' },
  ],
  'EPPI_LB1': [
    { id:'aspect',       type:'select', conformeIf: v => v==='Limpide et incolore' },
    { id:'cot',          type:'number', norme:500, la:150, lac:250 },
    { id:'conductivite', type:'number', norme:1.3, la:0.9, lac:1.1 },
  ],
  'EPPI_LB2': [
    { id:'dgat',       type:'number', norme:10, la:3, lac:5 },
    { id:'germes_path',type:'select', conformeIf: v => v==='Absence' },
  ],
  'EPPI_LB3': [
    { id:'lal', type:'lal', conformeIf: v => v==='< 0.125 UI/mL — Conforme' },
  ],
  'EA_LB1': [
    { id:'aspect',       type:'select', conformeIf: v => v==='Limpide et incolore' },
    { id:'pH',           type:'number', norme_min:6.5, norme:8.5 },
    { id:'durete',       type:'number', norme:45 },
    { id:'alcalinite',   type:'number', norme:20 },
    { id:'conductivite', type:'number', norme:2700 },
    { id:'sulfate',      type:'number', norme:400 },
    { id:'chlorure',     type:'number', norme:750 },
    { id:'fer',          type:'number', norme:0.3 },
    { id:'nitrate',      type:'number', norme:50 },
    { id:'dgat',         type:'number', norme:500 },
    { id:'germes_path',  type:'select', conformeIf: v => v==='Absence' },
  ],
}

function calcStatut(valeur, valeur_text, parametre, type_eau, logbook) {
  const key = `${type_eau}_${logbook}`
  const params = PARAMS_CONFIG[key] || []
  const p = params.find(x => x.id === parametre)
  if (!p) return 'ok'

  const val = valeur !== null ? valeur : valeur_text
  if (val === null || val === undefined || val === '') return 'ok'

  if (p.type === 'select' || p.type === 'lal') {
    return p.conformeIf && p.conformeIf(String(val)) ? 'ok' : 'nc'
  }
  const v = parseFloat(val)
  if (isNaN(v)) return 'ok'
  if (p.norme_min !== undefined && (v < p.norme_min || v > p.norme)) return 'nc'
  if (p.norme     !== undefined && p.norme_min === undefined && v >= p.norme)  return 'nc'
  if (p.lac       !== undefined && v >= p.lac)   return 'action'
  if (p.la        !== undefined && v >= p.la)    return 'alerte'
  return 'ok'
}

// Options selon paramètre
function getOptions(parametre) {
  if (parametre === 'aspect')      return ['Limpide et incolore','Trouble','Coloré']
  if (parametre === 'germes_path') return ['Absence','Présence']
  if (parametre === 'lal')         return ['< 0.125 UI/mL — Conforme','≥ 0.25 UI/mL — Non conforme']
  return null
}

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ListeEaux() {
  const [rows,        setRows]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(0)
  const [editId,      setEditId]      = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [msg,         setMsg]         = useState({ text:'', type:'' })
  const [pointsDispos,setPointsDispos]= useState([])

  // Filtres
  const [filtreType,  setFiltreType]  = useState('ALL')
  const [filtreLB,    setFiltreLB]    = useState('ALL')
  const [filtrePoint, setFiltrePoint] = useState('ALL')
  const [filtreStatut,setFiltreStatut]= useState('ALL')
  const [dateDebut,   setDateDebut]   = useState('')
  const [dateFin,     setDateFin]     = useState('')

  useEffect(() => {
    supabase.from('controles_eaux').select('point_code').then(({ data }) => {
      const pts = [...new Set((data||[]).map(r => r.point_code).filter(Boolean))].sort()
      setPointsDispos(pts)
    })
  }, [])

  async function load() {
    setLoading(true)
    let q = supabase.from('controles_eaux')
      .select('*', { count:'exact' })
      .order('date_controle', { ascending: false })
      .order('created_at',    { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filtreType   !== 'ALL') q = q.eq('type_eau',    filtreType)
    if (filtreLB     !== 'ALL') q = q.eq('logbook',     filtreLB)
    if (filtrePoint  !== 'ALL') q = q.eq('point_code',  filtrePoint)
    if (filtreStatut !== 'ALL') q = q.eq('statut',      filtreStatut)
    if (dateDebut) q = q.gte('date_controle', dateDebut)
    if (dateFin)   q = q.lte('date_controle', dateFin)

    const { data, count, error } = await q
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => { setPage(0) }, [filtreType, filtreLB, filtrePoint, filtreStatut, dateDebut, dateFin])
  useEffect(() => { load() }, [page, filtreType, filtreLB, filtrePoint, filtreStatut, dateDebut, dateFin])

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  function startEdit(row) {
    setEditId(row.id)
    setEditForm({
      date_controle: row.date_controle || '',
      parametre:     row.parametre || '',
      valeur:        row.valeur !== null ? String(row.valeur) : '',
      valeur_text:   row.valeur_text || '',
      unite:         row.unite || '',
    })
  }

  async function handleSaveEdit(row) {
    setSaving(true)
    const isNumber = row.valeur !== null && getOptions(editForm.parametre) === null

    // Recalculer le statut avec les nouvelles valeurs
    const newValeur     = isNumber ? (parseFloat(editForm.valeur) ?? null) : null
    const newValeurText = !isNumber ? editForm.valeur_text : null
    const newStatut = calcStatut(newValeur, newValeurText, editForm.parametre, row.type_eau, row.logbook)

    const updates = {
      date_controle: editForm.date_controle,
      parametre:     editForm.parametre,
      valeur:        newValeur,
      valeur_text:   newValeurText,
      statut:        newStatut,
    }

    const { error } = await supabase
      .from('controles_eaux')
      .update(updates)
      .eq('id', row.id)

    setSaving(false)
    if (error) {
      showMsg('Erreur modification : ' + error.message, 'error')
      return
    }
    setEditId(null)
    setEditForm({})
    showMsg('Mesure mise à jour ✅')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette mesure ? Cette action est irréversible.')) return
    setDeleting(id)
    const { error } = await supabase
      .from('controles_eaux')
      .delete()
      .eq('id', id)
    setDeleting(null)
    if (error) {
      showMsg('Erreur suppression : ' + error.message, 'error')
      return
    }
    showMsg('Mesure supprimée')
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [filtreType!=='ALL',filtreLB!=='ALL',filtrePoint!=='ALL',filtreStatut!=='ALL',dateDebut,dateFin].filter(Boolean).length

  function resetFiltres() {
    setFiltreType('ALL'); setFiltreLB('ALL'); setFiltrePoint('ALL')
    setFiltreStatut('ALL'); setDateDebut(''); setDateFin('')
  }

  // Paramètres disponibles pour la ligne en édition
  function getParamsForRow(row) {
    const key = `${row.type_eau}_${row.logbook}`
    return (PARAMS_CONFIG[key] || []).map(p => p.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Liste des données — Eaux</h1>
          <p className="text-gray-500 text-sm mt-1">{total} enregistrement{total>1?'s':''} · modification et suppression</p>
        </div>
        {activeFilters > 0 && (
          <button onClick={resetFiltres} className="text-xs text-brand hover:underline mt-1">
            ✕ Réinitialiser ({activeFilters})
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-24">
              <option value="ALL">Tous</option>
              <option value="EPU">EPU</option>
              <option value="EPPI">EPPI</option>
              <option value="EA">EA</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Logbook</label>
            <select value={filtreLB} onChange={e => setFiltreLB(e.target.value)} className="input py-1.5 text-sm w-24">
              <option value="ALL">Tous</option>
              <option value="LB1">LB1</option>
              <option value="LB2">LB2</option>
              <option value="LB3">LB3</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Point</label>
            <select value={filtrePoint} onChange={e => setFiltrePoint(e.target.value)} className="input py-1.5 text-sm w-44">
              <option value="ALL">Tous les points</option>
              {pointsDispos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Statut</label>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="input py-1.5 text-sm w-32">
              <option value="ALL">Tous</option>
              <option value="ok">Conforme</option>
              <option value="alerte">Alerte</option>
              <option value="action">Action</option>
              <option value="nc">NC</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>{msg.text}</div>
      )}

      {/* Tableau */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"/>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">Aucun résultat pour cette sélection</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Date','Type · LB','Point','Paramètre','Résultat','Statut','Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {rows.map(row => {
                  const s  = STATUT_CFG[row.statut]
                  const ts = TYPE_STYLE[row.type_eau]
                  const isEditing  = editId === row.id
                  const isDeleting = deleting === row.id
                  const opts = getOptions(editForm.parametre || row.parametre)

                  return (
                    <tr key={row.id}
                      className="transition-colors"
                      style={{
                        background: isEditing
                          ? 'var(--color-background-info)'
                          : isDeleting ? '#fef2f2' : undefined
                      }}>

                      {/* Date */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input type="date" value={editForm.date_controle}
                            onChange={e => setEditForm(f=>({...f, date_controle:e.target.value}))}
                            className="input py-1 text-xs w-32"/>
                        ) : (
                          <span className="font-mono text-xs text-gray-500">{fmtDate(row.date_controle)}</span>
                        )}
                      </td>

                      {/* Type · LB */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background:ts?.bg, color:ts?.txt }}>{row.type_eau}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background:ts?.bg, color:ts?.txt }}>{row.logbook}</span>
                        </div>
                      </td>

                      {/* Point */}
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-brand whitespace-nowrap">
                        {row.point_code}
                      </td>

                      {/* Paramètre */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <select value={editForm.parametre}
                            onChange={e => setEditForm(f=>({...f, parametre:e.target.value}))}
                            className="input py-1 text-xs w-36">
                            {getParamsForRow(row).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-600 dark:text-gray-300">{row.parametre}</span>
                        )}
                      </td>

                      {/* Résultat */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            {opts ? (
                              <select value={editForm.valeur_text}
                                onChange={e => setEditForm(f=>({...f, valeur_text:e.target.value, valeur:''}))}
                                className="input py-1 text-xs w-44">
                                {opts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <>
                                <input type="number" step="0.01" value={editForm.valeur}
                                  onChange={e => setEditForm(f=>({...f, valeur:e.target.value, valeur_text:''}))}
                                  className="w-20 text-center font-mono text-sm px-2 py-1 rounded-lg border border-blue-300 outline-none bg-white"
                                  autoFocus/>
                                {row.unite && <span className="text-xs text-gray-400">{row.unite}</span>}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-xs">
                            {row.valeur ?? row.valeur_text ?? '—'}
                            {row.unite && <span className="text-gray-400 font-normal ml-1">{row.unite}</span>}
                          </span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-2.5">
                        {s ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                            {s.label}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSaveEdit(row)} disabled={saving}
                              className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50">
                              {saving
                                ? <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full"/>
                                : '✓'
                              } OK
                            </button>
                            <button onClick={() => { setEditId(null); setEditForm({}) }}
                              className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => startEdit(row)}
                              className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded border border-gray-200 hover:border-brand transition-colors"
                              title="Modifier">✏️</button>
                            <button onClick={() => handleDelete(row.id)} disabled={isDeleting}
                              className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded border border-gray-200 hover:border-red-300 transition-colors disabled:opacity-40"
                              title="Supprimer">
                              {isDeleting ? '...' : '🗑'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Page {page+1}/{totalPages} · {total} enregistrement{total>1?'s':''}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
                    ← Préc.
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(0, Math.min(page-2, totalPages-5)) + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`text-xs w-8 h-7 rounded-lg border transition-colors ${
                          page===p ? 'bg-navy text-white border-navy' : 'border-gray-200 hover:bg-gray-50'
                        }`}>{p+1}</button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
                    Suiv. →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
