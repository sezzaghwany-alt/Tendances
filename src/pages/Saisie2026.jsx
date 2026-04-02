import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

const ZONE_ECRANS = {
  LABO_MICRO:  { label:'Laboratoire Microbiologie', icon:'🧫' , color:'#7c3aed', ecrans:['Ecran1','Ecran2','Ecran3'] },
  PREPARATION: { label:'Préparation Poches Stériles',    icon:'🔬',   val:'/icon_poches.webp', color:'#1d6fa4', ecrans:['Ecran4','Ecran5','Ecran6'] },
  PRELEVEMENT: { label:'Zone Prélèvement',               icon:'🔬', color:'#0d9488', ecrans:['Ecran7'] },
  CARTOUCHE:   { label:'Zone Cartouche',                 icon:'⚗️', color:'#dc2626', ecrans:['Ecran8'] },
  DIALYSE:     { label:'Zone Dialyse',                   icon:'💧', color:'#0284c7', ecrans:['Ecran9'] },
}
const ECRAN_META = {
  Ecran1:{ label:'Salle Stérilité · Cl.B',    badge:'B'   },
  Ecran2:{ label:'Zones C · Labo Micro',       badge:'C'   },
  Ecran3:{ label:'Zones D · Labo Micro',       badge:'D'   },
  Ecran4:{ label:'Salle Remplissage · Cl.A+C', badge:'A+C' },
  Ecran5:{ label:'Salle Préparation · Cl.C',   badge:'C'   },
  Ecran6:{ label:'SAS et Zones D',             badge:'D'   },
  Ecran7:{ label:'Zone Prélèvement',           badge:'D'   },
  Ecran8:{ label:'Zone Cartouche',             badge:'D'   },
  Ecran9:{ label:'Zone Dialyse',               badge:'D'   },
}
const CLASSE_BG  = { A:'#FCE4EC', B:'#FFF3E0', C:'#E8F4FD', D:'#E8F5E9' }
const CLASSE_TXT = { A:'#993556', B:'#854F0B', C:'#185FA5', D:'#3B6D11' }

function getStatut(val, norme, alerte, action) {
  if (val === '' || val === null || val === undefined) return null
  const v = parseFloat(val)
  if (isNaN(v)) return null
  if (norme > 0 && v >= norme)  return 'nc'
  if (action > 0 && v >= action) return 'action'
  if (alerte > 0 && v >= alerte) return 'alerte'
  return 'ok'
}

const STATUT_CFG = {
  ok:     { label:'Conforme',            bg:'#f0fdf4', border:'#86efac', txt:'#166534', rowBg:'transparent' },
  alerte: { label:'Dépassement alerte',  bg:'#fffbeb', border:'#fcd34d', txt:'#92400e', rowBg:'#fffbeb' },
  action: { label:'Dépassement action',  bg:'#fff7ed', border:'#fdba74', txt:'#9a3412', rowBg:'#fff7ed' },
  nc:     { label:'Non conforme',        bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b', rowBg:'#fef2f2' },
}

function BadgeStatut({ statut }) {
  if (!statut) return <span className="text-xs text-gray-300 font-mono">—</span>
  const cfg = STATUT_CFG[statut]
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.txt }}>
      {cfg.label}
    </span>
  )
}

function LigneSaisie({ pt, value, onChange }) {
  const statut = getStatut(value, pt.norme, pt.alerte, pt.action)
  const cfg = statut ? STATUT_CFG[statut] : null
  const hasVal = value !== '' && value !== undefined

  return (
    <div className="grid gap-2 px-3 py-2 rounded-lg transition-colors"
      style={{
        gridTemplateColumns: '52px 34px 1fr 110px 68px 150px',
        alignItems: 'center',
        background: cfg?.rowBg || 'transparent',
      }}>

      {/* Code point */}
      <div className="font-mono font-bold text-sm text-brand">{pt.point}</div>

      {/* Classe */}
      <div>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ background: CLASSE_BG[pt.classe]||'#f5f5f5', color: CLASSE_TXT[pt.classe]||'#333' }}>
          {pt.classe}
        </span>
      </div>

      {/* Localisation */}
      <div className="min-w-0">
        <div className="text-[10px] text-gray-400 truncate">{pt.salle}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{pt.localisation}</div>
      </div>

      {/* Norme / Alerte / Action */}
      <div className="text-[10px] leading-relaxed">
        <div className="text-gray-400">N : <span className="font-bold text-gray-600 dark:text-gray-300">{pt.norme > 0 ? pt.norme : '—'}</span></div>
        {pt.alerte > 0 && <div style={{ color:'#92400e' }}>A : {pt.alerte}</div>}
        {pt.action > 0 && <div style={{ color:'#9a3412' }}>Ac : {pt.action}</div>}
        <div className="text-gray-300 text-[9px]">{pt.unite}</div>
      </div>

      {/* Input UFC */}
      <div>
        <input
          type="number" min="0" step="1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-16 text-center font-mono font-bold text-sm px-2 py-1.5 rounded-lg outline-none transition-all"
          style={{
            border: cfg ? `1.5px solid ${cfg.border}` : '1.5px solid #e2e8f0',
            background: cfg?.bg || 'white',
            color: cfg?.txt || '#111',
          }}
        />
      </div>

      {/* Conformité */}
      <div><BadgeStatut statut={statut} /></div>
    </div>
  )
}

export default function Saisie2026() {
  const { user } = useAuth()
  const [zones,    setZones]    = useState([])
  const [pointsDB, setPointsDB] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState({ text:'', type:'' })

  const [selZone,  setSelZone]  = useState('LABO_MICRO')
  const [selEcran, setSelEcran] = useState('Ecran1')
  const [selType,  setSelType]  = useState('ALL')
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [lot,      setLot]      = useState('')
  const [values,   setValues]   = useState({})

  useEffect(() => {
    async function load() {
      const [z, p, n] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('points_controle').select('*, salles(label)').eq('actif', true),
        supabase.from('normes').select('*'),
      ])
      setZones(z.data || [])
      // Attacher les normes via zone_id + type_controle + classe
      const normesMap = {}
      ;(n.data || []).forEach(nm => {
        normesMap[`${nm.zone_id}_${nm.type_controle}_${nm.classe}`] = nm
        // Fallback sans classe
        if (!normesMap[`${nm.zone_id}_${nm.type_controle}`]) {
          normesMap[`${nm.zone_id}_${nm.type_controle}`] = nm
        }
      })
      const pts = (p.data || []).map(pt => {
        const keyClasse = `${pt.zone_id}_${pt.type_controle}_${pt.classe}`
        const keyFallback = `${pt.zone_id}_${pt.type_controle}`
        const nm = normesMap[keyClasse] || normesMap[keyFallback] || {}
        return {
          ...pt,
          norme:  nm.norme  || 0,
          alerte: nm.alerte || 0,
          action: nm.action || 0,
          unite:  nm.unite  || 'UFC',
        }
      })
      setPointsDB(pts)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const ecrans = ZONE_ECRANS[selZone]?.ecrans || []
    setSelEcran(ecrans[0] || '')
    setValues({})
  }, [selZone])

  useEffect(() => { setValues({}) }, [selEcran])

  const zoneObj = useMemo(() => zones.find(z => z.code === selZone), [zones, selZone])

  const pointsEcran = useMemo(() => {
    if (!zoneObj) return []
    return pointsDB
      .filter(p => p.zone_id === zoneObj.id && p.ecran === selEcran)
      .map(p => ({
        ...p,
        salle:  p.salles?.label || '',
        norme:  p.norme  || 0,
        alerte: p.alerte || 0,
        action: p.action || 0,
        unite:  p.unite  || 'UFC',
      }))
      .sort((a, b) => {
        const order = { ACTIF:0, PASSIF:1, SURFACE:2 }
        if (order[a.type_controle] !== order[b.type_controle])
          return order[a.type_controle] - order[b.type_controle]
        return a.point.localeCompare(b.point, undefined, { numeric:true })
      })
  }, [pointsDB, zoneObj, selEcran])

  const pointsFiltres = useMemo(() =>
    selType === 'ALL' ? pointsEcran : pointsEcran.filter(p => p.type_controle === selType)
  , [pointsEcran, selType])

  const pointsBySalle = useMemo(() => {
    const map = {}
    pointsFiltres.forEach(p => {
      const s = p.salle || 'Autre'
      if (!map[s]) map[s] = []
      map[s].push(p)
    })
    return map
  }, [pointsFiltres])

  // Stats conformité
  const stats = useMemo(() => {
    let ok=0, alerte=0, action=0, nc=0, rens=0
    pointsEcran.forEach(p => {
      const key = `${p.point}_${p.type_controle}`
      const val = values[key]
      if (val === undefined || val === '') return
      rens++
      const statut = getStatut(val, p.norme, p.alerte, p.action)
      if (statut === 'ok')     ok++
      if (statut === 'alerte') alerte++
      if (statut === 'action') action++
      if (statut === 'nc')     nc++
    })
    return { ok, alerte, action, nc, rens, total: pointsEcran.length }
  }, [values, pointsEcran])

  function setValue(point, type, val) {
    setValues(prev => ({ ...prev, [`${point}_${type}`]: val }))
  }

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  async function handleSave() {
    if (!date)    return showMsg('Date obligatoire', 'error')
    if (!zoneObj) return showMsg('Zone introuvable', 'error')
    const renseignes = Object.entries(values).filter(([,v]) => v !== '' && v !== undefined)
    if (renseignes.length === 0) return showMsg('Aucune valeur saisie', 'warn')

    setSaving(true)
    const rows = []
    renseignes.forEach(([key, val]) => {
      const [point, type_controle] = key.split('_')
      const ptDef = pointsEcran.find(p => p.point === point && p.type_controle === type_controle)
      if (!ptDef) return
      const statut = getStatut(val, ptDef.norme, ptDef.alerte, ptDef.action)
      rows.push({
        zone_id:        zoneObj.id,
        salle_id:       ptDef.salle_id || null,
        date_controle:  date,
        type_controle,
        point,
        classe:         ptDef.classe,
        germes:         parseFloat(val) || 0,
        lot:            lot || null,
        statut:         statut || 'ok',
      })
    })

    const { error } = await supabase.from('controles').insert(rows)
    if (error) { setSaving(false); return showMsg('Erreur : ' + error.message, 'error') }

    setSaving(false)
    showMsg(`${rows.length} résultat(s) enregistrés pour le ${date.split('-').reverse().join('/')}`)
    setTimeout(() => { setValues({}); setLot('') }, 1500)
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
        <p className="text-gray-500 text-sm mt-1">Contrôle microbiologique environnemental</p>
      </div>

      {/* Sélection zone */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ZONE_ECRANS).map(([code, z]) => (
          <button key={code} onClick={() => setSelZone(code)}
            style={{
              borderColor: selZone===code ? z.color : 'transparent',
              background:  selZone===code ? z.color : undefined,
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selZone===code ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {/* Sélection écran si multi */}
      {zoneConfig.ecrans.length > 1 && (
        <div className="card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Écran de saisie</div>
          <div className="flex gap-3 flex-wrap">
            {zoneConfig.ecrans.map(e => {
              const m = ECRAN_META[e] || {}
              return (
                <button key={e} onClick={() => setSelEcran(e)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    selEcran===e ? 'border-brand bg-brand/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <div>
                    <div className={`text-xs font-bold ${selEcran===e?'text-brand':'text-gray-400'}`}>{e}</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">{m.label}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: CLASSE_BG[m.badge?.split('+')[0]]||'#f5f5f5', color: CLASSE_TXT[m.badge?.split('+')[0]]||'#333' }}>
                    Cl.{m.badge}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Entête saisie */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">N° Lot</label>
            <input type="text" value={lot} onChange={e => setLot(e.target.value)} placeholder="Ex: 2601001P" className="input py-1.5 text-sm w-36"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Afficher</label>
            <div className="flex gap-1">
              {[['ALL','Tous'],['ACTIF','Actif'],['PASSIF','Passif'],['SURFACE','Surface']].map(([v,l]) => (
                <button key={v} onClick={() => setSelType(v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selType===v ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Légende conformité */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {[
              { s:'ok',     label:'Conforme' },
              { s:'alerte', label:'Alerte' },
              { s:'action', label:'Action' },
              { s:'nc',     label:'NC' },
            ].map(({ s, label }) => {
              const cfg = STATUT_CFG[s]
              return (
                <span key={s} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.txt }}>
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700' :
          msg.type==='warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                               'bg-green-50 border border-green-200 text-green-700'
        }`}>{msg.text}</div>
      )}

      {/* Liste des points */}
      {pointsFiltres.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">Aucun point pour cet écran.</div>
      ) : (
        <div className="card p-4">
          {/* En-tête colonnes */}
          <div className="grid gap-2 px-3 pb-2 border-b border-gray-100 dark:border-gray-800 mb-1"
            style={{ gridTemplateColumns:'52px 34px 1fr 110px 68px 150px' }}>
            {['Point','Cl.','Localisation','N / A / Ac','UFC','Conformité'].map(h => (
              <div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</div>
            ))}
          </div>

          <div className="space-y-0">
            {Object.entries(pointsBySalle).map(([salle, pts]) => (
              <div key={salle}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mt-3 mb-1 flex items-center gap-2">
                  <span>▸ {salle}</span>
                  <span className="text-gray-300">({pts.length})</span>
                </div>
                {pts.map(pt => (
                  <LigneSaisie
                    key={`${pt.point}_${pt.type_controle}`}
                    pt={{
                      point:       pt.point,
                      salle:       salle,
                      localisation:pt.localisation || '',
                      classe:      pt.classe,
                      norme:       pt.norme,
                      alerte:      pt.alerte,
                      action:      pt.action,
                      unite:       pt.unite,
                    }}
                    value={values[`${pt.point}_${pt.type_controle}`] ?? ''}
                    onChange={val => setValue(pt.point, pt.type_controle, val)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Résumé conformité */}
          {stats.rens > 0 && (
            <div className="mt-4 mx-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-gray-400">{stats.rens}/{stats.total} renseignés</span>
              {stats.ok     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:STATUT_CFG.ok.bg,     border:`1px solid ${STATUT_CFG.ok.border}`,     color:STATUT_CFG.ok.txt     }}>{stats.ok} conforme{stats.ok>1?'s':''}</span>}
              {stats.alerte > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:STATUT_CFG.alerte.bg, border:`1px solid ${STATUT_CFG.alerte.border}`, color:STATUT_CFG.alerte.txt }}>{stats.alerte} alerte{stats.alerte>1?'s':''}</span>}
              {stats.action > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:STATUT_CFG.action.bg, border:`1px solid ${STATUT_CFG.action.border}`, color:STATUT_CFG.action.txt }}>{stats.action} action{stats.action>1?'s':''}</span>}
              {stats.nc     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:STATUT_CFG.nc.bg,     border:`1px solid ${STATUT_CFG.nc.border}`,     color:STATUT_CFG.nc.txt     }}>{stats.nc} non conforme{stats.nc>1?'s':''}</span>}
            </div>
          )}

          {/* Bouton enregistrer */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50">
              {saving
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
                : <>💾 Enregistrer le contrôle</>
              }
            </button>
            {stats.rens > 0 && (
              <span className="text-xs text-gray-400">{stats.rens} valeur{stats.rens>1?'s':''} à enregistrer</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
