#!/bin/bash
# Import manually-labeled receipts the LLM missed.
# Usage:
#   RECEIPT_LABELS="Receipts" FETCH_SINCE=2025-01-01 FETCH_BEFORE=2025-02-01 \
#     ./fetch/import_labeled/import.sh <gmail-address> <app-password>
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FETCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$FETCH_DIR"

if [ $# -lt 2 ]; then
  echo "Usage: ./fetch/import_labeled/import.sh <gmail-address> <app-password>"
  exit 1
fi

# Build context is fetch/ so the image has mailbox_wrapper.py and models.py;
# the import script is copied in from this subfolder.
docker build -t gmail-import -f - . <<'EOF'
FROM python:3.12-slim

WORKDIR /app
COPY *.py .
COPY import_labeled/import_labeled.py .
CMD ["python", "-u", "import_labeled.py"]
EOF

docker run --rm \
  -e GMAIL_USER="$1" \
  -e GMAIL_APP_PASSWORD="$2" \
  -e RECEIPT_LABELS="$RECEIPT_LABELS" \
  -e FETCH_SINCE="$FETCH_SINCE" \
  -e FETCH_BEFORE="$FETCH_BEFORE" \
  -v "$SCRIPT_DIR/../../output:/output" \
  gmail-import python -u import_labeled.py
