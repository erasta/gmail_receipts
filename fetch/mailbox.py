"""
Gmail IMAP handling, wrapped in one class.

Message-ID stays the durable id we store/dedup on; UID is the transient handle
IMAP needs to actually fetch a message. Every method here addresses messages by
UID and reconnects automatically if the server drops the connection.
"""

import email
import imaplib
import re
from datetime import date
from email.header import decode_header
from html import escape

from models import Email, Attachment, HEADER_FIELDS


def _imap_date(d: date) -> str:
    return d.strftime("%-d-%b-%Y")


def decode_header_value(value: str | None) -> str:
    if value is None:
        return ""
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            if charset == "unknown-8bit":
                charset = None
            if charset and charset.lower().endswith(("-i", "-e")):
                charset = charset[:-2]
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _parse_full_email(raw: bytes) -> tuple[str, str, list[Attachment]]:
    msg = email.message_from_bytes(raw)
    body_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[Attachment] = []

    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition") or "")
        content_type = part.get_content_type()

        if "attachment" in content_disposition:
            filename = decode_header_value(part.get_filename()) or "unnamed"
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                attachments.append(Attachment(filename, payload))
        elif content_type in ("text/plain", "text/html"):
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                charset = part.get_content_charset() or "utf-8"
                if charset.lower().endswith(("-i", "-e")):
                    charset = charset[:-2]
                if charset == "unknown-8bit":
                    charset = "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if content_type == "text/plain":
                    body_parts.append(decoded)
                else:
                    html_parts.append(decoded)

    return "\n".join(body_parts), "\n".join(html_parts), attachments


def _parse_labels(prefix: str) -> list[str]:
    """Pull the Gmail labels out of an X-GM-LABELS fetch response prefix."""
    m = re.search(r"X-GM-LABELS \((.*?)\)", prefix)
    if not m:
        return []
    return [
        quoted.replace('\\"', '"').replace("\\\\", "\\") or unquoted
        for quoted, unquoted in re.findall(r'"((?:[^"\\]|\\.)*)"|(\S+)', m.group(1))
    ]


def _build_email(uid: str, raw: bytes, prefix: str) -> Email:
    """Parse fetched bytes (+ the X-GM-LABELS response prefix) into an Email."""
    text, html, attachments = _parse_full_email(raw)
    msg = email.message_from_bytes(raw)
    return Email(
        uid=uid,
        message_id=msg["Message-ID"] or "",
        date=msg["Date"] or "",
        from_=decode_header_value(msg["From"]),
        subject=decode_header_value(msg["Subject"]),
        body=html or f"<pre>{escape(text)}</pre>",
        attachments=attachments,
        labels=_parse_labels(prefix),
        headers={
            key: decode_header_value(msg[header])
            for header, key in HEADER_FIELDS.items()
        },
        text=text,
    )


class Mailbox:
    """A logged-in Gmail IMAP connection that yields Email objects."""

    def __init__(
        self, user: str, password: str, folder: str = '"[Gmail]/All Mail"'
    ):
        self._user = user
        self._password = password
        self._folder = folder
        self._mail: imaplib.IMAP4_SSL | None = None
        self.connect()

    # --- lifecycle ---------------------------------------------------------

    def connect(self) -> None:
        self._mail = imaplib.IMAP4_SSL("imap.gmail.com")
        self._mail.login(self._user, self._password)
        self._mail.select(self._folder)

    def logout(self) -> None:
        if self._mail is not None:
            self._mail.logout()

    def __enter__(self) -> "Mailbox":
        return self

    def __exit__(self, *exc) -> None:
        self.logout()

    def _uid(self, command: str, *args):
        """Run a UID command, reconnecting once if the connection was dropped."""
        assert self._mail is not None
        try:
            return self._mail.uid(command, *args)
        except imaplib.IMAP4.abort as e:
            print(f"IMAP aborted: {e}. Reconnecting...")
            self.connect()
            assert self._mail is not None
            return self._mail.uid(command, *args)

    # --- finding messages (all return UIDs) --------------------------------

    def _search(self, *criteria: str) -> list[str]:
        # None is the IMAP "no charset" slot; the imaplib stub mistypes it.
        status, data = self._uid("SEARCH", None, *criteria)  # type: ignore[arg-type]
        if status != "OK":
            raise RuntimeError(f"IMAP search failed: {status}")
        return [u.decode() for u in (data[0] or b"").split()]

    def search_dates(self, since: date, before: date | None = None) -> list[str]:
        criteria = ["SINCE", _imap_date(since)]
        if before:
            criteria += ["BEFORE", _imap_date(before)]
        return self._search(*criteria)

    def search_message_id(self, message_id: str) -> str | None:
        uids = self._search("HEADER", "Message-ID", message_id)
        return uids[-1] if uids else None

    def search_label(
        self, label: str, since: date | None = None, before: date | None = None
    ) -> list[str]:
        criteria = ["X-GM-LABELS", f'"{label}"']
        if since:
            criteria += ["SINCE", _imap_date(since)]
        if before:
            criteria += ["BEFORE", _imap_date(before)]
        return self._search(*criteria)

    # --- reading a message -------------------------------------------------

    def message_id_of(self, uid: str) -> str:
        """Cheap header-only fetch of the Message-ID (for dedup)."""
        status, data = self._uid(
            "FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])"
        )
        if status != "OK":
            return ""
        part = data[0]
        raw = part[1] if isinstance(part, tuple) else None
        if not isinstance(raw, bytes):
            return ""
        return email.message_from_bytes(raw)["Message-ID"] or ""

    def get(self, uid: str) -> Email | None:
        """Fetch and parse a full email into an Email."""
        status, msg_data = self._uid("FETCH", uid, "(X-GM-LABELS RFC822)")
        if status != "OK":
            return None
        part = msg_data[0]
        if not isinstance(part, tuple):
            return None
        raw = part[1]
        if not isinstance(raw, bytes):
            return None
        prefix = part[0].decode("utf-8", errors="replace") if isinstance(part[0], bytes) else ""
        return _build_email(uid, raw, prefix)
