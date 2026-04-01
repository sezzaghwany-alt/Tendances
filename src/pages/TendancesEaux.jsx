import { useState, useMemo } from 'react'

const EPU_STATS = {
  'S24.41':    { label:'Sortie EDI',              conductivite:{moy:0.7,max:1.4,std:0.2,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:3,max:59,std:4.4,la:30,lac:50,spec:100} },
  'PeS658':    { label:'Retour boucle',           conductivite:{moy:0.9,max:1.3,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:1,max:79,std:5.8,la:30,lac:50,spec:100} },
  'PeS607':    { label:'Sortie cuve avant UV',    conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:0,max:1,std:0.5,la:30,lac:50,spec:100} },
  'PeS632':    { label:'Sortie cuve après UV',    conductivite:{moy:1.0,max:1.4,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:2,max:14,std:2.2,la:30,lac:50,spec:100} },
  'PeS707':    { label:'Laverie dialyse',         conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:0,max:1,std:0.4,la:30,lac:50,spec:100} },
  'PeS709':    { label:'Prépa dialyse',           conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:1,max:1,std:0.5,la:30,lac:50,spec:100} },
  'PeS711':    { label:'Prépa dialyse 2',         conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:2,max:9,std:2.0,la:30,lac:50,spec:100} },
  'PeS713':    { label:'Prépa poches stériles',   conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:1,max:1,std:0.3,la:30,lac:50,spec:100} },
  'PeS715':    { label:'Laverie prépa poches',    conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:1,max:2,std:0.7,la:30,lac:50,spec:100} },
  'PeS717':    { label:'Lavage prod. poches',     conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:6,max:98,std:21.8,la:30,lac:50,spec:100} },
  'PeS719':    { label:'Laverie vêtements',       conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:4,max:13,std:3.5,la:30,lac:50,spec:100} },
  'PeS721':    { label:'Laverie CDP',             conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:0,max:1,std:0.4,la:30,lac:50,spec:100} },
  'V436A.1.2': { label:'Alim. GVP après pompe',  conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:7,max:30,std:8.8,la:30,lac:50,spec:100} },
  'V438A.1.3': { label:'Alim. distillateur',     conductivite:{moy:1.0,max:1.2,std:0.1,la:1.5,lac:2.6,spec:5.1}, dgat:{moy:2,max:9,std:2.2,la:30,lac:50,spec:100} },
}

const EPPI_STATS = {
  'V438A.4.4': { label:'Distillateur',           conductivite:{moy:0.5,max:1.1,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:36,max:90,std:10,la:150,lac:250,spec:500} },
  'Pes305':    { label:'Sortie cuve stockage',   conductivite:{moy:0.6,max:1.2,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:33,max:124,std:15,la:150,lac:250,spec:500} },
  'Pes359':    { label:'Sortie échangeur',       conductivite:{moy:0.6,max:1.1,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:39,max:100,std:14,la:150,lac:250,spec:500} },
  'VA402':     { label:'Laverie poches',         conductivite:{moy:0.6,max:1.2,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:36,max:108,std:17,la:150,lac:250,spec:500} },
  'Pes526':    { label:'Retour cuve stockage',   conductivite:{moy:0.6,max:1.2,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:30,max:110,std:13,la:150,lac:250,spec:500} },
  'VA140':     { label:'Vapeur (autoclave)',     conductivite:{moy:0.7,max:0.8,std:0.1,la:0.9,lac:1.1,spec:1.3}, cot:{moy:35,max:77,std:13,la:150,lac:250,spec:500} },
}

function StatCard({ label, value, unit, color }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-extrabold font-mono" style={{ color }}>{value}</div>
      {unit && <div className="text-[10px] text-gray-400 mt-0.5">{unit}</div>}
    </div>
  )
}

function BarComparison({ data, param, la, lac, spec, unite, title }) {
  const max = Math.max(...data.map(d => d.max), lac * 1.5)
  return (
    <div className="card p-4">
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">{title}</div>
      <div className="space-y-2">
        {data.map(({ point, label, moy, max: mx }) => {
          const pctMoy = Math.min((moy / max) * 100, 100)
          const pctMax = Math.min((mx / max) * 100, 100)
          const isNC = mx >= spec
          const isLac = mx >= lac && mx < spec
          const isLa = mx >= la && mx < lac
          const barColor = isNC ? '#dc2626' : isLac ? '#d97706' : isLa ? '#f59e0b' : '#1d6fa4'
          return (
            <div key={point}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-mono font-bold text-brand">{point}</span>
                  <span className="text-[10px] text-gray-400 ml-1">{label}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  moy: <span className="font-bold" style={{ color: barColor }}>{moy}</span>
                  {' '}max: <span className="font-bold" style={{ color: isNC?'#dc2626':isLac?'#d97706':'#374151' }}>{mx}</span>
                  {' '}{unite}
                </div>
              </div>
              <div className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                {/* Ligne spec */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                  style={{ left: `${Math.min((spec/max)*100,100)}%` }}/>
                {/* Ligne lac */}
                <div className="absolute top-0 bottom-0 w-px bg-orange-400 z-10"
                  style={{ left: `${Math.min((lac/max)*100,100)}%` }}/>
                {/* Ligne la */}
                <div className="absolute top-0 bottom-0 w-px bg-yellow-400 z-10"
                  style={{ left: `${Math.min((la/max)*100,100)}%` }}/>
                {/* Barre max */}
                <div className="absolute top-0 left-0 bottom-0 rounded-full opacity-30"
                  style={{ width: `${pctMax}%`, background: barColor }}/>
                {/* Barre moy */}
                <div className="absolute top-0 left-0 bottom-0 rounded-full"
                  style={{ width: `${pctMoy}%`, background: barColor }}/>
              </div>
            </div>
          )
        })}
        <div className="flex gap-4 mt-2 text-[10px] text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block"/>Alerte ({la})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block"/>Action ({lac})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block"/>Spéc. ({spec})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-brand/60 inline-block rounded"/>Moy.</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-brand/20 inline-block rounded"/>Max</span>
        </div>
      </div>
    </div>
  )
}

export default function TendancesEaux() {
  const [selType, setSelType] = useState('EPU')
  const [selParam, setSelParam] = useState('conductivite')
  const [selPoint, setSelPoint] = useState('S24.41')

  const stats = selType === 'EPU' ? EPU_STATS : EPPI_STATS
  const params = selType === 'EPU'
    ? [{ id:'conductivite', label:'Conductivité' }, { id:'dgat', label:'DGAT' }]
    : [{ id:'conductivite', label:'Conductivité' }, { id:'cot', label:'COT' }]

  const UNITE = { conductivite:'µS/cm', dgat:'UFC/mL', cot:'ppb' }

  const pointData = stats[selPoint]?.[selParam]
  const allData = Object.entries(stats).map(([pt, d]) => ({
    point: pt, label: d.label, ...d[selParam]
  })).filter(d => d.moy !== undefined)

  const ncCount = allData.filter(d => d.max >= (pointData?.spec||999)).length
  const alerteCount = allData.filter(d => d.max >= (pointData?.la||0) && d.max < (pointData?.lac||999)).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tendances — Eaux 2025</h1>
        <p className="text-gray-500 text-sm mt-1">Analyse statistique annuelle · {selType}</p>
      </div>

      {/* Filtres */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Type eau</label>
            <div className="flex gap-1">
              {['EPU','EPPI'].map(t => (
                <button key={t} onClick={() => {
                  setSelType(t)
                  setSelParam('conductivite')
                  setSelPoint(Object.keys(t === 'EPU' ? EPU_STATS : EPPI_STATS)[0])
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selType===t ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Paramètre</label>
            <div className="flex gap-1">
              {params.map(p => (
                <button key={p.id} onClick={() => setSelParam(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selParam===p.id ? 'bg-navy text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Point de détail</label>
            <select value={selPoint} onChange={e => setSelPoint(e.target.value)} className="input text-sm py-1.5 w-52">
              {Object.entries(stats).map(([pt, d]) => (
                <option key={pt} value={pt}>{pt} — {d.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats point sélectionné */}
      {pointData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Moyenne" value={pointData.moy} unit={UNITE[selParam]} color="#1d6fa4"/>
            <StatCard label="Max" value={pointData.max} unit={UNITE[selParam]}
              color={pointData.max >= pointData.spec ? '#dc2626' : pointData.max >= pointData.lac ? '#d97706' : '#16a34a'}/>
            <StatCard label="Écart-type" value={pointData.std} unit={UNITE[selParam]} color="#64748b"/>
            <StatCard label="Limite alerte" value={pointData.la} unit={UNITE[selParam]} color="#d97706"/>
            <StatCard label="Spéc. Ph.Eur" value={pointData.spec} unit={UNITE[selParam]} color="#dc2626"/>
          </div>

          {/* Interprétation */}
          <div className={`card p-4 border-l-4 ${
            pointData.max >= pointData.spec ? 'border-l-red-500' :
            pointData.max >= pointData.lac  ? 'border-l-amber-500' :
            pointData.max >= pointData.la   ? 'border-l-yellow-400' : 'border-l-green-500'
          }`}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Interprétation — {selPoint} · {params.find(p=>p.id===selParam)?.label}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {pointData.max >= pointData.spec
                ? `⛔ Dépassement de la spécification Ph.Eur (${pointData.spec} ${UNITE[selParam]}) — max observé : ${pointData.max}. Investigation requise.`
                : pointData.max >= pointData.lac
                ? `⚠️ Dépassement de la limite d'action (${pointData.lac} ${UNITE[selParam]}) — max observé : ${pointData.max}. Actions correctives nécessaires.`
                : pointData.max >= pointData.la
                ? `🔶 Dépassement de la limite d'alerte (${pointData.la} ${UNITE[selParam]}) — max observé : ${pointData.max}. Surveillance renforcée recommandée.`
                : `✅ Toutes les valeurs sont inférieures à la limite d'alerte (${pointData.la} ${UNITE[selParam]}). Moyenne : ${pointData.moy} — Système sous contrôle.`
              }
            </div>
          </div>
        </>
      )}

      {/* Comparaison tous les points */}
      {pointData && (
        <BarComparison
          data={allData}
          param={selParam}
          la={pointData.la}
          lac={pointData.lac}
          spec={pointData.spec}
          unite={UNITE[selParam]}
          title={`Comparaison ${selType} — ${params.find(p=>p.id===selParam)?.label} (moy. et max. 2025)`}
        />
      )}

      {/* Tableau récapitulatif */}
      <div className="card p-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Récapitulatif conformité — {selType} {params.find(p=>p.id===selParam)?.label}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Point','Localisation','Moyenne','Max','Écart-type','Statut'].map(h => (
                  <th key={h} className="text-left font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {allData.map(d => {
                const isNC  = d.max >= d.spec
                const isLac = d.max >= d.lac && !isNC
                const isLa  = d.max >= d.la  && !isLac && !isNC
                const statut = isNC ? { label:'NC', bg:'#fef2f2', border:'#fca5a5', txt:'#991b1b' }
                             : isLac ? { label:'Action', bg:'#fff7ed', border:'#fdba74', txt:'#9a3412' }
                             : isLa  ? { label:'Alerte', bg:'#fffbeb', border:'#fcd34d', txt:'#92400e' }
                             :         { label:'Conforme', bg:'#f0fdf4', border:'#86efac', txt:'#166534' }
                return (
                  <tr key={d.point} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono font-bold text-brand">{d.point}</td>
                    <td className="py-2 pr-4 text-gray-500">{d.label}</td>
                    <td className="py-2 pr-4 font-mono">{d.moy} <span className="text-gray-400">{UNITE[selParam]}</span></td>
                    <td className="py-2 pr-4 font-mono font-bold" style={{ color: isNC?'#dc2626':isLac?'#d97706':'inherit' }}>{d.max}</td>
                    <td className="py-2 pr-4 font-mono text-gray-400">{d.std}</td>
                    <td className="py-2 pr-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background:statut.bg, border:`1px solid ${statut.border}`, color:statut.txt }}>
                        {statut.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
