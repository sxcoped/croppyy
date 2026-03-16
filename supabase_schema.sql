-- ═══════════════════════════════════════════════════════════════════
-- Croppy — Supabase PostgreSQL + PostGIS Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- Enable PostGIS (already available in Supabase)
create extension if not exists postgis;

-- ── 1. User Profiles ───────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text not null,
  phone       text,
  role        text not null default 'farmer'    check (role in ('farmer','agronomist','admin')),
  language    text not null default 'en',
  state       text,
  district    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'farmer')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Fields ──────────────────────────────────────────────────────
create table if not exists public.fields (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  lat             double precision not null,
  lon             double precision not null,
  buffer_m        int default 1000,
  crop_type       text not null,
  sowing_date     date,
  state           text,
  district        text,
  irrigation_type text default 'rainfed',
  geom            geometry(Point, 4326),
  polygon         jsonb,          -- GeoJSON array of [lat, lon] vertices drawn by farmer
  area_ha         double precision, -- calculated area in hectares
  created_at      timestamptz default now()
);

-- Auto-set geom from lat/lon
create or replace function public.set_field_geom()
returns trigger language plpgsql as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.lon, new.lat), 4326);
  return new;
end;
$$;

drop trigger if exists set_field_geom_trigger on public.fields;
create trigger set_field_geom_trigger
  before insert or update on public.fields
  for each row execute procedure public.set_field_geom();

create index if not exists fields_geom_idx on public.fields using gist(geom);
create index if not exists fields_user_idx on public.fields(user_id);

-- ── 3. Index Readings ──────────────────────────────────────────────
create table if not exists public.index_readings (
  id          uuid default gen_random_uuid() primary key,
  field_id    uuid references public.fields(id) on delete cascade not null,
  recorded_at timestamptz default now(),
  source      text default 'sentinel2',
  ndvi        double precision,
  evi         double precision,
  savi        double precision,
  ndwi        double precision,
  ndre        double precision,
  msavi       double precision,
  bsi         double precision,
  ndmi        double precision,
  image_count int
);

create index if not exists idx_readings_field_time on public.index_readings(field_id, recorded_at desc);

-- ── 4. Sensor Readings ─────────────────────────────────────────────
create table if not exists public.sensor_readings (
  id             uuid default gen_random_uuid() primary key,
  field_id       uuid references public.fields(id) on delete cascade not null,
  device_id      text not null,
  recorded_at    timestamptz default now(),
  soil_moisture  double precision,
  soil_temp      double precision,
  air_temp       double precision,
  humidity       double precision,
  leaf_wetness   double precision,
  rainfall       double precision,
  lat            double precision,
  lon            double precision
);

create index if not exists idx_sensor_field_time on public.sensor_readings(field_id, recorded_at desc);

-- ── 5. Disease Detections ──────────────────────────────────────────
create table if not exists public.disease_detections (
  id             uuid default gen_random_uuid() primary key,
  field_id       uuid references public.fields(id) on delete set null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  detected_at    timestamptz default now(),
  image_url      text,
  predicted_class text,
  confidence     double precision,
  crop           text,
  disease        text,
  severity       text,
  treatment      text,
  is_healthy     boolean default false,
  is_confirmed   boolean  -- agronomist validation
);

-- ── 6. Pest Alerts ─────────────────────────────────────────────────
create table if not exists public.pest_alerts (
  id              uuid default gen_random_uuid() primary key,
  field_id        uuid references public.fields(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  alert_type      text not null,
  severity        text not null  check (severity in ('Low','Medium','High')),
  message         text,
  triggered_by    text,
  triggered_at    timestamptz default now(),
  acknowledged    boolean default false,
  acknowledged_at timestamptz
);

create index if not exists idx_pest_alerts_field on public.pest_alerts(field_id, triggered_at desc);
create index if not exists idx_pest_alerts_user  on public.pest_alerts(user_id, acknowledged);

-- ── 7. Stress Forecasts ────────────────────────────────────────────
create table if not exists public.stress_forecasts (
  id                  uuid default gen_random_uuid() primary key,
  field_id            uuid references public.fields(id) on delete cascade not null,
  forecast_date       date default current_date,
  stress_probability  double precision,
  severity_score      double precision,
  risk_level          text,
  created_at          timestamptz default now()
);

-- ── 8. Yield Estimates ─────────────────────────────────────────────
create table if not exists public.yield_estimates (
  id                    uuid default gen_random_uuid() primary key,
  field_id              uuid references public.fields(id) on delete cascade not null,
  crop_season           text,
  ndvi_at_flowering     double precision,
  estimated_min_kg_ha   int,
  estimated_max_kg_ha   int,
  estimated_modal_kg_ha int,
  confidence            text,
  created_at            timestamptz default now()
);

-- ── 9. Reports ─────────────────────────────────────────────────────
create table if not exists public.reports (
  id           uuid default gen_random_uuid() primary key,
  field_id     uuid references public.fields(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  generated_at timestamptz default now(),
  pdf_url      text,
  summary      jsonb
);

-- ══════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — users can only see their own data
-- ══════════════════════════════════════════════════════════════════════

alter table public.profiles         enable row level security;
alter table public.fields           enable row level security;
alter table public.index_readings   enable row level security;
alter table public.sensor_readings  enable row level security;
alter table public.disease_detections enable row level security;
alter table public.pest_alerts      enable row level security;
alter table public.stress_forecasts enable row level security;
alter table public.yield_estimates  enable row level security;
alter table public.reports          enable row level security;

-- ── Migration: add polygon + area + agro columns (safe to run on existing DB) ──
alter table public.fields add column if not exists polygon jsonb;
alter table public.fields add column if not exists area_ha double precision;

-- Profiles
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
  on public.profiles for all using (auth.uid() = id);

-- Fields
drop policy if exists "Users manage own fields" on public.fields;
create policy "Users manage own fields"
  on public.fields for all using (auth.uid() = user_id);

-- Index readings (via field ownership)
drop policy if exists "Users see own field readings" on public.index_readings;
create policy "Users see own field readings"
  on public.index_readings for all
  using (field_id in (select id from public.fields where user_id = auth.uid()));

-- Sensor readings
drop policy if exists "Users see own sensor readings" on public.sensor_readings;
create policy "Users see own sensor readings"
  on public.sensor_readings for all
  using (field_id in (select id from public.fields where user_id = auth.uid()));

-- Disease detections
drop policy if exists "Users manage own detections" on public.disease_detections;
create policy "Users manage own detections"
  on public.disease_detections for all using (auth.uid() = user_id);

-- Pest alerts
drop policy if exists "Users manage own alerts" on public.pest_alerts;
create policy "Users manage own alerts"
  on public.pest_alerts for all using (auth.uid() = user_id);

-- Stress forecasts
drop policy if exists "Users manage own forecasts" on public.stress_forecasts;
create policy "Users manage own forecasts"
  on public.stress_forecasts for all
  using (field_id in (select id from public.fields where user_id = auth.uid()));

-- Yield estimates
drop policy if exists "Users manage own yield estimates" on public.yield_estimates;
create policy "Users manage own yield estimates"
  on public.yield_estimates for all
  using (field_id in (select id from public.fields where user_id = auth.uid()));

-- Reports
drop policy if exists "Users manage own reports" on public.reports;
create policy "Users manage own reports"
  on public.reports for all using (auth.uid() = user_id);

-- Agronomists can read all data in their district
drop policy if exists "Agronomists read all fields" on public.fields;
create policy "Agronomists read all fields"
  on public.fields for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'agronomist'
    )
  );
