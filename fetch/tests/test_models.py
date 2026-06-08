import json

from models import Attachment, Email


def _sample(**over):
    base = dict(
        uid="42",
        message_id="<m@x>",
        date="Mon, 03 Mar 2025 10:00:00 +0000",
        from_="shop@example.com",
        subject="Your order",
        body="<b>html body</b>",
        attachments=[Attachment("invoice.pdf", b"%PDF bytes")],
        labels=["Receipts", "\\Important"],
        headers={"to": "me@example.com", "cc": ""},
        classification={"is_receipt": True, "confidence": 0.9, "reason": "order"},
    )
    base.update(over)
    return Email(**base)


def test_write_produces_receipt_json(tmp_path):
    path = str(tmp_path / "receipt.json")
    _sample().write(path)

    data = json.loads((tmp_path / "receipt.json").read_text())
    # receipt-JSON shape: body single field, headers spread at top level
    assert data["uid"] == "42"
    assert data["message_id"] == "<m@x>"
    assert data["from"] == "shop@example.com"
    assert data["body"] == "<b>html body</b>"
    assert data["attachments"] == ["invoice.pdf"]
    assert data["to"] == "me@example.com"
    assert data["classification"]["is_receipt"] is True
    # attachment bytes written to the sibling folder
    assert (tmp_path / "receipt" / "invoice.pdf").read_bytes() == b"%PDF bytes"


def test_write_read_round_trip(tmp_path):
    em = _sample()
    path = str(tmp_path / "receipt.json")
    em.write(path)
    back = Email.read(path)

    assert (back.uid, back.message_id, back.date, back.from_, back.subject,
            back.body, back.labels, back.headers, back.classification) == (
        em.uid, em.message_id, em.date, em.from_, em.subject,
        em.body, em.labels, em.headers, em.classification)
    assert [(a.filename, a.content) for a in back.attachments] == [
        ("invoice.pdf", b"%PDF bytes")]


def test_write_null_classification_and_no_attachments(tmp_path):
    em = _sample(classification=None, attachments=[])
    path = str(tmp_path / "rec.json")
    em.write(path)

    data = json.loads((tmp_path / "rec.json").read_text())
    assert data["classification"] is None
    assert not (tmp_path / "rec").exists()
    assert Email.read(path).classification is None
