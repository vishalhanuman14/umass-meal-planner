export type MealPlanItem = {
  item: string;
  station?: string;
  serving_size?: string;
  servings: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
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
  plan_json: MealPlan;
  generated_at: string;
};

export type ProfileSummary = {
  name: string | null;
  email: string;
  onboarding_completed: boolean;
  calorie_target: number | null;
  protein_target_g: number | null;
  preferred_dining_commons: string[];
};
