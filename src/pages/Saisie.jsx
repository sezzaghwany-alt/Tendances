import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Pencil, Save, X, Trash2 } from 'lucide-react'

function getStatut(germes, n) {
  if (!n) return 'C'
  if (germes >= n.action) return 'NC_ACTION'
  if (germes >= n.alerte) return 'NC_ALERTE'
  return 'C'
}

function formatDate(d) {
  if (!d) return ''
  const [y, m, j] = d.split('-')
  return `${j}/${m}/${y}`
}

export default function Saisie() {
  const { profile } = useAuth()
  const [zones, setZones] = useState([])
  const [normes, setNormes] = useState([])
  const [points, setPoints] = useState([])
  const [controles, setControles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // État édition
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editJustification, setEditJustification] = useState('')

  const [form, setForm] = useState({
    zone_id: '', date_controle: new Date().toISOString().split('T')[0],
    type_controle: 'ACTIF', point: '', germes: '', lot: '', observations: ''
  })

  useEffect(() => {
    async function load() {
      const [z, n, p, c] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
        supabase.from('points_controle').select('*').eq('actif', true),
        supabase.from('controles')
          .select('*, zones(id,label,icon,code,classe), profiles(full_name)')
          .order('created_at', { ascending: false }).limit(50),
      ])
      setZones(z.data || [])
      setNormes(n.data || [])
      setPoints(p.data || [])
      setControles(c.data || [])
      if (z.data?.length) setForm(f => ({ ...f, zone_id: z.data[0].id }))
      setLoading(false)
    }
    load()
  }, [])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => { map[`${n.zones?.code}_${n.type_controle}`] = n })
    return map
  }, [normes])

  // Points filtrés pour le formulaire de saisie
  const pointsFiltresSaisie = useMemo(() =>
    points.filter(p => p.zone_id === form.zone_id && p.type_controle === form.type_controle)
      .sort((a, b) => a.point.localeCompare(b.point, undefined, { numeric: true }))
  , [points, form.zone_id, form.type_controle])

  // Points filtrés pour l'édition
  const pointsFiltresEdit = useMemo(() =>
    points.filter(p => p.zone_id === editForm.zone_id && p.type_controle === editForm.type_controle)
      .sort((a, b) => a.point.localeCompare(b.point, undefined, { numeric: true }))
  , [points, editForm.zone_id, editForm.type_controle])

  function handleZoneChange(zone_id) { setForm(f => ({ ...f, zone_id, point: '' })) }
  function handleTypeChange(type_controle) { setForm(f => ({ ...f, type_controle, point: '' })) }

  const selectedZone = zones.find(z => z.id === form.zone_id)
  const currentNormes = selectedZone ? normesMap[`${selectedZone.code}_${form.type_controle}`] : null
  const selectedPoint = points.find(p => p.zone_id === form.zone_id && p.type_controle === form.type_controle && p.point === form.point)
  const previewStatut = form.germes !== '' ? getStatut(Number(form.germes), currentNormes) : null

  async function handleSubmit() {
    if (!form.zone_id || !form.point || form.germes === '') return
    setSaving(true)
    const { data, error } = await supabase.from('controles').insert({
      zone_id: form.zone_id,
      date_controle: form.date_controle,
      type_controle: form.type_controle,
      point: form.point,
      classe: selectedPoint?.classe || null,
      germes: Number(form.germes),
      lot: form.lot || null,
      observations: form.observations || null,
      operateur_id: profile.id,
    }).select('*, zones(id,label,icon,code,classe), profiles(full_name)')
    setSaving(false)
    if (!error && data) {
      setSuccess(true)
      setControles(prev => [data[0], ...prev])
      setForm(f => ({ ...f, point: '', germes: '', lot: '', observations: '' }))
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  function startEdit(c) {
    setEditId(c.id)
    setEditForm({
      zone_id: c.zone_id,
      type_controle: c.type_controle,
      point: c.point,
      classe: c.classe,
      germes: c.germes,
      date_controle: c.date_controle,
    })
    setEditJustification('')
  }

  function handleEditZoneChange(zone_id) {
    setEditForm(f => ({ ...f, zone_id, point: '', classe: '' }))
  }
  function handleEditTypeChange(type_controle) {
    setEditForm(f => ({ ...f, type_controle, point: '', classe: '' }))
  }
  function handleEditPointChange(point) {
    const pt = points.find(p => p.zone_id === editForm.zone_id && p.type_controle === editForm.type_controle && p.point === point)
    setEditForm(f => ({ ...f, point, classe: pt?.classe || '' }))
  }

  async function handleSaveEdit(c) {
    if (!editJustification.trim()) { alert('Veuillez saisir une justification.'); return }

    // Enregistrer dans audit_trail les champs modifiés
    const fields = ['zone_id','type_controle','point','classe','germes','date_controle']
    for (const field of fields) {
      if (String(editForm[field]) !== String(c[field])) {
        await supabase.from('audit_trail').insert({
          table_name: 'controles', record_id: c.id, action: 'UPDATE',
          field_name: field,
          old_value: String(c[field]),
          new_value: String(editForm[field]),
          justification: editJustification,
          user_id: profile.id,
          user_name: profile.full_name,
        })
      }
    }

    await supabase.from('controles').update(editForm).eq('id', c.id)

    // Recharger la ligne mise à jour avec les jointures
    const { data } = await supabase
      .from('controles')
      .select('*, zones(id,label,icon,code,classe), profiles(full_name)')
      .eq('id', c.id)
      .single()

    setControles(prev => prev.map(row => row.id === c.id ? data : row))
    setEditId(null)
    setEditJustification('')
  }

  async function handleDelete(c) {
    if (!window.confirm(`Supprimer ce contrôle (${c.zones?.label} - ${c.point} - ${formatDate(c.date_controle)}) ?`)) return
    await supabase.from('audit_trail').insert({
      table_name: 'controles', record_id: c.id, action: 'DELETE',
      field_name: 'all', old_value: JSON.stringify({ date: c.date_controle, point: c.point, germes: c.germes }),
      new_value: 'SUPPRIMÉ', justification: 'Suppression manuelle',
      user_id: profile.id, user_name: profile.full_name,
    })
    await supabase.from('controles').delete().eq('id', c.id)
    setControles(prev => prev.filter(row => row.id !== c.id))
  }

  const badgeClass = s => s === 'NC_ACTION' ? 'badge-action' : s === 'NC_ALERTE' ? 'badge-alerte' : 'badge-ok'
  const badgeLabel = s => s === 'NC_ACTION' ? '⛔ Action' : s === 'NC_ALERTE' ? '⚠️ Alerte' : '✅ Conforme'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie d'un contrôle</h1>

      {/* Formulaire de saisie */}
      <div className="card p-6 max-w-2xl">
        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">
            ✅ Contrôle enregistré avec succès !
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Zone</label>
            <select value={form.zone_id} onChange={e => handleZoneChange(e.target.value)} className="input">
              {zones.map(z => <option key={z.id} value={z.id}>{z.icon} {z.label} (Classe {z.classe})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date_controle} onChange={e => setForm(f => ({ ...f, date_controle: e.target.value }))} className="input" />
            <div className="text-xs text-gray-400 mt-1">{formatDate(form.date_controle)}</div>
          </div>
          <div>
            <label className="label">Type de contrôle</label>
            <select value={form.type_controle} onChange={e => handleTypeChange(e.target.value)} className="input">
              <option value="ACTIF">🌬️ Actif</option>
              <option value="PASSIF">📦 Passif</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>
          <div>
            <label className="label">Point de prélèvement</label>
            <select value={form.point} onChange={e => setForm(f => ({ ...f, point: e.target.value }))} className="input">
              <option value="">-- Sélectionner --</option>
              {pointsFiltresSaisie.map(p => <option key={p.id} value={p.point}>{p.point} — Classe {p.classe}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Total des germes (UFC)</label>
            <input type="number" min="0" placeholder="0" value={form.germes}
              onChange={e => setForm(f => ({ ...f, germes: e.target.value }))}
              className="input text-2xl font-bold font-mono" />
          </div>
          <div>
            <label className="label">N° de lot (optionnel)</label>
            <input type="text" value={form.lot} onChange={e => setForm(f => ({ ...f, lot: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Observations</label>
            <input type="text" value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} className="input" />
          </div>
        </div>

        {currentNormes && (
          <div className="mt-4 grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            {[['Norme max', currentNormes.norme], ['Limite alerte', currentNormes.alerte], ['Limite action', currentNormes.action]].map(([l, v]) => (
              <div key={l} className="text-center">
                <div className="font-mono font-bold text-gray-800 dark:text-white text-lg">{v}</div>
                <div className="text-[10px] text-gray-400 font-semibold">{l} ({currentNormes.unite})</div>
              </div>
            ))}
          </div>
        )}

        {previewStatut && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Statut :</span>
            <span className={badgeClass(previewStatut)}>{badgeLabel(previewStatut)}</span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving || !form.point || form.germes === ''} className="btn-primary w-full mt-5 py-3">
          {saving ? 'Enregistrement...' : '💾 Enregistrer le contrôle'}
        </button>
      </div>

      {/* Tableau des contrôles récents */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">🕐 Contrôles récents — modification et suppression</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100 dark:border-gray-800">
                {['Zone','Date','Type','Point','Classe','UFC','Opérateur','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {controles.map(c => {
                const statut = getStatut(c.germes, normesMap[`${c.zones?.code}_${c.type_controle}`])
                const isEdit = editId === c.id
                return (
                  <tr key={c.id} className={`${isEdit ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                    {isEdit ? (
                      // ── Mode édition ──
                      <td colSpan={8} className="py-3 pr-3">
                        <div className="space-y-3">
                          <div className="grid grid-cols-5 gap-3">
                            {/* Zone */}
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Zone</label>
                              <select value={editForm.zone_id} onChange={e => handleEditZoneChange(e.target.value)} className="input py-1.5 text-sm mt-1">
                                {zones.map(z => <option key={z.id} value={z.id}>{z.icon} {z.label}</option>)}
                              </select>
                            </div>
                            {/* Type */}
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Type</label>
                              <select value={editForm.type_controle} onChange={e => handleEditTypeChange(e.target.value)} className="input py-1.5 text-sm mt-1">
                                <option value="ACTIF">🌬️ Actif</option>
                                <option value="PASSIF">📦 Passif</option>
                                <option value="SURFACE">🧴 Surface</option>
                              </select>
                            </div>
                            {/* Point */}
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Point</label>
                              <select value={editForm.point} onChange={e => handleEditPointChange(e.target.value)} className="input py-1.5 text-sm mt-1">
                                <option value="">-- Point --</option>
                                {pointsFiltresEdit.map(p => <option key={p.id} value={p.point}>{p.point} — Cl.{p.classe}</option>)}
                              </select>
                            </div>
                            {/* UFC */}
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">UFC</label>
                              <input type="number" min="0" value={editForm.germes}
                                onChange={e => setEditForm(f => ({ ...f, germes: Number(e.target.value) }))}
                                className="input py-1.5 text-sm font-mono font-bold mt-1" />
                            </div>
                            {/* Date */}
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Date</label>
                              <input type="date" value={editForm.date_controle}
                                onChange={e => setEditForm(f => ({ ...f, date_controle: e.target.value }))}
                                className="input py-1.5 text-sm mt-1" />
                            </div>
                          </div>
                          {/* Justification */}
                          <div className="flex items-center gap-3">
                            <input placeholder="⚠️ Justification obligatoire..." value={editJustification}
                              onChange={e => setEditJustification(e.target.value)}
                              className="input py-1.5 text-sm flex-1" />
                            <button onClick={() => handleSaveEdit(c)}
                              className="flex items-center gap-1 text-sm bg-green-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">
                              <Save size={14}/> Valider
                            </button>
                            <button onClick={() => { setEditId(null); setEditJustification('') }}
                              className="flex items-center gap-1 text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                              <X size={14}/> Annuler
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      // ── Mode affichage ──
                      <>
                        <td className="py-2 pr-3 whitespace-nowrap">{c.zones?.icon} {c.zones?.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-gray-500 whitespace-nowrap">{formatDate(c.date_controle)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs">{c.type_controle}</td>
                        <td className="py-2 pr-3 font-mono">{c.point}</td>
                        <td className="py-2 pr-3 text-xs text-gray-500">{c.classe ? `Cl.${c.classe}` : '—'}</td>
                        <td className="py-2 pr-3 font-mono font-bold">{c.germes}</td>
                        <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">{c.profiles?.full_name}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => startEdit(c)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors">
                              <Pencil size={13}/> Modifier
                            </button>
                            <button onClick={() => handleDelete(c)}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={13}/> Supprimer
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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
