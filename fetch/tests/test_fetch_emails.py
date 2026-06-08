import imaplib
from email.message import EmailMessage
from typing import cast

import pytest

from fetch_emails import (
    decode_header_value,
    _parse_full_email,
    _parse_labels,
    fetch_email,
)


# --- _parse_labels ---------------------------------------------------------

@pytest.mark.parametrize(
    "prefix, expected",
    [
        # system label (kept with backslash) + plain user label
        (r'1 (X-GM-LABELS (\Important "Receipts") RFC822 {5}', ["\\Important", "Receipts"]),
        # quoted label with a space, plus a bare one
        (r'1 (X-GM-LABELS ("My Label" Work) RFC822 {5}', ["My Label", "Work"]),
        # escaped quote inside a quoted label
        (r'1 (X-GM-LABELS ("a\"b") RFC822 {5}', ['a"b']),
        # no labels
        (r'1 (X-GM-LABELS () RFC822 {5}', []),
        # X-GM-LABELS absent entirely (e.g. RFC822 came first)
        (r'1 (UID 9 RFC822 {5}', []),
    ],
)
def test_parse_labels(prefix, expected):
    assert _parse_labels(prefix) == expected


# --- decode_header_value ---------------------------------------------------

def test_decode_header_value_none():
    assert decode_header_value(None) == ""


def test_decode_header_value_plain():
    assert decode_header_value("Plain Subject") == "Plain Subject"


def test_decode_header_value_encoded_word():
    # RFC 2047 base64-encoded "Héllo"
    assert decode_header_value("=?utf-8?B?SMOpbGxv?=") == "Héllo"


# --- _parse_full_email -----------------------------------------------------

def _build_raw():
    msg = EmailMessage()
    msg["Subject"] = "Receipt"
    msg["From"] = "store@example.com"
    msg.set_content("plain body")
    msg.add_alternative("<p>html body</p>", subtype="html")
    msg.add_attachment(
        b"%PDF-1.4 fake",
        maintype="application",
        subtype="pdf",
        filename="invoice.pdf",
    )
    return msg.as_bytes()


def test_parse_full_email_splits_text_html_attachments():
    text, html, attachments = _parse_full_email(_build_raw())
    assert "plain body" in text
    assert "<p>html body</p>" in html
    assert [a.filename for a in attachments] == ["invoice.pdf"]
    assert attachments[0].content == b"%PDF-1.4 fake"


# --- fetch_email -----------------------------------------------------------

class FakeMail:
    """Minimal stand-in for imaplib.IMAP4_SSL returning a canned FETCH."""

    def __init__(self, prefix: str, raw: bytes):
        self._response = ("OK", [(prefix.encode(), raw), b")"])

    def uid(self, command, identifier, items):
        return self._response

    def fetch(self, identifier, items):
        return self._response


def test_fetch_email_parses_everything():
    msg = EmailMessage()
    msg["Subject"] = "Your order"
    msg["From"] = "shop@example.com"
    msg["To"] = "me@example.com"
    msg["Date"] = "Mon, 03 Mar 2025 10:00:00 +0000"
    msg["Message-ID"] = "<order-123@example.com>"
    msg.set_content("plain")
    msg.add_alternative("<b>html</b>", subtype="html")
    raw = msg.as_bytes()

    prefix = r'1 (UID 42 X-GM-LABELS ("Receipts" \Important) RFC822 {%d}' % len(raw)
    mail = FakeMail(prefix, raw)

    em = fetch_email(cast(imaplib.IMAP4_SSL, mail), "1", by_uid=True)
    assert em is not None
    assert em.uid == "42"
    assert em.message_id == "<order-123@example.com>"
    assert em.subject == "Your order"
    assert em.from_ == "shop@example.com"
    assert "plain" in em.text                 # plain text kept for the classifier
    assert "<b>html</b>" in em.body           # body is the HTML part
    assert em.labels == ["Receipts", "\\Important"]
    assert em.headers["to"] == "me@example.com"
    assert em.classification is None


def test_fetch_email_wraps_plain_text_as_html():
    msg = EmailMessage()
    msg["Subject"] = "Text only"
    msg["From"] = "a@b.com"
    msg["Date"] = "Mon, 03 Mar 2025 10:00:00 +0000"
    msg.set_content("just text & <stuff>")
    raw = msg.as_bytes()

    prefix = r'1 (UID 7 X-GM-LABELS () RFC822 {%d}' % len(raw)
    em = fetch_email(cast(imaplib.IMAP4_SSL, FakeMail(prefix, raw)), "1", by_uid=True)
    assert em is not None
    # no HTML part -> body is the escaped text wrapped in <pre>
    assert em.body.startswith("<pre>")
    assert "just text &amp; &lt;stuff&gt;" in em.body


def test_fetch_email_returns_none_on_bad_status():
    class NotOk:
        def uid(self, *a):
            return "NO", [None]

    assert fetch_email(cast(imaplib.IMAP4_SSL, NotOk()), "1", by_uid=True) is None
