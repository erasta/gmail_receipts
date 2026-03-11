"""Tests that the mock Gmail client returns messages matching emails.json."""

import json
from pathlib import Path

from app.gmail_parser import decode_body, get_header
from mock_gmail.client import GmailApiError, MockGmailService
from mock_gmail.data import RECEIPT_IDS

DATA_FILE = Path(__file__).parent.parent / "mock_gmail" / "emails.json"


def _load_json() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def test_all_json_emails_are_served_by_client():
    """Every email in emails.json should be fetchable via the mock client."""
    entries = _load_json()
    service = MockGmailService()

    refs = service.users().messages().list(userId="me").execute()["messages"]
    served_ids = {r["id"] for r in refs}

    for entry in entries:
        assert entry["id"] in served_ids, f"Email {entry['id']} missing from list"


def test_message_content_matches_json():
    """Headers and body of each fetched message should match emails.json."""
    entries = _load_json()
    service = MockGmailService()

    for entry in entries:
        msg = service.users().messages().get(userId="me", id=entry["id"]).execute()

        assert get_header(msg, "From") == entry["from"]
        assert get_header(msg, "Subject") == entry["subject"]
        assert decode_body(msg) == entry["body"]


def test_receipt_ids_match_json():
    """RECEIPT_IDS should contain exactly the IDs marked is_receipt in JSON."""
    entries = _load_json()
    expected = {e["id"] for e in entries if e.get("is_receipt")}
    assert RECEIPT_IDS == expected


def test_no_extra_messages_beyond_json():
    """The client should not serve any messages not defined in emails.json."""
    entries = _load_json()
    json_ids = {e["id"] for e in entries}
    service = MockGmailService()

    refs = service.users().messages().list(userId="me").execute()["messages"]
    for ref in refs:
        assert ref["id"] in json_ids, f"Unexpected message {ref['id']} not in JSON"


def test_get_nonexistent_message_raises():
    """Fetching a non-existent ID should raise GmailApiError."""
    service = MockGmailService()
    try:
        service.users().messages().get(userId="me", id="does_not_exist").execute()
        assert False, "Expected GmailApiError"
    except GmailApiError:
        pass


def test_unicode_roundtrip():
    """Hebrew/Cyrillic characters should survive the base64 encode/decode."""
    entries = _load_json()
    service = MockGmailService()

    unicode_entries = [e for e in entries if any(ord(c) > 127 for c in e["body"])]
    assert len(unicode_entries) > 0, "No unicode entries found in test data"

    for entry in unicode_entries:
        msg = service.users().messages().get(userId="me", id=entry["id"]).execute()
        decoded = decode_body(msg)
        assert decoded == entry["body"], (
            f"Unicode mismatch for {entry['id']}: {decoded!r} != {entry['body']!r}"
        )
