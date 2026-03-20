import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

const TRIMESTRES = {
  T1: ['2025-01-01','2025-03-31'],
  T2: ['2025-04-01','2025-06-30'],
  T3: ['2025-07-01','2025-09-30'],
  T4: ['2025-10-01','2025-12-31'],
}
const PALETTE = ['#378ADD','#1D9E75','#D4537E','#BA7517','#7F77DD','#D85A30','#639922','#5F5E5A','#0F6E56','#993556','#854F0B','#185FA5']
const CLASSE_BG  = { A:'#FCE4EC', B:'#FFF3E0', C:'#E8F4FD', D:'#E8F5E9' }
const CLASSE_TXT = { A:'#993556', B:'#854F0B', C:'#185FA5', D:'#3B6D11' }

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtDateShort(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}`
}

// ── Plugin lignes norme / alerte / action ──────────────────────────────────
function makeRefPlugin(norme, alerte, action) {
  return {
    id: 'refLines',
    afterDraw(chart) {
      const { ctx: c, scales: { y, x } } = chart
      const lines = [
        [norme,  '#2563eb', 'Norme'],
        [alerte, '#d97706', 'Alerte'],
        [action, '#dc2626', 'Action'],
      ]
      lines.forEach(([val, col, lbl]) => {
        if (val === null || val === undefined || val > (y.max || 9999)) return
        const yp = y.getPixelForValue(val)
        c.save()
        c.setLineDash(lbl === 'Norme' ? [8,4] : [5,4])
        c.lineWidth = lbl === 'Norme' ? 2 : 1.5
        c.strokeStyle = col
        c.beginPath(); c.moveTo(x.left, yp); c.lineTo(x.right, yp); c.stroke()
        c.setLineDash([])
        c.font = `${lbl === 'Norme' ? 'bold ' : ''}9px sans-serif`
        c.fillStyle = col; c.textAlign = 'right'
        c.fillText(`${lbl} ${val}`, x.right, yp - 3)
        c.restore()
      })
    }
  }
}

// ── Plugin valeurs sur barres (toujours si NC, ou si trimestre sélectionné) ─
function makeValsPlugin(alerte, action, showAll = false) {
  return {
    id: 'vals',
    afterDatasetsDraw(chart) {
      const { ctx: c, data: d } = chart
      c.save()
      d.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, i) => {
          const val = ds.data[i]
          if (val === null || val === undefined) return
          const nc = val >= action ? '#dc2626' : val >= alerte ? '#d97706' : null
          if (!nc && !showAll) return
          const col = nc || '#888780'
          c.font = `${nc ? 'bold ' : ''}9px sans-serif`
          c.fillStyle = col; c.textAlign = 'center'
          c.fillText(val, bar.x, bar.y - 4)
        })
      })
      c.restore()
    }
  }
}

// ── Vue 1 : barres verticales groupées par point ──────────────────────────
function ChartVue1({ salle, data, type, norme, alerte, action, classe, periodeLabel, showTrimestre }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const { points, dates, datasets } = useMemo(() => {
    const prefix = type === 'ACTIF' ? 'A' : type === 'PASSIF' ? 'P' : 'S'
    const pts = [...new Set(data.filter(c=>c.type_controle===type).map(c=>c.point))]
      .filter(p => p.startsWith(prefix))
      .sort((a,b) => { const na=parseInt(a.slice(1)),nb=parseInt(b.slice(1)); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb })

    const isos = [...new Set(data.filter(c=>c.type_controle===type).map(c=>c.date_controle))].sort()

    // Labels = dates sur l'axe X, datasets = un par point
    const ds = pts.map((p, i) => ({
      label: p,
      data: isos.map(iso => {
        const v = data.find(c => c.date_controle===iso && c.point===p && c.type_controle===type)
        return v !== undefined ? v.germes : null
      }),
      backgroundColor: PALETTE[i % PALETTE.length] + 'bb',
      borderColor: PALETTE[i % PALETTE.length],
      borderWidth: 1.5,
    }))
    return { points: pts, dates: isos, datasets: ds }
  }, [data, type, showTrimestre])

  useEffect(() => {
    if (!canvasRef.current || !points.length || !datasets.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels: dates.map(d => fmtDate(d)), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 8 }
          },
          tooltip: {
            mode: 'index', intersect: false,
            callbacks: { label: i => `${i.dataset.label} : ${i.raw ?? '—'} UFC` }
          }
        },
        scales: {
          x: {
            ticks: { font:{size:10}, autoSkip:false, maxRotation:45, color:'#888780' },
            grid: { color:'#e2e8f018' }
          },
          y: { min:0, ticks:{ font:{size:11}, color:'#888780' }, grid:{ color:'#e2e8f018' } }
        },
        layout: { padding:{ right:65, top:8 } }
      },
      plugins: [
        makeRefPlugin(norme, alerte, action),
        makeValsPlugin(alerte, action, showTrimestre)
      ]
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [points, datasets, norme, alerte, action, showTrimestre])

  if (!points.length) return null

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{salle}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background:CLASSE_BG[classe]||'#f5f5f5', color:CLASSE_TXT[classe]||'#333' }}>
            Classe {classe}
          </span>
          <span className="text-xs text-gray-400">{points.length} points</span>
        </div>
      </div>



      <div style={{ position:'relative', width:'100%', height: Math.max(220, points.length * 28 + 80) }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  )
}

// ── Vue 3 : un graphique par point ─────────────────────────────────────────
function ChartVue3Point({ point, data, type, norme, alerte, action, classe, chartType, showTrimestre }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const mesures = useMemo(() => {
    return data
      .filter(c => c.point===point && c.type_controle===type)
      .sort((a,b) => a.date_controle.localeCompare(b.date_controle))
      .map(c => ({ iso: c.date_controle, label: fmtDate(c.date_controle), val: c.germes }))
  }, [data, point, type])

  useEffect(() => {
    if (!canvasRef.current || !mesures.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const isCourbe = chartType === 'line'
    const vals = mesures.map(m => m.val)
    const maxVal = Math.max(...vals, alerte || 0, action || 0)

    const colors  = mesures.map(m => m.val>=action?'#dc262699':m.val>=alerte?'#d9770699':'#378ADD99')
    const borders = mesures.map(m => m.val>=action?'#dc2626':m.val>=alerte?'#d97706':'#185FA5')

    chartRef.current = new window.Chart(canvasRef.current, {
      type: isCourbe ? 'line' : 'bar',
      data: {
        labels: mesures.map(m => m.label),
        datasets: [{
          label: 'UFC',
          data: vals,
          backgroundColor: isCourbe ? '#378ADD22' : colors,
          borderColor: isCourbe ? borders : borders,
          borderWidth: isCourbe ? 2 : 1.5,
          pointRadius: isCourbe ? 4 : 0,
          pointBackgroundColor: isCourbe ? borders : undefined,
          tension: isCourbe ? 0.35 : 0,
          fill: isCourbe,
          spanGaps: false, // ne relie pas les valeurs manquantes
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: i => `${i.raw} UFC` } }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 10 },
              autoSkip: mesures.length > 12,
              maxRotation: 45,
              color: '#888780'
            },
            grid: { color: '#e2e8f018' }
          },
          y: {
            min: 0,
            // Ne pas étendre l'axe au-delà des données + petite marge
            suggestedMax: Math.max(...vals) * 1.25 + 2,
            ticks: { font:{size:10}, color:'#888780' },
            grid: { color:'#e2e8f018' }
          }
        },
        layout: { padding: { right: 65, top: 16 } }
      },
      plugins: [
        makeRefPlugin(norme, alerte, action),
        makeValsPlugin(alerte, action, showTrimestre)
      ]
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [mesures, norme, alerte, action, chartType, showTrimestre])

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
      <div style={{ position:'relative', width:'100%', height: 200 }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function PointsParSalle() {
  const [zones,     setZones]     = useState([])
  const [salles,    setSalles]    = useState([])
  const [normes,    setNormes]    = useState([])
  const [controles, setControles] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  const [selZone,    setSelZone]    = useState(null)
  const [selType,    setSelType]    = useState('ACTIF')
  const [selClasse,  setSelClasse]  = useState('ALL')
  const [selPeriode, setSelPeriode] = useState('ALL')
  const [selVue,     setSelVue]     = useState('1')
  const [selChart3,  setSelChart3]  = useState('bar')

  useEffect(() => {
    if (window.Chart) return
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    document.head.appendChild(s)
  }, [])

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
    normes.forEach(n => {
      map[`${n.zones?.code}_${n.type_controle}`] = n
    })
    return map
  }, [normes])

  const dataFiltered = useMemo(() => {
    if (selPeriode === 'ALL') return controles
    const [debut, fin] = TRIMESTRES[selPeriode]
    return controles.filter(c => c.date_controle >= debut && c.date_controle <= fin)
  }, [controles, selPeriode])

  const sallesZone = useMemo(() =>
    salles.filter(s => s.zones?.code === selZone)
  , [salles, selZone])

  function getClasseSalle(salleId) {
    const cls = [...new Set(controles.filter(c => c.salle_id===salleId).map(c => c.classe).filter(Boolean))]
    return cls[0] || '?'
  }

  const classesDispos = useMemo(() =>
    [...new Set(controles.map(c => c.classe).filter(Boolean))].sort()
  , [controles])

  const sallesFiltrees = useMemo(() => {
    if (selClasse === 'ALL') return sallesZone
    return sallesZone.filter(s => getClasseSalle(s.id) === selClasse)
  }, [sallesZone, selClasse, controles])

  function getNormes(classeOverride) {
    // Essai avec classe spécifique, fallback sans classe
    const cl = classeOverride || ''
    return normesMap[`${selZone}_${cl}_${selType}`]
        || normesMap[`${selZone}_${selType}`]
        || { norme: null, alerte: 0, action: 9999, unite: 'UFC' }
  }

  function getPoints(salleId) {
    const prefix = selType==='ACTIF'?'A':selType==='PASSIF'?'P':'S'
    return [...new Set(dataFiltered.filter(c=>c.salle_id===salleId&&c.type_controle===selType).map(c=>c.point))]
      .filter(p=>p.startsWith(prefix))
      .sort((a,b)=>{ const na=parseInt(a.slice(1)),nb=parseInt(b.slice(1)); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb })
  }

  const showTrimestre = selPeriode !== 'ALL'
  const normesCourantes = getNormes()

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

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
            style={{ borderColor:selZone===z.code?z.color:'transparent', background:selZone===z.code?z.color:undefined }}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selVue===v?'bg-purple-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Graphique Vue 3 */}
          {selVue === '3' && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Graphique</label>
              <div className="flex gap-1">
                {[['bar','▊ Barres'],['line','〜 Courbe']].map(([t,l]) => (
                  <button key={t} onClick={() => setSelChart3(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selChart3===t?'bg-brand text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Type */}
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
              {['ALL',...classesDispos].map(c => (
                <button key={c} onClick={() => setSelClasse(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${selClasse===c?'bg-teal-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                  {c==='ALL'?'Toutes':`Cl. ${c}`}
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t => (
                <button key={t} onClick={() => setSelPeriode(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${selPeriode===t?'bg-navy text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                  {t==='ALL'?"Année":t}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto text-xs text-gray-400 font-mono">
            {dataFiltered.length} mesures · {sallesFiltrees.length} salles
          </div>
        </div>

        {/* Légende limites */}
        <div className="flex gap-5 pt-1 flex-wrap">
          {normesCourantes.norme !== null && (
            <span className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
              <span className="w-5 border-t-2 border-dashed border-blue-600 inline-block"/>
              Norme : {normesCourantes.norme} {normesCourantes.unite}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <span className="w-5 border-t-2 border-dashed border-amber-500 inline-block"/>
            Alerte : {normesCourantes.alerte} {normesCourantes.unite}
          </span>
          <span className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <span className="w-5 border-t-2 border-dashed border-red-500 inline-block"/>
            Action : {normesCourantes.action} {normesCourantes.unite}
          </span>
        </div>

        {loadingData && <div className="text-xs text-brand animate-pulse">Chargement des données...</div>}
      </div>

      {/* Message vide */}
      {!loadingData && sallesFiltrees.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          Aucune salle{selClasse!=='ALL'?` en Classe ${selClasse}`:''} pour cette zone.
        </div>
      )}

      {/* Graphiques */}
      {!loadingData && sallesFiltrees.map(salle => {
        const classeSalle = getClasseSalle(salle.id)
        const dataSalle   = dataFiltered.filter(c => c.salle_id === salle.id)
        if (!dataSalle.length) return null
        const n = getNormes(classeSalle)

        if (selVue === '1') {
          return (
            <ChartVue1
              key={salle.id}
              salle={salle.label}
              data={dataSalle}
              type={selType}
              norme={n.norme}
              alerte={n.alerte}
              action={n.action}
              classe={classeSalle}
              showTrimestre={showTrimestre}
            />
          )
        }

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
                norme={n.norme}
                alerte={n.alerte}
                action={n.action}
                classe={classeSalle}
                chartType={selChart3}
                showTrimestre={showTrimestre}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
