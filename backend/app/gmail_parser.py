"""Parse Gmail API message dicts into app models.

Works identically with both the mock client and the real Google API client,
since both return the same message structure.
"""

import base64
from datetime import datetime, timezone

from app.models import Email


def get_header(message: dict, name: str) -> str:
    """Extract a header value from a Gmail API message."""
    for header in message.get("payload", {}).get("headers", []):
        if header["name"].lower() == name.lower():
            return header["value"]
    return ""


def decode_body(message: dict) -> str:
    """Decode the plain-text body from a Gmail API message."""
    payload = message.get("payload", {})

    # Simple (non-multipart) message
    body_data = payload.get("body", {}).get("data", "")
    if body_data:
        padded = body_data + "=" * (-len(body_data) % 4)
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")

    # Multipart — find text/plain part
    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                padded = data + "=" * (-len(data) % 4)
                return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")

    return ""


def parse_message(message: dict) -> Email:
    """Convert a Gmail API message dict to our app's Email model."""
    internal_date_ms = int(message.get("internalDate", "0"))
    date = datetime.fromtimestamp(internal_date_ms / 1000, tz=timezone.utc)

    return Email(
        id=message["id"],
        from_address=get_header(message, "From"),
        to_address=get_header(message, "To"),
        subject=get_header(message, "Subject"),
        date=date,
        body_text=decode_body(message),
    )
