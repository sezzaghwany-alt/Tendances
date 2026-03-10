export default function ChartInterpretation({ interpretation }) {
  if (!interpretation) return null
  const { niveau, messages } = interpretation

  const colors = {
    ok:        'bg-green-50  dark:bg-green-900/20 border-green-200  dark:border-green-800',
    attention: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    critique:  'bg-red-50    dark:bg-red-900/20   border-red-200    dark:border-red-800',
  }

  return (
    <div className={`mt-4 rounded-xl border p-4 ${colors[niveau]}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        🤖 Interprétation automatique
      </div>
      <ul className="space-y-1">
        {messages.map((m, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{m}</li>
        ))}
      </ul>
    </div>
  )
}
