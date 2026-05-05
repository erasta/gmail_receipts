import imaplib
import email
import os
import sys
from email.header import decode_header
from datetime import date


def decode_header_value(value):
    if value is None:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def main():
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

    for mid in message_ids:
        status, msg_data = mail.fetch(mid.decode(), "(RFC822.HEADER)")
        if status != "OK":
            continue
        part = msg_data[0]
        if not isinstance(part, tuple):
            continue
        raw = part[1]
        if not isinstance(raw, bytes):
            continue
        msg = email.message_from_bytes(raw)

        subject = decode_header_value(msg["Subject"])
        from_ = decode_header_value(msg["From"])
        date_ = msg["Date"] or ""

        print(f"Date:    {date_}")
        print(f"From:    {from_}")
        print(f"Subject: {subject}")
        print("-" * 60)

    mail.logout()
    print(f"\nDone. {len(message_ids)} emails printed.")


if __name__ == "__main__":
    main()
