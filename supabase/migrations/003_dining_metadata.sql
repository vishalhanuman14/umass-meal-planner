alter table public.menu_items
  add column if not exists total_fat_dv integer not null default 0,
  add column if not exists saturated_fat_dv integer not null default 0,
  add column if not exists cholesterol_dv integer not null default 0,
  add column if not exists sodium_dv integer not null default 0,
  add column if not exists carbs_dv integer not null default 0,
  add column if not exists fiber_dv integer not null default 0,
  add column if not exists sugars_dv integer not null default 0,
  add column if not exists protein_dv integer not null default 0;

create table if not exists public.dining_commons_metadata (
  dining_commons text primary key,
  display_name text not null,
  address text not null default '',
  description text not null default '',
  regular_hours jsonb not null default '[]'::jsonb,
  special_hours jsonb not null default '[]'::jsonb,
  payment_methods text[] not null default '{}'::text[],
  livestreams jsonb not null default '[]'::jsonb,
  source_url text not null default '',
  updated_at timestamptz not null default now(),

  constraint dining_commons_metadata_key_check
    check (dining_commons in ('worcester', 'franklin', 'hampshire', 'berkshire'))
);

alter table public.dining_commons_metadata enable row level security;

drop policy if exists "Dining commons metadata readable by authenticated users" on public.dining_commons_metadata;
create policy "Dining commons metadata readable by authenticated users"
  on public.dining_commons_metadata
  for select
  to authenticated
  using (true);
