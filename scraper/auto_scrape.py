"""
auto_scrape.py - Scraper for all UMass Amherst dining commons menus.

Uses the UMass Dining AJAX JSON endpoint first. Playwright is only used as a
fallback if the direct HTTP request is blocked.

Usage:
    python -m scraper.auto_scrape --all-commons
    python -m scraper.auto_scrape --all-commons --upload-supabase
    python -m scraper.auto_scrape --day 2026-04-24 --commons franklin
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import date as date_type
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
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
REQUEST_TIMEOUT = 20
DINING_COMMONS = {
    "worcester": {"tid": 1, "display_name": "Worcester"},
    "franklin": {"tid": 2, "display_name": "Franklin"},
    "hampshire": {"tid": 3, "display_name": "Hampshire"},
    "berkshire": {"tid": 4, "display_name": "Berkshire"},
}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
}


def _ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class _ItemHTMLParser(HTMLParser):
    """Extract menu item data attributes from a category HTML string."""

    def __init__(self):
        super().__init__()
        self.items: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if tag != "a":
            return
        data = dict(attrs)
        name = (data.get("data-dish-name") or "").strip()
        if not name:
            return

        def num(key: str, default: float = 0.0) -> float:
            raw = data.get(key, "") or ""
            match = re.search(r"[\d.]+", raw)
            return float(match.group()) if match else default

        tags = [
            tag.strip().lower()
            for tag in (data.get("data-clean-diet-str") or "").split(",")
            if tag.strip()
        ]

        self.items.append(
            {
                "name": name,
                "serving_size": (data.get("data-serving-size") or "1 serving").strip(),
                "calories": int(num("data-calories")),
                "protein_g": round(num("data-protein"), 1),
                "fat_g": round(num("data-total-fat"), 1),
                "carbs_g": round(num("data-total-carb"), 1),
                "fiber_g": round(num("data-dietary-fiber"), 1),
                "sodium_mg": int(num("data-sodium")),
                "dietary_tags": tags,
                "allergens": (data.get("data-allergens") or "").strip(),
                "ingredient_list": (data.get("data-ingredient-list") or "").strip(),
                "carbon_rating": (data.get("data-carbon-list") or "").strip(),
            }
        )


def _parse_category_html(html: str) -> list[dict[str, Any]]:
    parser = _ItemHTMLParser()
    parser.feed(html)
    return parser.items


def _normalize_period(period: str) -> str:
    return period.lower().strip().replace(" ", "_").replace("-", "_").replace("'", "")


def _headers_for(dining_commons: str) -> dict[str, str]:
    return {
        **HEADERS,
        "Referer": f"https://umassdining.com/locations-menus/{dining_commons}/menu",
    }


def _build_url(day_date: date_type, dining_commons: str) -> str:
    date_str = day_date.strftime("%m/%d/%Y")
    encoded = urllib.parse.quote(date_str, safe="")
    tid = DINING_COMMONS[dining_commons]["tid"]
    return f"{AJAX_BASE}?tid={tid}&date={encoded}"


def _parse_api_response(raw_json: Any) -> dict[str, dict[str, list[dict[str, Any]]]] | None:
    if not isinstance(raw_json, dict):
        return None

    meals: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for period, categories in raw_json.items():
        if not isinstance(categories, dict):
            continue
        period_key = _normalize_period(period)
        meals[period_key] = {}
        for station_name, station_html in categories.items():
            if not isinstance(station_html, str):
                continue
            items = _parse_category_html(station_html)
            if items:
                meals[period_key][station_name] = items

    return meals or None


def fetch_day_http(day_date: date_type, dining_commons: str) -> dict[str, Any] | None:
    url = _build_url(day_date, dining_commons)
    request = urllib.request.Request(url, headers=_headers_for(dining_commons))
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT, context=_ssl_context()) as response:
            raw_json = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        logger.warning("HTTP fetch failed for %s %s: %s", dining_commons, day_date, exc)
        return None

    meals = _parse_api_response(raw_json)
    if meals is None:
        logger.warning("No meal data parsed for %s %s.", dining_commons, day_date)
    return meals


async def _fetch_day_playwright(
    day_date: date_type,
    dining_commons: str,
    stealth: bool = False,
) -> dict[str, Any] | None:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not installed. Run: pip install playwright && playwright install chromium")
        return None

    url = _build_url(day_date, dining_commons)
    browser = None
    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(headless=True)
        except Exception as exc:
            logger.warning("Playwright browser launch failed: %s", exc)
            return None
        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1280, "height": 800},
            extra_http_headers=_headers_for(dining_commons),
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
        except Exception as exc:
            logger.warning("Playwright fetch failed for %s %s: %s", dining_commons, day_date, exc)
            if browser is not None:
                await browser.close()
            return None
        await browser.close()

    return _parse_api_response(raw_json)


def fetch_day(day_date: date_type, dining_commons: str) -> dict[str, Any] | None:
    logger.info("Fetching %s for %s...", dining_commons, day_date.isoformat())

    meals = fetch_day_http(day_date, dining_commons)
    if meals is not None:
        total = sum(len(items) for stations in meals.values() for items in stations.values())
        logger.info("HTTP OK - %s %s: %d periods, %d items", dining_commons, day_date, len(meals), total)
        return meals

    logger.warning("HTTP failed for %s %s, trying Playwright...", dining_commons, day_date)
    meals = asyncio.run(_fetch_day_playwright(day_date, dining_commons, stealth=False))
    if meals is None:
        meals = asyncio.run(_fetch_day_playwright(day_date, dining_commons, stealth=True))

    if meals is not None:
        total = sum(len(items) for stations in meals.values() for items in stations.values())
        logger.info("Playwright OK - %s %s: %d periods, %d items", dining_commons, day_date, len(meals), total)
    else:
        logger.error("All fetch methods failed for %s %s.", dining_commons, day_date)
    return meals


def _week_start(week_monday: str | None = None) -> date_type:
    ny_tz = ZoneInfo("America/New_York")
    today = datetime.now(ny_tz).date()
    if week_monday:
        return date_type.fromisoformat(week_monday)
    if today.weekday() == 6:
        return today + timedelta(days=1)
    return today - timedelta(days=today.weekday())


def _parse_commons(value: str | None, all_commons: bool) -> list[str]:
    if all_commons or not value:
        return list(DINING_COMMONS)
    names = [part.strip().lower() for part in value.split(",") if part.strip()]
    unknown = [name for name in names if name not in DINING_COMMONS]
    if unknown:
        raise ValueError(f"Unknown dining commons: {', '.join(unknown)}")
    return names


def run_scrape(
    week_monday: str | None = None,
    start_date: str | None = None,
    days: int = 7,
    commons: list[str] | None = None,
    request_delay: float = 1.0,
) -> dict[str, Any] | None:
    start = date_type.fromisoformat(start_date) if start_date else _week_start(week_monday)
    commons = commons or list(DINING_COMMONS)
    ny_tz = ZoneInfo("America/New_York")
    dates = [start + timedelta(days=offset) for offset in range(days)]

    logger.info(
        "Scraping %d day(s), %d dining commons, from %s",
        len(dates),
        len(commons),
        start.isoformat(),
    )

    scraped_days: dict[str, Any] = {}
    failed: list[dict[str, str]] = []
    success_count = 0

    for day_index, day_date in enumerate(dates):
        day_key = day_date.isoformat()
        scraped_days[day_key] = {"date": day_key, "commons": {}}
        for commons_index, dining_commons in enumerate(commons):
            raw = fetch_day(day_date, dining_commons)
            if raw is None:
                failed.append({"date": day_key, "dining_commons": dining_commons})
            else:
                normalized = normalize_menu(raw, deduplicate=False)
                scraped_days[day_key]["commons"][dining_commons] = {
                    "display_name": DINING_COMMONS[dining_commons]["display_name"],
                    "meals": normalized,
                }
                success_count += 1
                for warning in validate_menu({"meals": normalized}):
                    logger.warning("[%s %s] %s", day_key, dining_commons, warning)

            is_last = day_index == len(dates) - 1 and commons_index == len(commons) - 1
            if request_delay > 0 and not is_last:
                time.sleep(request_delay)

        if not scraped_days[day_key]["commons"]:
            scraped_days.pop(day_key)

    if success_count == 0:
        logger.error("All dining commons failed to scrape.")
        (DATA_DIR / ".scrape_failed").touch()
        return None

    failed_flag = DATA_DIR / ".scrape_failed"
    if failed_flag.exists():
        failed_flag.unlink()

    if failed:
        logger.warning("Partial scrape failures: %s", failed)

    return {
        "range_start": start.isoformat(),
        "range_end": dates[-1].isoformat(),
        "scraped_at": datetime.now(ny_tz).isoformat(),
        "dining_commons": commons,
        "days": scraped_days,
        "failed": failed,
    }


def save_menu(menu: dict[str, Any], path: Path | None = None):
    path = path or DATA_DIR / "weekly_menu.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as handle:
        json.dump(menu, handle, indent=2)
    logger.info("Saved menu to %s", path)


def print_summary(menu: dict[str, Any]):
    print(f"\nMenu range: {menu['range_start']} to {menu['range_end']}")
    print(f"Scraped at: {menu['scraped_at']}")
    failed = menu.get("failed", [])
    if failed:
        print(f"Partial failures: {len(failed)}")
    print()

    for day_key, day_data in menu.get("days", {}).items():
        print(f"{day_key}:")
        for dining_commons, commons_data in day_data.get("commons", {}).items():
            meals = commons_data.get("meals", {})
            total_items = sum(len(items) for stations in meals.values() for items in stations.values())
            period_names = ", ".join(meals.keys())
            print(f"  {dining_commons:<10} {len(meals)} periods [{period_names}], {total_items} items")
    print()


def _should_upload(args: argparse.Namespace) -> bool:
    if args.test or args.no_upload:
        return False
    if args.upload_supabase:
        return True
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def main():
    parser = argparse.ArgumentParser(description="UMass Dining menu scraper")
    parser.add_argument("--test", action="store_true", help="Scrape but do not save or upload")
    parser.add_argument("--week", type=str, default=None, metavar="YYYY-MM-DD", help="Monday date for a 7-day scrape")
    parser.add_argument("--start-date", type=str, default=None, metavar="YYYY-MM-DD", help="First date to scrape")
    parser.add_argument("--days", type=int, default=7, help="Number of days to scrape")
    parser.add_argument("--day", type=str, default=None, metavar="YYYY-MM-DD", help="Scrape a single date only")
    parser.add_argument("--commons", type=str, default=None, help="Comma-separated commons, e.g. franklin,berkshire")
    parser.add_argument("--all-commons", action="store_true", help="Scrape Worcester, Franklin, Hampshire, Berkshire")
    parser.add_argument("--request-delay", type=float, default=1.0, help="Delay between requests in seconds")
    parser.add_argument("--upload-supabase", action="store_true", help="Upload scraped rows to Supabase")
    parser.add_argument("--no-upload", action="store_true", help="Never upload to Supabase")
    args = parser.parse_args()

    try:
        commons = _parse_commons(args.commons, args.all_commons)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(2)

    if args.day:
        args.start_date = args.day
        args.days = 1

    menu = run_scrape(
        week_monday=args.week,
        start_date=args.start_date,
        days=args.days,
        commons=commons,
        request_delay=args.request_delay,
    )
    if menu is None:
        print("ERROR: Scraping failed for all dining commons. Check data/logs/scraper.log.", file=sys.stderr)
        sys.exit(1)

    print_summary(menu)

    if not args.test:
        save_menu(menu)
        print("Menu saved to data/weekly_menu.json")

    if _should_upload(args):
        from scraper.upload_to_supabase import upload_menu_payload

        summary = upload_menu_payload(menu)
        print(
            "Supabase upload complete: "
            f"{summary['rows']} row(s), {summary['days']} day(s), {summary['commons']} commons."
        )
    elif args.upload_supabase:
        print("Supabase upload skipped.", file=sys.stderr)


if __name__ == "__main__":
    main()
