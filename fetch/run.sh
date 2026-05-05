#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ $# -ne 2 ]; then
  echo "Usage: ./fetch/run.sh <gmail-address> <app-password>"
  exit 1
fi

docker build -t gmail-fetch -f - "$SCRIPT_DIR" <<'EOF'
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl zstd \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://ollama.com/install.sh | bash

RUN pip install --no-cache-dir requests

WORKDIR /app
COPY *.py .
CMD ["python", "-u", "fetch_emails.py"]
EOF

GPU_FLAG=""
if docker info --format '{{.Runtimes}}' | grep -q nvidia; then
  GPU_FLAG="--gpus all"
fi

docker run --rm $GPU_FLAG \
  -e GMAIL_USER="$1" \
  -e GMAIL_APP_PASSWORD="$2" \
  -e OLLAMA_NO_CLOUD=1 \
  -v "$HOME/.ollama/models:/root/.ollama/models:ro" \
  gmail-fetch
