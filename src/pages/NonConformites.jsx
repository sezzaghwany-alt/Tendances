import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

// ── Configuration ─────────────────────────────────────────────────────────
const ZONES_POCHES = ['PREPARATION','REMPLISSAGE','PREP_REMPL']
const BUCKET = 'nc-documents'
const MAX_PDF = 10 * 1024 * 1024

const STATUTS = [
  { id:'detectee',      label:'Détectée' },
  { id:'declaree',      label:'Déclarée AQ' },
  { id:'investigation', label:'Investigation' },
  { id:'capa',          label:'CAPA' },
  { id:'a_cloturer',    label:'À clôturer' },
  { id:'cloturee',      label:'Clôturée' },
]
const STATUT_STYLE = {
  detectee:      { bg:'#FCEBEB', txt:'#A32D2D', label:'Détectée' },
  declaree:      { bg:'#FAEEDA', txt:'#854F0B', label:'Déclarée AQ' },
  investigation: { bg:'#EEEDFE', txt:'#534AB7', label:'Investigation' },
  capa:          { bg:'#E6F1FB', txt:'#185FA5', label:'CAPA en cours' },
  a_cloturer:    { bg:'#FAEEDA', txt:'#854F0B', label:'À clôturer' },
  cloturee:      { bg:'#EAF3DE', txt:'#3B6D11', label:'Clôturée' },
  historique:    { bg:'#F1EFE8', txt:'#5F5E5A', label:'Clôturée · historique' },
}
const MESURE_STYLE = {
  ok:     { txt:'#166534', label:'Conforme' },
  alerte: { txt:'#92400e', label:'Alerte' },
  action: { txt:'#9a3412', label:'Action' },
  nc:     { txt:'#991b1b', label:'NC' },
}
const OUVERTS = ['detectee','declaree','investigation','capa','a_cloturer']

// ── Utilitaires ───────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0,10)
function fmtDate(iso) {
  if (!iso) return '—'
  const [y,m,d] = String(iso).slice(0,10).split('-'); return `${d}/${m}/${y}`
}
function jours(a, b) {
  if (!a || !b) return null
  return Math.round((Date.parse(String(b).slice(0,10)) - Date.parse(String(a).slice(0,10))) / 86400000)
}
function groupCode(code) { return ZONES_POCHES.includes(code) ? 'PREPARATION' : code }

function Pill({ statut }) {
  const s = STATUT_STYLE[statut] || STATUT_STYLE.detectee
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background:s.bg, color:s.txt }}>{s.label}</span>
  )
}

function Champ({ label, children, hint }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

async function fetchAll(buildQuery) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + 999)
    if (error || !data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

// ══════════════════════════════════════════════════════════════════════════
// Fiche NC
// ══════════════════════════════════════════════════════════════════════════
function FicheNC({ nc, mode, preselection, zonesGroupes, zones, linkedIds, role, onClose, onSaved }) {
  const isAdmin   = role === 'admin'
  const canWrite  = ['admin','cq'].includes(role)
  const isNew     = !nc
  const ferme     = nc && ['cloturee','historique'].includes(nc.statut)
  const editable  = canWrite && (!ferme || isAdmin)
  // Mesures et PDF : le CQ peut compléter une ancienne NC, pas une NC clôturée par l'AQ
  const liensEditable = canWrite && (nc?.statut !== 'cloturee' || isAdmin)
  const historique = (nc?.statut === 'historique') || mode === 'historique'

  const [form, setForm] = useState(() => nc ? {
    numero: nc.numero, zone_code: nc.zone_code || '', statut: nc.statut,
    date_prelevement: nc.date_prelevement || '', date_lecture: nc.date_lecture || '',
    date_declaration_aq: nc.date_declaration_aq || '', date_cloture: nc.date_cloture || '',
    description: nc.description || '', germe_identifie: nc.germe_identifie || '',
    cause: nc.cause || '', actions_correctives: nc.actions_correctives || '',
    impact_lots: nc.impact_lots || '', saisie_differee: !!nc.saisie_differee,
    motif_saisie_differee: nc.motif_saisie_differee || '',
  } : {
    numero: '', statut: historique ? 'historique' : 'detectee',
    zone_code: preselection?.[0] ? groupCode(preselection[0].zones?.code) : '',
    date_prelevement: preselection?.length ? preselection.map(m => m.date_controle).sort()[0] : '',
    date_lecture: '', date_declaration_aq: '', date_cloture: '',
    description: '', germe_identifie: '', cause: '', actions_correctives: '', impact_lots: '',
    saisie_differee: historique, motif_saisie_differee: historique ? 'Rattrapage des NC antérieures' : '',
  })
  const [mesures,  setMesures]  = useState(() => nc?.nc_mesures || [])
  const [pending,  setPending]  = useState(() => (preselection || []).map(c => ({ controle: c, role:'initiale' })))
  const [docs,     setDocs]     = useState(() => nc?.nc_documents || [])
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState({ text:'', type:'' })
  const [errors,   setErrors]   = useState({})
  const [uploading,setUploading]= useState(false)

  // Recherche de mesures à rattacher
  const [chDate,   setChDate]   = useState('')
  const [chRes,    setChRes]    = useState([])
  const [chSel,    setChSel]    = useState({})
  const [chLoad,   setChLoad]   = useState(false)

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }
  function show(text, type='ok') { setMsg({ text, type }); setTimeout(() => setMsg({ text:'', type:'' }), 6000) }

  // Saisie différée proposée automatiquement si la lecture date de plus de 30 jours
  useEffect(() => {
    if (!isNew || historique || !form.date_lecture) return
    const d = jours(form.date_lecture, today())
    if (d !== null && d > 30 && !form.saisie_differee) set('saisie_differee', true)
  }, [form.date_lecture])

  function valider() {
    const e = {}
    if (historique && !/^NC-\d{3}\/\d{2}$/.test(form.numero.trim().toUpperCase())) e.numero = 'Format attendu : NC-001/26'
    if (!form.zone_code)        e.zone_code = 'Zone obligatoire'
    if (!form.date_prelevement) e.date_prelevement = 'Date obligatoire'
    if (!form.date_lecture)     e.date_lecture = 'Date obligatoire'
    if (form.date_prelevement && form.date_lecture && form.date_lecture < form.date_prelevement)
      e.date_lecture = 'La lecture ne peut pas précéder le prélèvement'
    if (form.date_declaration_aq && form.date_lecture && form.date_declaration_aq < form.date_lecture)
      e.date_declaration_aq = 'La déclaration ne peut pas précéder la lecture'
    if (historique && !form.date_cloture) e.date_cloture = 'Date de clôture obligatoire'
    if (form.date_cloture && form.date_lecture && form.date_cloture < form.date_lecture)
      e.date_cloture = 'La clôture ne peut pas précéder la lecture'
    if (form.saisie_differee && !form.motif_saisie_differee.trim()) e.motif_saisie_differee = 'Motif obligatoire'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function payload(statut) {
    return {
      zone_code: form.zone_code,
      statut: statut || form.statut,
      date_prelevement: form.date_prelevement,
      date_lecture: form.date_lecture,
      date_declaration_aq: form.date_declaration_aq || null,
      date_cloture: form.date_cloture || null,
      description: form.description || null,
      germe_identifie: form.germe_identifie || null,
      cause: form.cause || null,
      actions_correctives: form.actions_correctives || null,
      impact_lots: form.impact_lots || null,
      saisie_differee: form.saisie_differee,
      motif_saisie_differee: form.saisie_differee ? form.motif_saisie_differee.trim() : null,
    }
  }

  async function enregistrer(nouveauStatut) {
    if (!valider()) return show('Corrige les champs signalés', 'error')
    setSaving(true)
    let id = nc?.id
    if (isNew) {
      const p = payload()
      if (historique) p.numero = form.numero.trim().toUpperCase()
      const { data, error } = await supabase.from('non_conformites').insert(p).select('id, numero').single()
      if (error) { setSaving(false); return show('Erreur : ' + error.message, 'error') }
      id = data.id
      if (pending.length) {
        const rows = pending.map(p => ({ nc_id: id, controle_id: p.controle.id, role: p.role }))
        const { error: e2 } = await supabase.from('nc_mesures').insert(rows)
        if (e2) show('Fiche créée, mais rattachement des mesures impossible : ' + e2.message, 'error')
      }
      setSaving(false)
      onSaved(id, `Fiche ${data.numero} créée`)
      return
    }
    const { error } = await supabase.from('non_conformites').update(payload(nouveauStatut)).eq('id', id)
    setSaving(false)
    if (error) return show('Erreur : ' + error.message, 'error')
    onSaved(id, nouveauStatut ? `Statut : ${STATUT_STYLE[nouveauStatut].label}` : 'Fiche enregistrée')
  }

  // Passage à l'étape suivante (CQ ou AQ)
  async function etapeSuivante() {
    const idx = STATUTS.findIndex(s => s.id === form.statut)
    const next = STATUTS[idx + 1]?.id
    if (!next || next === 'cloturee') return
    if (next === 'declaree' && !form.date_declaration_aq) {
      setErrors(e => ({ ...e, date_declaration_aq: 'Renseigne la date de déclaration à l\'AQ' }))
      return show('Date de déclaration à l\'AQ obligatoire', 'error')
    }
    set('statut', next)
    await enregistrer(next)
  }

  async function cloturer() {
    if (!form.date_cloture) set('date_cloture', today())
    const d = form.date_cloture || today()
    if (!window.confirm(`Clôturer la NC ${nc.numero} à la date du ${fmtDate(d)} ?`)) return
    setForm(f => ({ ...f, date_cloture: d }))
    setSaving(true)
    const { error } = await supabase.from('non_conformites')
      .update({ ...payload('cloturee'), date_cloture: d }).eq('id', nc.id)
    setSaving(false)
    if (error) return show('Erreur : ' + error.message, 'error')
    onSaved(nc.id, `NC ${nc.numero} clôturée`)
  }

  async function rouvrir() {
    if (!window.confirm(`Rouvrir la NC ${nc.numero} ?`)) return
    const { error } = await supabase.from('non_conformites')
      .update({ statut:'investigation', date_cloture:null }).eq('id', nc.id)
    if (error) return show('Erreur : ' + error.message, 'error')
    onSaved(nc.id, `NC ${nc.numero} rouverte`)
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement la NC ${nc.numero} et ses pièces jointes ?`)) return
    if (docs.length) await supabase.storage.from(BUCKET).remove(docs.map(d => d.file_path))
    const { error } = await supabase.from('non_conformites').delete().eq('id', nc.id)
    if (error) return show('Erreur : ' + error.message, 'error')
    onClose(`NC ${nc.numero} supprimée`)
  }

  // ── Mesures ─────────────────────────────────────────────────────────────
  async function chercherMesures() {
    if (!form.zone_code || !chDate) return show('Choisis la zone et la date de prélèvement', 'warn')
    setChLoad(true)
    const ids = zones.filter(z => groupCode(z.code) === form.zone_code).map(z => z.id)
    const { data } = await supabase.from('controles')
      .select('id, date_controle, point, type_controle, classe, germes, statut, zones(code,label), salles(label)')
      .in('zone_id', ids).eq('date_controle', chDate).order('type_controle').order('point')
    const dejaIci = new Set([...mesures.map(m => m.controle_id), ...pending.map(p => p.controle.id)])
    setChRes((data || []).filter(c => !dejaIci.has(c.id)))
    setChSel({})
    setChLoad(false)
  }

  async function rattacher() {
    const choix = chRes.filter(c => chSel[c.id]).map(c => ({
      controle: c, role: chSel[c.id] === 'recontrole' ? 'recontrole' : 'initiale',
    }))
    if (!choix.length) return
    const occupes = choix.filter(c => linkedIds.has(c.controle.id))
    if (occupes.length) return show(`${occupes.length} mesure(s) déjà rattachée(s) à une autre NC`, 'error')
    if (isNew) {
      setPending(p => [...p, ...choix])
    } else {
      const { data, error } = await supabase.from('nc_mesures')
        .insert(choix.map(c => ({ nc_id: nc.id, controle_id: c.controle.id, role: c.role })))
        .select('id, role, controle_id, controles(date_controle, point, type_controle, classe, germes, statut, salles(label))')
      if (error) return show('Erreur : ' + error.message, 'error')
      setMesures(m => [...m, ...(data || [])])
    }
    setChRes(r => r.filter(c => !chSel[c.id]))
    setChSel({})
  }

  async function detacher(m) {
    if (!window.confirm(`Détacher le point ${m.controles?.point} de la fiche ?`)) return
    const { error } = await supabase.from('nc_mesures').delete().eq('id', m.id)
    if (error) return show('Erreur : ' + error.message, 'error')
    setMesures(list => list.filter(x => x.id !== m.id))
  }

  // ── Documents ───────────────────────────────────────────────────────────
  async function uploader(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') return show('Seuls les fichiers PDF sont acceptés', 'error')
    if (file.size > MAX_PDF) return show('Le fichier dépasse 10 Mo', 'error')
    setUploading(true)
    const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_')
    const path = `${nc.id}/${Date.now()}_${safe}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType:'application/pdf', upsert:false })
    if (up.error) { setUploading(false); return show('Erreur envoi : ' + up.error.message, 'error') }
    const { data, error } = await supabase.from('nc_documents')
      .insert({ nc_id: nc.id, file_path: path, file_name: file.name, size_bytes: file.size })
      .select('id, file_name, file_path, size_bytes, created_at').single()
    setUploading(false)
    if (error) {
      await supabase.storage.from(BUCKET).remove([path])
      return show('Erreur : ' + error.message, 'error')
    }
    setDocs(d => [...d, data])
    show(`${file.name} ajouté`)
  }

  async function ouvrir(doc) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 120)
    if (error) return show('Erreur : ' + error.message, 'error')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function supprimerDoc(doc) {
    if (!window.confirm(`Supprimer ${doc.file_name} ?`)) return
    const { error } = await supabase.from('nc_documents').delete().eq('id', doc.id)
    if (error) return show('Erreur : ' + error.message, 'error')
    await supabase.storage.from(BUCKET).remove([doc.file_path])
    setDocs(d => d.filter(x => x.id !== doc.id))
  }

  // ── Délais ──────────────────────────────────────────────────────────────
  const delais = [
    { l:'Incubation (prélèvement → lecture)', v: jours(form.date_prelevement, form.date_lecture) },
    { l:'Lecture → déclaration AQ',           v: jours(form.date_lecture, form.date_declaration_aq) },
    { l:'Lecture → clôture',                  v: jours(form.date_lecture, form.date_cloture) },
    { l:'Lecture → saisie',                   v: jours(form.date_lecture, nc?.created_at || today()) },
  ]
  const idxStatut = STATUTS.findIndex(s => s.id === form.statut)
  const fenetre = form.date_prelevement && form.date_lecture
    ? `Lots fabriqués ou opérations réalisées dans la zone du ${fmtDate(form.date_prelevement)} au ${fmtDate(form.date_lecture)}`
    : null

  const inputCls = (k) => `input text-sm py-1.5 ${errors[k] ? 'border-red-400' : ''}`
  const Err = ({ k }) => errors[k] ? <div className="text-[11px] text-red-600 mt-1">{errors[k]}</div> : null
  const lignesMesures = isNew
    ? pending.map((p, i) => ({ key:'p'+i, role:p.role, c:p.controle, pendingIdx:i }))
    : mesures.map(m => ({ key:m.id, role:m.role, c:m.controles, m }))

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => onClose()} className="text-xs text-brand hover:underline mb-1">← Registre</button>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="font-mono">{isNew ? (historique ? 'Ancienne NC' : 'Nouvelle NC') : nc.numero}</span>
            {!isNew && <Pill statut={nc.statut}/>}
          </h1>
          {isNew && !historique && <p className="text-gray-500 text-sm mt-1">Le numéro NC-###/AA sera attribué automatiquement selon l'année de lecture.</p>}
          {!editable && !isNew && <p className="text-gray-500 text-sm mt-1">Consultation seule.</p>}
        </div>
        {form.saisie_differee && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">Saisie différée</span>
        )}
      </div>

      {msg.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.type==='error' ? 'bg-red-50 border border-red-200 text-red-700' :
          msg.type==='warn'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                               'bg-green-50 border border-green-200 text-green-700'}`}>{msg.text}</div>
      )}

      {/* Statut */}
      {!historique && (
        <div className="card p-4">
          <div className="flex gap-1">
            {STATUTS.map((s, i) => (
              <div key={s.id} className="flex-1 text-center text-[11px] py-1.5 rounded-lg font-semibold"
                style={{
                  background: i < idxStatut ? '#EAF3DE' : i === idxStatut ? '#E6F1FB' : 'var(--color-background-secondary, #f1f5f9)',
                  color:      i < idxStatut ? '#3B6D11' : i === idxStatut ? '#185FA5' : '#94a3b8',
                }}>{s.label}</div>
            ))}
          </div>
        </div>
      )}

      {/* Identification */}
      <div className="card p-4 space-y-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Identification</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {historique && isNew && (
            <Champ label="N° de la NC *">
              <input className={inputCls('numero') + ' font-mono'} value={form.numero} placeholder="NC-012/25"
                onChange={e => set('numero', e.target.value.toUpperCase())}/>
              <Err k="numero"/>
            </Champ>
          )}
          <Champ label="Zone *">
            <select className={inputCls('zone_code')} value={form.zone_code} disabled={!editable || !!lignesMesures.length}
              onChange={e => set('zone_code', e.target.value)}>
              <option value="">— Zone —</option>
              {zonesGroupes.map(z => <option key={z.code} value={z.code}>{z.label}</option>)}
            </select>
            <Err k="zone_code"/>
          </Champ>
          <Champ label="Date de prélèvement *">
            <input type="date" className={inputCls('date_prelevement')} value={form.date_prelevement} disabled={!editable}
              onChange={e => set('date_prelevement', e.target.value)}/>
            <Err k="date_prelevement"/>
          </Champ>
          <Champ label="Date de lecture *" hint="Départ des délais de traitement">
            <input type="date" className={inputCls('date_lecture')} value={form.date_lecture} disabled={!editable}
              onChange={e => set('date_lecture', e.target.value)}/>
            <Err k="date_lecture"/>
          </Champ>
          <Champ label="Déclarée à l'AQ le">
            <input type="date" className={inputCls('date_declaration_aq')} value={form.date_declaration_aq} disabled={!editable}
              onChange={e => set('date_declaration_aq', e.target.value)}/>
            <Err k="date_declaration_aq"/>
          </Champ>
          {(historique || ['a_cloturer','cloturee'].includes(form.statut)) && (
            <Champ label={historique ? 'Date de clôture *' : 'Date de clôture'}>
              <input type="date" className={inputCls('date_cloture')} value={form.date_cloture}
                disabled={!(historique ? editable : isAdmin)}
                onChange={e => set('date_cloture', e.target.value)}/>
              <Err k="date_cloture"/>
            </Champ>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {delais.map(d => (
            <div key={d.l} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
              <div className="text-[10px] text-gray-400">{d.l}</div>
              <div className="font-bold font-mono text-lg text-gray-800 dark:text-white">{d.v === null ? '—' : `${d.v} j`}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-1.5">
            <input type="checkbox" checked={form.saisie_differee} disabled={!editable}
              onChange={e => set('saisie_differee', e.target.checked)}/>
            Saisie différée
          </label>
          {form.saisie_differee && (
            <div className="flex-1 min-w-[260px]">
              <input className={inputCls('motif_saisie_differee')} value={form.motif_saisie_differee} disabled={!editable}
                placeholder="Motif de la saisie différée" onChange={e => set('motif_saisie_differee', e.target.value)}/>
              <Err k="motif_saisie_differee"/>
            </div>
          )}
        </div>
      </div>

      {/* Mesures */}
      <div className="card p-4 space-y-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Mesures rattachées ({lignesMesures.length})</div>
        {lignesMesures.length === 0 ? (
          <div className="text-sm text-gray-400 italic">Aucune mesure rattachée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Date','Salle','Point','Type','Cl.','Germes','Statut','Rôle',''].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase pb-2 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesMesures.map(l => {
                const ms = MESURE_STYLE[l.c?.statut] || MESURE_STYLE.ok
                return (
                  <tr key={l.key} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2 pr-3 font-mono text-xs">{fmtDate(l.c?.date_controle)}</td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{l.c?.salles?.label || '—'}</td>
                    <td className="py-2 pr-3 font-mono font-bold text-brand">{l.c?.point}</td>
                    <td className="py-2 pr-3 text-xs">{l.c?.type_controle}</td>
                    <td className="py-2 pr-3 text-xs font-bold">{l.c?.classe}</td>
                    <td className="py-2 pr-3 font-mono font-bold" style={{ color: ms.txt }}>{l.c?.germes}</td>
                    <td className="py-2 pr-3 text-xs font-semibold" style={{ color: ms.txt }}>{ms.label}</td>
                    <td className="py-2 pr-3 text-xs">{l.role === 'recontrole' ? 'Recontrôle' : 'Mesure initiale'}</td>
                    <td className="py-2 text-right">
                      {liensEditable && (
                        <button className="text-xs text-red-500 hover:underline"
                          onClick={() => l.m ? detacher(l.m) : setPending(p => p.filter((_, i) => i !== l.pendingIdx))}>
                          Détacher
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {liensEditable && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Champ label="Ajouter des mesures du">
                <input type="date" className="input text-sm py-1.5" value={chDate} onChange={e => setChDate(e.target.value)}/>
              </Champ>
              <button className="btn-outline text-sm" onClick={chercherMesures} disabled={chLoad}>
                {chLoad ? 'Recherche…' : 'Afficher les mesures'}
              </button>
              <span className="text-xs text-gray-400 pb-2">Inclut les recontrôles conformes de la même zone.</span>
            </div>
            {chRes.length > 0 && (
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 max-h-72 overflow-y-auto">
                {chRes.map(c => {
                  const ms = MESURE_STYLE[c.statut] || MESURE_STYLE.ok
                  const pris = linkedIds.has(c.id)
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-50 dark:border-gray-800 text-sm">
                      <input type="checkbox" disabled={pris} checked={!!chSel[c.id]}
                        onChange={e => setChSel(s => ({ ...s, [c.id]: e.target.checked
                          ? (['action','nc','alerte'].includes(c.statut) ? 'initiale' : 'recontrole') : undefined }))}/>
                      <span className="font-mono font-bold text-brand w-12">{c.point}</span>
                      <span className="text-xs w-16">{c.type_controle}</span>
                      <span className="text-xs w-10">Cl.{c.classe}</span>
                      <span className="font-mono font-bold w-14" style={{ color: ms.txt }}>{c.germes}</span>
                      <span className="text-xs text-gray-400 flex-1 truncate">{c.salles?.label}</span>
                      {pris
                        ? <span className="text-[11px] text-gray-400">Déjà dans une NC</span>
                        : chSel[c.id] && (
                          <select className="input text-xs py-1 w-36" value={chSel[c.id]}
                            onChange={e => setChSel(s => ({ ...s, [c.id]: e.target.value }))}>
                            <option value="initiale">Mesure initiale</option>
                            <option value="recontrole">Recontrôle</option>
                          </select>
                        )}
                    </div>
                  )
                })}
              </div>
            )}
            {chRes.length > 0 && (
              <button className="btn-primary text-sm" onClick={rattacher}
                disabled={!Object.values(chSel).some(Boolean)}>Rattacher la sélection</button>
            )}
          </div>
        )}
      </div>

      {/* Investigation */}
      <div className="card p-4 space-y-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Investigation et traitement</div>
        {fenetre && (
          <div className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-100">
            Fenêtre d'impact : {fenetre}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['description','Description de l\'écart'],
            ['germe_identifie','Germe identifié'],
            ['impact_lots','Évaluation d\'impact · lots concernés'],
            ['cause','Cause identifiée'],
            ['actions_correctives','Actions correctives et préventives (CAPA)'],
          ].map(([k, l]) => (
            <Champ key={k} label={l}>
              <textarea rows={3} className="input text-sm w-full" value={form[k]} disabled={!editable}
                onChange={e => set(k, e.target.value)}/>
            </Champ>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Documents LCQ ({docs.length})</div>
          {!isNew && liensEditable && (
            <label className={`btn-outline text-sm cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? 'Envoi…' : '+ Ajouter un PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={uploader}/>
            </label>
          )}
        </div>
        {isNew && <div className="text-sm text-gray-400 italic">Enregistre la fiche pour pouvoir joindre les PDF (10 Mo max chacun).</div>}
        {!isNew && docs.length === 0 && <div className="text-sm text-gray-400 italic">Aucun document joint.</div>}
        {docs.map(d => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span className="flex-1 truncate">📄 {d.file_name}</span>
            <span className="text-xs text-gray-400">{(d.size_bytes / 1024 / 1024).toFixed(1)} Mo · {fmtDate(d.created_at)}</span>
            <button className="text-xs text-brand hover:underline" onClick={() => ouvrir(d)}>Ouvrir</button>
            {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => supprimerDoc(d)}>Supprimer</button>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <button className="btn-primary text-sm px-6" disabled={saving} onClick={() => enregistrer()}>
            {saving ? 'Enregistrement…' : isNew ? 'Créer la fiche' : 'Enregistrer'}
          </button>
        )}
        {!isNew && editable && OUVERTS.includes(nc.statut) && nc.statut !== 'a_cloturer' && (
          <button className="btn-outline text-sm" disabled={saving} onClick={etapeSuivante}>
            Passer à : {STATUTS[idxStatut + 1]?.label}
          </button>
        )}
        {!isNew && isAdmin && OUVERTS.includes(nc.statut) && (
          <button className="btn-outline text-sm" style={{ borderColor:'#3B6D11', color:'#3B6D11' }}
            disabled={saving} onClick={cloturer}>Clôturer (AQ)</button>
        )}
        {!isNew && canWrite && !isAdmin && nc.statut === 'a_cloturer' && (
          <span className="text-xs text-gray-500">En attente de validation de clôture par l'AQ.</span>
        )}
        {!isNew && isAdmin && nc.statut === 'cloturee' && (
          <button className="btn-outline text-sm" onClick={rouvrir}>Rouvrir</button>
        )}
        {!isNew && isAdmin && (
          <button className="text-sm text-red-500 hover:underline ml-auto" onClick={supprimer}>Supprimer la fiche</button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Registre
// ══════════════════════════════════════════════════════════════════════════
export default function NonConformites() {
  const { profile } = useAuth()
  const role = profile?.role
  const canWrite = ['admin','cq'].includes(role)
  const [params, setParams] = useSearchParams()

  const [zones,    setZones]    = useState([])
  const [ncs,      setNcs]      = useState([])
  const [orphans,  setOrphans]  = useState([])
  const [linked,   setLinked]   = useState(new Set())
  const [loading,  setLoading]  = useState(true)
  const [msg,      setMsg]      = useState('')

  const [annee,        setAnnee]        = useState(new Date().getFullYear())
  const [filtreStatut, setFiltreStatut] = useState('ALL')
  const [filtreZone,   setFiltreZone]   = useState('ALL')
  const [selOrph,      setSelOrph]      = useState({})

  const [vue, setVue] = useState({ type:'list' })   // list | fiche
  const ANNEES = (() => { const y = new Date().getFullYear(); return [y-2, y-1, y] })()

  const zonesGroupes = useMemo(() => {
    const seen = new Set(), out = []
    zones.forEach(z => {
      const g = groupCode(z.code)
      if (seen.has(g)) return
      seen.add(g)
      out.push({ code: g, label: g === 'PREPARATION' ? 'Préparation Poches Stériles' : z.label })
    })
    return out
  }, [zones])
  const zoneLabel = (code) => zonesGroupes.find(z => z.code === code)?.label || code || '—'

  async function charger() {
    setLoading(true)
    const [z, n, lk] = await Promise.all([
      supabase.from('zones').select('id, code, label').eq('actif', true),
      supabase.from('non_conformites')
        .select('*, nc_mesures(id, role, controle_id, controles(date_controle, point, type_controle, classe, germes, statut, salles(label))), nc_documents(id, file_name, file_path, size_bytes, created_at)')
        .order('annee', { ascending:false }).order('seq', { ascending:false }),
      fetchAll(() => supabase.from('nc_mesures').select('controle_id')),
    ])
    setZones(z.data || [])
    setNcs(n.data || [])
    const set = new Set(lk.map(r => r.controle_id))
    setLinked(set)

    const hors = await fetchAll(() => supabase.from('controles')
      .select('id, date_controle, point, type_controle, classe, germes, statut, zones(code,label), salles(label)')
      .in('statut', ['action','nc'])
      .gte('date_controle', `${annee}-01-01`).lte('date_controle', `${annee}-12-31`)
      .order('date_controle', { ascending:false }))
    setOrphans(hors.filter(c => !set.has(c.id)))
    setSelOrph({})
    setLoading(false)
  }

  useEffect(() => { charger() }, [annee])

  // Ouverture directe depuis un lien ?nc=<id>
  useEffect(() => {
    const id = params.get('nc')
    if (id && ncs.length) {
      const f = ncs.find(x => x.id === id)
      if (f) setVue({ type:'fiche', nc:f })
    }
  }, [params, ncs])

  function fermer(texte) {
    setVue({ type:'list' })
    if (params.get('nc')) setParams({})
    if (texte) { setMsg(texte); setTimeout(() => setMsg(''), 5000) }
    charger()
  }

  async function apresEnregistrement(id, texte) {
    const { data } = await supabase.from('non_conformites')
      .select('*, nc_mesures(id, role, controle_id, controles(date_controle, point, type_controle, classe, germes, statut, salles(label))), nc_documents(id, file_name, file_path, size_bytes, created_at)')
      .eq('id', id).single()
    const lk = await fetchAll(() => supabase.from('nc_mesures').select('controle_id'))
    setLinked(new Set(lk.map(r => r.controle_id)))
    setVue({ type:'fiche', nc: data, key: Date.now() })
    setMsg(texte); setTimeout(() => setMsg(''), 5000)
  }

  const ncsAnnee = ncs.filter(n => (n.annee || +String(n.date_lecture).slice(0,4)) === annee)
  const ncsFiltrees = ncsAnnee.filter(n => {
    if (filtreZone !== 'ALL' && n.zone_code !== filtreZone) return false
    if (filtreStatut === 'ouvertes' && !OUVERTS.includes(n.statut)) return false
    if (filtreStatut === 'fermees'  &&  OUVERTS.includes(n.statut)) return false
    if (!['ALL','ouvertes','fermees'].includes(filtreStatut) && n.statut !== filtreStatut) return false
    return true
  })
  const kpi = {
    ouvertes:   ncs.filter(n => OUVERTS.includes(n.statut)).length,
    aCloturer:  ncs.filter(n => n.statut === 'a_cloturer').length,
    sansFiche:  orphans.length,
    total:      ncsAnnee.length,
  }

  const orphSel = orphans.filter(c => selOrph[c.id])
  const zonesSel = [...new Set(orphSel.map(c => groupCode(c.zones?.code)))]

  if (vue.type === 'fiche') {
    return (
      <>
        {msg && <div className="rounded-xl px-4 py-3 text-sm font-medium bg-green-50 border border-green-200 text-green-700 mb-4">{msg}</div>}
        <FicheNC key={(vue.nc?.id || vue.mode || 'new') + (vue.key || '')} nc={vue.nc} mode={vue.mode} preselection={vue.preselection}
          zonesGroupes={zonesGroupes} zones={zones} linkedIds={linked} role={role}
          onClose={fermer} onSaved={apresEnregistrement}/>
      </>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Non-conformités — Environnement</h1>
          <p className="text-gray-500 text-sm mt-1">Registre des NC, rattachement des mesures et documents LCQ</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button className="btn-outline text-sm" onClick={() => setVue({ type:'fiche', mode:'historique' })}>Rattacher une ancienne NC</button>
            <button className="btn-primary text-sm" onClick={() => setVue({ type:'fiche', mode:'nouvelle' })}>+ Nouvelle NC</button>
          </div>
        )}
      </div>

      {msg && <div className="rounded-xl px-4 py-3 text-sm font-medium bg-green-50 border border-green-200 text-green-700">{msg}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l:'NC ouvertes',                v:kpi.ouvertes,  c:'#185FA5' },
          { l:'À clôturer par l\'AQ',       v:kpi.aCloturer, c:'#854F0B' },
          { l:`Hors limites sans fiche ${annee}`, v:kpi.sansFiche, c: kpi.sansFiche ? '#A32D2D' : '#3B6D11' },
          { l:`NC ${annee}`,                v:kpi.total,     c:'#374151' },
        ].map(k => (
          <div key={k.l} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{k.l}</div>
            <div className="text-2xl font-extrabold mt-1" style={{ color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {ANNEES.map(a => (
            <button key={a} onClick={() => setAnnee(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${annee===a ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>{a}</button>
          ))}
        </div>
        <select className="input py-1.5 text-xs w-44" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
          <option value="ALL">Tous statuts</option>
          <option value="ouvertes">Ouvertes</option>
          <option value="fermees">Clôturées</option>
          {Object.entries(STATUT_STYLE).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select className="input py-1.5 text-xs w-52" value={filtreZone} onChange={e => setFiltreZone(e.target.value)}>
          <option value="ALL">Toutes zones</option>
          {zonesGroupes.map(z => <option key={z.code} value={z.code}>{z.label}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{ncsFiltrees.length} fiche(s)</span>
      </div>

      {/* Registre */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"/></div>
        ) : ncsFiltrees.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">Aucune NC pour cette sélection</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['N° NC','Prélèvement','Lecture','Zone','Points','Déclarée AQ','PJ','Statut'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {ncsFiltrees.map(n => {
                const pts = [...new Set((n.nc_mesures || []).filter(m => m.role === 'initiale').map(m => m.controles?.point))].join(', ')
                return (
                  <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => setVue({ type:'fiche', nc:n })}>
                    <td className="px-4 py-2.5 font-mono font-bold">{n.numero}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtDate(n.date_prelevement)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtDate(n.date_lecture)}</td>
                    <td className="px-4 py-2.5 text-xs">{zoneLabel(n.zone_code)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-brand">{pts || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtDate(n.date_declaration_aq)}</td>
                    <td className="px-4 py-2.5 text-xs">{(n.nc_documents || []).length ? `📎 ${n.nc_documents.length}` : <span className="text-red-500">0</span>}</td>
                    <td className="px-4 py-2.5"><Pill statut={n.statut}/>{n.saisie_differee && <span className="ml-1 text-[10px] text-red-600">· différée</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mesures hors limites sans fiche */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Mesures Action / NC sans fiche — {annee}</div>
            <div className="text-xs text-gray-400 mt-0.5">Sélectionne les points d'une même zone pour créer leur fiche.</div>
          </div>
          {canWrite && orphSel.length > 0 && (
            <button className="btn-primary text-sm" disabled={zonesSel.length > 1}
              title={zonesSel.length > 1 ? 'Sélection sur plusieurs zones' : ''}
              onClick={() => setVue({ type:'fiche', mode:'nouvelle', preselection: orphSel })}>
              Créer une NC avec {orphSel.length} mesure(s)
            </button>
          )}
        </div>
        {zonesSel.length > 1 && <div className="text-xs text-red-600">Une fiche ne couvre qu'une zone : la sélection porte sur {zonesSel.length} zones.</div>}
        {orphans.length === 0 ? (
          <div className="text-sm text-green-700">Toutes les mesures Action / NC de {annee} sont rattachées à une fiche.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <tbody>
                {orphans.map(c => {
                  const ms = MESURE_STYLE[c.statut]
                  return (
                    <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="px-3 py-1.5 w-8">
                        {canWrite && <input type="checkbox" checked={!!selOrph[c.id]}
                          onChange={e => setSelOrph(s => ({ ...s, [c.id]: e.target.checked }))}/>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{fmtDate(c.date_controle)}</td>
                      <td className="px-3 py-1.5 text-xs">{zoneLabel(groupCode(c.zones?.code))}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{c.salles?.label || '—'}</td>
                      <td className="px-3 py-1.5 font-mono font-bold text-brand">{c.point}</td>
                      <td className="px-3 py-1.5 text-xs">{c.type_controle}</td>
                      <td className="px-3 py-1.5 text-xs font-bold">Cl.{c.classe}</td>
                      <td className="px-3 py-1.5 font-mono font-bold" style={{ color: ms?.txt }}>{c.germes}</td>
                      <td className="px-3 py-1.5 text-xs font-semibold" style={{ color: ms?.txt }}>{ms?.label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
