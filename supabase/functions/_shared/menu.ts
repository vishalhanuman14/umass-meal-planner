import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { HttpError } from "./supabase.ts";

export type MenuItem = {
  id: string;
  date: string;
  dining_commons: string;
  meal_period: string;
  station: string;
  item_name: string;
  serving_size: string;
  calories: number;
  calories_from_fat: number;
  protein_g: number;
  fat_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  carbs_g: number;
  fiber_g: number;
  sugars_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  healthfulness: number;
  dietary_tags: string[];
  allergens: string;
  ingredient_list: string;
  carbon_rating: string;
  recipe_webcode: string;
};

const MENU_SELECT = `
  id,
  date,
  dining_commons,
  meal_period,
  station,
  item_name,
  serving_size,
  calories,
  calories_from_fat,
  protein_g,
  fat_g,
  saturated_fat_g,
  trans_fat_g,
  carbs_g,
  fiber_g,
  sugars_g,
  sodium_mg,
  cholesterol_mg,
  healthfulness,
  dietary_tags,
  allergens,
  ingredient_list,
  carbon_rating,
  recipe_webcode
`;

const VALID_COMMONS = new Set(["worcester", "franklin", "hampshire", "berkshire"]);

const COMMONS_LABELS: Record<string, string> = {
  worcester: "Worcester",
  franklin: "Franklin",
  hampshire: "Hampshire",
  berkshire: "Berkshire",
};

const COMMONS_CONTEXT: Record<string, string> = {
  worcester: "Worcester: regular dining hours Monday-Sunday 7 AM-midnight; Grab'n Go Monday-Friday 7 AM-8 PM.",
  franklin: "Franklin: regular dining hours Monday-Sunday 7 AM-9 PM; Grab'n Go Monday-Friday 10 AM-4 PM; Kosher dining Monday-Friday 7 AM-7 PM and Sunday 11:30 AM-7 PM.",
  hampshire: "Hampshire: regular dining hours Monday-Sunday 7 AM-9 PM; Grab'n Go Monday-Friday 7 AM-noon.",
  berkshire: "Berkshire: regular dining hours Monday-Sunday 11 AM-midnight; Grab'n Go Monday-Friday 7 AM-8 PM.",
};

export function todayInEasternTime(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function normalizeDiningCommons(values: string[] | null | undefined): string[] {
  if (!values) {
    return [];
  }

  const normalized = values
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter((value) => VALID_COMMONS.has(value));

  return [...new Set(normalized)];
}

export async function fetchMenuItems(
  supabase: SupabaseClient,
  date: string,
  diningCommons?: string[],
): Promise<MenuItem[]> {
  const commons = normalizeDiningCommons(diningCommons);
  let query = supabase
    .from("menu_items")
    .select(MENU_SELECT)
    .eq("date", date);

  if (commons.length > 0) {
    query = query.in("dining_commons", commons);
  }

  const { data, error } = await query
    .order("dining_commons", { ascending: true })
    .order("meal_period", { ascending: true })
    .order("station", { ascending: true })
    .order("item_name", { ascending: true });

  if (error) {
    throw new HttpError(500, `Could not load menu items: ${error.message}`, false);
  }

  return (data ?? []) as MenuItem[];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function tagsText(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) {
    return "none";
  }

  return tags.join(", ");
}

function diningCommonsContext(commons: string[]): string {
  const lines = commons
    .map((value) => COMMONS_CONTEXT[value])
    .filter((value): value is string => Boolean(value));

  if (lines.length === 0) {
    return "";
  }

  return ["DINING COMMONS CONTEXT", ...lines, ""].join("\n");
}

function periodLabel(period: string): string {
  return period.replace(/_/g, " ").toUpperCase();
}

export function formatMenuForPrompt(
  items: MenuItem[],
  options: { includeIngredients?: boolean } = {},
): string {
  if (items.length === 0) {
    return "No menu items are available for today.";
  }

  const lines: string[] = [];
  const commons = [...new Set(items.map((item) => item.dining_commons))];
  const context = diningCommonsContext(commons);
  if (context) {
    lines.push(context);
  }

  for (const diningCommons of commons) {
    lines.push(`=== ${COMMONS_LABELS[diningCommons] ?? diningCommons} ===`);
    const commonsItems = items.filter((item) => item.dining_commons === diningCommons);
    const periods = [...new Set(commonsItems.map((item) => item.meal_period))];

    for (const period of periods) {
      lines.push(`[${periodLabel(period)}]`);
      const periodItems = commonsItems.filter((item) => item.meal_period === period);

      for (const item of periodItems) {
        const allergens = item.allergens?.trim() || "none";
        const ingredients = options.includeIngredients && item.ingredient_list
          ? ` | ingredients: ${truncate(item.ingredient_list.trim(), 180)}`
          : "";
        const carbon = item.carbon_rating ? ` | carbon: ${item.carbon_rating}` : "";
        const health = item.healthfulness ? ` | healthfulness: ${item.healthfulness}/100` : "";

        lines.push(
          `- ${item.item_name} | station: ${item.station} | ${item.calories} cal | ${item.protein_g}g P | ${item.fat_g}g F | ${item.carbs_g}g C | fiber: ${item.fiber_g}g | sugar: ${item.sugars_g}g | sodium: ${item.sodium_mg}mg | serving: ${item.serving_size} | tags: ${tagsText(item.dietary_tags)} | allergens: ${allergens}${carbon}${health}${ingredients}`,
        );
      }
    }
  }

  return lines.join("\n");
}
