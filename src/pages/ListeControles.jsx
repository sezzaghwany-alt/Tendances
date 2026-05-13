import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ZONES_POCHES = ['PREPARATION','REMPLISSAGE','PREP_REMPL']
const ZONE_POCHES_LABEL = 'Préparation Poches Stériles'

const STATUT_CFG = {
  ok:     { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',   bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',   bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

const PAGE_SIZE = 25

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function calcStatut(germes, norme, alerte, action) {
  if (germes === null || germes === undefined) return 'ok'
  const g = parseFloat(germes)
  if (isNaN(g)) return 'ok'
  if (norme  > 0 && g >= norme)  return 'nc'
  if (action > 0 && g >= action) return 'action'
  if (alerte > 0 && g >= alerte) return 'alerte'
  return 'ok'
}

export default function ListeControles() {
  const [rows,        setRows]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [zones,       setZones]       = useState([])
  const [salles,      setSalles]      = useState([])
  const [normes,      setNormes]      = useState([])
  const [page,        setPage]        = useState(0)
  const [editId,      setEditId]      = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [msg,         setMsg]         = useState({ text:'', type:'' })

  // Filtres
  const [filtreZone,   setFiltreZone]   = useState('ALL')
  const [filtreType,   setFiltreType]   = useState('ALL')
  const [filtreClasse, setFiltreClasse] = useState('ALL')
  const [filtreStatut, setFiltreStatut] = useState('ALL')
  const [dateDebut,    setDateDebut]    = useState('')
  const [dateFin,      setDateFin]      = useState('')
  const [annee,        setAnnee]        = useState(new Date().getFullYear())

  const ANNEES = (() => { const y = new Date().getFullYear(); return [y-1, y, y+1] })()

  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('id, code, label').eq('actif', true),
      supabase.from('salles').select('id, label, zone_id').eq('actif', true),
      supabase.from('normes').select('*, zones(code)'),
    ]).then(([z, s, n]) => {
      setZones(z.data || [])
      setSalles(s.data || [])
      setNormes(n.data || [])
    })
  }, [])

  // Zones fusionnées pour filtres
  const zonesAffichees = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const z of zones) {
      const code = ZONES_POCHES.includes(z.code) ? 'PREPARATION' : z.code
      if (!seen.has(code)) {
        seen.add(code)
        result.push({
          code,
          label: ZONES_POCHES.includes(z.code) ? ZONE_POCHES_LABEL : z.label,
          ids: ZONES_POCHES.includes(z.code)
            ? zones.filter(x => ZONES_POCHES.includes(x.code)).map(x => x.id)
            : [z.id]
        })
      }
    }
    return result
  }, [zones])

  // normesMap
  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => {
      const code = n.zones?.code
      if (!code) return
      if (n.classe) map[`${code}_${n.classe}_${n.type_controle}`] = n
      const key = `${code}_${n.type_controle}`
      if (!map[key]) map[key] = n
    })
    return map
  }, [normes])

  function getNormes(zoneCode, typeControle, classe) {
    return normesMap[`${zoneCode}_${classe}_${typeControle}`]
        || normesMap[`${zoneCode}_${typeControle}`]
        || { norme: 999, alerte: 0, action: 999 }
  }

  function getZoneCode(zoneId) {
    return zones.find(z => z.id === zoneId)?.code || ''
  }

  async function load() {
    setLoading(true)

    // Construire les zone_ids filtrés
    let zoneIds = null
    if (filtreZone !== 'ALL') {
      const zObj = zonesAffichees.find(z => z.code === filtreZone)
      zoneIds = zObj?.ids || []
    }

    const dDebut = dateDebut || `${annee}-01-01`
    const dFin   = dateFin   || `${annee}-12-31`

    let q = supabase.from('controles')
      .select('*, zones(code, label), salles(label)', { count:'exact' })
      .gte('date_controle', dDebut)
      .lte('date_controle', dFin)
      .order('date_controle', { ascending: false })
      .order('created_at',    { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (zoneIds)            q = q.in('zone_id', zoneIds)
    if (filtreType   !== 'ALL') q = q.eq('type_controle', filtreType)
    if (filtreClasse !== 'ALL') q = q.eq('classe', filtreClasse)
    if (filtreStatut !== 'ALL') q = q.eq('statut', filtreStatut)

    const { data, count, error } = await q
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => { setPage(0) }, [filtreZone, filtreType, filtreClasse, filtreStatut, dateDebut, dateFin, annee])
  useEffect(() => { load() }, [page, filtreZone, filtreType, filtreClasse, filtreStatut, dateDebut, dateFin, annee])

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  function startEdit(row) {
    setEditId(row.id)
    setEditForm({
      date_controle: row.date_controle || '',
      zone_id:       row.zone_id || '',
      salle_id:      row.salle_id || '',
      point:         row.point || '',
      type_controle: row.type_controle || '',
      classe:        row.classe || '',
      germes:        row.germes !== null ? String(row.germes) : '',
      lot:           row.lot || '',
    })
  }

  // Salles filtrées selon zone sélectionnée en édition
  const sallesEdit = useMemo(() => {
    if (!editForm.zone_id) return salles
    return salles.filter(s => s.zone_id === editForm.zone_id)
  }, [editForm.zone_id, salles])

  async function handleSaveEdit(row) {
    setSaving(true)
    const zoneCode = getZoneCode(editForm.zone_id || row.zone_id)
    const n = getNormes(zoneCode, editForm.type_controle, editForm.classe)
    const newStatut = calcStatut(editForm.germes, n.norme, n.alerte, n.action)

    const updates = {
      date_controle: editForm.date_controle,
      zone_id:       editForm.zone_id       || null,
      salle_id:      editForm.salle_id      || null,
      point:         editForm.point,
      type_controle: editForm.type_controle,
      classe:        editForm.classe,
      germes:        parseFloat(editForm.germes) ?? 0,
      lot:           editForm.lot           || null,
      statut:        newStatut,
    }

    const { error } = await supabase.from('controles').update(updates).eq('id', row.id)
    setSaving(false)
    if (error) return showMsg('Erreur : ' + error.message, 'error')
    setEditId(null); setEditForm({})
    showMsg('Mesure mise à jour ✅')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette mesure ? Cette action est irréversible.')) return
    setDeleting(id)
    const { error } = await supabase.from('controles').delete().eq('id', id)
    setDeleting(null)
    if (error) return showMsg('Erreur : ' + error.message, 'error')
    showMsg('Mesure supprimée')
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [filtreZone!=='ALL',filtreType!=='ALL',filtreClasse!=='ALL',filtreStatut!=='ALL',dateDebut,dateFin].filter(Boolean).length

  function resetFiltres() {
    setFiltreZone('ALL'); setFiltreType('ALL'); setFiltreClasse('ALL')
    setFiltreStatut('ALL'); setDateDebut(''); setDateFin('')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Liste des données — Environnement</h1>
          <p className="text-gray-500 text-sm mt-1">{total} mesure{total>1?'s':''} · modification et suppression</p>
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
          {/* Zone */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Zone</label>
            <select value={filtreZone} onChange={e => setFiltreZone(e.target.value)} className="input py-1.5 text-sm w-52">
              <option value="ALL">Toutes les zones</option>
              {zonesAffichees.map(z => <option key={z.code} value={z.code}>{z.label}</option>)}
            </select>
          </div>
          {/* Type */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-28">
              <option value="ALL">Tous</option>
              <option value="ACTIF">Actif</option>
              <option value="PASSIF">Passif</option>
              <option value="SURFACE">Surface</option>
            </select>
          </div>
          {/* Classe */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Classe</label>
            <select value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)} className="input py-1.5 text-sm w-28">
              <option value="ALL">Toutes</option>
              {['A','B','C','D'].map(c => <option key={c} value={c}>Cl. {c}</option>)}
            </select>
          </div>
          {/* Statut */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Statut</label>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="input py-1.5 text-sm w-28">
              <option value="ALL">Tous</option>
              <option value="ok">Conforme</option>
              <option value="alerte">Alerte</option>
              <option value="action">Action</option>
              <option value="nc">NC</option>
            </select>
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
                    {['Date','Zone','Salle','Point','Type','Cl.','Germes','Lot','Statut','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {rows.map(row => {
                    const s = STATUT_CFG[row.statut]
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

                        {/* Zone */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select value={editForm.zone_id}
                              onChange={e => setEditForm(f=>({...f, zone_id:e.target.value, salle_id:''}))}
                              className="input py-1 text-xs w-44">
                              {zones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {ZONES_POCHES.includes(row.zones?.code) ? 'Prép. Poches' : row.zones?.label}
                            </span>
                          )}
                        </td>

                        {/* Salle */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select value={editForm.salle_id}
                              onChange={e => setEditForm(f=>({...f, salle_id:e.target.value}))}
                              className="input py-1 text-xs w-36">
                              <option value="">— Salle —</option>
                              {sallesEdit.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">{row.salles?.label || '—'}</span>
                          )}
                        </td>

                        {/* Point */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="text" value={editForm.point}
                              onChange={e => setEditForm(f=>({...f, point:e.target.value.toUpperCase()}))}
                              className="input py-1 text-xs w-16 font-mono"/>
                          ) : (
                            <span className="font-mono text-xs font-bold text-brand">{row.point}</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select value={editForm.type_controle}
                              onChange={e => setEditForm(f=>({...f, type_controle:e.target.value}))}
                              className="input py-1 text-xs w-24">
                              <option value="ACTIF">Actif</option>
                              <option value="PASSIF">Passif</option>
                              <option value="SURFACE">Surface</option>
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">{row.type_controle}</span>
                          )}
                        </td>

                        {/* Classe */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select value={editForm.classe}
                              onChange={e => setEditForm(f=>({...f, classe:e.target.value}))}
                              className="input py-1 text-xs w-16">
                              {['A','B','C','D'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs font-bold text-gray-600">{row.classe}</span>
                          )}
                        </td>

                        {/* Germes */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="number" min="0" step="1" value={editForm.germes}
                              onChange={e => setEditForm(f=>({...f, germes:e.target.value}))}
                              className="input py-1 text-xs w-20 font-mono text-center" autoFocus/>
                          ) : (
                            <span className="font-mono font-bold text-xs">{row.germes ?? '—'}</span>
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

                        {/* Statut */}
                        <td className="px-3 py-2">
                          {s ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                              {s.label}
                            </span>
                          ) : '—'}
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
