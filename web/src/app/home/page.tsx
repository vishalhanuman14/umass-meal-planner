import { redirect } from "next/navigation";

import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { SignOutButton } from "@/components/SignOutButton";
import { firstName, isUmassEmail } from "@/lib/auth";
import {
  chooseHeroMeal,
  formatLongDateEastern,
  formatMealMacro,
  formatPreferredDiningCommons,
  formatTimeEastern,
  getDiningCommon,
  greetingForEasternTime,
  isCompletePlan,
  sortMealPeriod,
  titleCase,
  todayIsoDateEastern,
} from "@/lib/meal-plan";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { MealPlanMeal, MealPlanRow, ProfileSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  if (!userId || !isUmassEmail(email)) {
    redirect("/");
  }

  const today = todayIsoDateEastern();
  const [{ data: profile }, { data: planRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, email, onboarding_completed, calorie_target, protein_target_g, preferred_dining_commons")
      .eq("id", userId)
      .maybeSingle<ProfileSummary>(),
    supabase
      .from("meal_plans")
      .select("plan_json, generated_at")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle<MealPlanRow>(),
  ]);

  const plan = isCompletePlan(planRow?.plan_json) ? planRow.plan_json : null;
  const mealEntries = plan
    ? (Object.entries(plan.meals).sort(sortMealPeriod) as [string, MealPlanMeal][])
    : [];
  const heroMeal = chooseHeroMeal(mealEntries);
  const displayName = firstName(profile?.name, profile?.email ?? email);
  const needsOnboarding = !profile?.onboarding_completed;
  const preferredCommons = formatPreferredDiningCommons(profile?.preferred_dining_commons);

  return (
    <main className="page-shell stack-lg">
      <header className="app-header">
        <div className="app-title">
          <span className="quiet">{formatLongDateEastern()}</span>
          <h1>
            {greetingForEasternTime()}, {displayName}
          </h1>
          <p className="muted">Today&apos;s dining plan is cached by default. Regenerate only when you want a new take.</p>
        </div>
        <div className="app-actions">
          <GeneratePlanButton label={plan ? "Try another" : "Get today's plan"} regenerate={Boolean(plan)} />
          <SignOutButton />
        </div>
      </header>

      {needsOnboarding ? (
        <section className="card card-pad card-warm stack-sm">
          <span className="eyebrow">Onboarding Needed</span>
          <h2 className="section-title">Finish your profile in the mobile app first.</h2>
          <p className="muted">
            The meal planner needs your goal, dietary restrictions, allergens, and preferred dining commons before it
            can generate a plan. This web setup focuses on the daily plan view after that profile exists.
          </p>
        </section>
      ) : null}

      {heroMeal && !needsOnboarding ? (
        <section className="card card-pad hero-panel">
          <div className="pill-row">
            <span className="pill pill-accent">Best right now</span>
            <span className="pill">
              <span
                className="pill-dot"
                style={{ backgroundColor: getDiningCommon(heroMeal[1].dining_commons).color }}
              />
              {getDiningCommon(heroMeal[1].dining_commons).label}
            </span>
            {planRow?.generated_at ? <span className="pill">Updated {formatTimeEastern(planRow.generated_at)}</span> : null}
          </div>
          <div className="stack-sm">
            <h2>{heroMeal[1].items[0]?.item ?? titleCase(heroMeal[0])}</h2>
            {heroMeal[1].items.length > 1 ? (
              <p className="hero-support">
                with {heroMeal[1].items.slice(1, 3).map((item) => item.item).join(", ")}
              </p>
            ) : null}
            <p className="hero-meta">
              {titleCase(heroMeal[0])} / {formatMealMacro(heroMeal[1])}
            </p>
          </div>
        </section>
      ) : null}

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{plan ? `${Math.round(plan.daily_total.calories)} cal` : "No plan yet"}</div>
          <div className="stat-label">Today&apos;s total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {plan ? `${Math.round(plan.daily_total.protein_g)}g` : profile?.protein_target_g ? `${Math.round(profile.protein_target_g)}g` : "Set in app"}
          </div>
          <div className="stat-label">{plan ? "Plan protein" : "Protein target"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{preferredCommons}</div>
          <div className="stat-label">Preferred commons</div>
        </div>
      </section>

      {plan && !needsOnboarding ? (
        <section className="stack-md">
          <div className="stack-sm">
            <span className="section-title">Meals</span>
            <p className="muted">Only the essentials stay visible here. The mobile app remains the fuller experience for onboarding and chat.</p>
          </div>

          <div className="meal-grid">
            {mealEntries.map(([period, meal]) => {
              const commons = getDiningCommon(meal.dining_commons);

              return (
                <article key={period} className="meal-card">
                  <div className="stack-sm">
                    <div className="pill-row">
                      <span className="pill pill-accent">{titleCase(period)}</span>
                      <span className="pill">
                        <span className="pill-dot" style={{ backgroundColor: commons.color }} />
                        {commons.label}
                      </span>
                    </div>
                    <h3>{formatMealMacro(meal)}</h3>
                  </div>

                  <div className="meal-items">
                    {meal.items.map((item) => (
                      <div key={`${period}-${item.item}`} className="meal-item">
                        <strong>{item.item}</strong>
                        <span>
                          {Math.round(item.calories)} cal / {Math.round(item.protein_g)}g protein
                          {item.station ? ` / ${item.station}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!plan && !needsOnboarding ? (
        <section className="card card-pad empty-state">
          <span className="eyebrow">No Cached Plan</span>
          <h2 className="section-title">Generate today&apos;s recommendation when you&apos;re ready.</h2>
          <p className="muted">
            The web app reads the same cached plan as mobile. If today&apos;s menu has already been scraped, generation
            will create or replace your meal plan for {formatLongDateEastern()}.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <GeneratePlanButton label="Get today's plan" />
          </div>
        </section>
      ) : null}
    </main>
  );
}
