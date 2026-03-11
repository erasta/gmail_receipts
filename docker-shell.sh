#!/bin/bash
set -e
CONTAINER_NAME="claude-$(basename "$(pwd)")"
echo "Connecting to container: $CONTAINER_NAME"
echo ""
exec docker exec -it "$CONTAINER_NAME" bash -c '
echo "=== Container shell ==="
echo ""
echo "Server commands:"
echo "  cat /tmp/uvicorn.log          # view logs"
echo "  tail -f /tmp/uvicorn.log      # follow logs"
echo "  pkill -f uvicorn              # kill server"
echo "  cd /home/eran/Code/gmail_receipts/backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000  # start foreground"
echo ""
exec bash'
