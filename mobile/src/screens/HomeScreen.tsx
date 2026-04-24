import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import MacroBar from "../components/MacroBar";
import MealCard from "../components/MealCard";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { configuredSupabaseAnonKey, configuredSupabaseUrl, supabase } from "../lib/supabase";
import type { HomeProps, MealPlan, MealPlanRow } from "../types";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isMealMap(value: MealPlan["meals"] | undefined): value is MealPlan["meals"] {
  return Boolean(value && typeof value === "object");
}

function isCompletePlan(value: MealPlan | null): value is MealPlan {
  return Boolean(value?.daily_total && isMealMap(value.meals));
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8bd3ff" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>
          <Text style={styles.greeting}>Hi{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.smallButton} onPress={() => navigation.navigate("Chat")}>
            <Text style={styles.smallButtonText}>Chat</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => navigation.navigate("Settings")}>
            <Text style={styles.smallButtonText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator color="#8bd3ff" />
        </View>
      ) : null}

      {totals ? (
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>Daily summary</Text>
          <MacroBar label="Calories" value={totals.calories} target={profile?.calorie_target} unit="cal" />
          <MacroBar label="Protein" value={totals.protein_g} target={profile?.protein_target_g} unit="g" />
          <MacroBar label="Fat" value={totals.fat_g} target={profile?.fat_target_g} unit="g" />
          <MacroBar label="Carbs" value={totals.carbs_g} target={profile?.carbs_target_g} unit="g" />
        </View>
      ) : null}

      {meals
        ? Object.entries(meals).map(([period, meal]) => <MealCard key={period} period={period} meal={meal} />)
        : !loading && (
            <View style={styles.centerCard}>
              <Text style={styles.message}>
                {message ?? "Menu not available yet."}
              </Text>
            </View>
          )}

      {plan?.reasoning ? <Text style={styles.reasoning}>{plan.reasoning}</Text> : null}

      <Pressable style={styles.primaryButton} onPress={() => generatePlan(true)} disabled={generating}>
        {generating ? <ActivityIndicator color="#071018" /> : <Text style={styles.primaryText}>Regenerate</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f14" },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  date: { color: "#aeb8c6", fontSize: 14 },
  greeting: { color: "#f4f7fb", fontSize: 30, fontWeight: "800", marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 8 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: "#111821", borderWidth: 1, borderColor: "#243041" },
  smallButtonText: { color: "#f4f7fb", fontWeight: "700" },
  summary: { gap: 12, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: "#243041", backgroundColor: "#111821" },
  sectionTitle: { color: "#f4f7fb", fontSize: 18, fontWeight: "800" },
  centerCard: { minHeight: 120, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#243041", backgroundColor: "#111821" },
  message: { color: "#aeb8c6", textAlign: "center" },
  reasoning: { color: "#aeb8c6", lineHeight: 20 },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#8bd3ff" },
  primaryText: { color: "#071018", fontWeight: "800", fontSize: 16 }
});
