from models import Attachment, FetchedEmail


def test_write_read_round_trip(tmp_path):
    em = FetchedEmail(
        text="plain",
        html="<b>html</b>",
        attachments=[Attachment("invoice.pdf", b"%PDF bytes")],
        labels=["Receipts", "\\Important"],
        subject="Your order",
        from_="shop@example.com",
        date="Mon, 03 Mar 2025 10:00:00 +0000",
        headers={"to": "me@example.com", "cc": ""},
    )

    path = str(tmp_path / "receipt.json")
    em.write(path)

    # JSON file plus an attachments folder beside it.
    assert (tmp_path / "receipt.json").is_file()
    assert (tmp_path / "receipt" / "invoice.pdf").read_bytes() == b"%PDF bytes"

    back = FetchedEmail.read(path)
    assert (back.text, back.html, back.labels, back.subject, back.from_,
            back.date, back.headers) == (
        em.text, em.html, em.labels, em.subject, em.from_, em.date, em.headers)
    assert [(a.filename, a.content) for a in back.attachments] == [
        ("invoice.pdf", b"%PDF bytes")]


def test_write_no_attachments_makes_no_folder(tmp_path):
    em = FetchedEmail(
        text="t", html="", attachments=[], labels=[],
        subject="S", from_="a@b.com", date="D", headers={},
    )
    path = str(tmp_path / "rec.json")
    em.write(path)

    assert (tmp_path / "rec.json").is_file()
    assert not (tmp_path / "rec").exists()
    assert FetchedEmail.read(path).attachments == []
