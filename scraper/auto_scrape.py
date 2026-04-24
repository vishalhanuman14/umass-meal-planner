"""
auto_scrape.py — Scraper for UMass Franklin Dining Commons menu.

Uses the direct AJAX JSON endpoint — no browser/Playwright needed for primary scrape.
Falls back to Playwright + stealth only if Cloudflare blocks the plain HTTP request.

API endpoint:
    https://umassdining.com/foodpro-menu-ajax?tid=2&date=MM%2FDD%2FYYYY

Response format:
    {
      "lunch":  { "Grill Station": "<html with <li> items>", ... },
      "dinner": { "Soups": "<html>", ... },
      ...
    }
    All nutrition data lives in data-* attributes on <a> tags inside the HTML strings.

Usage:
    python -m scraper.auto_scrape                        # full week, save to data/weekly_menu.json
    python -m scraper.auto_scrape --test                 # scrape but don't save, print summary
    python -m scraper.auto_scrape --week 2026-03-30      # specific week (provide Monday date)
    python -m scraper.auto_scrape --day 2026-03-29       # single date (debug, never saves)
"""

import argparse
import asyncio
import json
import logging
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, date as date_type
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

from scraper.parse_menu import normalize_menu, validate_menu

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "scraper.log"),
    ],
)
logger = logging.getLogger(__name__)

AJAX_BASE = "https://umassdining.com/foodpro-menu-ajax"
LOCATION_ID = 2          # Franklin Dining Commons tid
REQUEST_TIMEOUT = 20     # seconds
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://umassdining.com/locations-menus/franklin/menu",
}


# ---------------------------------------------------------------------------
# HTML parser for the category HTML strings returned by the API
# ---------------------------------------------------------------------------

class _ItemHTMLParser(HTMLParser):
    """Extract menu items from a category's HTML string."""

    def __init__(self):
        super().__init__()
        self.items: list[dict] = []
        self._in_anchor = False

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        d = dict(attrs)
        name = d.get("data-dish-name", "").strip()
        if not name:
            return

        def num(key: str, default: float = 0.0) -> float:
            raw = d.get(key, "") or ""
            m = re.search(r"[\d.]+", raw)
            return float(m.group()) if m else default

        # Dietary tags from data-clean-diet-str
        tags = [
            t.strip().lower()
            for t in (d.get("data-clean-diet-str") or "").split(",")
            if t.strip()
        ]

        self.items.append({
            "name": name,
            "serving_size": (d.get("data-serving-size") or "1 serving").strip(),
            "calories": int(num("data-calories")),
            "protein_g": round(num("data-protein"), 1),
            "fat_g": round(num("data-total-fat"), 1),
            "carbs_g": round(num("data-total-carb"), 1),
            "fiber_g": round(num("data-dietary-fiber"), 1),
            "sodium_mg": int(num("data-sodium")),
            "dietary_tags": tags,
            "carbon_rating": d.get("data-carbon-list", ""),
            "allergens": (d.get("data-allergens") or "").strip(),
        })


def _parse_category_html(html: str) -> list[dict]:
    p = _ItemHTMLParser()
    p.feed(html)
    return p.items


def _build_url(date: date_type) -> str:
    """Return the AJAX URL for a given date."""
    date_str = date.strftime("%m/%d/%Y")        # e.g. "03/29/2026"
    encoded = urllib.parse.quote(date_str, safe="")  # "03%2F29%2F2026"
    return f"{AJAX_BASE}?tid={LOCATION_ID}&date={encoded}"


# ---------------------------------------------------------------------------
# Primary: plain HTTP request
# ---------------------------------------------------------------------------

def fetch_day_http(day_date: date_type) -> dict | None:
    """
    Fetch one day's menu via the AJAX endpoint using a plain HTTP request.
    Returns raw meals dict  { "lunch": { "Category": [items] } }  or None on failure.
    """
    url = _build_url(day_date)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw_json = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("HTTP fetch failed for %s: %s", day_date, e)
        return None

    if not isinstance(raw_json, dict):
        logger.warning("Unexpected response type for %s: %s", day_date, type(raw_json))
        return None

    # Parse HTML in each category
    meals: dict[str, dict[str, list]] = {}
    for period, categories in raw_json.items():
        if not isinstance(categories, dict):
            continue
        period_key = period.lower().strip()
        meals[period_key] = {}
        for cat_name, cat_html in categories.items():
            if not isinstance(cat_html, str):
                continue
            items = _parse_category_html(cat_html)
            if items:
                meals[period_key][cat_name] = items

    if not meals:
        logger.warning("No meal data parsed for %s.", day_date)
        return None

    return meals


# ---------------------------------------------------------------------------
# Fallback: Playwright (only if HTTP is blocked)
# ---------------------------------------------------------------------------

async def _fetch_day_playwright(day_date: date_type, stealth: bool = False) -> dict | None:
    """
    Playwright fallback: navigate to the AJAX URL directly inside a headless browser
    to bypass Cloudflare, then read the JSON from the page body.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not installed. Run: pip install playwright && playwright install chromium")
        return None

    url = _build_url(day_date)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1280, "height": 800},
            extra_http_headers=HEADERS,
        )
        if stealth:
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
            )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            body = await page.locator("body").inner_text()
            raw_json = json.loads(body)
        except Exception as e:
            logger.warning("Playwright fetch failed for %s: %s", day_date, e)
            await browser.close()
            return None
        await browser.close()

    if not isinstance(raw_json, dict):
        return None

    meals: dict[str, dict[str, list]] = {}
    for period, categories in raw_json.items():
        if not isinstance(categories, dict):
            continue
        meals[period.lower().strip()] = {
            cat: _parse_category_html(html)
            for cat, html in categories.items()
            if isinstance(html, str) and _parse_category_html(html)
        }
    return meals or None


def fetch_day(day_date: date_type) -> dict | None:
    """
    Fetch one day's raw meals dict. Tries plain HTTP first, then Playwright fallback.
    """
    logger.info("Fetching %s (%s)...", day_date.strftime("%A"), day_date.isoformat())

    meals = fetch_day_http(day_date)
    if meals is not None:
        total = sum(len(items) for cats in meals.values() for items in cats.values())
        logger.info("  HTTP OK — %d periods, %d items", len(meals), total)
        return meals

    logger.warning("  HTTP failed, trying Playwright...")
    meals = asyncio.run(_fetch_day_playwright(day_date, stealth=False))
    if meals is None:
        logger.warning("  Playwright failed, trying stealth mode...")
        meals = asyncio.run(_fetch_day_playwright(day_date, stealth=True))

    if meals is not None:
        total = sum(len(items) for cats in meals.values() for items in cats.values())
        logger.info("  Playwright OK — %d periods, %d items", len(meals), total)
    else:
        logger.error("  All methods failed for %s.", day_date)

    return meals


# ---------------------------------------------------------------------------
# Weekly scrape
# ---------------------------------------------------------------------------

def run_scrape(week_monday: str | None = None) -> dict | None:
    """
    Scrape all 7 days of the week (Mon–Sun), one HTTP call per day.

    week_monday: ISO date string (YYYY-MM-DD) for the Monday to start from.
                 Defaults: if today is Sunday → next Mon; else → this week's Mon.
    """
    ny_tz = ZoneInfo("America/New_York")
    today = datetime.now(ny_tz).date()

    if week_monday:
        monday = date_type.fromisoformat(week_monday)
    elif today.weekday() == 6:   # Sunday
        monday = today + timedelta(days=1)
    else:
        monday = today - timedelta(days=today.weekday())

    week_days = [
        ("monday",    monday + timedelta(days=0)),
        ("tuesday",   monday + timedelta(days=1)),
        ("wednesday", monday + timedelta(days=2)),
        ("thursday",  monday + timedelta(days=3)),
        ("friday",    monday + timedelta(days=4)),
        ("saturday",  monday + timedelta(days=5)),
        ("sunday",    monday + timedelta(days=6)),
    ]

    logger.info("Scraping week of %s (Mon %s → Sun %s)",
                monday, week_days[0][1], week_days[6][1])

    scraped_days: dict = {}
    failed_days: list[str] = []

    for day_name, day_date in week_days:
        raw = fetch_day(day_date)
        if raw is None:
            failed_days.append(day_name)
            continue
        normalized = normalize_menu(raw)
        scraped_days[day_name] = {"date": day_date.isoformat(), "meals": normalized}
        for w in validate_menu({"meals": normalized}):
            logger.warning("[%s] %s", day_name, w)

    if not scraped_days:
        logger.error("All days failed to scrape.")
        (DATA_DIR / ".scrape_failed").touch()
        return None

    failed_flag = DATA_DIR / ".scrape_failed"
    if failed_flag.exists():
        failed_flag.unlink()

    if failed_days:
        logger.warning("Failed days: %s", ", ".join(failed_days))

    return {
        "week_of": monday.isoformat(),
        "scraped_at": datetime.now(ny_tz).isoformat(),
        "dining_commons": "franklin",
        "days": scraped_days,
        "failed_days": failed_days,
    }


def save_menu(menu: dict, path: Path | None = None):
    path = path or DATA_DIR / "weekly_menu.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(menu, f, indent=2)
    logger.info("Saved menu to %s", path)


def print_summary(menu: dict):
    print(f"\nMenu for week of: {menu['week_of']}")
    print(f"Scraped at:       {menu['scraped_at']}")
    failed = menu.get("failed_days", [])
    if failed:
        print(f"  ⚠ Failed days:  {', '.join(failed)}")
    print()
    for day_name, day_data in menu.get("days", {}).items():
        periods = day_data.get("meals", {})
        total_items = sum(
            len(items) for cats in periods.values() for items in cats.values()
        )
        period_names = ", ".join(periods.keys())
        print(f"  {day_name:<10} ({day_data['date']}): "
              f"{len(periods)} periods [{period_names}], {total_items} items")
    print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="UMass Franklin menu scraper")
    parser.add_argument("--test", action="store_true",
                        help="Scrape but don't save; print summary only")
    parser.add_argument("--week", type=str, default=None, metavar="YYYY-MM-DD",
                        help="Monday date of the week to scrape (default: current/upcoming week)")
    parser.add_argument("--day", type=str, default=None, metavar="YYYY-MM-DD",
                        help="Scrape a single date only (debug, never saves)")
    args = parser.parse_args()

    if args.day:
        day_date = date_type.fromisoformat(args.day)
        raw = fetch_day(day_date)
        if raw is None:
            print(f"Scrape failed for {args.day}.")
            sys.exit(1)
        norm = normalize_menu(raw)
        print(f"\n{args.day}:")
        for period, cats in norm.items():
            total = sum(len(v) for v in cats.values())
            print(f"  {period}: {len(cats)} categories, {total} items")
            for cat, items in cats.items():
                print(f"    [{cat}]")
                for item in items:
                    print(f"      • {item['name']} — {item['calories']} cal, {item['protein_g']}g P")
        return

    menu = run_scrape(week_monday=args.week)
    if menu is None:
        print("ERROR: Scraping failed. Check data/logs/scraper.log for details.", file=sys.stderr)
        sys.exit(1)

    print_summary(menu)

    if not args.test:
        save_menu(menu)
        print(f"Menu saved to data/weekly_menu.json")
    else:
        print("TEST MODE — not saved.")


if __name__ == "__main__":
    main()
