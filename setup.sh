#!/usr/bin/env bash
# setup.sh — One-command setup for UMass Meal Planner
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  UMass Meal Planner — Setup"
echo "========================================"

# 1. Check Python 3.10+
PYTHON=$(command -v python3 || command -v python || true)
if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3 not found. Install Python 3.10+ and retry."
    exit 1
fi

PYVER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYMAJOR=$("$PYTHON" -c "import sys; print(sys.version_info.major)")
PYMINOR=$("$PYTHON" -c "import sys; print(sys.version_info.minor)")

if [ "$PYMAJOR" -lt 3 ] || ([ "$PYMAJOR" -eq 3 ] && [ "$PYMINOR" -lt 10 ]); then
    echo "ERROR: Python 3.10+ required (found $PYVER)."
    exit 1
fi
echo "✓ Python $PYVER found."

# 2. Create virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    "$PYTHON" -m venv .venv
fi
echo "✓ Virtual environment ready."

# Activate venv
# shellcheck disable=SC1091
source .venv/bin/activate

# 3. Install dependencies
echo "Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "✓ Dependencies installed."

# 4. Install Playwright Chromium
echo "Installing Playwright Chromium browser..."
playwright install chromium
echo "✓ Chromium installed."

# 5. Set up .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "========================================"
    echo "  Configure API Keys & Email"
    echo "========================================"
    echo ""
    echo "You need:"
    echo "  1. Gemini API key — free at https://aistudio.google.com/apikey"
    echo "  2. Gmail address + App Password"
    echo "     (create at https://myaccount.google.com/apppasswords)"
    echo ""

    read -rp "Gemini API key: " GEMINI_KEY
    read -rp "Gmail address: " GMAIL_ADDR
    read -rp "Gmail App Password (xxxx xxxx xxxx xxxx): " GMAIL_PASS
    read -rp "Recipient email [same as Gmail]: " RECIPIENT
    RECIPIENT="${RECIPIENT:-$GMAIL_ADDR}"

    cat > .env <<EOF
GEMINI_API_KEY=${GEMINI_KEY}
GMAIL_ADDRESS=${GMAIL_ADDR}
GMAIL_APP_PASSWORD=${GMAIL_PASS}
RECIPIENT_EMAIL=${RECIPIENT}
EOF
    echo "✓ .env created."
else
    echo "✓ .env already exists (skipping)."
fi

# 6. Create data directories
mkdir -p data/logs
touch data/logs/.gitkeep
echo "✓ Data directories ready."

# 7. Run a quick module test with sample data
echo ""
echo "Running module tests with sample data..."
python -m pytest tests/test_modules.py -v --tb=short 2>&1 | tail -30
echo ""

# 8. Offer to install cron jobs
echo "========================================"
echo "  Install Cron Jobs?"
echo "========================================"
echo ""
echo "This will install crontab entries to:"
echo "  - Scrape the menu every Sunday"
echo "  - Send meal emails before/after each shift"
echo ""
read -rp "Install cron jobs? [y/N]: " INSTALL_CRON
if [[ "${INSTALL_CRON,,}" == "y" ]]; then
    python scheduler.py --install-cron
    echo "✓ Cron jobs installed."
else
    echo "  Skipped. Run 'python scheduler.py --install-cron' later."
fi

# 9. Offer a test email
echo ""
read -rp "Send a test email to verify SMTP? [y/N]: " TEST_EMAIL
if [[ "${TEST_EMAIL,,}" == "y" ]]; then
    python -m notifier.email_sender --test
fi

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Quick start:"
echo "  source .venv/bin/activate"
echo ""
echo "  # Scrape this week's menu:"
echo "  python -m scraper.auto_scrape"
echo ""
echo "  # Generate meal plan:"
echo "  python -m planner.meal_plan"
echo ""
echo "  # Dry-run a meal email:"
echo "  python scheduler.py --dry-run monday pre"
echo ""
echo "  # Run full test pipeline:"
echo "  python scheduler.py --test-run monday pre"
echo ""
