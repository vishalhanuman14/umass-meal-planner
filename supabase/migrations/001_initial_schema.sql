create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

-- ============================================================
-- Menu items populated by the scraper
-- ============================================================
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  dining_commons text not null,
  meal_period text not null,
  station text not null,
  item_name text not null,
  serving_size text not null default '1 serving',
  calories integer not null default 0,
  protein_g real not null default 0,
  fat_g real not null default 0,
  carbs_g real not null default 0,
  fiber_g real not null default 0,
  sodium_mg integer not null default 0,
  dietary_tags text[] not null default '{}'::text[],
  allergens text not null default '',
  ingredient_list text not null default '',
  carbon_rating text not null default '',
  created_at timestamptz not null default now(),

  constraint menu_items_dining_commons_check
    check (dining_commons in ('worcester', 'franklin', 'hampshire', 'berkshire')),
  constraint menu_items_meal_period_check
    check (meal_period in ('breakfast', 'lunch', 'dinner', 'late_night', 'grabngo')),
  constraint menu_items_unique_item
    unique (date, dining_commons, meal_period, item_name)
);

create index if not exists idx_menu_items_date
  on public.menu_items(date);

create index if not exists idx_menu_items_dc_date
  on public.menu_items(dining_commons, date);

create index if not exists idx_menu_items_date_period
  on public.menu_items(date, meal_period);

-- ============================================================
-- User profiles from onboarding
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  height_cm real,
  weight_kg real,
  age integer,
  gender text,
  activity_level text,
  goal text,
  calorie_target integer,
  protein_target_g real,
  fat_target_g real,
  carbs_target_g real,
  dietary_restrictions text[] not null default '{}'::text[],
  allergens text[] not null default '{}'::text[],
  preferred_dining_commons text[] not null default '{}'::text[],
  additional_preferences text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_umass_email_check
    check (lower(email) like '%@umass.edu'),
  constraint profiles_gender_check
    check (gender is null or gender in ('male', 'female', 'other')),
  constraint profiles_activity_level_check
    check (activity_level is null or activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  constraint profiles_goal_check
    check (goal is null or goal in ('lose', 'gain', 'maintain')),
  constraint profiles_age_check
    check (age is null or age between 13 and 120),
  constraint profiles_targets_check
    check (
      (calorie_target is null or calorie_target > 0)
      and (protein_target_g is null or protein_target_g >= 0)
      and (fat_target_g is null or fat_target_g >= 0)
      and (carbs_target_g is null or carbs_target_g >= 0)
    )
);

-- ============================================================
-- Cached daily meal plans
-- ============================================================
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  plan_json jsonb not null,
  generated_at timestamptz not null default now(),

  constraint meal_plans_user_date_unique unique (user_id, date)
);

create index if not exists idx_meal_plans_user_date
  on public.meal_plans(user_id, date);

-- ============================================================
-- Chat messages
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),

  constraint chat_messages_role_check
    check (role in ('user', 'assistant')),
  constraint chat_messages_content_check
    check (length(trim(content)) > 0)
);

create index if not exists idx_chat_user
  on public.chat_messages(user_id, created_at);

-- ============================================================
-- Shared triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Reject non-UMass auth users before they can be created or moved to a new email.
create or replace function public.enforce_umass_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null or lower(new.email) not like '%@umass.edu' then
    raise exception 'Only @umass.edu email addresses are allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_umass_email_on_auth_users on auth.users;
create trigger enforce_umass_email_on_auth_users
  before insert or update of email on auth.users
  for each row
  execute function public.enforce_umass_auth_email();

-- Create or sync the public profile row after auth user creation/update.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1),
    ''
  );

  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email), profile_name)
  on conflict (id) do update
    set email = excluded.email,
        name = case
          when public.profiles.name = '' then excluded.name
          else public.profiles.name
        end,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists handle_auth_user_profile_on_auth_users on auth.users;
create trigger handle_auth_user_profile_on_auth_users
  after insert or update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.handle_auth_user_profile();

revoke all on function public.set_updated_at() from public;
revoke all on function public.enforce_umass_auth_email() from public;
revoke all on function public.handle_auth_user_profile() from public;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.menu_items enable row level security;
alter table public.profiles enable row level security;
alter table public.meal_plans enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Menu items readable by authenticated users" on public.menu_items;
create policy "Menu items readable by authenticated users"
  on public.menu_items
  for select
  to authenticated
  using (true);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id and lower(email) like '%@umass.edu');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and lower(email) like '%@umass.edu');

drop policy if exists "Users can view own meal plans" on public.meal_plans;
create policy "Users can view own meal plans"
  on public.meal_plans
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal plans" on public.meal_plans;
create policy "Users can insert own meal plans"
  on public.meal_plans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own meal plans" on public.meal_plans;
create policy "Users can update own meal plans"
  on public.meal_plans
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own messages" on public.chat_messages;
create policy "Users can view own messages"
  on public.chat_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.chat_messages;
create policy "Users can insert own messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own messages" on public.chat_messages;
create policy "Users can delete own messages"
  on public.chat_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);
