import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ── Configuration des eaux pharmaceutiques ───────────────────────────────────
const TYPES_EAU = {
  EA: {
    label: 'Eau alimentation',
    couleur: '#0284c7',
    points: [
      { code: 'Pe004', localisation: 'Entrée préfiltration', frequence: 'Trimestriel' },
    ],
    parametres: [
      { id: 'aspect',       label: 'Aspect',         type: 'select',  options: ['Liquide limpide et incolore','Trouble','Coloré'], spec: 'Limpide et incolore', unite: '' },
      { id: 'pH',           label: 'pH',             type: 'number',  spec: '6.5 – 8.5',  unite: '',          la: null, lac: null, norme_max: 8.5 },
      { id: 'durete',       label: 'Dureté',         type: 'number',  spec: '≤ 45',        unite: '°f',        la: null, lac: null, norme_max: 45 },
      { id: 'alcalinite',   label: 'Alcalinité TAC', type: 'number',  spec: '≤ 20',        unite: '°F',        la: null, lac: null, norme_max: 20 },
      { id: 'conductivite', label: 'Conductivité',   type: 'number',  spec: '≤ 2700',      unite: 'µS/cm',     la: null, lac: null, norme_max: 2700 },
      { id: 'chlorure',     label: 'Chlorure',       type: 'number',  spec: '≤ 750',       unite: 'mg/L',      la: null, lac: null, norme_max: 750 },
      { id: 'sulfate',      label: 'Sulfate',        type: 'number',  spec: '≤ 400',       unite: 'mg/L',      la: null, lac: null, norme_max: 400 },
      { id: 'fer',          label: 'Fer',            type: 'number',  spec: '≤ 0.3',       unite: 'mg/L',      la: null, lac: null, norme_max: 0.3 },
      { id: 'nitrate',      label: 'Nitrate',        type: 'number',  spec: '≤ 50',        unite: 'mg/L',      la: null, lac: null, norme_max: 50 },
      { id: 'dgat',         label: 'DGAT',           type: 'number',  spec: '≤ 500',       unite: 'UFC/mL',    la: null, lac: null, norme_max: 500 },
      { id: 'germes_path',  label: 'Germes pathogènes', type: 'select', options: ['Absence','Présence'], spec: 'Absence', unite: '' },
    ]
  },
  EPU: {
    label: 'Eau purifiée',
    couleur: '#1d6fa4',
    points: [
      { code: 'S24.41',     localisation: 'Sortie EDI — Producteur SEPTRON',    frequence: 'Journalier' },
      { code: 'PeS658',     localisation: 'Retour boucle après échangeur E-651', frequence: 'Journalier' },
      { code: 'PeS607',     localisation: 'Sortie cuve avant UV',               frequence: 'Mensuel' },
      { code: 'PeS632',     localisation: 'Sortie cuve après UV',               frequence: 'Journalier' },
      { code: 'PeS701',     localisation: 'Alimentation GVP',                   frequence: 'Mensuel' },
      { code: 'V436A.1.2',  localisation: 'Alimentation GVP (après pompe)',     frequence: 'Bimensuel' },
      { code: 'PeS703',     localisation: 'Alimentation distillateur',          frequence: 'Mensuel' },
      { code: 'V438A.1.3',  localisation: 'Alimentation distillateur (après pompe)', frequence: 'Bimensuel' },
      { code: 'PeS707',     localisation: 'Laverie zone dialyse',               frequence: 'Bimensuel' },
      { code: 'PeS709',     localisation: 'Zone préparation solution dialyse',  frequence: 'Hebdomadaire' },
      { code: 'PeS711',     localisation: 'Zone préparation solution dialyse 2',frequence: 'Hebdomadaire' },
      { code: 'PeS713',     localisation: 'Salle préparation poches stériles',  frequence: 'Bimensuel' },
      { code: 'PeS715',     localisation: 'Laverie zone préparation poches',    frequence: 'Bimensuel' },
      { code: 'PeS717',     localisation: 'Lavage zone production poches',      frequence: 'Bimensuel' },
      { code: 'PeS719',     localisation: 'Laverie vêtements zone production',  frequence: 'Mensuel' },
      { code: 'PeS721',     localisation: 'Laverie zone CDP',                   frequence: 'Bimensuel' },
    ],
    parametres: [
      { id: 'aspect',       label: 'Aspect',         type: 'select',  options: ['Liquide limpide et incolore','Trouble','Coloré'], spec: 'Limpide et incolore', unite: '' },
      { id: 'conductivite', label: 'Conductivité',   type: 'number',  spec: '≤ 5.1',  unite: 'µS/cm',  la: 1.5,  lac: 2.6,  norme_max: 5.1 },
      { id: 'dgat',         label: 'DGAT',           type: 'number',  spec: '≤ 100',  unite: 'UFC/mL', la: 30,   lac: 50,   norme_max: 100 },
      { id: 'germes_path',  label: 'Germes pathogènes', type: 'select', options: ['Absence','Présence'], spec: 'Absence', unite: '' },
      { id: 'endotoxines',  label: 'Endotoxines',    type: 'number',  spec: '≤ 0.25', unite: 'UI/mL',  la: null, lac: null, norme_max: 0.25 },
    ]
  },
  EPPI: {
    label: 'Eau pour préparation injectable',
    couleur: '#7c3aed',
    points: [
      { code: 'V438A.4.4', localisation: 'Distillateur Multistill MS 750-4',     frequence: 'Journalier' },
      { code: 'Pes305',    localisation: 'Sortie cuve stockage avant échangeur',  frequence: 'Journalier' },
      { code: 'Pes359',    localisation: 'Sortie échangeur',                      frequence: 'Hebdomadaire' },
      { code: 'VA402',     localisation: 'Laverie mélange poches',                frequence: 'Hebdomadaire' },
      { code: 'Pes526',    localisation: 'Après réchauffage et retour cuve',      frequence: 'Journalier' },
      { code: 'VA140',     localisation: 'Dernier point distribution vapeur (autoclave)', frequence: 'Hebdomadaire' },
    ],
    parametres: [
      { id: 'aspect',       label: 'Aspect',         type: 'select',  options: ['Liquide limpide et incolore','Trouble','Coloré'], spec: 'Limpide et incolore', unite: '' },
      { id: 'conductivite', label: 'Conductivité',   type: 'number',  spec: '≤ 1.3',  unite: 'µS/cm',  la: 0.9,  lac: 1.1,  norme_max: 1.3 },
      { id: 'cot',          label: 'COT',            type: 'number',  spec: '≤ 500',  unite: 'ppb',    la: 150,  lac: 250,  norme_max: 500 },
      { id: 'nitrate',      label: 'Nitrate',        type: 'select',  options: ['Coloration moins intense que témoin','Coloration identique ou plus intense'], spec: 'Moins intense', unite: '' },
      { id: 'dgat',         label: 'DGAT',           type: 'number',  spec: '≤ 10',   unite: 'UFC/mL', la: 3,    lac: 5,    norme_max: 10 },
      { id: 'germes_path',  label: 'Germes pathogènes', type: 'select', options: ['Absence','Présence'], spec: 'Absence', unite: '' },
      { id: 'endotoxines',  label: 'Endotoxines',    type: 'number',  spec: '≤ 0.25', unite: 'UI/mL',  la: null, lac: null, norme_max: 0.25 },
    ]
  }
}

const FREQ_COLOR = {
  'Journalier':    { bg:'#E8F4FD', txt:'#185FA5' },
  'Hebdomadaire':  { bg:'#E8F5E9', txt:'#3B6D11' },
  'Bimensuel':     { bg:'#FFF3E0', txt:'#854F0B' },
  'Mensuel':       { bg:'#F3E8FF', txt:'#6B21A8' },
  'Trimestriel':   { bg:'#F1F5F9', txt:'#475569' },
}

function getStatut(val, param) {
  if (val === '' || val === undefined || val === null) return null
  if (param.type === 'select') {
    if (param.id === 'aspect' && val !== param.options[0]) return 'nc'
    if (param.id === 'germes_path' && val === 'Présence') return 'nc'
    if (param.id === 'nitrate' && val !== param.options[0]) return 'nc'
    return 'ok'
  }
  const v = parseFloat(val)
  if (isNaN(v)) return null
  if (param.norme_max && v > param.norme_max) return 'nc'
  if (param.lac && v >= param.lac) return 'action'
  if (param.la && v >= param.la) return 'alerte'
  return 'ok'
}

const STATUT = {
  ok:     { label:'Conforme',           bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Dépass. alerte',     bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Dépass. action',     bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'Non conforme',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

function BadgeStatut({ statut }) {
  if (!statut) return <span style={{ fontSize:11, color:'#94a3b8' }}>—</span>
  const s = STATUT[statut]
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
      background:s.bg, border:`1px solid ${s.border}`, color:s.txt, whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  )
}

export default function SaisieEaux() {
  const [selType, setSelType] = useState('EPU')
  const [selPoint, setSelPoint] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text:'', type:'' })
  const [historique, setHistorique] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const config = TYPES_EAU[selType]

  // Reset point quand type change
  useEffect(() => {
    setSelPoint(config.points[0]?.code || '')
    setValues({})
  }, [selType])

  // Reset valeurs quand point change
  useEffect(() => { setValues({}) }, [selPoint])

  // Charger historique
  useEffect(() => {
    if (!selPoint) return
    setLoadingHist(true)
    supabase.from('controles_eaux')
      .select('*')
      .eq('type_eau', selType)
      .eq('point_code', selPoint)
      .order('date_controle', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setHistorique(data || [])
        setLoadingHist(false)
      })
  }, [selType, selPoint])

  const pointInfo = config.points.find(p => p.code === selPoint)

  const stats = useMemo(() => {
    let ok=0, alerte=0, action=0, nc=0
    config.parametres.forEach(p => {
      const s = getStatut(values[p.id], p)
      if (s === 'ok')     ok++
      if (s === 'alerte') alerte++
      if (s === 'action') action++
      if (s === 'nc')     nc++
    })
    const rens = config.parametres.filter(p => values[p.id] !== '' && values[p.id] !== undefined).length
    return { ok, alerte, action, nc, rens }
  }, [values, config])

  function showMsg(text, type='ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  async function handleSave() {
    if (!date)     return showMsg('Date obligatoire', 'error')
    if (!selPoint) return showMsg('Point de prélèvement obligatoire', 'error')
    const rens = config.parametres.filter(p => values[p.id] !== '' && values[p.id] !== undefined)
    if (!rens.length) return showMsg('Aucune valeur saisie', 'warn')

    setSaving(true)
    const rows = rens.map(p => ({
      type_eau:      selType,
      point_code:    selPoint,
      localisation:  pointInfo?.localisation || '',
      date_controle: date,
      parametre:     p.id,
      valeur:        p.type === 'number' ? (parseFloat(values[p.id]) || 0) : null,
      valeur_text:   p.type === 'select' ? values[p.id] : null,
      unite:         p.unite || null,
      statut:        getStatut(values[p.id], p) || 'ok',
    }))

    const { error } = await supabase.from('controles_eaux').insert(rows)
    if (error) {
      setSaving(false)
      return showMsg('Erreur : ' + error.message, 'error')
    }

    setSaving(false)
    showMsg(`${rows.length} paramètre(s) enregistrés pour ${selPoint} — ${date.split('-').reverse().join('/')}`)
    setValues({})
    // Recharger historique
    const { data } = await supabase.from('controles_eaux')
      .select('*').eq('type_eau', selType).eq('point_code', selPoint)
      .order('date_controle', { ascending: false }).limit(15)
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
        <p className="text-gray-500 text-sm mt-1">EA · EPU · EPPI — Physico-chimie et microbiologie</p>
      </div>

      {/* Sélection type eau */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(TYPES_EAU).map(([code, t]) => (
          <button key={code} onClick={() => setSelType(code)}
            style={{ borderColor: selType===code ? t.couleur : 'transparent', background: selType===code ? t.couleur : undefined }}
            className={`px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selType===code ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sélection point + date */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Point de prélèvement *</label>
            <select value={selPoint} onChange={e => setSelPoint(e.target.value)} className="input text-sm py-1.5">
              {config.points.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.localisation}</option>
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
                  style={{ background: FREQ_COLOR[pointInfo.frequence]?.bg, color: FREQ_COLOR[pointInfo.frequence]?.txt }}>
                  {pointInfo.frequence}
                </span>
              )}
            </div>
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

      {/* Grille paramètres */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            Paramètres — {selPoint}
          </div>
          {stats.rens > 0 && (
            <div className="flex gap-2 flex-wrap">
              {stats.ok     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={STATUT.ok    ? {background:STATUT.ok.bg,    border:`1px solid ${STATUT.ok.border}`,    color:STATUT.ok.txt}    : {}}>{stats.ok} conforme{stats.ok>1?'s':''}</span>}
              {stats.alerte > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT.alerte.bg, border:`1px solid ${STATUT.alerte.border}`, color:STATUT.alerte.txt}}>{stats.alerte} alerte{stats.alerte>1?'s':''}</span>}
              {stats.action > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT.action.bg, border:`1px solid ${STATUT.action.border}`, color:STATUT.action.txt}}>{stats.action} action{stats.action>1?'s':''}</span>}
              {stats.nc     > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:STATUT.nc.bg,     border:`1px solid ${STATUT.nc.border}`,     color:STATUT.nc.txt}}>{stats.nc} NC</span>}
            </div>
          )}
        </div>

        {/* En-têtes */}
        <div className="grid gap-3 px-3 pb-2 border-b border-gray-100 dark:border-gray-800 mb-1"
          style={{ gridTemplateColumns:'1fr 160px 100px 90px 140px' }}>
          {['Paramètre','Résultat','Unité','Spécification','Conformité'].map(h => (
            <div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        <div className="space-y-0.5">
          {config.parametres.map(param => {
            const val = values[param.id] ?? ''
            const statut = getStatut(val, param)
            const scfg = statut ? STATUT[statut] : null
            return (
              <div key={param.id}
                className="grid gap-3 px-3 py-2 rounded-lg items-center transition-colors"
                style={{ gridTemplateColumns:'1fr 160px 100px 90px 140px', background: scfg?.bg || 'transparent' }}>
                <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">{param.label}</div>
                <div>
                  {param.type === 'number' ? (
                    <input type="number" min="0" step="0.01" value={val}
                      onChange={e => setValues(v => ({...v, [param.id]: e.target.value}))}
                      placeholder="—"
                      className="w-36 text-center font-mono font-bold text-sm px-2 py-1.5 rounded-lg outline-none transition-all"
                      style={{ border: scfg ? `1.5px solid ${scfg.border}` : '1.5px solid #e2e8f0',
                               background: scfg?.bg || 'white', color: scfg?.txt || '#111' }}
                    />
                  ) : (
                    <select value={val} onChange={e => setValues(v => ({...v, [param.id]: e.target.value}))}
                      className="input text-xs py-1 w-36"
                      style={{ borderColor: scfg ? scfg.border : undefined }}>
                      <option value="">— Sélectionner —</option>
                      {param.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
                <div className="text-xs text-gray-400">{param.unite || '—'}</div>
                <div className="text-xs text-gray-500">{param.spec}</div>
                <div><BadgeStatut statut={statut} /></div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50">
            {saving
              ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
              : <>💾 Enregistrer le contrôle</>
            }
          </button>
          {stats.rens > 0 && <span className="text-xs text-gray-400">{stats.rens}/{config.parametres.length} paramètres renseignés</span>}
        </div>
      </div>

      {/* Historique récent */}
      <div className="card p-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          Historique récent — {selPoint}
        </div>
        {loadingHist ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"/>
        ) : historique.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-sm">Aucun résultat enregistré pour ce point</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date','Paramètre','Résultat','Unité','Statut'].map(h => (
                    <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {historique.map((r, i) => {
                  const s = STATUT[r.statut]
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 pr-4 font-mono">{fmtDate(r.date_controle)}</td>
                      <td className="py-2 pr-4 font-medium">{r.parametre}</td>
                      <td className="py-2 pr-4 font-mono font-bold">{r.valeur ?? r.valeur_text ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-400">{r.unite || '—'}</td>
                      <td className="py-2 pr-4">
                        {s ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
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
        )}
      </div>
    </div>
  )
}
