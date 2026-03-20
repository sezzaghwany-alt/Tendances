import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

const TRIMESTRES = {
  T1: ['2025-01-01','2025-03-31'],
  T2: ['2025-04-01','2025-06-30'],
  T3: ['2025-07-01','2025-09-30'],
  T4: ['2025-10-01','2025-12-31'],
}
const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const PALETTE = ['#378ADD','#1D9E75','#D4537E','#BA7517','#7F77DD','#D85A30','#639922','#5F5E5A','#0F6E56','#993556','#854F0B','#185FA5']
const CLASSE_BG  = { A:'#FCE4EC', B:'#FFF3E0', C:'#E8F4FD', D:'#E8F5E9' }
const CLASSE_TXT = { A:'#993556', B:'#854F0B', C:'#185FA5', D:'#3B6D11' }

// ── Plugin lignes alerte/action ────────────────────────────────────────────
function makeRefPlugin(alerte, action, horizontal = false) {
  return {
    id: 'refLines',
    afterDraw(chart) {
      const { ctx: c, scales } = chart
      const { x, y } = scales
      ;[[alerte, '#d97706', 'Alerte'], [action, '#dc2626', 'Action']].forEach(([val, col, lbl]) => {
        if (val === null || val === undefined) return
        c.save(); c.setLineDash([5, 4]); c.lineWidth = 1.5; c.strokeStyle = col
        if (horizontal) {
          const xp = x.getPixelForValue(val)
          c.beginPath(); c.moveTo(xp, y.top); c.lineTo(xp, y.bottom); c.stroke()
          c.setLineDash([]); c.font = '9px sans-serif'; c.fillStyle = col; c.textAlign = 'center'
          c.fillText(`${lbl} ${val}`, xp, y.top - 4)
        } else {
          const yp = y.getPixelForValue(val)
          c.beginPath(); c.moveTo(x.left, yp); c.lineTo(x.right, yp); c.stroke()
          c.setLineDash([]); c.font = '9px sans-serif'; c.fillStyle = col; c.textAlign = 'right'
          c.fillText(`${lbl} ${val}`, x.right, yp - 3)
        }
        c.restore()
      })
    }
  }
}

// ── Plugin valeurs NC sur barres ───────────────────────────────────────────
function makeValsPlugin(alerte, action, horizontal = false) {
  return {
    id: 'vals',
    afterDatasetsDraw(chart) {
      const { ctx: c, data: d } = chart
      c.save()
      d.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, i) => {
          const val = ds.data[i]
          if (!val && val !== 0) return
          const nc = val >= action ? '#dc2626' : val >= alerte ? '#d97706' : null
          if (!nc) return
          c.font = 'bold 9px sans-serif'; c.fillStyle = nc
          if (horizontal) {
            c.textAlign = 'left'
            c.fillText(val, bar.x + 3, bar.y + 3)
          } else {
            c.textAlign = 'center'
            c.fillText(val, bar.x, bar.y - 4)
          }
        })
      })
      c.restore()
    }
  }
}

// ── Composant graphique Vue 1 : barres verticales groupées par point ───────
function ChartVue1({ salle, data, type, alerte, action, classe }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const points = useMemo(() => {
    const prefix = type === 'ACTIF' ? 'A' : type === 'PASSIF' ? 'P' : 'S'
    return [...new Set(data.map(c => c.point))].filter(p => p.startsWith(prefix))
      .sort((a, b) => { const na = parseInt(a.slice(1)), nb = parseInt(b.slice(1)); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb })
  }, [data, type])

  // Dates uniques triées
  const dates = useMemo(() => {
    return [...new Set(data.filter(c=>c.type_controle===type).map(c=>c.date_controle))]
      .sort()
      .map(d => { const [y,m,j]=d.split('-'); return `${j}/${m}` })
  }, [data, type])

  const datasets = useMemo(() => {
    return dates.map((dateLabel, i) => {
      const dateISO = data.find(c => {
        const [y,m,j]=c.date_controle.split('-'); return `${j}/${m}`===dateLabel
      })?.date_controle
      return {
        label: dateLabel,
        data: points.map(p => {
          const vals = data.filter(c => {
            const [y,m,j]=c.date_controle.split('-')
            return `${j}/${m}`===dateLabel && c.point===p && c.type_controle===type
          }).map(c => c.germes)
          return vals.length ? vals[0] : null
        }),
        backgroundColor: PALETTE[i % PALETTE.length] + 'bb',
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 1.5,
      }
    })
  }, [dates, points, data, type])

  useEffect(() => {
    if (!canvasRef.current || !points.length || !datasets.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels: points, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode:'index', intersect:false, callbacks: { label: i => `${i.dataset.label} : ${i.raw??'—'} UFC` } } },
        scales: {
          x: { ticks: { font:{size:11}, autoSkip:false, maxRotation:0, color:'#888780' }, grid: { color:'#e2e8f018' } },
          y: { min:0, ticks: { font:{size:11}, color:'#888780' }, grid: { color:'#e2e8f018' } }
        },
        layout: { padding: { right: 55 } }
      },
      plugins: [makeRefPlugin(alerte, action, false), makeValsPlugin(alerte, action, false)]
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [points, datasets, alerte, action])

  if (!points.length) return null

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{salle}</div>
        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: CLASSE_BG[classe]||'#f5f5f5', color: CLASSE_TXT[classe]||'#333' }}>
          Classe {classe}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {datasets.map((ds, i) => (
          <span key={i} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: ds.borderColor }}/>
            {ds.label}
          </span>
        ))}
      </div>
      <div style={{ position:'relative', width:'100%', height: Math.max(220, points.length * 30 + 80) }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  )
}

// ── Composant graphique Vue 3 : un graphique par point ────────────────────
function ChartVue3Point({ point, data, type, alerte, action, classe, chartType }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const mesures = useMemo(() => {
    return data
      .filter(c => c.point === point && c.type_controle === type)
      .sort((a, b) => a.date_controle.localeCompare(b.date_controle))
      .map(c => { const [y,m,j]=c.date_controle.split('-'); return { label:`${j}/${m}`, val:c.germes } })
  }, [data, point, type])

  useEffect(() => {
    if (!canvasRef.current || !mesures.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const isCourbe = chartType === 'line'
    const colors = mesures.map(m => m.val>=action?'#dc262699':m.val>=alerte?'#d9770699':'#378ADD99')
    const borders = mesures.map(m => m.val>=action?'#dc2626':m.val>=alerte?'#d97706':'#185FA5')

    chartRef.current = new window.Chart(canvasRef.current, {
      type: isCourbe ? 'line' : 'bar',
      data: {
        labels: mesures.map(m => m.label),
        datasets: [{
          label: 'UFC',
          data: mesures.map(m => m.val),
          backgroundColor: isCourbe ? '#378ADD22' : colors,
          borderColor: isCourbe ? '#378ADD' : borders,
          borderWidth: isCourbe ? 2 : 1.5,
          pointRadius: isCourbe ? 4 : 0,
          pointBackgroundColor: isCourbe ? borders : undefined,
          tension: 0.35,
          fill: isCourbe,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label:i=>`${i.raw} UFC` } } },
        scales: {
          x: { ticks:{ font:{size:10}, autoSkip:false, maxRotation:45, color:'#888780' }, grid:{ color:'#e2e8f018' } },
          y: { min:0, ticks:{ font:{size:10}, color:'#888780' }, grid:{ color:'#e2e8f018' } }
        },
        layout: { padding:{ right:55, top:16 } }
      },
      plugins: [makeRefPlugin(alerte, action, false), makeValsPlugin(alerte, action, false)]
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [mesures, alerte, action, chartType])

  if (!mesures.length) return null

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700 dark:text-white font-mono">Point {point}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background:CLASSE_BG[classe]||'#f5f5f5', color:CLASSE_TXT[classe]||'#333' }}>Classe {classe}</span>
          <span className="text-xs text-gray-400">{mesures.length} mesures</span>
        </div>
      </div>
      <div style={{ position:'relative', width:'100%', height:180 }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function PointsParSalle() {
  const [zones,    setZones]    = useState([])
  const [salles,   setSalles]   = useState([])
  const [normes,   setNormes]   = useState([])
  const [controles,setControles]= useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  const [selZone,   setSelZone]   = useState(null)
  const [selType,   setSelType]   = useState('ACTIF')
  const [selClasse, setSelClasse] = useState('ALL')
  const [selPeriode,setSelPeriode]= useState('ALL')
  const [selVue,    setSelVue]    = useState('1')       // '1' | '3'
  const [selChart3, setSelChart3] = useState('bar')     // 'bar' | 'line'

  // Charger Chart.js
  useEffect(() => {
    if (window.Chart) return
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    document.head.appendChild(s)
  }, [])

  // Charger zones, salles, normes
  useEffect(() => {
    async function load() {
      const [z, s, n] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('salles').select('*, zones(code)').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
      ])
      setZones(z.data || [])
      setSalles(s.data || [])
      setNormes(n.data || [])
      if (z.data?.length) setSelZone(z.data[0].code)
      setLoading(false)
    }
    load()
  }, [])

  // Charger contrôles quand zone change
  useEffect(() => {
    if (!selZone || !zones.length) return
    const zoneObj = zones.find(z => z.code === selZone)
    if (!zoneObj) return
    setLoadingData(true)
    async function fetchAll() {
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('controles')
          .select('date_controle, type_controle, point, germes, classe, salle_id')
          .eq('zone_id', zoneObj.id)
          .order('date_controle')
          .range(from, from + 999)
        if (error || !data?.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      setControles(all)
      setLoadingData(false)
    }
    fetchAll()
  }, [selZone, zones])

  const normesMap = useMemo(() => {
    const map = {}
    normes.forEach(n => { map[`${n.zones?.code}_${n.type_controle}`] = n })
    return map
  }, [normes])

  // Données filtrées par période
  const dataFiltered = useMemo(() => {
    if (selPeriode === 'ALL') return controles
    const [debut, fin] = TRIMESTRES[selPeriode]
    return controles.filter(c => c.date_controle >= debut && c.date_controle <= fin)
  }, [controles, selPeriode])

  // Salles de la zone
  const sallesZone = useMemo(() => {
    return salles.filter(s => s.zones?.code === selZone)
  }, [salles, selZone])

  // Classe d'une salle depuis les contrôles
  function getClasseSalle(salleId) {
    const classes = [...new Set(controles.filter(c => c.salle_id === salleId).map(c => c.classe).filter(Boolean))]
    return classes[0] || '?'
  }

  // Salles filtrées par classe sélectionnée
  const sallesFiltrees = useMemo(() => {
    if (selClasse === 'ALL') return sallesZone
    return sallesZone.filter(s => getClasseSalle(s.id) === selClasse)
  }, [sallesZone, selClasse, controles])

  // Classes disponibles
  const classesDispos = useMemo(() =>
    [...new Set(controles.map(c => c.classe).filter(Boolean))].sort()
  , [controles])

  // Normes courantes
  const normesCourantes = normesMap[`${selZone}_${selType}`] || { alerte: 0, action: 9999 }

  // Points d'une salle filtrés par type
  function getPoints(salleId) {
    const prefix = selType === 'ACTIF' ? 'A' : selType === 'PASSIF' ? 'P' : 'S'
    const data = dataFiltered.filter(c => c.salle_id === salleId && c.type_controle === selType)
    return [...new Set(data.map(c => c.point))].filter(p => p.startsWith(prefix))
      .sort((a, b) => { const na=parseInt(a.slice(1)),nb=parseInt(b.slice(1)); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Points par salle</h1>
        <p className="text-gray-500 text-sm mt-1">Résultats individuels par point de prélèvement</p>
      </div>

      {/* Onglets zones */}
      <div className="flex gap-2 flex-wrap">
        {zones.map(z => (
          <button key={z.code} onClick={() => { setSelZone(z.code); setSelClasse('ALL') }}
            style={{ borderColor: selZone===z.code?z.color:'transparent', background: selZone===z.code?z.color:undefined }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selZone===z.code?'text-white':'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Vue */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Vue</label>
            <div className="flex gap-1">
              {[['1','📊 Vue globale'],['3','🔍 Vue par point']].map(([v,l]) => (
                <button key={v} onClick={() => setSelVue(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selVue===v?'bg-purple-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Type graphique (Vue 3 uniquement) */}
          {selVue === '3' && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Graphique</label>
              <div className="flex gap-1">
                {[['bar','▊ Barres'],['line','〜 Courbe']].map(([t,l]) => (
                  <button key={t} onClick={() => setSelChart3(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      selChart3===t?'bg-brand text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Type contrôle */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Type</label>
            <select value={selType} onChange={e => setSelType(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ACTIF">🌬️ Actif</option>
              <option value="PASSIF">📦 Passif</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>

          {/* Classe */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Classe</label>
            <div className="flex gap-1">
              {['ALL', ...classesDispos].map(c => (
                <button key={c} onClick={() => setSelClasse(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selClasse===c?'bg-teal-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}>{c==='ALL'?'Toutes':`Cl. ${c}`}</button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t => (
                <button key={t} onClick={() => setSelPeriode(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selPeriode===t?'bg-navy text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}>{t==='ALL'?"Année":t}</button>
              ))}
            </div>
          </div>

          <div className="ml-auto text-xs text-gray-400 font-mono">
            {dataFiltered.length} mesures · {sallesFiltrees.length} salles
          </div>
        </div>

        {/* Normes */}
        <div className="flex gap-4 pt-1">
          <span className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <span className="w-5 border-t-2 border-dashed border-amber-500 inline-block"/>
            Alerte : {normesCourantes.alerte} UFC
          </span>
          <span className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <span className="w-5 border-t-2 border-dashed border-red-500 inline-block"/>
            Action : {normesCourantes.action} UFC
          </span>
        </div>

        {loadingData && <div className="text-xs text-brand animate-pulse">Chargement des données...</div>}
      </div>

      {/* Graphiques */}
      {!loadingData && sallesFiltrees.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          Aucune salle{selClasse!=='ALL'?` en Classe ${selClasse}`:''} pour cette zone.
        </div>
      )}

      {!loadingData && sallesFiltrees.map(salle => {
        const classeSalle = getClasseSalle(salle.id)
        const dataSalle = dataFiltered.filter(c => c.salle_id === salle.id)
        if (!dataSalle.length) return null

        const normeSalle = normesMap[`${selZone}_${selType}`] || normesCourantes

        if (selVue === '1') {
          return (
            <ChartVue1
              key={salle.id}
              salle={salle.label}
              data={dataSalle}
              type={selType}
              alerte={normeSalle?.alerte || 0}
              action={normeSalle?.action || 9999}
              classe={classeSalle}
            />
          )
        }

        // Vue 3 : un graphique par point
        const points = getPoints(salle.id)
        if (!points.length) return null

        return (
          <div key={salle.id} className="space-y-1">
            <div className="flex items-center gap-3 mb-2 mt-2">
              <h2 className="font-bold text-gray-800 dark:text-white text-sm">{salle.label}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background:CLASSE_BG[classeSalle]||'#f5f5f5', color:CLASSE_TXT[classeSalle]||'#333' }}>
                Classe {classeSalle}
              </span>
              <span className="text-xs text-gray-400">{points.length} points</span>
            </div>
            {points.map(point => (
              <ChartVue3Point
                key={point}
                point={point}
                data={dataSalle}
                type={selType}
                alerte={normeSalle?.alerte || 0}
                action={normeSalle?.action || 9999}
                classe={classeSalle}
                chartType={selChart3}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
