import json

import pytest

import import_labeled.import_labeled as il
from models import Email


def _email(uid, message_id, subject="Receipt", date_="Mon, 03 Mar 2025 10:00:00 +0000"):
    return Email(
        uid=uid, message_id=message_id, date=date_, from_="shop@x",
        subject=subject, body="<b>b</b>", attachments=[], labels=["Receipts"],
        headers={"to": "me@x"},
    )


class FakeMailbox:
    def __init__(self, by_label, by_uid):
        self._by_label = by_label   # label -> [uid, ...]
        self._by_uid = by_uid       # uid -> Email | None
        self.logged_out = False

    def search_label(self, label, since, before):
        return self._by_label.get(label, [])

    def get(self, uid):
        return self._by_uid[uid]

    def logout(self):
        self.logged_out = True


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setattr(il, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.setenv("GMAIL_USER", "u")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
    monkeypatch.setenv("RECEIPT_LABELS", "Receipts")
    monkeypatch.delenv("FETCH_SINCE", raising=False)
    monkeypatch.delenv("FETCH_BEFORE", raising=False)
    return tmp_path


def _install(monkeypatch, by_label, by_uid):
    mb = FakeMailbox(by_label, by_uid)
    monkeypatch.setattr(il, "Mailbox", lambda *a, **k: mb)
    return mb


def test_imports_new_receipt(env, monkeypatch):
    _install(monkeypatch, {"Receipts": ["10"]}, {"10": _email("10", "<m10>", "Order")})
    il.main()

    rec = env / "2025-03" / "2025-03-03T10-00-00_10.json"
    data = json.loads(rec.read_text())
    assert data["message_id"] == "<m10>"
    assert data["classification"] == {
        "is_receipt": True, "confidence": 1.0, "reason": "manual label", "source": "manual"}
    assert data["to"] == "me@x"

    ledger = json.loads((env / "2025-03" / "2025-03_processed.json").read_text())
    assert ledger == [{
        "uid": "10", "message_id": "<m10>",
        "timestamp": "2025-03-03T10-00-00", "is_receipt": True}]


def test_skips_already_saved(env, monkeypatch):
    # Pre-existing receipt file with the same message_id.
    month = env / "2025-03"
    month.mkdir()
    (month / "existing.json").write_text(json.dumps({"message_id": "<m10>"}))

    _install(monkeypatch, {"Receipts": ["10"]}, {"10": _email("10", "<m10>")})
    il.main()

    # No new receipt file written for uid 10, no ledger created.
    assert not (month / "2025-03-03T10-00-00_10.json").exists()
    assert not (month / "2025-03_processed.json").exists()


def test_flips_existing_ledger_entry(env, monkeypatch):
    month = env / "2025-03"
    month.mkdir()
    (month / "2025-03_processed.json").write_text(json.dumps([
        {"uid": "10", "message_id": "<m10>", "timestamp": "2025-03-03T10-00-00",
         "is_receipt": False}]))

    _install(monkeypatch, {"Receipts": ["10"]}, {"10": _email("10", "<m10>")})
    il.main()

    ledger = json.loads((month / "2025-03_processed.json").read_text())
    assert len(ledger) == 1               # flipped, not appended
    assert ledger[0]["is_receipt"] is True


def test_abort_on_fetch_fail(env, monkeypatch):
    _install(monkeypatch, {"Receipts": ["10"]}, {"10": None})
    with pytest.raises(SystemExit):
        il.main()


def test_unions_labels_and_dedups(env, monkeypatch):
    monkeypatch.setenv("RECEIPT_LABELS", "A, B")
    _install(
        monkeypatch,
        {"A": ["1", "2"], "B": ["2", "3"]},      # uid 2 in both
        {u: _email(u, f"<m{u}>") for u in ("1", "2", "3")},
    )
    il.main()

    saved = list((env / "2025-03").glob("*_*.json"))
    saved = [p for p in saved if not p.name.endswith("_processed.json")]
    assert len(saved) == 3                # 1, 2, 3 — each imported once
