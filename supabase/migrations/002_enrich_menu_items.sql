alter table public.menu_items
  add column if not exists calories_from_fat integer not null default 0,
  add column if not exists saturated_fat_g real not null default 0,
  add column if not exists trans_fat_g real not null default 0,
  add column if not exists sugars_g real not null default 0,
  add column if not exists cholesterol_mg real not null default 0,
  add column if not exists healthfulness integer not null default 0,
  add column if not exists recipe_webcode text not null default '';
