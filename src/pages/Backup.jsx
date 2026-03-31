import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Download, Database, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

const TABLES = [
  { name: 'controles',           label: 'Controles environnement' },
  { name: 'controles_personnel', label: 'Controles personnel' },
  { name: 'zones',               label: 'Zones' },
  { name: 'salles',              label: 'Salles' },
  { name: 'normes',              label: 'Normes' },
  { name: 'points_controle',     label: 'Points de controle' },
  { name: 'profiles',            label: 'Utilisateurs' },
  { name: 'audit_trail',         label: 'Audit trail' },
]

async function fetchAll(table) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table).select('*').range(from, from + 999)
    if (error || !data?.length) break
    all = [...all, ...data]
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

export default function Backup() {
  const [loading,    setLoading]    = useState(false)
  const [currentTbl, setCurrentTbl] = useState('')
  const [progress,   setProgress]   = useState(0)
  const [lastBackup, setLastBackup] = useState(null)
  const [done,       setDone]       = useState(false)
  const [errorMsg,   setErrorMsg]   = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('enviro_last_backup')
    if (saved) {
      try { setLastBackup(JSON.parse(saved)) } catch {}
    }
  }, [])

  async function doBackup() {
    setLoading(true)
    setDone(false)
    setErrorMsg('')
    setProgress(0)

    const backup = {}
    const counts = {}

    try {
      for (let i = 0; i < TABLES.length; i++) {
        const { name, label } = TABLES[i]
        setCurrentTbl(label)
        setProgress(Math.round((i / TABLES.length) * 90))
        const data = await fetchAll(name)
        backup[name] = data
        counts[name] = data.length
      }

      setCurrentTbl('Finalisation...')
      setProgress(95)

      const meta = {
        date:    new Date().toISOString(),
        version: 'EnviroControl v2.0',
        tables:  counts,
        total:   Object.values(counts).reduce((a, b) => a + b, 0),
      }
      backup._meta = meta

      const jsonStr = JSON.stringify(backup, null, 2)
      const blob    = new Blob([jsonStr], { type: 'application/json' })
      const date    = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      a.href = url
      a.download = `EnviroControl_backup_${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setProgress(100)
      setDone(true)
      setCurrentTbl('')
      localStorage.setItem('enviro_last_backup', JSON.stringify(meta))
      setLastBackup(meta)

    } catch (e) {
      setErrorMsg(e.message || 'Erreur inconnue')
    }

    setLoading(false)
  }

  const lastDate  = lastBackup ? new Date(lastBackup.date) : null
  const daysSince = lastDate ? Math.floor((Date.now() - lastDate) / 86400000) : null

  const statusBorder = daysSince === null ? 'border-gray-300' :
    daysSince <= 3 ? 'border-green-400' :
    daysSince <= 7 ? 'border-amber-400' : 'border-red-400'

  const statusText = daysSince === null
    ? { label: 'Aucune sauvegarde enregistree', color: 'text-gray-400' }
    : daysSince === 0
    ? { label: "Sauvegarde effectuee aujourd'hui", color: 'text-green-600' }
    : daysSince === 1
    ? { label: 'Sauvegarde effectuee hier', color: 'text-green-600' }
    : daysSince <= 3
    ? { label: `Il y a ${daysSince} jours`, color: 'text-green-600' }
    : daysSince <= 7
    ? { label: `Il y a ${daysSince} jours - pensez a sauvegarder`, color: 'text-amber-600' }
    : { label: `Il y a ${daysSince} jours - sauvegarde urgente !`, color: 'text-red-600' }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Sauvegarde</h1>
        <p className="text-gray-500 text-sm mt-1">
          Export complet de la base de donnees - Mercredi &amp; Vendredi 16h45
        </p>
      </div>

      {/* Statut */}
      <div className={`card p-5 border-l-4 ${statusBorder}`}>
        <div className="flex items-center gap-3 mb-3">
          <Database size={20} className="text-brand" />
          <span className="font-bold text-gray-800 dark:text-white">Derniere sauvegarde</span>
        </div>
        {lastBackup ? (
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {new Date(lastBackup.date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: '2-digit', month: 'long',
                year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
            <div className={`text-sm font-semibold ${statusText.color}`}>
              {statusText.label}
            </div>
            <div className="text-xs text-gray-400">
              {(lastBackup.total || 0).toLocaleString()} enregistrements
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(lastBackup.counts || {}).map(([t, n]) => (
                <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded font-mono">
                  {t}: {n}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">
            Aucune sauvegarde sur ce navigateur.
          </div>
        )}
      </div>

      {/* Bouton */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Download size={18} className="text-brand" />
          <span className="font-bold text-gray-800 dark:text-white">Sauvegarder maintenant</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Telecharge toutes les donnees en fichier JSON sur votre PC.
          Copiez ensuite ce fichier vers le dossier reseau partage.
        </p>

        {loading && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="animate-pulse">{currentTbl}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div
                className="bg-brand h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {done && !loading && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-4 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg border border-green-200">
            <CheckCircle size={16} />
            Sauvegarde telechargee avec succes !
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-4 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
            <AlertTriangle size={16} />
            {errorMsg}
          </div>
        )}

        <button
          onClick={doBackup}
          disabled={loading}
          className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Sauvegarde en cours...
            </>
          ) : (
            <>
              <Download size={16} />
              Telecharger la sauvegarde JSON
            </>
          )}
        </button>
      </div>

      {/* Planning */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-brand" />
          <span className="font-bold text-gray-800 dark:text-white">Planning recommande</span>
        </div>
        <div className="space-y-3">
          {[
            { jour: 'Mercredi', heure: '16h45', desc: 'Milieu de semaine' },
            { jour: 'Vendredi', heure: '16h45', desc: 'Avant le week-end' },
          ].map(({ jour, heure, desc }) => (
            <div key={jour} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-lg">
                📅
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-white text-sm">
                  {jour} a {heure}
                </div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Une notification orange apparait automatiquement les mercredis et vendredis apres 16h45.
        </p>
      </div>

      {/* Contenu */}
      <div className="card p-5">
        <div className="font-bold text-gray-800 dark:text-white mb-3">Contenu de la sauvegarde</div>
        <div className="space-y-2">
          {TABLES.map(({ name, label }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand inline-block" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <span className="text-xs font-mono text-gray-400">{name}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Format JSON - reimportable dans Supabase en cas de besoin.
        </p>
      </div>
    </div>
  )
}
