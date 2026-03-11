"""Tests for the classification store."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from app.classification_store import ClassificationStore
from app.models import ClassificationResult


def _make_result(email_id: str, is_receipt: bool) -> ClassificationResult:
    return ClassificationResult(
        email_id=email_id,
        is_receipt=is_receipt,
        confidence=0.95,
        reason="test reason",
    )


def test_put_and_get():
    with TemporaryDirectory() as tmp:
        store = ClassificationStore(Path(tmp) / "test.json")
        result = _make_result("abc123", True)
        store.put(result)

        cached = store.get("abc123")
        assert cached is not None
        assert cached.email_id == "abc123"
        assert cached.is_receipt is True
        assert cached.confidence == 0.95
        assert cached.reason == "test reason"


def test_get_missing_returns_none():
    with TemporaryDirectory() as tmp:
        store = ClassificationStore(Path(tmp) / "test.json")
        assert store.get("nonexistent") is None


def test_persists_to_disk():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "test.json"

        store1 = ClassificationStore(path)
        store1.put(_make_result("email_1", True))
        store1.put(_make_result("email_2", False))

        # New store instance loads from the same file
        store2 = ClassificationStore(path)
        assert store2.get("email_1") is not None
        assert store2.get("email_1").is_receipt is True
        assert store2.get("email_2") is not None
        assert store2.get("email_2").is_receipt is False


def test_get_all():
    with TemporaryDirectory() as tmp:
        store = ClassificationStore(Path(tmp) / "test.json")
        store.put(_make_result("a", True))
        store.put(_make_result("b", False))
        store.put(_make_result("c", True))

        results = store.get_all()
        assert len(results) == 3
        ids = {r.email_id for r in results}
        assert ids == {"a", "b", "c"}


def test_put_overwrites():
    with TemporaryDirectory() as tmp:
        store = ClassificationStore(Path(tmp) / "test.json")
        store.put(_make_result("x", True))
        store.put(ClassificationResult(
            email_id="x",
            is_receipt=False,
            confidence=0.5,
            reason="changed my mind",
        ))

        cached = store.get("x")
        assert cached.is_receipt is False
        assert cached.confidence == 0.5


def test_file_is_valid_json():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "test.json"
        store = ClassificationStore(path)
        store.put(_make_result("email_1", True))

        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        assert "email_1" in data
        assert data["email_1"]["is_receipt"] is True
