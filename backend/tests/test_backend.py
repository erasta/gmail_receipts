"""Tests for the backend API endpoints."""

import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

DATA_FILE = Path(__file__).parent.parent / "mock_gmail" / "emails.json"


def _load_json() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def _make_app(tmp_dir: str):
    """Create a fresh app with an isolated store so tests don't share state."""
    from app.classification_store import ClassificationStore
    from app.classification_worker import ClassificationWorker
    from mock_gmail.classifier import MockClassifier

    import app.main as main_module

    main_module.store = ClassificationStore(Path(tmp_dir) / "classifications.json")
    main_module.worker = ClassificationWorker(main_module._classifiers[main_module._active_classifier], main_module.store)
    return main_module.app


def _classify_and_wait(client: TestClient, email_ids: list[str], force: bool = False):
    """Submit classification and wait for it to finish."""
    client.post("/api/classify", json={"email_ids": email_ids, "force": force})
    for _ in range(50):
        res = client.get("/api/classifications")
        if not res.json():
            return
        time.sleep(0.05)
    raise TimeoutError("Classification did not finish in time")


# --- Health ---

def test_health():
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}


# --- Email endpoints ---

def test_list_emails_returns_paginated():
    entries = _load_json()
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get(f"/api/emails?limit={len(entries)}")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == len(entries)
        assert len(data["items"]) == len(entries)
        assert data["has_more"] is False


def test_list_emails_default_limit():
    entries = _load_json()
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get("/api/emails")
        data = res.json()
        assert len(data["items"]) == min(20, len(entries))
        assert data["total"] == len(entries)
        assert data["offset"] == 0
        assert data["limit"] == 20


def test_list_emails_pagination():
    entries = _load_json()
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get("/api/emails?offset=0&limit=5")
        data = res.json()
        assert len(data["items"]) == 5
        assert data["total"] == len(entries)
        assert data["has_more"] is True

        res2 = client.get(f"/api/emails?offset=5&limit={len(entries)}")
        data2 = res2.json()
        assert len(data2["items"]) == len(entries) - 5
        assert data2["has_more"] is False


def test_list_emails_content_matches_json():
    entries = _load_json()
    entries_by_id = {e["id"]: e for e in entries}
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        for email in client.get(f"/api/emails?limit={len(entries)}").json()["items"]:
            entry = entries_by_id[email["id"]]
            assert email["from_address"] == entry["from"]
            assert email["subject"] == entry["subject"]
            assert email["body_text"] == entry["body"]


def test_get_single_email():
    entries = _load_json()
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        for entry in entries:
            res = client.get(f"/api/emails/{entry['id']}")
            assert res.status_code == 200
            assert res.json()["id"] == entry["id"]


def test_get_nonexistent_email_returns_404():
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        assert client.get("/api/emails/does_not_exist").status_code == 404


# --- Classification endpoints ---

def test_classify_queues_emails():
    entries = _load_json()
    ids = [e["id"] for e in entries[:3]]
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.post("/api/classify", json={"email_ids": ids})
        assert res.status_code == 200
        report = res.json()
        for eid in ids:
            assert report[eid] == "queued"
        _classify_and_wait(client, [])  # wait for queue to drain


def test_classify_returns_cached_when_not_forced():
    entries = _load_json()
    eid = entries[0]["id"]
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, [eid])

        res = client.post("/api/classify", json={"email_ids": [eid]})
        assert res.json()[eid] == "cached"


def test_classify_force_reclassifies():
    entries = _load_json()
    eid = entries[0]["id"]
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, [eid])

        res = client.post("/api/classify", json={"email_ids": [eid], "force": True})
        assert res.json()[eid] == "queued"


def test_classify_not_found():
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.post("/api/classify", json={"email_ids": ["fake_id"]})
        assert res.json()["fake_id"] == "not_found"


def test_classifications_empty_when_idle():
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get("/api/classifications")
        assert res.json() == {}


def test_classifications_clears_after_done():
    entries = _load_json()
    eid = entries[0]["id"]
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, [eid])

        res = client.get("/api/classifications")
        assert eid not in res.json()


# --- Receipts endpoint ---

def test_receipts_empty_before_classification():
    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        res = client.get("/api/receipts")
        assert res.json() == []


def test_receipts_returns_only_receipts():
    entries = _load_json()
    all_ids = [e["id"] for e in entries]
    expected_ids = {e["id"] for e in entries if e["is_receipt"]}

    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, all_ids)

        res = client.get("/api/receipts")
        receipt_ids = {r["email_id"] for r in res.json()}
        assert receipt_ids == expected_ids


def test_receipts_have_classification():
    entries = _load_json()
    receipt_ids = [e["id"] for e in entries if e["is_receipt"]]

    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, receipt_ids)

        for receipt in client.get("/api/receipts").json():
            assert receipt["classification"]["is_receipt"] is True


def test_non_receipts_excluded():
    entries = _load_json()
    all_ids = [e["id"] for e in entries]
    non_receipt_ids = {e["id"] for e in entries if not e["is_receipt"]}

    with TemporaryDirectory() as tmp:
        app = _make_app(tmp)
        client = TestClient(app)
        _classify_and_wait(client, all_ids)

        receipt_ids = {r["email_id"] for r in client.get("/api/receipts").json()}
        assert receipt_ids.isdisjoint(non_receipt_ids)
