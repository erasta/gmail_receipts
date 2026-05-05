#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 2 ]; then
  echo "Usage: ./fetch/run.sh <gmail-address> <app-password>"
  exit 1
fi

docker build -t gmail-fetch -f - "$SCRIPT_DIR" <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY *.py .
CMD ["python", "-u", "fetch_emails.py"]
EOF

docker run --rm -e GMAIL_USER="$1" -e GMAIL_APP_PASSWORD="$2" gmail-fetch
