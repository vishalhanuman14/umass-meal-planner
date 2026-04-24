import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { colors, getDiningCommon, shadows, titleCase } from "../theme";
import type { MealPlanItem, MealPlanMeal } from "../types";

type MealCardProps = {
  period: string;
  meal: MealPlanMeal;
};

export default function MealCard({ period, meal }: MealCardProps) {
  const common = getDiningCommon(meal.dining_commons);
  const [selectedItem, setSelectedItem] = useState<MealPlanItem | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<Partial<MealPlanItem> | null>(null);

  useEffect(() => {
    let isActive = true;
    setSelectedDetails(null);

    if (!selectedItem) {
      return;
    }

    supabase
      .from("menu_items")
      .select(
        "station, serving_size, fiber_g, sodium_mg, sugars_g, saturated_fat_g, trans_fat_g, cholesterol_mg, healthfulness, dietary_tags, allergens, ingredient_list, carbon_rating"
      )
      .eq("date", easternToday())
      .eq("dining_commons", common.key)
      .eq("meal_period", period)
      .eq("item_name", selectedItem.item)
      .maybeSingle()
      .then(({ data }) => {
        if (!isActive || !data) return;
        setSelectedDetails(scaleMenuDetails(data as MenuItemDetail, selectedItem.servings));
      });

    return () => {
      isActive = false;
    };
  }, [common.key, period, selectedItem]);

  const detailItem = selectedItem ? { ...selectedItem, ...selectedDetails } : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.period}>{titleCase(period)}</Text>
          <View style={styles.commonPill}>
            <View style={[styles.dot, { backgroundColor: common.color }]} />
            <Text style={styles.commons}>{common.label}</Text>
          </View>
        </View>
        <View style={styles.caloriePill}>
          <Text style={styles.calories}>{Math.round(meal.meal_total.calories)} cal</Text>
        </View>
      </View>

      <View style={styles.items}>
        {meal.items.map((item, index) => (
          <Pressable key={`${item.item}-${index}`} style={styles.itemRow} onPress={() => setSelectedItem(item)}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.item}</Text>
            </View>
            <Text style={styles.itemMacro}>
              {item.servings === 1 ? "" : `${item.servings}x · `}{Math.round(item.calories)} cal · {Math.round(item.protein_g)}g P
            </Text>
          </Pressable>
        ))}
      </View>

      <FoodDetailModal item={detailItem} commonLabel={common.label} onClose={() => setSelectedItem(null)} />
    </View>
  );
}

type MenuItemDetail = {
  station?: string;
  serving_size?: string;
  fiber_g?: number;
  sodium_mg?: number;
  sugars_g?: number;
  saturated_fat_g?: number;
  trans_fat_g?: number;
  cholesterol_mg?: number;
  healthfulness?: number;
  dietary_tags?: string[];
  allergens?: string;
  ingredient_list?: string;
  carbon_rating?: string;
};

function easternToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function scaleMenuDetails(detail: MenuItemDetail, servings: number) {
  return {
    ...detail,
    fiber_g: scaleDetail(detail.fiber_g, servings),
    sodium_mg: scaleDetail(detail.sodium_mg, servings),
    sugars_g: scaleDetail(detail.sugars_g, servings),
    saturated_fat_g: scaleDetail(detail.saturated_fat_g, servings),
    trans_fat_g: scaleDetail(detail.trans_fat_g, servings),
    cholesterol_mg: scaleDetail(detail.cholesterol_mg, servings)
  };
}

function scaleDetail(value: number | undefined, servings: number) {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value * servings * 10) / 10;
}

function FoodDetailModal({
  item,
  commonLabel,
  onClose
}: {
  item: MealPlanItem | null;
  commonLabel: string;
  onClose: () => void;
}) {
  if (!item) return null;

  const tags = item.dietary_tags?.filter(Boolean) ?? [];
  const allergens = item.allergens?.trim();
  const carbon = item.carbon_rating?.trim();
  const detailStats = [
    { label: "Calories", value: `${Math.round(item.calories)} cal` },
    { label: "Protein", value: `${Math.round(item.protein_g)}g` },
    { label: "Fat", value: `${Math.round(item.fat_g)}g` },
    { label: "Carbs", value: `${Math.round(item.carbs_g)}g` },
    numericDetail("Fiber", item.fiber_g, "g", true),
    numericDetail("Sugar", item.sugars_g, "g", true),
    numericDetail("Sodium", item.sodium_mg, "mg", true),
    numericDetail("Sat fat", item.saturated_fat_g, "g", true),
    numericDetail("Trans fat", item.trans_fat_g, "g", true),
    numericDetail("Cholesterol", item.cholesterol_mg, "mg", true)
  ].filter((stat): stat is { label: string; value: string } => Boolean(stat));

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleWrap}>
              <Text style={styles.detailTitle}>{item.item}</Text>
              <Text style={styles.detailMeta}>
                {commonLabel}{item.station ? ` · ${item.station}` : ""}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailStats}>
              {detailStats.map((stat) => (
                <DetailStat key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </View>

            <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Serving</Text>
              <Text style={styles.detailValue}>
                {item.servings}x{item.serving_size ? ` · ${item.serving_size}` : ""}
              </Text>
            </View>

            {carbon || item.healthfulness ? (
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Dining notes</Text>
                <Text style={styles.detailValue}>
                  {carbon ? `Carbon ${carbon}` : ""}{carbon && item.healthfulness ? " · " : ""}
                  {item.healthfulness ? `Health ${item.healthfulness}/100` : ""}
                </Text>
              </View>
            ) : null}

            {tags.length ? (
              <View style={styles.badges}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.badge}>
                    <Text style={styles.badgeText}>{titleCase(tag)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {allergens ? (
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Allergens</Text>
                <Text style={styles.detailValue}>{allergens}</Text>
              </View>
            ) : null}

            {item.ingredient_list ? (
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Ingredients</Text>
                <Text style={styles.ingredients}>{item.ingredient_list}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function numericDetail(label: string, value: number | undefined, unit: string, hideZero = false) {
  if (value == null || !Number.isFinite(value) || (hideZero && value === 0)) {
    return null;
  }

  return { label, value: `${formatDetailNumber(value, unit)}${unit}` };
}

function formatDetailNumber(value: number, unit: string) {
  if (unit === "mg" || Number.isInteger(value) || value >= 10) {
    return String(Math.round(value));
  }

  return String(Math.round(value * 10) / 10);
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailStatValue}>{value}</Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    padding: 18,
    gap: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  period: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  commonPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8
  },
  commons: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  caloriePill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm
  },
  calories: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  items: {
    gap: 8
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt
  },
  itemText: {
    flex: 1
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20
  },
  itemMacro: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "right"
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25, 25, 25, 0.28)"
  },
  detailCard: {
    maxHeight: "78%",
    margin: 14,
    padding: 18,
    borderRadius: 28,
    backgroundColor: colors.surface,
    ...shadows.card
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16
  },
  detailTitleWrap: {
    flex: 1,
    gap: 6
  },
  detailTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm
  },
  closeText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26
  },
  detailContent: {
    paddingTop: 16,
    gap: 14
  },
  detailStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  detailStat: {
    width: "48%",
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt
  },
  detailStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  detailStatLabel: {
    marginTop: 3,
    color: colors.quiet,
    fontSize: 12,
    fontWeight: "700"
  },
  detailLine: {
    gap: 5
  },
  detailLabel: {
    color: colors.quiet,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  ingredients: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  }
});
