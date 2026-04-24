# UMass Dining Meal Planner

Automated meal planning for UMass Amherst Franklin Dining Commons. Scrapes the weekly menu, uses Google Gemini to pick meals optimized for both macros (muscle building) and taste (Indian palate), and emails you exactly what to eat — timed to 30 minutes before each shift and at shift end.

---

## What it does

1. **Scrapes** the Franklin DC weekly menu every Sunday (nutrition data included)
2. **Plans** pre-shift and post-shift DC meals to hit ~2,200 cal / 120g protein/day
3. **Ranks** meals for taste using Google Gemini 2.5 Flash (free tier, no credit card)
4. **Emails** you the meal plan at the right time each day (via Gmail)

---

## Prerequisites

- Python 3.10+
- Ubuntu/Debian (or any Linux with `cron`)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords)
- A Google account for a [free Gemini API key](https://aistudio.google.com/apikey) (no credit card)

---

## Quick Start

```bash
git clone <repo-url>
cd umass-meal-planner
bash setup.sh
```

`setup.sh` will:
- Create a virtualenv and install dependencies
- Install Playwright's Chromium browser
- Prompt for your API keys and email credentials
- Run the test suite
- Optionally install crontab entries

---

## Getting a Gemini API Key (free)

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with any Google account
3. Click "Create API key"
4. Copy the key into your `.env` file as `GEMINI_API_KEY=...`

Free tier: 10 requests/min, 250/day. This system uses ~8-10 per week.

---

## Setting up Gmail App Password

1. Go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Google gives you a 16-character password like `xxxx xxxx xxxx xxxx`
4. Add to `.env` as `GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx`

---

## Configuration

Edit `config.yaml` to update:
- Daily calorie/protein targets
- Home meal calories
- Your shift schedule and times
- Taste preferences
- Email send times

---

## Manual Commands

```bash
# Activate venv first
source .venv/bin/activate

# Scrape this week's menu
python -m scraper.auto_scrape

# Generate the weekly meal plan
python -m planner.meal_plan

# Preview a meal email (no email sent)
python scheduler.py --dry-run monday pre
python scheduler.py --dry-run friday post

# Send a meal email right now
python scheduler.py --send-email monday pre

# Run the full pipeline (scrape + plan + send)
python scheduler.py --test-run monday pre

# Send a test email to verify SMTP
python -m notifier.email_sender --test

# Run all tests
python -m pytest tests/ -v
```

---

## When Cloudflare Blocks the Scraper

If the automated scraper fails (UMass uses Cloudflare), use the manual fallback:

```bash
# Option 1: Interactive entry with USDA nutrition lookup
python -m scraper.manual_fallback --interactive

# Option 2: Paste JSON from browser DevTools network tab
python -m scraper.manual_fallback --paste

# Option 3: Parse a saved HTML file
python -m scraper.manual_fallback --html data/saved_page.html
```

After providing data, run `python -m planner.meal_plan` to regenerate the plan.

---

## Project Structure

```
umass-meal-planner/
├── config.yaml              # All user config
├── scheduler.py             # Cron entry point
├── scraper/
│   ├── auto_scrape.py       # Playwright-based scraper
│   ├── manual_fallback.py   # CLI fallback for manual input
│   └── parse_menu.py        # Normalize raw data
├── planner/
│   ├── optimizer.py         # Greedy macro optimizer
│   ├── llm_ranker.py        # Gemini taste ranker
│   └── meal_plan.py         # Main orchestrator
├── notifier/
│   ├── email_sender.py      # Gmail SMTP sender
│   └── scheduler.py        # (imported by top-level scheduler.py)
├── data/
│   ├── weekly_menu.json     # Auto-generated
│   ├── weekly_plan.json     # Auto-generated
│   ├── weekly_plan.txt      # Human-readable plan
│   └── logs/                # Scraper, planner, notifier logs
├── tests/
│   ├── sample_menu.json     # Test data
│   └── test_modules.py      # Unit tests
├── .env                     # API keys (gitignored)
├── requirements.txt
└── setup.sh
```

---

## Timezone Note

The server runs in IST (UTC+5:30). UMass is on EDT (UTC-4) during spring/summer and EST (UTC-5) in winter. All cron times are stored in UTC so DST is handled automatically via Python's `zoneinfo` module (`America/New_York` timezone).

---

## Troubleshooting

**Scrape fails every week**: Cloudflare is blocking headless Chrome. Use the manual fallback (`python -m scraper.manual_fallback --interactive`) until stealth mode is improved.

**`GEMINI_API_KEY not set`**: Make sure `.env` exists in the project root with the correct key.

**Gmail authentication fails**: You must use an App Password, not your regular Gmail password. 2FA must be enabled on the account first.

**Email times are wrong**: The cron jobs use UTC. Check that your server clock is correct (`timedatectl`) and that `America/New_York` timezone data is installed (`tzdata` package on Ubuntu).

**Menu items have no nutrition data**: Some items may not have loaded their nutrition popup. Re-run the scraper or add them manually via `python -m scraper.manual_fallback --interactive`.
