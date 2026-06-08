import json
import os
from dataclasses import dataclass


class Attachment:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


@dataclass
class FetchedEmail:
    text: str          # plain-text part, used by the classifier
    html: str          # html part, used for saving
    attachments: list[Attachment]
    labels: list[str]
    subject: str
    from_: str
    date: str
    headers: dict      # to, cc, reply_to, ...

    def write(self, path: str) -> None:
        """Write the email to <path> (JSON), with attachment files in a folder
        of the same name beside it."""
        data = {
            "text": self.text,
            "html": self.html,
            "labels": self.labels,
            "subject": self.subject,
            "from_": self.from_,
            "date": self.date,
            "headers": self.headers,
            "attachments": [a.filename for a in self.attachments],
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
    def read(cls, path: str) -> "FetchedEmail":
        """Read back an email written by write()."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        att_dir = os.path.splitext(path)[0]
        attachments = []
        for name in data["attachments"]:
            with open(os.path.join(att_dir, name), "rb") as f:
                attachments.append(Attachment(name, f.read()))
        return cls(
            text=data["text"],
            html=data["html"],
            attachments=attachments,
            labels=data["labels"],
            subject=data["subject"],
            from_=data["from_"],
            date=data["date"],
            headers=data["headers"],
        )
