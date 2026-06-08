"""
One-off migration: re-fetch every already-identified receipt from Gmail and
refresh its stored body (HTML), labels, and header fields.

Locates each email by its stored Message-ID, then verifies the returned UID
matches the stored one. A mismatch means the mailbox's UIDs no longer line up
with what was saved (UIDVALIDITY changed), so re-fetching could overwrite the
wrong email's body — the migration aborts rather than risk that.

Re-runs reprocess every receipt; there is no skip marker.
"""
import glob
import json
import os
import sys

from mailbox_wrapper import Mailbox

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/output")


def main():
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not user or not password:
        print("Set GMAIL_USER and GMAIL_APP_PASSWORD", file=sys.stderr)
        sys.exit(1)

    files = sorted(
        p
        for p in glob.glob(os.path.join(OUTPUT_DIR, "*", "*.json"))
        if not p.endswith("_processed.json")
    )
    total = len(files)
    print(f"Migrating {total} receipts from {OUTPUT_DIR}...\n")

    mb = Mailbox(user, password)

    for i, path in enumerate(files, 1):
        rel = os.path.relpath(path, OUTPUT_DIR)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        message_id = data.get("message_id")
        stored_uid = str(data.get("uid"))

        if not message_id:
            sys.exit(f"ABORT: {rel} has no message_id")

        found_uid = mb.search_message_id(message_id)
        if found_uid is None:
            sys.exit(f"ABORT: {rel} not in mailbox (message_id {message_id})")

        # Verify by UID — abort on mismatch (UIDs no longer line up with disk).
        if found_uid != stored_uid:
            sys.exit(
                f"ABORT: uid mismatch for {rel} "
                f"(stored {stored_uid}, found {found_uid})"
            )

        em = mb.get(found_uid)
        if em is None:
            sys.exit(f"ABORT: fetch failed for {rel} (uid {found_uid})")

        data["body"] = em.body
        data["labels"] = em.labels
        data.update(em.headers)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[{i}/{total}] updated {rel}")

    mb.logout()
    print("\nDone.")


if __name__ == "__main__":
    main()
