#!/bin/bash
export $(gpg -d .env.gpg 2>/dev/null | xargs)
src/.venv/bin/python src/download.py "$@"
unset EMAIL_ADDRESS APP_PASSWORD
