"""
optimizer.py — Greedy macro optimizer for picking DC meals.

Given a list of available menu items and a calorie/protein budget,
returns ranked candidate meal combinations.
"""

import logging
from copy import deepcopy
from typing import Any

logger = logging.getLogger(__name__)


def score_item(item: dict) -> float:
    """Score an item by protein density (protein per calorie). Higher = better for muscle building."""
    cal = item.get("calories", 0)
    protein = item.get("protein_g", 0.0)
    if cal <= 0:
        return 0.0
    return protein / cal


def get_items_flat(meals: dict[str, Any], period: str) -> list[dict]:
    """Flatten all items from a meal period into a single list."""
    period_data = meals.get(period, {})
    items = []
    for category, cat_items in period_data.items():
        for item in cat_items:
            if item.get("nutrition_incomplete"):
                continue
            if item.get("calories", 0) <= 0:
                continue
            enriched = dict(item)
            enriched["category"] = category
            items.append(enriched)
    return items


def optimize(
    items: list[dict],
    calorie_target: float,
    protein_target: float,
    cfg: dict | None = None,
) -> list[list[dict]]:
    """
    Greedy optimizer: pick 2-5 items meeting the macro targets.

    Returns a list of up to `top_candidates` candidate meals.
    Each candidate is a list of selected item dicts with added 'servings' key.
    """
    cfg = cfg or {}
    min_items = cfg.get("min_items_per_meal", 2)
    max_items = cfg.get("max_items_per_meal", 5)
    max_servings = cfg.get("max_servings_per_item", 3)
    overshoot = cfg.get("calorie_overshoot_limit", 100)
    tolerance = cfg.get("target_tolerance_pct", 0.10)
    top_n = cfg.get("top_candidates", 5)

    if not items:
        logger.warning("No items available to optimize.")
        return []

    # Sort by protein density descending
    sorted_items = sorted(items, key=score_item, reverse=True)

    candidates = []

    # Generate candidates by starting from different "anchor" items
    for anchor_idx in range(min(len(sorted_items), top_n * 2)):
        meal = _build_meal(
            sorted_items,
            calorie_target,
            protein_target,
            anchor_idx,
            min_items,
            max_items,
            max_servings,
            overshoot,
            tolerance,
        )
        if meal and len(meal) >= min_items:
            candidates.append(meal)
        if len(candidates) >= top_n:
            break

    # Deduplicate by item name set
    seen = set()
    unique = []
    for meal in candidates:
        key = frozenset(i["name"] for i in meal)
        if key not in seen:
            seen.add(key)
            unique.append(meal)

    # Sort candidates by how close they get to both targets
    def score_meal(meal):
        total_cal = sum(i["calories"] * i["servings"] for i in meal)
        total_prot = sum(i["protein_g"] * i["servings"] for i in meal)
        cal_diff = abs(total_cal - calorie_target) / calorie_target
        prot_diff = max(0, protein_target - total_prot) / protein_target
        return cal_diff + prot_diff

    unique.sort(key=score_meal)
    return unique[:top_n]


def _build_meal(
    sorted_items: list[dict],
    cal_target: float,
    prot_target: float,
    anchor_idx: int,
    min_items: int,
    max_items: int,
    max_servings: int,
    overshoot: float,
    tolerance: float,
) -> list[dict] | None:
    """Build one candidate meal starting with the anchor item."""
    selected = []
    remaining_cal = cal_target
    remaining_prot = prot_target

    # Start with anchor
    anchor = deepcopy(sorted_items[anchor_idx])
    servings = _calc_servings(anchor, remaining_cal, remaining_prot, max_servings)
    if servings == 0:
        return None
    anchor["servings"] = servings
    selected.append(anchor)
    remaining_cal -= anchor["calories"] * servings
    remaining_prot -= anchor["protein_g"] * servings

    # Fill remaining slots
    for item in sorted_items:
        if len(selected) >= max_items:
            break
        if item["name"] in {s["name"] for s in selected}:
            continue
        if remaining_cal <= 0 and remaining_prot <= 0:
            break

        servings = _calc_servings(item, remaining_cal, remaining_prot, max_servings)
        if servings == 0:
            continue

        item_copy = deepcopy(item)
        item_copy["servings"] = servings
        selected.append(item_copy)
        remaining_cal -= item["calories"] * servings
        remaining_prot -= item["protein_g"] * servings

    if not selected:
        return None

    # Validate: don't overshoot calories by more than allowed
    total_cal = sum(i["calories"] * i["servings"] for i in selected)
    if total_cal > cal_target + overshoot:
        return None

    return selected


def _calc_servings(item: dict, remaining_cal: float, remaining_prot: float, max_servings: int) -> int:
    """Calculate optimal servings of one item given remaining budget."""
    cal = item.get("calories", 0)
    prot = item.get("protein_g", 0.0)

    if cal <= 0:
        return 0

    # How many servings fit in the calorie budget?
    max_by_cal = int(remaining_cal / cal) if remaining_cal > 0 else 0
    max_by_cal = min(max_by_cal, max_servings)

    if max_by_cal == 0:
        # Allow 1 serving even if slightly over budget (to reach min_items)
        if remaining_cal > -200:
            return 1
        return 0

    # Use as many as needed to hit protein target, up to cal limit
    if prot > 0 and remaining_prot > 0:
        needed_for_prot = int(remaining_prot / prot) + 1
        return max(1, min(needed_for_prot, max_by_cal))

    return 1


def format_candidate(meal: list[dict]) -> dict:
    """Format a candidate meal for output / display."""
    total_cal = round(sum(i["calories"] * i["servings"] for i in meal))
    total_prot = round(sum(i["protein_g"] * i["servings"] for i in meal), 1)
    total_fat = round(sum(i.get("fat_g", 0) * i["servings"] for i in meal), 1)
    total_carbs = round(sum(i.get("carbs_g", 0) * i["servings"] for i in meal), 1)

    items_out = [
        {
            "item": i["name"],
            "servings": i["servings"],
            "calories": round(i["calories"] * i["servings"]),
            "protein_g": round(i["protein_g"] * i["servings"], 1),
        }
        for i in meal
    ]

    return {
        "items": items_out,
        "meal_total": {
            "calories": total_cal,
            "protein_g": total_prot,
            "fat_g": total_fat,
            "carbs_g": total_carbs,
        },
    }
