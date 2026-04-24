import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import { calculateTargets, cmToInches, inchesToCm, kgToPounds, poundsToKg } from "../lib/tdee";
import { colors, getDiningCommon, shadows, titleCase } from "../theme";
import type { ActivityLevel, Gender, Goal, SettingsProps } from "../types";

const goals: Goal[] = ["lose", "gain", "maintain"];
const activities: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const genders: Gender[] = ["male", "female", "other"];
const dietaryOptions = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "dairy-free"];
const allergenOptions = ["peanuts", "tree nuts", "shellfish", "soy", "eggs", "wheat", "milk"];
const diningCommons = ["worcester", "franklin", "hampshire", "berkshire"];

export default function SettingsScreen({ navigation }: SettingsProps) {
  const { signOut } = useAuth();
  const { profile, saveProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightLb, setWeightLb] = useState("");
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
    const heightIn = profile.height_cm ? cmToInches(profile.height_cm) : null;
    setFeet(heightIn ? String(Math.floor(heightIn / 12)) : "");
    setInches(heightIn ? String(Math.round(heightIn % 12)) : "");
    setWeightLb(profile.weight_kg ? String(Math.round(kgToPounds(profile.weight_kg))) : "");
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
    const parsedHeight = Number(feet) * 12 + Number(inches);
    const parsedWeight = Number(weightLb);
    const parsedAge = Number(age);
    if (!parsedHeight || !parsedWeight || !parsedAge) return null;
    return calculateTargets({
      heightCm: inchesToCm(parsedHeight),
      weightKg: poundsToKg(parsedWeight),
      age: parsedAge,
      gender,
      activityLevel: activity,
      goal
    });
  }, [activity, age, feet, gender, goal, inches, weightLb]);

  async function save() {
    if (!recalculated) {
      Alert.alert("Missing info", "Height, weight, and age are required.");
      return;
    }
    setSaving(true);
    try {
      const heightIn = Number(feet) * 12 + Number(inches);
      await saveProfile({
        height_cm: Math.round(inchesToCm(heightIn)),
        weight_kg: Math.round(poundsToKg(Number(weightLb)) * 10) / 10,
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
      navigation.navigate("Home", { refreshPlanAt: new Date().toISOString() });
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput value={additional} onChangeText={setAdditional} multiline style={styles.textArea} placeholderTextColor={colors.quiet} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Body info</Text>
        <View style={styles.row}>
          <Field label="Feet" value={feet} onChangeText={setFeet} />
          <Field label="In" value={inches} onChangeText={setInches} />
        </View>
        <View style={styles.row}>
          <Field label="Weight lb" value={weightLb} onChangeText={setWeightLb} />
          <Field label="Age" value={age} onChangeText={setAge} />
        </View>
        <ChoiceGroup title="Gender" options={genders} selected={gender} onSelect={(value) => setGender(value as Gender)} />
      </View>

      {recalculated ? (
        <View style={styles.targetCard}>
          <Text style={styles.label}>Daily target</Text>
          <Text style={styles.targets}>
            {recalculated.calorie_target} cal / {recalculated.protein_target_g}g protein
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>Save</Text>}
      </Pressable>

      <View style={styles.accountCard}>
        <View>
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.name}>{profile?.name || "UMass student"}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={signOut}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </Pressable>
      </View>
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
          <Text style={[styles.chipText, selected.length === 0 && styles.chipTextSelected]}>Any</Text>
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
        <Text style={[styles.commonName, selected.length === 0 && styles.commonNameSelected]}>Any</Text>
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
  content: { padding: 20, paddingBottom: 28, gap: 16 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  email: { color: colors.muted, fontSize: 14, marginTop: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 6 },
  section: { ...shadows.soft, gap: 12, padding: 16, borderRadius: 22, backgroundColor: colors.surface },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 8 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16
  },
  textArea: {
    minHeight: 96,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
    textAlignVertical: "top"
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: "700" },
  chipTextSelected: { color: colors.onPrimary },
  commonsList: { gap: 10 },
  commonRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  commonRowSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceWarm },
  commonDot: { width: 9, height: 9, borderRadius: 9 },
  commonName: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  commonNameSelected: { color: colors.text },
  targetCard: { gap: 4, paddingHorizontal: 4 },
  targets: { color: colors.primary, fontWeight: "900" },
  primaryButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primary, ...shadows.soft },
  primaryText: { color: colors.onPrimary, fontWeight: "900", fontSize: 16 },
  accountCard: { ...shadows.soft, gap: 14, padding: 16, borderRadius: 22, backgroundColor: colors.surface },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.surfaceWarm },
  secondaryText: { color: colors.primary, fontWeight: "900" }
});
