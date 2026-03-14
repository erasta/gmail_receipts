#!/bin/bash
set -e
CONTAINER_NAME="claude-$(basename "$(pwd)")"

if [ $# -gt 0 ]; then
  exec docker exec -it "$CONTAINER_NAME" "$@"
fi

echo "Connecting to container: $CONTAINER_NAME"
echo ""
exec docker exec -it "$CONTAINER_NAME" bash -c '
echo "=== Container shell ==="
echo ""
echo "Server commands:"
echo "  cat /tmp/uvicorn.log          # view logs"
echo "  tail -f /tmp/uvicorn.log      # follow logs"
echo "  pkill -f uvicorn              # kill server"
echo "  backend/.venv/bin/python backend/app/main.py   # start foreground"
echo ""
exec bash'
