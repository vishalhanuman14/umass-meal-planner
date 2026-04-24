"""
Upload scraped UMass Dining menus to Supabase.

Expected payload shape is produced by scraper.auto_scrape.run_scrape().
Rows are upserted by date, dining_commons, meal_period, and item_name.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

UPSERT_CONFLICT = "date,dining_commons,meal_period,item_name"
BATCH_SIZE = 500


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, service_role_key)


def flatten_menu_payload(menu: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for day_key, day_data in menu.get("days", {}).items():
        for dining_commons, commons_data in day_data.get("commons", {}).items():
            meals = commons_data.get("meals", {})
            for meal_period, stations in meals.items():
                for station, items in stations.items():
                    for item in items:
                        rows.append(
                            {
                                "date": day_data.get("date") or day_key,
                                "dining_commons": dining_commons,
                                "meal_period": meal_period,
                                "station": station,
                                "item_name": item.get("name", ""),
                                "serving_size": item.get("serving_size") or "1 serving",
                                "calories": int(item.get("calories") or 0),
                                "protein_g": float(item.get("protein_g") or 0),
                                "fat_g": float(item.get("fat_g") or 0),
                                "carbs_g": float(item.get("carbs_g") or 0),
                                "fiber_g": float(item.get("fiber_g") or 0),
                                "sodium_mg": int(item.get("sodium_mg") or 0),
                                "dietary_tags": item.get("dietary_tags") or [],
                                "allergens": item.get("allergens") or "",
                                "ingredient_list": item.get("ingredient_list") or "",
                                "carbon_rating": item.get("carbon_rating") or "",
                            }
                        )
    return [row for row in rows if row["item_name"]]


def _chunks(rows: list[dict[str, Any]], size: int = BATCH_SIZE):
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def upload_menu_payload(menu: dict[str, Any], client: Client | None = None) -> dict[str, int]:
    rows = flatten_menu_payload(menu)
    if not rows:
        raise RuntimeError("No menu item rows found in scrape payload.")

    client = client or get_supabase_client()

    for batch in _chunks(rows):
        response = client.table("menu_items").upsert(batch, on_conflict=UPSERT_CONFLICT).execute()
        if getattr(response, "error", None):
            raise RuntimeError(str(response.error))

    cutoff = date.today() - timedelta(days=14)
    stale_response = client.table("menu_items").delete().lt("date", cutoff.isoformat()).execute()
    if getattr(stale_response, "error", None):
        raise RuntimeError(str(stale_response.error))

    return {
        "rows": len(rows),
        "days": len(menu.get("days", {})),
        "commons": len(menu.get("dining_commons", [])),
    }
