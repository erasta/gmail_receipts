import imaplib
import email
import os
import subprocess
import sys
import time
from email.header import decode_header
from datetime import date
import re

import requests

from process_email import process_email, _get_seen_message_ids


class Attachment:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content




def decode_header_value(value: str | None) -> str:
    if value is None:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            # try:
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
            # except LookupError:
            #     decoded.append(part.decode("utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _parse_full_email(raw: bytes) -> tuple[str, list[Attachment]]:
    msg = email.message_from_bytes(raw)
    body_parts: list[str] = []
    attachments: list[Attachment] = []

    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition") or "")
        content_type = part.get_content_type()

        if "attachment" in content_disposition:
            filename = part.get_filename() or "unnamed"
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                attachments.append(Attachment(filename, payload))
        elif content_type == "text/plain":
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                charset = part.get_content_charset() or "utf-8"
                body_parts.append(payload.decode(charset, errors="replace"))

    return "\n".join(body_parts), attachments


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


def main():
    skip = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables", file=sys.stderr)
        sys.exit(1)

    since = date(2025, 1, 24)
    imap_search = since.strftime("%-d-%b-%Y")

    print(f"Connecting to Gmail as {user}...")
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    mail.select('"[Gmail]/All Mail"')

    status, data = mail.search(None, f'(SINCE {imap_search})')
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
        t_fetch = time.time()
        mid_str = mid.decode()

        raw_mid = _fetch_raw(mail, mid_str, "BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)]")
        if raw_mid is None:
            continue
        message_id = email.message_from_bytes(raw_mid)["Message-ID"] or ""
        if message_id in _get_seen_message_ids():
            print(f"[{i}/{total}] skip {message_id} ({time.time() - t_fetch:.2f}s)")
            continue
        print(f"[{i}/{total}] processing {message_id}")

        status, uid_data = mail.fetch(mid_str, "(UID)")
        if status != "OK":
            continue
        uid_match = re.search(r"UID (\d+)", str(uid_data[0]))
        if not uid_match:
            continue
        uid = uid_match.group(1)

        raw = _fetch_raw(mail, mid_str, "RFC822")
        if raw is None:
            continue

        body, _ = _parse_full_email(raw)
        msg = email.message_from_bytes(raw)

        subject = decode_header_value(msg["Subject"])
        from_ = decode_header_value(msg["From"])
        date_ = msg["Date"] or ""
        print(f"fetch+parse: {time.time() - t_fetch:.2f}s")

        def download_attachments(r: bytes = raw) -> list[Attachment]:
            _, attachments = _parse_full_email(r)
            return attachments

        process_email(
            uid=uid,
            message_id=message_id,
            subject=subject,
            from_=from_,
            date_=date_,
            body=body,
            download_attachments=download_attachments,
            index=i,
            total=total,
        )

    mail.logout()
    ollama_proc.terminate()
    ollama_proc.wait()
    print(f"\nDone. {len(message_ids)} emails printed.")


if __name__ == "__main__":
    main()
