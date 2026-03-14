#!/bin/bash
set -e
PROJECT_DIR="$(pwd)"
PROJECT_SLUG="$(echo "$PROJECT_DIR" | sed 's/[^a-zA-Z0-9]/-/g')"
IMAGE_NAME="claude-code-env-ollama"

mkdir -p "$HOME/.claude/projects/$PROJECT_SLUG"

echo "==> Building Docker image..."
docker build -t "$IMAGE_NAME" -f - "$PROJECT_DIR" <<'EOF'
FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        zstd \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | bash

USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH
RUN npm install -g @anthropic-ai/claude-code
EOF

GPU_FLAG=""
if docker info --format '{{.Runtimes}}' | grep -q nvidia; then
  GPU_FLAG="--gpus all"
fi

# Ollama runs inside the container on a non-default port.
# With bridge networking (no --network host), it is unreachable from
# outside the container. Only the backend inside can talk to it.
OLLAMA_PORT=11435

echo "==> Starting Claude (Ollama on internal port ${OLLAMA_PORT})..."
exec docker run -it --rm \
  --name "claude-$(basename "$PROJECT_DIR")" \
  $GPU_FLAG \
  -p 127.0.0.1:5173:5173 \
  -p 127.0.0.1:8000:8000 \
  -v "$PROJECT_DIR":"$PROJECT_DIR" \
  -v "$HOME/.claude":/home/node/.claude \
  --tmpfs /home/node/.claude/projects:uid=1000,gid=1000 \
  -v "$HOME/.claude/projects/$PROJECT_SLUG":/home/node/.claude/projects/$PROJECT_SLUG \
  -v "$HOME/.claude.json":/home/node/.claude.json \
  -v "$HOME/.ollama/models":/home/node/.ollama/models:ro \
  -e OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}" \
  -e OLLAMA_MODELS=/home/node/.ollama/models \
  -e OLLAMA_NO_CLOUD=1 \
  -e TERM=xterm-256color \
  -w "$PROJECT_DIR" \
  "$IMAGE_NAME" \
  bash -c "ollama serve &>/dev/null & sleep 2 && claude --dangerously-skip-permissions"
