import imaplib
import email
import os
import subprocess
import sys
import time
from datetime import date
from html import escape
import re

import requests

from process_email import process_email, _get_seen_message_ids
from mailbox_wrapper import _parse_full_email, _parse_labels, decode_header_value
from models import Email, HEADER_FIELDS


def _fetch_raw(mail: imaplib.IMAP4_SSL, mid_str: str, what: str) -> bytes | None:
    status, msg_data = mail.fetch(mid_str, f"({what})")
    if status != "OK":
        return None
    part = msg_data[0]
    if not isinstance(part, tuple):
        return None
    raw = part[1]
    if not isinstance(raw, bytes):
        return None
    return raw


def fetch_email(
    mail: imaplib.IMAP4_SSL, identifier: str, *, by_uid: bool
) -> Email | None:
    """Fetch and parse one email into an Email.

    `by_uid` selects UID FETCH (located by UID) vs sequence FETCH. UID and
    X-GM-LABELS come before RFC822 so they land in the response prefix, not
    after the RFC822 literal (where they wouldn't be seen).
    """
    if by_uid:
        status, msg_data = mail.uid("FETCH", identifier, "(UID X-GM-LABELS RFC822)")
    else:
        status, msg_data = mail.fetch(identifier, "(UID X-GM-LABELS RFC822)")
    if status != "OK":
        return None
    part = msg_data[0]
    if not isinstance(part, tuple):
        return None
    raw = part[1]
    if not isinstance(raw, bytes):
        return None
    prefix = part[0].decode("utf-8", errors="replace") if isinstance(part[0], bytes) else ""

    uid_match = re.search(r"UID (\d+)", prefix)
    text, html, attachments = _parse_full_email(raw)
    msg = email.message_from_bytes(raw)
    return Email(
        uid=uid_match.group(1) if uid_match else "",
        message_id=msg["Message-ID"] or "",
        date=msg["Date"] or "",
        from_=decode_header_value(msg["From"]),
        subject=decode_header_value(msg["Subject"]),
        body=html or f"<pre>{escape(text)}</pre>",
        attachments=attachments,
        labels=_parse_labels(prefix),
        headers={
            key: decode_header_value(msg[header])
            for header, key in HEADER_FIELDS.items()
        },
        text=text,
    )


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
    parts = [f'SINCE {since.strftime("%-d-%b-%Y")}']
    if before_env:
        before = date.fromisoformat(before_env)
        parts.append(f'BEFORE {before.strftime("%-d-%b-%Y")}')
    imap_search = "(" + " ".join(parts) + ")"

    print(f"Connecting to Gmail as {user}...")
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    mail.select('"[Gmail]/All Mail"')

    status, data = mail.search(None, imap_search)
    if status != "OK":
        print(f"Search failed: {status}", file=sys.stderr)
        sys.exit(1)

    message_ids = (data[0] or b"").split()
    print(f"Found {len(message_ids)} emails since {since}\n")

    ollama_proc = subprocess.Popen(
        ["ollama", "serve"]
    )

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

    total = len(message_ids)
    for i, mid in enumerate(message_ids[skip:], skip + 1):
        try:
            t_fetch = time.time()
            mid_str = mid.decode()

            raw_mid = _fetch_raw(mail, mid_str, "BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)]")
            if raw_mid is None:
                continue
            message_id = email.message_from_bytes(raw_mid)["Message-ID"] or ""
            # HACK: invalidate ±20 windows around past crash indices; remove later
            # if any(c - 20 <= i <= c + 20 for c in (2992, 3510, 5530, 5615)):
            #     _get_seen_message_ids().discard(message_id)
            if message_id in _get_seen_message_ids():
                print(f"[{i}/{total}] skip {message_id} ({time.time() - t_fetch:.2f}s)")
                continue
            print(f"[{i}/{total}] processing {message_id}")

            em = fetch_email(mail, mid_str, by_uid=False)
            if em is None:
                continue
            print(f"fetch+parse: {time.time() - t_fetch:.2f}s")

            process_email(em, index=i, total=total)
        except imaplib.IMAP4.abort as e:
            print(f"IMAP aborted: {e}. Reconnecting in 10s...")
            time.sleep(10)
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(user, password)
            mail.select('"[Gmail]/All Mail"')

    mail.logout()
    ollama_proc.terminate()
    ollama_proc.wait()
    print(f"\nDone. {len(message_ids)} emails printed.")


if __name__ == "__main__":
    main()
