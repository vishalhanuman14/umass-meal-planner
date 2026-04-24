import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import MacroBar from "../../components/MacroBar";
import OnboardingProgress from "../../components/OnboardingProgress";
import { useProfile } from "../../contexts/ProfileContext";
import { calculateTargets } from "../../lib/tdee";
import type { ActivityLevel, Goal, GoalsProps } from "../../types";

const goals: { value: Goal; label: string }[] = [
  { value: "lose", label: "Lose weight" },
  { value: "gain", label: "Gain muscle" },
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
      <Text style={styles.heading}>Goals</Text>

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

      {calculated ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily targets</Text>
          <MacroBar label="Calories" value={calculated.calorie_target} target={calculated.calorie_target} unit="cal" />
          <MacroBar label="Protein" value={calculated.protein_target_g} target={calculated.protein_target_g} unit="g" />
          <MacroBar label="Fat" value={calculated.fat_target_g} target={calculated.fat_target_g} unit="g" />
          <MacroBar label="Carbs" value={calculated.carbs_target_g} target={calculated.carbs_target_g} unit="g" />
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
      <TextInput value={value} onChangeText={onChangeText} keyboardType="numeric" placeholderTextColor="#748092" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f14" },
  content: { padding: 20, gap: 18 },
  heading: { color: "#f4f7fb", fontSize: 26, fontWeight: "800" },
  label: { color: "#aeb8c6", fontSize: 14, fontWeight: "600" },
  stack: { gap: 10 },
  option: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#111821"
  },
  optionSelected: { borderColor: "#8bd3ff", backgroundColor: "#173246" },
  optionText: { color: "#aeb8c6", fontSize: 15, fontWeight: "700" },
  optionTextSelected: { color: "#f4f7fb" },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#111821"
  },
  cardTitle: { color: "#f4f7fb", fontSize: 17, fontWeight: "800" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    color: "#f4f7fb",
    backgroundColor: "#111821",
    fontSize: 16
  },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#8bd3ff" },
  primaryText: { color: "#071018", fontWeight: "800", fontSize: 16 }
});
