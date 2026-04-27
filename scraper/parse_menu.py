"""
parse_menu.py — Normalize raw scraped data into clean weekly_menu.json format.
Used by both auto_scrape.py and manual_fallback.py.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def normalize_item(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a single menu item dict into a standard schema."""
    name = raw.get("name", "").strip()
    if not name:
        return None

    def to_int(val, default=0):
        if val is None:
            return default
        try:
            return int(re.sub(r"[^\d]", "", str(val)) or default)
        except (ValueError, TypeError):
            return default

    def to_float(val, default=0.0):
        if val is None:
            return default
        try:
            cleaned = re.sub(r"[^\d.]", "", str(val))
            return float(cleaned) if cleaned else default
        except (ValueError, TypeError):
            return default

    calories = to_int(raw.get("calories") or raw.get("cal"))
    calories_from_fat = to_int(raw.get("calories_from_fat") or raw.get("calories-from-fat"))
    total_fat_dv = to_int(raw.get("total_fat_dv") or raw.get("total-fat-dv"))
    saturated_fat_dv = to_int(raw.get("saturated_fat_dv") or raw.get("sat_fat_dv") or raw.get("sat-fat-dv"))
    cholesterol_dv = to_int(raw.get("cholesterol_dv") or raw.get("cholesterol-dv"))
    sodium_dv = to_int(raw.get("sodium_dv") or raw.get("sodium-dv"))
    carbs_dv = to_int(raw.get("carbs_dv") or raw.get("total_carb_dv") or raw.get("total-carb-dv"))
    fiber_dv = to_int(raw.get("fiber_dv") or raw.get("dietary_fiber_dv") or raw.get("dietary-fiber-dv"))
    sugars_dv = to_int(raw.get("sugars_dv") or raw.get("sugars-dv"))
    protein_dv = to_int(raw.get("protein_dv") or raw.get("protein-dv"))
    protein_g = to_float(raw.get("protein_g") or raw.get("protein"))
    fat_g = to_float(raw.get("fat_g") or raw.get("total_fat") or raw.get("fat"))
    saturated_fat_g = to_float(raw.get("saturated_fat_g") or raw.get("sat_fat") or raw.get("sat-fat"))
    trans_fat_g = to_float(raw.get("trans_fat_g") or raw.get("trans_fat") or raw.get("trans-fat"))
    carbs_g = to_float(raw.get("carbs_g") or raw.get("total_carbs") or raw.get("carbs"))
    fiber_g = to_float(raw.get("fiber_g") or raw.get("dietary_fiber") or raw.get("fiber"))
    sugars_g = to_float(raw.get("sugars_g") or raw.get("sugars") or raw.get("sugar"))
    sodium_mg = to_int(raw.get("sodium_mg") or raw.get("sodium"))
    cholesterol_mg = to_float(raw.get("cholesterol_mg") or raw.get("cholesterol"))
    healthfulness = to_int(raw.get("healthfulness"))
    serving_size = str(raw.get("serving_size") or "1 serving").strip()

    dietary_tags = raw.get("dietary_tags") or raw.get("tags") or []
    if isinstance(dietary_tags, str):
        dietary_tags = [t.strip() for t in dietary_tags.split(",") if t.strip()]

    carbon_rating = raw.get("carbon_rating") or raw.get("carbon") or ""
    allergens = str(raw.get("allergens") or "").strip()
    ingredient_list = str(raw.get("ingredient_list") or raw.get("ingredients") or "").strip()
    recipe_webcode = str(raw.get("recipe_webcode") or raw.get("recipe-webcode") or "").strip()

    nutrition_incomplete = (
        calories == 0 and protein_g == 0.0
    )

    item = {
        "name": name,
        "serving_size": serving_size,
        "calories": calories,
        "calories_from_fat": calories_from_fat,
        "total_fat_dv": total_fat_dv,
        "saturated_fat_dv": saturated_fat_dv,
        "cholesterol_dv": cholesterol_dv,
        "sodium_dv": sodium_dv,
        "carbs_dv": carbs_dv,
        "fiber_dv": fiber_dv,
        "sugars_dv": sugars_dv,
        "protein_dv": protein_dv,
        "protein_g": round(protein_g, 1),
        "fat_g": round(fat_g, 1),
        "saturated_fat_g": round(saturated_fat_g, 1),
        "trans_fat_g": round(trans_fat_g, 1),
        "carbs_g": round(carbs_g, 1),
        "fiber_g": round(fiber_g, 1),
        "sugars_g": round(sugars_g, 1),
        "sodium_mg": sodium_mg,
        "cholesterol_mg": round(cholesterol_mg, 1),
        "healthfulness": healthfulness,
        "dietary_tags": dietary_tags,
        "allergens": allergens,
        "ingredient_list": ingredient_list,
        "carbon_rating": carbon_rating,
        "recipe_webcode": recipe_webcode,
    }
    if nutrition_incomplete:
        item["nutrition_incomplete"] = True
        logger.warning("Item '%s' has no nutrition data.", name)

    return item


def normalize_menu(raw_meals: dict[str, Any], deduplicate: bool = True) -> dict[str, Any]:
    """
    Normalize raw meals dict into the standard meals schema.

    raw_meals: { "lunch": { "Grill Station": [ {raw item}, ... ], ... }, ... }
    Returns:   { "lunch": { "Grill Station": [ {normalized item}, ... ], ... }, ... }
    """
    normalized = {}
    seen_names: set[str] = set()

    for period, categories in raw_meals.items():
        period_key = period.lower().replace(" ", "_").replace("'", "")
        normalized[period_key] = {}

        for category, items in categories.items():
            norm_items = []
            for raw_item in items:
                item = normalize_item(raw_item)
                if item is None:
                    continue
                if deduplicate:
                    # Legacy weekly planner behavior: keep the first occurrence.
                    if item["name"] in seen_names:
                        logger.debug("Deduplicating '%s' in period '%s'.", item["name"], period_key)
                        continue
                    seen_names.add(item["name"])
                norm_items.append(item)
            if norm_items:
                normalized[period_key][category] = norm_items

    return normalized


def validate_menu(menu: dict[str, Any]) -> list[str]:
    """Return a list of validation warnings for a normalized menu."""
    warnings = []
    if not menu.get("meals"):
        warnings.append("Menu has no meals.")
        return warnings

    for period, categories in menu["meals"].items():
        total_items = sum(len(items) for items in categories.values())
        if total_items == 0:
            warnings.append(f"Period '{period}' has no items.")
        incomplete = sum(
            1
            for items in categories.values()
            for item in items
            if item.get("nutrition_incomplete")
        )
        if incomplete:
            warnings.append(f"Period '{period}': {incomplete} item(s) missing nutrition data.")

    return warnings
