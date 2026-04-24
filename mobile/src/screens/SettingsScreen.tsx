import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { calculateTargets } from "../lib/tdee";
import { colors, getDiningCommon, titleCase } from "../theme";
import type { ActivityLevel, Gender, Goal, SettingsProps } from "../types";

const goals: Goal[] = ["lose", "gain", "maintain"];
const activities: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const genders: Gender[] = ["male", "female", "other"];
const dietaryOptions = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "dairy-free"];
const allergenOptions = ["peanuts", "tree nuts", "shellfish", "soy", "eggs", "wheat", "milk"];
const diningCommons = ["worcester", "franklin", "hampshire", "berkshire"];

export default function SettingsScreen(_props: SettingsProps) {
  const { signOut } = useAuth();
  const { profile, saveProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [goal, setGoal] = useState<Goal>("maintain");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [dietary, setDietary] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [additional, setAdditional] = useState("");

  useEffect(() => {
    if (!profile) return;
    setHeightCm(profile.height_cm ? String(Math.round(profile.height_cm)) : "");
    setWeightKg(profile.weight_kg ? String(profile.weight_kg) : "");
    setAge(profile.age ? String(profile.age) : "");
    setGender(profile.gender ?? "male");
    setGoal(profile.goal ?? "maintain");
    setActivity(profile.activity_level ?? "moderate");
    setDietary(profile.dietary_restrictions ?? []);
    setAllergens(profile.allergens ?? []);
    setPreferred(profile.preferred_dining_commons ?? []);
    setAdditional(profile.additional_preferences ?? "");
  }, [profile]);

  const recalculated = useMemo(() => {
    const parsedHeight = Number(heightCm);
    const parsedWeight = Number(weightKg);
    const parsedAge = Number(age);
    if (!parsedHeight || !parsedWeight || !parsedAge) return null;
    return calculateTargets({
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      age: parsedAge,
      gender,
      activityLevel: activity,
      goal
    });
  }, [activity, age, gender, goal, heightCm, weightKg]);

  async function save() {
    if (!recalculated) {
      Alert.alert("Missing info", "Height, weight, and age are required.");
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        age: Number(age),
        gender,
        goal,
        activity_level: activity,
        dietary_restrictions: dietary,
        allergens,
        preferred_dining_commons: preferred,
        additional_preferences: additional.trim(),
        ...recalculated
      });
      Alert.alert("Saved", "Profile updated.");
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Profile</Text>
        <Text style={styles.name}>{profile?.name || "UMass student"}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Baseline</Text>
        <View style={styles.row}>
          <Field label="Height cm" value={heightCm} onChangeText={setHeightCm} />
          <Field label="Weight kg" value={weightKg} onChangeText={setWeightKg} />
        </View>
        <Field label="Age" value={age} onChangeText={setAge} />
        <ChoiceGroup title="Gender" options={genders} selected={gender} onSelect={(value) => setGender(value as Gender)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <ChoiceGroup title="Goal" options={goals} selected={goal} onSelect={(value) => setGoal(value as Goal)} />
        <ChoiceGroup title="Activity" options={activities} selected={activity} onSelect={(value) => setActivity(value as ActivityLevel)} />
        <MultiChoiceGroup title="Dietary style" options={dietaryOptions} selected={dietary} onChange={setDietary} />
        <MultiChoiceGroup title="Allergens" options={allergenOptions} selected={allergens} onChange={setAllergens} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dining commons</Text>
        <DiningCommonsGroup selected={preferred} onChange={setPreferred} />
      </View>

      {recalculated ? (
        <Text style={styles.targets}>
          {recalculated.calorie_target} cal / {recalculated.protein_target_g}g P / {recalculated.fat_target_g}g F /{" "}
          {recalculated.carbs_target_g}g C
        </Text>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Additional preferences</Text>
        <TextInput value={additional} onChangeText={setAdditional} multiline style={styles.textArea} placeholderTextColor={colors.quiet} />
      </View>

      <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.text} /> : <Text style={styles.primaryText}>Save</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={signOut}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
      <Text style={styles.version}>Version 0.1.0</Text>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.quiet} />
    </View>
  );
}

function ChoiceGroup({
  title,
  options,
  selected,
  onSelect
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable key={option} style={[styles.chip, selected === option && styles.chipSelected]} onPress={() => onSelect(option)}>
            <Text style={[styles.chipText, selected === option && styles.chipTextSelected]}>{titleCase(option)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MultiChoiceGroup({
  title,
  options,
  selected,
  onChange
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.chips}>
        <Pressable style={[styles.chip, selected.length === 0 && styles.chipSelected]} onPress={() => onChange([])}>
          <Text style={[styles.chipText, selected.length === 0 && styles.chipTextSelected]}>No preference</Text>
        </Pressable>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable key={option} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggle(option)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{titleCase(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DiningCommonsGroup({ selected, onChange }: { selected: string[]; onChange: (value: string[]) => void }) {
  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <View style={styles.commonsList}>
      <Pressable style={[styles.commonRow, selected.length === 0 && styles.commonRowSelected]} onPress={() => onChange([])}>
        <View style={[styles.commonDot, { backgroundColor: colors.muted }]} />
        <Text style={[styles.commonName, selected.length === 0 && styles.commonNameSelected]}>No preference</Text>
      </Pressable>
      {diningCommons.map((option) => {
        const common = getDiningCommon(option);
        const isSelected = selected.includes(option);
        return (
          <Pressable key={option} style={[styles.commonRow, isSelected && styles.commonRowSelected]} onPress={() => toggle(option)}>
            <View style={[styles.commonDot, { backgroundColor: common.color }]} />
            <Text style={[styles.commonName, isSelected && styles.commonNameSelected]}>{common.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
  kicker: { color: colors.amber, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  email: { color: colors.muted, fontSize: 14, marginTop: 4 },
  name: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 6 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 8 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
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
  textArea: {
    minHeight: 96,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
    textAlignVertical: "top"
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.maroon, backgroundColor: colors.elevated },
  chipText: { color: colors.muted, fontWeight: "700" },
  chipTextSelected: { color: colors.text },
  commonsList: { gap: 10 },
  commonRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  commonRowSelected: { borderColor: colors.maroon, backgroundColor: colors.elevated },
  commonDot: { width: 9, height: 9, borderRadius: 9 },
  commonName: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  commonNameSelected: { color: colors.text },
  targets: { color: colors.amber, fontWeight: "800" },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.maroon },
  primaryText: { color: colors.text, fontWeight: "800", fontSize: 16 },
  secondaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontWeight: "800" },
  version: { color: colors.quiet, textAlign: "center", marginTop: 8 }
});
