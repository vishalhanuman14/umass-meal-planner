import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import OnboardingProgress from "../../components/OnboardingProgress";
import { cmToInches, inchesToCm, kgToPounds, poundsToKg } from "../../lib/tdee";
import { useProfile } from "../../contexts/ProfileContext";
import { colors } from "../../theme";
import type { BodyStatsProps, Gender } from "../../types";

const GENDERS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" }
];

export default function BodyStatsScreen({ navigation }: BodyStatsProps) {
  const { draft, setDraft } = useProfile();
  const existingHeight = draft.height_cm ? cmToInches(draft.height_cm) : undefined;
  const [feet, setFeet] = useState(existingHeight ? String(Math.floor(existingHeight / 12)) : "");
  const [inches, setInches] = useState(existingHeight ? String(Math.round(existingHeight % 12)) : "");
  const [weightLb, setWeightLb] = useState(draft.weight_kg ? String(Math.round(kgToPounds(draft.weight_kg))) : "");
  const [age, setAge] = useState(draft.age ? String(draft.age) : "");
  const [gender, setGender] = useState<Gender>((draft.gender as Gender | null) ?? "male");
  const [error, setError] = useState<string | null>(null);

  function next() {
    const heightIn = Number(feet) * 12 + Number(inches);
    const weight = Number(weightLb);
    const ageNum = Number(age);

    if (!heightIn || !weight || !ageNum) {
      setError("Fill height, weight, and age.");
      return;
    }

    setDraft({
      height_cm: Math.round(inchesToCm(heightIn)),
      weight_kg: Math.round(poundsToKg(weight) * 10) / 10,
      age: ageNum,
      gender
    });
    navigation.navigate("Goals");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <OnboardingProgress step={1} total={3} />

        <View style={styles.section}>
          <Text style={styles.title}>Set your baseline.</Text>
          <Text style={styles.subtitle}>A few numbers help tune recommendations. This is setup, not food tracking.</Text>

          <View style={styles.row}>
            <Field label="Feet" value={feet} onChangeText={setFeet} keyboardType="number-pad" />
            <Field label="Inches" value={inches} onChangeText={setInches} keyboardType="number-pad" />
          </View>

          <Field label="Weight (lb)" value={weightLb} onChangeText={setWeightLb} keyboardType="decimal-pad" />
          <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />

          <View style={styles.segmented}>
            {GENDERS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setGender(option.value)}
                style={[styles.segment, gender === option.value && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, gender === option.value && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.footer}>
          <Pressable onPress={next} style={styles.button}>
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType: "number-pad" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={colors.quiet}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flexGrow: 1,
    padding: 20,
    gap: 22
  },
  section: {
    gap: 16
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  field: {
    flex: 1,
    gap: 8
  },
  label: {
    color: colors.muted,
    fontSize: 14
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16
  },
  segmented: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  segmentActive: {
    borderColor: colors.maroon,
    backgroundColor: colors.elevated
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "700"
  },
  segmentTextActive: {
    color: colors.text
  },
  error: {
    color: colors.danger
  },
  footer: {
    marginTop: "auto",
    paddingTop: 8
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.maroon
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  }
});
