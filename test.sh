#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Backend tests"
cd "$DIR/backend" && .venv/bin/python -m pytest tests/ -v

echo ""
echo "==> Frontend tests"
cd "$DIR/frontend" && npx vitest run
