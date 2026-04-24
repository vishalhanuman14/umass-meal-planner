import { StyleSheet, Text, View } from "react-native";

import { colors, getDiningCommon, titleCase } from "../theme";
import type { MealPlanMeal } from "../types";

type MealCardProps = {
  period: string;
  meal: MealPlanMeal;
};

export default function MealCard({ period, meal }: MealCardProps) {
  const common = getDiningCommon(meal.dining_commons);

  return (
    <View style={styles.card}>
      <View style={[styles.rail, { backgroundColor: common.color }]} />
      <View style={styles.header}>
        <View>
          <Text style={styles.period}>{titleCase(period)}</Text>
          <View style={styles.commonsRow}>
            <View style={[styles.dot, { backgroundColor: common.color }]} />
            <Text style={styles.commons}>{common.label}</Text>
          </View>
        </View>
        <Text style={styles.calories}>{Math.round(meal.meal_total.calories)} cal</Text>
      </View>

      <View style={styles.items}>
        {meal.items.map((item, index) => (
          <View key={`${item.item}-${index}`} style={styles.itemRow}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.item}</Text>
              <Text style={styles.serving}>{item.servings} serving{item.servings === 1 ? "" : "s"}</Text>
            </View>
            <Text style={styles.itemMacro}>
              {Math.round(item.calories)} cal · {Math.round(item.protein_g)}g P
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
    position: "relative",
    padding: 16,
    paddingLeft: 18,
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  rail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  period: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700"
  },
  commonsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8
  },
  commons: {
    color: colors.muted,
    fontSize: 14
  },
  calories: {
    color: colors.amber,
    fontSize: 16,
    fontWeight: "700"
  },
  items: {
    gap: 10
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  itemText: {
    flex: 1,
    gap: 2
  },
  itemName: {
    color: colors.text,
    fontSize: 15
  },
  serving: {
    color: colors.quiet,
    fontSize: 12
  },
  itemMacro: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "right"
  },
  total: {
    color: colors.muted,
    fontSize: 13
  }
});
