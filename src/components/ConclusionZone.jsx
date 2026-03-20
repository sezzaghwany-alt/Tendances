// Composant réutilisable — conclusion générale basée sur les résultats d'une zone
// Inspiré du rapport AQ-R076-01 (page 109)

export default function ConclusionZone({ zone, type, classe, controles, normes, periode }) {
  if (!controles?.length || !normes) return null

  const norme  = normes.norme
  const alerte = normes.alerte
  const action = normes.action
  const unite  = normes.unite || 'UFC'

  const vals = controles.map(c => c.germes)
  const n    = vals.length
  const nc_alerte = vals.filter(v => v >= alerte).length
  const nc_action = vals.filter(v => v >= action).length
  const tx    = Math.round((1 - nc_alerte/n) * 100)
  const max   = Math.max(...vals)
  const mean  = +(vals.reduce((a,b)=>a+b,0)/n).toFixed(1)

  // Identifier les points NC récurrents
  const pointsNC = {}
  controles.filter(c => c.germes >= alerte).forEach(c => {
    pointsNC[c.point] = (pointsNC[c.point]||0) + 1
  })
  const recurrents = Object.entries(pointsNC).filter(([,v])=>v>=2).sort((a,b)=>b[1]-a[1])
  const ponctuels  = Object.entries(pointsNC).filter(([,v])=>v===1)

  // Saisonnalité : comparer T1/T2 vs T3/T4
  const byTrimestre = { T1:[], T2:[], T3:[], T4:[] }
  controles.forEach(c => {
    const m = new Date(c.date_controle).getMonth()
    const t = m<3?'T1':m<6?'T2':m<9?'T3':'T4'
    byTrimestre[t].push(c.germes)
  })
  const moyT = Object.fromEntries(Object.entries(byTrimestre).map(([t,v]) =>
    [t, v.length ? +(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null]
  ))
  const maxTrimestre = Object.entries(moyT).filter(([,v])=>v!==null).sort((a,b)=>b[1]-a[1])[0]
  const minTrimestre = Object.entries(moyT).filter(([,v])=>v!==null).sort((a,b)=>a[1]-b[1])[0]

  // Niveau de conformité global
  const niveau = nc_action === 0 && nc_alerte === 0 ? 'excellent'
    : nc_action === 0 && nc_alerte/n < 0.1 ? 'bon'
    : nc_action/n < 0.05 ? 'acceptable'
    : 'préoccupant'

  const niveauColor = {
    excellent: 'border-green-400 bg-green-50 dark:bg-green-900/10',
    bon:       'border-green-400 bg-green-50 dark:bg-green-900/10',
    acceptable:'border-amber-400 bg-amber-50 dark:bg-amber-900/10',
    préoccupant:'border-red-400 bg-red-50 dark:bg-red-900/10',
  }

  const typeLabel = type==='ACTIF'?'actif de l\'air':type==='PASSIF'?'passif de l\'air':'des surfaces'

  return (
    <div className={`card p-5 mt-2 border-l-4 ${niveauColor[niveau]}`}>
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        📋 Conclusion — {zone} · Classe {classe} · Contrôle {typeLabel}
        {periode && periode !== 'ALL' ? ` · ${periode}` : ' · 2025'}
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">

        {/* Phrase d'ouverture */}
        <p>
          {nc_action === 0 && nc_alerte === 0
            ? `Durant ${periode&&periode!=='ALL'?`le ${periode}`:'toute la période de contrôle'}, les résultats obtenus sont conformes aux limites fixées, avec un maximum de ${max} ${unite}.`
            : nc_action === 0
            ? `Les résultats obtenus durant ${periode&&periode!=='ALL'?`le ${periode}`:'la période de contrôle'} sont globalement conformes (${tx}% de conformité), avec ${nc_alerte} dépassement${nc_alerte>1?'s':''} de la limite d'alerte enregistré${nc_alerte>1?'s':''}.`
            : `Durant ${periode&&periode!=='ALL'?`le ${periode}`:'la période de contrôle'}, ${nc_action} dépassement${nc_action>1?'s':''} de la limite d'action ${nc_action>1?'ont été observés':'a été observé'} (${Math.round(nc_action/n*100)}% des mesures) — une investigation est requise.`
          }
        </p>

        {/* Points NC récurrents */}
        {recurrents.length > 0 && (
          <p>
            Des <span className="font-semibold text-red-600">NC récurrentes</span> ont été identifiées
            au niveau {recurrents.length===1?'du point':'des points'}{' '}
            <span className="font-mono font-bold text-red-600">
              {recurrents.map(([pt,n])=>`${pt} (${n} fois)`).join(', ')}
            </span>.{' '}
            {recurrents.some(([pt])=>pt.includes('SAS'))
              ? 'Ces points sont localisés dans des zones SAS, qui constituent des zones de transition à risque accru de contamination.'
              : 'Une investigation ciblée et une révision des pratiques de nettoyage/désinfection sont recommandées.'
            }
          </p>
        )}

        {/* Points NC ponctuels */}
        {ponctuels.length > 0 && nc_action > 0 && (
          <p>
            Des <span className="font-semibold text-amber-600">NC ponctuelles</span> ont également été relevées
            aux points <span className="font-mono font-bold">{ponctuels.map(([pt])=>pt).join(', ')}</span>,
            considérées comme des événements isolés ne remettant pas en cause la maîtrise globale du procédé.
          </p>
        )}

        {/* Saisonnalité */}
        {maxTrimestre && minTrimestre && maxTrimestre[0] !== minTrimestre[0] && (
          <p>
            L'analyse trimestrielle révèle une {parseFloat(maxTrimestre[1]) > parseFloat(minTrimestre[1])*1.5 ? 'variabilité significative' : 'légère variabilité'} saisonnière :
            le <span className="font-semibold">{maxTrimestre[0]}</span> présente la moyenne la plus élevée
            ({maxTrimestre[1]} {unite}){maxTrimestre[0]==='T2'||maxTrimestre[0]==='T3'
              ? ', ce qui est cohérent avec les températures estivales favorisant le développement microbien et nécessitant un renforcement de la surveillance.'
              : '.'
            }
            {minTrimestre[0]==='T1'||minTrimestre[0]==='T4'
              ? ` Le ${minTrimestre[0]} affiche la meilleure performance (${minTrimestre[1]} ${unite}), cohérent avec les conditions hivernales moins propices au développement microbien.`
              : ''
            }
          </p>
        )}

        {/* Recommandations selon niveau */}
        {niveau === 'préoccupant' && (
          <p className="font-medium text-red-700 dark:text-red-400">
            ⛔ Le niveau de contamination observé nécessite une révision des procédures de nettoyage,
            une vérification de l'état des filtres HEPA et une analyse des causes racines des dépassements récurrents.
          </p>
        )}
        {niveau === 'acceptable' && (
          <p className="font-medium text-amber-700 dark:text-amber-400">
            ⚠️ Bien que globalement conforme, la situation mérite une surveillance renforcée.
            Les limites d'alerte et d'action définies restent pertinentes et seront maintenues.
          </p>
        )}
        {(niveau === 'excellent' || niveau === 'bon') && (
          <p className="font-medium text-green-700 dark:text-green-400">
            ✅ Les limites d'alerte et d'action définies sont pertinentes et adaptées.
            Ces seuils seront maintenus pour la prochaine période de surveillance.
          </p>
        )}

        <p className="text-xs text-gray-400 italic">
          Référence : GMP Annexe 1 · SOP AQ-R076 · Norme applicable : &lt;{norme} {unite}
          (Alerte : {alerte} · Action : {action})
        </p>
      </div>
    </div>
  )
}
