import os
import subprocess
import sys
import time
from datetime import date

import requests

from process_email import process_email, _get_seen_message_ids
from mailbox_wrapper import Mailbox


def main():
    skip = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables", file=sys.stderr)
        sys.exit(1)

    # Optional date range (YYYY-MM-DD). Defaults to the original start, no end.
    since_env = os.environ.get("FETCH_SINCE")
    before_env = os.environ.get("FETCH_BEFORE")
    since = date.fromisoformat(since_env) if since_env else date(2025, 1, 24)
    before = date.fromisoformat(before_env) if before_env else None

    print(f"Connecting to Gmail as {user}...")
    mb = Mailbox(user, password)
    uids = mb.search_dates(since, before)
    print(f"Found {len(uids)} emails since {since}\n")

    ollama_proc = subprocess.Popen(["ollama", "serve"])

    print("\n*****\nWaiting for Ollama...\n*****\n")
    while True:
        try:
            requests.get("http://localhost:11434/api/tags", timeout=2)
            break
        except requests.ConnectionError:
            time.sleep(0.5)
    print("\n*****\nOllama is up. Loading model...\n*****\n")
    requests.post(
        "http://localhost:11434/api/generate",
        json={"model": "phi3.5", "prompt": "hi", "stream": False},
        timeout=600,
    )
    print("\n*****\nModel loaded.\n*****\n")

    total = len(uids)
    for i, uid in enumerate(uids[skip:], skip + 1):
        t_fetch = time.time()

        message_id = mb.message_id_of(uid)
        if message_id in _get_seen_message_ids():
            print(f"[{i}/{total}] skip {message_id} ({time.time() - t_fetch:.2f}s)")
            continue
        print(f"[{i}/{total}] processing {message_id}")

        em = mb.get(uid)
        if em is None:
            continue
        print(f"fetch+parse: {time.time() - t_fetch:.2f}s")

        process_email(em, index=i, total=total)

    mb.logout()
    ollama_proc.terminate()
    ollama_proc.wait()
    print(f"\nDone. {len(uids)} emails processed.")


if __name__ == "__main__":
    main()
