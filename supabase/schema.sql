-- ============================================================
-- ENVIROCONTROL — Schéma Supabase complet
-- À coller dans : Supabase > SQL Editor > New Query > Run
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ─── PROFILS UTILISATEURS ────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text not null,
  email       text not null,
  role        text not null check (role in ('admin','operateur','lecteur')) default 'lecteur',
  theme       text not null check (theme in ('light','dark')) default 'light',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── ZONES ───────────────────────────────────────────────────
create table public.zones (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,
  label       text not null,
  classe      text not null check (classe in ('A','B','C','D')),
  icon        text default '🔬',
  color       text default '#1d6fa4',
  actif       boolean default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── NORMES PAR ZONE ─────────────────────────────────────────
create table public.normes (
  id            uuid primary key default uuid_generate_v4(),
  zone_id       uuid references public.zones(id) on delete cascade,
  type_controle text not null check (type_controle in ('ACTIF','PASSIF','SURFACE')),
  norme         numeric not null,
  alerte        numeric not null,
  action        numeric not null,
  unite         text default 'UFC/m³',
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz default now(),
  unique(zone_id, type_controle)
);

-- ─── CONTRÔLES ───────────────────────────────────────────────
create table public.controles (
  id            uuid primary key default uuid_generate_v4(),
  zone_id       uuid references public.zones(id) on delete restrict,
  date_controle date not null,
  type_controle text not null check (type_controle in ('ACTIF','PASSIF','SURFACE')),
  point         text not null,
  germes        numeric not null,
  statut        text generated always as (
    case
      when germes < 0 then 'INVALIDE'
      else 'PENDING' -- calculé côté app après jointure avec normes
    end
  ) stored,
  operateur_id  uuid references public.profiles(id),
  lot           text,
  observations  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── AUDIT TRAIL ─────────────────────────────────────────────
create table public.audit_trail (
  id            uuid primary key default uuid_generate_v4(),
  table_name    text not null,
  record_id     uuid not null,
  action        text not null check (action in ('INSERT','UPDATE','DELETE')),
  field_name    text,
  old_value     text,
  new_value     text,
  justification text,
  user_id       uuid references public.profiles(id),
  user_name     text,
  ip_address    text,
  created_at    timestamptz default now()
);

-- ─── DONNÉES EAU (évolutif) ──────────────────────────────────
create table public.controles_eau (
  id            uuid primary key default uuid_generate_v4(),
  type_eau      text not null check (type_eau in ('PURIFIEE','EPPI')),
  date_controle date not null,
  point         text not null,
  parametre     text not null,  -- conductivité, TOC, endotoxines...
  valeur        numeric not null,
  unite         text not null,
  limite        numeric,
  conforme      boolean,
  operateur_id  uuid references public.profiles(id),
  observations  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── TRIGGERS AUDIT AUTOMATIQUE ──────────────────────────────
create or replace function log_controle_update()
returns trigger language plpgsql security definer as $$
begin
  if OLD.germes is distinct from NEW.germes then
    insert into public.audit_trail(table_name, record_id, action, field_name, old_value, new_value, user_id)
    values('controles', NEW.id, 'UPDATE', 'germes', OLD.germes::text, NEW.germes::text, auth.uid());
  end if;
  if OLD.point is distinct from NEW.point then
    insert into public.audit_trail(table_name, record_id, action, field_name, old_value, new_value, user_id)
    values('controles', NEW.id, 'UPDATE', 'point', OLD.point, NEW.point, auth.uid());
  end if;
  return NEW;
end;
$$;

create trigger trg_audit_controles
  after update on public.controles
  for each row execute function log_controle_update();

-- trigger INSERT
create or replace function log_controle_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_trail(table_name, record_id, action, field_name, new_value, user_id)
  values('controles', NEW.id, 'INSERT', 'germes', NEW.germes::text, auth.uid());
  return NEW;
end;
$$;

create trigger trg_audit_controles_insert
  after insert on public.controles
  for each row execute function log_controle_insert();

-- trigger profile updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end;
$$;
create trigger trg_updated_at_profiles  before update on public.profiles  for each row execute function update_updated_at();
create trigger trg_updated_at_zones     before update on public.zones     for each row execute function update_updated_at();
create trigger trg_updated_at_controles before update on public.controles for each row execute function update_updated_at();

-- ─── TRIGGER AUTO-PROFIL À L'INSCRIPTION ─────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'lecteur')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS (Row Level Security) ────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.zones       enable row level security;
alter table public.normes      enable row level security;
alter table public.controles   enable row level security;
alter table public.audit_trail enable row level security;
alter table public.controles_eau enable row level security;

-- Profiles : chacun voit son profil, admin voit tout
create policy "profiles_select" on public.profiles for select using (
  auth.uid() = id or exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Zones : tout le monde lit, admin gère
create policy "zones_select_all" on public.zones for select using (auth.role() = 'authenticated');
create policy "zones_admin_write" on public.zones for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Normes : tout le monde lit, admin gère
create policy "normes_select_all" on public.normes for select using (auth.role() = 'authenticated');
create policy "normes_admin_write" on public.normes for all using (
  exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Contrôles : tout le monde lit, opérateur+admin écrivent
create policy "controles_select_all" on public.controles for select using (auth.role() = 'authenticated');
create policy "controles_insert_op" on public.controles for insert with check (
  exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','operateur'))
);
create policy "controles_update_op" on public.controles for update using (
  exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','operateur'))
);

-- Audit : tout le monde lit, personne n'écrit directement (via trigger)
create policy "audit_select_all" on public.audit_trail for select using (auth.role() = 'authenticated');
create policy "audit_insert_system" on public.audit_trail for insert with check (true);

-- Eau : mêmes règles que contrôles
create policy "eau_select_all" on public.controles_eau for select using (auth.role() = 'authenticated');
create policy "eau_insert_op" on public.controles_eau for insert with check (
  exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','operateur'))
);

-- ─── DONNÉES INITIALES ───────────────────────────────────────
insert into public.zones(code, label, classe, icon, color) values
  ('PRELEVEMENT', 'Prélèvement',   'D', '🔬', '#1d6fa4'),
  ('PREPA_POCHE', 'Prépa. Poche',  'C', '💊', '#16a34a'),
  ('STER',        'Stérilisation', 'B', '⚗️',  '#ea580c');

insert into public.normes(zone_id, type_controle, norme, alerte, action, unite)
select z.id, t.type, t.norme, t.alerte, t.action, t.unite from public.zones z
cross join (values
  ('PRELEVEMENT','ACTIF',  200,60,100,'UFC/m³'),
  ('PRELEVEMENT','PASSIF', 100,30,50, 'UFC/boîte'),
  ('PRELEVEMENT','SURFACE',50, 15,25, 'UFC/cm²'),
  ('PREPA_POCHE','ACTIF',  100,30,50, 'UFC/m³'),
  ('PREPA_POCHE','PASSIF', 50, 15,25, 'UFC/boîte'),
  ('PREPA_POCHE','SURFACE',25, 8, 15, 'UFC/cm²'),
  ('STER',       'ACTIF',  10, 3, 5,  'UFC/m³'),
  ('STER',       'PASSIF', 5,  2, 3,  'UFC/boîte'),
  ('STER',       'SURFACE',5,  2, 3,  'UFC/cm²')
) as t(zone_code, type, norme, alerte, action, unite)
where z.code = t.zone_code;
