import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, Area, AreaChart, Cell
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────────

const trimestres = ["T1", "T2", "T3", "T4"];

const moyennesParType = [
  { trimestre: "T1", ACTIF: 0.15, PASSIF: 0.04, SURFACE: 0.02, alerte_actif: 3, action_actif: 5, alerte_passif: 2, action_passif: 3, alerte_surface: 2, action_surface: 3 },
  { trimestre: "T2", ACTIF: 0.37, PASSIF: 0.15, SURFACE: 0.14, alerte_actif: 3, action_actif: 5, alerte_passif: 2, action_passif: 3, alerte_surface: 2, action_surface: 3 },
  { trimestre: "T3", ACTIF: 0.73, PASSIF: 0.38, SURFACE: 0.25, alerte_actif: 3, action_actif: 5, alerte_passif: 2, action_passif: 3, alerte_surface: 2, action_surface: 3 },
  { trimestre: "T4", ACTIF: 0.56, PASSIF: 0.47, SURFACE: 0.27, alerte_actif: 3, action_actif: 5, alerte_passif: 2, action_passif: 3, alerte_surface: 2, action_surface: 3 },
];

const depassements = [
  { trimestre: "T1", alerte: 0, action: 0, mesures: 520 },
  { trimestre: "T2", alerte: 5, action: 4, mesures: 585 },
  { trimestre: "T3", alerte: 9, action: 8, mesures: 520 },
  { trimestre: "T4", alerte: 7, action: 7, mesures: 156 },
];

const personnelData = [
  { trimestre: "T1", controles: 42, avecGermes: 0, total: 0, MD: 0, MG: 0, BD: 0, AVD: 0, AVG: 0, BG: 0 },
  { trimestre: "T2", controles: 54, avecGermes: 4, total: 4, MD: 1, MG: 3, BD: 0, AVD: 0, AVG: 0, BG: 0 },
  { trimestre: "T3", controles: 41, avecGermes: 22, total: 26, MD: 10, MG: 6, BD: 4, AVD: 3, AVG: 3, BG: 0 },
  { trimestre: "T4", controles: 12, avecGermes: 3, total: 3, MD: 0, MG: 0, BD: 0, AVD: 2, AVG: 1, BG: 0 },
];

// Monthly average trend (grouping dates by month)
const tendanceMensuelle = [
  { mois: "Jan", moy: 0.07 },
  { mois: "Fév", moy: 0.10 },
  { mois: "Mar", moy: 0.05 },
  { mois: "Avr", moy: 0.38 },
  { mois: "Mai", moy: 0.14 },
  { mois: "Juin", moy: 0.09 },
  { mois: "Juil", moy: 0.28 },
  { mois: "Août", moy: 0.37 },
  { mois: "Sep", moy: 0.59 },
  { mois: "Oct", moy: 0.42 },
];

const radarPersonnel = [
  { position: "Main D.", T1: 0, T2: 1, T3: 10, T4: 0 },
  { position: "Main G.", T1: 0, T2: 3, T3: 6, T4: 0 },
  { position: "Bout D.", T1: 0, T2: 0, T3: 4, T4: 0 },
  { position: "Bout G.", T1: 0, T2: 0, T3: 0, T4: 0 },
  { position: "Av. D.", T1: 0, T2: 0, T3: 3, T4: 2 },
  { position: "Av. G.", T1: 0, T2: 0, T3: 3, T4: 1 },
];

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0f1a",
  card: "#111827",
  border: "#1f2d45",
  accent1: "#00d4ff",
  accent2: "#ff6b35",
  accent3: "#a3e635",
  accent4: "#f59e0b",
  muted: "#4b6080",
  text: "#e2e8f0",
  textDim: "#64748b",
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a2540", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: C.accent1, fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, color, trend }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: "18px 22px", position: "relative", overflow: "hidden"
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: `linear-gradient(90deg, ${color}, transparent)`
    }} />
    <div style={{ color: C.textDim, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
    <div style={{ color, fontSize: 32, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
    <div style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>{sub}</div>
    {trend && <div style={{ color: trend > 0 ? "#ef4444" : "#22c55e", fontSize: 11, marginTop: 4 }}>
      {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}% vs T1
    </div>}
  </div>
);

// ── Section Title ─────────────────────────────────────────────────────────────
const SectionTitle = ({ children, color = C.accent1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
    <div style={{ width: 4, height: 20, background: color, borderRadius: 2 }} />
    <span style={{ color: C.text, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{children}</span>
  </div>
);

// ── Chart Card ────────────────────────────────────────────────────────────────
const ChartCard = ({ title, color, children, span = 1 }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: "20px 24px", gridColumn: `span ${span}`
  }}>
    <SectionTitle color={color}>{title}</SectionTitle>
    {children}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function STERDashboard() {
  const [activeT, setActiveT] = useState("T3");

  const activePers = personnelData.find(d => d.trimestre === activeT);
  const pctNonConf = depassements.map(d => ({
    ...d,
    pct: ((d.alerte / d.mesures) * 100).toFixed(1)
  }));

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", padding: "28px 32px",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: C.text
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
          <span style={{ color: C.accent1, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em" }}>
            ZONE STÉRILISATION · CLASSE B · 2025
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>
          Surveillance Microbiologique Environnementale
        </h1>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="Mesures totales" value="1 781" sub="4 trimestres · 2025" color={C.accent1} />
        <KPI label="Dépassements alerte" value="21" sub="T2→T4 cumulés" color={C.accent2} trend={+∞} />
        <KPI label="Contrôles personnel" value="149" sub="empreintes gants" color={C.accent3} />
        <KPI label="Pic contamination" value="T3" sub="Sep 2025 · moy 0.59 UFC" color={C.accent4} />
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

        {/* Tendance mensuelle */}
        <ChartCard title="Tendance mensuelle — Moyenne UFC/m³ (Actif)" color={C.accent1} span={2}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tendanceMensuelle} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMois" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent1} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.accent1} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="mois" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={3} stroke={C.accent4} strokeDasharray="4 4" label={{ value: "Alerte", fill: C.accent4, fontSize: 10 }} />
              <Area type="monotone" dataKey="moy" stroke={C.accent1} strokeWidth={2.5} fill="url(#gradMois)" name="Moy. UFC" dot={{ fill: C.accent1, r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Moyenne par type de contrôle */}
        <ChartCard title="Moyenne UFC par type de contrôle" color={C.accent3}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={moyennesParType} margin={{ top: 4, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="trimestre" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
              <Bar dataKey="ACTIF" name="Actif (air)" fill={C.accent1} radius={[4, 4, 0, 0]} />
              <Bar dataKey="PASSIF" name="Passif (boîtes)" fill={C.accent3} radius={[4, 4, 0, 0]} />
              <Bar dataKey="SURFACE" name="Surfaces" fill={C.accent4} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Dépassements */}
        <ChartCard title="Dépassements limites Alerte & Action" color={C.accent2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pctNonConf} margin={{ top: 4, right: 10, left: -10, bottom: 0 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="trimestre" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
              <Bar dataKey="alerte" name="Dépass. alerte" fill={C.accent4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="action" name="Dépass. action" fill={C.accent2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Personnel section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

        {/* Germes personnel par trimestre */}
        <ChartCard title="Personnel — Germes détectés (total empreintes gants)" color={C.accent4}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={personnelData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="trimestre" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
              <Bar dataKey="avecGermes" name="Contrôles positifs" fill={C.accent2} radius={[4, 4, 0, 0]} />
              <Bar dataKey="total" name="Total UFC détectés" fill={C.accent4} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar empreintes gants — par trimestre sélectionnable */}
        <ChartCard title="Répartition UFC par position de gant" color="#c084fc">
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {trimestres.map(t => (
              <button key={t} onClick={() => setActiveT(t)} style={{
                padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11,
                background: activeT === t ? "#c084fc" : C.border,
                color: activeT === t ? "#fff" : C.textDim,
                fontWeight: activeT === t ? 700 : 400, transition: "all 0.2s"
              }}>{t}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <RadarChart data={radarPersonnel} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="position" tick={{ fill: C.textDim, fontSize: 10 }} />
              <Radar name={activeT} dataKey={activeT} stroke="#c084fc" fill="#c084fc" fillOpacity={0.35} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 11, marginTop: 4 }}>
            {activePers?.controles} contrôles · {activePers?.avecGermes} positifs · {activePers?.total} UFC totaux
          </div>
        </ChartCard>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, color: C.muted, fontSize: 10, textAlign: "right", letterSpacing: "0.05em" }}>
        DONNÉES 2025 · ZONE STÉRILISATION CLASSE B · LIMITES : ALERTE 3 UFC/m³ (ACTIF) · ACTION 5 UFC/m³
      </div>
    </div>
  );
}
