import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ── Configuration complète ─────────────────────────────────────────────────
const CONFIG = {
  EPU: {
    label: 'Eau purifiée',
    color: '#185FA5',
    bg: '#E8F4FD',
    logbooks: [
      {
        id: 'LB1',
        label: 'Logbook 1 — Physico-chimie',
        frequences: ['Journalier','Hebdomadaire','Bimensuel','Mensuel'],
        parametres: [
          { id:'aspect',       label:'Aspect',        type:'select',
            options:['Limpide et incolore','Trouble','Coloré'],
            spec:'Liquide limpide et incolore', unite:'', conformeIf: v => v === 'Limpide et incolore' },
          { id:'conductivite', label:'Conductivité',  type:'number', step:0.01,
            spec:'≤ 5.1 µS/cm', unite:'µS/cm', norme:5.1, la:1.5, lac:2.6 },
        ]
      },
      {
        id: 'LB2',
        label: 'Logbook 2 — Microbiologie',
        frequences: ['Journalier','Hebdomadaire','Bimensuel','Mensuel'],
        parametres: [
          { id:'dgat',         label:'Germes totaux (DGAT)', type:'number', step:1,
            spec:'≤ 100 UFC/mL', unite:'UFC/mL', norme:100, la:30, lac:50 },
          { id:'germes_path',  label:'Germes pathogènes',    type:'select',
            options:['Absence','Présence'],
            spec:'Absence', unite:'', conformeIf: v => v === 'Absence' },
        ]
      },
      {
        id: 'LB3',
        label: 'Logbook 3 — Endotoxines (LAL)',
        frequences: ['LB3_EPU'],
        parametres: [
          { id:'lal', label:'Endotoxines (LAL)', type:'lal',
            spec:'≤ 0,25 UI/mL', unite:'UI/mL',
            options:['< 0.125 UI/mL — Conforme','≥ 0.25 UI/mL — Non conforme'],
            conformeIf: v => v === '< 0.125 UI/mL — Conforme' },
        ]
      },
    ],
    points: [
      { code:'S24.41',    label:'Sortie EDI — SEPTRON',        frequence:'Journalier'  },
      { code:'PeS658',    label:'Retour boucle E-651',         frequence:'Journalier'  },
      { code:'PeS607',    label:'Sortie cuve avant UV',        frequence:'Mensuel'     },
      { code:'PeS632',    label:'Sortie cuve après UV',        frequence:'Journalier'  },
      { code:'PeS701',    label:'Alimentation GVP',            frequence:'Mensuel'     },
      { code:'V436A.1.2', label:'Alim. GVP après pompe',      frequence:'Bimensuel'   },
      { code:'PeS703',    label:'Alimentation distillateur',   frequence:'Mensuel'     },
      { code:'V438A.1.3', label:'Alim. distillateur après pompe', frequence:'Bimensuel'},
      { code:'PeS707',    label:'Laverie zone dialyse',        frequence:'Bimensuel', lb3_epu:true   },
      { code:'PeS709',    label:'Prépa solution dialyse',      frequence:'Hebdomadaire', lb3_epu:true},
      { code:'PeS711',    label:'Prépa solution dialyse 2',    frequence:'Hebdomadaire', lb3_epu:true},
      { code:'PeS713',    label:'Salle prépa poches stériles', frequence:'Bimensuel'   },
      { code:'PeS715',    label:'Laverie prépa poches',        frequence:'Bimensuel'   },
      { code:'PeS717',    label:'Lavage prod. poches stériles',frequence:'Bimensuel'   },
      { code:'PeS719',    label:'Laverie vêtements production',frequence:'Mensuel'     },
      { code:'PeS721',    label:'Laverie zone CDP',            frequence:'Bimensuel'   },
    ]
  },
  EPPI: {
    label: 'Eau pour préparation injectable',
    color: '#6B21A8',
    bg: '#F3E8FF',
    logbooks: [
      {
        id: 'LB1',
        label: 'Logbook 1 — Physico-chimie',
        frequences: ['Journalier','Hebdomadaire'],
        parametres: [
          { id:'aspect',       label:'Aspect',       type:'select',
            options:['Limpide et incolore','Trouble','Coloré'],
            spec:'Liquide limpide et incolore', unite:'', conformeIf: v => v === 'Limpide et incolore' },
          { id:'cot',          label:'COT',          type:'number', step:1,
            spec:'≤ 500 ppb', unite:'ppb', norme:500, la:150, lac:250 },
          { id:'conductivite', label:'Conductivité', type:'number', step:0.01,
            spec:'≤ 1.3 µS/cm', unite:'µS/cm', norme:1.3, la:0.9, lac:1.1 },
        ]
      },
      {
        id: 'LB2',
        label: 'Logbook 2 — Microbiologie',
        frequences: ['Journalier','Hebdomadaire'],
        parametres: [
          { id:'dgat',        label:'Germes totaux (DGAT)', type:'number', step:1,
            spec:'≤ 10 UFC/mL', unite:'UFC/mL', norme:10, la:3, lac:5 },
          { id:'germes_path', label:'Germes pathogènes',    type:'select',
            options:['Absence','Présence'],
            spec:'Absence', unite:'', conformeIf: v => v === 'Absence' },
        ]
      },
      {
        id: 'LB3',
        label: 'Logbook 3 — Endotoxines (LAL)',
        frequences: ['Journalier','Hebdomadaire'],
        parametres: [
          { id:'lal', label:'Endotoxines (LAL)', type:'lal',
            spec:'≤ 0,25 UI/mL', unite:'UI/mL',
            options:['< 0.125 UI/mL — Conforme','≥ 0.25 UI/mL — Non conforme'],
            conformeIf: v => v === '< 0.125 UI/mL — Conforme' },
        ]
      },
    ],
    points: [
      { code:'V438A.4.4', label:'Distillateur Multistill',        frequence:'Journalier'  },
      { code:'Pes305',    label:'Sortie cuve stockage',            frequence:'Journalier'  },
      { code:'Pes526',    label:'Après réchauffage retour cuve',   frequence:'Journalier'  },
      { code:'Pes359',    label:'Sortie échangeur',                frequence:'Hebdomadaire'},
      { code:'VA402',     label:'Laverie mélange poches',          frequence:'Hebdomadaire'},
      { code:'VA140',     label:'Dernier point vapeur (autoclave)',frequence:'Hebdomadaire'},
    ]
  },
  EA: {
    label: "Eau alimentation",
    color: '#0F6E56',
    bg: '#E1F5EE',
    logbooks: [
      {
        id: 'LB1',
        label: 'Tous paramètres',
        frequences: ['Trimestriel'],
        parametres: [
          { id:'aspect',       label:'Aspect',        type:'select',
            options:['Limpide et incolore','Trouble','Coloré'],
            spec:'Liquide limpide et incolore', unite:'', conformeIf: v => v === 'Limpide et incolore' },
          { id:'pH',           label:'pH',            type:'number', step:0.1,
            spec:'6,5 à 8,5', unite:'', norme_min:6.5, norme:8.5 },
          { id:'durete',       label:'Dureté',        type:'number', step:0.1,
            spec:'≤ 45 °f', unite:'°f', norme:45 },
          { id:'alcalinite',   label:'Alcalinité TAC',type:'number', step:0.1,
            spec:'≤ 20 °F', unite:'°F', norme:20 },
          { id:'conductivite', label:'Conductivité',  type:'number', step:1,
            spec:'≤ 2700 µS/cm', unite:'µS/cm', norme:2700 },
          { id:'sulfate',      label:'Sulfates',      type:'number', step:1,
            spec:'≤ 400 mg/L', unite:'mg/L', norme:400 },
          { id:'chlorure',     label:'Chlorures',     type:'number', step:1,
            spec:'≤ 750 mg/L', unite:'mg/L', norme:750 },
          { id:'fer',          label:'Fer',           type:'number', step:0.01,
            spec:'≤ 0,3 mg/L', unite:'mg/L', norme:0.3 },
          { id:'nitrate',      label:'Nitrates',      type:'number', step:0.1,
            spec:'≤ 50 mg/L', unite:'mg/L', norme:50 },
          { id:'dgat',         label:'Germes totaux', type:'number', step:1,
            spec:'≤ 500 UFC/mL', unite:'UFC/mL', norme:500 },
          { id:'germes_path',  label:'Germes pathogènes', type:'select',
            options:['Absence','Présence'],
            spec:'Absence', unite:'', conformeIf: v => v === 'Absence' },
        ]
      },
    ],
    points: [
      { code:'Pe004', label:'Entrée préfiltration', frequence:'Trimestriel' },
    ]
  }
}

const FREQ_STYLE = {
  Journalier:    { bg:'#E8F4FD', txt:'#185FA5' },
  Hebdomadaire:  { bg:'#E8F5E9', txt:'#3B6D11' },
  Bimensuel:     { bg:'#FFF3E0', txt:'#854F0B' },
  Mensuel:       { bg:'#F3E8FF', txt:'#6B21A8' },
  Trimestriel:   { bg:'#F1F5F9', txt:'#475569' },
}

// ── Calcul conformité ──────────────────────────────────────────────────────
function getStatut(val, param) {
  if (val === '' || val === undefined || val === null) return null
  if (param.type === 'select' || param.type === 'lal') {
    if (param.conformeIf) return param.conformeIf(val) ? 'ok' : 'nc'
    return 'ok'
  }
  const v = parseFloat(val)
  if (isNaN(v)) return null
  // pH : plage
  if (param.norme_min !== undefined && (v < param.norme_min || v > param.norme)) return 'nc'
  if (param.norme_min === undefined) {
    if (param.norme  > 0 && v >= param.norme)  return 'nc'
    if (param.lac    > 0 && v >= param.lac)    return 'action'
    if (param.la     > 0 && v >= param.la)     return 'alerte'
  }
  return 'ok'
}

const STATUT_CFG = {
  ok:     { label:'Conforme',        bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Dépass. alerte',  bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Dépass. action',  bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'Non conforme',    bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

function BadgeStatut({ statut }) {
  if (!statut) return <span className="text-xs text-gray-300">—</span>
  const s = STATUT_CFG[statut]
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
      {s.label}
    </span>
  )
}

// ── Composant ligne paramètre ──────────────────────────────────────────────
function ParamRow({ param, val, onChange, typeColor }) {
  const statut = getStatut(val, param)
  const s = statut ? STATUT_CFG[statut] : null

  return (
    <div className="grid gap-3 px-3 py-2 rounded-lg items-center transition-colors"
      style={{ gridTemplateColumns:'1fr 200px 1fr 120px', background: s?.bg || 'transparent' }}>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{param.label}</div>

      <div>
        {param.type === 'number' && (
          <div className="flex items-center gap-2">
            <input type="number" step={param.step || 1} min={0} value={val ?? ''}
              onChange={e => onChange(e.target.value)} placeholder="—"
              className="w-24 text-center font-mono font-bold text-sm px-2 py-1.5 rounded-lg outline-none transition-all"
              style={{ border: s ? `1.5px solid ${s.border}` : '1.5px solid #e2e8f0',
                       background: s?.bg || 'white', color: s?.txt || '#111' }}
            />
            {param.unite && <span className="text-xs text-gray-400 whitespace-nowrap">{param.unite}</span>}
          </div>
        )}
        {param.type === 'select' && (
          <select value={val ?? ''} onChange={e => onChange(e.target.value)}
            className="input text-xs py-1.5 w-44"
            style={{ borderColor: s ? s.border : undefined }}>
            <option value="">— Sélectionner —</option>
            {param.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {param.type === 'lal' && (
          <div className="flex gap-2">
            {param.options.map(o => {
              const isConf = o.startsWith('<')
              const isSelected = val === o
              return (
                <button key={o} onClick={() => onChange(o)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: isSelected ? (isConf ? '#f0fdf4' : '#fef2f2') : 'var(--color-background-secondary)',
                    border: isSelected
                      ? `1.5px solid ${isConf ? '#86efac' : '#fca5a5'}`
                      : '1.5px solid var(--color-border-tertiary)',
                    color: isSelected ? (isConf ? '#166534' : '#991b1b') : 'var(--color-text-secondary)',
                  }}>
                  {isConf ? '< 0.125 UI/mL' : '≥ 0.25 UI/mL'}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div>{param.spec}</div>
        {param.la && <div className="text-amber-500 text-[10px] mt-0.5">LA:{param.la} · LAc:{param.lac}</div>}
      </div>

      <div><BadgeStatut statut={statut}/></div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function SaisieEaux() {
  const [selType,    setSelType]    = useState('EPU')
  const [selLB,      setSelLB]      = useState('LB1')
  const [selPoint,   setSelPoint]   = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [values,     setValues]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState({ text:'', type:'' })
  const [historique, setHistorique] = useState([])
  const [loadingHist,setLoadingHist]= useState(false)

  const cfg    = CONFIG[selType]
  const lb     = cfg.logbooks.find(l => l.id === selLB) || cfg.logbooks[0]
  const points = useMemo(() => {
    // LB3 EPU : uniquement PeS707, PeS709, PeS711
    if (selType === 'EPU' && selLB === 'LB3') return cfg.points.filter(p => p.lb3_epu)
    return cfg.points.filter(p => lb.frequences.includes(p.frequence))
  }, [selType, selLB, cfg, lb])

  // Reset au changement de type
  useEffect(() => {
    setSelLB(CONFIG[selType].logbooks[0].id)
    setValues({})
    setMsg({ text:'', type:'' })
  }, [selType])

  // Reset point au changement de LB
  useEffect(() => {
    setSelPoint(points[0]?.code || '')
    setValues({})
  }, [selLB, selType])

  useEffect(() => {
    if (points.length && !points.find(p => p.code === selPoint)) {
      setSelPoint(points[0]?.code || '')
    }
  }, [points])

  // Charger historique
  useEffect(() => {
    if (!selPoint || !selLB) return
    setLoadingHist(true)
    supabase.from('controles_eaux')
      .select('*')
      .eq('type_eau', selType)
      .eq('point_code', selPoint)
      .eq('logbook', selLB)
      .order('date_controle', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setHistorique(data || [])
        setLoadingHist(false)
      })
  }, [selType, selPoint, selLB])

  const pointInfo = points.find(p => p.code === selPoint)

  // Stats de saisie courante
  const stats = useMemo(() => {
    let ok=0, alerte=0, action=0, nc=0, rens=0
    lb.parametres.forEach(p => {
      const v = values[p.id]
      if (v !== '' && v !== undefined && v !== null) {
        rens++
        const s = getStatut(v, p)
        if (s === 'ok')     ok++
        if (s === 'alerte') alerte++
        if (s === 'action') action++
        if (s === 'nc')     nc++
      }
    })
    return { ok, alerte, action, nc, rens }
  }, [values, lb])

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  async function handleSave() {
    if (!date)     return showMsg('Date obligatoire', 'error')
    if (!selPoint) return showMsg('Point de prélèvement obligatoire', 'error')
    const rens = lb.parametres.filter(p => values[p.id] !== '' && values[p.id] !== undefined && values[p.id] !== null)
    if (!rens.length) return showMsg('Aucune valeur saisie', 'warn')

    setSaving(true)
    const rows = rens.map(p => ({
      type_eau:      selType,
      logbook:       selLB,
      point_code:    selPoint,
      localisation:  pointInfo?.label || '',
      date_controle: date,
      parametre:     p.id,
      valeur:        p.type === 'number' ? (parseFloat(values[p.id]) || 0) : null,
      valeur_text:   p.type !== 'number' ? values[p.id] : null,
      unite:         p.unite || null,
      statut:        getStatut(values[p.id], p) || 'ok',
    }))

    const { error } = await supabase.from('controles_eaux').insert(rows)
    if (error) { setSaving(false); return showMsg('Erreur : ' + error.message, 'error') }

    setSaving(false)
    showMsg(`${rows.length} paramètre(s) enregistrés — ${selPoint} · ${date.split('-').reverse().join('/')}`)
    setValues({})
    // Recharger historique
    const { data } = await supabase.from('controles_eaux')
      .select('*').eq('type_eau', selType).eq('point_code', selPoint).eq('logbook', selLB)
      .order('date_controle', { ascending: false }).limit(10)
    setHistorique(data || [])
  }

  function fmtDate(iso) {
    if (!iso) return ''
    const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie eaux pharmaceutiques</h1>
        <p className="text-gray-500 text-sm mt-1">EPU · EPPI · EA — Contrôles par logbook</p>
      </div>

      {/* Sélection type eau */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(CONFIG).map(([code, t]) => (
          <button key={code} onClick={() => setSelType(code)}
            style={{
              borderColor: selType===code ? t.color : 'transparent',
              background:  selType===code ? t.color : undefined,
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selType===code ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
            💧 {t.label}
          </button>
        ))}
      </div>

      {/* Sélection logbook */}
      <div className="flex gap-2 flex-wrap">
        {cfg.logbooks.map(l => (
          <button key={l.id} onClick={() => setSelLB(l.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors border ${
              selLB===l.id
                ? 'text-white border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900'
            }`}
            style={{ background: selLB===l.id ? cfg.color : undefined }}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Sélection point + date */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Point de prélèvement *</label>
            <select value={selPoint} onChange={e => setSelPoint(e.target.value)} className="input text-sm py-1.5">
              {points.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm py-1.5"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Fréquence</label>
            <div className="flex items-center h-9">
              {pointInfo && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: FREQ_STYLE[pointInfo.frequence]?.bg, color: FREQ_STYLE[pointInfo.frequence]?.txt }}>
                  {pointInfo.frequence}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message feedback */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700' :
          msg.type==='warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                               'bg-green-50 border border-green-200 text-green-700'
        }`}>{msg.text}</div>
      )}

      {/* Grille paramètres */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            {lb.label} — {selPoint}
          </div>
          {stats.rens > 0 && (
            <div className="flex gap-2 flex-wrap">
              {stats.ok     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT_CFG.ok.bg,    border:`1px solid ${STATUT_CFG.ok.border}`,    color:STATUT_CFG.ok.txt}}>{stats.ok} conforme{stats.ok>1?'s':''}</span>}
              {stats.alerte > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT_CFG.alerte.bg, border:`1px solid ${STATUT_CFG.alerte.border}`, color:STATUT_CFG.alerte.txt}}>{stats.alerte} alerte</span>}
              {stats.action > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT_CFG.action.bg, border:`1px solid ${STATUT_CFG.action.border}`, color:STATUT_CFG.action.txt}}>{stats.action} action</span>}
              {stats.nc     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT_CFG.nc.bg,     border:`1px solid ${STATUT_CFG.nc.border}`,     color:STATUT_CFG.nc.txt}}>{stats.nc} NC</span>}
            </div>
          )}
        </div>

        {/* En-têtes */}
        <div className="grid gap-3 px-3 pb-2 border-b border-gray-100 dark:border-gray-800 mb-1"
          style={{ gridTemplateColumns:'1fr 200px 1fr 120px' }}>
          {['Paramètre','Résultat','Spécification','Conformité'].map(h => (
            <div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        <div className="space-y-0.5">
          {lb.parametres.map(param => (
            <ParamRow key={param.id} param={param}
              val={values[param.id] ?? ''}
              onChange={v => setValues(prev => ({...prev, [param.id]: v}))}
              typeColor={cfg.color}
            />
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50">
            {saving
              ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
              : <>💾 Enregistrer</>
            }
          </button>
          {stats.rens > 0 && (
            <span className="text-xs text-gray-400">{stats.rens}/{lb.parametres.length} paramètres renseignés</span>
          )}
        </div>
      </div>

      {/* Historique récent */}
      {historique.length > 0 && (
        <div className="card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Historique récent — {selPoint} · {lb.id}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Paramètre','Résultat','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {historique.map((r, i) => {
                  const s = STATUT_CFG[r.statut]
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 pr-4 font-mono">{fmtDate(r.date_controle)}</td>
                      <td className="py-2 pr-4 font-medium">{r.parametre}</td>
                      <td className="py-2 pr-4 font-mono font-bold">{r.valeur ?? r.valeur_text ?? '—'} <span className="text-gray-400 font-normal">{r.unite}</span></td>
                      <td className="py-2 pr-4">
                        {s ? (
                          <span className="font-semibold px-2 py-0.5 rounded-full"
                            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                            {s.label}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
