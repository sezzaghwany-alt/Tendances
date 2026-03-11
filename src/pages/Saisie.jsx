import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Pencil, Save, X } from 'lucide-react'

function getStatut(germes, n) {
  if (!n) return 'C'
  if (germes >= n.action) return 'NC_ACTION'
  if (germes >= n.alerte) return 'NC_ALERTE'
  return 'C'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
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
  const [editId, setEditId] = useState(null)
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
        supabase.from('controles').select('*, zones(label,icon,code), profiles(full_name)').order('created_at', { ascending: false }).limit(30),
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

  // Points filtrés selon zone + type sélectionnés
  const pointsFiltres = useMemo(() => {
    return points.filter(p => p.zone_id === form.zone_id && p.type_controle === form.type_controle)
      .sort((a, b) => a.point.localeCompare(b.point, undefined, { numeric: true }))
  }, [points, form.zone_id, form.type_controle])

  // Reset point quand zone ou type change
  function handleZoneChange(zone_id) {
    setForm(f => ({ ...f, zone_id, point: '' }))
  }
  function handleTypeChange(type_controle) {
    setForm(f => ({ ...f, type_controle, point: '' }))
  }

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
    }).select('*, zones(label,icon,code), profiles(full_name)')
    setSaving(false)
    if (!error) {
      setSuccess(true)
      setControles(prev => [data[0], ...prev])
      setForm(f => ({ ...f, point: '', germes: '', lot: '', observations: '' }))
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  async function handleEdit(id, field, newValue) {
    if (!editJustification.trim()) return alert('Veuillez saisir une justification.')
    const old = controles.find(c => c.id === id)
    await supabase.from('audit_trail').insert({
      table_name: 'controles', record_id: id, action: 'UPDATE',
      field_name: field, old_value: String(old[field]), new_value: String(newValue),
      justification: editJustification, user_id: profile.id, user_name: profile.full_name,
    })
    await supabase.from('controles').update({ [field]: newValue }).eq('id', id)
    setControles(prev => prev.map(c => c.id === id ? { ...c, [field]: newValue } : c))
    setEditId(null)
    setEditJustification('')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie d'un contrôle</h1>

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
            <input type="date" value={form.date_controle}
              onChange={e => setForm(f => ({ ...f, date_controle: e.target.value }))} className="input" />
            <div className="text-xs text-gray-400 mt-1">{formatDate(form.date_controle)}</div>
          </div>
          <div>
            <label className="label">Type de contrôle</label>
            <select value={form.type_controle} onChange={e => handleTypeChange(e.target.value)} className="input">
              <option value="ACTIF">🌬️ Actif (air)</option>
              <option value="PASSIF">📦 Passif (boîtes)</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>
          <div>
            <label className="label">Point de prélèvement</label>
            <select value={form.point} onChange={e => setForm(f => ({ ...f, point: e.target.value }))} className="input">
              <option value="">-- Sélectionner un point --</option>
              {pointsFiltres.map(p => (
                <option key={p.id} value={p.point}>{p.point} — Classe {p.classe}</option>
              ))}
            </select>
            {form.zone_id && pointsFiltres.length === 0 && (
              <div className="text-xs text-yellow-500 mt-1">⚠️ Aucun point configuré pour ce type</div>
            )}
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

        {/* Normes référence */}
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

        {/* Statut prévisible */}
        {previewStatut && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Statut :</span>
            <span className={previewStatut === 'NC_ACTION' ? 'badge-action' : previewStatut === 'NC_ALERTE' ? 'badge-alerte' : 'badge-ok'}>
              {previewStatut === 'NC_ACTION' ? '⛔ Dépassement action' : previewStatut === 'NC_ALERTE' ? '⚠️ Dépassement alerte' : '✅ Conforme'}
            </span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving || !form.point || form.germes === ''} className="btn-primary w-full mt-5 py-3">
          {saving ? 'Enregistrement...' : '💾 Enregistrer le contrôle'}
        </button>
      </div>

      {/* Contrôles récents */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 dark:text-white mb-4">🕐 Contrôles récents (modifiables)</h2>
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
              {controles.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-2 pr-3 whitespace-nowrap">{c.zones?.icon} {c.zones?.label}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-500 whitespace-nowrap">{formatDate(c.date_controle)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{c.type_controle}</td>
                  <td className="py-2 pr-3 font-mono">{c.point}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500">{c.classe ? `Cl. ${c.classe}` : '—'}</td>
                  <td className="py-2 pr-3">
                    {editId === c.id ? (
                      <input type="number" defaultValue={c.germes} id={`edit_${c.id}`} className="input w-20 py-1 text-sm" />
                    ) : (
                      <span className="font-mono font-bold">{c.germes}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">{c.profiles?.full_name}</td>
                  <td className="py-2">
                    {editId === c.id ? (
                      <div className="space-y-1">
                        <input placeholder="Justification obligatoire..." value={editJustification}
                          onChange={e => setEditJustification(e.target.value)}
                          className="input text-xs py-1 w-48" />
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(c.id, 'germes', Number(document.getElementById(`edit_${c.id}`).value))}
                            className="flex items-center gap-1 text-xs bg-green-500 text-white px-2 py-1 rounded">
                            <Save size={12}/> Valider
                          </button>
                          <button onClick={() => { setEditId(null); setEditJustification('') }}
                            className="flex items-center gap-1 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            <X size={12}/> Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditId(c.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors">
                        <Pencil size={13}/> Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
