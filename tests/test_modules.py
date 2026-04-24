"""
test_modules.py — Unit tests for each module.

Run with: python -m pytest tests/ -v
Or individually: python tests/test_modules.py
"""

import json
import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

SAMPLE_MENU = BASE_DIR / "tests" / "sample_menu.json"


# ---------------------------------------------------------------------------
# parse_menu tests
# ---------------------------------------------------------------------------

class TestParseMenu(unittest.TestCase):
    def test_normalize_item_basic(self):
        from scraper.parse_menu import normalize_item
        raw = {"name": "Scrambled Eggs", "calories": "180", "protein_g": "12.0", "fat_g": "14"}
        item = normalize_item(raw)
        self.assertEqual(item["name"], "Scrambled Eggs")
        self.assertEqual(item["calories"], 180)
        self.assertEqual(item["protein_g"], 12.0)

    def test_normalize_item_missing_name(self):
        from scraper.parse_menu import normalize_item
        self.assertIsNone(normalize_item({"calories": 100}))

    def test_normalize_item_marks_incomplete(self):
        from scraper.parse_menu import normalize_item
        item = normalize_item({"name": "Mystery Food", "calories": 0, "protein_g": 0})
        self.assertTrue(item.get("nutrition_incomplete"))

    def test_normalize_menu_deduplication(self):
        from scraper.parse_menu import normalize_menu
        raw = {
            "lunch": {"Grill": [{"name": "Chicken", "calories": 200, "protein_g": 25}]},
            "dinner": {"Grill": [{"name": "Chicken", "calories": 200, "protein_g": 25}]},
        }
        result = normalize_menu(raw)
        lunch_items = result.get("lunch", {}).get("Grill", [])
        dinner_items = result.get("dinner", {}).get("Grill", [])
        # Chicken should appear only once across periods
        all_names = [i["name"] for items in [lunch_items, dinner_items] for i in items]
        self.assertEqual(all_names.count("Chicken"), 1)

    def test_validate_menu_no_meals(self):
        from scraper.parse_menu import validate_menu
        warnings = validate_menu({"meals": {}})
        self.assertTrue(any("no items" in w.lower() or "no meals" in w.lower() for w in warnings))


# ---------------------------------------------------------------------------
# optimizer tests
# ---------------------------------------------------------------------------

class TestOptimizer(unittest.TestCase):
    def setUp(self):
        with open(SAMPLE_MENU) as f:
            self.menu = json.load(f)

    def _monday_meals(self):
        return self.menu["days"]["monday"]["meals"]

    def test_get_items_flat(self):
        from planner.optimizer import get_items_flat
        items = get_items_flat(self._monday_meals(), "lunch")
        self.assertGreater(len(items), 0)
        for item in items:
            self.assertIn("calories", item)
            self.assertIn("protein_g", item)

    def test_optimize_returns_candidates(self):
        from planner.optimizer import get_items_flat, optimize
        items = get_items_flat(self._monday_meals(), "lunch")
        candidates = optimize(items, calorie_target=600, protein_target=40)
        self.assertGreater(len(candidates), 0)

    def test_optimize_respects_calorie_limit(self):
        from planner.optimizer import get_items_flat, optimize
        items = get_items_flat(self._monday_meals(), "lunch")
        cal_target = 600
        candidates = optimize(items, calorie_target=cal_target, protein_target=30)
        for meal in candidates:
            total_cal = sum(i["calories"] * i["servings"] for i in meal)
            self.assertLessEqual(total_cal, cal_target + 100)

    def test_optimize_min_items(self):
        from planner.optimizer import get_items_flat, optimize
        items = get_items_flat(self._monday_meals(), "lunch")
        candidates = optimize(items, calorie_target=600, protein_target=30)
        for meal in candidates:
            self.assertGreaterEqual(len(meal), 2)

    def test_format_candidate(self):
        from planner.optimizer import get_items_flat, optimize, format_candidate
        items = get_items_flat(self._monday_meals(), "lunch")
        candidates = optimize(items, calorie_target=600, protein_target=30)
        if candidates:
            formatted = format_candidate(candidates[0])
            self.assertIn("items", formatted)
            self.assertIn("meal_total", formatted)
            self.assertIn("calories", formatted["meal_total"])
            self.assertIn("protein_g", formatted["meal_total"])

    def test_empty_items(self):
        from planner.optimizer import optimize
        result = optimize([], calorie_target=600, protein_target=30)
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# meal_plan tests
# ---------------------------------------------------------------------------

class TestMealPlan(unittest.TestCase):
    def setUp(self):
        import yaml
        with open(BASE_DIR / "config.yaml") as f:
            self.cfg = yaml.safe_load(f)
        with open(SAMPLE_MENU) as f:
            self.menu = json.load(f)

    def test_home_meal_totals(self):
        from planner.meal_plan import home_meal_totals
        cal, prot = home_meal_totals(self.cfg)
        self.assertAlmostEqual(cal, 900, delta=50)   # ~400 bkfst + 500 dinner
        self.assertAlmostEqual(prot, 56, delta=5)    # ~16 + 40

    def test_plan_day_monday(self):
        from planner.meal_plan import plan_day
        result = plan_day("monday", self.cfg, self.menu["days"]["monday"]["meals"])
        self.assertEqual(result["day"], "monday")
        self.assertIn("pre_shift", result["dc_meals"])
        self.assertIn("post_shift", result["dc_meals"])

    def test_plan_day_tuesday_no_dc(self):
        from planner.meal_plan import plan_day
        result = plan_day("tuesday", self.cfg, self.menu["days"]["tuesday"]["meals"])
        self.assertEqual(result["dc_meals"], {})
        self.assertIn("note", result)

    def test_plan_day_saturday_flexible(self):
        from planner.meal_plan import plan_day
        result = plan_day("saturday", self.cfg, self.menu["days"]["saturday"]["meals"])
        self.assertIn("optional", result["dc_meals"])

    def test_generate_weekly_plan(self):
        from planner.meal_plan import generate_weekly_plan
        plan = generate_weekly_plan(self.cfg, self.menu, ["monday", "wednesday"])
        self.assertIn("monday", plan["days"])
        self.assertIn("wednesday", plan["days"])

    def test_format_plan_txt(self):
        from planner.meal_plan import generate_weekly_plan, format_plan_txt
        plan = generate_weekly_plan(self.cfg, self.menu, ["monday"])
        txt = format_plan_txt(plan, self.cfg)
        self.assertIn("MONDAY", txt)
        self.assertIn("cal", txt.lower())


# ---------------------------------------------------------------------------
# email_sender tests (no actual sending)
# ---------------------------------------------------------------------------

class TestEmailFormat(unittest.TestCase):
    def setUp(self):
        import yaml
        with open(BASE_DIR / "config.yaml") as f:
            self.cfg = yaml.safe_load(f)
        with open(SAMPLE_MENU) as f:
            self.menu = json.load(f)

    def test_format_meal_email_pre_shift(self):
        from planner.meal_plan import plan_day
        from notifier.email_sender import format_meal_email

        day_plan = plan_day("monday", self.cfg, self.menu["days"]["monday"]["meals"])
        meal = day_plan["dc_meals"].get("pre_shift", {})
        if not meal:
            self.skipTest("No pre_shift meal generated")

        subject, body = format_meal_email("monday", "pre_shift", meal, day_plan, self.cfg)
        self.assertIn("Pre-shift", subject)
        self.assertIn("FRANKLIN DINING", body)
        self.assertIn("MEAL TOTAL", body)
        self.assertIn("TODAY'S RUNNING TOTAL", body)

    def test_format_meal_email_post_shift(self):
        from planner.meal_plan import plan_day
        from notifier.email_sender import format_meal_email

        day_plan = plan_day("monday", self.cfg, self.menu["days"]["monday"]["meals"])
        meal = day_plan["dc_meals"].get("post_shift", {})
        if not meal:
            self.skipTest("No post_shift meal generated")

        subject, body = format_meal_email("monday", "post_shift", meal, day_plan, self.cfg)
        self.assertIn("Post-shift", subject)
        self.assertIn("MEAL TOTAL", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)
