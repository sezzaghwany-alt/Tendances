import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

// ── Configuration des écrans (depuis SOP 2026) ────────────────────────────
const ZONE_ECRANS = {
  LABO_MICRO:  { label:'Laboratoire Microbiologie', icon:'🔬', color:'#7c3aed',
    ecrans: ['Ecran1','Ecran2','Ecran3'] },
  PREPARATION: { label:'Préparation Poches Stériles', icon:'💊', color:'#1d6fa4',
    ecrans: ['Ecran4','Ecran5','Ecran6'] },
  PRELEVEMENT: { label:'Zone Prélèvement', icon:'🔬', color:'#0d9488',
    ecrans: ['Ecran7'] },
  CARTOUCHE:   { label:'Zone Cartouche', icon:'⚗️', color:'#dc2626',
    ecrans: ['Ecran8'] },
  DIALYSE:     { label:'Zone Dialyse', icon:'💧', color:'#0284c7',
    ecrans: ['Ecran9'] },
}

const ECRAN_META = {
  Ecran1: { label:'Salle Stérilité · Cl.B',     badge:'B', color:'#7c3aed' },
  Ecran2: { label:'Zones C · Labo Micro',        badge:'C', color:'#1d6fa4' },
  Ecran3: { label:'Zones D · Labo Micro',        badge:'D', color:'#16a34a' },
  Ecran4: { label:'Salle Remplissage · Cl.A+C',  badge:'A+C', color:'#0d9488' },
  Ecran5: { label:'Salle Préparation · Cl.C',    badge:'C', color:'#1d6fa4' },
  Ecran6: { label:'SAS & Zones D',               badge:'D', color:'#16a34a' },
  Ecran7: { label:'Zone Prélèvement',            badge:'D', color:'#16a34a' },
  Ecran8: { label:'Zone Cartouche',              badge:'D', color:'#16a34a' },
  Ecran9: { label:'Zone Dialyse',                badge:'D', color:'#16a34a' },
}

const CLASSE_BG = { A:'#FCE4EC', B:'#FFF3E0', C:'#E8F4FD', D:'#E8F5E9' }
const CLASSE_TXT = { A:'#993556', B:'#854F0B', C:'#185FA5', D:'#3B6D11' }

// ── Composant ligne de saisie ─────────────────────────────────────────────
function LigneSaisie({ pt, value, onChange, submitted }) {
  const val = parseFloat(value) || 0
  const isAction = pt.action > 0 && val >= pt.action
  const isAlerte = pt.alerte > 0 && val >= pt.alerte && !isAction
  const isNC = isAction || isAlerte

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isAction ? 'bg-red-50 dark:bg-red-900/10' :
      isAlerte ? 'bg-amber-50 dark:bg-amber-900/10' :
      'hover:bg-gray-50 dark:hover:bg-gray-800/30'
    }`}>
      {/* Code point */}
      <div className="w-12 font-mono font-bold text-sm text-brand shrink-0">{pt.point}</div>

      {/* Classe */}
      <div className="w-10 shrink-0">
        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
          background: CLASSE_BG[pt.classe]||'#f5f5f5',
          color: CLASSE_TXT[pt.classe]||'#333'
        }}>Cl.{pt.classe}</span>
      </div>

      {/* Localisation */}
      <div className="flex-1 text-xs text-gray-500 dark:text-gray-400 leading-tight">
        <div className="text-gray-400 text-[10px]">{pt.salle}</div>
        <div>{pt.localisation}</div>
      </div>

      {/* Norme/Alerte/Action */}
      <div className="text-[10px] text-gray-400 shrink-0 text-right hidden sm:block">
        {pt.norme > 0 && <div>N:{pt.norme}</div>}
        {pt.alerte > 0 && <div style={{color:'#d97706'}}>A:{pt.alerte}</div>}
        {pt.action > 0 && <div style={{color:'#dc2626'}}>Ac:{pt.action}</div>}
        <div className="text-[9px]">{pt.unite}</div>
      </div>

      {/* Input UFC */}
      <div className="shrink-0">
        <input
          type="number" min="0" step="1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className={`w-16 text-center font-mono font-bold text-sm px-2 py-1.5 border rounded-lg outline-none transition-all ${
            isAction ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
            isAlerte ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' :
            submitted && value !== '' ? 'border-green-400 bg-green-50 text-green-700' :
            'border-gray-200 dark:border-gray-700 focus:border-brand dark:bg-gray-800 dark:text-white'
          }`}
        />
      </div>

      {/* Indicateur NC */}
      <div className="w-6 shrink-0 text-center">
        {isAction && <span title="Dépassement action" className="text-red-500 text-sm">⛔</span>}
        {isAlerte && <span title="Dépassement alerte" className="text-amber-500 text-sm">⚠️</span>}
      </div>
    </div>
  )
}

// ── Page Saisie 2026 ──────────────────────────────────────────────────────
export default function Saisie2026() {
  const { user } = useAuth()
  const [zones, setZones]   = useState([])
  const [pointsDB, setPointsDB] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [msg, setMsg]           = useState({ text:'', type:'' })

  const [selZone,   setSelZone]   = useState('LABO_MICRO')
  const [selEcran,  setSelEcran]  = useState('Ecran1')
  const [selType,   setSelType]   = useState('ALL')
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [lot,       setLot]       = useState('')
  const [values,    setValues]    = useState({})  // { point_type: ufc }

  // Charger zones + points
  useEffect(() => {
    async function load() {
      const [z, p] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('points_controle').select('*, salles(label)').eq('actif', true),
      ])
      setZones(z.data || [])
      setPointsDB(p.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Réinitialiser valeurs quand écran change
  useEffect(() => { setValues({}); setSubmitted(false) }, [selEcran, selZone])

  // Réinitialiser écran quand zone change
  useEffect(() => {
    const ecrans = ZONE_ECRANS[selZone]?.ecrans || []
    setSelEcran(ecrans[0] || '')
  }, [selZone])

  // Zone ID depuis Supabase
  const zoneObj = useMemo(() => zones.find(z => z.code === selZone), [zones, selZone])

  // Points de l'écran depuis la base
  const pointsEcran = useMemo(() => {
    if (!zoneObj) return []
    return pointsDB
      .filter(p => p.zone_id === zoneObj.id && p.ecran === selEcran)
      .map(p => ({
        ...p,
        salle: p.salles?.label || '',
      }))
      .sort((a,b) => {
        // Tri : ACTIF d'abord, puis PASSIF, puis SURFACE, puis par code point
        const typeOrder = { ACTIF:0, PASSIF:1, SURFACE:2 }
        if (typeOrder[a.type_controle] !== typeOrder[b.type_controle])
          return typeOrder[a.type_controle] - typeOrder[b.type_controle]
        const na = parseInt(a.point.slice(1)), nb = parseInt(b.point.slice(1))
        return isNaN(na)||isNaN(nb) ? a.point.localeCompare(b.point) : na - nb
      })
  }, [pointsDB, zoneObj, selEcran])

  // Filtrer par type
  const pointsFiltres = useMemo(() =>
    selType === 'ALL' ? pointsEcran : pointsEcran.filter(p => p.type_controle === selType)
  , [pointsEcran, selType])

  // Grouper par salle
  const pointsBySalle = useMemo(() => {
    const map = {}
    pointsFiltres.forEach(p => {
      const s = p.salle || 'Autre'
      if (!map[s]) map[s] = []
      map[s].push(p)
    })
    return map
  }, [pointsFiltres])

  // Stats NC
  const stats = useMemo(() => {
    let nc_action = 0, nc_alerte = 0, renseignes = 0
    pointsEcran.forEach(p => {
      const key = `${p.point}_${p.type_controle}`
      const val = parseFloat(values[key]) || 0
      if (values[key] !== undefined && values[key] !== '') {
        renseignes++
        if (p.action_lim > 0 && val >= p.action_lim) nc_action++
        else if (p.alerte > 0 && val >= p.alerte) nc_alerte++
      }
    })
    return { nc_action, nc_alerte, renseignes, total: pointsEcran.length }
  }, [values, pointsEcran])

  function setValue(point, type, val) {
    setValues(prev => ({ ...prev, [`${point}_${type}`]: val }))
  }

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  // Enregistrer le contrôle
  async function handleSave() {
    if (!date) return showMsg('Date obligatoire', 'error')
    if (!zoneObj) return showMsg('Zone introuvable', 'error')
    const renseignes = Object.entries(values).filter(([,v]) => v !== '' && v !== undefined)
    if (renseignes.length === 0) return showMsg('Aucune valeur saisie', 'warn')

    setSaving(true)
    const rows = []
    renseignes.forEach(([key, val]) => {
      const [point, type_controle] = key.split('_')
      const ptDef = pointsEcran.find(p => p.point === point && p.type_controle === type_controle)
      if (!ptDef) return
      rows.push({
        zone_id: zoneObj.id,
        salle_id: ptDef.salle_id || null,
        date_controle: date,
        type_controle,
        point,
        classe: ptDef.classe,
        germes: parseFloat(val) || 0,
        lot: lot || null,
      })
    })

    const { error } = await supabase.from('controles').insert(rows)
    if (error) {
      setSaving(false)
      return showMsg(`Erreur : ${error.message}`, 'error')
    }

    setSaving(false)
    setSubmitted(true)
    showMsg(`✅ ${rows.length} résultat(s) enregistrés pour le ${date.split('-').reverse().join('/')}`)
    // Reset valeurs après 2s
    setTimeout(() => { setValues({}); setSubmitted(false); setLot('') }, 2000)
  }

  function handleReset() {
    if (!window.confirm('Effacer toutes les valeurs saisies ?')) return
    setValues({}); setSubmitted(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
    </div>
  )

  const zoneConfig = ZONE_ECRANS[selZone]
  const ecranMeta  = ECRAN_META[selEcran] || {}

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie 2026</h1>
        <p className="text-gray-500 text-sm mt-1">Contrôle microbiologique environnemental · Saisie par écran</p>
      </div>

      {/* ── Sélection zone ── */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ZONE_ECRANS).map(([code, z]) => (
          <button key={code} onClick={() => setSelZone(code)}
            style={{
              borderColor: selZone===code ? z.color : 'transparent',
              background: selZone===code ? z.color : undefined
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selZone===code ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {/* ── Sélection écran (multi-écrans uniquement) ── */}
      {zoneConfig.ecrans.length > 1 && (
        <div className="card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Écran de saisie</div>
          <div className="flex gap-3 flex-wrap">
            {zoneConfig.ecrans.map(e => {
              const m = ECRAN_META[e] || {}
              return (
                <button key={e} onClick={() => setSelEcran(e)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    selEcran===e
                      ? 'border-brand bg-brand/5 dark:bg-brand/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <div>
                    <div className={`text-xs font-bold ${selEcran===e?'text-brand':'text-gray-500'}`}>{e}</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">{m.label}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                    background: CLASSE_BG[m.badge?.split('+')[0]]||'#f5f5f5',
                    color: CLASSE_TXT[m.badge?.split('+')[0]]||'#333'
                  }}>Cl.{m.badge}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Entête saisie : date, lot, filtres ── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">N° Lot</label>
            <input type="text" value={lot} onChange={e => setLot(e.target.value)}
              placeholder="Ex: 2601001P" className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Afficher</label>
            <div className="flex gap-1">
              {[['ALL','Tous'],['ACTIF','🌬️ Actif'],['PASSIF','📦 Passif'],['SURFACE','🧴 Surface']].map(([v,l]) => (
                <button key={v} onClick={() => setSelType(v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selType===v ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Compteurs NC */}
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-gray-400">{stats.renseignes}/{stats.total} renseignés</span>
            {stats.nc_action > 0 && <span className="text-red-600 font-bold">⛔ {stats.nc_action} action</span>}
            {stats.nc_alerte > 0 && <span className="text-amber-600 font-bold">⚠️ {stats.nc_alerte} alerte</span>}
          </div>
        </div>
      </div>

      {/* ── Message feedback ── */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200' :
          msg.type==='warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                               'bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 dark:text-green-300'
        }`}>{msg.text}</div>
      )}

      {/* ── Liste des points par salle ── */}
      {pointsFiltres.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          Aucun point {selType !== 'ALL' ? `de type ${selType}` : ''} pour cet écran.
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {selEcran} — {ecranMeta.label} · {pointsFiltres.length} points
            </div>
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
              Effacer tout
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(pointsBySalle).map(([salle, pts]) => (
              <div key={salle}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1 flex items-center gap-2">
                  <span className="text-gray-300">▸</span> {salle}
                  <span className="text-gray-300">({pts.length} pts)</span>
                </div>
                <div className="space-y-0.5">
                  {pts.map(pt => (
                    <LigneSaisie
                      key={`${pt.point}_${pt.type_controle}`}
                      pt={{
                        point: pt.point,
                        salle: salle,
                        localisation: pt.localisation || '',
                        classe: pt.classe,
                        norme: pt.norme || 0,
                        alerte: pt.alerte || 0,
                        action: pt.action_lim || pt.action || 0,
                        unite: pt.unite || 'UFC',
                      }}
                      value={values[`${pt.point}_${pt.type_controle}`] ?? ''}
                      onChange={val => setValue(pt.point, pt.type_controle, val)}
                      submitted={submitted}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bouton sauvegarder */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5">
              {saving
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
                : <>💾 Enregistrer le contrôle</>
              }
            </button>
            <div className="text-xs text-gray-400">
              {stats.renseignes > 0 && `${stats.renseignes} valeur(s) à enregistrer`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
