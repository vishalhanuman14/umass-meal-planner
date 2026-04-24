import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { isUmassEmail } from "@/lib/auth";
import { isSupabaseConfigured, missingSupabaseEnvMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    const email = typeof claims?.email === "string" ? claims.email : null;

    if (userId && isUmassEmail(email)) {
      redirect("/home");
    }
  }

  return (
    <main className="page-shell stack-lg">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">U</div>
          <div className="brand-copy">
            <span className="brand-title">UMass Nutrition</span>
            <span className="brand-subtitle">Web setup branch</span>
          </div>
        </div>
        <div className="pill-row">
          <span className="pill">
            <span className="pill-dot" />
            Same Supabase backend
          </span>
          <span className="pill pill-accent">Google + Gemini ready</span>
        </div>
      </header>

      <section className="card card-warm card-pad hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Web App Setup</span>
          <h1 className="hero-title">Pick what to eat without opening the full menu.</h1>
          <p className="muted">
            This web app sits beside the Expo mobile app, reuses the same Supabase Auth flow, and reads the same
            cached meal plans from the existing backend. It is intentionally small: sign in, load today&apos;s plan,
            regenerate when needed, and stay out of the way.
          </p>
          <div className="cta-row">
            <GoogleSignInButton />
          </div>
          {!isSupabaseConfigured ? (
            <p className="status-note status-note-error">{missingSupabaseEnvMessage}</p>
          ) : null}
        </div>

        <div className="stack-md">
          <div className="card card-pad">
            <span className="eyebrow">What&apos;s Included</span>
            <div className="summary-list" style={{ marginTop: 16 }}>
              <div className="summary-row">
                <div className="summary-index">1</div>
                <div className="summary-text">
                  <span className="summary-title">Next.js 16 App Router</span>
                  <p className="muted">Separate `web/` app, no repo-wide workspace refactor, no Expo web compromise.</p>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-index">2</div>
                <div className="summary-text">
                  <span className="summary-title">Supabase SSR Auth</span>
                  <p className="muted">Google sign-in, cookie-backed sessions, PKCE callback handling, `@umass.edu` gate.</p>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-index">3</div>
                <div className="summary-text">
                  <span className="summary-title">Real meal-plan home screen</span>
                  <p className="muted">Loads the cached daily plan and can call the existing `generate-meal-plan` Edge Function.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <span className="eyebrow">Local OAuth Callback</span>
            <p className="muted" style={{ marginTop: 12 }}>
              Add <code>http://localhost:3000/auth/callback</code> to the Supabase redirect allow list for local web
              sign-in. The repo config now includes it for local setup.
            </p>
          </div>
        </div>
      </section>

      <section className="split-grid">
        <div className="card card-pad stack-sm">
          <span className="section-title">Why This Stack</span>
          <p className="muted">
            Next.js fits the web shape better than stretching the mobile Expo app onto desktop. It gives us SSR auth,
            clean route handlers for OAuth, and a small web-specific surface while keeping the backend fully shared.
          </p>
        </div>

        <div className="card card-pad stack-sm">
          <span className="section-title">Scope On Purpose</span>
          <p className="muted">
            This first pass keeps onboarding and chat on mobile. The web app focuses on the daily utility loop:
            authenticate, view today&apos;s recommendation, and regenerate when the menu changes.
          </p>
        </div>
      </section>
    </main>
  );
}
