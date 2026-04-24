# UMass Nutrition Web

This is the web companion app for the UMass Meal Planner project. It lives in `web/` as a separate Next.js app so we can keep the mobile Expo app intact while adding a browser-friendly surface on top of the same Supabase backend.

## Stack

- Next.js 16 App Router
- React 19
- Supabase SSR Auth with Google OAuth
- Plain CSS with warm system-font styling
- Existing Supabase tables and Edge Functions from this repo

## What It Does

- Signs users in with Supabase Google OAuth
- Restricts access to `@umass.edu` accounts
- Loads today’s cached meal plan from `meal_plans`
- Calls the existing `generate-meal-plan` Edge Function when the user wants a fresh plan
- Reuses the same `profiles` onboarding data created by mobile

## Environment

Create `web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://thaoylgvgsvbouyirdfg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

If you already have a Supabase publishable key, you can use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of the anon key.

For local Google OAuth, make sure Supabase Auth allows:

```text
http://localhost:3000/auth/callback
```

## Local Development

Install dependencies:

```bash
cd web
npm install
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
cd web
npm run lint
npm run typecheck
npm run build
```

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
