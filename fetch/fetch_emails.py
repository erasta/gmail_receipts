import imaplib
import email
import os
import sys
from email.header import decode_header
from datetime import date

from process_email import process_email


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
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
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
        mid_str = mid.decode()
        raw = _fetch_raw(mail, mid_str, "RFC822")
        if raw is None:
            continue

        body, _ = _parse_full_email(raw)
        msg = email.message_from_bytes(raw)

        subject = decode_header_value(msg["Subject"])
        from_ = decode_header_value(msg["From"])
        date_ = msg["Date"] or ""

        def download_attachments(r: bytes = raw) -> list[Attachment]:
            _, attachments = _parse_full_email(r)
            return attachments

        process_email(
            subject=subject,
            from_=from_,
            date_=date_,
            body=body,
            download_attachments=download_attachments,
        )

    mail.logout()
    print(f"\nDone. {len(message_ids)} emails printed.")


if __name__ == "__main__":
    main()
