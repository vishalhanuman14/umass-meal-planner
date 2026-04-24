"""
llm_meal_plan.py — LLM-first weekly meal plan orchestrator.

Alternative to meal_plan.py. Skips the greedy optimizer entirely —
Gemini sees the full menu for each meal period and builds the meal from scratch.

Reuses: config loading, menu loading, home meal math from meal_plan.py.
New:    plan_dc_meal_llm() uses llm_planner.plan_meal_with_llm() instead of optimizer.

Usage:
    python -m planner.llm_meal_plan                    # full week, saves to data/
    python -m planner.llm_meal_plan --dry-run          # print, don't save
    python -m planner.llm_meal_plan --day monday       # single day
    python -m planner.llm_meal_plan --day friday --dry-run
"""

import argparse
import json
import logging
import sys
from datetime import date
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from planner.meal_plan import (
    home_meal_totals,
    DAYS_ORDER,
    load_config,
    load_menu,
)
from planner.llm_planner import plan_meal_with_llm
from planner.optimizer import get_items_flat, optimize, format_candidate

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = DATA_DIR / "logs"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "planner_llm.log"),
    ],
)
logger = logging.getLogger(__name__)


def _optimizer_fallback(day_meals: dict, period: str, cal_budget: float, prot_budget: float, cfg: dict) -> dict:
    """Greedy fallback if LLM call fails."""
    from planner.optimizer import get_items_flat, optimize, format_candidate
    items = get_items_flat(day_meals, period)
    candidates = optimize(items, cal_budget, prot_budget, cfg.get("optimizer", {}))
    if candidates:
        meal = format_candidate(candidates[0])
        meal["source"] = "optimizer_fallback"
        meal["period"] = period
        meal["note"] = "LLM planner unavailable — greedy fallback used."
        return meal
    return {
        "items": [], "meal_total": {"calories": 0, "protein_g": 0},
        "period": period, "source": "empty",
        "note": f"No items available for {period}.",
    }


def plan_dc_meal_llm(
    day_meals: dict,
    period: str,
    cal_budget: float,
    prot_budget: float,
    day_name: str,
    day_date: str,
    cfg: dict,
) -> dict:
    """Plan one DC meal using the LLM-first approach, with optimizer fallback."""
    meal = plan_meal_with_llm(period, day_name, day_date, day_meals, cal_budget, prot_budget, cfg)
    if meal is None:
        logger.warning("LLM failed for %s %s — using optimizer fallback.", day_name, period)
        meal = _optimizer_fallback(day_meals, period, cal_budget, prot_budget, cfg)
    return meal


def plan_day_llm(day_name: str, cfg: dict, day_meals: dict, day_date: str) -> dict:
    """Generate the full LLM-first meal plan for one day."""
    day_cfg = cfg.get("schedule", {}).get(day_name, {})
    targets = cfg.get("daily_targets", {"calories": 2200, "protein_g": 120})
    home_cal, home_prot = home_meal_totals(cfg)

    dc_budget_cal = targets["calories"] - home_cal
    dc_budget_prot = targets["protein_g"] - home_prot
    split = cfg.get("dc_meal_split", {"pre_shift_pct": 0.45, "post_shift_pct": 0.55})

    dc_meals_cfg = day_cfg.get("dc_meals")

    result = {
        "day": day_name,
        "date": day_date,
        "home_meals": {
            "breakfast": {
                "calories": int(home_cal - cfg["home_meals"]["dinner_at_home"]["calories"]),
                "protein_g": round(home_prot - cfg["home_meals"]["dinner_at_home"]["protein_g"], 1),
            },
            "dinner": {
                "calories": cfg["home_meals"]["dinner_at_home"]["calories"],
                "protein_g": cfg["home_meals"]["dinner_at_home"]["protein_g"],
            },
        },
        "dc_budget": {"calories": round(dc_budget_cal), "protein_g": round(dc_budget_prot, 1)},
        "dc_meals": {},
        "daily_total": {},
        "note": day_cfg.get("note", ""),
        "mode": "llm_free",
    }

    if dc_meals_cfg is None:
        result["note"] = day_cfg.get("note", f"Self-managed — aim for ~{int(dc_budget_cal)} cal, {int(dc_budget_prot)}g P.")
        result["daily_total"] = {"calories": int(targets["calories"]), "protein_g": targets["protein_g"]}
        return result

    email_times = day_cfg.get("email_times", {})
    shift = day_cfg.get("shift", {})

    if dc_meals_cfg == "flexible":
        meal = plan_dc_meal_llm(day_meals, "lunch", dc_budget_cal, dc_budget_prot,
                                 day_name, day_date, cfg)
        result["dc_meals"]["optional"] = meal
        result["note"] = day_cfg.get("note", "Free day — optional DC visit")
        result["daily_total"] = {
            "calories": int(home_cal + meal["meal_total"].get("calories", 0)),
            "protein_g": round(home_prot + meal["meal_total"].get("protein_g", 0), 1),
        }
        return result

    pre_cfg = dc_meals_cfg.get("pre_shift", {})
    post_cfg = dc_meals_cfg.get("post_shift", {})

    pre_cal = round(dc_budget_cal * split["pre_shift_pct"])
    pre_prot = round(dc_budget_prot * split["pre_shift_pct"], 1)
    post_cal = round(dc_budget_cal * split["post_shift_pct"])
    post_prot = round(dc_budget_prot * split["post_shift_pct"], 1)

    if pre_cfg:
        period = pre_cfg.get("period", "lunch")
        meal = plan_dc_meal_llm(day_meals, period, pre_cal, pre_prot, day_name, day_date, cfg)
        meal["eat_by"] = pre_cfg.get("eat_by", "")
        meal["email_time"] = email_times.get("pre_shift", "")
        meal["shift_start"] = shift.get("start", "")
        result["dc_meals"]["pre_shift"] = meal

    if post_cfg:
        period = post_cfg.get("period", "dinner")
        meal = plan_dc_meal_llm(day_meals, period, post_cal, post_prot, day_name, day_date, cfg)
        meal["eat_after"] = post_cfg.get("eat_after", "")
        meal["email_time"] = email_times.get("post_shift", "")
        meal["shift_end"] = shift.get("end", "")
        result["dc_meals"]["post_shift"] = meal

    dc_cal = sum(m.get("meal_total", {}).get("calories", 0) for m in result["dc_meals"].values())
    dc_prot = sum(m.get("meal_total", {}).get("protein_g", 0) for m in result["dc_meals"].values())
    result["daily_total"] = {
        "calories": int(home_cal + dc_cal),
        "protein_g": round(home_prot + dc_prot, 1),
    }
    return result


def generate_weekly_plan_llm(cfg: dict, menu: dict, days: list[str] | None = None) -> dict:
    days = days or DAYS_ORDER
    per_day = menu.get("days", {})
    global_meals = menu.get("meals", {})

    plan = {
        "week_of": menu.get("week_of", date.today().isoformat()),
        "generated_at": datetime.now(ZoneInfo("America/New_York")).isoformat(),
        "mode": "llm_free",
        "days": {},
    }
    for day in days:
        logger.info("Planning %s (LLM-free mode)...", day)
        day_data = per_day.get(day, {})
        day_meals = day_data.get("meals", global_meals)
        day_date = day_data.get("date", "")
        if not day_meals:
            logger.warning("No menu data for %s.", day)
        plan["days"][day] = plan_day_llm(day, cfg, day_meals, day_date)
    return plan


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def format_plan_txt_llm(plan: dict, cfg: dict) -> str:
    home = cfg.get("home_meals", {})
    bkfst_opts = home.get("breakfast", {}).get("options", [])
    bkfst_str = " / ".join(
        f"{o['name']} ({o['calories']} cal, {o['protein_g']}g P)" for o in bkfst_opts
    )
    dn = home.get("dinner_at_home", {})

    lines = [
        "╔══════════════════════════════════════════════════╗",
        f"  UMass Dining — LLM-Free Meal Plan",
        f"  Week of {plan['week_of']}",
        f"  Generated: {plan['generated_at']}",
        "╚══════════════════════════════════════════════════╝",
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

        lines.append(f"{'═' * 52}")
        lines.append(f"  {day_name.upper()}  [{day.get('date', '')}]")
        lines.append(f"{'═' * 52}")

        if day.get("note") and not day["dc_meals"]:
            lines.append(f"  {day['note']}")
            lines.append("")
            continue

        for slot, meal in day.get("dc_meals", {}).items():
            slot_label = slot.replace("_", " ").upper()
            period = meal.get("period", "").replace("_", " ").title()
            email_time = meal.get("email_time", "")
            time_str = f"  ▸ Email at {email_time}" if email_time else ""

            source = meal.get("source", "")
            source_badge = " [LLM ✓]" if source == "llm_free" else " [optimizer fallback]"

            lines.append(f"\n  [{slot_label}] Franklin DC — {period}{source_badge}{time_str}")
            lines.append(f"  {'─' * 48}")

            if not meal.get("items"):
                lines.append(f"  ⚠  {meal.get('note', 'No items.')}")
                continue

            for item in meal["items"]:
                name = item.get("item") or item.get("name", "?")
                svgs = item.get("servings", 1)
                cal = item.get("calories", 0)
                prot = item.get("protein_g", 0)
                lines.append(f"  • {name} × {svgs} serving{'s' if svgs > 1 else ''}")
                lines.append(f"      {cal} cal  |  {prot}g protein")

            t = meal.get("meal_total", {})
            lines.append(f"  {'─' * 48}")
            lines.append(
                f"  MEAL TOTAL:  {t.get('calories')} cal  |  {t.get('protein_g')}g protein"
            )

            taste = meal.get("taste_score")
            if taste:
                bar = "★" * taste + "☆" * (10 - taste)
                lines.append(f"  TASTE SCORE: {taste}/10  {bar}")

            reasoning = meal.get("reasoning", "")
            if reasoning:
                # Word-wrap at ~70 chars
                words = reasoning.split()
                current, wrapped = [], []
                for w in words:
                    if sum(len(x) + 1 for x in current) + len(w) > 70:
                        wrapped.append("  │  " + " ".join(current))
                        current = [w]
                    else:
                        current.append(w)
                if current:
                    wrapped.append("  │  " + " ".join(current))
                lines.append("  │")
                lines.extend(wrapped)

            fallback_note = meal.get("note", "")
            if fallback_note and source != "llm_free":
                lines.append(f"  ⚠  {fallback_note}")

        dt = day.get("daily_total", {})
        targets = cfg["daily_targets"]
        cal_diff = dt.get("calories", 0) - targets["calories"]
        prot_diff = dt.get("protein_g", 0) - targets["protein_g"]
        cal_sign = "+" if cal_diff >= 0 else ""
        prot_sign = "+" if prot_diff >= 0 else ""
        lines.append("")
        lines.append(
            f"  DAILY TOTAL: {dt.get('calories')} cal  |  {dt.get('protein_g')}g protein  "
            f"({cal_sign}{cal_diff} cal, {prot_sign}{round(prot_diff, 1)}g vs target)"
        )
        if day.get("note"):
            lines.append(f"  NOTE: {day['note']}")
        lines.append("")

    return "\n".join(lines)


def save_plan_llm(plan: dict, cfg: dict, dry_run: bool = False):
    txt = format_plan_txt_llm(plan, cfg)
    if dry_run:
        print(txt)
        return
    DATA_DIR.mkdir(exist_ok=True)
    with open(DATA_DIR / "weekly_plan_llm.json", "w") as f:
        json.dump(plan, f, indent=2)
    with open(DATA_DIR / "weekly_plan_llm.txt", "w") as f:
        f.write(txt)
    logger.info("Saved weekly_plan_llm.json and weekly_plan_llm.txt to data/")
    print(txt)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="LLM-free meal planner (no greedy optimizer)")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, don't save")
    parser.add_argument("--day", type=str, default=None, help="Plan only this day (e.g. monday)")
    args = parser.parse_args()

    cfg = load_config()
    menu = load_menu()
    if menu is None:
        sys.exit(1)

    days = [args.day.lower()] if args.day else None
    plan = generate_weekly_plan_llm(cfg, menu, days)
    save_plan_llm(plan, cfg, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
