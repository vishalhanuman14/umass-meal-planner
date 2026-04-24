# UMass Meal Planner — Mobile App Plan

## Active TODO

Current UI direction: warm, welcoming, bubbly food-ordering style inspired by DoorDash. The app should stay straightforward: open it, see what to eat, ask one question if needed, leave.

### Now

1. Commit and push the verified enriched menu/detail-card/settings-save changes.
2. Monitor the next scheduled `Daily Menu Scrape` run to confirm the cron path continues to upload rows without manual dispatch.

### Design Rules For This Pass

- No dark mode.
- No generic health-dashboard look.
- No dense utility-board chrome.
- Cards should feel roomy and food-app-like, not admin-tool-like.
- Primary actions use red pills.
- Secondary actions use soft white/cream pills.
- Dining commons should be soft colored markers, not neon rails.
- Additional nutrition belongs behind item tap details, not on the visible meal cards.

### Later

- Consider upgrading GitHub Actions versions when GitHub's Node 20 deprecation warning becomes actionable for `actions/checkout@v4` or `actions/setup-python@v5`.
- Decide whether to keep using the `hare-platform` Google Cloud project for this app or move OAuth into a dedicated Google Cloud project later.

## Overview

Mobile calorie/nutrition app for UMass Amherst students. App pulls daily dining hall menus (all 4 dining commons), takes user goals/preferences via onboarding, and uses Gemini LLM to generate personalized daily meal recommendations. Includes free-form chat with menu+profile context.

**This is NOT a tracking app.** No logging what user ate. Recommendation-only.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Mobile | React Native (Expo managed workflow) | No native build complexity |
| Backend/DB | Supabase (Postgres + Auth + Edge Functions) | Free tier |
| Auth | Supabase Google Sign-In | Gated to `@umass.edu` emails only |
| LLM | Google Gemini (via Supabase Edge Function) | API key hidden server-side |
| Scraper | Python (extend existing) | Runs daily via GitHub Actions |

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Scraper (cron)  │────▶│   Supabase   │◀────│  React Native    │
│  Python script   │     │   Postgres   │     │  (Expo)          │
│  GitHub Actions  │     │   + Auth     │     │                  │
│  daily ~5am ET   │     │   + Edge Fn  │     │                  │
└─────────────────┘     └──────┬───────┘     └────────┬─────────┘
                               │                       │
                               │                       ▼
                               │              ┌──────────────────┐
                               └──────────────│  Gemini API      │
                                              │  (via Edge Fn)   │
                                              └──────────────────┘
```

## Phase 1: Scraper — Extend to All Dining Commons + Supabase

### Current State

Existing scraper in `scraper/auto_scrape.py` works for Franklin (tid=2). Uses UMass Dining AJAX endpoint:

```
https://umassdining.com/foodpro-menu-ajax?tid={LOCATION_ID}&date={MM%2FDD%2FYYYY}
```

### Dining Commons IDs

| Dining Commons | tid | URL path |
|----------------|-----|----------|
| Worcester      | 1   | `/locations-menus/worcester/menu` |
| Franklin       | 2   | `/locations-menus/franklin/menu` |
| Hampshire      | 3   | `/locations-menus/hampshire/menu` |
| Berkshire      | 4   | `/locations-menus/berkshire/menu` |

### API Response Format

Response is JSON: `{ "breakfast": { "Station Name": "<html>", ... }, "lunch": {...}, "dinner": {...} }`

Each station value is an HTML string containing `<a>` tags with data attributes per item:

```html
<a data-dish-name="Black Bean Frijoles"
   data-serving-size="3 OZ"
   data-calories="72"
   data-protein="4.6g"
   data-total-fat="0g"
   data-total-carb="13.1g"
   data-dietary-fiber="3.3g"
   data-sodium="85.1mg"
   data-clean-diet-str="Halal, Plant Based, Whole Grain"
   data-allergens=""
   data-ingredient-list="Low Sodium Black Turtle Beans (Prepared Black Beans, Water, Salt, Calcium Chloride)"
   data-carbon-list="A"
   data-healthfulness="60"
   href="#inline">
```

### What to Build

1. **Modify `scraper/auto_scrape.py`**:
   - Make `LOCATION_ID` a parameter, not hardcoded `2`
   - Add `DINING_COMMONS` dict: `{"worcester": 1, "franklin": 2, "hampshire": 3, "berkshire": 4}`
   - `run_scrape()` iterates all 4 commons
   - Also extract `data-ingredient-list` (not currently scraped — needed for dietary info)

2. **Add Supabase upload** (`scraper/upload_to_supabase.py`):
   - Use `supabase-py` client
   - Upsert into `menu_items` table (upsert on `date + dining_commons + meal_period + item_name`)
   - Delete stale data older than 14 days

3. **GitHub Actions workflow** (`.github/workflows/scrape.yml`):
   - Cron: `0 10 * * *` (5am ET = 10:00 UTC)
   - Steps: checkout → setup python → install deps → run scraper → upload to Supabase
   - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Existing Parser Logic (reuse)

`scraper/parse_menu.py` has `normalize_item()` and `normalize_menu()` — these handle:
- Extracting numeric values from strings like "4.6g"
- Deduplication across periods
- Flagging items with missing nutrition data
- Normalizing dietary tags from comma-separated strings

The HTML parser in `auto_scrape.py` (`_ItemHTMLParser`) extracts all `data-*` attributes from `<a>` tags. Currently captures: name, serving_size, calories, protein_g, fat_g, carbs_g, fiber_g, sodium_mg, dietary_tags, carbon_rating, allergens.

**Add**: `ingredient_list` field from `data-ingredient-list`.

---

## Phase 2: Supabase Setup

### Database Schema

```sql
-- ============================================================
-- Menu items (populated by scraper)
-- ============================================================
CREATE TABLE menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  dining_commons TEXT NOT NULL,        -- 'worcester', 'franklin', 'hampshire', 'berkshire'
  meal_period TEXT NOT NULL,           -- 'breakfast', 'lunch', 'dinner', 'late_night', 'grabngo'
  station TEXT NOT NULL,               -- 'Grill Station', 'Soups', etc.
  item_name TEXT NOT NULL,
  serving_size TEXT DEFAULT '1 serving',
  calories INTEGER DEFAULT 0,
  protein_g REAL DEFAULT 0,
  fat_g REAL DEFAULT 0,
  carbs_g REAL DEFAULT 0,
  fiber_g REAL DEFAULT 0,
  sodium_mg INTEGER DEFAULT 0,
  dietary_tags TEXT[] DEFAULT '{}',    -- ['halal', 'plant based', 'whole grain']
  allergens TEXT DEFAULT '',
  ingredient_list TEXT DEFAULT '',
  carbon_rating TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(date, dining_commons, meal_period, item_name)
);

CREATE INDEX idx_menu_items_date ON menu_items(date);
CREATE INDEX idx_menu_items_dc_date ON menu_items(dining_commons, date);

-- ============================================================
-- User profiles (from onboarding)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  height_cm REAL,
  weight_kg REAL,
  age INTEGER,
  gender TEXT,                          -- 'male', 'female', 'other'
  activity_level TEXT,                  -- 'sedentary', 'light', 'moderate', 'active', 'very_active'
  goal TEXT,                            -- 'lose', 'gain', 'maintain'
  calorie_target INTEGER,
  protein_target_g REAL,
  fat_target_g REAL,
  carbs_target_g REAL,
  dietary_restrictions TEXT[] DEFAULT '{}',  -- ['vegetarian', 'halal', 'gluten-free']
  allergens TEXT[] DEFAULT '{}',             -- ['peanuts', 'shellfish']
  preferred_dining_commons TEXT[] DEFAULT '{}',
  additional_preferences TEXT DEFAULT '',     -- free text passed to LLM
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Cached daily meal plans
-- ============================================================
CREATE TABLE meal_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  date DATE NOT NULL,
  plan_json JSONB NOT NULL,            -- full structured plan from Gemini
  generated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_meal_plans_user_date ON meal_plans(user_id, date);

-- ============================================================
-- Chat messages
-- ============================================================
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT NOT NULL,                   -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_user ON chat_messages(user_id, created_at);
```

### Row Level Security (RLS)

```sql
-- menu_items: readable by any authenticated user
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menu items readable by authenticated users"
  ON menu_items FOR SELECT TO authenticated USING (true);

-- profiles: users only access own row
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- meal_plans: users only access own plans
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meal plans"
  ON meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans"
  ON meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

-- chat_messages: users only access own messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages"
  ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Auth Config

- Enable Google provider in Supabase dashboard
- Set Google OAuth client ID + secret (same Google Cloud project as hare app, or new one)
- In signIn callback or trigger: reject emails not ending in `@umass.edu`
- Auto-create profile row on first sign-in (via database trigger or app logic)

---

## Phase 3: React Native App (Expo)

### Project Setup

```bash
npx create-expo-app umass-nutrition --template blank-typescript
cd umass-nutrition
npx expo install @supabase/supabase-js
npx expo install expo-auth-session expo-web-browser expo-secure-store
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

### Navigation Structure

```
AuthStack (unauthenticated)
  ├── SignInScreen

OnboardingStack (authenticated, !onboarding_completed)
  ├── BodyStatsScreen      — height, weight, age, gender
  ├── GoalsScreen           — goal type, activity level, macro targets (auto-calc or manual)
  ├── PreferencesScreen     — dietary restrictions, allergens, preferred DCs, free text
  └── ReviewScreen          — summary, confirm, save to Supabase

MainStack (authenticated, onboarding_completed)
  ├── HomeScreen            — today's meal plan
  ├── ChatScreen            — free-form Gemini chat
  └── SettingsScreen        — edit profile, sign out
```

### Screen Details

#### SignInScreen
- App name/logo at top
- "Sign in with Google" button (umass.edu only)
- Brief tagline: "Personalized meal plans from UMass dining halls"
- On sign-in: check if profile exists + onboarding_completed → route accordingly

#### BodyStatsScreen (Onboarding 1/3)
- Height (ft/in toggle to cm)
- Weight (lbs toggle to kg)
- Age
- Gender (male/female/other)
- "Next" button

#### GoalsScreen (Onboarding 2/3)
- Goal: lose weight / gain muscle / maintain (big tappable cards)
- Activity level: sedentary / lightly active / active / very active
- Auto-calculate TDEE and macro targets based on selections:
  - **Lose**: TDEE - 500 cal, 0.8g protein/lb bodyweight
  - **Gain**: TDEE + 300 cal, 1g protein/lb bodyweight
  - **Maintain**: TDEE, 0.8g protein/lb bodyweight
- Show calculated targets, allow manual override
- "Next" button

#### PreferencesScreen (Onboarding 3/3)
- Dietary restrictions: checkboxes (vegetarian, vegan, halal, kosher, gluten-free, dairy-free)
- Allergens: checkboxes (peanuts, tree nuts, shellfish, soy, eggs, wheat, milk)
- Preferred dining commons: multi-select (Worcester, Franklin, Hampshire, Berkshire)
- Additional preferences: free-form text field ("I love spicy food", "No raw fish", etc.)
  - This text is passed verbatim to Gemini in the prompt
- "Complete Setup" button → save profile → navigate to MainStack

#### HomeScreen
- **Header**: date, greeting
- **Meal plan card** for each period (breakfast, lunch, dinner):
  - Dining commons name
  - List of recommended items with servings
  - Per-item: calories, protein
  - Meal period total macros
- **Daily summary bar**: total cal / protein / fat / carbs vs targets (progress bars)
- **Regenerate button**: re-call Gemini for fresh plan
- **Pull-to-refresh**: re-fetch if plan doesn't exist for today

**Meal plan generation flow**:
1. App checks `meal_plans` table for today + user_id
2. If exists and not stale → display cached plan
3. If not → call `generate-meal-plan` Edge Function → save result → display

#### ChatScreen
- Standard chat UI (messages list + input bar)
- Messages stored in `chat_messages` table
- Each user message → call `chat` Edge Function
- Edge Function injects context: user profile + today's menu across all commons
- Gemini responds with menu-aware nutrition advice
- Chat history persisted, loaded on screen open (last 50 messages)
- "Clear chat" option in header

#### SettingsScreen
- Display current profile info
- Edit any onboarding field
- Save → update profile in Supabase
- If macro-relevant fields change (weight, goal, activity), recalculate targets
- Sign out button

### Design Principles
- **Simple, no fluff.** No animations, no gamification, no social features
- **Light warm UI default. No dark mode for the current app direction.**
- **System font** (no custom fonts)
- **Warm food-app palette**: cream background, white cards, DoorDash-like red primary CTAs, soft dining-common accents
- **Rounded UI**: pill buttons/chips, roomy cards, soft shadows, clean typography for macros

---

## Phase 4: Supabase Edge Functions

### `generate-meal-plan`

**Trigger**: Called from app when user needs today's plan.

**Input**: `{ user_id: string }`

**Logic**:
1. Fetch user profile from `profiles`
2. Fetch today's menu items from `menu_items` for user's preferred dining commons (or all if none set)
3. Build Gemini prompt (see Prompt Design below)
4. Call Gemini API (`gemini-flash-latest` with structured JSON schema)
5. Parse structured JSON response
6. Upsert into `meal_plans` table
7. Return plan JSON to client

**Prompt Design** (adapt from existing `planner/llm_planner.py:_build_prompt`):

```
You are a nutrition advisor for a UMass Amherst student.

STUDENT PROFILE:
- Goal: {goal} | Calories: {calorie_target} | Protein: {protein_target_g}g | Fat: {fat_target_g}g | Carbs: {carbs_target_g}g
- Dietary restrictions: {dietary_restrictions}
- Allergens (NEVER recommend items containing these): {allergens}
- Additional preferences: {additional_preferences}

TODAY'S MENU — {date}
{for each dining_commons}
  === {DINING_COMMONS_NAME} ===
  {for each meal_period}
    [{PERIOD}]
    {for each item}
      - {item_name} | {calories} cal | {protein_g}g P | {fat_g}g F | {carbs_g}g C | serving: {serving_size} | tags: {dietary_tags} | allergens: {allergens}
    {end}
  {end}
{end}

INSTRUCTIONS:
Build a full day meal plan (breakfast, lunch, dinner) using ONLY items from today's menu.
- Meet calorie and macro targets as closely as possible
- Respect ALL dietary restrictions and allergen exclusions
- For each meal, specify: dining commons, items, servings per item
- Prefer items from user's preferred dining commons if set
- You may suggest items from different dining commons for different meals

Respond ONLY in this JSON format:
{
  "meals": {
    "breakfast": {
      "dining_commons": "name",
      "items": [{"item": "exact name", "servings": int, "calories": int, "protein_g": float, "fat_g": float, "carbs_g": float}],
      "meal_total": {"calories": int, "protein_g": float, "fat_g": float, "carbs_g": float}
    },
    "lunch": { ... },
    "dinner": { ... }
  },
  "daily_total": {"calories": int, "protein_g": float, "fat_g": float, "carbs_g": float},
  "reasoning": "brief explanation of choices"
}
```

### `chat`

**Trigger**: Called from app on each user message.

**Input**: `{ user_id: string, message: string }`

**Logic**:
1. Fetch user profile
2. Fetch today's menu items (all commons)
3. Fetch last 20 chat messages for context
4. Build Gemini prompt with system context + conversation history + new message
5. Call Gemini API
6. Save both user message and assistant response to `chat_messages`
7. Return assistant response

**System prompt for chat**:
```
You are a nutrition advisor for a UMass Amherst student. You have access to today's dining hall menus
and the student's profile. Answer questions about menu items, nutrition, meal suggestions, and general
nutrition advice. Be concise and helpful. When recommending items, always specify which dining commons
they're from. If asked about items not on today's menu, say so.

{same profile and menu context as generate-meal-plan}
```

### Edge Function Tech

Supabase Edge Functions use Deno. Structure:

```
supabase/
  functions/
    generate-meal-plan/
      index.ts
    chat/
      index.ts
    _shared/
      supabase.ts      -- createClient helper
      gemini.ts         -- Gemini API call helper
      menu.ts           -- fetch today's menu helper
      profile.ts        -- fetch user profile helper
```

Environment variables (set in Supabase dashboard):
- `GEMINI_API_KEY`
- `SUPABASE_URL` (auto-available)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-available)

---

## Phase 5: GitHub Actions Scraper Workflow

This is the intended scheduled automation. Keep the scraper as a GitHub Actions workflow because it is Python code that calls the public UMass Dining AJAX endpoint, normalizes rows, and uploads them to Supabase with the service role key. Supabase Edge Functions stay request-driven for app features (`generate-meal-plan`, `chat`), not scheduled scraping.

```yaml
name: Daily Menu Scrape
on:
  schedule:
    - cron: '0 10 * * *'  # 5am ET (UTC-5) / 6am ET (UTC-4 DST)
  workflow_dispatch: {}     # manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: python -m scraper.auto_scrape --all-commons --start-date "$(TZ=America/New_York date +%F)" --days 7 --upload-supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Current workflow is active on GitHub and repo secrets are set. Manual run `24877254684` succeeded after uploader-side deduplication by `(date, dining_commons, meal_period, item_name)`.

Scraper should:
1. Fetch today + next 6 days for all 4 commons
2. Parse + normalize using existing `parse_menu.py`
3. Upsert all items to Supabase `menu_items` table
4. Log summary (items per commons per day)
5. Exit 0 on partial success, exit 1 only if ALL commons fail

---

## TDEE Calculation Reference

For auto-calculating targets in onboarding:

```
BMR (Mifflin-St Jeor):
  Male:   10 * weight_kg + 6.25 * height_cm - 5 * age + 5
  Female: 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

Activity multipliers:
  sedentary:    BMR * 1.2
  light:        BMR * 1.375
  moderate:     BMR * 1.55
  active:       BMR * 1.725
  very_active:  BMR * 1.9

TDEE = BMR * multiplier

Goal adjustments:
  lose:     TDEE - 500
  gain:     TDEE + 300
  maintain: TDEE

Macro splits:
  Protein: lose=1.0g/lb, gain=1.0g/lb, maintain=0.8g/lb
  Fat: 25% of calories / 9
  Carbs: remaining calories / 4
```

---

## File Structure (Final)

```
umass-meal-planner/
├── scraper/                          # EXISTING — extend
│   ├── auto_scrape.py                # Add multi-commons support
│   ├── parse_menu.py                 # Reuse as-is
│   ├── upload_to_supabase.py         # NEW — upsert to Supabase
│   └── manual_fallback.py            # Keep as fallback
├── .github/
│   └── workflows/
│       └── scrape.yml                # NEW — daily cron
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql    # NEW — all tables + RLS
│   └── functions/
│       ├── generate-meal-plan/
│       │   └── index.ts              # NEW
│       ├── chat/
│       │   └── index.ts              # NEW
│       └── _shared/
│           ├── supabase.ts           # NEW
│           ├── gemini.ts             # NEW
│           ├── menu.ts               # NEW
│           └── profile.ts            # NEW
├── mobile/                           # NEW — Expo app
│   ├── app.json
│   ├── package.json
│   ├── App.tsx
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts           # Supabase client init
│   │   │   ├── auth.ts               # Google Sign-In helpers
│   │   │   └── tdee.ts               # TDEE/macro calculator
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ProfileContext.tsx
│   │   ├── screens/
│   │   │   ├── SignInScreen.tsx
│   │   │   ├── onboarding/
│   │   │   │   ├── BodyStatsScreen.tsx
│   │   │   │   ├── GoalsScreen.tsx
│   │   │   │   └── PreferencesScreen.tsx
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── components/
│   │   │   ├── MealCard.tsx
│   │   │   ├── MacroBar.tsx
│   │   │   ├── ChatBubble.tsx
│   │   │   └── OnboardingProgress.tsx
│   │   └── types/
│   │       └── index.ts
│   └── assets/
├── PLAN.md
├── AGENTS.md
└── requirements.txt                  # Add: supabase
```

---

## Implementation Order

1. **Supabase project setup** — create project, run migration, enable Google Auth
2. **Scraper extension** — multi-commons + Supabase upload + GitHub Actions
3. **Expo app scaffold** — navigation, auth flow, Supabase client
4. **Onboarding screens** — body stats → goals → preferences → save profile
5. **Edge Functions** — generate-meal-plan + chat
6. **Home screen** — fetch/display meal plan, regenerate button
7. **Chat screen** — message UI + Edge Function integration
8. **Settings screen** — edit profile, sign out
9. **Polish** — error states, loading states, empty states

---

## UI Redesign Workstream - Warm Food App

Checklist:

1. Keep the app light, warm, and food-app-like: cream background, white cards, red primary pills, soft shadows, rounded chips.
2. Cover all current screens: Sign In, Body Stats, Goals, Preferences, Home / Today, Chat, and Settings.
3. Check product fit: no logging, no gamification, no social features, no landing-page/marketing treatment, and no dense health-dashboard chrome.
4. Run `npm run typecheck` in `mobile/`.
5. Open the app in the iOS simulator and compare the implemented UI against saved screenshots.
6. Update this plan and `AGENTS.md` with what was applied and any remaining visual gaps.

Important constraint: older Claude Design output under `docs/design/claude/` is external generated content and now historical reference only. Do not copy its old dark board direction back into the runtime app.

---

## Environment Variables Needed

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | GitHub Actions secrets, Edge Functions (auto), mobile app | Supabase project URL |
| `SUPABASE_ANON_KEY` | Mobile app | Client-side Supabase access |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions secrets | Scraper writes (bypasses RLS) |
| `GEMINI_API_KEY` | Edge Functions secrets | LLM calls |
| `GOOGLE_CLIENT_ID` | Supabase Auth config, mobile app | OAuth |
| `GOOGLE_CLIENT_SECRET` | Supabase Auth config | OAuth |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile/.env | Expo public env var |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile/.env | Expo public env var |

---

## Constraints & Notes

- **Free tier focus**: Supabase free tier = 500MB DB, 50K monthly active users, 500K Edge Function invocations. More than enough.
- **Gemini model**: Use `gemini-flash-latest` for both meal plans and chat unless pinning becomes necessary. Use structured JSON schema responses and `thinkingBudget: 0` for Flash JSON calls.
- **No offline support needed**. App requires internet.
- **Single user focus**. No social features, no sharing, no friends.
- **UMass-only**. No multi-university support needed.
- **Existing code reference**: `planner/llm_planner.py` has working Gemini integration pattern (prompt building, JSON response parsing, rate limiting). Reuse prompt structure in Edge Functions.
- **Deduplication note**: Current `parse_menu.py` deduplicates items across periods. For the mobile app, do NOT deduplicate — same item can appear in lunch and dinner. Remove the `seen_names` dedup logic when writing to Supabase.

---

## Completed History - 2026-04-24

- Supabase project created: `umass-meal-planner` (`thaoylgvgsvbouyirdfg`) in `us-east-1`, API URL `https://thaoylgvgsvbouyirdfg.supabase.co`.
- Initial schema is applied and verified for `menu_items`, `profiles`, `meal_plans`, and `chat_messages`, including RLS for authenticated menu reads and own-row profile/meal/chat access.
- Supabase Edge Functions `generate-meal-plan` and `chat` are deployed with JWT verification enabled. Unauthenticated requests return `401 Missing authorization header`, so endpoints are reachable and protected.
- Edge Functions now use Gemini `gemini-flash-latest` with structured JSON schemas and `thinkingBudget: 0`; this fixed the simulator errors `Gemini returned invalid JSON` and `Gemini response was truncated`.
- Edge Function secrets are configured for Gemini and Supabase runtime access.
- Expo mobile app exists under `mobile/` with React Navigation, Supabase client, secure token storage, Google sign-in, onboarding, Home, Chat, and Settings screens.
- `mobile/.env` is configured locally with the Supabase URL and publishable key and is ignored by git.
- Google Auth is enabled in Supabase. A Google OAuth web client named `UMass Nutrition` was created in Google Cloud project `hare-platform` with the Supabase origin and callback URL configured.
- Supabase auth config was pushed through `npx supabase@latest config push`; `supabase/config.toml` contains Google provider config and the Expo redirect `umassnutrition://auth/callback`.
- Mobile Google sign-in works on the iOS simulator with the UMass Google account. The app gates signed-in sessions to `@umass.edu`.
- Onboarding was completed once in the simulator and a profile row was saved.
- Home no longer crashes on stale/incomplete cached meal plans. `HomeScreen` now guards against missing `meals`/`daily_total`, clears stale state before regeneration, and shows an empty/error state instead of throwing.
- Home Regenerate works end to end in the simulator: the live Edge Function generated a meal plan and the app rendered daily macro summary plus meal cards.
- Chat works end to end in the simulator with today's menu context. Message order is fixed by deterministic client sorting and server-side timestamp separation for user/assistant rows.
- GitHub Actions workflow `Daily Menu Scrape` is active on GitHub. Repo secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Manual workflow run `24877254684` succeeded and uploaded menu rows to Supabase for 2026-04-24 through 2026-04-30. 2026-04-24 was verified at 595 rows.
- Claude Design was rerun from a fresh high-fidelity project, `UMass Dining Board UI`, using Claude Opus 4.7. The generated reference lives in `docs/design/claude/` and covers Sign In, 3 onboarding screens, Home/Today, Chat, Settings, and the Home empty state.
- The mobile UI was ported to the "Campus Menu Board" direction: dark full-height surfaces, UMass maroon for primary actions, dining-common color markers, Home-first recommendations, specific chat prompts, and compact utility settings/onboarding.
- UI copy was tightened after a UX clutter review: removed Home explanation paragraphs, repeated chat context, onboarding subtitles, sign-in dining commons decoration, Settings version text, and target override controls from onboarding; shortened `No preference` to `Any`.
- Post-redesign simulator check passed on iPhone 17 Pro / iOS 26.2: Home rendered the cached meal plan, Chat suggestion chips sent a Gemini-backed request and displayed the answer below the user message, and Settings opened with the updated utility styling.
- `npm run typecheck` passed in `mobile/`.
- DoorDash-style warm redesign pass replaced the dark board UI with cream backgrounds, white rounded cards, DoorDash-like red primary actions, softer secondary pills, and sparse copy across Sign In, onboarding, Home, Chat, and Settings.
- Simulator screenshots were saved in `docs/simulator-screens/doordash-redesign-before/` and `docs/simulator-screens/doordash-redesign-after/` for Home, Chat, and Settings.
- A UX review agent audited the DoorDash adoption for visual clutter. Follow-up fixes removed duplicate Home chrome, renamed `Set` to `Prefs`, made `Try another` secondary, reduced the top macro strip to calories/protein, moved Settings preferences first, converted Settings body fields to feet/inches/pounds, and muted/confirmed Chat clear.
- Settings save now navigates back to Home with a refresh marker so the main recommendation regenerates from the updated preferences instead of showing a stale cached plan.
- `npm run typecheck` and `git diff --check` passed after the warm UI cleanup.
- The `chat` Supabase Edge Function was redeployed with a shorter response prompt: one direct recommendation plus up to two alternates by default, 60 words or fewer unless the student asks for detail.
- Enriched scraper parsing now captures additional UMass Dining fields: calories from fat, saturated fat, trans fat, sugars, cholesterol, healthfulness, and recipe webcode.
- Supabase migration `002_enrich_menu_items.sql` was applied to add those fields to `menu_items`.
- `generate-meal-plan` and `chat` Edge Functions were redeployed after the shared menu formatter started selecting the enriched fields and including station, fiber, sugar, sodium, carbon rating, healthfulness, and dining-hours context in prompts.
- Home meal cards were simplified further: visible item rows now show only food name plus calories/protein, and the previous fat/carbs meal-total footer was removed.
- Tapping a meal item opens a food detail card that fetches the current menu row from Supabase and shows station, serving size, useful detailed nutrition, tags, allergens, carbon rating, and ingredients without cluttering the main card.
- Settings save moved to a compact red top-right navigation action; the large in-body Save button was removed.
- README now includes the current simulator screenshots for Home, Food Details, Chat, and Settings.
- Simulator check passed for the minimal meal cards, tap-open food detail card, and Settings top-right Save placement on iPhone 17 Pro / iOS 26.2.
