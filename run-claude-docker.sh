#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec docker run -it --rm \
  --name "claude-$(basename "$PROJECT_DIR")" \
  --network host \
  --gpus all \
  -v "$PROJECT_DIR":"$PROJECT_DIR" \
  -v "$HOME/.claude":/home/node/.claude \
  -v "$HOME/.claude.json":/home/node/.claude.json \
  -e TERM=xterm-256color \
  -w "$PROJECT_DIR" \
  node:22-bookworm \
  bash -c '
    set -e
    echo "==> Installing Python..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
    echo "==> Installing Claude Code..."
    su - node -c "curl -fsSL https://claude.ai/install.sh | bash"
    echo "==> Starting Claude..."
    exec su - node -c "cd $(pwd) && claude"
  '
