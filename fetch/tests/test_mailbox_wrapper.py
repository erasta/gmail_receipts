import imaplib
from datetime import date
from email.message import EmailMessage

import pytest

import mailbox_wrapper
from mailbox_wrapper import _parse_labels, _parse_full_email, decode_header_value


class FakeIMAP:
    """Stand-in for imaplib.IMAP4_SSL. `script` feeds uid() responses in order;
    a queued Exception is raised instead of returned."""

    def __init__(self):
        self.calls = []
        self.script = []

    def login(self, user, password):
        self.calls.append(("login", user, password))

    def select(self, folder):
        self.calls.append(("select", folder))

    def logout(self):
        self.calls.append(("logout",))

    def uid(self, command, *args):
        self.calls.append(("uid", command) + args)
        item = self.script.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item

    def uid_calls(self):
        return [c for c in self.calls if c[0] == "uid"]


@pytest.fixture
def fake(monkeypatch):
    f = FakeIMAP()
    # Same fake survives reconnects, so abort/retry tests see one object.
    monkeypatch.setattr(mailbox_wrapper.imaplib, "IMAP4_SSL", lambda host: f)
    return f


def _box(fake):
    return mailbox_wrapper.Mailbox("user@x", "pw")


# --- lifecycle -------------------------------------------------------------

def test_connect_logs_in_and_selects(fake):
    _box(fake)
    assert ("login", "user@x", "pw") in fake.calls
    assert ("select", '"[Gmail]/All Mail"') in fake.calls


def test_context_manager_logs_out(fake):
    with mailbox_wrapper.Mailbox("user@x", "pw"):
        pass
    assert ("logout",) in fake.calls


# --- searching -------------------------------------------------------------

def test_search_dates_returns_uids(fake):
    fake.script = [("OK", [b"1 2 3"])]
    assert _box(fake).search_dates(date(2025, 3, 1)) == ["1", "2", "3"]
    assert fake.uid_calls()[-1] == ("uid", "SEARCH", None, "SINCE", "1-Mar-2025")


def test_search_dates_with_before(fake):
    fake.script = [("OK", [b"9"])]
    _box(fake).search_dates(date(2025, 3, 1), date(2025, 4, 1))
    assert fake.uid_calls()[-1] == (
        "uid", "SEARCH", None, "SINCE", "1-Mar-2025", "BEFORE", "1-Apr-2025")


def test_search_message_id_returns_last(fake):
    fake.script = [("OK", [b"5 7"])]
    assert _box(fake).search_message_id("<m@x>") == "7"


def test_search_message_id_not_found(fake):
    fake.script = [("OK", [b""])]
    assert _box(fake).search_message_id("<m@x>") is None


def test_search_label_criteria(fake):
    fake.script = [("OK", [b"2"])]
    _box(fake).search_label("My Label", date(2025, 1, 1), date(2025, 2, 1))
    assert fake.uid_calls()[-1] == (
        "uid", "SEARCH", None, "X-GM-LABELS", '"My Label"',
        "SINCE", "1-Jan-2025", "BEFORE", "1-Feb-2025")


def test_search_failure_raises(fake):
    fake.script = [("NO", [None])]
    with pytest.raises(RuntimeError):
        _box(fake).search_dates(date(2025, 1, 1))


# --- reading ---------------------------------------------------------------

def _raw_email():
    msg = EmailMessage()
    msg["Subject"] = "Your order"
    msg["From"] = "shop@example.com"
    msg["To"] = "me@x"
    msg["Date"] = "Mon, 03 Mar 2025 10:00:00 +0000"
    msg["Message-ID"] = "<order@x>"
    msg.set_content("plain")
    msg.add_alternative("<b>html</b>", subtype="html")
    return msg.as_bytes()


def test_get_parses_email(fake):
    raw = _raw_email()
    prefix = r'1 (X-GM-LABELS ("Receipts" \Important) RFC822 {%d}' % len(raw)
    fake.script = [("OK", [(prefix.encode(), raw), b")"])]

    em = _box(fake).get("42")
    assert em is not None
    assert em.uid == "42"                       # comes from the requested uid
    assert em.message_id == "<order@x>"
    assert em.subject == "Your order"
    assert em.from_ == "shop@example.com"
    assert "plain" in em.text                   # plain text kept for the classifier
    assert "<b>html</b>" in em.body
    assert em.labels == ["Receipts", "\\Important"]
    assert em.headers["to"] == "me@x"
    assert em.classification is None
    assert fake.uid_calls()[-1] == ("uid", "FETCH", "42", "(X-GM-LABELS RFC822)")


def test_get_bad_status_returns_none(fake):
    fake.script = [("NO", [None])]
    assert _box(fake).get("1") is None


def test_message_id_of(fake):
    raw = b"Message-ID: <abc@x>\r\nSubject: hi\r\n\r\n"
    fake.script = [("OK", [(b"1 (...)", raw), b")"])]
    mb = _box(fake)
    assert mb.message_id_of("1") == "<abc@x>"
    assert fake.uid_calls()[-1] == (
        "uid", "FETCH", "1", "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")


# --- reconnect -------------------------------------------------------------

def test_reconnect_on_abort(fake):
    fake.script = [imaplib.IMAP4.abort("dropped"), ("OK", [b"3"])]
    mb = _box(fake)
    assert mb.search_dates(date(2025, 1, 1)) == ["3"]
    # connected twice: the initial login + one reconnect
    assert sum(1 for c in fake.calls if c[0] == "login") == 2


# --- parsing helpers -------------------------------------------------------

@pytest.mark.parametrize(
    "prefix, expected",
    [
        (r'1 (X-GM-LABELS (\Important "Receipts") RFC822 {5}', ["\\Important", "Receipts"]),
        (r'1 (X-GM-LABELS ("My Label" Work) RFC822 {5}', ["My Label", "Work"]),
        (r'1 (X-GM-LABELS ("a\"b") RFC822 {5}', ['a"b']),
        (r'1 (X-GM-LABELS () RFC822 {5}', []),
        (r'1 (UID 9 RFC822 {5}', []),
    ],
)
def test_parse_labels(prefix, expected):
    assert _parse_labels(prefix) == expected


def test_decode_header_value_none():
    assert decode_header_value(None) == ""


def test_decode_header_value_plain():
    assert decode_header_value("Plain Subject") == "Plain Subject"


def test_decode_header_value_encoded_word():
    # RFC 2047 base64-encoded "Héllo"
    assert decode_header_value("=?utf-8?B?SMOpbGxv?=") == "Héllo"


def test_parse_full_email_splits_text_html_attachments():
    msg = EmailMessage()
    msg["Subject"] = "Receipt"
    msg["From"] = "store@example.com"
    msg.set_content("plain body")
    msg.add_alternative("<p>html body</p>", subtype="html")
    msg.add_attachment(
        b"%PDF-1.4 fake", maintype="application", subtype="pdf", filename="invoice.pdf"
    )
    text, html, attachments = _parse_full_email(msg.as_bytes())
    assert "plain body" in text
    assert "<p>html body</p>" in html
    assert [a.filename for a in attachments] == ["invoice.pdf"]
    assert attachments[0].content == b"%PDF-1.4 fake"


def test_get_wraps_plain_text_as_html(fake):
    msg = EmailMessage()
    msg["Subject"] = "Text only"
    msg["From"] = "a@b.com"
    msg["Date"] = "Mon, 03 Mar 2025 10:00:00 +0000"
    msg["Message-ID"] = "<t@x>"
    msg.set_content("just text & <stuff>")
    raw = msg.as_bytes()

    prefix = r'1 (X-GM-LABELS () RFC822 {%d}' % len(raw)
    fake.script = [("OK", [(prefix.encode(), raw), b")"])]
    em = _box(fake).get("7")
    assert em is not None
    # no HTML part -> body is the escaped text wrapped in <pre>
    assert em.body.startswith("<pre>")
    assert "just text &amp; &lt;stuff&gt;" in em.body
