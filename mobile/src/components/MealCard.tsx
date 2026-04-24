import { StyleSheet, Text, View } from "react-native";

import type { MealPlanMeal } from "../types";

type MealCardProps = {
  period: string;
  meal: MealPlanMeal;
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MealCard({ period, meal }: MealCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.period}>{titleCase(period)}</Text>
          <Text style={styles.commons}>{titleCase(meal.dining_commons)}</Text>
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
    padding: 16,
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#111821"
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  period: {
    color: "#f4f7fb",
    fontSize: 19,
    fontWeight: "700"
  },
  commons: {
    marginTop: 4,
    color: "#aeb8c6",
    fontSize: 14
  },
  calories: {
    color: "#8bd3ff",
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
    color: "#f4f7fb",
    fontSize: 15
  },
  serving: {
    color: "#748092",
    fontSize: 12
  },
  itemMacro: {
    color: "#aeb8c6",
    fontSize: 13,
    textAlign: "right"
  },
  total: {
    color: "#aeb8c6",
    fontSize: 13
  }
});
