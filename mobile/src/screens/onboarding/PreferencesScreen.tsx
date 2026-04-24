import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import OnboardingProgress from "../../components/OnboardingProgress";
import { useProfile } from "../../contexts/ProfileContext";
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
      <Text style={styles.heading}>Preferences</Text>

      <OptionGroup title="Dietary restrictions" options={dietaryOptions} selected={dietary} onChange={setDietary} />
      <OptionGroup title="Allergens" options={allergenOptions} selected={allergens} onChange={setAllergens} />
      <OptionGroup title="Dining commons" options={diningCommons} selected={preferred} onChange={setPreferred} />

      <View style={styles.field}>
        <Text style={styles.label}>Additional preferences</Text>
        <TextInput
          value={additional}
          onChangeText={setAdditional}
          multiline
          placeholder="I like spicy food, no raw fish..."
          placeholderTextColor="#748092"
          style={styles.textArea}
        />
      </View>

      <Pressable style={styles.primaryButton} onPress={completeSetup} disabled={saving}>
        {saving ? <ActivityIndicator color="#071018" /> : <Text style={styles.primaryText}>Complete setup</Text>}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f14" },
  content: { padding: 20, gap: 18 },
  heading: { color: "#f4f7fb", fontSize: 26, fontWeight: "800" },
  group: { gap: 10 },
  label: { color: "#aeb8c6", fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#111821"
  },
  chipSelected: { borderColor: "#8bd3ff", backgroundColor: "#173246" },
  chipText: { color: "#aeb8c6", fontWeight: "700" },
  chipTextSelected: { color: "#f4f7fb" },
  field: { gap: 8 },
  textArea: {
    minHeight: 100,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243041",
    color: "#f4f7fb",
    backgroundColor: "#111821",
    fontSize: 16,
    textAlignVertical: "top"
  },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#8bd3ff" },
  primaryText: { color: "#071018", fontWeight: "800", fontSize: 16 }
});
