"""Mock emails in Gmail API message format.

Loads human-readable email definitions from emails.json and converts them
to the structure returned by the Gmail API:
    service.users().messages().get(userId="me", id=..., format="full")

See: https://developers.google.com/gmail/api/reference/rest/v1/users.messages#Message
"""

import base64
import json
from datetime import datetime, timezone
from pathlib import Path

_TO = "user@gmail.com"
_DATA_FILE = Path(__file__).parent / "emails.json"


def _b64(text: str) -> str:
    """URL-safe base64 without padding (Gmail convention)."""
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")


def _to_gmail_message(entry: dict) -> dict:
    """Convert a JSON email entry to a Gmail API message dict."""
    dt = datetime.fromisoformat(entry["date"]).replace(tzinfo=timezone.utc)
    body = entry["body"]
    body_bytes = body.encode("utf-8")
    msg_id = entry["id"]

    return {
        "id": msg_id,
        "threadId": msg_id,
        "labelIds": entry.get("labels", ["INBOX"]),
        "snippet": body.replace("\n", " ")[:100],
        "historyId": "100001",
        "internalDate": str(int(dt.timestamp() * 1000)),
        "sizeEstimate": len(body_bytes) + 256,
        "payload": {
            "partId": "",
            "mimeType": "text/plain",
            "filename": "",
            "headers": [
                {"name": "From", "value": entry["from"]},
                {"name": "To", "value": _TO},
                {"name": "Subject", "value": entry["subject"]},
                {"name": "Date", "value": dt.strftime("%a, %d %b %Y %H:%M:%S %z")},
                {"name": "Message-ID", "value": f"<{msg_id}@mail.gmail.com>"},
            ],
            "body": {
                "size": len(body_bytes),
                "data": _b64(body),
            },
        },
    }


def _load() -> tuple[list[dict], list[dict]]:
    with open(_DATA_FILE, encoding="utf-8") as f:
        entries = json.load(f)
    return entries, [_to_gmail_message(e) for e in entries]


_RAW_ENTRIES, MESSAGES = _load()
MESSAGES_BY_ID: dict[str, dict] = {m["id"]: m for m in MESSAGES}
RECEIPT_IDS: set[str] = {e["id"] for e in _RAW_ENTRIES if e.get("is_receipt")}
