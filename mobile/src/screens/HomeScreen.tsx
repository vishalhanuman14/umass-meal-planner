import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MealCard, { FoodDetailModal } from "../components/MealCard";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { configuredSupabaseAnonKey, configuredSupabaseUrl, supabase } from "../lib/supabase";
import { colors, getDiningCommon, shadows, sortMealPeriod, titleCase } from "../theme";
import type { DiningCommonsMetadata, DiningHour, HomeProps, MealPlan, MealPlanItem, MealPlanMeal, MealPlanRow } from "../types";

function todayIsoDate() {
  return easternDateString();
}

function easternDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isMealMap(value: MealPlan["meals"] | undefined): value is MealPlan["meals"] {
  return Boolean(value && typeof value === "object");
}

function isCompletePlan(value: MealPlan | null): value is MealPlan {
  return Boolean(value?.daily_total && isMealMap(value.meals));
}

function getCurrentPeriod() {
  const hour = easternNow().minutesOfDay / 60;
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late_night";
}

function chooseHeroMeal(entries: [string, MealPlanMeal][]) {
  const current = getCurrentPeriod();
  const fallbackByPeriod: Record<string, string[]> = {
    breakfast: ["breakfast", "lunch", "dinner"],
    lunch: ["lunch", "dinner", "breakfast"],
    dinner: ["dinner", "lunch", "breakfast"],
    late_night: ["dinner", "lunch", "breakfast"]
  };
  const fallback = fallbackByPeriod[current] ?? ["lunch", "dinner", "breakfast"];
  for (const period of fallback) {
    const match = entries.find(([entryPeriod]) => entryPeriod === period);
    if (match) return match;
  }
  return entries[0] ?? null;
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

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function easternNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday").toLowerCase();
  const hour = Number(value("hour") || 0);
  const minute = Number(value("minute") || 0);
  return { weekday, minutesOfDay: hour * 60 + minute };
}

function previousWeekday(day: string) {
  const index = WEEKDAYS.indexOf(day);
  return WEEKDAYS[(index + 6) % 7] ?? day;
}

function hourAppliesToday(hour: DiningHour, weekday: string, minutesOfDay: number) {
  const days = hour.days_of_week ?? [];
  const open = typeof hour.open_minutes === "number" ? hour.open_minutes : null;
  const close = typeof hour.close_minutes === "number" ? hour.close_minutes : null;
  if (!days.length || open == null || close == null) return false;

  if (close > open) {
    return days.includes(weekday) && minutesOfDay >= open && minutesOfDay < close;
  }

  return (
    (days.includes(weekday) && minutesOfDay >= open) ||
    (days.includes(previousWeekday(weekday)) && minutesOfDay < close)
  );
}

function specialHourForToday(metadata?: DiningCommonsMetadata) {
  const today = easternDateString();
  return metadata?.special_hours?.find((hour) => {
    if (!hour.date_start || !hour.date_end) return false;
    return today >= hour.date_start && today <= hour.date_end;
  });
}

function specialHourApplies(hour: DiningHour, minutesOfDay: number) {
  const open = typeof hour.open_minutes === "number" ? hour.open_minutes : null;
  const close = typeof hour.close_minutes === "number" ? hour.close_minutes : null;
  if (open == null || close == null) return false;
  if (close > open) return minutesOfDay >= open && minutesOfDay < close;
  return minutesOfDay >= open || minutesOfDay < close;
}

function mainRegularHour(metadata?: DiningCommonsMetadata) {
  return metadata?.regular_hours?.find((hour) => !hour.label?.toLowerCase().includes("grab")) ?? metadata?.regular_hours?.[0];
}

function closeLabel(hour: DiningHour) {
  const parts = hour.hours?.split(/\s+-\s+/);
  return parts?.[1]?.toLowerCase() ?? "";
}

function openStatus(metadata?: DiningCommonsMetadata) {
  const special = specialHourForToday(metadata);
  const hour = special ?? mainRegularHour(metadata);
  if (!hour) return { label: "", isOpen: null };

  const now = easternNow();
  const isOpen = special
    ? specialHourApplies(hour, now.minutesOfDay)
    : hourAppliesToday(hour, now.weekday, now.minutesOfDay);
  if (isOpen) {
    const closes = closeLabel(hour);
    return { label: closes ? `Open until ${closes}` : "Open now", isOpen: true };
  }

  return { label: "Closed now", isOpen: false };
}

function compactPeriodLabel(period: string) {
  return titleCase(period).replace("Late Night", "Late");
}

function diningContextLine(metadata?: DiningCommonsMetadata, availablePeriods?: string[]) {
  const status = openStatus(metadata).label;
  const periods = availablePeriods?.length
    ? `${availablePeriods.map(compactPeriodLabel).join(", ")} today`
    : "";
  return [status, periods].filter(Boolean).join(" / ");
}

type GrabNGoItem = MealPlanItem & {
  dining_commons: string;
};

type MenuItemRow = {
  dining_commons?: string | null;
  item_name?: string | null;
  station?: string | null;
  serving_size?: string | null;
  calories?: number | string | null;
  protein_g?: number | string | null;
  fat_g?: number | string | null;
  carbs_g?: number | string | null;
  total_fat_dv?: number | string | null;
  saturated_fat_dv?: number | string | null;
  cholesterol_dv?: number | string | null;
  sodium_dv?: number | string | null;
  carbs_dv?: number | string | null;
  fiber_dv?: number | string | null;
  sugars_dv?: number | string | null;
  protein_dv?: number | string | null;
  fiber_g?: number | string | null;
  sodium_mg?: number | string | null;
  sugars_g?: number | string | null;
  saturated_fat_g?: number | string | null;
  trans_fat_g?: number | string | null;
  cholesterol_mg?: number | string | null;
  healthfulness?: number | string | null;
  dietary_tags?: string[] | string | null;
  allergens?: string | null;
  ingredient_list?: string | null;
  carbon_rating?: string | null;
};

const MENU_ITEM_DETAIL_COLUMNS = [
  "dining_commons",
  "item_name",
  "station",
  "serving_size",
  "calories",
  "protein_g",
  "fat_g",
  "carbs_g",
  "total_fat_dv",
  "saturated_fat_dv",
  "cholesterol_dv",
  "sodium_dv",
  "carbs_dv",
  "fiber_dv",
  "sugars_dv",
  "protein_dv",
  "fiber_g",
  "sodium_mg",
  "sugars_g",
  "saturated_fat_g",
  "trans_fat_g",
  "cholesterol_mg",
  "healthfulness",
  "dietary_tags",
  "allergens",
  "ingredient_list",
  "carbon_rating"
].join(",");

function isGrabNGoPeriod(period: string) {
  const normalized = period.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "grabngo" || normalized === "grab_go" || normalized === "grab_n_go";
}

function numericValue(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumericValue(value: number | string | null | undefined) {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function tagsValue(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return undefined;
}

function mapGrabNGoItem(row: MenuItemRow): GrabNGoItem | null {
  const item = row.item_name?.trim();
  const diningCommons = getDiningCommon(row.dining_commons).key;
  if (!item) return null;

  return {
    dining_commons: diningCommons,
    item,
    station: row.station ?? undefined,
    serving_size: row.serving_size ?? undefined,
    servings: 1,
    calories: numericValue(row.calories),
    protein_g: numericValue(row.protein_g),
    fat_g: numericValue(row.fat_g),
    carbs_g: numericValue(row.carbs_g),
    total_fat_dv: optionalNumericValue(row.total_fat_dv),
    saturated_fat_dv: optionalNumericValue(row.saturated_fat_dv),
    cholesterol_dv: optionalNumericValue(row.cholesterol_dv),
    sodium_dv: optionalNumericValue(row.sodium_dv),
    carbs_dv: optionalNumericValue(row.carbs_dv),
    fiber_dv: optionalNumericValue(row.fiber_dv),
    sugars_dv: optionalNumericValue(row.sugars_dv),
    protein_dv: optionalNumericValue(row.protein_dv),
    fiber_g: optionalNumericValue(row.fiber_g),
    sodium_mg: optionalNumericValue(row.sodium_mg),
    sugars_g: optionalNumericValue(row.sugars_g),
    saturated_fat_g: optionalNumericValue(row.saturated_fat_g),
    trans_fat_g: optionalNumericValue(row.trans_fat_g),
    cholesterol_mg: optionalNumericValue(row.cholesterol_mg),
    healthfulness: optionalNumericValue(row.healthfulness),
    dietary_tags: tagsValue(row.dietary_tags),
    allergens: row.allergens ?? undefined,
    ingredient_list: row.ingredient_list ?? undefined,
    carbon_rating: row.carbon_rating ?? undefined
  };
}

function sortGrabNGoItems(items: GrabNGoItem[], preferredDiningCommons: string[]) {
  const preferredKeys = preferredDiningCommons.map((item) => getDiningCommon(item).key);

  return [...items].sort((left, right) => {
    const leftPreferred = preferredKeys.indexOf(getDiningCommon(left.dining_commons).key);
    const rightPreferred = preferredKeys.indexOf(getDiningCommon(right.dining_commons).key);
    const leftRank = leftPreferred === -1 ? 99 : leftPreferred;
    const rightRank = rightPreferred === -1 ? 99 : rightPreferred;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (right.protein_g !== left.protein_g) return right.protein_g - left.protein_g;
    if (right.calories !== left.calories) return right.calories - left.calories;
    return left.item.localeCompare(right.item);
  });
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

type DiningContext = {
  metadataByCommon: Record<string, DiningCommonsMetadata>;
  periodsByCommon: Record<string, string[]>;
};

const emptyDiningContext: DiningContext = {
  metadataByCommon: {},
  periodsByCommon: {}
};

async function fetchDiningContext(date: string): Promise<DiningContext> {
  const [periodsResult, metadataResult] = await Promise.all([
    supabase.from("menu_items").select("dining_commons, meal_period").eq("date", date),
    supabase.from("dining_commons_metadata").select("*")
  ]);

  if (periodsResult.error) throw periodsResult.error;
  if (metadataResult.error) throw metadataResult.error;

  const periodsByCommon: Record<string, string[]> = {};
  for (const row of periodsResult.data ?? []) {
    const diningCommons = String(row.dining_commons ?? "");
    const period = String(row.meal_period ?? "");
    if (!diningCommons || !period) continue;
    periodsByCommon[diningCommons] = periodsByCommon[diningCommons] ?? [];
    if (!periodsByCommon[diningCommons].includes(period)) {
      periodsByCommon[diningCommons].push(period);
    }
  }

  for (const key of Object.keys(periodsByCommon)) {
    periodsByCommon[key].sort((left, right) => sortMealPeriod([left, null], [right, null]));
  }

  const metadataByCommon = Object.fromEntries(
    ((metadataResult.data ?? []) as DiningCommonsMetadata[]).map((row) => [row.dining_commons, row])
  );

  return { metadataByCommon, periodsByCommon };
}

async function fetchGrabNGoItems(date: string, preferredDiningCommons: string[]) {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_ITEM_DETAIL_COLUMNS)
    .eq("date", date)
    .eq("meal_period", "grabngo");

  if (error) throw error;

  const items = ((data ?? []) as MenuItemRow[])
    .map(mapGrabNGoItem)
    .filter((item): item is GrabNGoItem => Boolean(item));

  return sortGrabNGoItems(items, preferredDiningCommons);
}

export default function HomeScreen({ navigation, route }: HomeProps) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [diningContext, setDiningContext] = useState<DiningContext>(emptyDiningContext);
  const [grabNGoItems, setGrabNGoItems] = useState<GrabNGoItem[]>([]);
  const preferredDiningCommons = profile?.preferred_dining_commons ?? [];
  const preferredDiningCommonsKey = preferredDiningCommons.join("|");

  const loadDiningContext = useCallback(async (date: string) => {
    try {
      setDiningContext(await fetchDiningContext(date));
    } catch {
      setDiningContext(emptyDiningContext);
    }
  }, []);

  const loadGrabNGoItems = useCallback(async (date: string) => {
    try {
      setGrabNGoItems(await fetchGrabNGoItems(date, preferredDiningCommons));
    } catch {
      setGrabNGoItems([]);
    }
  }, [preferredDiningCommonsKey]);

  const loadPlan = useCallback(
    async (generateIfMissing: boolean) => {
      if (!session?.user) return;

      setMessage(null);
      const date = todayIsoDate();
      void loadDiningContext(date);
      void loadGrabNGoItems(date);
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
    [loadDiningContext, loadGrabNGoItems, session]
  );

  const generatePlan = useCallback(async (regenerate = false) => {
    setGenerating(true);
    setMessage(null);
    setPlan(null);
    try {
      const data = await invokeGenerateMealPlan(regenerate);
      const date = typeof data?.date === "string" ? data.date : todayIsoDate();
      void loadDiningContext(date);
      void loadGrabNGoItems(date);
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
  }, [loadDiningContext, loadGrabNGoItems]);

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
  const mealEntries = meals
    ? (Object.entries(meals).sort(sortMealPeriod) as [string, MealPlanMeal][]).filter(([period]) => !isGrabNGoPeriod(period))
    : [];
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

        {heroMeal ? (
          <BestMove
            period={heroMeal[0]}
            meal={heroMeal[1]}
            generating={generating}
            metadata={diningContext.metadataByCommon[getDiningCommon(heroMeal[1].dining_commons).key]}
            availablePeriods={diningContext.periodsByCommon[getDiningCommon(heroMeal[1].dining_commons).key]}
            onRegenerate={() => generatePlan(true)}
          />
        ) : null}

        {totals ? <DailyFit totals={totals} /> : null}

        <GrabNGoSection items={grabNGoItems} />

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
  metadata,
  availablePeriods,
  onRegenerate
}: {
  period: string;
  meal: MealPlanMeal;
  generating: boolean;
  metadata?: DiningCommonsMetadata;
  availablePeriods?: string[];
  onRegenerate: () => void;
}) {
  const common = getDiningCommon(meal.dining_commons);
  const primaryItem = meal.items[0]?.item ?? titleCase(period);
  const supportingItems = meal.items.slice(1, 3).map((item) => item.item).join(", ");
  const status = openStatus(metadata);
  const context = diningContextLine(metadata, availablePeriods);

  if (status.isOpen === false) {
    return <ClosedHero />;
  }

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
      {context ? <Text style={styles.heroContext}>{context}</Text> : null}
      <View style={styles.heroBottom}>
        <Text style={styles.heroMeta}>{titleCase(period)} / {formatMealMacro(meal)}</Text>
        <Pressable style={styles.heroButton} onPress={onRegenerate} disabled={generating}>
          {generating ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.heroButtonText}>Try another</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function ClosedHero() {
  return (
    <View style={styles.closedHero}>
      <View style={styles.closedTop}>
        <View style={styles.closedBadge}>
          <Text style={styles.closedBadgeText}>Closed now</Text>
        </View>
      </View>
      <Text style={styles.closedTitle}>Nothing available right now</Text>
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

function GrabNGoSection({ items }: { items: GrabNGoItem[] }) {
  const [selectedItem, setSelectedItem] = useState<GrabNGoItem | null>(null);
  if (!items.length) return null;

  const visibleItems = items.slice(0, 4);
  const selectedCommon = selectedItem ? getDiningCommon(selectedItem.dining_commons).label : "";

  return (
    <View style={styles.grabCard}>
      <View style={styles.grabHeader}>
        <Text style={styles.grabTitle}>Grab & Go</Text>
        <Text style={styles.grabCount}>{items.length} today</Text>
      </View>

      <View style={styles.grabItems}>
        {visibleItems.map((item, index) => {
          const common = getDiningCommon(item.dining_commons);
          return (
            <Pressable key={`${common.key}-${item.item}-${index}`} style={styles.grabRow} onPress={() => setSelectedItem(item)}>
              <View style={styles.grabItemText}>
                <Text style={styles.grabItemName} numberOfLines={2}>{item.item}</Text>
                <View style={styles.grabCommon}>
                  <View style={[styles.grabDot, { backgroundColor: common.color }]} />
                  <Text style={styles.grabCommonText}>{common.label}</Text>
                </View>
              </View>
              <Text style={styles.grabMacro}>
                {Math.round(item.calories)} cal{"\n"}{Math.round(item.protein_g)}g P
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FoodDetailModal item={selectedItem} commonLabel={selectedCommon} onClose={() => setSelectedItem(null)} />
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
  heroContext: { color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroMeta: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  heroButton: { minHeight: 42, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.surfaceWarm },
  heroButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  closedHero: { ...shadows.card, gap: 12, padding: 20, borderRadius: 28, backgroundColor: colors.surface },
  closedTop: { flexDirection: "row", alignItems: "center" },
  closedBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceWarm },
  closedBadgeText: { color: colors.quiet, fontSize: 12, fontWeight: "900" },
  closedTitle: { color: colors.text, fontSize: 23, fontWeight: "900", lineHeight: 29 },
  fitCard: { padding: 16, borderRadius: 22, backgroundColor: colors.surfaceWarm },
  fitStats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 3 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  statLabel: { color: colors.quiet, fontSize: 12 },
  grabCard: { ...shadows.card, gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.surface },
  grabHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  grabTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  grabCount: { color: colors.quiet, fontSize: 12, fontWeight: "800" },
  grabItems: { gap: 8 },
  grabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt
  },
  grabItemText: { flex: 1, gap: 7 },
  grabItemName: { color: colors.text, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  grabCommon: { flexDirection: "row", alignItems: "center", gap: 6 },
  grabDot: { width: 7, height: 7, borderRadius: 7 },
  grabCommonText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  grabMacro: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: "right", fontWeight: "700" },
  emptyAction: { marginTop: 4, minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primary },
  emptyActionText: { color: colors.onPrimary, fontWeight: "900" }
});
