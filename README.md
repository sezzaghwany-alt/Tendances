# EnviroControl 🧪
**Application de contrôle microbiologique environnemental**  
Stack : React + Vite + Tailwind · Supabase · Cloudflare Pages

---

## 🚀 Installation locale

```bash
# 1. Cloner le projet
git clone https://github.com/TON_COMPTE/envirocontrol.git
cd envirocontrol

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# → Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# 4. Lancer en développement
npm run dev
```

---

## 🗄️ Configuration Supabase

### Étape 1 — Base de données
1. Aller sur **app.supabase.com** → ton projet
2. **SQL Editor** → New Query
3. Coller le contenu de `supabase/schema.sql`
4. Cliquer **Run**

### Étape 2 — Variables d'environnement
Dans ton projet Supabase :
- **Project Settings** → **API**
- Copier **Project URL** → `VITE_SUPABASE_URL`
- Copier **anon public key** → `VITE_SUPABASE_ANON_KEY`

### Étape 3 — Email (envoi des identifiants)
- **Authentication** → **Email Templates** → personnaliser le template d'invitation
- **Project Settings** → **Auth** → configurer ton serveur SMTP (ou utiliser Resend)

### Étape 4 — Créer le premier admin
Dans Supabase SQL Editor :
```sql
-- Après la première inscription, promouvoir en admin
UPDATE public.profiles SET role = 'admin' WHERE email = 'ton@email.com';
```

---

## ☁️ Déploiement Cloudflare Pages

### Via GitHub (recommandé)
1. Pousser le code sur GitHub
2. **Cloudflare Dashboard** → **Pages** → Create a project
3. Connecter ton repo GitHub
4. Build settings :
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
5. **Environment variables** :
   - `VITE_SUPABASE_URL` = ton URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon
6. **Save and Deploy** ✅

### Mise à jour automatique
Chaque `git push` sur `main` déclenche un redéploiement automatique.

---

## 👥 Rôles utilisateurs

| Rôle | Dashboard | Tendances | Alertes | Saisie | Modification | Audit | Admin |
|------|-----------|-----------|---------|--------|-------------|-------|-------|
| 👑 Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ✏️ Opérateur | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 👁️ Lecteur | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 📋 Fonctionnalités

- **Dashboard global** — KPIs, statuts par zone, graphique mensuel
- **Tendances** — graphiques avec limites, statistiques (Cp, Cpk, σ, P95...), interprétation automatique
- **Alertes** — liste filtrée des non-conformités (alerte / action)
- **Saisie** — formulaire avec calcul de conformité en temps réel, modification avec justification
- **Audit Trail** — historique complet valeur avant/après, qui/quand/pourquoi
- **Thèmes** — sombre / clair, mémorisé par utilisateur
- **Admin** — gestion zones, normes, utilisateurs + envoi identifiants par mail
- **Évolutif** — architecture prête pour eau purifiée (EPPI) et autres zones

---

## 🔮 Évolutions futures

Pour ajouter le contrôle de l'eau purifiée et EPPI, la table `controles_eau` est déjà créée dans le schéma. Il suffit d'ajouter les pages correspondantes.

---

## 📞 Support
Généré avec EnviroControl v1.0 — Mars 2025
