export default function StatCard({ label, value, sub, color = 'text-brand', icon }) {
  return (
    <div className="card p-5">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <div className={`font-mono font-extrabold text-3xl leading-none ${color}`}>{value ?? '—'}</div>
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-2">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}
