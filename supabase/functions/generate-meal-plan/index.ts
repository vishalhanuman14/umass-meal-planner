import {
  authenticateRequest,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/supabase.ts";
import { GEMINI_FLASH_MODEL, generateGeminiText, parseGeminiJson } from "../_shared/gemini.ts";
import {
  fetchDiningCommonsMetadata,
  fetchMenuItems,
  formatMenuForPrompt,
  normalizeDiningCommons,
  todayInEasternTime,
  type MenuItem,
} from "../_shared/menu.ts";
import { fetchProfile, formatProfileForPrompt, type Profile } from "../_shared/profile.ts";

type GenerateRequestBody = {
  regenerate?: unknown;
  force?: unknown;
};

type MealPlan = {
  meals?: Record<string, MealPlanMeal>;
  daily_total?: Record<string, unknown>;
  reasoning?: string;
};

type MealPlanItem = {
  item?: unknown;
  servings?: unknown;
  calories?: unknown;
  protein_g?: unknown;
  fat_g?: unknown;
  carbs_g?: unknown;
  station?: unknown;
  serving_size?: unknown;
  total_fat_dv?: unknown;
  saturated_fat_dv?: unknown;
  cholesterol_dv?: unknown;
  sodium_dv?: unknown;
  carbs_dv?: unknown;
  fiber_dv?: unknown;
  sugars_dv?: unknown;
  protein_dv?: unknown;
  fiber_g?: unknown;
  sodium_mg?: unknown;
  sugars_g?: unknown;
  saturated_fat_g?: unknown;
  trans_fat_g?: unknown;
  cholesterol_mg?: unknown;
  healthfulness?: unknown;
  dietary_tags?: unknown;
  allergens?: unknown;
  ingredient_list?: unknown;
  carbon_rating?: unknown;
};

type MealPlanMeal = {
  dining_commons?: unknown;
  items?: MealPlanItem[];
  meal_total?: Record<string, unknown>;
};

const MACRO_TOTALS_SCHEMA = {
  type: "object",
  properties: {
    calories: { type: "integer" },
    protein_g: { type: "number" },
    fat_g: { type: "number" },
    carbs_g: { type: "number" },
  },
  required: ["calories", "protein_g", "fat_g", "carbs_g"],
  additionalProperties: false,
};

const MEAL_ITEM_SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string" },
    servings: { type: "integer" },
    calories: { type: "integer" },
    protein_g: { type: "number" },
    fat_g: { type: "number" },
    carbs_g: { type: "number" },
    station: { type: "string" },
  },
  required: ["item", "servings", "calories", "protein_g", "fat_g", "carbs_g", "station"],
  additionalProperties: false,
};

const MEAL_SCHEMA = {
  type: "object",
  properties: {
    dining_commons: { type: "string" },
    items: {
      type: "array",
      items: MEAL_ITEM_SCHEMA,
      minItems: 1,
      maxItems: 6,
    },
    meal_total: MACRO_TOTALS_SCHEMA,
  },
  required: ["dining_commons", "items", "meal_total"],
  additionalProperties: false,
};

const MEAL_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meals: {
      type: "object",
      properties: {
        breakfast: MEAL_SCHEMA,
        lunch: MEAL_SCHEMA,
        dinner: MEAL_SCHEMA,
      },
      required: ["breakfast", "lunch", "dinner"],
      additionalProperties: false,
    },
    daily_total: MACRO_TOTALS_SCHEMA,
    reasoning: { type: "string" },
  },
  required: ["meals", "daily_total", "reasoning"],
  additionalProperties: false,
};

function buildMealPlanPrompt(profile: Profile, date: string, menuText: string): string {
  return `You are a nutrition advisor for a UMass Amherst student.

STUDENT PROFILE
${formatProfileForPrompt(profile)}

TODAY'S MENU - ${date}
${menuText}

INSTRUCTIONS
Build one full-day meal plan using only exact items from today's menu.
- Include breakfast, lunch, and dinner.
- Respect all dietary restrictions.
- Never recommend items containing listed allergens.
- Meet calorie and macro targets as closely as possible.
- Prefer the user's preferred dining commons if set.
- Different meals may use different dining commons.
- For each item, include its exact station from the menu.
- Choose 3 to 6 items per meal.
- Servings must be positive integers.
- Do not include alternatives or list unused menu items.
- Keep reasoning brief.

Respond only with JSON in this shape:
{
  "meals": {
    "breakfast": {
      "dining_commons": "name",
      "items": [
        {"item": "exact name", "station": "exact station", "servings": 1, "calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
      ],
      "meal_total": {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    },
    "lunch": {
      "dining_commons": "name",
      "items": [],
      "meal_total": {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    },
    "dinner": {
      "dining_commons": "name",
      "items": [],
      "meal_total": {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    }
  },
  "daily_total": {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0},
  "reasoning": "brief explanation"
}`;
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function sameCommons(source: string, planned: string): boolean {
  if (!planned) return true;
  return source === planned || source.includes(planned) || planned.includes(source);
}

function findSourceItem(
  menuItems: MenuItem[],
  period: string,
  diningCommons: unknown,
  plannedItem: MealPlanItem,
): MenuItem | null {
  const itemName = normalized(plannedItem.item);
  const station = normalized(plannedItem.station);
  const commons = normalized(diningCommons);
  const exactPeriod = normalized(period);

  const candidates = menuItems.filter((item) =>
    normalized(item.item_name) === itemName &&
    sameCommons(normalized(item.dining_commons), commons) &&
    normalized(item.meal_period) === exactPeriod
  );

  if (station) {
    const stationMatch = candidates.find((item) => normalized(item.station) === station);
    if (stationMatch) return stationMatch;
  }

  return candidates[0] ?? menuItems.find((item) =>
    normalized(item.item_name) === itemName &&
    sameCommons(normalized(item.dining_commons), commons)
  ) ?? null;
}

function scaled(value: number, servings: unknown): number {
  const count = typeof servings === "number" && Number.isFinite(servings) ? servings : 1;
  return Math.round(value * count * 10) / 10;
}

function enrichMealPlan(plan: MealPlan, menuItems: MenuItem[]): MealPlan {
  if (!plan.meals) return plan;

  for (const [period, meal] of Object.entries(plan.meals)) {
    if (!Array.isArray(meal.items)) continue;

    meal.items = meal.items.map((item) => {
      const source = findSourceItem(menuItems, period, meal.dining_commons, item);
      if (!source) return item;

      return {
        ...item,
        station: source.station,
        serving_size: source.serving_size,
        total_fat_dv: Math.round(scaled(source.total_fat_dv, item.servings)),
        saturated_fat_dv: Math.round(scaled(source.saturated_fat_dv, item.servings)),
        cholesterol_dv: Math.round(scaled(source.cholesterol_dv, item.servings)),
        sodium_dv: Math.round(scaled(source.sodium_dv, item.servings)),
        carbs_dv: Math.round(scaled(source.carbs_dv, item.servings)),
        fiber_dv: Math.round(scaled(source.fiber_dv, item.servings)),
        sugars_dv: Math.round(scaled(source.sugars_dv, item.servings)),
        protein_dv: Math.round(scaled(source.protein_dv, item.servings)),
        fiber_g: scaled(source.fiber_g, item.servings),
        sodium_mg: Math.round(scaled(source.sodium_mg, item.servings)),
        sugars_g: scaled(source.sugars_g, item.servings),
        saturated_fat_g: scaled(source.saturated_fat_g, item.servings),
        trans_fat_g: scaled(source.trans_fat_g, item.servings),
        cholesterol_mg: scaled(source.cholesterol_mg, item.servings),
        healthfulness: source.healthfulness,
        dietary_tags: source.dietary_tags ?? [],
        allergens: source.allergens ?? "",
        ingredient_list: source.ingredient_list ?? "",
        carbon_rating: source.carbon_rating ?? "",
      };
    });
  }

  return plan;
}

function validateMealPlan(plan: MealPlan): void {
  if (!plan || typeof plan !== "object") {
    throw new HttpError(502, "Meal plan response was not an object");
  }

  if (!plan.meals || typeof plan.meals !== "object") {
    throw new HttpError(502, "Meal plan response missing meals");
  }

  if (!plan.daily_total || typeof plan.daily_total !== "object") {
    throw new HttpError(502, "Meal plan response missing daily_total");
  }

  for (const period of ["breakfast", "lunch", "dinner"]) {
    if (!(period in plan.meals)) {
      throw new HttpError(502, `Meal plan response missing ${period}`);
    }
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) {
    return cors;
  }

  try {
    requirePost(req);
    const body = await readJsonBody<GenerateRequestBody>(req);
    const regenerate = body.regenerate === true || body.force === true;
    const { supabase, user } = await authenticateRequest(req);
    const date = todayInEasternTime();

    if (!regenerate) {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan_json, generated_at")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      if (error) {
        throw new HttpError(500, `Could not load cached meal plan: ${error.message}`, false);
      }

      if (data) {
        return jsonResponse({
          date,
          cached: true,
          generated_at: data.generated_at,
          plan: data.plan_json,
        });
      }
    }

    const profile = await fetchProfile(supabase, user.id);
    if (!profile.onboarding_completed) {
      throw new HttpError(400, "Complete onboarding before generating a meal plan");
    }

    const preferredCommons = normalizeDiningCommons(profile.preferred_dining_commons);
    const menuItems = await fetchMenuItems(supabase, date, preferredCommons);
    if (menuItems.length === 0) {
      return jsonResponse({
        date,
        cached: false,
        plan: null,
        error: "Menu not available yet",
      });
    }

    const metadata = await fetchDiningCommonsMetadata(supabase, preferredCommons);
    const prompt = buildMealPlanPrompt(profile, date, formatMenuForPrompt(menuItems, { metadata }));
    const raw = await generateGeminiText(prompt, {
      model: GEMINI_FLASH_MODEL,
      response_mime_type: "application/json",
      responseJsonSchema: MEAL_PLAN_RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const plan = enrichMealPlan(parseGeminiJson<MealPlan>(raw), menuItems);
    validateMealPlan(plan);

    const generatedAt = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("meal_plans")
      .upsert(
        {
          user_id: user.id,
          date,
          plan_json: plan,
          generated_at: generatedAt,
        },
        { onConflict: "user_id,date" },
      );

    if (upsertError) {
      throw new HttpError(500, `Could not save meal plan: ${upsertError.message}`, false);
    }

    return jsonResponse({
      date,
      cached: false,
      generated_at: generatedAt,
      plan,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
