# Agent Context — UMass Meal Planner Mobile App

## Project Identity

**App name**: TBD (working title: "UMass Nutrition" or "UMass Eats")
**Owner**: Vishnu Vardhan (vbheemreddy@umass.edu) — UMass Amherst student
**Purpose**: Personalized daily meal recommendations from UMass dining halls, powered by Gemini LLM

## Design Philosophy

- **Simple and to the point. No fluff.** This is a utility app, not a social platform.
- No gamification, no streaks, no badges, no leaderboards.
- No tracking — user does NOT log what they ate. App recommends only.
- Minimal screens. Every screen has one clear purpose.
- Dark mode default. Clean, modern, minimal color palette.
- Fast. Meal plan should load instantly from cache; regeneration is the only slow path.

## User Profile

The developer (Vishnu) is a UMass student who:
- Previously built a meal planner CLI tool (this repo) that scrapes Franklin dining and uses Gemini to plan meals
- Has a Next.js app (hare) using NextAuth + Google Sign-In with `.edu` email gate
- Prefers practical, working code over over-engineered abstractions
- Uses Supabase, React Native/Expo, and Gemini
- Targets free tier for all services

## Codebase Context

### Existing Code (reuse/reference)

| File | What It Does | How to Reuse |
|------|-------------|--------------|
| `scraper/auto_scrape.py` | Scrapes UMass dining AJAX API, parses HTML, extracts nutrition data | Extend to all 4 dining commons (tid 1-4). Core parsing logic is solid. |
| `scraper/parse_menu.py` | Normalizes raw scraped items into clean schema | Reuse `normalize_item()` as-is. **Remove dedup** (`seen_names` set) when writing to Supabase — items can appear in multiple periods. |
| `planner/llm_planner.py` | Builds rich Gemini prompts, calls API, parses JSON response | Reference for Edge Function prompt structure. Shows working `google-genai` pattern. |
| `planner/optimizer.py` | Greedy macro optimizer (backup to LLM) | Not needed in mobile app. LLM-only. |
| `config.yaml` | User config (targets, preferences, schedule) | Shows what user profile fields matter. Mobile app stores this in Supabase `profiles` table instead. |

### Current Setup State

- Supabase organization: `wyd` (`liylmjtljhmmmgboutuf`), Free plan.
- Supabase MCP reported new project creation cost as `$0/month` for this org on 2026-04-24.
- Existing projects visible in the org: `agentwatch-mvp` (paused, AWS us-west-1), `hare` (active, AWS us-east-1 NANO), and `test` (paused, AWS us-west-2).
- Supabase project for this app: `umass-meal-planner` (`thaoylgvgsvbouyirdfg`), region `us-east-1`, API URL `https://thaoylgvgsvbouyirdfg.supabase.co`.
- Initial schema migration was applied through the dashboard SQL editor on 2026-04-24. Verified tables: `menu_items`, `profiles`, `meal_plans`, `chat_messages`; verified RLS policies for authenticated menu reads and own-row profile/meal/chat access.
- Local environment currently does not have the Supabase CLI installed globally (`supabase` command not found), but `npx supabase@latest` works and has been used for linked project config/function deployment.
- The Supabase MCP in this environment can read project/org metadata and apply migrations to existing projects, but project creation returned `Cannot create a project in read-only mode`; use the Supabase dashboard for creation if that persists.
- Supabase MCP function deployment returned `Cannot deploy an edge function in read-only mode`, so Edge Functions were deployed via `npx supabase@latest` after CLI login on 2026-04-24.
- Deployed Edge Functions: `generate-meal-plan` and `chat`, both active with `verify_jwt=true`. Unauthenticated smoke tests return `401 Missing authorization header`, which confirms the endpoints are reachable and protected.
- Local Supabase config exists at `supabase/config.toml`. It includes Google Auth config using env placeholders, `site_url = "https://thaoylgvgsvbouyirdfg.supabase.co"`, and `additional_redirect_urls = ["umassnutrition://auth/callback"]`.
- Local mobile env file `mobile/.env` has been created with `EXPO_PUBLIC_SUPABASE_URL` and the project publishable key. It is ignored by `mobile/.gitignore`.
- Edge Function runtime secrets are configured, including `GEMINI_API_KEY` and default Supabase secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`). Scraper/GitHub Actions still need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
- Google Auth is now enabled in Supabase for project `thaoylgvgsvbouyirdfg`. A separate Google OAuth web client named `UMass Nutrition` was created in Google Cloud project `hare-platform` with origin `https://thaoylgvgsvbouyirdfg.supabase.co` and callback `https://thaoylgvgsvbouyirdfg.supabase.co/auth/v1/callback`. Do not print or commit the OAuth client secret.
- Mobile Google Sign-In was fixed after the simulator showed `Google sign-in completed without an auth code`: the Supabase client uses PKCE (`flowType: "pkce"`), and the callback parser handles both query params and hash params before exchanging or setting the session.
- Simulator E2E check on 2026-04-24: Expo launched on iPhone 17 Pro / iOS 26.2, Google sign-in with the UMass account succeeded, onboarding saved a profile, and Home loaded.
- Home crash fixed after onboarding: a stale/incomplete cached `meal_plans.plan_json` caused `Cannot convert undefined value to object` in `HomeScreen`. Home now guards against incomplete cached plans, clears stale state before regeneration, and shows an error/empty state instead of crashing.
- Intended scheduled automation is the GitHub Actions workflow `.github/workflows/scrape.yml`: run the Python scraper daily, upload menu rows to Supabase with repo secrets, then app/Edge Functions read those rows. Do not replace this with a scheduled Supabase Edge Function unless the scraper is rewritten for Deno.
- `.github/workflows/scrape.yml` is structurally correct locally, but GitHub currently reports zero workflows for `vishalhanuman14/umass-meal-planner`; commit and push the workflow before expecting it to run.
- GitHub currently reports zero repo Actions secrets; add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` before manually running or relying on the scrape workflow.
- Remaining Home/meal-plan E2E work: diagnose why the current cached/generated plan is incomplete or null, inspect/clean the stale `meal_plans` row, and confirm today's `menu_items` are seeded/uploaded. If no menu rows exist for today, the expected state is `Menu not available yet`.
- Do not commit Supabase database passwords, service role keys, anon keys, Google OAuth secrets, or Gemini API keys. Use dashboard/project secrets, GitHub Actions secrets, and local `.env` files only.

### Key Technical Details

**UMass Dining API**:
- Endpoint: `https://umassdining.com/foodpro-menu-ajax?tid={ID}&date={MM%2FDD%2FYYYY}`
- Returns: `{ "period": { "Station": "<html>" } }`
- HTML contains `<a>` tags with `data-*` attributes (dish-name, calories, protein, fat, carbs, fiber, sodium, allergens, dietary tags, ingredients, carbon rating, serving size)
- No auth required. Simple GET with XMLHttpRequest headers.
- Rate limiting: be polite, 1-2 second delay between requests.

**Dining Commons IDs** (tid parameter):
- Worcester = 1, Franklin = 2, Hampshire = 3, Berkshire = 4

**Meal periods returned by API**: breakfast, lunch, dinner, late night, grabngo (varies by commons and day)

**Google Auth pattern from hare project** (`/Users/vishnuvardhan/Code/hare/src/lib/auth.ts`):
- Uses Google OAuth provider
- Gates sign-in to `.edu` emails
- For this project: gate to `@umass.edu` specifically
- Use Supabase Auth (not NextAuth) since this is React Native

## Critical Implementation Notes

### Scraper
- HTTP fetch works reliably. Playwright fallback exists but rarely needed.
- The `data-ingredient-list` attribute exists on items but is NOT currently scraped. Add it — useful for allergen/dietary filtering.
- Scraper currently saves to local JSON files. New version must write to Supabase instead (or in addition to).
- `normalize_menu()` in `parse_menu.py` deduplicates items across periods using a `seen_names` set. **This must be disabled for Supabase** — the same item (e.g., "White Rice") legitimately appears in both lunch and dinner.

### Edge Functions
- Supabase Edge Functions run on Deno, not Node.js. Use Deno-compatible imports.
- Gemini SDK: use `@google/generative-ai` npm package (works in Deno via npm: specifier) or direct REST API calls.
- Always use `gemini-2.5-flash` model — balances speed, cost, and quality.
- Set `response_mime_type: "application/json"` in Gemini config for structured output (see `llm_planner.py` line 221 for example).
- Edge Functions must authenticate the calling user via Supabase JWT — extract user_id from the auth header, don't trust client-sent user_id.

### Mobile App
- Use `expo-secure-store` for storing Supabase auth tokens (not AsyncStorage — not secure).
- Supabase JS client works in React Native with `@supabase/supabase-js`.
- Google Sign-In in Expo: use `expo-auth-session` with Supabase's OAuth flow, NOT `@react-native-google-signin`.
- Navigation: `@react-navigation/native-stack` (not Expo Router — simpler for this app size).
- State: React Context only. No Redux, no Zustand. Two contexts: AuthContext + ProfileContext.
- No custom fonts. System fonts only.

### Meal Plan Caching
- Generate once per day per user. Cache in `meal_plans` table.
- On HomeScreen load: check if plan exists for today → if yes, use it → if no, call Edge Function.
- "Regenerate" button: calls Edge Function again, overwrites today's plan (upsert on user_id + date).
- If menu_items for today don't exist yet (scraper hasn't run), show "Menu not available yet" state.

### Chat
- Persist chat history in `chat_messages` table.
- Load last 50 messages on ChatScreen open.
- Send last 20 messages as context to Gemini (to stay within token limits).
- System prompt includes: user profile + today's full menu. This is injected server-side in the Edge Function, not sent from client.
- Chat is NOT meal-plan-aware — it doesn't know about the generated plan. It knows the menu and the user's profile. This keeps it simple.

## Things to NOT Do

- Don't add a food logging/tracking feature. This is recommendation-only.
- Don't add user-to-user features (friends, sharing, social).
- Don't add push notifications (yet).
- Don't add offline support or local caching beyond what Supabase JS does automatically.
- Don't add animations or transitions beyond React Navigation defaults.
- Don't use Expo Router — use React Navigation directly.
- Don't over-componentize. A screen with 3 sections doesn't need 3 separate component files.
- Don't add error boundaries around every component. One at the app root is enough.
- Don't create wrapper abstractions around Supabase client calls. Use the client directly.
- Don't mock the Supabase or Gemini calls in tests. Integration tests or none.

## External References

- UMass Dining website: `https://umassdining.com/locations-menus`
- Supabase Docs (Edge Functions): `https://supabase.com/docs/guides/functions`
- Supabase Auth (Google): `https://supabase.com/docs/guides/auth/social-login/auth-google`
- Expo Auth Session: `https://docs.expo.dev/versions/latest/sdk/auth-session/`
- Google Gemini API: `https://ai.google.dev/gemini-api/docs`
- Hare project (auth reference): `/Users/vishnuvardhan/Code/hare/src/lib/auth.ts`
