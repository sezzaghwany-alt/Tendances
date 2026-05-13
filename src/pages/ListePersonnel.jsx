import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NORME_PERSONNEL = 5
const POSITIONS = ['MD','MG','BD','BG','AVD','AVG']

const STATUT_CFG = {
  ok: { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  nc: { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ListePersonnel() {
  const [rows,        setRows]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(0)
  const [editId,      setEditId]      = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [msg,         setMsg]         = useState({ text:'', type:'' })

  // Filtres
  const [filtrePosition, setFiltrePosition] = useState('ALL')
  const [filtreStatut,   setFiltreStatut]   = useState('ALL')
  const [filtreOperateur,setFiltreOperateur]= useState('')
  const [dateDebut,      setDateDebut]      = useState('')
  const [dateFin,        setDateFin]        = useState('')
  const [annee,          setAnnee]          = useState(new Date().getFullYear())

  const ANNEES = (() => { const y = new Date().getFullYear(); return [y-1, y, y+1] })()

  async function load() {
    setLoading(true)
    const dDebut = dateDebut || `${annee}-01-01`
    const dFin   = dateFin   || `${annee}-12-31`

    let q = supabase.from('controles_personnel')
      .select('*', { count:'exact' })
      .gte('date_controle', dDebut)
      .lte('date_controle', dFin)
      .order('date_controle', { ascending: false })
      .order('created_at',    { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filtrePosition !== 'ALL') q = q.eq('position', filtrePosition)
    if (filtreStatut   !== 'ALL') {
      if (filtreStatut === 'ok') q = q.lt('germes', NORME_PERSONNEL)
      else                       q = q.gte('germes', NORME_PERSONNEL)
    }
    if (filtreOperateur.trim()) q = q.ilike('operateur_nom', `%${filtreOperateur.trim()}%`)

    const { data, count, error } = await q
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => { setPage(0) }, [filtrePosition, filtreStatut, filtreOperateur, dateDebut, dateFin, annee])
  useEffect(() => { load() }, [page, filtrePosition, filtreStatut, filtreOperateur, dateDebut, dateFin, annee])

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  function startEdit(row) {
    setEditId(row.id)
    setEditForm({
      date_controle:  row.date_controle  || '',
      operateur_nom:  row.operateur_nom  || '',
      position:       row.position       || '',
      germes:         row.germes !== null ? String(row.germes) : '',
      lot:            row.lot            || '',
      produit:        row.produit        || '',
      zone:           row.zone           || '',
    })
  }

  async function handleSaveEdit(row) {
    setSaving(true)
    const g = parseFloat(editForm.germes) ?? 0
    const newStatut = g >= NORME_PERSONNEL ? 'nc' : 'ok'

    const updates = {
      date_controle: editForm.date_controle,
      operateur_nom: editForm.operateur_nom,
      position:      editForm.position,
      germes:        g,
      lot:           editForm.lot     || null,
      produit:       editForm.produit || null,
      zone:          editForm.zone    || null,
      statut:        newStatut,
    }

    const { error } = await supabase.from('controles_personnel').update(updates).eq('id', row.id)
    setSaving(false)
    if (error) return showMsg('Erreur : ' + error.message, 'error')
    setEditId(null); setEditForm({})
    showMsg('Mesure mise à jour ✅')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette mesure ? Cette action est irréversible.')) return
    setDeleting(id)
    const { error } = await supabase.from('controles_personnel').delete().eq('id', id)
    setDeleting(null)
    if (error) return showMsg('Erreur : ' + error.message, 'error')
    showMsg('Mesure supprimée')
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [filtrePosition!=='ALL',filtreStatut!=='ALL',filtreOperateur.trim(),dateDebut,dateFin].filter(Boolean).length

  function resetFiltres() {
    setFiltrePosition('ALL'); setFiltreStatut('ALL')
    setFiltreOperateur(''); setDateDebut(''); setDateFin('')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Liste des données — Personnel</h1>
          <p className="text-gray-500 text-sm mt-1">{total} mesure{total>1?'s':''} · Norme &lt;{NORME_PERSONNEL} UFC/boîte</p>
        </div>
        {activeFilters > 0 && (
          <button onClick={resetFiltres} className="text-xs text-brand hover:underline mt-1">
            ✕ Réinitialiser ({activeFilters})
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Année */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Année</label>
            <div className="flex gap-1">
              {ANNEES.map(a => (
                <button key={a} onClick={() => { setAnnee(a); setDateDebut(''); setDateFin('') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    annee===a && !dateDebut ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
                  }`}>{a}</button>
              ))}
            </div>
          </div>
          {/* Position */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Position</label>
            <select value={filtrePosition} onChange={e => setFiltrePosition(e.target.value)} className="input py-1.5 text-sm w-28">
              <option value="ALL">Toutes</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {/* Statut */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Statut</label>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="input py-1.5 text-sm w-28">
              <option value="ALL">Tous</option>
              <option value="ok">Conforme</option>
              <option value="nc">NC</option>
            </select>
          </div>
          {/* Opérateur */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Opérateur</label>
            <input type="text" placeholder="Rechercher..." value={filtreOperateur}
              onChange={e => setFiltreOperateur(e.target.value)}
              className="input py-1.5 text-sm w-40"/>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
          <div className="ml-auto self-end text-xs text-gray-400 font-mono pb-1.5">{total} mesure{total>1?'s':''}</div>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700'
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {['Date','Opérateur','Position','UFC/boîte','Zone','Lot','Produit','Statut','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {rows.map(row => {
                    const statut = row.germes >= NORME_PERSONNEL ? 'nc' : 'ok'
                    const s = STATUT_CFG[statut]
                    const isEditing  = editId === row.id
                    const isDeleting = deleting === row.id

                    return (
                      <tr key={row.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30"
                        style={{ background: isEditing ? 'var(--color-background-info)' : isDeleting ? '#fef2f210' : undefined }}>

                        {/* Date */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="date" value={editForm.date_controle}
                              onChange={e => setEditForm(f=>({...f, date_controle:e.target.value}))}
                              className="input py-1 text-xs w-32"/>
                          ) : (
                            <span className="font-mono text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.date_controle)}</span>
                          )}
                        </td>

                        {/* Opérateur */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="text" value={editForm.operateur_nom}
                              onChange={e => setEditForm(f=>({...f, operateur_nom:e.target.value}))}
                              className="input py-1 text-xs w-36"/>
                          ) : (
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{row.operateur_nom || '—'}</span>
                          )}
                        </td>

                        {/* Position */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select value={editForm.position}
                              onChange={e => setEditForm(f=>({...f, position:e.target.value}))}
                              className="input py-1 text-xs w-20">
                              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <span className="font-mono text-xs font-bold text-brand">{row.position}</span>
                          )}
                        </td>

                        {/* Germes */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="number" min="0" step="1" value={editForm.germes}
                              onChange={e => setEditForm(f=>({...f, germes:e.target.value}))}
                              className="input py-1 text-xs w-20 font-mono text-center" autoFocus/>
                          ) : (
                            <span className={`font-mono font-bold text-xs ${row.germes >= NORME_PERSONNEL ? 'text-red-600' : 'text-green-600'}`}>
                              {row.germes ?? '—'}
                            </span>
                          )}
                        </td>

                        {/* Zone */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="text" value={editForm.zone}
                              onChange={e => setEditForm(f=>({...f, zone:e.target.value}))}
                              className="input py-1 text-xs w-28"/>
                          ) : (
                            <span className="text-xs text-gray-400">{row.zone || '—'}</span>
                          )}
                        </td>

                        {/* Lot */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="text" value={editForm.lot}
                              onChange={e => setEditForm(f=>({...f, lot:e.target.value}))}
                              className="input py-1 text-xs w-24"/>
                          ) : (
                            <span className="text-xs text-gray-400">{row.lot || '—'}</span>
                          )}
                        </td>

                        {/* Produit */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="text" value={editForm.produit}
                              onChange={e => setEditForm(f=>({...f, produit:e.target.value}))}
                              className="input py-1 text-xs w-28"/>
                          ) : (
                            <span className="text-xs text-gray-400">{row.produit || '—'}</span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-3 py-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                            {s.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="flex gap-1.5">
                              <button onClick={() => handleSaveEdit(row)} disabled={saving}
                                className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50">
                                {saving ? <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full"/> : '✓'} OK
                              </button>
                              <button onClick={() => { setEditId(null); setEditForm({}) }}
                                className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100">✕</button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button onClick={() => startEdit(row)}
                                className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded border border-gray-200 hover:border-brand transition-colors">✏️</button>
                              <button onClick={() => handleDelete(row.id)} disabled={isDeleting}
                                className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded border border-gray-200 hover:border-red-300 transition-colors disabled:opacity-40">
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
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">Page {page+1}/{totalPages} · {total} mesures</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">← Préc.</button>
                  {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                    const p = Math.max(0,Math.min(page-2,totalPages-5))+i
                    return <button key={p} onClick={()=>setPage(p)}
                      className={`text-xs w-8 h-7 rounded-lg border transition-colors ${page===p?'bg-navy text-white border-navy':'border-gray-200 hover:bg-gray-50'}`}>{p+1}</button>
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">Suiv. →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
