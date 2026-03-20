import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fullStats, interpretSeries } from '@/lib/statsUtils'

const TRIMESTRES = {
  T1: ['2025-01-01','2025-03-31'],
  T2: ['2025-04-01','2025-06-30'],
  T3: ['2025-07-01','2025-09-30'],
  T4: ['2025-10-01','2025-12-31'],
}
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

// ── Plugins Chart.js ───────────────────────────────────────────────────────
function makeRefPlugin(norme, alerte, action) {
  return {
    id: 'refLines',
    afterDraw(chart) {
      const { ctx: c, scales: { y, x } } = chart
      const lines = [
        [norme,  '#2563eb', 'Norme', true],
        [alerte, '#d97706', 'Alerte', false],
        [action, '#dc2626', 'Action', false],
      ]
      let offTop = 0
      lines.forEach(([val, col, lbl, bold]) => {
        if (val === null || val === undefined) return
        c.save()
        if (val > y.max) {
          c.font = `${bold ? 'bold ' : ''}9px sans-serif`
          c.fillStyle = col; c.textAlign = 'right'
          c.fillText(`${lbl} ${val} ↑`, x.right, y.top + offTop)
          offTop += 12
        } else {
          const yp = y.getPixelForValue(val)
          c.setLineDash(bold ? [8, 4] : [5, 4])
          c.lineWidth = bold ? 2 : 1.5; c.strokeStyle = col
          c.beginPath(); c.moveTo(x.left, yp); c.lineTo(x.right, yp); c.stroke()
          c.setLineDash([])
          c.font = `${bold ? 'bold ' : ''}9px sans-serif`
          c.fillStyle = col; c.textAlign = 'right'
          c.fillText(`${lbl} ${val}`, x.right, yp - 3)
        }
        c.restore()
      })
    }
  }
}

function makeValsPlugin(alerte, action) {
  return {
    id: 'vals',
    afterDatasetsDraw(chart) {
      const { ctx: c, data: d } = chart
      c.save()
      d.datasets[0].data.forEach((val, i) => {
        if (val === null || val === undefined) return
        const bar = chart.getDatasetMeta(0).data[i]
        const nc = val >= action ? '#dc2626' : val >= alerte ? '#d97706' : null
        c.font = `${nc ? 'bold ' : ''}9px sans-serif`
        c.fillStyle = nc || '#aaa'; c.textAlign = 'center'
        c.fillText(val, bar.x, bar.y - 3)
      })
      c.restore()
    }
  }
}

function makePointLabelsPlugin(groups, padBottom) {
  return {
    id: 'ptLabels',
    afterDraw(chart) {
      const { ctx: c, scales: { x, y } } = chart
      const bot = y.bottom
      c.save()
      groups.forEach(({ pt, loc, si, count }) => {
        const meta = chart.getDatasetMeta(0)
        const first = meta.data[si], last = meta.data[si + count - 1]
        if (!first || !last) return
        const midX = (first.x + last.x) / 2
        const groupW = Math.max(last.x - first.x + 30, 20)

        // Séparateur
        if (si > 0) {
          const sep = meta.data[si - 1]
          if (sep) {
            const sx = sep.x + (sep.width || 0) / 2 + 4
            c.strokeStyle = '#d1d5db'; c.lineWidth = 1; c.setLineDash([3, 3])
            c.beginPath(); c.moveTo(sx, y.top); c.lineTo(sx, bot + padBottom - 2); c.stroke()
            c.setLineDash([])
          }
        }
        // Code point
        c.font = 'bold 10px sans-serif'; c.fillStyle = '#185FA5'; c.textAlign = 'center'
        c.fillText(pt, midX, bot + 38)
        // Localisation tronquée
        if (loc) {
          c.font = '8px sans-serif'; c.fillStyle = '#6b7280'; c.textAlign = 'center'
          let t = loc
          while (c.measureText(t).width > groupW + 8 && t.length > 3) t = t.slice(0, -1)
          if (t !== loc) t = t.slice(0, -1) + '…'
          c.fillText(t, midX, bot + 50)
        }
      })
      c.restore()
    }
  }
}

// ── Bloc stats + interprétation ────────────────────────────────────────────
function StatsBloc({ vals, alerte, action, periode }) {
  if (!vals.length) return null
  const n = vals.length
  const mean = vals.reduce((a,b)=>a+b,0)/n
  const sorted = [...vals].sort((a,b)=>a-b)
  const median = n%2 ? sorted[Math.floor(n/2)] : (sorted[n/2-1]+sorted[n/2])/2
  const std = Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/n)
  const max = Math.max(...vals), min = Math.min(...vals)
  const pA  = Math.round(vals.filter(v=>v>=alerte).length/n*100)
  const pAc = Math.round(vals.filter(v=>v>=action).length/n*100)

  const msgs = []
  if (pAc > 0)   msgs.push({ t:'danger', m:`⛔ ${pAc}% des mesures dépassent la limite d'action — investigation requise` })
  if (pA  > 20)  msgs.push({ t:'warn',   m:`⚠️ ${pA}% des mesures dépassent la limite d'alerte — surveillance renforcée` })
  if (pA  === 0 && pAc === 0) msgs.push({ t:'ok', m:`✅ Toutes les mesures sont conformes` })
  if (std > mean) msgs.push({ t:'warn', m:`📊 Forte variabilité (σ=${std.toFixed(1)}) — résultats hétérogènes entre points` })
  const estival = periode==='T2'||periode==='T3'
  msgs.push({ t: estival?'warn':'ok', m: estival
    ? `🌡️ Période estivale (${periode}) — risque de contamination accru, surveiller la climatisation`
    : `❄️ Période hivernale (${periode}) — conditions climatiques favorables`
  })

  const statItems = [
    ['N mesures', n], ['Moyenne', mean.toFixed(1)+' UFC'], ['Médiane', median.toFixed(1)+' UFC'],
    ['Écart-type σ', std.toFixed(1)], ['Max', max+' UFC'], ['Min', min+' UFC'],
    ['% > Alerte', pA+'%', pA>20?'text-amber-600':''],
    ['% > Action', pAc+'%', pAc>0?'text-red-600':''],
  ]

  return (
    <div className="mt-4 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {statItems.map(([lbl, val, col]) => (
          <div key={lbl} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">{lbl}</div>
            <div className={`font-bold text-sm font-mono mt-0.5 ${col || 'text-gray-800 dark:text-white'}`}>{val}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {msgs.map((m, i) => (
          <div key={i} className={`text-xs px-3 py-2 rounded-lg border-l-2 ${
            m.t==='danger' ? 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-700 dark:text-red-300' :
            m.t==='warn'   ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300' :
                             'bg-green-50 dark:bg-green-900/20 border-green-400 text-green-700 dark:text-green-300'
          }`}>{m.m}</div>
        ))}
      </div>
    </div>
  )
}

// ── Vue 1 : groupé par point ───────────────────────────────────────────────
function ChartVue1({ salle, data, type, norme, alerte, action, classe, pointsRef, periode }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const PAD_BOTTOM = 58

  const chartData = useMemo(() => {
    const prefix = type==='ACTIF'?'A':type==='PASSIF'?'P':'S'
    const pts = [...new Set(data.filter(c=>c.type_controle===type).map(c=>c.point))]
      .filter(p=>p.startsWith(prefix))
      .sort((a,b)=>{ const na=parseInt(a.slice(1)),nb=parseInt(b.slice(1)); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb })
    const isos = [...new Set(data.filter(c=>c.type_controle===type).map(c=>c.date_controle))].sort()
    const labels=[], vals=[], bg=[], bc=[], groups=[], allVals=[]

    pts.forEach((pt, pi) => {
      const loc = pointsRef[pt] || ''
      const si = labels.length
      isos.forEach(iso => {
        const v = data.find(c=>c.date_controle===iso&&c.point===pt&&c.type_controle===type)
        const val = v!==undefined ? v.germes : null
        labels.push(fmtDateShort(iso))
        vals.push(val)
        if (val !== null) allVals.push(val)
        const nc = val!==null&&val>=action?'#dc2626':val!==null&&val>=alerte?'#d97706':null
        bg.push(nc?nc+'99':'#378ADD99'); bc.push(nc||'#185FA5')
      })
      groups.push({ pt, loc, si, count: isos.length })
      if (pi < pts.length-1) { labels.push(''); vals.push(null); bg.push('transparent'); bc.push('transparent') }
    })
    return { labels, vals, bg, bc, groups, pts, isos, allVals }
  }, [data, type, alerte, action, pointsRef])

  useEffect(() => {
    if (!canvasRef.current || !chartData.pts.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    const { labels, vals, bg, bc, groups } = chartData

    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label:'UFC', data:vals, backgroundColor:bg, borderColor:bc, borderWidth:1.5, borderSkipped:false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: items => {
              const idx = items[0].dataIndex
              const pg = groups.find(g=>idx>=g.si&&idx<g.si+g.count)
              const iso = chartData.isos[idx-(pg?pg.si:0)]
              return pg&&iso ? `${pg.pt}${pg.loc?' — '+pg.loc:''}\n${fmtDate(iso)}` : ''
            },
            label: i => i.raw!==null ? `${i.raw} UFC` : '—'
          }}
        },
        scales: {
          x: {
            ticks: { font:{size:9}, autoSkip:false, maxRotation:40, color:'#888780' },
            grid: { color:'#e2e8f014' }
          },
          y: { min:0, ticks:{ font:{size:10}, color:'#888780' }, grid:{ color:'#e2e8f018' } }
        },
        layout: { padding: { right:75, top:12, bottom: PAD_BOTTOM } }
      },
      plugins: [
        makeRefPlugin(norme, alerte, action),
        makeValsPlugin(alerte, action),
        makePointLabelsPlugin(groups, PAD_BOTTOM)
      ]
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [chartData, norme, alerte, action])

  if (!chartData.pts.length) return null

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{salle}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background:CLASSE_BG[classe]||'#f5f5f5', color:CLASSE_TXT[classe]||'#333' }}>Classe {classe}</span>
          <span className="text-xs text-gray-400">{chartData.pts.length} points · {chartData.isos.length} dates</span>
        </div>
      </div>
      {/* Hauteur fixe 320px — barres adaptées automatiquement */}
      <div style={{ position:'relative', width:'100%', height:'320px' }}>
        <canvas ref={canvasRef}/>
      </div>
      <StatsBloc vals={chartData.allVals} alerte={alerte} action={action} periode={periode}/>
    </div>
  )
}

// ── Vue 3 : un graphique par point ─────────────────────────────────────────
function ChartVue3Point({ point, loc, data, type, norme, alerte, action, classe, chartType, showTrimestre }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const mesures = useMemo(() =>
    data.filter(c=>c.point===point&&c.type_controle===type)
      .sort((a,b)=>a.date_controle.localeCompare(b.date_controle))
      .map(c=>({ iso:c.date_controle, label:fmtDate(c.date_controle), val:c.germes }))
  , [data, point, type])

  useEffect(() => {
    if (!canvasRef.current || !mesures.length) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    const isCourbe = chartType==='line'
    const vals = mesures.map(m=>m.val)
    const colors  = mesures.map(m=>m.val>=action?'#dc262699':m.val>=alerte?'#d9770699':'#378ADD99')
    const borders = mesures.map(m=>m.val>=action?'#dc2626':m.val>=alerte?'#d97706':'#185FA5')

    chartRef.current = new window.Chart(canvasRef.current, {
      type: isCourbe?'line':'bar',
      data: { labels:mesures.map(m=>m.label), datasets:[{
        label:'UFC', data:vals,
        backgroundColor: isCourbe?'#378ADD22':colors,
        borderColor: isCourbe?borders:borders,
        borderWidth: isCourbe?2:1.5,
        pointRadius: isCourbe?4:0,
        pointBackgroundColor: isCourbe?borders:undefined,
        tension: isCourbe?0.3:0,
        fill: isCourbe,
        spanGaps: false,
      }]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend:{display:false},
          tooltip:{callbacks:{label:i=>`${i.raw} UFC`}}
        },
        scales: {
          x:{ticks:{font:{size:10},autoSkip:mesures.length>12,maxRotation:45,color:'#888780'},grid:{color:'#e2e8f018'}},
          y:{min:0, suggestedMax:Math.max(...vals)*1.25+2, ticks:{font:{size:10},color:'#888780'},grid:{color:'#e2e8f018'}}
        },
        layout:{padding:{right:65,top:16}}
      },
      plugins:[makeRefPlugin(norme, alerte, action), makeValsPlugin(alerte, action)]
    })
    return ()=>{ if(chartRef.current){chartRef.current.destroy();chartRef.current=null} }
  }, [mesures, norme, alerte, action, chartType])

  if (!mesures.length) return null
  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-bold text-gray-700 dark:text-white font-mono">{point}</span>
          {loc && <span className="text-xs text-gray-400 ml-2">— {loc}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background:CLASSE_BG[classe]||'#f5f5f5', color:CLASSE_TXT[classe]||'#333' }}>Classe {classe}</span>
          <span className="text-xs text-gray-400">{mesures.length} mesures</span>
        </div>
      </div>
      <div style={{ position:'relative', width:'100%', height:200 }}>
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
  const [pointsDB,  setPointsDB]  = useState([])   // pour localisations
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
      const [z, s, n, p] = await Promise.all([
        supabase.from('zones').select('*').eq('actif', true),
        supabase.from('salles').select('*, zones(code)').eq('actif', true),
        supabase.from('normes').select('*, zones(code)'),
        supabase.from('points_controle').select('zone_id, point, type_controle, localisation, classe'),
      ])
      setZones(z.data || [])
      setSalles(s.data || [])
      setNormes(n.data || [])
      setPointsDB(p.data || [])
      if (z.data?.length) setSelZone(z.data[0].code)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selZone || !zones.length) return
    const zoneObj = zones.find(z=>z.code===selZone)
    if (!zoneObj) return
    setLoadingData(true)
    async function fetchAll() {
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('controles')
          .select('date_controle,type_controle,point,germes,classe,salle_id')
          .eq('zone_id', zoneObj.id)
          .order('date_controle')
          .range(from, from+999)
        if (error||!data?.length) break
        all = [...all, ...data]
        if (data.length<1000) break
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

  // Map point → localisation pour la zone courante
  const pointsRef = useMemo(() => {
    const zoneObj = zones.find(z=>z.code===selZone)
    if (!zoneObj) return {}
    const map = {}
    pointsDB.filter(p=>p.zone_id===zoneObj.id&&p.type_controle===selType)
      .forEach(p=>{ if(p.localisation) map[p.point]=p.localisation })
    return map
  }, [pointsDB, selZone, selType, zones])

  const dataFiltered = useMemo(() => {
    if (selPeriode==='ALL') return controles
    const [d,f] = TRIMESTRES[selPeriode]
    return controles.filter(c=>c.date_controle>=d&&c.date_controle<=f)
  }, [controles, selPeriode])

  const sallesZone = useMemo(()=>salles.filter(s=>s.zones?.code===selZone),[salles,selZone])

  function getClasseSalle(salleId) {
    const cls=[...new Set(controles.filter(c=>c.salle_id===salleId).map(c=>c.classe).filter(Boolean))]
    return cls[0]||'?'
  }

  const classesDispos = useMemo(()=>[...new Set(controles.map(c=>c.classe).filter(Boolean))].sort(),[controles])

  const sallesFiltrees = useMemo(()=>{
    if (selClasse==='ALL') return sallesZone
    return sallesZone.filter(s=>getClasseSalle(s.id)===selClasse)
  },[sallesZone,selClasse,controles])

  function getNormes(cl) {
    return normesMap[`${selZone}_${cl}_${selType}`]||normesMap[`${selZone}_${selType}`]||{norme:null,alerte:0,action:9999,unite:'UFC'}
  }

  function getPoints(salleId) {
    const prefix=selType==='ACTIF'?'A':selType==='PASSIF'?'P':'S'
    return [...new Set(dataFiltered.filter(c=>c.salle_id===salleId&&c.type_controle===selType).map(c=>c.point))]
      .filter(p=>p.startsWith(prefix))
      .sort((a,b)=>{const na=parseInt(a.slice(1)),nb=parseInt(b.slice(1));return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb})
  }

  const showTrimestre = selPeriode!=='ALL'
  const normesCourantes = getNormes('')

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Points par salle</h1>
        <p className="text-gray-500 text-sm mt-1">Résultats individuels par point de prélèvement</p>
      </div>

      {/* Onglets zones */}
      <div className="flex gap-2 flex-wrap">
        {zones.map(z=>(
          <button key={z.code} onClick={()=>{setSelZone(z.code);setSelClasse('ALL')}}
            style={{borderColor:selZone===z.code?z.color:'transparent',background:selZone===z.code?z.color:undefined}}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
              ${selZone===z.code?'text-white':'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
            {z.icon} {z.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Vue</label>
            <div className="flex gap-1">
              {[['1','📊 Vue globale'],['3','🔍 Vue par point']].map(([v,l])=>(
                <button key={v} onClick={()=>setSelVue(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selVue===v?'bg-purple-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>

          {selVue==='3' && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Graphique</label>
              <div className="flex gap-1">
                {[['bar','▊ Barres'],['line','〜 Courbe']].map(([t,l])=>(
                  <button key={t} onClick={()=>setSelChart3(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selChart3===t?'bg-brand text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Type</label>
            <select value={selType} onChange={e=>setSelType(e.target.value)} className="input py-1.5 text-sm w-36">
              <option value="ACTIF">🌬️ Actif</option>
              <option value="PASSIF">📦 Passif</option>
              <option value="SURFACE">🧴 Surface</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Classe</label>
            <div className="flex gap-1">
              {['ALL',...classesDispos].map(c=>(
                <button key={c} onClick={()=>setSelClasse(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${selClasse===c?'bg-teal-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                  {c==='ALL'?'Toutes':`Cl. ${c}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Période</label>
            <div className="flex gap-1">
              {['ALL','T1','T2','T3','T4'].map(t=>(
                <button key={t} onClick={()=>setSelPeriode(t)}
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

        <div className="flex gap-5 pt-1 flex-wrap">
          {normesCourantes.norme!==null && (
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

      {!loadingData && sallesFiltrees.length===0 && (
        <div className="card p-10 text-center text-gray-400">
          Aucune salle{selClasse!=='ALL'?` en Classe ${selClasse}`:''} pour cette zone.
        </div>
      )}

      {!loadingData && sallesFiltrees.map(salle=>{
        const classeSalle=getClasseSalle(salle.id)
        const dataSalle=dataFiltered.filter(c=>c.salle_id===salle.id)
        if (!dataSalle.length) return null
        const n=getNormes(classeSalle)

        if (selVue==='1') {
          if (!showTrimestre) return (
            <div key={salle.id} className="card p-5 mb-4 border-l-4 border-l-amber-400">
              <div className="flex items-center gap-3">
                <span className="text-amber-500">⚠️</span>
                <div>
                  <div className="font-semibold text-gray-800 dark:text-white text-sm">{salle.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Sélectionne un trimestre pour afficher la vue globale.</div>
                </div>
              </div>
            </div>
          )
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
              pointsRef={pointsRef}
              periode={selPeriode}
            />
          )
        }

        const points=getPoints(salle.id)
        if (!points.length) return null
        return (
          <div key={salle.id} className="space-y-1">
            <div className="flex items-center gap-3 mb-2 mt-2">
              <h2 className="font-bold text-gray-800 dark:text-white text-sm">{salle.label}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{background:CLASSE_BG[classeSalle]||'#f5f5f5',color:CLASSE_TXT[classeSalle]||'#333'}}>Classe {classeSalle}</span>
            </div>
            {points.map(pt=>(
              <ChartVue3Point
                key={pt}
                point={pt}
                loc={pointsRef[pt]||''}
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
