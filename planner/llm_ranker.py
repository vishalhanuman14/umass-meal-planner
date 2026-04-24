"""
llm_ranker.py — Google Gemini 2.5 Flash taste optimizer.

Takes candidate meals from the optimizer and picks the one most
enjoyable for an Indian palate. Falls back to top pick on any failure.
"""

import json
import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

# Rate limiting: gemini-2.5-flash free tier = 10 req/min, 20 req/day.
# We enforce a minimum 7-second gap between calls (~8 req/min max).
_CALL_INTERVAL = 7.0
_last_call_time: float = 0.0


def _throttle():
    """Sleep if needed to respect the per-minute rate limit."""
    global _last_call_time
    elapsed = time.monotonic() - _last_call_time
    if elapsed < _CALL_INTERVAL:
        wait = _CALL_INTERVAL - elapsed
        logger.info("Rate limit: waiting %.1fs before next Gemini call...", wait)
        time.sleep(wait)
    _last_call_time = time.monotonic()

SYSTEM_PROMPT = """You are a meal advisor for a college student at UMass Amherst who is building muscle.

ABOUT THE STUDENT:
- Indian, loves bold and spicy food — curries, tandoori, masala-seasoned dishes, dal, paneer, biryani-style rice
- Prefers well-seasoned proteins over bland ones (e.g., tandoori chicken > plain grilled chicken)
- Enjoys: rice-based dishes, lentils/beans, roasted vegetables with seasoning, naan/flatbread
- Tolerates but doesn't love: plain salads, unseasoned steamed vegetables, basic pasta
- Allergies: None

YOUR TASK:
Given a list of candidate meal combinations (each meeting the macro targets), pick the ONE that would be most enjoyable and satisfying for this student. If none are great, suggest small swaps from the full menu that stay within ±50 calories and ±5g protein of the target.

Respond ONLY in this exact JSON format (no extra text):
{
  "chosen_meal": [
    {"item": "Tandoori Chicken Thigh", "servings": 2, "calories": 340, "protein_g": 42},
    {"item": "Basmati Rice", "servings": 1, "calories": 210, "protein_g": 5}
  ],
  "meal_total": {"calories": 550, "protein_g": 47},
  "reasoning": "Brief explanation of why this is best for this student."
}"""


def _build_user_message(
    candidates: list[dict],
    full_menu_items: list[dict],
    calorie_target: float,
    protein_target: float,
) -> str:
    lines = [
        f"MACRO TARGET: ~{int(calorie_target)} calories, ~{int(protein_target)}g protein\n",
        "CANDIDATE MEALS (pick or adjust the best one):",
    ]
    for i, c in enumerate(candidates, 1):
        lines.append(f"\nOption {i}:")
        for item in c.get("items", []):
            lines.append(
                f"  - {item['item']} x{item['servings']} → {item['calories']} cal, {item['protein_g']}g P"
            )
        t = c.get("meal_total", {})
        lines.append(f"  TOTAL: {t.get('calories')} cal | {t.get('protein_g')}g P")

    lines.append("\nFULL MENU AVAILABLE (for swap suggestions):")
    for item in full_menu_items[:60]:  # cap to avoid huge prompts
        lines.append(
            f"  - {item['name']}: {item['calories']} cal, {item['protein_g']}g P"
            + (f" [{', '.join(item['dietary_tags'])}]" if item.get('dietary_tags') else "")
        )

    return "\n".join(lines)


def rank_with_llm(
    candidates: list[dict],
    full_menu_items: list[dict],
    calorie_target: float,
    protein_target: float,
) -> dict | None:
    """
    Call Gemini 2.5 Flash to pick the tastiest candidate meal.

    Returns a dict with 'chosen_meal', 'meal_total', and 'reasoning',
    or None on failure (caller should fall back to candidates[0]).
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping LLM ranking.")
        return None

    if not candidates:
        return None

    try:
        from google import genai
    except ImportError:
        logger.warning("google-genai not installed — skipping LLM ranking.")
        return None

    user_message = _build_user_message(candidates, full_menu_items, calorie_target, protein_target)

    _throttle()

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "response_mime_type": "application/json",
            },
        )
        raw_text = response.text.strip()
        result = json.loads(raw_text)

        # Validate required keys
        if "chosen_meal" not in result or "meal_total" not in result:
            raise ValueError("LLM response missing required keys.")

        logger.info("LLM ranking succeeded: %s", result.get("reasoning", "")[:80])
        return result

    except Exception as e:
        logger.warning("LLM ranking failed: %s — using optimizer top pick.", e)
        return None


def pick_best_meal(
    candidates: list[dict],
    full_menu_items: list[dict],
    calorie_target: float,
    protein_target: float,
) -> tuple[dict, bool]:
    """
    Attempt LLM ranking; fall back to optimizer top pick.

    Returns (meal_dict, llm_used) where meal_dict has 'items' and 'meal_total'.
    """
    llm_result = rank_with_llm(candidates, full_menu_items, calorie_target, protein_target)

    if llm_result:
        # Normalise LLM output to our internal format
        meal = {
            "items": llm_result["chosen_meal"],
            "meal_total": llm_result["meal_total"],
            "reasoning": llm_result.get("reasoning", ""),
            "source": "llm",
        }
        return meal, True

    # Fallback
    if candidates:
        top = dict(candidates[0])
        top["source"] = "optimizer"
        top["note"] = "Taste optimizer unavailable — best macro-optimized option."
        return top, False

    return {
        "items": [],
        "meal_total": {"calories": 0, "protein_g": 0},
        "source": "empty",
    }, False
