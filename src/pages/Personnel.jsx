import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NORME = 5
const POSITIONS = ['MD','MG','BD','BG','AVD','AVG']
const POS_LABELS = {
  MD:'Main droite', MG:'Main gauche', BD:'Bras droit',
  BG:'Bras gauche', AVD:'Avant-bras droit', AVG:'Avant-bras gauche'
}
const TRIMESTRES = {
  T1:['2025-01-01','2025-03-31'], T2:['2025-04-01','2025-06-30'],
  T3:['2025-07-01','2025-09-30'], T4:['2025-10-01','2025-12-31'],
}
const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const OP_COLORS = ['#378ADD','#1D9E75','#D4537E','#BA7517','#7F77DD','#D85A30','#639922']

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Plugin norme ───────────────────────────────────────────────────────────
const normePlugin = {
  id: 'normeRef',
  afterDraw(chart) {
    const { ctx: c, scales: { y, x } } = chart
    if (!y || !x) return
    if (NORME > y.max) return
    const yp = y.getPixelForValue(NORME)
    c.save(); c.setLineDash([5,4]); c.lineWidth = 1.5; c.strokeStyle = '#dc2626'
    c.beginPath(); c.moveTo(x.left, yp); c.lineTo(x.right, yp); c.stroke()
    c.setLineDash([]); c.font = '9px sans-serif'; c.fillStyle = '#dc2626'; c.textAlign = 'right'
    c.fillText(`Norme ${NORME}`, x.right, yp - 3)
    c.restore()
  }
}

// ── Composant graphique réutilisable ───────────────────────────────────────
function ChartBox({ id, config, height = 220 }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    chartRef.current = new window.Chart(canvasRef.current, config)
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [config])
  return (
    <div style={{ position:'relative', width:'100%', height }}>
      <canvas ref={canvasRef} id={id}/>
    </div>
  )
}

// ── Conclusion générale par opérateur ─────────────────────────────────────
function ConclusionPersonnel({ data, operateurs, periode }) {
  const stats = useMemo(() => {
    return operateurs.map(op => {
      const od = data.filter(r => r.operateur_nom === op)
      const totalControles = od.length
      if (!totalControles) return null
      const ncControles = od.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
      const tx = Math.round((1 - ncControles/totalControles) * 100)
      const maxVals = {}
      POSITIONS.forEach(p => { maxVals[p] = Math.max(...od.map(r => r[p]||0)) })
      const positionsNC = POSITIONS.filter(p => maxVals[p] > NORME)
      const recurrentes = POSITIONS.filter(p => od.filter(r=>(r[p]||0)>NORME).length >= 2)
      return { op, totalControles, ncControles, tx, positionsNC, recurrentes, maxVals }
    }).filter(Boolean)
  }, [data, operateurs])

  const globalNC = data.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
  const globalTx = data.length ? Math.round((1 - globalNC/data.length)*100) : 100
  const positionsLesPlus = POSITIONS.map(p => ({
    p, n: data.filter(r => (r[p]||0) > NORME).length
  })).sort((a,b) => b.n-a.n).filter(x => x.n > 0)

  return (
    <div className="card p-5 mt-4 border-l-4 border-l-blue-500">
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        📋 Conclusion générale — Contrôle du personnel{periode !== 'ALL' ? ` · ${periode}` : ' · 2025'}
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3 leading-relaxed">
        <p>
          L'analyse des {data.length} contrôles microbiologiques du personnel réalisés
          {periode === 'ALL' ? ' sur l\'ensemble de l\'année 2025' : ` au cours du ${periode}`} montre
          un <span className={`font-semibold ${globalTx >= 95 ? 'text-green-600' : globalTx >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
            taux de conformité global de {globalTx}%
          </span> ({data.length - globalNC} contrôles conformes sur {data.length}).
        </p>

        {positionsLesPlus.length > 0 ? (
          <p>
            Les non-conformités sont principalement concentrées au niveau
            de <span className="font-semibold text-amber-600">{positionsLesPlus.slice(0,2).map(x=>`${x.p} (${POS_LABELS[x.p]})`).join(' et ')}</span>,
            ce qui est cohérent avec les zones anatomiques les plus exposées lors des manipulations
            en salle à atmosphère contrôlée.
          </p>
        ) : (
          <p className="text-green-700 dark:text-green-400 font-medium">
            Aucune non-conformité relevée sur l'ensemble des positions contrôlées. La maîtrise de l'hygiène
            des mains et des avant-bras est satisfaisante.
          </p>
        )}

        {stats.map(s => s.recurrentes.length > 0 && (
          <p key={s.op}>
            Pour l'opérateur <span className="font-semibold">{s.op}</span>,
            des NC récurrentes ont été observées au niveau
            de <span className="text-red-600 font-semibold">{s.recurrentes.map(p=>`${p} (${POS_LABELS[p]})`).join(', ')}</span>.
            Une action corrective ciblée (renforcement de la technique d'habillage, sensibilisation
            aux bonnes pratiques de gantage) est recommandée.
          </p>
        ))}

        <p className="text-xs text-gray-400 italic mt-2">
          Norme applicable : &lt;{NORME} UFC/boîte
        </p>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function Personnel() {
  const [controles, setControles] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selVue,    setSelVue]    = useState('operateur')
  const [selPeriode,setSelPeriode]= useState('ALL')
  const [selOp,     setSelOp]     = useState('ALL')
  const [chartReady,setChartReady]= useState(false)

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    s.onload = () => setChartReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    async function load() {
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('controles_personnel')
          .select('*')
          .order('date_controle')
          .range(from, from + 999)
        if (error || !data?.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      // Pivoter : une ligne par contrôle avec toutes positions
      const grouped = {}
      all.forEach(r => {
        const key = `${r.date_controle}_${r.operateur_nom}_${r.lot||''}`
        if (!grouped[key]) grouped[key] = { date_controle:r.date_controle, operateur_nom:r.operateur_nom, lot:r.lot, produit:r.produit, MD:0,MG:0,BD:0,BG:0,AVD:0,AVG:0 }
        grouped[key][r.position] = r.germes
      })
      setControles(Object.values(grouped))
      setLoading(false)
    }
    load()
  }, [])

  const dataFiltered = useMemo(() => {
    let d = controles
    if (selPeriode !== 'ALL') {
      const [debut, fin] = TRIMESTRES[selPeriode]
      d = d.filter(r => r.date_controle >= debut && r.date_controle <= fin)
    }
    if (selOp !== 'ALL') d = d.filter(r => r.operateur_nom === selOp)
    return d
  }, [controles, selPeriode, selOp])

  const operateurs = useMemo(() =>
    [...new Set(controles.map(r => r.operateur_nom).filter(Boolean))].sort()
  , [controles])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = dataFiltered.length
    const nc = dataFiltered.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
    const tx = total ? Math.round((1 - nc/total)*100) : 100
    const maxVal = total ? Math.max(...dataFiltered.flatMap(r => POSITIONS.map(p => r[p]||0))) : 0
    const posNC = [...new Set(dataFiltered.filter(r=>POSITIONS.some(p=>(r[p]||0)>NORME)).flatMap(r=>POSITIONS.filter(p=>(r[p]||0)>NORME)))]
    return { total, nc, tx, maxVal, posNC }
  }, [dataFiltered])

  // ── Config graphique Vue Opérateur ──
  const configOpMoyenne = useMemo(() => {
    if (!chartReady) return null
    const ops = selOp === 'ALL' ? operateurs : [selOp]
    return {
      type: 'bar',
      data: {
        labels: POSITIONS,
        datasets: ops.map((op, i) => ({
          label: op,
          data: POSITIONS.map(p => {
            const od = dataFiltered.filter(r => r.operateur_nom === op)
            return od.length ? +(od.reduce((a,r) => a+(r[p]||0), 0)/od.length).toFixed(2) : 0
          }),
          backgroundColor: OP_COLORS[i % OP_COLORS.length] + '99',
          borderColor: OP_COLORS[i % OP_COLORS.length],
          borderWidth: 1.5,
        }))
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{ display:true, position:'top', labels:{ boxWidth:10, font:{size:11} } },
          tooltip:{ callbacks:{ label:i=>`${i.dataset.label}: ${i.raw} UFC moy.` } } },
        scales: { x:{ ticks:{font:{size:11}} }, y:{ min:0, ticks:{font:{size:10}} } },
        layout:{ padding:{ right:60, top:8 } }
      },
      plugins: [normePlugin]
    }
  }, [dataFiltered, operateurs, selOp, chartReady])

  // ── Config graphique Vue Position ──
  const configsPosition = useMemo(() => {
    if (!chartReady) return []
    const ops = selOp === 'ALL' ? operateurs : [selOp]
    return POSITIONS.map((pos, pi) => ({
      type: 'bar',
      data: {
        labels: ops,
        datasets: [{
          label: pos,
          data: ops.map(op => {
            const od = dataFiltered.filter(r => r.operateur_nom === op)
            return od.length ? +(od.reduce((a,r) => a+(r[pos]||0), 0)/od.length).toFixed(2) : 0
          }),
          backgroundColor: ops.map((_, i) => OP_COLORS[i % OP_COLORS.length] + '99'),
          borderColor: ops.map((_, i) => OP_COLORS[i % OP_COLORS.length]),
          borderWidth: 1.5,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{display:false}, tooltip:{callbacks:{label:i=>`${i.raw} UFC moy.`}} },
        scales: {
          x:{ ticks:{font:{size:11}} },
          y:{ min:0, ticks:{font:{size:10}} }
        },
        layout:{ padding:{ right:60, top:8 } }
      },
      plugins: [normePlugin, {
        id:'vals',
        afterDatasetsDraw(chart) {
          const { ctx:c, data:d } = chart; c.save()
          d.datasets[0].data.forEach((val, i) => {
            if (!val) return
            const bar = chart.getDatasetMeta(0).data[i]
            c.font = `${val>=NORME?'bold ':''}9px sans-serif`
            c.fillStyle = val>=NORME?'#dc2626':'#aaa'; c.textAlign='center'
            c.fillText(val.toFixed(1), bar.x, bar.y-3)
          })
          c.restore()
        }
      }]
    }))
  }, [dataFiltered, operateurs, selOp, chartReady])

  // ── Config graphique Vue Temporelle ──
  const configTemps = useMemo(() => {
    if (!chartReady) return null
    const ops = selOp === 'ALL' ? operateurs : [selOp]
    return {
      type: 'line',
      data: {
        labels: MOIS_SHORT,
        datasets: ops.map((op, i) => ({
          label: op,
          data: Array.from({length:12}, (_,m) => {
            const od = dataFiltered.filter(r => {
              const rm = new Date(r.date_controle).getMonth()
              return r.operateur_nom === op && rm === m
            })
            if (!od.length) return null
            const nc = od.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
            return Math.round(nc/od.length*100)
          }),
          borderColor: OP_COLORS[i % OP_COLORS.length],
          backgroundColor: OP_COLORS[i % OP_COLORS.length] + '22',
          borderWidth: 2, pointRadius: 4, tension: 0.3, spanGaps: false, fill: false,
        }))
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{display:true, position:'top', labels:{boxWidth:10, font:{size:11}}},
          tooltip:{callbacks:{label:i=>`${i.dataset.label}: ${i.raw}% NC`}} },
        scales: {
          x:{ ticks:{font:{size:11}}, grid:{color:'#e2e8f018'} },
          y:{ min:0, max:100, ticks:{font:{size:10}, callback:v=>v+'%'}, grid:{color:'#e2e8f018'} }
        }
      }
    }
  }, [dataFiltered, operateurs, selOp, chartReady])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"/></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Contrôle du personnel</h1>
        <p className="text-gray-500 text-sm mt-1">Empreintes gants — Salle de stérilité · Norme &lt;{NORME} UFC/boîte</p>
      </div>

      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Vue */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Vue</label>
            <div className="flex gap-1">
              {[['operateur','👤 Par opérateur'],['position','✋ Par position'],['temps','📈 Évolution']].map(([v,l]) => (
                <button key={v} onClick={() => setSelVue(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selVue===v?'bg-teal-600 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Opérateur */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Opérateur</label>
            <select value={selOp} onChange={e => setSelOp(e.target.value)} className="input py-1.5 text-sm w-44">
              <option value="ALL">Tous les opérateurs</option>
              {operateurs.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
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

          <div className="ml-auto text-xs text-gray-400 font-mono">{dataFiltered.length} contrôles</div>
        </div>

        {/* Légende norme */}
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 pt-1">
          <span className="w-5 border-t-2 border-dashed border-red-500 inline-block"/>
          Norme : {NORME} UFC/boîte
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          ['Contrôles', kpis.total, ''],
          ['Non conformes', kpis.nc, kpis.nc>0?'text-red-500':'text-green-600'],
          ['Taux conformité', kpis.tx+'%', kpis.tx>=95?'text-green-600':kpis.tx>=80?'text-amber-500':'text-red-500'],
          ['Max UFC', kpis.maxVal, kpis.maxVal>=NORME?'text-red-500':''],
          ['Positions NC', kpis.posNC.join(', ')||'—', kpis.posNC.length?'text-amber-500 text-xs':''],
        ].map(([lbl, val, col]) => (
          <div key={lbl} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{lbl}</div>
            <div className={`font-bold text-lg font-mono ${col||'text-gray-800 dark:text-white'}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── VUE OPÉRATEUR ── */}
      {selVue === 'operateur' && (
        <div className="space-y-4">
          {/* Tableau récap */}
          <div className="card p-5">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Résultats par opérateur — toutes positions</div>
            <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
              {(selOp === 'ALL' ? operateurs : [selOp]).map((op, oi) => {
                const od = dataFiltered.filter(r => r.operateur_nom === op)
                if (!od.length) return null
                const nc = od.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
                const tx = Math.round((1-nc/od.length)*100)
                const maxPerPos = {}
                POSITIONS.forEach(p => { maxPerPos[p] = Math.max(...od.map(r => r[p]||0)) })
                const worstPos = Object.entries(maxPerPos).sort((a,b)=>b[1]-a[1])[0]
                const globalMax = Math.max(...Object.values(maxPerPos))

                return (
                  <div key={op} className="flex items-center gap-4 py-3 px-1">
                    {/* Nom */}
                    <div className="w-36 font-semibold text-sm text-gray-800 dark:text-white shrink-0">{op}</div>

                    {/* NC + Taux */}
                    <div className="w-20 shrink-0 text-center">
                      <div className="font-bold text-sm" style={{ color: nc>0?'#dc2626':'#16a34a' }}>{nc} NC</div>
                      <div className="text-xs text-gray-400">{od.length} ctrl.</div>
                    </div>
                    <div className="w-14 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                        background: tx>=95?'#E8F5E9':tx>=80?'#FFF3E0':'#FFEBEE',
                        color: tx>=95?'#3B6D11':tx>=80?'#854F0B':'#A32D2D'
                      }}>{tx}%</span>
                    </div>

                    {/* Barres par position */}
                    <div className="flex gap-3 flex-1 items-end">
                      {POSITIONS.map(p => {
                        const val = maxPerPos[p]
                        const barH = globalMax > 0 ? Math.max(Math.round((val/globalMax)*48), val>0?6:3) : 3
                        const col = val >= NORME ? '#dc2626' : val > 0 ? '#d97706' : '#378ADD'
                        return (
                          <div key={p} className="flex flex-col items-center gap-1">
                            <div className="text-[9px] font-bold text-gray-400">{p}</div>
                            <div style={{
                              width: 28, height: barH,
                              background: col + (val===0?'55':'cc'),
                              borderRadius: 3,
                              minHeight: 4,
                            }}/>
                            <div className="text-[10px] font-bold" style={{ color: val>=NORME?'#dc2626':val>0?'#d97706':'#888' }}>{val}</div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pire position */}
                    <div className="text-xs text-gray-400 shrink-0 w-20">
                      {worstPos[1]>0 && <span>Max: <span className="font-bold text-gray-600 dark:text-gray-300">{worstPos[0]}</span></span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Graphique moyennes par position */}
          <div className="card p-5">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Moyenne UFC par position et par opérateur</div>
            {configOpMoyenne && <ChartBox id="cvOp" config={configOpMoyenne} height={240}/>}
          </div>

          {/* Tableau détail des NC */}
          {dataFiltered.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length > 0 && (
            <div className="card p-5">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Détail des non-conformités</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {['Date','Opérateur','Lot',...POSITIONS].map(h => (
                        <th key={h} className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-2 pr-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {dataFiltered.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).map((r, i) => (
                      <tr key={i} className="bg-red-50/50 dark:bg-red-900/10">
                        <td className="py-2 pr-3 font-mono text-xs">{fmtDate(r.date_controle)}</td>
                        <td className="py-2 pr-3 text-xs font-medium">{r.operateur_nom}</td>
                        <td className="py-2 pr-3 text-xs text-gray-400">{r.lot||'—'}</td>
                        {POSITIONS.map(p => (
                          <td key={p} className="py-2 pr-3 font-mono text-xs font-bold" style={{ color:(r[p]||0)>=NORME?'#dc2626':'#888' }}>
                            {r[p]||0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ConclusionPersonnel data={dataFiltered} operateurs={selOp==='ALL'?operateurs:[selOp]} periode={selPeriode}/>
        </div>
      )}

      {/* ── VUE POSITION ── */}
      {selVue === 'position' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {POSITIONS.map((pos, pi) => (
              <div key={pos} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{pos} — {POS_LABELS[pos]}</div>
                  <span className="text-xs text-gray-400">
                    {dataFiltered.filter(r=>(r[pos]||0)>NORME).length} NC / {dataFiltered.length}
                  </span>
                </div>
                {configsPosition[pi] && <ChartBox id={`cvP${pi}`} config={configsPosition[pi]} height={180}/>}
              </div>
            ))}
          </div>
          <ConclusionPersonnel data={dataFiltered} operateurs={selOp==='ALL'?operateurs:[selOp]} periode={selPeriode}/>
        </div>
      )}

      {/* ── VUE TEMPORELLE ── */}
      {selVue === 'temps' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Évolution mensuelle du taux de non-conformité (%) par opérateur
            </div>
            {configTemps && <ChartBox id="cvT" config={configTemps} height={280}/>}
          </div>

          {/* Heatmap NC par opérateur × mois */}
          <div className="card p-5">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Détail mensuel — nombre de NC</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-bold text-gray-400 uppercase pb-2 pr-3">Opérateur</th>
                    {MOIS_SHORT.map(m => <th key={m} className="font-bold text-gray-400 pb-2 px-1 text-center">{m}</th>)}
                    <th className="font-bold text-gray-400 pb-2 px-1 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {(selOp==='ALL'?operateurs:[selOp]).map(op => {
                    const od = dataFiltered.filter(r => r.operateur_nom === op)
                    const total = od.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
                    return (
                      <tr key={op} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-2 pr-3 font-medium">{op}</td>
                        {Array.from({length:12}, (_,m) => {
                          const md = od.filter(r => new Date(r.date_controle).getMonth() === m)
                          const nc = md.filter(r => POSITIONS.some(p => (r[p]||0) > NORME)).length
                          return (
                            <td key={m} className="py-2 px-1 text-center font-mono" style={{
                              background: nc>0?'#fee2e2':md.length>0?'#f0fdf4':'',
                              color: nc>0?'#dc2626':'',
                              fontWeight: nc>0?'bold':'normal'
                            }}>{md.length>0?(nc||'✓'):'—'}</td>
                          )
                        })}
                        <td className="py-2 px-1 text-center font-mono font-bold" style={{ color:total>0?'#dc2626':'#16a34a' }}>{total||'✓'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ConclusionPersonnel data={dataFiltered} operateurs={selOp==='ALL'?operateurs:[selOp]} periode={selPeriode}/>
        </div>
      )}
    </div>
  )
}
