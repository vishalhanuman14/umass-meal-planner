# UMass Meal Planner

Personalized UMass dining recommendations backed by Supabase, Expo, and Gemini.

This is recommendation-only. It does not track what the user ate.

## What Is Included

- Python scraper for Worcester, Franklin, Hampshire, and Berkshire dining commons
- Supabase schema with RLS for menu items, profiles, cached meal plans, and chat
- Supabase Edge Functions for meal-plan generation and menu-aware chat
- Expo React Native app with Google sign-in, onboarding, home, chat, and settings
- GitHub Actions workflow to scrape today plus the next 6 days every morning

## Repo Layout

```text
scraper/                  Python UMass Dining scraper
supabase/migrations/      Postgres schema and RLS
supabase/functions/       Deno Edge Functions
mobile/                   Expo React Native app
.github/workflows/        Daily scraper workflow
```

## Environment

Root `.env` for scraper uploads:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`mobile/.env` for Expo:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Supabase Edge Function secrets:

```bash
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Scraper

Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Smoke test today's menus:

```bash
python3 -m scraper.auto_scrape --test --day "$(TZ=America/New_York date +%F)" --all-commons
```

Scrape today plus the next 6 days and upload to Supabase:

```bash
python3 -m scraper.auto_scrape --all-commons --start-date "$(TZ=America/New_York date +%F)" --days 7 --upload-supabase
```

The scraper exits successfully on partial success and fails only when every commons/date fetch fails.

## Supabase

Apply the migration:

```bash
supabase db push
```

Deploy functions:

```bash
supabase functions deploy generate-meal-plan
supabase functions deploy chat
```

Enable Google Auth in the Supabase dashboard and configure the OAuth redirect URL for the Expo app. The database and app both enforce `@umass.edu` accounts.

## Mobile App

Install dependencies:

```bash
cd mobile
npm install
```

Run checks:

```bash
npm run typecheck
```

Start Expo:

```bash
npm run start
```

## Validation

Current local checks:

```bash
python3 -m pytest tests/ -v
python3 -m compileall scraper
cd mobile && npm run typecheck
python3 -m scraper.auto_scrape --test --day 2026-04-24 --all-commons --request-delay 0
```
