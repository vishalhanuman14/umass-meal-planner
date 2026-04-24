import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import OnboardingProgress from "../../components/OnboardingProgress";
import { useProfile } from "../../contexts/ProfileContext";
import { colors, getDiningCommon, titleCase } from "../../theme";
import type { PreferencesProps } from "../../types";

const dietaryOptions = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "dairy-free"];
const allergenOptions = ["peanuts", "tree nuts", "shellfish", "soy", "eggs", "wheat", "milk"];
const diningCommons = ["worcester", "franklin", "hampshire", "berkshire"];

export default function PreferencesScreen(_props: PreferencesProps) {
  const { draft, setDraft, saveProfile } = useProfile();
  const [dietary, setDietary] = useState<string[]>(draft.dietary_restrictions ?? []);
  const [allergens, setAllergens] = useState<string[]>(draft.allergens ?? []);
  const [preferred, setPreferred] = useState<string[]>(draft.preferred_dining_commons ?? []);
  const [additional, setAdditional] = useState(draft.additional_preferences ?? "");
  const [saving, setSaving] = useState(false);

  async function completeSetup() {
    const patch = {
      dietary_restrictions: dietary,
      allergens,
      preferred_dining_commons: preferred,
      additional_preferences: additional.trim(),
      onboarding_completed: true
    };

    setSaving(true);
    try {
      setDraft(patch);
      await saveProfile(patch);
    } catch (error) {
      Alert.alert("Could not save profile", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OnboardingProgress step={3} total={3} />
      <View style={styles.header}>
        <Text style={styles.heading}>What should it avoid or prefer?</Text>
        <Text style={styles.subtitle}>Keep it practical: dietary style, allergens, dining commons, and meal timing.</Text>
      </View>

      <OptionGroup title="Dietary style" options={dietaryOptions} selected={dietary} onChange={setDietary} />
      <OptionGroup title="Allergens" options={allergenOptions} selected={allergens} onChange={setAllergens} />
      <DiningCommonsGroup selected={preferred} onChange={setPreferred} />

      <View style={styles.field}>
        <Text style={styles.label}>Additional preferences</Text>
        <TextInput
          value={additional}
          onChangeText={setAdditional}
          multiline
          placeholder="Late lunch, spicy food, no raw fish..."
          placeholderTextColor={colors.quiet}
          style={styles.textArea}
        />
      </View>

      <Pressable style={styles.primaryButton} onPress={completeSetup} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.text} /> : <Text style={styles.primaryText}>Build today's plan</Text>}
      </Pressable>
    </ScrollView>
  );
}

function OptionGroup({
  title,
  options,
  selected,
  onChange
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (items: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.chips}>
        <Pressable style={[styles.chip, selected.length === 0 && styles.chipSelected]} onPress={() => onChange([])}>
          <Text style={[styles.chipText, selected.length === 0 && styles.chipTextSelected]}>No preference</Text>
        </Pressable>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable key={option} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggle(option)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DiningCommonsGroup({ selected, onChange }: { selected: string[]; onChange: (items: string[]) => void }) {
  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Dining commons</Text>
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
            <Text style={[styles.commonName, isSelected && styles.commonNameSelected]}>{titleCase(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  header: { gap: 8 },
  heading: { color: colors.text, fontSize: 26, fontWeight: "800", lineHeight: 31 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  group: { gap: 10 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipSelected: { borderColor: colors.maroon, backgroundColor: colors.elevated },
  chipText: { color: colors.muted, fontWeight: "700" },
  chipTextSelected: { color: colors.text },
  commonRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  commonRowSelected: { borderColor: colors.maroon, backgroundColor: colors.elevated },
  commonDot: { width: 9, height: 9, borderRadius: 9 },
  commonName: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  commonNameSelected: { color: colors.text },
  field: { gap: 8 },
  textArea: {
    minHeight: 100,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
    textAlignVertical: "top"
  },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.maroon },
  primaryText: { color: colors.text, fontWeight: "800", fontSize: 16 }
});
