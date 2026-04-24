import { StyleSheet, Text, View } from "react-native";

import { colors, getDiningCommon, shadows, titleCase } from "../theme";
import type { MealPlanMeal } from "../types";

type MealCardProps = {
  period: string;
  meal: MealPlanMeal;
};

export default function MealCard({ period, meal }: MealCardProps) {
  const common = getDiningCommon(meal.dining_commons);

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
          <View key={`${item.item}-${index}`} style={styles.itemRow}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.item}</Text>
            </View>
            <Text style={styles.itemMacro}>
              {item.servings === 1 ? "" : `${item.servings}x · `}{Math.round(item.calories)} cal · {Math.round(item.protein_g)}g P
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.total}>
        {Math.round(meal.meal_total.protein_g)}g protein · {Math.round(meal.meal_total.fat_g)}g fat ·{" "}
        {Math.round(meal.meal_total.carbs_g)}g carbs
      </Text>
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
  total: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  }
});
