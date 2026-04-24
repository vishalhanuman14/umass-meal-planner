"""
meal_plan.py — Main orchestrator: load menu + config → generate weekly meal plan.

Usage:
    python -m planner.meal_plan                        # generate this week's plan
    python -m planner.meal_plan --test --day monday    # test single day, don't save
    python -m planner.meal_plan --rescrape --day wed   # re-scrape then plan
    python -m planner.meal_plan --dry-run              # print plan, don't save
"""

import argparse
import json
import logging
import sys
from datetime import datetime, date
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from planner.optimizer import get_items_flat, optimize, format_candidate
from planner.llm_ranker import pick_best_meal

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "planner.log"),
    ],
)
logger = logging.getLogger(__name__)

DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def load_config() -> dict:
    with open(BASE_DIR / "config.yaml") as f:
        return yaml.safe_load(f)


def load_menu() -> dict | None:
    menu_path = DATA_DIR / "weekly_menu.json"
    if not menu_path.exists():
        logger.error("weekly_menu.json not found. Run the scraper first.")
        return None
    with open(menu_path) as f:
        return json.load(f)


def home_meal_totals(cfg: dict) -> tuple[float, float]:
    """Return (calories, protein_g) from home meals (breakfast + home dinner)."""
    hm = cfg.get("home_meals", {})

    # Breakfast: average strategy
    bkfst = hm.get("breakfast", {})
    strategy = bkfst.get("strategy", "average")
    options = bkfst.get("options", [])
    if strategy == "average" and options:
        bk_cal = sum(o["calories"] for o in options) / len(options)
        bk_prot = sum(o["protein_g"] for o in options) / len(options)
    elif options:
        bk_cal = options[0]["calories"]
        bk_prot = options[0]["protein_g"]
    else:
        bk_cal, bk_prot = 400, 16

    # Home dinner
    dinner = hm.get("dinner_at_home", {})
    dn_cal = dinner.get("calories", 500)
    dn_prot = dinner.get("protein_g", 40)

    return bk_cal + dn_cal, bk_prot + dn_prot


def plan_dc_meal(
    meals: dict,
    period: str,
    cal_budget: float,
    prot_budget: float,
    optimizer_cfg: dict,
) -> dict:
    """
    Generate one DC meal recommendation.
    Returns a meal dict with items, meal_total, source, and optional note.
    """
    items = get_items_flat(meals, period)
    if not items:
        logger.warning("No items available for period '%s'.", period)
        return {
            "items": [],
            "meal_total": {"calories": 0, "protein_g": 0},
            "period": period,
            "note": f"Franklin appears to have no {period} items this week — plan a home meal or visit another DC.",
            "source": "empty",
        }

    candidates_raw = optimize(items, cal_budget, prot_budget, optimizer_cfg)
    candidates = [format_candidate(c) for c in candidates_raw]

    if not candidates:
        logger.warning("Optimizer returned no candidates for period '%s'.", period)
        return {
            "items": [],
            "meal_total": {"calories": 0, "protein_g": 0},
            "period": period,
            "note": "Could not find a suitable meal combination — check the menu.",
            "source": "empty",
        }

    meal, llm_used = pick_best_meal(candidates, items, cal_budget, prot_budget)
    meal["period"] = period
    return meal


def plan_day(day_name: str, cfg: dict, meals: dict) -> dict:
    """Generate the full meal plan for one day."""
    day_cfg = cfg.get("schedule", {}).get(day_name, {})
    optimizer_cfg = cfg.get("optimizer", {})
    targets = cfg.get("daily_targets", {"calories": 2200, "protein_g": 120})
    home_cal, home_prot = home_meal_totals(cfg)

    dc_budget_cal = targets["calories"] - home_cal
    dc_budget_prot = targets["protein_g"] - home_prot
    split = cfg.get("dc_meal_split", {"pre_shift_pct": 0.45, "post_shift_pct": 0.55})

    dc_meals_cfg = day_cfg.get("dc_meals")

    result = {
        "day": day_name,
        "home_meals": {
            "breakfast": {"calories": int(home_cal - cfg["home_meals"]["dinner_at_home"]["calories"]),
                          "protein_g": round(home_prot - cfg["home_meals"]["dinner_at_home"]["protein_g"], 1)},
            "dinner": {"calories": cfg["home_meals"]["dinner_at_home"]["calories"],
                       "protein_g": cfg["home_meals"]["dinner_at_home"]["protein_g"]},
        },
        "dc_budget": {"calories": round(dc_budget_cal), "protein_g": round(dc_budget_prot, 1)},
        "dc_meals": {},
        "daily_total": {},
        "note": day_cfg.get("note", ""),
    }

    if dc_meals_cfg is None:
        # Tuesday — no DC access
        result["note"] = day_cfg.get(
            "note",
            f"Self-managed — aim for ~{int(dc_budget_cal)} cal, {int(dc_budget_prot)}g P from other sources.",
        )
        result["daily_total"] = {
            "calories": int(targets["calories"]),
            "protein_g": targets["protein_g"],
        }
        return result

    if dc_meals_cfg == "flexible":
        # Weekend — optional DC visit
        period = "lunch"
        meal = plan_dc_meal(meals, period, dc_budget_cal, dc_budget_prot, optimizer_cfg)
        result["dc_meals"]["optional"] = meal
        result["note"] = day_cfg.get("note", "Free day — optional DC visit")
        result["daily_total"] = {
            "calories": int(home_cal + meal["meal_total"].get("calories", 0)),
            "protein_g": round(home_prot + meal["meal_total"].get("protein_g", 0), 1),
        }
        return result

    # Shift day — pre + post meals
    pre_cfg = dc_meals_cfg.get("pre_shift", {})
    post_cfg = dc_meals_cfg.get("post_shift", {})

    pre_cal = round(dc_budget_cal * split["pre_shift_pct"])
    pre_prot = round(dc_budget_prot * split["pre_shift_pct"], 1)
    post_cal = round(dc_budget_cal * split["post_shift_pct"])
    post_prot = round(dc_budget_prot * split["post_shift_pct"], 1)

    email_times = day_cfg.get("email_times", {})
    shift = day_cfg.get("shift", {})

    if pre_cfg:
        period = pre_cfg.get("period", "lunch")
        pre_meal = plan_dc_meal(meals, period, pre_cal, pre_prot, optimizer_cfg)
        pre_meal["eat_by"] = pre_cfg.get("eat_by", "")
        pre_meal["email_time"] = email_times.get("pre_shift", "")
        pre_meal["shift_start"] = shift.get("start", "")
        result["dc_meals"]["pre_shift"] = pre_meal

    if post_cfg:
        period = post_cfg.get("period", "dinner")
        post_meal = plan_dc_meal(meals, period, post_cal, post_prot, optimizer_cfg)
        post_meal["eat_after"] = post_cfg.get("eat_after", "")
        post_meal["email_time"] = email_times.get("post_shift", "")
        post_meal["shift_end"] = shift.get("end", "")
        result["dc_meals"]["post_shift"] = post_meal

    # Daily total
    dc_cal = sum(
        m.get("meal_total", {}).get("calories", 0)
        for m in result["dc_meals"].values()
    )
    dc_prot = sum(
        m.get("meal_total", {}).get("protein_g", 0)
        for m in result["dc_meals"].values()
    )
    result["daily_total"] = {
        "calories": int(home_cal + dc_cal),
        "protein_g": round(home_prot + dc_prot, 1),
    }

    return result


def generate_weekly_plan(cfg: dict, menu: dict, days: list[str] | None = None) -> dict:
    days = days or DAYS_ORDER
    plan = {
        "week_of": menu.get("week_of", date.today().isoformat()),
        "generated_at": datetime.now(ZoneInfo("America/New_York")).isoformat(),
        "days": {},
    }

    # New format: menu["days"][day_name]["meals"]
    # Old/sample format: menu["meals"] (flat, used for testing)
    per_day = menu.get("days", {})
    global_meals = menu.get("meals", {})

    for day in days:
        logger.info("Planning %s...", day)
        day_meals = per_day.get(day, {}).get("meals", global_meals)
        if not day_meals:
            logger.warning("No menu data for %s — using empty meals.", day)
        plan["days"][day] = plan_day(day, cfg, day_meals)
    return plan


def format_plan_txt(plan: dict, cfg: dict) -> str:
    """Format the weekly plan as human-readable plain text."""
    home = cfg.get("home_meals", {})
    bkfst_opts = home.get("breakfast", {}).get("options", [])
    bkfst_str = " / ".join(f"{o['name']} ({o['calories']} cal, {o['protein_g']}g P)" for o in bkfst_opts)
    dn = home.get("dinner_at_home", {})

    lines = [
        f"╔══════════════════════════════════════════════════╗",
        f"  UMass Dining Meal Plan — Week of {plan['week_of']}",
        f"  Generated: {plan['generated_at']}",
        f"╚══════════════════════════════════════════════════╝",
        "",
        "HOME MEALS (every day):",
        f"  Breakfast: {bkfst_str}",
        f"  Home Dinner: {dn.get('name')} ({dn.get('calories')} cal, {dn.get('protein_g')}g P)",
        "",
    ]

    for day_name in DAYS_ORDER:
        day = plan["days"].get(day_name)
        if not day:
            continue

        lines.append(f"{'═'*52}")
        lines.append(f"  {day_name.upper()}")
        lines.append(f"{'═'*52}")

        if day.get("note") and not day["dc_meals"]:
            lines.append(f"  NOTE: {day['note']}")
            lines.append("")
            continue

        for slot, meal in day.get("dc_meals", {}).items():
            slot_label = slot.replace("_", " ").upper()
            period = meal.get("period", "").upper()
            email_time = meal.get("email_time", "")
            time_label = f"  Email at: {email_time}" if email_time else ""

            lines.append(f"\n  [{slot_label}] — Franklin DC {period}{time_label}")
            lines.append(f"  {'─'*46}")

            note = meal.get("note") or meal.get("note", "")
            if note and not meal.get("items"):
                lines.append(f"  ⚠ {note}")
                continue

            for item in meal.get("items", []):
                lines.append(
                    f"  • {item.get('item', item.get('name', '?'))} × {item.get('servings', 1)}"
                )
                lines.append(
                    f"      → {item.get('calories')} cal | {item.get('protein_g')}g P"
                )

            t = meal.get("meal_total", {})
            lines.append(f"  {'─'*46}")
            lines.append(f"  MEAL TOTAL: {t.get('calories')} cal | {t.get('protein_g')}g P")

            if meal.get("source") == "optimizer":
                lines.append("  ⚠ Taste optimizer unavailable — best macro-optimized option.")
            if meal.get("reasoning"):
                lines.append(f"  💬 {meal['reasoning']}")

        dt = day.get("daily_total", {})
        targets = cfg["daily_targets"]
        lines.append("")
        lines.append(
            f"  DAILY TOTAL: {dt.get('calories')} cal | {dt.get('protein_g')}g P"
            f"  (target: {targets['calories']} cal / {targets['protein_g']}g P)"
        )
        if day.get("note"):
            lines.append(f"  NOTE: {day['note']}")
        lines.append("")

    return "\n".join(lines)


def save_plan(plan: dict, cfg: dict, dry_run: bool = False):
    txt = format_plan_txt(plan, cfg)
    if dry_run:
        print(txt)
        return

    DATA_DIR.mkdir(exist_ok=True)
    with open(DATA_DIR / "weekly_plan.json", "w") as f:
        json.dump(plan, f, indent=2)
    with open(DATA_DIR / "weekly_plan.txt", "w") as f:
        f.write(txt)
    logger.info("Saved weekly_plan.json and weekly_plan.txt to data/")
    print(txt)


def main():
    parser = argparse.ArgumentParser(description="UMass meal planner")
    parser.add_argument("--test", action="store_true", help="Single day test, don't save")
    parser.add_argument("--day", type=str, default=None, help="Plan only this day (e.g. monday)")
    parser.add_argument("--dry-run", action="store_true", help="Print plan but don't save")
    parser.add_argument("--rescrape", action="store_true", help="Re-scrape before planning")
    args = parser.parse_args()

    if args.rescrape:
        import asyncio
        from scraper.auto_scrape import run_scrape, save_menu
        logger.info("Re-scraping menu...")
        menu = asyncio.run(run_scrape())
        if menu:
            save_menu(menu)
        else:
            logger.error("Re-scrape failed.")
            sys.exit(1)

    cfg = load_config()
    menu = load_menu()
    if menu is None:
        sys.exit(1)

    days = [args.day.lower()] if args.day else None
    plan = generate_weekly_plan(cfg, menu, days)
    save_plan(plan, cfg, dry_run=args.test or args.dry_run)


if __name__ == "__main__":
    main()
