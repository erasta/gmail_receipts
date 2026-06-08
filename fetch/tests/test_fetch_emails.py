import fetch_emails as fe
from models import Email


class FakeProc:
    def terminate(self):
        pass

    def wait(self):
        pass


class FakeMailbox:
    """Two messages: uid 1 already seen, uid 2 new."""

    def __init__(self, *a, **k):
        self.logged_out = False

    def search_dates(self, since, before):
        return ["1", "2"]

    def message_id_of(self, uid):
        return {"1": "<seen>", "2": "<new>"}[uid]

    def get(self, uid):
        return Email(
            uid=uid, message_id=self.message_id_of(uid), date="d",
            from_="f", subject="s", body="b",
            attachments=[], labels=[], headers={}, text="t",
        )

    def logout(self):
        self.logged_out = True


def test_main_skips_seen_and_processes_new(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "u")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
    monkeypatch.delenv("FETCH_SINCE", raising=False)
    monkeypatch.delenv("FETCH_BEFORE", raising=False)
    monkeypatch.setattr("sys.argv", ["fetch_emails.py"])  # skip = 0

    fake_mb = FakeMailbox()
    monkeypatch.setattr(fe, "Mailbox", lambda *a, **k: fake_mb)
    monkeypatch.setattr(fe, "_get_seen_message_ids", lambda: {"<seen>"})
    monkeypatch.setattr(fe.subprocess, "Popen", lambda *a, **k: FakeProc())
    monkeypatch.setattr(fe.requests, "get", lambda *a, **k: None)
    monkeypatch.setattr(fe.requests, "post", lambda *a, **k: None)

    processed = []
    monkeypatch.setattr(
        fe, "process_email", lambda em, index, total: processed.append(em.uid)
    )

    fe.main()

    assert processed == ["2"]        # uid 1 was already seen and skipped
    assert fake_mb.logged_out
