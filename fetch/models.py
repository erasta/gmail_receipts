import json
import os
from dataclasses import dataclass

# Email header -> receipt JSON key for the extra fields captured per email.
HEADER_FIELDS = {
    "To": "to",
    "Cc": "cc",
    "Reply-To": "reply_to",
    "Sender": "sender",
    "Bcc": "bcc",
    "Return-Path": "return_path",
    "Delivered-To": "delivered_to",
    "In-Reply-To": "in_reply_to",
    "References": "references",
    "List-Unsubscribe": "list_unsubscribe",
    "List-Id": "list_id",
}


class Attachment:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


@dataclass
class Email:
    uid: str
    message_id: str
    date: str
    from_: str
    subject: str
    body: str                       # always HTML (plain text wrapped if no HTML part)
    attachments: list[Attachment]
    labels: list[str]
    headers: dict                   # to, cc, reply_to, ...
    classification: dict | None = None
    text: str = ""                  # plain text for the classifier; not persisted

    def write(self, path: str) -> None:
        """Write the receipt JSON to <path>, with attachment files in a folder
        of the same name beside it."""
        data = {
            "uid": self.uid,
            "message_id": self.message_id,
            "date": self.date,
            "from": self.from_,
            "subject": self.subject,
            "body": self.body,
            "classification": self.classification,
            "attachments": [a.filename for a in self.attachments],
            "labels": self.labels,
            **self.headers,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        if self.attachments:
            att_dir = os.path.splitext(path)[0]
            os.makedirs(att_dir, exist_ok=True)
            for a in self.attachments:
                with open(os.path.join(att_dir, a.filename), "wb") as f:
                    f.write(a.content)

    @classmethod
    def read(cls, path: str) -> "Email":
        """Read back a receipt written by write()."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        att_dir = os.path.splitext(path)[0]
        attachments = []
        for name in data.get("attachments", []):
            with open(os.path.join(att_dir, name), "rb") as f:
                attachments.append(Attachment(name, f.read()))
        headers = {k: data[k] for k in HEADER_FIELDS.values() if k in data}
        return cls(
            uid=data["uid"],
            message_id=data["message_id"],
            date=data["date"],
            from_=data["from"],
            subject=data["subject"],
            body=data["body"],
            attachments=attachments,
            labels=data.get("labels", []),
            headers=headers,
            classification=data.get("classification"),
        )
