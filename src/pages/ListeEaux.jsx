import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STATUT_CFG = {
  ok:     { label:'Conforme',       bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',         bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',         bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'NC',             bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

const TYPE_STYLE = {
  EPU:  { bg:'#E8F4FD', txt:'#185FA5' },
  EPPI: { bg:'#F3E8FF', txt:'#6B21A8' },
  EA:   { bg:'#E1F5EE', txt:'#0F6E56' },
}

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ListeEaux() {
  const [rows,       setRows]       = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(0)
  const [editId,     setEditId]     = useState(null)
  const [editVal,    setEditVal]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState({ text:'', type:'' })

  // Filtres
  const [filtreType,  setFiltreType]  = useState('ALL')
  const [filtreLB,    setFiltreLB]    = useState('ALL')
  const [filtrePoint, setFiltrePoint] = useState('ALL')
  const [filtreStatut,setFiltreStatut]= useState('ALL')
  const [dateDebut,   setDateDebut]   = useState('')
  const [dateFin,     setDateFin]     = useState('')

  // Points disponibles selon type sélectionné
  const [pointsDispos, setPointsDispos] = useState([])

  useEffect(() => {
    supabase.from('controles_eaux')
      .select('point_code', { count:'exact' })
      .then(({ data }) => {
        const pts = [...new Set((data||[]).map(r => r.point_code))].sort()
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

    if (filtreType   !== 'ALL') q = q.eq('type_eau', filtreType)
    if (filtreLB     !== 'ALL') q = q.eq('logbook',  filtreLB)
    if (filtrePoint  !== 'ALL') q = q.eq('point_code', filtrePoint)
    if (filtreStatut !== 'ALL') q = q.eq('statut',   filtreStatut)
    if (dateDebut) q = q.gte('date_controle', dateDebut)
    if (dateFin)   q = q.lte('date_controle', dateFin)

    const { data, count, error } = await q
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, filtreType, filtreLB, filtrePoint, filtreStatut, dateDebut, dateFin])

  function resetFiltres() {
    setFiltreType('ALL'); setFiltreLB('ALL'); setFiltrePoint('ALL')
    setFiltreStatut('ALL'); setDateDebut(''); setDateFin('')
    setPage(0)
  }

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 4000)
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette mesure ? Cette action est irréversible.')) return
    const { error } = await supabase.from('controles_eaux').delete().eq('id', id)
    if (error) return showMsg('Erreur suppression : ' + error.message, 'error')
    showMsg('Mesure supprimée')
    load()
  }

  async function handleSaveEdit(row) {
    setSaving(true)
    const updates = row.valeur !== null
      ? { valeur: parseFloat(editVal) || 0 }
      : { valeur_text: editVal }
    const { error } = await supabase.from('controles_eaux').update(updates).eq('id', row.id)
    if (error) { setSaving(false); return showMsg('Erreur : ' + error.message, 'error') }
    setSaving(false)
    setEditId(null)
    showMsg('Mesure mise à jour ✅')
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [filtreType!=='ALL',filtreLB!=='ALL',filtrePoint!=='ALL',filtreStatut!=='ALL',dateDebut,dateFin].filter(Boolean).length

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
            <select value={filtreType} onChange={e=>{setFiltreType(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-24">
              <option value="ALL">Tous</option>
              <option value="EPU">EPU</option>
              <option value="EPPI">EPPI</option>
              <option value="EA">EA</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Logbook</label>
            <select value={filtreLB} onChange={e=>{setFiltreLB(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-24">
              <option value="ALL">Tous</option>
              <option value="LB1">LB1</option>
              <option value="LB2">LB2</option>
              <option value="LB3">LB3</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Point</label>
            <select value={filtrePoint} onChange={e=>{setFiltrePoint(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-44">
              <option value="ALL">Tous les points</option>
              {pointsDispos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Statut</label>
            <select value={filtreStatut} onChange={e=>{setFiltreStatut(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-32">
              <option value="ALL">Tous</option>
              <option value="ok">Conforme</option>
              <option value="alerte">Alerte</option>
              <option value="action">Action</option>
              <option value="nc">NC</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={e=>{setDateDebut(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-34"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
            <input type="date" value={dateFin} onChange={e=>{setDateFin(e.target.value);setPage(0)}} className="input py-1.5 text-sm w-34"/>
          </div>
        </div>
      </div>

      {/* Message feedback */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700' :
                               'bg-green-50 border border-green-200 text-green-700'
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
                  const s = STATUT_CFG[row.statut]
                  const ts = TYPE_STYLE[row.type_eau]
                  const isEditing = editId === row.id

                  return (
                    <tr key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      style={{ background: isEditing ? 'var(--color-background-info)' : undefined }}>

                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(row.date_controle)}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background: ts?.bg, color: ts?.txt }}>{row.type_eau}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background: ts?.bg, color: ts?.txt }}>{row.logbook}</span>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-brand whitespace-nowrap">
                        {row.point_code}
                      </td>

                      <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300">
                        {row.parametre}
                      </td>

                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            {row.valeur !== null ? (
                              <input type="number" step="0.01" value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                className="w-20 text-center font-mono text-sm px-2 py-1 rounded-lg border border-blue-300 outline-none bg-white"
                                autoFocus/>
                            ) : (
                              <select value={editVal} onChange={e => setEditVal(e.target.value)}
                                className="input py-1 text-xs w-36">
                                <option value="Limpide et incolore">Limpide et incolore</option>
                                <option value="Absence">Absence</option>
                                <option value="Présence">Présence</option>
                                <option value="< 0.125 UI/mL — Conforme">{'< 0.125 UI/mL — Conforme'}</option>
                                <option value="≥ 0.25 UI/mL — Non conforme">≥ 0.25 UI/mL — NC</option>
                              </select>
                            )}
                            {row.unite && <span className="text-xs text-gray-400">{row.unite}</span>}
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-xs">
                            {row.valeur ?? row.valeur_text ?? '—'}
                            {row.unite && <span className="text-gray-400 font-normal ml-1">{row.unite}</span>}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        {s ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                            {s.label}
                          </span>
                        ) : '—'}
                      </td>

                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSaveEdit(row)} disabled={saving}
                              className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-medium disabled:opacity-50">
                              {saving ? '...' : '✓ OK'}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => {
                                setEditId(row.id)
                                setEditVal(row.valeur !== null ? String(row.valeur) : (row.valeur_text || ''))
                              }}
                              className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded border border-gray-200 hover:border-brand transition-colors"
                              title="Modifier">
                              ✏️
                            </button>
                            <button onClick={() => handleDelete(row.id)}
                              className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded border border-gray-200 hover:border-red-300 transition-colors"
                              title="Supprimer">
                              🗑
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
                  Page {page+1}/{totalPages} · {total} enregistrements
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
                    ← Préc.
                  </button>
                  {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
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
