import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import MealCard from "../components/MealCard";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { configuredSupabaseAnonKey, configuredSupabaseUrl, supabase } from "../lib/supabase";
import { colors, getDiningCommon, sortMealPeriod, titleCase } from "../theme";
import type { HomeProps, MealPlan, MealPlanMeal, MealPlanRow } from "../types";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isMealMap(value: MealPlan["meals"] | undefined): value is MealPlan["meals"] {
  return Boolean(value && typeof value === "object");
}

function isCompletePlan(value: MealPlan | null): value is MealPlan {
  return Boolean(value?.daily_total && isMealMap(value.meals));
}

function getCurrentPeriod() {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late_night";
}

function chooseHeroMeal(entries: [string, MealPlanMeal][]) {
  const current = getCurrentPeriod();
  return entries.find(([period]) => period === current) ?? entries.find(([period]) => period === "lunch") ?? entries[0] ?? null;
}

function formatMealMacro(meal: MealPlanMeal) {
  return `${Math.round(meal.meal_total.calories)} cal / ${Math.round(meal.meal_total.protein_g)}g protein`;
}

async function invokeGenerateMealPlan(regenerate: boolean) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.access_token) {
    throw sessionError ?? new Error("Not signed in.");
  }

  const response = await fetch(`${configuredSupabaseUrl}/functions/v1/generate-meal-plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: configuredSupabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ regenerate })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Could not generate today's meal plan.";
    throw new Error(message);
  }

  return payload;
}

export default function HomeScreen({ navigation }: HomeProps) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPlan = useCallback(
    async (generateIfMissing: boolean) => {
      if (!session?.user) return;

      setMessage(null);
      const date = todayIsoDate();
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("date", date)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const cachedPlan = (data as MealPlanRow).plan_json;
        setPlan(isCompletePlan(cachedPlan) ? cachedPlan : null);
        if (!isCompletePlan(cachedPlan)) {
          setMessage("Saved meal plan is incomplete. Regenerate it.");
        }
        return;
      }

      if (!generateIfMissing) {
        setMessage("No meal plan yet.");
        return;
      }

      await generatePlan(false);
    },
    [session]
  );

  const generatePlan = useCallback(async (regenerate = false) => {
    setGenerating(true);
    setMessage(null);
    setPlan(null);
    try {
      const data = await invokeGenerateMealPlan(regenerate);
      const nextPlan = (data?.plan ?? data) as MealPlan | null;
      if (!isCompletePlan(nextPlan)) {
        setMessage("Menu not available yet.");
        return;
      }
      setPlan(nextPlan);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not generate today's meal plan.";
      setMessage(text.includes("menu") ? "Menu not available yet." : text);
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPlan(true)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load today's plan."))
      .finally(() => setLoading(false));
  }, [loadPlan]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadPlan(false);
    } catch (error) {
      Alert.alert("Refresh failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  const meals = plan?.meals ?? null;
  const totals = plan?.daily_total;
  const mealEntries = meals ? (Object.entries(meals).sort(sortMealPeriod) as [string, MealPlanMeal][]) : [];
  const heroMeal = chooseHeroMeal(mealEntries);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>
          <Text style={styles.greeting}>What to eat.</Text>
          {profile?.name ? <Text style={styles.subGreeting}>For {profile.name.split(" ")[0]}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.smallButton} onPress={() => generatePlan(true)} disabled={generating}>
            <Text style={styles.smallButtonText}>{generating ? "..." : "Regen"}</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Chat")}>
            <Text style={styles.smallButtonText}>Ask</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Settings")}>
            <Text style={styles.smallButtonText}>Set</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator color={colors.amber} />
          <Text style={styles.message}>Checking today's menu board.</Text>
        </View>
      ) : null}

      {heroMeal ? <BestMove period={heroMeal[0]} meal={heroMeal[1]} /> : null}

      {totals ? <DailyFit totals={totals} profile={profile} /> : null}

      {mealEntries.length
        ? mealEntries.map(([period, meal]) => <MealCard key={period} period={period} meal={meal} />)
        : !loading && (
            <View style={styles.centerCard}>
              <Text style={styles.message}>
                {message ?? "Menu not available yet."}
              </Text>
              <Pressable style={styles.emptyAction} onPress={() => generatePlan(true)} disabled={generating}>
                {generating ? <ActivityIndicator color={colors.text} /> : <Text style={styles.emptyActionText}>Try again</Text>}
              </Pressable>
            </View>
          )}

      {plan?.reasoning ? <Text style={styles.reasoning}>{plan.reasoning}</Text> : null}

    </ScrollView>
  );
}

function BestMove({ period, meal }: { period: string; meal: MealPlanMeal }) {
  const common = getDiningCommon(meal.dining_commons);
  const primaryItem = meal.items[0]?.item ?? titleCase(period);
  const supportingItems = meal.items.slice(1, 3).map((item) => item.item).join(", ");

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>Best move right now</Text>
        <View style={[styles.commonPill, { borderColor: common.color }]}>
          <View style={[styles.commonDot, { backgroundColor: common.color }]} />
          <Text style={styles.commonPillText}>{common.label}</Text>
        </View>
      </View>
      <Text style={styles.heroTitle}>{primaryItem}</Text>
      {supportingItems ? <Text style={styles.heroSupport}>with {supportingItems}</Text> : null}
      <Text style={styles.heroMeta}>{titleCase(period)} / {formatMealMacro(meal)}</Text>
      <Text style={styles.heroReason}>Good fit from today's menu without turning this into food tracking.</Text>
    </View>
  );
}

function DailyFit({
  totals,
  profile
}: {
  totals: MealPlan["daily_total"];
  profile: ReturnType<typeof useProfile>["profile"];
}) {
  return (
    <View style={styles.fitCard}>
      <Text style={styles.sectionTitle}>Today's fit</Text>
      <View style={styles.fitStats}>
        <Stat label="Calories" value={`${Math.round(totals.calories)}${profile?.calorie_target ? ` / ${Math.round(profile.calorie_target)}` : ""}`} />
        <Stat label="Protein" value={`${Math.round(totals.protein_g)}g${profile?.protein_target_g ? ` / ${Math.round(profile.protein_target_g)}g` : ""}`} />
        <Stat label="Carbs" value={`${Math.round(totals.carbs_g)}g`} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  date: { color: colors.quiet, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  greeting: { color: colors.text, fontSize: 28, fontWeight: "800", marginTop: 5 },
  subGreeting: { color: colors.muted, fontSize: 14, marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 8 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.maroon, borderWidth: 1, borderColor: colors.maroon },
  iconButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  smallButtonText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  centerCard: { minHeight: 128, gap: 12, padding: 18, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  message: { color: colors.muted, textAlign: "center", lineHeight: 20 },
  hero: { gap: 10, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroLabel: { color: colors.amber, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  commonPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: colors.surface },
  commonDot: { width: 7, height: 7, borderRadius: 7 },
  commonPillText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: "900", lineHeight: 29 },
  heroSupport: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  heroMeta: { color: colors.text, fontSize: 14, fontWeight: "800" },
  heroReason: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fitCard: { gap: 12, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  fitStats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 3 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  statLabel: { color: colors.quiet, fontSize: 12 },
  emptyAction: { marginTop: 4, minHeight: 42, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.maroon },
  emptyActionText: { color: colors.text, fontWeight: "800" },
  reasoning: { color: colors.muted, lineHeight: 20, paddingHorizontal: 2 }
});
