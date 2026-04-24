import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { HttpError } from "./supabase.ts";

export type Profile = {
  id: string;
  email: string;
  name: string;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  gender: string | null;
  activity_level: string | null;
  goal: string | null;
  calorie_target: number | null;
  protein_target_g: number | null;
  fat_target_g: number | null;
  carbs_target_g: number | null;
  dietary_restrictions: string[];
  allergens: string[];
  preferred_dining_commons: string[];
  additional_preferences: string;
  onboarding_completed: boolean;
};

const PROFILE_SELECT = `
  id,
  email,
  name,
  height_cm,
  weight_kg,
  age,
  gender,
  activity_level,
  goal,
  calorie_target,
  protein_target_g,
  fat_target_g,
  carbs_target_g,
  dietary_restrictions,
  allergens,
  preferred_dining_commons,
  additional_preferences,
  onboarding_completed
`;

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Could not load profile: ${error.message}`, false);
  }

  if (!data) {
    throw new HttpError(404, "Profile not found");
  }

  return data as Profile;
}

function listText(values: string[] | null | undefined): string {
  if (!values || values.length === 0) {
    return "none";
  }

  return values.join(", ");
}

function targetText(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) {
    return "not set";
  }

  return `${value}${suffix}`;
}

export function formatProfileForPrompt(profile: Profile): string {
  return [
    `Name: ${profile.name || "student"}`,
    `Goal: ${profile.goal ?? "not set"} | Activity: ${profile.activity_level ?? "not set"}`,
    `Calories: ${targetText(profile.calorie_target)} | Protein: ${targetText(profile.protein_target_g, "g")} | Fat: ${targetText(profile.fat_target_g, "g")} | Carbs: ${targetText(profile.carbs_target_g, "g")}`,
    `Dietary restrictions: ${listText(profile.dietary_restrictions)}`,
    `Allergens to avoid: ${listText(profile.allergens)}`,
    `Preferred dining commons: ${listText(profile.preferred_dining_commons)}`,
    `Additional preferences: ${profile.additional_preferences || "none"}`,
  ].join("\n");
}
