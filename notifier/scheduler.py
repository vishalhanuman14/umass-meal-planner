"""
scheduler.py — Entry point for cron jobs.

Modes:
    python scheduler.py --weekly-scrape                  # scrape + generate plan (Sunday)
    python scheduler.py --send-email monday pre          # send pre-shift email for Monday
    python scheduler.py --send-email friday post         # send post-shift email for Friday
    python scheduler.py --test-run monday pre            # full pipeline, actually send email
    python scheduler.py --dry-run monday pre             # show email text, don't send
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "scheduler.log"),
    ],
)
logger = logging.getLogger(__name__)

NY_TZ = ZoneInfo("America/New_York")
SCRAPE_RETRY_MAX = 3
SCRAPE_RETRY_FILE = DATA_DIR / ".scrape_attempt_count"


def load_config() -> dict:
    with open(BASE_DIR / "config.yaml") as f:
        return yaml.safe_load(f)


def load_plan() -> dict | None:
    plan_path = DATA_DIR / "weekly_plan.json"
    if not plan_path.exists():
        logger.error("weekly_plan.json not found. Run --weekly-scrape first.")
        return None
    with open(plan_path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Weekly scrape + plan generation
# ---------------------------------------------------------------------------

def run_weekly_scrape():
    """Run scraper, generate plan, and send alert if scrape fails."""
    from scraper.auto_scrape import run_scrape, save_menu
    from planner.meal_plan import generate_weekly_plan, save_plan
    from notifier.email_sender import send_scrape_failure_alert

    # Track retry attempts
    attempt = 1
    if SCRAPE_RETRY_FILE.exists():
        try:
            attempt = int(SCRAPE_RETRY_FILE.read_text().strip()) + 1
        except ValueError:
            attempt = 1

    logger.info("Weekly scrape attempt %d/%d", attempt, SCRAPE_RETRY_MAX)

    menu = asyncio.run(run_scrape())

    if menu is None:
        SCRAPE_RETRY_FILE.write_text(str(attempt))
        if attempt >= SCRAPE_RETRY_MAX:
            logger.error("Scrape failed %d times. Sending alert.", attempt)
            send_scrape_failure_alert()
            SCRAPE_RETRY_FILE.unlink(missing_ok=True)
        else:
            logger.warning("Scrape failed (attempt %d). Will retry.", attempt)
        sys.exit(1)

    # Success — reset counter
    SCRAPE_RETRY_FILE.unlink(missing_ok=True)
    save_menu(menu)
    logger.info("Scrape succeeded. Generating meal plan...")

    cfg = load_config()
    plan = generate_weekly_plan(cfg, menu)
    save_plan(plan, cfg)
    logger.info("Weekly plan generated and saved.")


# ---------------------------------------------------------------------------
# Send timed meal emails
# ---------------------------------------------------------------------------

def send_meal_email(day_name: str, slot: str, dry_run: bool = False):
    """
    Send (or print) the meal email for a given day and slot.
    slot: "pre" or "post" (shorthand for "pre_shift" / "post_shift")
    """
    from notifier.email_sender import format_meal_email, send_email

    slot_key = "pre_shift" if slot.startswith("pre") else "post_shift"
    day_name = day_name.lower()

    plan = load_plan()
    if plan is None:
        sys.exit(1)

    cfg = load_config()
    day_plan = plan.get("days", {}).get(day_name)
    if not day_plan:
        logger.error("No plan found for day '%s'.", day_name)
        sys.exit(1)

    dc_meals = day_plan.get("dc_meals", {})
    if not dc_meals:
        logger.info("Day '%s' has no DC meals (%s). Nothing to send.", day_name, day_plan.get("note", ""))
        return

    meal = dc_meals.get(slot_key)
    if not meal:
        logger.info("No '%s' meal found for %s.", slot_key, day_name)
        return

    subject, body = format_meal_email(day_name, slot_key, meal, day_plan, cfg)

    if dry_run:
        print(f"\nSubject: {subject}\n")
        print(body)
        print("\n[DRY RUN — email not sent]")
        return

    ok = send_email(subject, body)
    if not ok:
        logger.error("Failed to send %s %s email.", day_name, slot_key)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Crontab installer
# ---------------------------------------------------------------------------

CRON_TEMPLATE = """
# UMass Meal Planner — auto-generated cron jobs (IST times, EDT = UTC-4)
# Weekly scrape + plan: Sunday 6 AM EDT = Sunday 3:30 PM IST (UTC 10:00)
0 10 * * 0 cd {project_dir} && .venv/bin/python scheduler.py --weekly-scrape >> data/logs/cron.log 2>&1

# MONDAY: Shift 4:00-7:30 PM EDT
# Pre-shift email 3:30 PM EDT = Monday 20:00 UTC
0 20 * * 1 cd {project_dir} && .venv/bin/python scheduler.py --send-email monday pre >> data/logs/cron.log 2>&1
# Post-shift email 7:30 PM EDT = Tuesday 00:30 UTC (Tue in IST)
30 0 * * 2 cd {project_dir} && .venv/bin/python scheduler.py --send-email monday post >> data/logs/cron.log 2>&1

# WEDNESDAY: Shift 1:00-4:30 PM EDT
# Pre-shift email 12:30 PM EDT = Wednesday 16:30 UTC
30 16 * * 3 cd {project_dir} && .venv/bin/python scheduler.py --send-email wednesday pre >> data/logs/cron.log 2>&1
# Post-shift email 4:30 PM EDT = Wednesday 20:30 UTC
30 20 * * 3 cd {project_dir} && .venv/bin/python scheduler.py --send-email wednesday post >> data/logs/cron.log 2>&1

# THURSDAY: Shift 2:30-6:00 PM EDT
# Pre-shift email 2:00 PM EDT = Thursday 18:00 UTC
0 18 * * 4 cd {project_dir} && .venv/bin/python scheduler.py --send-email thursday pre >> data/logs/cron.log 2>&1
# Post-shift email 6:00 PM EDT = Thursday 22:00 UTC
0 22 * * 4 cd {project_dir} && .venv/bin/python scheduler.py --send-email thursday post >> data/logs/cron.log 2>&1

# FRIDAY: Shift 11:00 AM-2:30 PM EDT
# Pre-shift email 10:30 AM EDT = Friday 14:30 UTC
30 14 * * 5 cd {project_dir} && .venv/bin/python scheduler.py --send-email friday pre >> data/logs/cron.log 2>&1
# Post-shift email 2:30 PM EDT = Friday 18:30 UTC
30 18 * * 5 cd {project_dir} && .venv/bin/python scheduler.py --send-email friday post >> data/logs/cron.log 2>&1
"""

def install_crontab():
    """Install cron jobs for this project."""
    import subprocess
    import tempfile

    project_dir = BASE_DIR.resolve()
    cron_content = CRON_TEMPLATE.format(project_dir=project_dir).strip()

    # Get existing crontab (if any)
    result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    existing = result.stdout if result.returncode == 0 else ""

    # Remove old meal planner entries
    filtered = "\n".join(
        line for line in existing.splitlines()
        if "umass-meal-planner" not in line and "scheduler.py" not in line
    )

    new_crontab = filtered.rstrip() + "\n\n" + cron_content + "\n"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".cron", delete=False) as f:
        f.write(new_crontab)
        tmp = f.name

    subprocess.run(["crontab", tmp], check=True)
    Path(tmp).unlink()
    logger.info("Cron jobs installed. Run 'crontab -l' to verify.")
    print("Cron jobs installed successfully.")
    print("\nInstalled jobs:")
    for line in cron_content.splitlines():
        if line.strip() and not line.startswith("#"):
            print(f"  {line}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="UMass Meal Planner scheduler")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--weekly-scrape", action="store_true", help="Run weekly scrape + plan generation")
    group.add_argument("--send-email", nargs=2, metavar=("DAY", "SLOT"), help="Send meal email (e.g. monday pre)")
    group.add_argument("--test-run", nargs=2, metavar=("DAY", "SLOT"), help="Full pipeline + send email")
    group.add_argument("--dry-run", nargs=2, metavar=("DAY", "SLOT"), help="Print email without sending")
    group.add_argument("--install-cron", action="store_true", help="Install cron jobs")
    args = parser.parse_args()

    if args.weekly_scrape:
        run_weekly_scrape()

    elif args.send_email:
        day, slot = args.send_email
        send_meal_email(day, slot, dry_run=False)

    elif args.test_run:
        day, slot = args.test_run
        # Generate plan from existing menu if available, then send
        plan_path = DATA_DIR / "weekly_plan.json"
        if not plan_path.exists():
            logger.info("No plan found. Generating from existing menu...")
            try:
                from planner.meal_plan import generate_weekly_plan, save_plan
                from scraper.auto_scrape import load_menu  # type: ignore
                import json as _json
                menu_path = DATA_DIR / "weekly_menu.json"
                if not menu_path.exists():
                    # Use sample menu
                    sample = BASE_DIR / "tests" / "sample_menu.json"
                    if sample.exists():
                        with open(sample) as f:
                            menu = _json.load(f)
                    else:
                        logger.error("No menu data. Run --weekly-scrape or provide tests/sample_menu.json")
                        sys.exit(1)
                else:
                    with open(menu_path) as f:
                        menu = _json.load(f)
                cfg = load_config()
                plan = generate_weekly_plan(cfg, menu, [day.lower()])
                save_plan(plan, cfg)
            except Exception as e:
                logger.error("Could not generate plan: %s", e)
                sys.exit(1)
        send_meal_email(day, slot, dry_run=False)

    elif args.dry_run:
        day, slot = args.dry_run
        send_meal_email(day, slot, dry_run=True)

    elif args.install_cron:
        install_crontab()


if __name__ == "__main__":
    main()
