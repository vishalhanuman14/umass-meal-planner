import type { MealPlan, MealPlanMeal } from "./types";

export const EASTERN_TIMEZONE = "America/New_York";

const commonColors = {
  worcester: "#2563EB",
  franklin: "#16A34A",
  hampshire: "#F59E0B",
  berkshire: "#EB1700",
} as const;

const commonLabels = {
  worcester: "Worcester",
  franklin: "Franklin",
  hampshire: "Hampshire",
  berkshire: "Berkshire",
} as const;

type DiningCommonKey = keyof typeof commonColors;

const periodOrder = ["breakfast", "lunch", "dinner", "late_night", "late night", "grabngo", "grab_go"];

function easternDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function todayIsoDateEastern(date = new Date()) {
  const { year, month, day } = easternDateParts(date);
  return `${year}-${month}-${day}`;
}

export function formatLongDateEastern(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTimeEastern(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function greetingForEasternTime(date = new Date()) {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(date),
    10,
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatMealMacro(meal: MealPlanMeal) {
  return `${Math.round(meal.meal_total.calories)} cal / ${Math.round(meal.meal_total.protein_g)}g protein`;
}

export function formatPreferredDiningCommons(value: string[] | null | undefined) {
  if (!value?.length) {
    return "Any commons";
  }

  return value.map((item) => getDiningCommon(item).label).join(", ");
}

export function getDiningCommon(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  const key = (Object.keys(commonColors) as DiningCommonKey[]).find((item) => normalized.includes(item));

  if (!key) {
    return {
      label: value ? titleCase(value) : "Dining commons",
      color: "#2563EB",
    };
  }

  return {
    label: commonLabels[key],
    color: commonColors[key],
  };
}

function currentPeriod(date = new Date()) {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(date),
    10,
  );

  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late_night";
}

export function sortMealPeriod([left]: [string, unknown], [right]: [string, unknown]) {
  const leftIndex = periodOrder.indexOf(left);
  const rightIndex = periodOrder.indexOf(right);

  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;
  return leftIndex - rightIndex;
}

export function chooseHeroMeal(entries: [string, MealPlanMeal][]) {
  const current = currentPeriod();

  return entries.find(([period]) => period === current) ?? entries.find(([period]) => period === "lunch") ?? entries[0] ?? null;
}

function isMealMap(value: MealPlan["meals"] | undefined): value is MealPlan["meals"] {
  return Boolean(value && typeof value === "object");
}

export function isCompletePlan(value: MealPlan | null | undefined): value is MealPlan {
  return Boolean(value?.daily_total && isMealMap(value.meals));
}
