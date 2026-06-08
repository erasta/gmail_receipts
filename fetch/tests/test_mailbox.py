import imaplib
from datetime import date
from email.message import EmailMessage

import pytest

import mailbox


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
    monkeypatch.setattr(mailbox.imaplib, "IMAP4_SSL", lambda host: f)
    return f


def _box(fake):
    return mailbox.Mailbox("user@x", "pw")


# --- lifecycle -------------------------------------------------------------

def test_connect_logs_in_and_selects(fake):
    _box(fake)
    assert ("login", "user@x", "pw") in fake.calls
    assert ("select", '"[Gmail]/All Mail"') in fake.calls


def test_context_manager_logs_out(fake):
    with mailbox.Mailbox("user@x", "pw"):
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
    assert "<b>html</b>" in em.body
    assert em.labels == ["Receipts", "\\Important"]
    assert em.headers["to"] == "me@x"
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
