"""
llm_planner.py — LLM-first meal planner.

Instead of running a greedy optimizer first and handing the LLM a shortlist,
this module gives Gemini the full menu for a meal period and lets it build
the meal from scratch using detailed nutritional constraints and taste context.

The prompt is intentionally richer and more explicit than the ranker prompt:
  - Exact per-meal calorie/protein targets with tolerances
  - Taste preferences ranked by priority
  - Full item list with all macro data
  - Hard constraints on servings and item count
  - Asks for a taste_score so you can see how well it aligned

Rate limiting: same 7-second inter-call throttle as llm_ranker.py (shared state).
"""

import json
import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from planner.optimizer import get_items_flat

logger = logging.getLogger(__name__)

# Shared rate-limit state (module-level, so it works even if both modules are imported)
_CALL_INTERVAL = 7.0
_last_call_time: float = 0.0


def _throttle():
    global _last_call_time
    elapsed = time.monotonic() - _last_call_time
    if elapsed < _CALL_INTERVAL:
        wait = _CALL_INTERVAL - elapsed
        logger.info("Rate limit: waiting %.1fs before Gemini call...", wait)
        time.sleep(wait)
    _last_call_time = time.monotonic()


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_menu_table(items: list[dict]) -> str:
    """Format all menu items as a clean table grouped by category."""
    by_cat: dict[str, list[dict]] = {}
    for item in items:
        cat = item.get("category", "General")
        by_cat.setdefault(cat, []).append(item)

    lines = []
    for cat, cat_items in by_cat.items():
        lines.append(f"\n[{cat}]")
        for it in cat_items:
            tags = ", ".join(it.get("dietary_tags", [])) or "—"
            allergens = it.get("allergens", "").strip() or "none"
            lines.append(
                f"  • {it['name']}"
                f" | {it['calories']} cal"
                f" | {it['protein_g']}g protein"
                f" | {it.get('fat_g', 0)}g fat"
                f" | {it.get('carbs_g', 0)}g carbs"
                f" | serving: {it.get('serving_size', '?')}"
                f" | tags: {tags}"
                f" | allergens: {allergens}"
            )
    return "\n".join(lines)


def _build_prompt(
    period: str,
    day_name: str,
    day_date: str,
    items: list[dict],
    cal_target: float,
    prot_target: float,
    cfg: dict,
) -> str:
    prefs = cfg.get("taste_preferences", {})
    loves = prefs.get("loves", [])
    dislikes = prefs.get("dislikes", [])
    cuisine = prefs.get("cuisine", "indian")
    opt = cfg.get("optimizer", {})
    min_items = opt.get("min_items_per_meal", 2)
    max_items = opt.get("max_items_per_meal", 5)
    max_svgs = opt.get("max_servings_per_item", 3)
    overshoot = opt.get("calorie_overshoot_limit", 50)
    tol_pct = opt.get("target_tolerance_pct", 0.10)
    cal_lo = int(cal_target * (1 - tol_pct))
    cal_hi = int(cal_target + overshoot)
    prot_lo = round(prot_target * (1 - tol_pct), 1)
    prot_hi = round(prot_target * (1 + tol_pct), 1)

    menu_table = _build_menu_table(items)

    return f"""You are a precision meal planner for a college student at UMass Amherst.

════════════════════════════════════════
STUDENT PROFILE
════════════════════════════════════════
Goal: Build muscle — macros are non-negotiable.
Cuisine preference: {cuisine.title()} — bold, spiced, layered flavors.

Taste ranking (what to prioritise, in order):
  1. LOVES: {', '.join(loves[:6])}
  2. LOVES: Bold seasonings — anything with cumin, turmeric, garam masala, chili, coriander
  3. LIKES: Well-seasoned proteins (tandoori > tikka > BBQ > lemon-herb >> plain/unseasoned)
  4. LIKES: Rice dishes (basmati, jasmine, cumin rice), flatbreads (naan, pita, roti)
  5. LIKES: Legumes — dal, chana, chickpeas, black beans, rajma
  6. TOLERATES: Mildly seasoned dishes if needed to hit protein
  7. DISLIKES: {', '.join(dislikes)}
  8. No allergies. Halal preferred but not required.

════════════════════════════════════════
HARD EXCLUSIONS — NEVER pick these
════════════════════════════════════════
  ✗ BEEF of any kind — no burgers, no beef tacos, no beef meatballs, no beef stir-fry, nothing
  ✗ PLANT-BASED / VEGAN MEAT ALTERNATIVES — no plant-based chicken, plant-based meatballs,
    plant-based chorizo, plant-based burger, Beyond Meat, Impossible, vegan "protein" patties,
    or any item whose name includes "plant-based", "vegan meat", or "meatless" protein substitute
  If an item is ambiguous (e.g. "Meatballs"), assume it is beef/pork and skip it unless the
  menu explicitly says chicken, turkey, lamb, or fish.

════════════════════════════════════════
THIS MEAL TARGET
════════════════════════════════════════
Day: {day_name.title()}, {day_date}
Meal period: {period.replace('_', ' ').title()} at Franklin Dining Commons

Calorie target:  {cal_target:.0f} cal  (acceptable range: {cal_lo}–{cal_hi} cal)
Protein target:  {prot_target:.1f}g    (acceptable range: {prot_lo}–{prot_hi}g)

Hard constraints:
  - Pick {min_items}–{max_items} items from the menu below
  - Each item: 1–{max_svgs} servings (you decide the number)
  - Do NOT exceed {cal_hi} total calories
  - Do NOT go below {prot_lo}g total protein
  - NEVER pick beef or plant-based/vegan meat alternatives (see HARD EXCLUSIONS above)
  - Prefer fewer items at higher servings over many items at 1 serving
  - If two options are equally good nutritionally, always pick the tastier one
  - If the menu has no Indian food, find the next boldest/most-seasoned option

Fiber / digestion (soft target):
  - Aim for ≥5g fiber across this meal
  - Achieve this through vegetables, legumes (chickpeas, lentils, beans), or whole grains
  - If hitting the fiber target would push calories over the ceiling, skip it and note why

════════════════════════════════════════
FULL MENU — {period.upper()} ({len(items)} items)
════════════════════════════════════════
{menu_table}

════════════════════════════════════════
INSTRUCTIONS
════════════════════════════════════════
Build the best possible meal for this student.

Verify your maths: calories = sum(item_calories × servings), same for protein.
If you cannot hit the protein floor without exceeding the calorie ceiling, prioritise protein.

Respond ONLY in this exact JSON — no markdown fences, no extra text:
{{
  "meal": [
    {{"item": "<exact name from menu>", "servings": <int>, "calories": <int>, "protein_g": <float>}},
    ...
  ],
  "meal_total": {{"calories": <int>, "protein_g": <float>}},
  "taste_score": <int 1-10>,
  "reasoning": "<one paragraph: why this meal, why these servings, how it fits the student>"
}}"""


# ---------------------------------------------------------------------------
# Core LLM call
# ---------------------------------------------------------------------------

def plan_meal_with_llm(
    period: str,
    day_name: str,
    day_date: str,
    day_meals: dict,
    cal_target: float,
    prot_target: float,
    cfg: dict,
) -> dict | None:
    """
    Ask Gemini to build a meal from scratch given the full menu.

    Returns a meal dict with 'meal', 'meal_total', 'taste_score', 'reasoning',
    or None on failure.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — LLM planner unavailable.")
        return None

    try:
        from google import genai
    except ImportError:
        logger.warning("google-genai not installed.")
        return None

    items = get_items_flat(day_meals, period)
    if not items:
        logger.warning("No items for period '%s' on %s.", period, day_name)
        return None

    prompt = _build_prompt(period, day_name, day_date, items, cal_target, prot_target, cfg)
    _throttle()

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        raw = response.text.strip()
        result = json.loads(raw)

        if "meal" not in result or "meal_total" not in result:
            raise ValueError("Missing required keys in LLM response.")

        # Rename 'meal' → 'items' to match internal format
        result["items"] = result.pop("meal")
        result["source"] = "llm_free"
        result["period"] = period

        logger.info(
            "LLM planner [%s %s]: %d cal | %sg P | taste %s/10 | %s",
            day_name, period,
            result["meal_total"].get("calories", 0),
            result["meal_total"].get("protein_g", 0),
            result.get("taste_score", "?"),
            result.get("reasoning", "")[:60],
        )
        return result

    except Exception as e:
        logger.warning("LLM planner failed for %s %s: %s", day_name, period, e)
        return None
