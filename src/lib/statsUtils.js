// ─── STATISTIQUES ENVIRONNEMENTALES ─────────────────────────────────────────

export function mean(values) {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function stdDev(values) {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (values.length - 1))
}

export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export function min(values) { return values.length ? Math.min(...values) : 0 }
export function max(values) { return values.length ? Math.max(...values) : 0 }

// Cp = (USL - LSL) / (6 * sigma) — on utilise LSL=0, USL=action
export function cp(values, usl) {
  const s = stdDev(values)
  if (s === 0) return null
  return usl / (6 * s)
}

// Cpk = min((USL - mean) / (3*sigma), (mean - LSL) / (3*sigma)) — LSL=0
export function cpk(values, usl) {
  const s = stdDev(values)
  if (s === 0) return null
  const m = mean(values)
  return Math.min((usl - m) / (3 * s), m / (3 * s))
}

// Tendance linéaire (régression simple)
export function linearTrend(values) {
  const n = values.length
  if (n < 2) return { slope: 0, intercept: 0, direction: 'stable' }
  const xs = values.map((_, i) => i)
  const mx = mean(xs)
  const my = mean(values)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (values[i] - my), 0)
  const den = xs.reduce((s, x) => s + Math.pow(x - mx, 2), 0)
  const slope = den === 0 ? 0 : num / den
  const direction = slope > 0.05 ? 'hausse' : slope < -0.05 ? 'baisse' : 'stable'
  return { slope, intercept: my - slope * mx, direction }
}

// Interprétation automatique d'une série de valeurs
export function interpretSeries(values, alerte, action, label = '') {
  if (!values.length) return null

  const m = mean(values)
  const sd = stdDev(values)
  const trend = linearTrend(values)
  const cpkVal = cpk(values, action)
  const pctAboveAlerte = values.filter(v => v >= alerte).length / values.length * 100
  const pctAboveAction = values.filter(v => v >= action).length / values.length * 100

  const messages = []
  let niveau = 'ok' // ok | attention | critique

  // Tendance
  if (trend.direction === 'hausse') {
    messages.push(`📈 Tendance à la hausse détectée (+${trend.slope.toFixed(2)} UFC par mesure). Surveiller l'évolution.`)
    niveau = 'attention'
  } else if (trend.direction === 'baisse') {
    messages.push(`📉 Tendance à la baisse — amélioration continue constatée.`)
  } else {
    messages.push(`➡️ Valeurs stables sur la période.`)
  }

  // Dépassements
  if (pctAboveAction > 10) {
    messages.push(`🚨 ${pctAboveAction.toFixed(1)}% des mesures dépassent la limite d'action — action corrective requise.`)
    niveau = 'critique'
  } else if (pctAboveAlerte > 20) {
    messages.push(`⚠️ ${pctAboveAlerte.toFixed(1)}% des mesures dépassent la limite d'alerte — investigation recommandée.`)
    if (niveau === 'ok') niveau = 'attention'
  }

  // Cpk
  if (cpkVal !== null) {
    if (cpkVal >= 1.33) messages.push(`✅ Procédé capable (Cpk = ${cpkVal.toFixed(2)}) — bonne maîtrise du processus.`)
    else if (cpkVal >= 1.0) messages.push(`🟡 Procédé acceptable (Cpk = ${cpkVal.toFixed(2)}) — amélioration possible.`)
    else messages.push(`🔴 Procédé non capable (Cpk = ${cpkVal.toFixed(2)}) — révision du processus nécessaire.`)
  }

  // Variabilité
  if (sd > m * 0.8 && values.length > 5) {
    messages.push(`📊 Forte variabilité (σ = ${sd.toFixed(2)}) — le processus manque de régularité.`)
  }

  return { niveau, messages, m, sd, trend, cpkVal, pctAboveAlerte, pctAboveAction }
}

export function fullStats(values, alerte, action) {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    stdDev: stdDev(values),
    min: min(values),
    max: max(values),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
    cp: cp(values, action),
    cpk: cpk(values, action),
    pctAlerte: values.filter(v => v >= alerte).length / values.length * 100,
    pctAction: values.filter(v => v >= action).length / values.length * 100,
    trend: linearTrend(values),
  }
}
