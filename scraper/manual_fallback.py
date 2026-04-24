"""
manual_fallback.py — CLI tool for manually providing menu data when scraping fails.

Approaches:
  1. --paste     : paste raw JSON from browser DevTools network tab
  2. --html FILE : parse a saved .html file
  3. --interactive: step-by-step CLI entry with USDA nutrition lookup

Usage:
    python -m scraper.manual_fallback --paste
    python -m scraper.manual_fallback --html data/saved_page.html
    python -m scraper.manual_fallback --interactive
"""

import argparse
import json
import logging
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path

from scraper.parse_menu import normalize_menu, validate_menu

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_DIR / "scraper.log")],
)
logger = logging.getLogger(__name__)

USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search"
MEAL_PERIODS = ["breakfast", "lunch", "dinner", "late_night"]


# ---------------------------------------------------------------------------
# Approach 1: Paste JSON
# ---------------------------------------------------------------------------

def from_paste() -> dict | None:
    print("Paste the JSON from the browser DevTools network response below.")
    print("Press Ctrl+D (Linux/Mac) or Ctrl+Z then Enter (Windows) when done:\n")
    lines = []
    try:
        for line in sys.stdin:
            lines.append(line)
    except KeyboardInterrupt:
        pass
    raw_text = "".join(lines).strip()
    if not raw_text:
        print("No input received.")
        return None
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}")
        return None
    return _coerce_to_raw_meals(data)


def _coerce_to_raw_meals(data) -> dict:
    """Try to interpret arbitrary pasted JSON as a meals dict."""
    if isinstance(data, dict):
        # If it already looks like our format
        if "meals" in data:
            return data["meals"]
        # If it has period keys
        if any(k in data for k in MEAL_PERIODS + ["Breakfast", "Lunch", "Dinner"]):
            return data
        # Wrap everything under "lunch" as a guess
        return {"lunch": {"General": data if isinstance(data, list) else [data]}}
    if isinstance(data, list):
        return {"lunch": {"General": data}}
    return {}


# ---------------------------------------------------------------------------
# Approach 2: Parse saved HTML
# ---------------------------------------------------------------------------

def from_html(html_path: str) -> dict | None:
    from html.parser import HTMLParser

    path = Path(html_path)
    if not path.exists():
        print(f"File not found: {html_path}")
        return None

    content = path.read_text(errors="ignore")
    meals: dict[str, dict[str, list]] = {}

    # Look for JSON data embedded in <script> tags (common in SPA sites)
    script_blocks = re.findall(r"<script[^>]*>(.*?)</script>", content, re.DOTALL | re.IGNORECASE)
    for block in script_blocks:
        # Try to find JSON objects that look like menu data
        json_matches = re.finditer(r'\{[^{}]{50,}\}', block)
        for m in json_matches:
            try:
                obj = json.loads(m.group())
                if "name" in obj and ("calories" in obj or "protein" in obj):
                    period = obj.get("meal_period", "lunch").lower()
                    cat = obj.get("category", "General")
                    meals.setdefault(period, {}).setdefault(cat, []).append(obj)
            except Exception:
                pass

    if meals:
        logger.info("Extracted %d periods from HTML script blocks.", len(meals))
        return meals

    # Fallback: scrape item names from visible text
    class MenuParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.items = []
            self._in_item = False
            self._current = ""

        def handle_starttag(self, tag, attrs):
            attrs_dict = dict(attrs)
            cls = attrs_dict.get("class", "")
            if "menu-item" in cls or "shortmenu-item" in cls:
                self._in_item = True
                self._current = ""

        def handle_endtag(self, tag):
            if self._in_item and tag in ("li", "div", "a"):
                name = self._current.strip()
                if name:
                    self.items.append({"name": name})
                self._in_item = False

        def handle_data(self, data):
            if self._in_item:
                self._current += data

    parser = MenuParser()
    parser.feed(content)

    if parser.items:
        logger.info("Found %d item names from HTML (no nutrition data).", len(parser.items))
        print(f"Found {len(parser.items)} item names but no nutrition data in the saved HTML.")
        print("Nutrition popups are loaded dynamically and won't be in a saved page.")
        print("Switching to interactive mode for nutrition lookup...\n")
        return _interactive_with_items([i["name"] for i in parser.items])

    print("Could not extract menu data from the saved HTML file.")
    return None


# ---------------------------------------------------------------------------
# Approach 3: Interactive CLI with USDA lookup
# ---------------------------------------------------------------------------

def usda_lookup(query: str) -> dict | None:
    """Query USDA FoodData Central for approximate nutrition."""
    params = urllib.parse.urlencode({"query": query, "pageSize": 1, "dataType": "Foundation,SR Legacy"})
    url = f"{USDA_BASE}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
        foods = data.get("foods", [])
        if not foods:
            return None
        food = foods[0]
        nutrients = {n["nutrientName"].lower(): n["value"] for n in food.get("foodNutrients", [])}

        def n(key, default=0):
            for k, v in nutrients.items():
                if key in k:
                    return v
            return default

        return {
            "calories": int(n("energy")),
            "protein_g": round(n("protein"), 1),
            "fat_g": round(n("total lipid"), 1),
            "carbs_g": round(n("carbohydrate"), 1),
            "fiber_g": round(n("fiber"), 1),
            "sodium_mg": int(n("sodium")),
            "serving_size": "100g (USDA estimate)",
        }
    except Exception as e:
        logger.debug("USDA lookup failed for '%s': %s", query, e)
        return None


def _interactive_with_items(prefilled_names: list[str] | None = None) -> dict:
    meals: dict[str, dict[str, list]] = {}

    print("=== Manual Menu Entry ===")
    print("Periods: breakfast, lunch, dinner, late_night")

    while True:
        period = input("\nEnter meal period (or 'done' to finish): ").strip().lower()
        if period == "done":
            break
        if period not in MEAL_PERIODS:
            print(f"Unknown period. Choose from: {', '.join(MEAL_PERIODS)}")
            continue

        cat = input(f"Category name for {period} (e.g. 'Grill Station'): ").strip() or "General"
        meals.setdefault(period, {}).setdefault(cat, [])

        names = prefilled_names or []
        if names:
            print(f"Pre-loaded {len(names)} item names from HTML. Enter empty line to use them.")
            use = input("Use pre-loaded items for this period? [Y/n]: ").strip().lower()
            if use != "n":
                for name in names:
                    print(f"\n  Item: {name}")
                    lookup = usda_lookup(name)
                    item = {"name": name}
                    if lookup:
                        print(f"  USDA estimate: {lookup['calories']} cal, {lookup['protein_g']}g protein")
                        use_lookup = input("  Use this estimate? [Y/n]: ").strip().lower()
                        if use_lookup != "n":
                            item.update(lookup)
                    else:
                        print("  No USDA match found. Enter manually or leave blank to skip.")
                        _manual_nutrition_entry(item)
                    meals[period][cat].append(item)
                continue

        print(f"Enter items for {period} > {cat} (empty name to stop):")
        while True:
            name = input("  Item name: ").strip()
            if not name:
                break

            item = {"name": name}
            print(f"  Looking up USDA nutrition for '{name}'...")
            lookup = usda_lookup(name)
            if lookup:
                print(f"  Found: {lookup['calories']} cal, {lookup['protein_g']}g protein "
                      f"({lookup['serving_size']})")
                use = input("  Accept? [Y/n/edit]: ").strip().lower()
                if use == "n":
                    _manual_nutrition_entry(item)
                elif use == "edit":
                    item.update(lookup)
                    _manual_nutrition_entry(item)
                else:
                    item.update(lookup)
            else:
                print("  No USDA match. Enter manually:")
                _manual_nutrition_entry(item)

            meals[period][cat].append(item)

    return meals


def _manual_nutrition_entry(item: dict):
    def prompt(field, default=0):
        val = input(f"    {field} [{default}]: ").strip()
        try:
            return type(default)(val) if val else default
        except ValueError:
            return default

    item["serving_size"] = input(f"    serving_size [{item.get('serving_size', '1 serving')}]: ").strip() or item.get("serving_size", "1 serving")
    item["calories"] = prompt("calories", item.get("calories", 0))
    item["protein_g"] = prompt("protein_g", item.get("protein_g", 0.0))
    item["fat_g"] = prompt("fat_g", item.get("fat_g", 0.0))
    item["carbs_g"] = prompt("carbs_g", item.get("carbs_g", 0.0))


def interactive() -> dict | None:
    return _interactive_with_items()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_and_save(raw_meals: dict, output_path: Path | None = None):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    ny_tz = ZoneInfo("America/New_York")
    normalized = normalize_menu(raw_meals)
    menu = {
        "week_of": datetime.now(ny_tz).strftime("%Y-%m-%d"),
        "scraped_at": datetime.now(ny_tz).isoformat(),
        "dining_commons": "franklin",
        "source": "manual",
        "meals": normalized,
    }
    warnings = validate_menu(menu)
    for w in warnings:
        logger.warning("Validation: %s", w)

    output_path = output_path or DATA_DIR / "weekly_menu.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(menu, f, indent=2)
    print(f"\nSaved menu to {output_path}")

    for period, cats in normalized.items():
        total = sum(len(v) for v in cats.values())
        print(f"  {period}: {len(cats)} categories, {total} items")


def main():
    parser = argparse.ArgumentParser(description="Manual menu fallback tool")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--paste", action="store_true", help="Paste JSON from DevTools")
    group.add_argument("--html", type=str, metavar="FILE", help="Parse saved HTML file")
    group.add_argument("--interactive", action="store_true", help="Interactive CLI entry")
    parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    args = parser.parse_args()

    raw_meals = None
    if args.paste:
        raw_meals = from_paste()
    elif args.html:
        raw_meals = from_html(args.html)
    elif args.interactive:
        raw_meals = interactive()

    if not raw_meals:
        print("No menu data collected. Exiting.")
        sys.exit(1)

    output = Path(args.output) if args.output else None
    build_and_save(raw_meals, output)


if __name__ == "__main__":
    main()
