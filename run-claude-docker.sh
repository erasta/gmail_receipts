#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_SLUG="$(echo "$PROJECT_DIR" | sed 's/[^a-zA-Z0-9]/-/g')"
mkdir -p "$HOME/.claude/projects/$PROJECT_SLUG"
exec docker run -it --rm \
  --name "claude-$(basename "$PROJECT_DIR")" \
  --network host \
  --gpus all \
  -v "$PROJECT_DIR":"$PROJECT_DIR" \
  -v "$HOME/.claude":/home/node/.claude \
  --tmpfs /home/node/.claude/projects \
  -v "$HOME/.claude/projects/$PROJECT_SLUG":/home/node/.claude/projects/$PROJECT_SLUG \
  -v "$HOME/.claude.json":/home/node/.claude.json \
  -e TERM=xterm-256color \
  -e PROJECT_DIR="$PROJECT_DIR" \
  -w "$PROJECT_DIR" \
  node:22-bookworm \
  bash -c '
    set -e
    echo "==> Installing Python..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
    echo "==> Installing Claude Code..."
    npm install -g @anthropic-ai/claude-code
    echo "==> Fixing permissions..."
    chown -R node:node /home/node/.claude/projects
    echo "==> Starting Claude..."
    exec su - node -c "cd $PROJECT_DIR && claude"
  '
