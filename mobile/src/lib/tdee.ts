import type { ActivityLevel, Gender, Goal } from "../types";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

type CalculateTargetsInput = {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
};

export function poundsToKg(pounds: number) {
  return pounds * 0.45359237;
}

export function inchesToCm(inches: number) {
  return inches * 2.54;
}

export function kgToPounds(kg: number) {
  return kg / 0.45359237;
}

export function cmToInches(cm: number) {
  return cm / 2.54;
}

export function calculateTargets(input: CalculateTargetsInput) {
  const bmrBase = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const bmr = input.gender === "female" ? bmrBase - 161 : bmrBase + 5;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activityLevel];
  const calories = Math.max(
    1200,
    Math.round(input.goal === "lose" ? tdee - 500 : input.goal === "gain" ? tdee + 300 : tdee)
  );
  const weightLb = kgToPounds(input.weightKg);
  const protein = Math.round(weightLb * (input.goal === "maintain" ? 0.8 : 1));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    calorie_target: calories,
    protein_target_g: protein,
    fat_target_g: fat,
    carbs_target_g: carbs
  };
}
