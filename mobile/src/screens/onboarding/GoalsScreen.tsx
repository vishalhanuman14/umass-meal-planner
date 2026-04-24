import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import OnboardingProgress from "../../components/OnboardingProgress";
import { useProfile } from "../../contexts/ProfileContext";
import { calculateTargets } from "../../lib/tdee";
import { colors, shadows } from "../../theme";
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

  function handleNext() {
    if (!calculated) {
      Alert.alert("Missing stats", "Go back and complete body stats first.");
      return;
    }

    setDraft({
      goal,
      activity_level: activityLevel,
      ...calculated
    });
    navigation.navigate("Preferences");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OnboardingProgress step={2} total={3} />
      <View style={styles.header}>
        <Text style={styles.heading}>What should meals optimize for?</Text>
      </View>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.stack}>
        {goals.map((item) => (
          <Pressable key={item.value} style={[styles.option, goal === item.value && styles.optionSelected]} onPress={() => setGoal(item.value)}>
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
            <Text style={[styles.optionText, activityLevel === item.value && styles.optionTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={handleNext}>
        <Text style={styles.primaryText}>Next</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  header: { ...shadows.card, gap: 8, padding: 18, borderRadius: 24, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 26, fontWeight: "900", lineHeight: 31 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  stack: { gap: 10 },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, color: colors.muted, fontSize: 15, fontWeight: "700" },
  optionTextSelected: { color: colors.onPrimary },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primary, ...shadows.soft },
  primaryText: { color: colors.onPrimary, fontWeight: "900", fontSize: 16 }
});
