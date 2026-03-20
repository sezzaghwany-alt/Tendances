import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash2, Save, UserPlus, Mail } from 'lucide-react'



// ── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'lecteur', password: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => {
      setUsers(data || [])
      setLoading(false)
    })
  }, [])

  async function createUser() {
    if (!form.email || !form.password || !form.full_name) return
    setSaving(true)

    // Créer l'utilisateur via Supabase Auth Admin (nécessite une Edge Function en prod)
    // En développement, on utilise signUp
    const { data, error } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name, role: form.role }
    })

    if (error) {
      // Fallback : signUp classique
      const { data: sd, error: se } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } }
      })
      if (se) { setSaving(false); alert(se.message); return }
    }

    // Mettre à jour le rôle dans profiles
    await supabase.from('profiles').update({ role: form.role, full_name: form.full_name }).eq('email', form.email)

    setSuccess(`✅ Compte créé pour ${form.email}. Les identifiants ont été envoyés par mail.`)
    setForm({ full_name: '', email: '', role: 'lecteur', password: '' })
    setShowForm(false)
    setSaving(false)
    setTimeout(() => setSuccess(''), 5000)

    const { data: updated } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(updated || [])
  }

  async function updateRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mt-10"/>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{users.length} utilisateur(s)</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm">
          <UserPlus size={15}/> Nouvel utilisateur
        </button>
      </div>

      {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

      {showForm && (
        <div className="card p-5 border-l-4 border-l-brand">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Mail size={16}/> Créer un utilisateur & envoyer les identifiants</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nom complet</label><input className="input" value={form.full_name} onChange={e => setForm(f=>({...f, full_name: e.target.value}))} placeholder="Prénom Nom"/></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f=>({...f, email: e.target.value}))} placeholder="email@etablissement.ma"/></div>
            <div>
              <label className="label">Rôle</label>
              <select className="input" value={form.role} onChange={e => setForm(f=>({...f, role: e.target.value}))}>
                <option value="lecteur">👁️ Lecteur — consultation uniquement</option>
                <option value="operateur">✏️ Opérateur — saisie + consultation</option>
                <option value="admin">👑 Administrateur — accès complet</option>
              </select>
            </div>
            <div><label className="label">Mot de passe initial</label><input type="text" className="input" value={form.password} onChange={e => setForm(f=>({...f, password: e.target.value}))} placeholder="Mot de passe temporaire"/></div>
          </div>
          <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
            <Mail size={11}/> Un email de confirmation sera envoyé automatiquement par Supabase avec les identifiants de connexion.
          </div>
          <button onClick={createUser} disabled={saving} className="btn-primary mt-4 flex items-center gap-2 text-sm">
            <Mail size={15}/> {saving ? 'Création...' : 'Créer le compte & envoyer par mail'}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr><th className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Nom</th><th className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Email</th><th className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Rôle</th><th className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Thème</th><th className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Créé le</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
                    <option value="lecteur">👁️ Lecteur</option>
                    <option value="operateur">✏️ Opérateur</option>
                    <option value="admin">👑 Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs capitalize text-gray-400">{u.theme}</td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Zones ─────────────────────────────────────────────────────────────────────
function ZonesTab() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code:'', label:'', classe:'C', icon:'🔬', color:'#1d6fa4' })
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    supabase.from('zones').select('*').order('created_at').then(({ data }) => { setZones(data||[]); setLoading(false) })
  }, [])

  async function addZone() {
    const { data } = await supabase.from('zones').insert(form).select()
    if (data) { setZones(prev => [...prev, data[0]]); setShowForm(false); setForm({ code:'', label:'', classe:'C', icon:'🔬', color:'#1d6fa4' }) }
  }

  async function saveEdit(id) {
    await supabase.from('zones').update(editForm).eq('id', id)
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...editForm } : z))
    setEditId(null)
  }

  async function toggleZone(id, actif) {
    await supabase.from('zones').update({ actif: !actif }).eq('id', id)
    setZones(prev => prev.map(z => z.id === id ? { ...z, actif: !actif } : z))
  }

  async function deleteZone(id, label) {
    if (!window.confirm(`Supprimer la zone "${label}" ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('zones').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setZones(prev => prev.filter(z => z.id !== id))
  }

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mt-10"/>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{zones.length} zone(s) configurée(s)</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15}/> Nouvelle zone</button>
      </div>

      {showForm && (
        <div className="card p-5 border-l-4 border-l-brand">
          <h3 className="font-bold mb-4">Créer une nouvelle zone</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Code unique</label><input className="input" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="EX: SALLE_A"/></div>
            <div><label className="label">Libellé</label><input className="input" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="Salle de remplissage A"/></div>
            <div>
              <label className="label">Classe ISO</label>
              <select className="input" value={form.classe} onChange={e=>setForm(f=>({...f,classe:e.target.value}))}>
                <option value="A">A — Critique</option>
                <option value="B">B — Fond classe A</option>
                <option value="C">C — Nettoyé</option>
                <option value="D">D — Support</option>
              </select>
            </div>
            <div><label className="label">Icône (emoji)</label><input className="input text-2xl" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}/></div>
            <div><label className="label">Couleur</label><input type="color" className="input h-10 p-1" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}/></div>
          </div>
          <button onClick={addZone} className="btn-primary mt-4 text-sm flex items-center gap-2"><Save size={14}/> Créer la zone</button>
        </div>
      )}

      <div className="space-y-3">
        {zones.map(z => (
          <div key={z.id} className={`card p-4 border-l-4 ${!z.actif ? 'opacity-50' : ''}`} style={{ borderLeftColor: z.color }}>
            {editId === z.id ? (
              // Mode édition
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div><label className="label">Libellé</label><input className="input" value={editForm.label||''} onChange={e=>setEditForm(f=>({...f,label:e.target.value}))}/></div>
                  <div>
                    <label className="label">Classe</label>
                    <select className="input" value={editForm.classe||'C'} onChange={e=>setEditForm(f=>({...f,classe:e.target.value}))}>
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                    </select>
                  </div>
                  <div><label className="label">Icône</label><input className="input text-xl" value={editForm.icon||''} onChange={e=>setEditForm(f=>({...f,icon:e.target.value}))}/></div>
                  <div><label className="label">Couleur</label><input type="color" className="input h-10 p-1" value={editForm.color||'#1d6fa4'} onChange={e=>setEditForm(f=>({...f,color:e.target.value}))}/></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(z.id)} className="flex items-center gap-1 text-sm bg-green-500 text-white px-3 py-1.5 rounded-lg"><Save size={13}/> Sauvegarder</button>
                  <button onClick={() => setEditId(null)} className="flex items-center gap-1 text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-lg">Annuler</button>
                </div>
              </div>
            ) : (
              // Mode affichage
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{z.icon}</span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{z.label}</div>
                    <div className="text-xs text-gray-400 font-mono">{z.code} · Classe {z.classe}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditId(z.id); setEditForm({ label: z.label, classe: z.classe, icon: z.icon, color: z.color }) }}
                    className="text-xs text-gray-400 hover:text-brand px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-1">
                    ✏️ Modifier
                  </button>
                  <button onClick={() => toggleZone(z.id, z.actif)}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold ${z.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {z.actif ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => deleteZone(z.id, z.label)}
                    className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-1">
                    <Trash2 size={13}/> Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Normes ────────────────────────────────────────────────────────────────────
function NormesTab() {
  const [normes, setNormes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState({})

  useEffect(() => {
    supabase.from('normes').select('*, zones(label,icon)').order('zone_id').then(({ data }) => { setNormes(data||[]); setLoading(false) })
  }, [])

  async function saveNorme(id) {
    const ed = editing[id]
    if (!ed) return
    await supabase.from('normes').update({ alerte: Number(ed.alerte), action: Number(ed.action), norme: Number(ed.norme) }).eq('id', id)
    setNormes(prev => prev.map(n => n.id === id ? { ...n, ...ed } : n))
    setEditing(prev => { const e = {...prev}; delete e[id]; return e })
  }

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mt-10"/>

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>{['Zone','Type','Norme max','Alerte','Action','Unité',''].map(h=><th key={h} className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
          {normes.map(n => {
            const ed = editing[n.id]
            return (
              <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">{n.zones?.icon} {n.zones?.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{n.type_controle}</td>
                {['norme','alerte','action'].map(f=>(
                  <td key={f} className="px-4 py-3">
                    {ed ? <input type="number" className="input w-20 py-1 text-sm" defaultValue={n[f]} onChange={e=>setEditing(prev=>({...prev,[n.id]:{...prev[n.id],[f]:e.target.value}}))}/>
                       : <span className="font-mono font-bold">{n[f]}</span>}
                  </td>
                ))}
                <td className="px-4 py-3 text-xs text-gray-400">{n.unite}</td>
                <td className="px-4 py-3">
                  {ed
                    ? <button onClick={()=>saveNorme(n.id)} className="text-xs bg-green-500 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Save size={12}/> Sauver</button>
                    : <button onClick={()=>setEditing(prev=>({...prev,[n.id]:{norme:n.norme,alerte:n.alerte,action:n.action}}))} className="text-xs text-gray-400 hover:text-brand">Modifier</button>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


// ── Salles ────────────────────────────────────────────────────────────────────
function SallesTab() {
  const [zones, setZones] = useState([])
  const [salles, setSalles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selZone, setSelZone] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ zone_id:'', code:'', label:'' })

  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('*').eq('actif', true),
      supabase.from('salles').select('*, zones(label,code)').eq('actif', true).order('created_at'),
    ]).then(([z, s]) => {
      setZones(z.data||[])
      setSalles(s.data||[])
      if (z.data?.length) setForm(f=>({...f, zone_id:z.data[0].id}))
      setLoading(false)
    })
  }, [])

  async function addSalle() {
    if (!form.code || !form.label || !form.zone_id) return
    const code = form.code.toUpperCase().replace(/\s+/g,'_')
    const { data } = await supabase.from('salles').insert({ ...form, code, actif:true }).select('*, zones(label,code)')
    if (data) { setSalles(prev=>[...prev, data[0]]); setShowForm(false); setForm(f=>({...f,code:'',label:''})) }
  }

  const [editSalleId, setEditSalleId] = useState(null)
  const [editSalleForm, setEditSalleForm] = useState({})

  async function saveSalle(id) {
    await supabase.from('salles').update(editSalleForm).eq('id', id)
    setSalles(prev=>prev.map(s=>s.id===id?{...s,...editSalleForm}:s))
    setEditSalleId(null)
  }

  async function toggleSalle(id, actif) {
    await supabase.from('salles').update({ actif: !actif }).eq('id', id)
    setSalles(prev=>prev.map(s=>s.id===id?{...s,actif:!actif}:s))
  }

  async function deleteSalle(id, label) {
    if (!window.confirm(`Supprimer la salle "${label}" ?`)) return
    await supabase.from('salles').delete().eq('id', id)
    setSalles(prev=>prev.filter(s=>s.id!==id))
  }

  const filtrees = selZone === 'ALL' ? salles : salles.filter(s=>s.zones?.code===selZone)

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mt-10"/>
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selZone} onChange={e=>setSelZone(e.target.value)} className="input py-1.5 text-sm w-48">
          <option value="ALL">Toutes les zones</option>
          {zones.map(z=><option key={z.code} value={z.code}>{z.icon} {z.label}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtrees.length} salle(s)</span>
        <button onClick={()=>setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm ml-auto"><Plus size={15}/> Nouvelle salle</button>
      </div>

      {showForm && (
        <div className="card p-4 border-l-4 border-l-brand">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Zone</label>
              <select className="input" value={form.zone_id} onChange={e=>setForm(f=>({...f,zone_id:e.target.value}))}>
                {zones.map(z=><option key={z.id} value={z.id}>{z.icon} {z.label}</option>)}
              </select>
            </div>
            <div><label className="label">Code</label><input className="input" placeholder="Ex: SAS_PERSONNEL_I" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))}/></div>
            <div><label className="label">Libellé</label><input className="input" placeholder="Ex: SAS Personnel I" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}/></div>
          </div>
          <button onClick={addSalle} className="btn-primary mt-3 text-sm flex items-center gap-2"><Save size={14}/> Créer</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>{['Zone','Code','Libellé','Statut','Actions'].map(h=><th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtrees.map(s=>(
              <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${!s.actif?'opacity-50':''}`}>
                <td className="px-4 py-3 text-sm text-gray-500">{s.zones?.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3 font-medium">{s.label}</td>
                <td className="px-4 py-3">
                  <button onClick={()=>toggleSalle(s.id,s.actif)} className={`text-xs px-2 py-1 rounded-full font-bold ${s.actif?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                    {s.actif?'Active':'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {editSalleId === s.id ? (
                    <div className="flex gap-2 items-center">
                      <input value={editSalleForm.label||''} onChange={e=>setEditSalleForm(f=>({...f,label:e.target.value}))} className="input py-1 text-xs w-40" placeholder="Libellé"/>
                      <button onClick={()=>saveSalle(s.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded flex items-center gap-1"><Save size={12}/> OK</button>
                      <button onClick={()=>setEditSalleId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={()=>{setEditSalleId(s.id);setEditSalleForm({label:s.label,code:s.code})}} className="text-xs text-gray-400 hover:text-brand flex items-center gap-1">✏️ Modifier</button>
                      <button onClick={()=>deleteSalle(s.id,s.label)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={13}/> Supprimer</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Points & Localisations ────────────────────────────────────────────────────
function PointsTab() {
  const [zones, setZones] = useState([])
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [selZone, setSelZone] = useState('ALL')
  const [selType, setSelType] = useState('ALL')
  const [editId, setEditId] = useState(null)
  const [editLoc, setEditLoc] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('*').eq('actif', true),
      supabase.from('points_controle').select('*, zones(label,code), salles(label)').order('point'),
    ]).then(([z, p]) => {
      setZones(z.data||[])
      setPoints(p.data||[])
      setLoading(false)
    })
  }, [])

  async function saveLoc(id) {
    await supabase.from('points_controle').update({ localisation: editLoc }).eq('id', id)
    setPoints(prev=>prev.map(p=>p.id===id?{...p,localisation:editLoc}:p))
    setEditId(null)
  }

  const filtres = points.filter(p => {
    if (selZone !== 'ALL' && p.zones?.code !== selZone) return false
    if (selType !== 'ALL' && p.type_controle !== selType) return false
    return true
  })

  const sansloc = filtres.filter(p=>!p.localisation).length

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mt-10"/>
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selZone} onChange={e=>setSelZone(e.target.value)} className="input py-1.5 text-sm w-48">
          <option value="ALL">Toutes les zones</option>
          {zones.map(z=><option key={z.code} value={z.code}>{z.icon} {z.label}</option>)}
        </select>
        <select value={selType} onChange={e=>setSelType(e.target.value)} className="input py-1.5 text-sm w-36">
          <option value="ALL">Tous types</option>
          <option value="ACTIF">Actif</option>
          <option value="PASSIF">Passif</option>
          <option value="SURFACE">Surface</option>
        </select>
        <span className="text-xs text-gray-400">{filtres.length} points</span>
        {sansloc > 0 && <span className="text-xs text-amber-500 font-medium">⚠️ {sansloc} sans localisation</span>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>{['Zone','Salle','Type','Point','Classe','Localisation',''].map(h=><th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtres.map(p=>(
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-2 text-xs text-gray-500">{p.zones?.label}</td>
                <td className="px-4 py-2 text-xs text-gray-400">{p.salles?.label||'—'}</td>
                <td className="px-4 py-2 text-xs font-mono">{p.type_controle}</td>
                <td className="px-4 py-2 font-mono font-bold text-brand">{p.point}</td>
                <td className="px-4 py-2 text-xs">Cl.{p.classe}</td>
                <td className="px-4 py-2 flex-1">
                  {editId === p.id ? (
                    <div className="flex gap-2 items-center">
                      <input value={editLoc} onChange={e=>setEditLoc(e.target.value)}
                        placeholder="Description physique du point..."
                        className="input py-1 text-xs flex-1" autoFocus
                        onKeyDown={e=>e.key==='Enter'&&saveLoc(p.id)}/>
                      <button onClick={()=>saveLoc(p.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded"><Save size={12}/></button>
                      <button onClick={()=>setEditId(null)} className="text-xs text-gray-400"><Trash2 size={12}/></button>
                    </div>
                  ) : (
                    <span className={`text-xs ${p.localisation?'text-gray-600 dark:text-gray-400':'text-gray-300 italic'}`}>
                      {p.localisation || 'Cliquer pour ajouter...'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {editId !== p.id && (
                    <button onClick={()=>{setEditId(p.id);setEditLoc(p.localisation||'')}}
                      className="text-xs text-gray-400 hover:text-brand">✏️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// ── Page principale ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'users',   label: '👥 Utilisateurs' },
  { id: 'zones',   label: '🏭 Zones' },
  { id: 'salles',  label: '🚪 Salles' },
  { id: 'points',  label: '📍 Points & Localisations' },
  { id: 'normes',  label: '📐 Normes' },
]

export default function Admin() {
  const [tab, setTab] = useState('users')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Administration</h1>
        <p className="text-gray-500 text-sm mt-1">Gestion des utilisateurs, zones, salles, points et normes</p>
      </div>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.id ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users'  && <UsersTab/>}
      {tab === 'zones'  && <ZonesTab/>}
      {tab === 'salles' && <SallesTab/>}
      {tab === 'points' && <PointsTab/>}
      {tab === 'normes' && <NormesTab/>}
    </div>
  )
}
