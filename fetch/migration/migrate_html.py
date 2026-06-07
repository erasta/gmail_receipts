"""
One-off migration: re-fetch every already-identified receipt from Gmail and
replace its plain-text `body` with the email's HTML part (falling back to text
when there is no HTML part).

Locates each email by its stored Message-ID, then verifies the returned UID
matches the stored one. A mismatch means the mailbox's UIDs no longer line up
with what was saved (UIDVALIDITY changed), so re-fetching could overwrite the
wrong email's body — the migration aborts rather than risk that.

Re-runs reprocess every receipt; there is no skip marker.
"""
import email
import glob
import imaplib
import json
import os
import re
import sys
import time

from fetch_emails import _parse_full_email, decode_header_value

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/output")

# Email header -> receipt JSON key for the extra fields this migration captures.
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


def _connect(user: str, password: str) -> imaplib.IMAP4_SSL:
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    mail.select('"[Gmail]/All Mail"')
    return mail


def _parse_labels(prefix: str) -> list[str]:
    """Pull the Gmail labels out of an X-GM-LABELS fetch response prefix."""
    m = re.search(r"X-GM-LABELS \((.*?)\)", prefix)
    if not m:
        return []
    return [
        quoted.replace('\\"', '"').replace("\\\\", "\\") or unquoted
        for quoted, unquoted in re.findall(r'"((?:[^"\\]|\\.)*)"|(\S+)', m.group(1))
    ]


def _fetch_raw_by_uid(
    mail: imaplib.IMAP4_SSL, uid: str
) -> tuple[bytes, list[str]] | None:
    # X-GM-LABELS before RFC822 so the labels land in the response prefix,
    # not after the RFC822 literal (where _parse_labels wouldn't see them).
    status, msg_data = mail.uid("FETCH", uid, "(X-GM-LABELS RFC822)")
    if status != "OK":
        return None
    part = msg_data[0]
    if not isinstance(part, tuple):
        return None
    raw = part[1]
    if not isinstance(raw, bytes):
        return None
    prefix = part[0].decode("utf-8", errors="replace") if isinstance(part[0], bytes) else ""
    return raw, _parse_labels(prefix)


def main():
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not user or not password:
        print("Set GMAIL_USER and GMAIL_APP_PASSWORD", file=sys.stderr)
        sys.exit(1)

    files = sorted(
        p
        for p in glob.glob(os.path.join(OUTPUT_DIR, "*", "*.json"))
        if not p.endswith("_processed.json")
    )
    total = len(files)
    print(f"Migrating {total} receipts from {OUTPUT_DIR}...\n")

    mail = _connect(user, password)

    for i, path in enumerate(files, 1):
        rel = os.path.relpath(path, OUTPUT_DIR)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        message_id = data.get("message_id")
        stored_uid = str(data.get("uid"))

        if not message_id:
            sys.exit(f"ABORT: {rel} has no message_id")

        try:
            status, search_data = mail.uid(
                "SEARCH", None, "HEADER", "Message-ID", message_id  # type: ignore[arg-type]
            )
        except imaplib.IMAP4.abort as e:
            print(f"IMAP aborted: {e}. Reconnecting in 10s...")
            time.sleep(10)
            mail = _connect(user, password)
            status, search_data = mail.uid(
                "SEARCH", None, "HEADER", "Message-ID", message_id # type: ignore[arg-type]
            )

        if status != "OK":
            sys.exit(f"ABORT: search failed for {rel} ({status})")
        uids = (search_data[0] or b"").split()
        if not uids:
            sys.exit(f"ABORT: {rel} not in mailbox (message_id {message_id})")
        found_uid = uids[-1].decode()

        # Verify by UID — abort on mismatch (UIDs no longer line up with disk).
        if found_uid != stored_uid:
            sys.exit(
                f"ABORT: uid mismatch for {rel} "
                f"(stored {stored_uid}, found {found_uid})"
            )

        result = _fetch_raw_by_uid(mail, found_uid)
        if result is None:
            sys.exit(f"ABORT: fetch failed for {rel} (uid {found_uid})")
        raw, labels = result

        _text, html, _ = _parse_full_email(raw)
        data["body"] = html or _text
        data["labels"] = labels

        msg = email.message_from_bytes(raw)
        for header, key in HEADER_FIELDS.items():
            data[key] = decode_header_value(msg[header])

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[{i}/{total}] updated {rel} ({'html' if html else 'text'})")

    mail.logout()
    print("\nDone.")


if __name__ == "__main__":
    main()
