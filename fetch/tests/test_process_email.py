import json

import pytest

import process_email as pe
from process_email import process_email, classify
from models import Attachment, Email


@pytest.fixture
def out(tmp_path, monkeypatch):
    """Point process_email at a temp output dir with an empty seen-cache."""
    monkeypatch.setattr(pe, "OUTPUT_DIR", str(tmp_path))
    monkeypatch.setattr(pe, "_seen_message_ids", set())
    return tmp_path


class _Resp:
    def __init__(self, verdict):
        self._verdict = verdict

    def raise_for_status(self):
        pass

    def json(self):
        return {"response": json.dumps(self._verdict)}


def _mock_llm(monkeypatch, verdict):
    monkeypatch.setattr(pe.requests, "post", lambda *a, **k: _Resp(verdict))


# Varied receipts: different months, RFC2822 + ISO dates, unicode subject,
# html vs plain body, none/one/two attachments, varying labels/headers/confidence.
RECEIPTS = [
    dict(
        id="mar2025-html-noatt",
        uid="42", message_id="<a@x>", subject="Your order #1",
        from_="shop@a.com", date_="Mon, 03 Mar 2025 10:00:00 +0000",
        body="plain1", body_html="<b>h1</b>",
        headers={"to": "me@x"}, labels=["Receipts"], atts=[],
        verdict={"is_receipt": True, "confidence": 0.9, "reason": "order"},
        month="2025-03", ts="2025-03-03T10-00-00",
    ),
    dict(
        id="dec2024-unicode-1att",
        uid="7", message_id="<b@x>", subject="חשבונית מס",
        from_="store@b.co", date_="Tue, 31 Dec 2024 23:59:59 +0000",
        body="טקסט", body_html="<p>סה\"כ 120</p>",
        headers={"to": "u@x", "cc": "c@x"}, labels=["Tax", "Receipts"],
        atts=[("a.pdf", b"A-bytes")],
        verdict={"is_receipt": True, "confidence": 1.0, "reason": "fattura"},
        month="2024-12", ts="2024-12-31T23-59-59",
    ),
    dict(
        id="jan2026-isodate-plainbody-2att",
        uid="100", message_id="<c@x>", subject="Bank alert",
        from_="bank@c.com", date_="2026-01-15T08:05:09",
        body="charge 50", body_html="",                 # no html -> body is the plain text
        headers={}, labels=[],
        atts=[("1.pdf", b"one"), ("2.png", b"two")],
        verdict={"is_receipt": True, "confidence": 0.55, "reason": "card charge"},
        month="2026-01", ts="2026-01-15T08-05-09",
    ),
    dict(
        id="jul2025-replyto",
        uid="9", message_id="<d@x>", subject="Receipt",
        from_="x@d.com", date_="Sun, 06 Jul 2025 00:00:00 +0000",
        body="r", body_html="<i>r</i>",
        headers={"reply_to": "rep@x"}, labels=["Receipts"], atts=[],
        verdict={"is_receipt": True, "confidence": 0.7, "reason": "subscription"},
        month="2025-07", ts="2025-07-06T00-00-00",
    ),
]


def _run(s):
    email = Email(
        uid=s["uid"],
        message_id=s["message_id"],
        date=s["date_"],
        from_=s["from_"],
        subject=s["subject"],
        body=s["body_html"] or s["body"],   # saved body (HTML, or plain when no HTML part)
        attachments=[Attachment(n, c) for n, c in s["atts"]],
        labels=s["labels"],
        headers=s["headers"],
        text=s["body"],                      # plain text used by the classifier
    )
    process_email(email)


@pytest.mark.parametrize("s", RECEIPTS, ids=[s["id"] for s in RECEIPTS])
def test_receipt_writes_json_and_ledger(out, monkeypatch, s):
    _mock_llm(monkeypatch, s["verdict"])
    _run(s)

    month = out / s["month"]
    rec = month / f'{s["ts"]}_{s["uid"]}.json'
    assert rec.is_file()
    data = json.loads(rec.read_text())

    assert data["uid"] == s["uid"]
    assert data["message_id"] == s["message_id"]
    assert data["from"] == s["from_"]
    assert data["subject"] == s["subject"]
    assert data["body"] == (s["body_html"] or s["body"])
    assert data["classification"] == s["verdict"]
    assert data["labels"] == s["labels"]
    for k, v in s["headers"].items():
        assert data[k] == v
    assert data["attachments"] == [n for n, _ in s["atts"]]
    for n, c in s["atts"]:
        assert (month / rec.stem / n).read_bytes() == c

    ledger = json.loads((month / f'{s["month"]}_processed.json').read_text())
    assert len(ledger) == 1
    assert ledger[0]["uid"] == s["uid"]
    assert ledger[0]["message_id"] == s["message_id"]
    assert ledger[0]["timestamp"] == s["ts"]
    assert ledger[0]["is_receipt"] is True


NON_RECEIPTS = [
    dict(
        id="mar2025-newsletter",
        uid="3", message_id="<n1@x>", subject="Sale!",
        from_="news@a.com", date_="Mon, 03 Mar 2025 10:00:00 +0000",
        body="b", body_html="<b>b</b>", headers={}, labels=[], atts=[],
        verdict={"is_receipt": False, "confidence": 0.8, "reason": "marketing"},
        month="2025-03",
    ),
    dict(
        id="feb2025-social",
        uid="5", message_id="<n2@x>", subject="New follower",
        from_="social@b.com", date_="Sat, 01 Feb 2025 12:00:00 +0000",
        body="b", body_html="", headers={"to": "u@x"}, labels=[], atts=[],
        verdict={"is_receipt": False, "confidence": 0.95, "reason": "notification"},
        month="2025-02",
    ),
]


@pytest.mark.parametrize("s", NON_RECEIPTS, ids=[s["id"] for s in NON_RECEIPTS])
def test_non_receipt_writes_ledger_only(out, monkeypatch, s):
    _mock_llm(monkeypatch, s["verdict"])
    _run(s)

    month = out / s["month"]
    ledger = json.loads((month / f'{s["month"]}_processed.json').read_text())
    assert ledger[0]["message_id"] == s["message_id"]
    assert ledger[0]["is_receipt"] is False
    assert list(month.glob(f'*_{s["uid"]}.json')) == []  # no metadata file


def test_already_seen_skips(out, monkeypatch):
    monkeypatch.setattr(pe, "_seen_message_ids", {"<a@x>"})

    def boom(*a, **k):
        raise AssertionError("LLM should not be called for a seen email")

    monkeypatch.setattr(pe.requests, "post", boom)
    _run(RECEIPTS[0])
    assert list(out.iterdir()) == []  # nothing written


@pytest.mark.parametrize(
    "bad_verdict",
    [
        {"confidence": 0.5},          # missing is_receipt -> KeyError
        {"is_receipt": "yes"},        # not a bool -> ValueError
        {"is_receipt": 1},            # int, not bool -> ValueError
    ],
)
def test_bad_llm_reply_aborts(out, monkeypatch, bad_verdict):
    _mock_llm(monkeypatch, bad_verdict)
    with pytest.raises((KeyError, ValueError)):
        _run(RECEIPTS[0])


# --- classify (the LLM call) ----------------------------------------------

class _RawResp:
    def __init__(self, raw):
        self._raw = raw

    def raise_for_status(self):
        pass

    def json(self):
        return {"response": self._raw}


def _mock_llm_raw(monkeypatch, *raws):
    """Mock the LLM to return the given raw response strings, in order."""
    seq = iter(raws)
    calls = {"n": 0}

    def post(*a, **k):
        calls["n"] += 1
        return _RawResp(next(seq))

    monkeypatch.setattr(pe.requests, "post", post)
    return calls


def _email(text="some body text"):
    return Email(
        uid="1", message_id="<m>", date="Mon, 03 Mar 2025 10:00:00 +0000",
        from_="a@b.com", subject="S", body="<b>x</b>",
        attachments=[], labels=[], headers={}, text=text,
    )


def test_classify_returns_verdict(monkeypatch):
    calls = _mock_llm_raw(monkeypatch, '{"is_receipt": true, "confidence": 0.9, "reason": "order"}')
    result = classify(_email(), [])
    assert result == {"is_receipt": True, "confidence": 0.9, "reason": "order"}
    assert calls["n"] == 1


def test_classify_retries_then_succeeds(monkeypatch):
    calls = _mock_llm_raw(
        monkeypatch,
        '{"confidence": 0.1}',                                  # bad: missing is_receipt
        '{"is_receipt": false, "confidence": 0.7, "reason": "news"}',
    )
    result = classify(_email(), [])
    assert result["is_receipt"] is False
    assert calls["n"] == 2


def test_classify_raises_after_max_attempts(monkeypatch):
    calls = _mock_llm_raw(monkeypatch, '{"x": 1}', '{"x": 1}', '{"x": 1}')
    with pytest.raises(KeyError):
        classify(_email(), [])
    assert calls["n"] == 3


def test_classify_non_bool_is_rejected(monkeypatch):
    _mock_llm_raw(monkeypatch, '{"is_receipt": "yes"}', '{"is_receipt": 1}', '{"is_receipt": "x"}')
    with pytest.raises(ValueError):
        classify(_email(), [])


def test_classify_invalid_json_not_retried(monkeypatch):
    import json as _json
    calls = _mock_llm_raw(monkeypatch, "not json at all")
    with pytest.raises(_json.JSONDecodeError):
        classify(_email(), [])
    assert calls["n"] == 1  # JSON errors propagate immediately, no retry
