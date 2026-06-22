import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ANNEES = (() => { const y = new Date().getFullYear(); return [y-1, y, y+1] })()
const MOIS   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// Normes par type et paramètre
const NORMES = {
  EPU: {
    conductivite: { norme:5.1,  la:1.5,  lac:2.6,  unite:'µS/cm'   },
    dgat:         { norme:100,  la:30,   lac:50,   unite:'UFC/mL'  },
    endotoxines:  { norme:0.25, la:null, lac:null,  unite:'UI/mL'   },
  },
  EPPI: {
    conductivite: { norme:1.3,  la:0.9,  lac:1.1,  unite:'µS/cm'   },
    cot:          { norme:500,  la:150,  lac:250,  unite:'ppb'     },
    dgat:         { norme:10,   la:3,    lac:5,    unite:'UFC/mL'  },
    endotoxines:  { norme:0.25, la:null, lac:null,  unite:'UI/mL'   },
  },
  EA: {
    conductivite: { norme:2700, la:null, lac:null,  unite:'µS/cm'   },
    dgat:         { norme:500,  la:null, lac:null,  unite:'UFC/mL'  },
    pH:           { norme:8.5,  la:null, lac:null,  unite:''        },
  },
}

const TYPE_COLOR  = { EPU:'#185FA5', EPPI:'#6B21A8', EA:'#0F6E56' }
const TYPE_BG     = { EPU:'#E8F4FD', EPPI:'#F3E8FF', EA:'#E1F5EE' }

const STATUT_CFG = {
  ok:     { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' },
  alerte: { label:'Alerte',   bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' },
  action: { label:'Action',   bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' },
  nc:     { label:'NC',       bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' },
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`
}

function getStatVal(row) {
  return row.valeur !== null ? row.valeur : null
}

function calcStats(vals, la, lac, norme) {
  if (!vals.length) return null
  const n    = vals.length
  const mean = vals.reduce((a,b) => a+b, 0) / n
  const sorted = [...vals].sort((a,b) => a-b)
  const median = n%2 ? sorted[Math.floor(n/2)] : (sorted[n/2-1]+sorted[n/2])/2
  const std  = Math.sqrt(vals.reduce((a,b) => a+(b-mean)**2, 0) / n)
  const max  = Math.max(...vals)
  const min  = Math.min(...vals)
  const pLa  = la  ? Math.round(vals.filter(v=>v>=la).length/n*100)  : 0
  const pLac = lac ? Math.round(vals.filter(v=>v>=lac).length/n*100) : 0
  const pNC  = norme ? Math.round(vals.filter(v=>v>=norme).length/n*100) : 0
  const txConf = Math.round(vals.filter(v => !la || v<la).length/n*100)
  return { n, mean, median, std, max, min, pLa, pLac, pNC, txConf }
}

// ── Mini graphique SVG par point ──────────────────────────────────────────
function MiniChart({ data, la, lac, norme, unite }) {
  if (!data.length) return null
  const vals = data.map(d => d.valeur)
  const maxV = Math.max(...vals, lac ? lac*1.3 : norme*1.1)
  const W=340, H=80, PL=4, PR=50, PT=10, PB=20
  const cW = W-PL-PR, cH = H-PT-PB
  const toX = (i) => PL + (i/(data.length-1||1))*cW
  const toY = (v) => PT + cH - (v/maxV)*cH

  const pts = data.map((d,i) => `${toX(i)},${toY(d.valeur)}`).join(' ')

  return (
    <svg width={W} height={H} style={{ overflow:'visible' }}>
      {/* Ligne alerte */}
      {la && (
        <line x1={PL} y1={toY(la)} x2={W-PR} y2={toY(la)}
          stroke="#d97706" strokeWidth={1} strokeDasharray="4 3"/>
      )}
      {/* Ligne action */}
      {lac && (
        <line x1={PL} y1={toY(lac)} x2={W-PR} y2={toY(lac)}
          stroke="#dc2626" strokeWidth={1} strokeDasharray="4 3"/>
      )}
      {/* Ligne norme */}
      {norme && (
        <line x1={PL} y1={toY(norme)} x2={W-PR} y2={toY(norme)}
          stroke="#2563eb" strokeWidth={1.5} strokeDasharray="6 3"/>
      )}
      {/* Labels limites */}
      {la   && <text x={W-PR+3} y={toY(la)+3}   fontSize={8} fill="#d97706">LA {la}</text>}
      {lac  && <text x={W-PR+3} y={toY(lac)+3}  fontSize={8} fill="#dc2626">LAc {lac}</text>}
      {norme && <text x={W-PR+3} y={toY(norme)+3} fontSize={8} fill="#2563eb">N {norme}</text>}
      {/* Courbe */}
      <polyline points={pts} fill="none" stroke="#1d6fa4" strokeWidth={1.5}/>
      {/* Points */}
      {data.map((d,i) => {
        const col = d.valeur >= (norme||Infinity) ? '#dc2626'
                  : d.valeur >= (lac||Infinity)   ? '#d97706'
                  : d.valeur >= (la||Infinity)    ? '#f59e0b'
                  : '#1d6fa4'
        return <circle key={i} cx={toX(i)} cy={toY(d.valeur)} r={2.5} fill={col}/>
      })}
      {/* Axe X — dates */}
      {data.filter((_,i) => data.length<=8 || i%(Math.ceil(data.length/6))===0).map((d,i,arr) => (
        <text key={i} x={toX(data.indexOf(d))} y={H-4} fontSize={7} fill="#94a3b8" textAnchor="middle">
          {fmtDate(d.date).slice(0,5)}
        </text>
      ))}
    </svg>
  )
}

// ── Tableau récap conformité ──────────────────────────────────────────────
function RecapTable({ pointsData, normesCfg }) {
  if (!pointsData.length) return null
  return (
    <div className="card p-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Récapitulatif conformité — tous points
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {['Point','Mesures','Moyenne','Max','% Alerte','% Action','% NC','Taux conf.','Statut'].map(h => (
                <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pointsData.map(({ point, label, stats }) => {
              if (!stats) return null
              const { la, lac, norme, unite } = normesCfg
              const statut = stats.pNC > 0 ? 'nc'
                : stats.pLac > 0 ? 'action'
                : stats.pLa  > 0 ? 'alerte'
                : 'ok'
              const s = STATUT_CFG[statut]
              return (
                <tr key={point} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="py-2 pr-3 font-mono font-bold text-brand">{point}</td>
                  <td className="py-2 pr-3">{stats.n}</td>
                  <td className="py-2 pr-3 font-mono">{stats.mean.toFixed(2)} {unite}</td>
                  <td className="py-2 pr-3 font-mono font-bold"
                    style={{ color: stats.max>=(norme||Infinity)?'#dc2626':stats.max>=(lac||Infinity)?'#d97706':'inherit' }}>
                    {stats.max}
                  </td>
                  <td className="py-2 pr-3" style={{ color: stats.pLa>0?'#d97706':'inherit' }}>{stats.pLa}%</td>
                  <td className="py-2 pr-3" style={{ color: stats.pLac>0?'#dc2626':'inherit' }}>{stats.pLac}%</td>
                  <td className="py-2 pr-3" style={{ color: stats.pNC>0?'#991b1b':'inherit' }}>{stats.pNC}%</td>
                  <td className="py-2 pr-3 font-bold"
                    style={{ color: stats.txConf>=95?'#16a34a':stats.txConf>=80?'#d97706':'#dc2626' }}>
                    {stats.txConf}%
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function TendancesEaux() {
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selType,   setSelType]   = useState('EPU')
  const [selParam,  setSelParam]  = useState('conductivite')
  const [selPoint,  setSelPoint]  = useState('')
  const [annee,     setAnnee]     = useState(new Date().getFullYear())
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin,   setDateFin]   = useState('')
  const [filtreTrimestre, setFiltreTrimestre] = useState('ALL')

  function getTrimestreDates(t, a) {
    return {
      T1: [`${a}-01-01`,`${a}-03-31`],
      T2: [`${a}-04-01`,`${a}-06-30`],
      T3: [`${a}-07-01`,`${a}-09-30`],
      T4: [`${a}-10-01`,`${a}-12-31`],
    }[t] || null
  }

  function handleTrimestre(t) {
    setFiltreTrimestre(t)
    if (t === 'ALL') { setDateDebut(''); setDateFin('') }
    else {
      const r = getTrimestreDates(t, annee)
      if (r) { setDateDebut(r[0]); setDateFin(r[1]) }
    }
  }

  function handleAnnee(a) {
    setAnnee(a)
    setFiltreTrimestre('ALL')
    setDateDebut(''); setDateFin('')
  }

  useEffect(() => {
    setLoading(true)
    const dDebut = dateDebut || `${annee}-01-01`
    const dFin   = dateFin   || `${annee}-12-31`

    supabase.from('controles_eaux')
      .select('type_eau, point_code, parametre, valeur, valeur_text, unite, statut, date_controle, logbook')
      .eq('type_eau', selType)
      .eq('parametre', selParam)
      .gte('date_controle', dDebut)
      .lte('date_controle', dFin)
      .order('date_controle')
      .then(({ data }) => {
        setRows(data || [])
        // Sélectionner le premier point disponible
        const pts = [...new Set((data||[]).map(r => r.point_code))]
        if (pts.length && !pts.includes(selPoint)) setSelPoint(pts[0])
        setLoading(false)
      })
  }, [selType, selParam, annee, dateDebut, dateFin])

  const normesCfg = NORMES[selType]?.[selParam] || { norme:null, la:null, lac:null, unite:'' }
  const params    = Object.keys(NORMES[selType] || {})
  const points    = [...new Set(rows.map(r => r.point_code))].sort()

  // Données du point sélectionné — évolution temporelle
  const pointData = useMemo(() =>
    rows.filter(r => r.point_code === selPoint && r.valeur !== null)
      .map(r => ({ date: r.date_controle, valeur: r.valeur }))
      .sort((a,b) => a.date.localeCompare(b.date))
  , [rows, selPoint])

  // Stats par point
  const pointsData = useMemo(() =>
    points.map(pt => {
      const vals = rows.filter(r => r.point_code === pt && r.valeur !== null).map(r => r.valeur)
      return {
        point: pt,
        label: '',
        vals,
        data: rows.filter(r => r.point_code === pt && r.valeur !== null)
          .map(r => ({ date: r.date_controle, valeur: r.valeur }))
          .sort((a,b) => a.date.localeCompare(b.date)),
        stats: calcStats(vals, normesCfg.la, normesCfg.lac, normesCfg.norme),
      }
    })
  , [rows, points, normesCfg])

  // Stats globales
  const statsPoint = useMemo(() => {
    const vals = pointData.map(d => d.valeur)
    return calcStats(vals, normesCfg.la, normesCfg.lac, normesCfg.norme)
  }, [pointData, normesCfg])

  // Évolution mensuelle
  const monthlyData = useMemo(() => {
    const map = {}
    pointData.forEach(d => {
      const m = new Date(d.date).getMonth()
      if (!map[m]) map[m] = { mois: MOIS[m], vals: [] }
      map[m].vals.push(d.valeur)
    })
    return Object.entries(map).sort(([a],[b]) => +a-+b).map(([m,v]) => ({
      mois: v.mois,
      moy:  +(v.vals.reduce((a,b)=>a+b,0)/v.vals.length).toFixed(2),
      max:  Math.max(...v.vals),
      n:    v.vals.length,
    }))
  }, [pointData])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tendances — Eaux pharmaceutiques</h1>
        <p className="text-gray-500 text-sm mt-1">{rows.length} mesures · {selType} · {selParam}</p>
      </div>

      {/* Sélection type */}
      <div className="flex gap-2 flex-wrap">
        {['EPU','EPPI','EA'].map(t => (
          <button key={t} onClick={() => { setSelType(t); setSelParam(Object.keys(NORMES[t]||{})[0]||'conductivite') }}
            style={{ borderColor: selType===t ? TYPE_COLOR[t] : 'transparent', background: selType===t ? TYPE_COLOR[t] : undefined }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selType===t ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
            💧 {t === 'EA' ? 'Eau alimentation' : t === 'EPU' ? 'Eau purifiée' : 'Eau injectable'}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Paramètre */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Paramètre</label>
            <div className="flex gap-1 flex-wrap">
              {params.map(p => (
                <button key={p} onClick={() => setSelParam(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selParam===p ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                  }`}
                  style={{ background: selParam===p ? TYPE_COLOR[selType] : undefined }}>
                  {p === 'conductivite' ? 'Conductivité' : p === 'dgat' ? 'DGAT' : p === 'cot' ? 'COT' : p === 'endotoxines' ? 'Endotoxines' : p}
                </button>
              ))}
            </div>
          </div>
          {/* Année */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Année</label>
            <div className="flex gap-1">
              {ANNEES.map(a => (
                <button key={a} onClick={() => handleAnnee(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    annee===a && !dateDebut ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                  }`}>{a}</button>
              ))}
            </div>
          </div>
          {/* Trimestre */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t => (
                <button key={t} onClick={() => handleTrimestre(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtreTrimestre===t ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                  }`}>{t === 'ALL' ? `${annee}` : t}</button>
              ))}
            </div>
          </div>
          {/* Dates libres */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Du</label>
              <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setFiltreTrimestre('ALL') }}
                className="input py-1.5 text-sm w-36"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Au</label>
              <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setFiltreTrimestre('ALL') }}
                className="input py-1.5 text-sm w-36"/>
            </div>
          </div>
          <div className="ml-auto self-end pb-1.5">
            {loading
              ? <span className="text-xs text-brand animate-pulse">Chargement...</span>
              : <span className="text-xs text-gray-400 font-mono">{rows.length} mesures · {points.length} points</span>
            }
          </div>
        </div>

        {/* Limites */}
        <div className="flex gap-5 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
          {normesCfg.norme && <span className="flex items-center gap-2 text-xs text-blue-600 font-medium"><span className="w-5 border-t-2 border-dashed border-blue-600 inline-block"/>Norme : {normesCfg.norme} {normesCfg.unite}</span>}
          {normesCfg.la    && <span className="flex items-center gap-2 text-xs text-amber-600"><span className="w-5 border-t-2 border-dashed border-amber-500 inline-block"/>Limite alerte : {normesCfg.la} {normesCfg.unite}</span>}
          {normesCfg.lac   && <span className="flex items-center gap-2 text-xs text-red-600"><span className="w-5 border-t-2 border-dashed border-red-500 inline-block"/>Limite action : {normesCfg.lac} {normesCfg.unite}</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">
          Aucune donnée pour {selType} · {selParam} · {annee}
        </div>
      ) : (
        <>
          {/* Sélection point + stats */}
          <div className="card p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Point de détail</div>
            <div className="flex gap-2 flex-wrap mb-4">
              {points.map(pt => {
                const pd = pointsData.find(p => p.point === pt)
                const statut = pd?.stats ? (
                  pd.stats.pNC>0 ? 'nc' : pd.stats.pLac>0 ? 'action' : pd.stats.pLa>0 ? 'alerte' : 'ok'
                ) : 'ok'
                const s = STATUT_CFG[statut]
                return (
                  <button key={pt} onClick={() => setSelPoint(pt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border-2 transition-all ${
                      selPoint===pt ? 'border-brand bg-brand text-white' : 'border-gray-200 text-gray-600 hover:border-brand'
                    }`}
                    style={{ borderColor: selPoint===pt ? undefined : s.border, background: selPoint===pt ? undefined : s.bg, color: selPoint===pt ? undefined : s.txt }}>
                    {pt}
                  </button>
                )
              })}
            </div>

            {/* Stats du point sélectionné */}
            {statsPoint && (
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
                {[
                  { l:'N',          v: statsPoint.n,               c:'' },
                  { l:'Moyenne',    v: statsPoint.mean.toFixed(2), c:'' },
                  { l:'Max',        v: statsPoint.max,             c: statsPoint.max>=(normesCfg.norme||Infinity)?'text-red-600':statsPoint.max>=(normesCfg.lac||Infinity)?'text-orange-500':'' },
                  { l:'Min',        v: statsPoint.min,             c:'text-green-600' },
                  { l:'Écart-type', v: statsPoint.std.toFixed(2),  c:'' },
                  { l:'Taux conf.', v: `${statsPoint.txConf}%`,    c: statsPoint.txConf>=95?'text-green-600':statsPoint.txConf>=80?'text-amber-600':'text-red-600' },
                  { l:'% > Alerte', v: `${statsPoint.pLa}%`,       c: statsPoint.pLa>0?'text-amber-600':'' },
                  { l:'% > Action', v: `${statsPoint.pLac}%`,      c: statsPoint.pLac>0?'text-red-600':'' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-center">
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{l}</div>
                    <div className={`font-bold font-mono text-sm mt-0.5 ${c || 'text-gray-800 dark:text-white'}`}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mini graphique point sélectionné */}
            {pointData.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Évolution — {selPoint} · {normesCfg.unite}
                </div>
                <div className="overflow-x-auto">
                  <MiniChart
                    data={pointData}
                    la={normesCfg.la} lac={normesCfg.lac} norme={normesCfg.norme}
                    unite={normesCfg.unite}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Graphiques tous les points */}
          {pointsData.length > 1 && (
            <div className="card p-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                Évolution par point — {selType} · {selParam} ({normesCfg.unite})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pointsData.map(({ point, data, stats }) => {
                  if (!data.length) return null
                  const statut = stats ? (stats.pNC>0?'nc':stats.pLac>0?'action':stats.pLa>0?'alerte':'ok') : 'ok'
                  const s = STATUT_CFG[statut]
                  return (
                    <div key={point} className="rounded-xl p-3 border"
                      style={{ borderColor: s.border, background: s.bg + '60' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-brand">{point}</span>
                        <div className="flex items-center gap-2">
                          {stats && <span className="text-[10px] text-gray-500">moy: <b>{stats.mean.toFixed(2)}</b> · max: <b style={{ color: stats.max>=(normesCfg.lac||Infinity)?'#dc2626':'inherit' }}>{stats.max}</b></span>}
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.txt }}>{s.label}</span>
                        </div>
                      </div>
                      <MiniChart data={data} la={normesCfg.la} lac={normesCfg.lac} norme={normesCfg.norme} unite={normesCfg.unite}/>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tableau récap */}
          <RecapTable pointsData={pointsData} normesCfg={normesCfg}/>
        </>
      )}
    </div>
  )
}
