import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { fullStats, interpretSeries } from '@/lib/statsUtils'
import ChartInterpretation from '@/components/ChartInterpretation'
import ConclusionZone from '@/components/ConclusionZone'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const TYPES = ['ACTIF','PASSIF','SURFACE']
const TYPE_LABELS = { ACTIF:'🌬️ Actif (air)', PASSIF:'📦 Passif (boîtes)', SURFACE:'🧴 Surfaces' }
const ANNEES = [2025, 2026, 2027]

// Zones poches à fusionner
const ZONES_POCHES = ['PREPARATION','REMPLISSAGE','PREP_REMPL']
const ZONE_POCHES_MERGED = {
  code: 'PREPARATION',
  label: 'Préparation Poches Stériles',
  color: '#1d6fa4',
  classe: 'C',
}

// Icônes personnalisées
const ZONE_ICONS = {
  LABO_MICRO:  { type:'emoji', val:'🧫' },
  PREPARATION: { type:'img',   val:'/icon_poches.webp' },
  PRELEVEMENT: { type:'img',   val:'/icon_prelevement.png' },
  CARTOUCHE:   { type:'emoji', val:'🫙' },
  DIALYSE:     { type:'img',   val:'/icon_dialyse.webp' },
}

function ZoneIcon({ code, size = 20 }) {
  const cfg = ZONE_ICONS[code]
  if (!cfg) return <span style={{ fontSize: size }}>🏭</span>
  if (cfg.type === 'img') return (
    <img src={cfg.val} alt={code} style={{ width: size, height: size, objectFit:'contain' }}/>
  )
  return <span style={{ fontSize: size }}>{cfg.val}</span>
}

function StatRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-bold text-gray-800 dark:text-white ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

async function loadControles(zoneCodes, annee, filtres) {
  let all = [], from = 0
  const dateDebut = filtres.dateDebut || `${annee}-01-01`
  const dateFin   = filtres.dateFin   || `${annee}-12-31`

  while (true) {
    let q = supabase
      .from('controles')
      .select('date_controle, type_controle, point, germes, classe, zone_id, zones(code,label,classe,icon,color)')
      .gte('date_controle', dateDebut)
      .lte('date_controle', dateFin)
      .order('date_controle', { ascending: true })
      .range(from, from + 999)

    if (filtres.classe !== 'ALL') q = q.eq('classe', filtres.classe)
    if (filtres.point) q = q.ilike('point', `%${filtres.point}%`)

    const { data, error } = await q
    if (error || !data?.length) break
    // Filtrer côté client par zone
    const filtered = data.filter(c => zoneCodes.includes(c.zones?.code))
    all = [...all, ...filtered]
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

export default function Tendances() {
  const [controles,    setControles]    = useState([])
  const [zones,        setZones]        = useState([])
  const [normes,       setNormes]       = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [loadingCtrl,  setLoadingCtrl]  = useState(false)

  const [annee,          setAnnee]         = useState(2025)
  const [filtreType,     setFiltreType]    = useState('ALL')
  const [filtreClasse,   setFiltreClasse]  = useState('ALL')
  const [filtrePoint,    setFiltrePoint]   = useState('')
  const [filtreTrimestre,setFiltreTrimestre] = useState('ALL')
  const [dateDebut,      setDateDebut]     = useState('')
  const [dateFin,        setDateFin]       = useState('')

  const filtreRef = useRef(null)
  const zonesRef  = useRef(null)

  // Charger zones et normes
  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('*').eq('actif', true),
      supabase.from('normes').select('*, zones(code)'),
    ]).then(([z, n]) => {
      setZones(z.data || [])
      setNormes(n.data || [])
      // Sélectionner la première zone fusionnée
      const first = z.data?.find(x => !ZONES_POCHES.includes(x.code) || x.code === 'PREPARATION')
      setSelectedZone(first?.code || z.data?.[0]?.code || null)
      setLoading(false)
    })
  }, [])

  // Zones fusionnées pour l'affichage
  const zonesAffichees = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const z of zones) {
      const code = ZONES_POCHES.includes(z.code) ? 'PREPARATION' : z.code
      if (!seen.has(code)) {
        seen.add(code)
        if (ZONES_POCHES.includes(z.code)) {
          result.push({ ...ZONE_POCHES_MERGED })
        } else {
          result.push(z)
        }
      }
    }
    return result
  }, [zones])

  // Codes sources pour la zone sélectionnée
  const zoneSourceCodes = useMemo(() => {
    if (!selectedZone) return []
    if (selectedZone === 'PREPARATION') return ZONES_POCHES
    return [selectedZone]
  }, [selectedZone])

  const selectedZoneObj = useMemo(() =>
    zonesAffichees.find(z => z.code === selectedZone)
  , [zonesAffichees, selectedZone])

  // Calcul période trimestre
  function getTrimestreDates(t, a) {
    const ranges = {
      T1: [`${a}-01-01`, `${a}-03-31`],
      T2: [`${a}-04-01`, `${a}-06-30`],
      T3: [`${a}-07-01`, `${a}-09-30`],
      T4: [`${a}-10-01`, `${a}-12-31`],
    }
    return ranges[t] || null
  }

  // Charger contrôles quand zone/filtres/année changent
  useEffect(() => {
    if (!selectedZone || zoneSourceCodes.length === 0) return
    setLoadingCtrl(true)

    let dDebut = dateDebut, dFin = dateFin
    if (filtreTrimestre !== 'ALL') {
      const r = getTrimestreDates(filtreTrimestre, annee)
      if (r) { dDebut = r[0]; dFin = r[1] }
    }

    loadControles(zoneSourceCodes, annee, {
      dateDebut: dDebut, dateFin: dFin,
      classe: filtreClasse, point: filtrePoint,
    }).then(data => {
      setControles(data)
      setLoadingCtrl(false)
    })
  }, [selectedZone, zoneSourceCodes, annee, filtreTrimestre, dateDebut, dateFin, filtreClasse, filtrePoint])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => {
      const code = n.zones?.code
      if (!code) return
      if (n.classe) map[`${code}_${n.classe}_${n.type_controle}`] = n
      // Fallback sans classe — ne pas écraser (garde la première = classe la + basse)
      const keyFallback = `${code}_${n.type_controle}`
      if (!map[keyFallback]) map[keyFallback] = n
    })
    return map
  }, [normes])

  function getNorme(type) {
    // Chercher pour chaque code source
    for (const code of zoneSourceCodes) {
      const n = filtreClasse !== 'ALL'
        ? normesMap[`${code}_${filtreClasse}_${type}`] || normesMap[`${code}_${type}`]
        : normesMap[`${code}_${type}`]
      if (n) return n
    }
    return null
  }

  const typesAffiches = filtreType === 'ALL' ? TYPES : [filtreType]

  const chartDataByType = useMemo(() => {
    const result = {}
    TYPES.forEach(type => {
      const filtered = controles.filter(c => c.type_controle === type)
      const map = {}
      filtered.forEach(c => {
        const d = new Date(c.date_controle)
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
        if (!map[key]) map[key] = { mois: MOIS[d.getMonth()], values: [], key }
        map[key].values.push(c.germes)
      })
      result[type] = Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({
          mois: v.mois,
          moy: +(v.values.reduce((s,x) => s+x, 0) / v.values.length).toFixed(2),
          max: Math.max(...v.values),
          n: v.values.length,
        }))
    })
    return result
  }, [controles])

  const statsAndInterpret = useMemo(() => {
    const result = {}
    TYPES.forEach(type => {
      const n = getNorme(type)
      const values = controles.filter(c => c.type_controle === type).map(c => c.germes)
      if (!values.length || !n) return
      result[type] = {
        stats: fullStats(values, n.alerte, n.action),
        interpretation: interpretSeries(values, n.alerte, n.action),
        normes: n,
      }
    })
    return result
  }, [controles, selectedZone, normesMap, filtreClasse, zoneSourceCodes])

  function handleTrimestreClick(t) {
    setFiltreTrimestre(t)
    setDateDebut(''); setDateFin('')
  }
  function handleDateChange(field, val) {
    setFiltreTrimestre('ALL')
    if (field === 'debut') setDateDebut(val)
    else setDateFin(val)
  }
  function handleAnneeChange(a) {
    setAnnee(a)
    setFiltreTrimestre('ALL')
    setDateDebut(''); setDateFin('')
  }
  function resetFiltres() {
    setFiltreType('ALL'); setFiltreClasse('ALL'); setFiltrePoint('')
    setFiltreTrimestre('ALL'); setDateDebut(''); setDateFin('')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tendances</h1>
        <p className="text-gray-500 text-sm mt-1">
          Analyse statistique — {controles.length} mesures · {annee}
        </p>
      </div>

      {/* ── Zones sticky ─────────────────────────────────────────────────── */}
      <div ref={zonesRef}
        className="sticky top-0 z-30 py-2"
        style={{ backdropFilter:'blur(10px)', background:'rgba(var(--bg-rgb,255,255,255),0.92)' }}>
        <div className="flex gap-2 flex-wrap">
          {zonesAffichees.map(z => (
            <button key={z.code} onClick={() => setSelectedZone(z.code)}
              style={{
                borderColor: selectedZone === z.code ? z.color : 'transparent',
                background:  selectedZone === z.code ? z.color : undefined,
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
                ${selectedZone === z.code
                  ? 'text-white'
                  : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-900'}`}>
              <ZoneIcon code={z.code} size={18}/>
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtres sticky (sous les zones) ──────────────────────────────── */}
      <div ref={filtreRef}
        className="card p-4 space-y-3 sticky top-12 z-20"
        style={{ boxShadow:'0 2px 12px rgba(0,0,0,.07)' }}>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔍 Filtres</span>
          <button onClick={resetFiltres} className="text-xs text-brand hover:underline">Réinitialiser</button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Année */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Année</label>
            <div className="flex gap-1">
              {ANNEES.map(a => (
                <button key={a} onClick={() => handleAnneeChange(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    annee === a ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
                  }`}>{a}</button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t => (
                <button key={t} onClick={() => handleTrimestreClick(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtreTrimestre === t
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
                  }`}>{t === 'ALL' ? `${annee}` : t}</button>
              ))}
            </div>
          </div>

          {/* Dates libres */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
              <input type="date" value={dateDebut} onChange={e => handleDateChange('debut', e.target.value)} className="input py-1.5 text-sm w-34"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
              <input type="date" value={dateFin} onChange={e => handleDateChange('fin', e.target.value)} className="input py-1.5 text-sm w-34"/>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Type</label>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ALL">Tous les types</option>
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
              {['A','B','C','D'].map(c => <option key={c} value={c}>Classe {c}</option>)}
            </select>
          </div>

          {/* Point */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Point</label>
            <input type="text" placeholder="ex: A1, S3..." value={filtrePoint}
              onChange={e => setFiltrePoint(e.target.value)} className="input py-1.5 text-sm w-28"/>
          </div>

          <div className="ml-auto text-xs text-gray-400 font-mono self-end pb-1.5">
            {loadingCtrl
              ? <span className="text-brand animate-pulse">Chargement...</span>
              : `${controles.length} mesures`
            }
          </div>
        </div>
      </div>

      {/* ── Zone sélectionnée — info ──────────────────────────────────────── */}
      {selectedZoneObj && (
        <div className="flex items-center gap-3 px-1">
          <ZoneIcon code={selectedZoneObj.code} size={28}/>
          <div>
            <div className="font-bold text-gray-900 dark:text-white">{selectedZoneObj.label}</div>
            <div className="text-xs text-gray-400">
              {selectedZone === 'PREPARATION'
                ? 'Fusion : Préparation + Remplissage Poches Stériles'
                : `Zone ${selectedZoneObj.code}`
              } · {annee}
            </div>
          </div>
        </div>
      )}

      {/* ── Graphiques par type ───────────────────────────────────────────── */}
      {!loadingCtrl && typesAffiches.map(type => {
        const data = chartDataByType[type] || []
        const sa = statsAndInterpret[type]
        if (!sa) return null
        const { stats, interpretation, normes: n } = sa

        return (
          <div key={type} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 dark:text-white text-lg">{TYPE_LABELS[type]}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{stats.n} mesures</span>
                <span className="text-xs text-gray-400 font-mono">{n.unite}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data} margin={{ top:4, right:16, left:-20, bottom:0 }}>
                    <defs>
                      <linearGradient id={`g${type}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={selectedZoneObj?.color || '#1d6fa4'} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={selectedZoneObj?.color || '#1d6fa4'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                    <XAxis dataKey="mois" tick={{ fontSize:10 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v, name) => [v, name === 'moy' ? 'Moy. UFC' : 'Max UFC']}/>
                    <ReferenceLine y={n.alerte} stroke="#d97706" strokeDasharray="4 4"
                      label={{ value:'Alerte', fill:'#d97706', fontSize:9, position:'right' }}/>
                    <ReferenceLine y={n.action} stroke="#dc2626" strokeDasharray="4 4"
                      label={{ value:'Action', fill:'#dc2626', fontSize:9, position:'right' }}/>
                    <Area type="monotone" dataKey="moy" name="moy"
                      stroke={selectedZoneObj?.color || '#1d6fa4'} strokeWidth={2.5}
                      fill={`url(#g${type})`} dot={{ r:4 }} connectNulls/>
                    <Area type="monotone" dataKey="max" name="max"
                      stroke="#dc2626" strokeWidth={1} strokeDasharray="3 3"
                      fill="none" dot={false} connectNulls/>
                  </AreaChart>
                </ResponsiveContainer>
                <ChartInterpretation interpretation={interpretation}/>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Statistiques</div>
                <StatRow label="N mesures"  value={stats.n} mono/>
                <StatRow label="Moyenne"    value={stats.mean.toFixed(2)} mono/>
                <StatRow label="Médiane"    value={stats.median.toFixed(2)} mono/>
                <StatRow label="Écart-type" value={stats.stdDev.toFixed(2)} mono/>
                <StatRow label="Min / Max"  value={`${stats.min} / ${stats.max}`} mono/>
                <StatRow label="P95"        value={stats.p95.toFixed(2)} mono/>
                <StatRow label="Cp"         value={stats.cp?.toFixed(2) ?? '—'} mono/>
                <StatRow label="Cpk"        value={stats.cpk?.toFixed(2) ?? '—'} mono/>
                <StatRow label="% > alerte" value={`${stats.pctAlerte.toFixed(1)}%`} mono/>
                <StatRow label="% > action" value={`${stats.pctAction.toFixed(1)}%`} mono/>
              </div>
            </div>
          </div>
        )
      })}

      {!loadingCtrl && controles.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          Aucune donnée pour cette sélection — {selectedZoneObj?.label} {annee}
        </div>
      )}

      {/* ── Conclusion annuelle ───────────────────────────────────────────── */}
      {!loadingCtrl && controles.length > 0 && filtreTrimestre === 'ALL' && !dateDebut && !dateFin &&
        typesAffiches.map(type => {
          const sa = statsAndInterpret[type]
          if (!sa) return null
          return (
            <ConclusionZone key={type}
              zone={selectedZoneObj?.label || selectedZone}
              type={type}
              classe={filtreClasse !== 'ALL' ? filtreClasse : selectedZoneObj?.classe}
              controles={controles.filter(c => c.type_controle === type)}
              normes={sa.normes}
              periode={null}
            />
          )
        })
      }
    </div>
  )
}
