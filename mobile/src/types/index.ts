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
  Home: undefined;
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
  servings: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
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
