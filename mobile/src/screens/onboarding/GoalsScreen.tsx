import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import OnboardingProgress from "../../components/OnboardingProgress";
import { useProfile } from "../../contexts/ProfileContext";
import { calculateTargets } from "../../lib/tdee";
import { colors } from "../../theme";
import type { ActivityLevel, Goal, GoalsProps } from "../../types";

const goals: { value: Goal; label: string }[] = [
  { value: "lose", label: "Lose weight" },
  { value: "gain", label: "Build muscle" },
  { value: "maintain", label: "Maintain" }
];

const activityLevels: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" }
];

export default function GoalsScreen({ navigation }: GoalsProps) {
  const { draft, setDraft } = useProfile();
  const [goal, setGoal] = useState<Goal>(draft.goal ?? "maintain");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(draft.activity_level ?? "moderate");
  const calculated = useMemo(() => {
    if (!draft.height_cm || !draft.weight_kg || !draft.age || !draft.gender) return null;
    return calculateTargets({
      heightCm: draft.height_cm,
      weightKg: draft.weight_kg,
      age: draft.age,
      gender: draft.gender,
      activityLevel,
      goal
    });
  }, [activityLevel, draft.age, draft.gender, draft.height_cm, draft.weight_kg, goal]);

  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");

  function handleNext() {
    if (!calculated) {
      Alert.alert("Missing stats", "Go back and complete body stats first.");
      return;
    }

    setDraft({
      goal,
      activity_level: activityLevel,
      ...calculated,
      calorie_target: manualCalories ? Number(manualCalories) : calculated.calorie_target,
      protein_target_g: manualProtein ? Number(manualProtein) : calculated.protein_target_g
    });
    navigation.navigate("Preferences");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OnboardingProgress step={2} total={3} />
      <View style={styles.header}>
        <Text style={styles.heading}>What should meals optimize for?</Text>
        <Text style={styles.subtitle}>Choose the recommendation style. Targets stay in the background.</Text>
      </View>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.stack}>
        {goals.map((item) => (
          <Pressable key={item.value} style={[styles.option, goal === item.value && styles.optionSelected]} onPress={() => setGoal(item.value)}>
            <View style={[styles.optionRail, goal === item.value && styles.optionRailSelected]} />
            <Text style={[styles.optionText, goal === item.value && styles.optionTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.stack}>
        {activityLevels.map((item) => (
          <Pressable
            key={item.value}
            style={[styles.option, activityLevel === item.value && styles.optionSelected]}
            onPress={() => setActivityLevel(item.value)}
          >
            <View style={[styles.optionRail, activityLevel === item.value && styles.optionRailSelected]} />
            <Text style={[styles.optionText, activityLevel === item.value && styles.optionTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {calculated ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target preview</Text>
          <Text style={styles.targetLine}>
            {calculated.calorie_target} cal / {calculated.protein_target_g}g protein / {calculated.fat_target_g}g fat /{" "}
            {calculated.carbs_target_g}g carbs
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Field label="Calories override" value={manualCalories} onChangeText={setManualCalories} />
        <Field label="Protein override" value={manualProtein} onChangeText={setManualProtein} />
      </View>

      <Pressable style={styles.primaryButton} onPress={handleNext}>
        <Text style={styles.primaryText}>Next</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType="numeric" placeholderTextColor={colors.quiet} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  header: { gap: 8 },
  heading: { color: colors.text, fontSize: 26, fontWeight: "800", lineHeight: 31 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  stack: { gap: 10 },
  option: {
    position: "relative",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  optionRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "transparent" },
  optionRailSelected: { backgroundColor: colors.maroon },
  optionSelected: { borderColor: colors.maroon, backgroundColor: colors.elevated },
  optionText: { flex: 1, color: colors.muted, fontSize: 15, fontWeight: "700" },
  optionTextSelected: { color: colors.text },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  targetLine: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16
  },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.maroon },
  primaryText: { color: colors.text, fontWeight: "800", fontSize: 16 }
});
