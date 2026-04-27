import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type Gender = "male" | "female" | "other";
export type Goal = "lose" | "gain" | "maintain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type AuthStackParamList = {
  SignIn: undefined;
};

export type OnboardingStackParamList = {
  BodyStats: undefined;
  Goals: undefined;
  Preferences: undefined;
};

export type MainStackParamList = {
  Home: { refreshPlanAt?: string } | undefined;
  Chat: undefined;
  Settings: undefined;
};

export type BodyStatsProps = NativeStackScreenProps<OnboardingStackParamList, "BodyStats">;
export type GoalsProps = NativeStackScreenProps<OnboardingStackParamList, "Goals">;
export type PreferencesProps = NativeStackScreenProps<OnboardingStackParamList, "Preferences">;
export type HomeProps = NativeStackScreenProps<MainStackParamList, "Home">;
export type ChatProps = NativeStackScreenProps<MainStackParamList, "Chat">;
export type SettingsProps = NativeStackScreenProps<MainStackParamList, "Settings">;

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  gender: Gender | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  calorie_target: number | null;
  protein_target_g: number | null;
  fat_target_g: number | null;
  carbs_target_g: number | null;
  dietary_restrictions: string[];
  allergens: string[];
  preferred_dining_commons: string[];
  additional_preferences: string | null;
  onboarding_completed: boolean;
};

export type ProfileDraft = Partial<Omit<Profile, "id" | "email">>;

export type MealPlanItem = {
  item: string;
  station?: string;
  serving_size?: string;
  servings: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  total_fat_dv?: number;
  saturated_fat_dv?: number;
  cholesterol_dv?: number;
  sodium_dv?: number;
  carbs_dv?: number;
  fiber_dv?: number;
  sugars_dv?: number;
  protein_dv?: number;
  fiber_g?: number;
  sodium_mg?: number;
  sugars_g?: number;
  saturated_fat_g?: number;
  trans_fat_g?: number;
  cholesterol_mg?: number;
  healthfulness?: number;
  dietary_tags?: string[];
  allergens?: string;
  ingredient_list?: string;
  carbon_rating?: string;
};

export type MealPlanMeal = {
  dining_commons: string;
  items: MealPlanItem[];
  meal_total: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
};

export type MealPlan = {
  meals: Record<string, MealPlanMeal>;
  daily_total: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
  reasoning?: string;
};

export type MealPlanRow = {
  id: string;
  user_id: string;
  date: string;
  plan_json: MealPlan;
  generated_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type DiningHour = {
  label?: string;
  days?: string;
  hours?: string;
  days_of_week?: string[];
  date_start?: string | null;
  date_end?: string | null;
  open_minutes?: number | null;
  close_minutes?: number | null;
};

export type DiningCommonsMetadata = {
  dining_commons: string;
  display_name: string;
  address: string;
  description: string;
  regular_hours: DiningHour[];
  special_hours: DiningHour[];
  payment_methods: string[];
  livestreams: { label?: string; url?: string }[];
  source_url: string;
  updated_at: string;
};
