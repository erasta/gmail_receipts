"""Back-fill message_id into every processed.json entry and per-receipt JSON file."""
import imaplib, email, json, getpass
from pathlib import Path

user = input("Gmail address: ")
password = getpass.getpass("App password: ")

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(user, password)
mail.select('"[Gmail]/All Mail"')


def get_message_id(uid):
    _, data = mail.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
    msg = email.message_from_bytes(data[0][1])
    return msg["Message-ID"].strip()


root = Path(__file__).parent / "output"

for path in sorted(root.glob("*/*.json")):
    raw = json.loads(path.read_text())
    if path.name.endswith("_processed.json"):
        changed = False
        for entry in raw:
            if "message_id" not in entry:
                entry["message_id"] = get_message_id(entry["uid"])
                print(f"  {path.parent.name}/{path.name}  uid={entry['uid']}")
                changed = True
        if changed:
            path.write_text(json.dumps(raw, indent=2, ensure_ascii=False))
    else:
        if "message_id" not in raw:
            raw["message_id"] = get_message_id(raw["uid"])
            path.write_text(json.dumps(raw, indent=2, ensure_ascii=False))
            print(f"  {path.parent.name}/{path.name}")

mail.logout()
