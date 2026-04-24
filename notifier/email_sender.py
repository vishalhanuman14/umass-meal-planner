"""
email_sender.py — SMTP email sender via Gmail App Password.

Usage:
    python -m notifier.email_sender --test   # sends a test email
"""

import argparse
import logging
import os
import smtplib
from datetime import date
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

LOG_DIR = BASE_DIR / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "notifier.log"),
    ],
)
logger = logging.getLogger(__name__)

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL")


def send_email(subject: str, body: str, to: str | None = None) -> bool:
    """Send a plain-text email. Returns True on success."""
    sender = GMAIL_ADDRESS
    recipient = to or RECIPIENT_EMAIL

    if not sender or not GMAIL_APP_PASSWORD or not recipient:
        logger.error(
            "Email credentials missing. Set GMAIL_ADDRESS, GMAIL_APP_PASSWORD, "
            "and RECIPIENT_EMAIL in .env"
        )
        return False

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = recipient

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
            smtp.login(sender, GMAIL_APP_PASSWORD)
            smtp.sendmail(sender, [recipient], msg.as_string())
        logger.info("Email sent: '%s' → %s", subject, recipient)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Gmail authentication failed. Check GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env. "
            "Make sure you're using an App Password, not your regular password."
        )
        return False
    except Exception as e:
        logger.error("Failed to send email: %s", e)
        return False


def format_meal_email(
    day_name: str,
    slot: str,  # "pre_shift" or "post_shift"
    meal: dict,
    day_plan: dict,
    cfg: dict,
) -> tuple[str, str]:
    """
    Build (subject, body) for a meal notification email.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    ny_tz = ZoneInfo("America/New_York")
    today = datetime.now(ny_tz).strftime("%a %b %-d")

    period = meal.get("period", "meal").replace("_", " ").title()
    slot_label = "Pre-shift" if slot == "pre_shift" else "Post-shift"
    shift_time = meal.get("shift_start") or meal.get("shift_end", "")

    subject = f"Meal Plan — {slot_label} Franklin DC {period} ({day_name.title()} {today})"

    # Determine shift context
    shift_cfg = cfg.get("schedule", {}).get(day_name.lower(), {}).get("shift", {})
    shift_type = shift_cfg.get("type", "shift")

    if slot == "pre_shift":
        intro = f"Your {shift_type} shift starts at {shift_time}. Here's what to eat beforehand:"
    else:
        intro = f"Your {shift_type} shift just ended. Here's your post-shift meal:"

    # Build meal section
    sep = "━" * 40
    meal_lines = [f"FRANKLIN DINING — {period.upper()}", sep]

    items = meal.get("items", [])
    if not items:
        meal_lines.append(meal.get("note", "No items available."))
    else:
        for item in items:
            name = item.get("item") or item.get("name", "?")
            svgs = item.get("servings", 1)
            cal = item.get("calories", 0)
            prot = item.get("protein_g", 0)
            meal_lines.append(f"• {name} × {svgs} serving{'s' if svgs > 1 else ''}")
            meal_lines.append(f"  → {cal} cal | {prot}g protein")
            meal_lines.append("")

    t = meal.get("meal_total", {})
    meal_cal = t.get("calories", 0)
    meal_prot = t.get("protein_g", 0)
    meal_lines += [sep, f"MEAL TOTAL: {meal_cal} cal | {meal_prot}g protein"]

    if meal.get("source") == "optimizer":
        meal_lines.append("⚠ Taste optimizer unavailable — best macro-optimized option.")
    if meal.get("reasoning"):
        meal_lines.append(f"\nWhy this meal: {meal['reasoning']}")

    # Running totals
    home = day_plan.get("home_meals", {})
    bk = home.get("breakfast", {})
    dn = home.get("dinner", {})

    if slot == "pre_shift":
        running_cal = bk.get("calories", 400) + meal_cal
        running_prot = bk.get("protein_g", 16) + meal_prot
        remaining_cal = cfg["daily_targets"]["calories"] - running_cal - dn.get("calories", 500)
        remaining_prot = cfg["daily_targets"]["protein_g"] - running_prot - dn.get("protein_g", 40)
        post_meal = day_plan.get("dc_meals", {}).get("post_shift", {}).get("meal_total", {})
        remaining_note = (
            f"  → You have ~{max(0, int(remaining_cal))} cal and "
            f"~{max(0, round(remaining_prot, 1))}g protein left\n"
            f"    for your post-shift meal at Franklin."
        )
    else:
        pre_meal = day_plan.get("dc_meals", {}).get("pre_shift", {}).get("meal_total", {})
        pre_cal = pre_meal.get("calories", 0) if pre_meal else 0
        pre_prot = pre_meal.get("protein_g", 0) if pre_meal else 0
        running_cal = bk.get("calories", 400) + pre_cal + meal_cal + dn.get("calories", 500)
        running_prot = bk.get("protein_g", 16) + pre_prot + meal_prot + dn.get("protein_g", 40)
        remaining_note = ""

    totals_lines = [
        "",
        "TODAY'S RUNNING TOTAL:",
        f"  Breakfast (home):     {bk.get('calories', 400)} cal | {bk.get('protein_g', 16)}g P",
    ]
    if slot == "post_shift":
        pre_meal_t = day_plan.get("dc_meals", {}).get("pre_shift", {}).get("meal_total", {})
        if pre_meal_t:
            totals_lines.append(
                f"  Pre-shift meal:       {pre_meal_t.get('calories', 0)} cal | {pre_meal_t.get('protein_g', 0)}g P"
            )
    totals_lines.append(f"  This meal:            {meal_cal} cal | {meal_prot}g P")
    totals_lines.append(f"  Home dinner:          {dn.get('calories', 500)} cal | {dn.get('protein_g', 40)}g P")
    totals_lines.append(f"  {'─'*38}")
    totals_lines.append(f"  Projected daily:   {int(running_cal)} cal | {round(running_prot, 1)}g P")

    if remaining_note:
        totals_lines.append("")
        totals_lines.append(remaining_note)

    body_parts = [
        f"Hey! {intro}",
        "",
        "\n".join(meal_lines),
        "\n".join(totals_lines),
        "",
        "Enjoy your meal! 💪",
    ]

    return subject, "\n".join(body_parts)


def send_scrape_failure_alert():
    """Send an alert email when the weekly scrape fails."""
    subject = "⚠️ UMass Meal Planner — Scrape Failed"
    body = (
        "The automated menu scrape failed (likely Cloudflare block).\n\n"
        "To provide menu data manually, run one of:\n"
        "  python -m scraper.manual_fallback --paste\n"
        "  python -m scraper.manual_fallback --interactive\n\n"
        "See data/logs/scraper.log for details."
    )
    send_email(subject, body)


def main():
    parser = argparse.ArgumentParser(description="Email sender test")
    parser.add_argument("--test", action="store_true", help="Send a test email")
    args = parser.parse_args()

    if args.test:
        subject = f"UMass Meal Planner — Test Email ({date.today()})"
        body = (
            "This is a test email from your UMass Meal Planner.\n\n"
            "If you received this, your Gmail SMTP setup is working correctly!\n\n"
            "SAMPLE MEAL:\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "• Tandoori Chicken Thigh × 2 servings\n"
            "  → 340 cal | 42g protein\n\n"
            "• Basmati Rice × 1 serving\n"
            "  → 210 cal | 5g protein\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "MEAL TOTAL: 550 cal | 47g protein\n\n"
            "Enjoy your meal! 💪"
        )
        ok = send_email(subject, body)
        if ok:
            print(f"Test email sent to {RECIPIENT_EMAIL}")
        else:
            print("Test email failed. Check .env and logs.")
            exit(1)


if __name__ == "__main__":
    main()
