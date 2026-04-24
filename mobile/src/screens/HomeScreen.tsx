import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MealCard from "../components/MealCard";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { configuredSupabaseAnonKey, configuredSupabaseUrl, supabase } from "../lib/supabase";
import { colors, getDiningCommon, shadows, sortMealPeriod, titleCase } from "../theme";
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

function greetingForTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name?: string | null, email?: string | null) {
  const cleaned = name?.trim();
  if (cleaned) return cleaned.split(/\s+/)[0];
  return email?.split("@")[0] ?? "there";
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

export default function HomeScreen({ navigation, route }: HomeProps) {
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

  useEffect(() => {
    if (!route.params?.refreshPlanAt) return;

    void generatePlan(true).finally(() => navigation.setParams({ refreshPlanAt: undefined }));
  }, [generatePlan, navigation, route.params?.refreshPlanAt]);

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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Chat")}>
                <Text style={styles.iconButtonText}>Ask</Text>
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Settings")}>
                <Text style={styles.iconButtonText}>Prefs</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.greeting}>
            {greetingForTime()}, {firstName(profile?.name, profile?.email)}
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {heroMeal ? <BestMove period={heroMeal[0]} meal={heroMeal[1]} generating={generating} onRegenerate={() => generatePlan(true)} /> : null}

        {totals ? <DailyFit totals={totals} /> : null}

        {mealEntries.length
          ? mealEntries.map(([period, meal]) => <MealCard key={period} period={period} meal={meal} />)
          : !loading && (
              <View style={styles.centerCard}>
                <Text style={styles.message}>
                  {message ?? "Menu not available yet."}
                </Text>
                <Pressable style={styles.emptyAction} onPress={() => generatePlan(true)} disabled={generating}>
                  {generating ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.emptyActionText}>Try again</Text>}
                </Pressable>
              </View>
            )}

      </ScrollView>
    </SafeAreaView>
  );
}

function BestMove({
  period,
  meal,
  generating,
  onRegenerate
}: {
  period: string;
  meal: MealPlanMeal;
  generating: boolean;
  onRegenerate: () => void;
}) {
  const common = getDiningCommon(meal.dining_commons);
  const primaryItem = meal.items[0]?.item ?? titleCase(period);
  const supportingItems = meal.items.slice(1, 3).map((item) => item.item).join(", ");

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroLabel}>Best right now</Text>
        </View>
        <View style={styles.commonPill}>
          <View style={[styles.commonDot, { backgroundColor: common.color }]} />
          <Text style={styles.commonPillText}>{common.label}</Text>
        </View>
      </View>
      <Text style={styles.heroTitle}>{primaryItem}</Text>
      {supportingItems ? <Text style={styles.heroSupport}>with {supportingItems}</Text> : null}
      <View style={styles.heroBottom}>
        <Text style={styles.heroMeta}>{titleCase(period)} / {formatMealMacro(meal)}</Text>
        <Pressable style={styles.heroButton} onPress={onRegenerate} disabled={generating}>
          {generating ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.heroButtonText}>Try another</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function DailyFit({ totals }: { totals: MealPlan["daily_total"] }) {
  return (
    <View style={styles.fitCard}>
      <View style={styles.fitStats}>
        <Stat label="Plan total" value={`${Math.round(totals.calories)} cal`} />
        <Stat label="Protein" value={`${Math.round(totals.protein_g)}g`} />
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 28, gap: 18 },
  header: { gap: 10 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "center" },
  date: { color: colors.quiet, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  greeting: { color: colors.text, fontSize: 26, fontWeight: "900", marginTop: 3, lineHeight: 32 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    ...shadows.soft
  },
  iconButtonText: { color: colors.text, fontWeight: "900", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  centerCard: {
    ...shadows.card,
    minHeight: 128,
    gap: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.surface
  },
  message: { color: colors.muted, textAlign: "center", lineHeight: 20 },
  hero: { ...shadows.card, gap: 14, padding: 20, borderRadius: 28, backgroundColor: colors.surface },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceWarm },
  heroLabel: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  commonPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceWarm },
  commonDot: { width: 7, height: 7, borderRadius: 7 },
  commonPillText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  heroTitle: { color: colors.text, fontSize: 25, fontWeight: "900", lineHeight: 31 },
  heroSupport: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroMeta: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  heroButton: { minHeight: 42, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.surfaceWarm },
  heroButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  fitCard: { padding: 16, borderRadius: 22, backgroundColor: colors.surfaceWarm },
  fitStats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 3 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  statLabel: { color: colors.quiet, fontSize: 12 },
  emptyAction: { marginTop: 4, minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primary },
  emptyActionText: { color: colors.onPrimary, fontWeight: "900" }
});
