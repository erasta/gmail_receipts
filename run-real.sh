#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="gmail-receipts"
DATA_DIR="$HOME/.gmail_receipts"

mkdir -p "$DATA_DIR"

echo "==> Building Docker image..."
docker build -t "$IMAGE_NAME" -f - "$PROJECT_DIR" <<'EOF'
FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | bash

USER node
EOF

GPU_FLAG=""
if docker info --format '{{.Runtimes}}' | grep -q nvidia; then
  GPU_FLAG="--gpus all"
fi

OLLAMA_PORT=11435

echo "==> Starting Gmail Receipts (real mode)..."
echo "    Data dir: $DATA_DIR"
echo "    Ollama:   internal port $OLLAMA_PORT"
exec docker run -it --rm \
  --name "gmail-receipts" \
  $GPU_FLAG \
  -p 5173:5173 \
  -p 8000:8000 \
  -v "$PROJECT_DIR":/app \
  -v "$DATA_DIR":/data \
  -v "$HOME/.ollama/models":/home/node/.ollama/models:ro \
  -e CLASSIFICATIONS_PATH=/data/classifications.json \
  -e CLASSIFIER=ollama \
  -e OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}" \
  -e OLLAMA_MODELS=/home/node/.ollama/models \
  -e OLLAMA_NO_CLOUD=1 \
  -w /app/backend \
  "$IMAGE_NAME" \
  bash -c "ollama serve &>/dev/null & sleep 2 && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
