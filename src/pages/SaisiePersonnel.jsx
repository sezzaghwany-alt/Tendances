import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NORME = 5

const ZONES_CONFIG = {
  LABO_MICRO: {
    label: 'Laboratoire Microbiologie',
    icon:  '🧫',
    color: '#7c3aed',
    positions: ['MD','MG','BD','BG','AVD','AVG'],
  },
  REMPLISSAGE: {
    label: 'Remplissage Poches Stériles',
    icon:  '💊',
    color: '#1d6fa4',
    positions: ['MD','MG','AVD','AVG'],
  },
}

const POS_LABELS = {
  MD:  'Main droite',
  MG:  'Main gauche',
  BD:  'Buste droit',
  BG:  'Buste gauche',
  AVD: 'Avant-bras droit',
  AVG: 'Avant-bras gauche',
}

const POS_COLOR = {
  MD: '#185FA5', MG: '#185FA5',
  BD: '#854F0B', BG: '#854F0B',
  AVD: '#185FA5', AVG: '#185FA5',
}

function getStatut(val) {
  if (val === '' || val === undefined || val === null) return null
  const v = parseInt(val)
  if (isNaN(v)) return null
  if (v >= NORME) return 'nc'
  return 'ok'
}

const STATUT_STYLE = {
  nc: { border:'#fca5a5', bg:'#fef2f2', txt:'#dc2626' },
  ok: { border:'#86efac', bg:'#f0fdf4', txt:'#166534' },
}

function InputGermes({ value, onChange }) {
  const s = getStatut(value)
  const style = s ? STATUT_STYLE[s] : {}
  return (
    <input
      type="number" min="0" step="1"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder="0"
      style={{
        width: '58px', fontSize: 13, fontFamily: 'monospace', fontWeight: s === 'nc' ? 700 : 400,
        textAlign: 'center', padding: '5px 4px', borderRadius: 8,
        border: `1.5px solid ${s ? style.border : '#e2e8f0'}`,
        background: s ? style.bg : 'white',
        color: s ? style.txt : '#111',
        outline: 'none',
      }}
    />
  )
}

function LigneOperateur({ ligne, operateurs, positions, onChange, onRemove }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `220px repeat(${positions.length}, 66px) 34px`,
      gap: 8, alignItems: 'center',
      padding: '8px 12px',
      borderTop: '0.5px solid var(--color-border-tertiary)',
      background: positions.some(p => getStatut(ligne[p]) === 'nc') ? '#fef2f210' : undefined,
    }}>
      {/* Opérateur */}
      <select
        value={ligne.operateur_id || ''}
        onChange={e => {
          const op = operateurs.find(o => o.id === e.target.value)
          onChange({ ...ligne, operateur_id: e.target.value, operateur_nom: op?.full_name || '' })
        }}
        style={{ fontSize: 12, width: '100%', padding: '5px 6px', borderRadius: 8,
          border: '1.5px solid #e2e8f0', outline: 'none' }}>
        <option value="">— Sélectionner —</option>
        {operateurs.map(op => (
          <option key={op.id} value={op.id}>{op.full_name}</option>
        ))}
      </select>

      {/* Valeurs par position */}
      {positions.map(pos => (
        <InputGermes
          key={pos}
          value={ligne[pos] ?? ''}
          onChange={val => onChange({ ...ligne, [pos]: val })}
        />
      ))}

      {/* Supprimer */}
      <button onClick={onRemove}
        style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #fca5a5',
          background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ✕
      </button>
    </div>
  )
}

function newLigne() {
  return { id: Math.random().toString(36).slice(2), operateur_id: '', operateur_nom: '', MD:'', MG:'', BD:'', BG:'', AVD:'', AVG:'' }
}

export default function SaisiePersonnel() {
  const [selZone,    setSelZone]    = useState('LABO_MICRO')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [lot,        setLot]        = useState('')
  const [produit,    setProduit]    = useState('')
  const [lignes,     setLignes]     = useState([newLigne()])
  const [operateurs, setOperateurs] = useState([])
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState({ text:'', type:'' })

  const zoneCfg    = ZONES_CONFIG[selZone]
  const positions  = zoneCfg.positions

  // Charger opérateurs depuis Supabase
  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => setOperateurs(data || []))
  }, [])

  // Reset lignes au changement de zone
  useEffect(() => {
    setLignes([newLigne()])
  }, [selZone])

  function updateLigne(idx, newLigne) {
    setLignes(prev => prev.map((l, i) => i === idx ? newLigne : l))
  }

  function removeLigne(idx) {
    setLignes(prev => prev.length === 1 ? [newLigne()] : prev.filter((_, i) => i !== idx))
  }

  function addLigne() {
    setLignes(prev => [...prev, newLigne()])
  }

  // Stats conformité temps réel
  const stats = useMemo(() => {
    let total = 0, nc = 0, rens = 0
    lignes.forEach(l => {
      positions.forEach(p => {
        if (l[p] !== '' && l[p] !== undefined && l[p] !== null) {
          rens++
          total++
          if (getStatut(l[p]) === 'nc') nc++
        }
      })
    })
    return { total, nc, conforme: total - nc, rens }
  }, [lignes, positions])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 5000)
  }

  async function handleSave() {
    if (!date) return showMsg('Date obligatoire', 'error')
    const lignesRenseignees = lignes.filter(l =>
      l.operateur_id && positions.some(p => l[p] !== '' && l[p] !== undefined)
    )
    if (!lignesRenseignees.length) return showMsg('Aucune ligne renseignée', 'warn')

    setSaving(true)

    // Créer une ligne par position par opérateur
    const rows = []
    lignesRenseignees.forEach(l => {
      positions.forEach(p => {
        const val = l[p]
        if (val === '' || val === undefined || val === null) return
        const germes = parseInt(val) || 0
        rows.push({
          date_controle: date,
          operateur_id:  l.operateur_id || null,
          operateur_nom: l.operateur_nom,
          zone:          selZone,
          position:      p,
          germes,
          lot:           lot || null,
          produit:       produit || null,
          statut:        germes >= NORME ? 'nc' : 'ok',
        })
      })
    })

    const { error } = await supabase.from('controles_personnel').insert(rows)
    setSaving(false)

    if (error) return showMsg('Erreur : ' + error.message, 'error')

    showMsg(`✅ ${rows.length} mesure(s) enregistrées pour ${lignesRenseignees.length} opérateur(s)`)
    setLignes([newLigne()])
    setLot(''); setProduit('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Saisie — Contrôle du personnel</h1>
        <p className="text-gray-500 text-sm mt-1">Empreintes gants · Norme &lt;{NORME} UFC/boîte</p>
      </div>

      {/* Sélection zone */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ZONES_CONFIG).map(([code, cfg]) => (
          <button key={code} onClick={() => setSelZone(code)}
            style={{
              borderColor: selZone === code ? cfg.color : 'transparent',
              background:  selZone === code ? cfg.color : undefined,
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selZone === code
                ? 'text-white'
                : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
              }`}>
            <span>{cfg.icon}</span>
            {cfg.label}
            <span className="text-xs opacity-70">({cfg.positions.length} positions)</span>
          </button>
        ))}
      </div>

      {/* Infos séance */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm py-1.5"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">N° Lot</label>
            <input type="text" value={lot} onChange={e => setLot(e.target.value)}
              placeholder="Ex: LOT-2026-001" className="input text-sm py-1.5"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Produit</label>
            <input type="text" value={produit} onChange={e => setProduit(e.target.value)}
              placeholder="Ex: Glucose 5%" className="input text-sm py-1.5"/>
          </div>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
          msg.type === 'warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                 'bg-green-50 border border-green-200 text-green-700'
        }`}>{msg.text}</div>
      )}

      {/* Tableau saisie */}
      <div className="card overflow-hidden p-0">

        {/* En-têtes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `220px repeat(${positions.length}, 66px) 34px`,
          gap: 8, padding: '8px 12px',
          background: 'var(--color-background-secondary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Opérateur</div>
          {positions.map(p => (
            <div key={p} style={{ textAlign:'center' }}>
              <div className="text-[11px] font-bold" style={{ color: POS_COLOR[p] }}>{p}</div>
              <div className="text-[9px] text-gray-400">{POS_LABELS[p]}</div>
            </div>
          ))}
          <div/>
        </div>

        {/* Ligne norme */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `220px repeat(${positions.length}, 66px) 34px`,
          gap: 8, padding: '4px 12px',
          background: 'var(--color-background-secondary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}>
          <div className="text-[10px] text-gray-400 italic">Norme &lt;{NORME} UFC/boîte</div>
          {positions.map(p => (
            <div key={p} style={{ textAlign:'center', fontSize: 9, color: '#94a3b8' }}>UFC/bte</div>
          ))}
          <div/>
        </div>

        {/* Lignes opérateurs */}
        {lignes.map((ligne, idx) => (
          <LigneOperateur
            key={ligne.id}
            ligne={ligne}
            operateurs={operateurs}
            positions={positions}
            onChange={l => updateLigne(idx, l)}
            onRemove={() => removeLigne(idx)}
          />
        ))}

        {/* Bouton ajouter + stats */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          background: 'var(--color-background-secondary)',
        }}>
          <button onClick={addLigne}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 500,
              padding: '6px 14px', borderRadius: 8,
              border: '1.5px dashed var(--color-border-secondary)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Ajouter un opérateur
          </button>

          {stats.rens > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600 font-semibold">{stats.conforme} conforme{stats.conforme > 1 ? 's' : ''}</span>
              {stats.nc > 0 && <span className="text-red-600 font-semibold">{stats.nc} NC</span>}
              <span className="text-gray-400">{stats.rens} mesure{stats.rens > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Enregistrer */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-50">
          {saving
            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Enregistrement...</>
            : <>💾 Enregistrer tout</>
          }
        </button>
        <span className="text-xs text-gray-400">
          {lignes.filter(l => l.operateur_id).length} opérateur{lignes.filter(l => l.operateur_id).length > 1 ? 's' : ''} · {zoneCfg.label}
        </span>
      </div>

      {/* Légende */}
      <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span style={{ width:12, height:12, borderRadius:4, background:'#f0fdf4', border:'1.5px solid #86efac', display:'inline-block'}}/>
          Conforme (&lt;{NORME} UFC)
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width:12, height:12, borderRadius:4, background:'#fef2f2', border:'1.5px solid #fca5a5', display:'inline-block'}}/>
          Non conforme (≥{NORME} UFC)
        </span>
        <span style={{ marginLeft:'auto', fontStyle:'italic' }}>
          {selZone === 'REMPLISSAGE' ? '4 positions — sans bustes (BD/BG)' : '6 positions — contrôle complet'}
        </span>
      </div>
    </div>
  )
}
