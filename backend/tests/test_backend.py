"""Tests for the backend API endpoints."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

DATA_FILE = Path(__file__).parent.parent / "mock_gmail" / "emails.json"

client = TestClient(app)


def _load_json() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def test_list_emails_returns_all():
    entries = _load_json()
    res = client.get("/api/emails")
    assert res.status_code == 200
    emails = res.json()
    assert len(emails) == len(entries)


def test_list_emails_content_matches_json():
    entries = _load_json()
    entries_by_id = {e["id"]: e for e in entries}
    res = client.get("/api/emails")
    for email in res.json():
        entry = entries_by_id[email["id"]]
        assert email["from_address"] == entry["from"]
        assert email["subject"] == entry["subject"]
        assert email["body_text"] == entry["body"]


def test_get_single_email():
    entries = _load_json()
    for entry in entries:
        res = client.get(f"/api/emails/{entry['id']}")
        assert res.status_code == 200
        email = res.json()
        assert email["id"] == entry["id"]
        assert email["subject"] == entry["subject"]


def test_get_nonexistent_email_returns_404():
    res = client.get("/api/emails/does_not_exist")
    assert res.status_code == 404


def test_receipts_returns_only_receipts():
    entries = _load_json()
    expected_ids = {e["id"] for e in entries if e["is_receipt"]}

    res = client.get("/api/receipts")
    assert res.status_code == 200
    receipts = res.json()

    receipt_ids = {r["email_id"] for r in receipts}
    assert receipt_ids == expected_ids


def test_receipts_have_classification():
    res = client.get("/api/receipts")
    for receipt in res.json():
        assert "classification" in receipt
        assert receipt["classification"]["is_receipt"] is True
        assert receipt["classification"]["email_id"] == receipt["email_id"]


def test_non_receipts_excluded_from_receipts():
    entries = _load_json()
    non_receipt_ids = {e["id"] for e in entries if not e["is_receipt"]}

    res = client.get("/api/receipts")
    receipt_ids = {r["email_id"] for r in res.json()}

    assert receipt_ids.isdisjoint(non_receipt_ids)
