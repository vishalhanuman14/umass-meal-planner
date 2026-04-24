"""
Top-level scheduler entry point.
Delegates to notifier/scheduler.py — kept here so cron can call:
    python scheduler.py --weekly-scrape
    python scheduler.py --send-email monday pre
"""
from notifier.scheduler import main

if __name__ == "__main__":
    main()
