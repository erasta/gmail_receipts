#!/bin/bash
# One-off migration: rewrite each receipt's body with the email's HTML part.
# Usage: ./fetch/migration/migrate.sh <gmail-address> <app-password>
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FETCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$FETCH_DIR"

if [ $# -lt 2 ]; then
  echo "Usage: ./fetch/migration/migrate.sh <gmail-address> <app-password>"
  exit 1
fi

# Build context is fetch/ so the image has fetch_emails.py and process_email.py;
# the migration script is copied in from this subfolder.
docker build -t gmail-migrate -f - "$FETCH_DIR" <<'EOF'
FROM python:3.12-slim

RUN pip install --no-cache-dir requests

WORKDIR /app
COPY *.py .
COPY migration/migrate_html.py .
CMD ["python", "-u", "migrate_html.py"]
EOF

docker run --rm \
  -e GMAIL_USER="$1" \
  -e GMAIL_APP_PASSWORD="$2" \
  -v "$SCRIPT_DIR/../../output:/output" \
  gmail-migrate python -u migrate_html.py
