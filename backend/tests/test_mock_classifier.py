"""Tests for the mock classifier."""

import json
from pathlib import Path

from app.gmail_parser import parse_message
from mock_gmail.classifier import MockClassifier
from mock_gmail.client import MockGmailService

DATA_FILE = Path(__file__).parent.parent / "mock_gmail" / "emails.json"


def _load_json() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def _fetch_email(service: MockGmailService, email_id: str):
    msg = service.users().messages().get(userId="me", id=email_id).execute()
    return parse_message(msg)


def test_classifier_matches_json():
    """Classifier result for every email should match is_receipt in JSON."""
    entries = _load_json()
    service = MockGmailService()
    clf = MockClassifier()

    for entry in entries:
        email = _fetch_email(service, entry["id"])
        result = clf.classify(email)
        assert result.is_receipt == entry["is_receipt"], (
            f"{entry['id']}: expected is_receipt={entry['is_receipt']}, "
            f"got {result.is_receipt}"
        )
        assert result.email_id == entry["id"]


def test_classifier_counts():
    """Should classify 14 receipts and 8 non-receipts."""
    entries = _load_json()
    service = MockGmailService()
    clf = MockClassifier()

    results = [clf.classify(_fetch_email(service, e["id"])) for e in entries]
    receipt_count = sum(1 for r in results if r.is_receipt)
    non_receipt_count = sum(1 for r in results if not r.is_receipt)

    expected_receipts = sum(1 for e in entries if e["is_receipt"])
    expected_non = sum(1 for e in entries if not e["is_receipt"])

    assert receipt_count == expected_receipts
    assert non_receipt_count == expected_non
