import imaplib
import email
import os
import subprocess
import sys
import time
from email.header import decode_header
from datetime import date
from dataclasses import dataclass
import re

import requests

from process_email import process_email, _get_seen_message_ids

# Email header -> receipt JSON key for the extra fields captured per email.
HEADER_FIELDS = {
    "To": "to",
    "Cc": "cc",
    "Reply-To": "reply_to",
    "Sender": "sender",
    "Bcc": "bcc",
    "Return-Path": "return_path",
    "Delivered-To": "delivered_to",
    "In-Reply-To": "in_reply_to",
    "References": "references",
    "List-Unsubscribe": "list_unsubscribe",
    "List-Id": "list_id",
}


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
            if charset == "unknown-8bit":
                charset = None
            if charset and charset.lower().endswith(("-i", "-e")):
                charset = charset[:-2]
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _parse_full_email(raw: bytes) -> tuple[str, str, list[Attachment]]:
    msg = email.message_from_bytes(raw)
    body_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[Attachment] = []

    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition") or "")
        content_type = part.get_content_type()

        if "attachment" in content_disposition:
            filename = decode_header_value(part.get_filename()) or "unnamed"
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                attachments.append(Attachment(filename, payload))
        elif content_type in ("text/plain", "text/html"):
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                charset = part.get_content_charset() or "utf-8"
                if charset.lower().endswith(("-i", "-e")):
                    charset = charset[:-2]
                if charset == "unknown-8bit":
                    charset = "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if content_type == "text/plain":
                    body_parts.append(decoded)
                else:
                    html_parts.append(decoded)

    return "\n".join(body_parts), "\n".join(html_parts), attachments


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


def _parse_labels(prefix: str) -> list[str]:
    """Pull the Gmail labels out of an X-GM-LABELS fetch response prefix."""
    m = re.search(r"X-GM-LABELS \((.*?)\)", prefix)
    if not m:
        return []
    return [
        quoted.replace('\\"', '"').replace("\\\\", "\\") or unquoted
        for quoted, unquoted in re.findall(r'"((?:[^"\\]|\\.)*)"|(\S+)', m.group(1))
    ]


@dataclass
class FetchedEmail:
    text: str          # plain-text part, used by the classifier
    html: str          # html part, used for saving
    attachments: list[Attachment]
    labels: list[str]
    subject: str
    from_: str
    date: str
    headers: dict      # to, cc, reply_to, ...


def fetch_email(
    mail: imaplib.IMAP4_SSL, identifier: str, *, by_uid: bool
) -> FetchedEmail | None:
    """Fetch and parse one email into a FetchedEmail.

    `by_uid` selects UID FETCH (located by UID) vs sequence FETCH. X-GM-LABELS
    comes before RFC822 so the labels land in the response prefix, not after
    the RFC822 literal (where _parse_labels wouldn't see them).
    """
    if by_uid:
        status, msg_data = mail.uid("FETCH", identifier, "(X-GM-LABELS RFC822)")
    else:
        status, msg_data = mail.fetch(identifier, "(X-GM-LABELS RFC822)")
    if status != "OK":
        return None
    part = msg_data[0]
    if not isinstance(part, tuple):
        return None
    raw = part[1]
    if not isinstance(raw, bytes):
        return None
    prefix = part[0].decode("utf-8", errors="replace") if isinstance(part[0], bytes) else ""

    text, html, attachments = _parse_full_email(raw)
    msg = email.message_from_bytes(raw)
    return FetchedEmail(
        text=text,
        html=html,
        attachments=attachments,
        labels=_parse_labels(prefix),
        subject=decode_header_value(msg["Subject"]),
        from_=decode_header_value(msg["From"]),
        date=msg["Date"] or "",
        headers={
            key: decode_header_value(msg[header])
            for header, key in HEADER_FIELDS.items()
        },
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

            status, uid_data = mail.fetch(mid_str, "(UID)")
            if status != "OK":
                continue
            uid_match = re.search(r"UID (\d+)", str(uid_data[0]))
            if not uid_match:
                continue
            uid = uid_match.group(1)

            em = fetch_email(mail, mid_str, by_uid=False)
            if em is None:
                continue
            print(f"fetch+parse: {time.time() - t_fetch:.2f}s")

            process_email(
                uid=uid,
                message_id=message_id,
                subject=em.subject,
                from_=em.from_,
                date_=em.date,
                body=em.text,
                download_attachments=lambda em=em: em.attachments,
                body_html=em.html,
                headers=em.headers,
                labels=em.labels,
                index=i,
                total=total,
            )
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
