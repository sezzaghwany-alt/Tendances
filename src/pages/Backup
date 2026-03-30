import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Download, Database, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

const TABLES = [
  { name: 'controles',           label: 'Contrôles environnement' },
  { name: 'controles_personnel', label: 'Contrôles personnel' },
  { name: 'zones',               label: 'Zones' },
  { name: 'salles',              label: 'Salles' },
  { name: 'normes',              label: 'Normes' },
  { name: 'points_controle',     label: 'Points de contrôle' },
  { name: 'profiles',            label: 'Utilisateurs' },
  { name: 'audit_trail',         label: 'Audit trail' },
]

async function fetchTable(table) {
  let all = [], offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table).select('*').range(offset, offset + 999)
    if (error || !data?.length) break
    all = [...all, ...data]
    if (data.length < 1000) break
    offset += 1000
  }
  return all
}

export default function Backup() {
  const [loading,    setLoading]    = useState(false)
  const [currentTbl, setCurrentTbl] = useState('')
  const [progress,   setProgress]   = useState(0)
  const [lastBackup, setLastBackup] = useState(null)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('enviro_last_backup')
    if (saved) { try { setLastBackup(JSON.parse(saved)) } catch {} }

    // Charger JSZip
    if (!window.JSZip) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      document.head.appendChild(s)
    }
  }, [])

  async function doBackup() {
    setLoading(true); setDone(false); setError(''); setProgress(0)
    const backup = {}
    const counts = {}

    try {
      for (let i = 0; i < TABLES.length; i++) {
        const { name, label } = TABLES[i]
        setCurrentTbl(label)
        setProgress(Math.round((i / TABLES.length) * 80))
        const data = await fetchTable(name)
        backup[name] = data
        counts[name] = data.length
      }

      setCurrentTbl('Génération du ZIP...')
      setProgress(85)

      // Attendre JSZip si pas encore chargé
      let attempts = 0
      while (!window.JSZip && attempts < 20) {
        await new Promise(r => setTimeout(r, 200))
        attempts++
      }
      if (!window.JSZip) throw new Error('JSZip non disponible — vérifiez votre connexion')

      const zip = new window.JSZip()
      for (const { name } of TABLES) {
        zip.file(`${name}.json`, JSON.stringify(backup[name], null, 2))
      }

      const meta = {
        date:    new Date().toISOString(),
        version: 'EnviroControl v2.0',
        tables:  counts,
        total:   Object.values(counts).reduce((a, b) => a + b, 0),
      }
      zip.file('RECAP.json', JSON.stringify(meta, null, 2))

      setProgress(95)
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

      // Télécharger
      const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `EnviroControl_backup_${date}.zip`
      a.click(); URL.revokeObjectURL(url)

      setProgress(100)
      setDone(true)
      setCurrentTbl('')

      // Mémoriser
      localStorage.setItem('enviro_last_backup', JSON.stringify(meta))
      setLastBackup(meta)

    } catch (e) {
      setError(e.message || 'Erreur inconnue')
    }

    setLoading(false)
  }

  // Infos dernière sauvegarde
  const lastDate   = lastBackup ? new Date(lastBackup.date) : null
  const daysSince  = lastDate ? Math.floor((Date.now() - lastDate) / 86400000) : null
  const totalLignes = lastBackup?.total || 0

  const statusColor = daysSince === null ? 'border-gray-300' :
    daysSince === 0 ? 'border-green-400' :
    daysSince <= 3  ? 'border-green-400' :
    daysSince <= 7  ? 'border-amber-400' : 'border-red-400'

  const statusText = daysSince === null ? { text: 'Aucune sauvegarde enregistrée', color: 'text-gray-400', icon: '—' } :
    daysSince === 0 ? { text: 'Sauvegardé aujourd\'hui ✅', color: 'text-green-600', icon: '✅' } :
    daysSince === 1 ? { text: 'Sauvegardé hier ✅', color: 'text-green-600', icon: '✅' } :
    daysSince <= 3  ? { text: `Il y a ${daysSince} jours ✅`, color: 'text-green-600', icon: '✅' } :
    daysSince <= 7  ? { text: `Il y a ${daysSince} jours — pensez à sauvegarder`, color: 'text-amber-600', icon: '⚠️' } :
                      { text: `Il y a ${daysSince} jours — sauvegarde urgente !`, color: 'text-red-600', icon: '⛔' }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Sauvegarde</h1>
        <p className="text-gray-500 text-sm mt-1">Export complet de la base de données · Mercredi &amp; Vendredi 16h45</p>
      </div>

      {/* ── Statut dernière sauvegarde ── */}
      <div className={`card p-5 border-l-4 ${statusColor}`}>
        <div className="flex items-center gap-3 mb-3">
          <Database size={20} className="text-brand"/>
          <span className="font-bold text-gray-800 dark:text-white">Dernière sauvegarde</span>
        </div>

        {lastBackup ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              📅 {new Date(lastBackup.date).toLocaleDateString('fr-FR', {
                weekday:'long', day:'2-digit', month:'long', year:'numeric',
                hour:'2-digit', minute:'2-digit'
              })}
            </div>
            <div className={`text-sm font-semibold ${statusText.color}`}>
              {statusText.text}
            </div>
            <div className="text-xs text-gray-400">{totalLignes.toLocaleString()} enregistrements sauvegardés</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(lastBackup.counts||{}).map(([t, n]) => (
                <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded font-mono">
                  {t}: {n}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">
            Aucune sauvegarde enregistrée sur ce navigateur.
          </div>
        )}
      </div>

      {/* ── Bouton sauvegarde ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Download size={18} className="text-brand"/>
          <span className="font-bold text-gray-800 dark:text-white">Sauvegarder maintenant</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Télécharge toutes les données dans un fichier ZIP sur votre PC.
          Copiez ensuite ce fichier vers le dossier réseau partagé.
        </p>

        {/* Barre de progression */}
        {loading && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="animate-pulse">{currentTbl}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}/>
            </div>
            <div className="flex flex-wrap gap-2">
              {TABLES.map(({ name, label }) => (
                <span key={name} className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                  currentTbl === label
                    ? 'bg-brand text-white'
                    : progress >= Math.round((TABLES.indexOf(TABLES.find(t=>t.label===currentTbl)||TABLES[0]) / TABLES.length) * 80) && TABLES.findIndex(t=>t.name===name) < TABLES.findIndex(t=>t.label===currentTbl)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Message succès */}
        {done && !loading && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-4 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg border border-green-200">
            <CheckCircle size={16}/>
            Sauvegarde téléchargée avec succès ! Copiez le fichier ZIP vers le dossier réseau.
          </div>
        )}

        {/* Message erreur */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-4 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg border border-red-200">
            <AlertTriangle size={16}/>
            {error}
          </div>
        )}

        <button onClick={doBackup} disabled={loading}
          className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50">
          {loading
            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Sauvegarde en cours...</>
            : <><Download size={16}/> Télécharger la sauvegarde ZIP</>
          }
        </button>
      </div>

      {/* ── Planning ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-brand"/>
          <span className="font-bold text-gray-800 dark:text-white">Planning de sauvegarde</span>
        </div>
        <div className="space-y-3">
          {[
            { jour: 'Mercredi', heure: '16h45', desc: 'Fin de journée milieu de semaine' },
            { jour: 'Vendredi', heure: '16h45', desc: 'Avant le week-end' },
          ].map(({ jour, heure, desc }) => (
            <div key={jour} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-lg">📅</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-white text-sm">{jour} à {heure}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              <div className="text-xs text-gray-400 font-mono">hebdomadaire</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 Une notification orange apparaît automatiquement en haut de l'écran les mercredis et vendredis à partir de 16h45 pour vous rappeler de sauvegarder.
          </p>
        </div>
      </div>

      {/* ── Contenu du backup ── */}
      <div className="card p-5">
        <div className="font-bold text-gray-800 dark:text-white mb-3">📦 Contenu de la sauvegarde</div>
        <div className="space-y-2">
          {TABLES.map(({ name, label }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand inline-block"/>
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <span className="text-xs font-mono text-gray-400">{name}.json</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>
              <span className="text-sm text-gray-700 dark:text-gray-300">Récapitulatif</span>
            </div>
            <span className="text-xs font-mono text-gray-400">RECAP.json</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Les sauvegardes sont au format JSON — elles peuvent être réimportées dans Supabase en cas de besoin.
        </p>
      </div>
    </div>
  )
}
