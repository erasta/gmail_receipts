"""
Import manually-labeled receipts the LLM missed.

Finds emails carrying a receipt label (RECEIPT_LABELS, comma-separated) within
the date range (FETCH_SINCE / FETCH_BEFORE, YYYY-MM-DD) and imports any that
aren't already saved as receipts: written with a manual classification
(source: "manual") and their _processed.json ledger entry set to
is_receipt: true. Already-saved receipts are skipped.
"""
import glob
import json
import os
import sys
from datetime import date, datetime
from email.utils import parsedate_to_datetime

from mailbox_wrapper import Mailbox

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/output")

# Stamped onto imported receipts; "source": "manual" marks them as not from the
# LLM (absence of source means an LLM verdict).
MANUAL_CLASSIFICATION = {
    "is_receipt": True,
    "confidence": 1.0,
    "reason": "manual label",
    "source": "manual",
}


def _saved_message_ids() -> set[str]:
    """message_ids already saved as receipt JSON files (not the ledger)."""
    ids: set[str] = set()
    for p in glob.glob(os.path.join(OUTPUT_DIR, "*", "*.json")):
        if p.endswith("_processed.json"):
            continue
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        mid = data.get("message_id")
        if mid:
            ids.add(mid)
    return ids


def _save_imported(email) -> None:
    """Write the receipt JSON + attachments and add/flip its ledger entry."""
    try:
        dt = parsedate_to_datetime(email.date)
    except (ValueError, TypeError):
        dt = datetime.fromisoformat(email.date)
    month = dt.strftime("%Y-%m")
    timestamp = dt.strftime("%Y-%m-%dT%H-%M-%S")
    month_dir = os.path.join(OUTPUT_DIR, month)
    os.makedirs(month_dir, exist_ok=True)

    # Ledger: flip an existing entry to is_receipt: true, or add a new one.
    processed_path = os.path.join(month_dir, f"{month}_processed.json")
    processed = []
    if os.path.exists(processed_path):
        with open(processed_path, "r", encoding="utf-8") as f:
            processed = json.load(f)
    entry = next((e for e in processed if e.get("message_id") == email.message_id), None)
    if entry is None:
        processed.append({
            "uid": email.uid,
            "message_id": email.message_id,
            "timestamp": timestamp,
            "is_receipt": True,
        })
    else:
        entry.update({"uid": email.uid, "timestamp": timestamp, "is_receipt": True})
    with open(processed_path, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)

    email.write(os.path.join(month_dir, f"{timestamp}_{email.uid}.json"))


def main():
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not user or not password:
        sys.exit("Set GMAIL_USER and GMAIL_APP_PASSWORD")

    # Comma-separated Gmail labels; unset or empty defaults to "1_Receipts".
    labels_env = os.environ.get("RECEIPT_LABELS") or "1_Receipts"
    labels = [s.strip() for s in labels_env.split(",") if s.strip()]
    if not labels:
        sys.exit("RECEIPT_LABELS is empty")

    # Optional date range (YYYY-MM-DD). Defaults to the original start, no end.
    since_env = os.environ.get("FETCH_SINCE")
    before_env = os.environ.get("FETCH_BEFORE")
    since = date.fromisoformat(since_env) if since_env else date(2025, 1, 24)
    before = date.fromisoformat(before_env) if before_env else None

    mb = Mailbox(user, password)

    # Every message carrying one of the labels in the date range (UIDs, deduped).
    uids: set[str] = set()
    for label in labels:
        uids.update(mb.search_label(label, since, before))

    # message_ids we've already saved as receipts — those we skip.
    saved = _saved_message_ids()
    total = len(uids)
    print(f"{total} labeled emails in range, {len(saved)} receipts already saved.\n")

    imported = skipped = 0
    for i, uid in enumerate(sorted(uids, key=int), 1):
        email = mb.get(uid)
        if email is None:
            sys.exit(f"ABORT: fetch failed for uid {uid}")

        if email.message_id in saved:
            skipped += 1
            print(f"[{i}/{total}] skip (already saved) {email.message_id}")
            continue

        # New receipt the LLM missed: stamp it manual and save it.
        email.classification = dict(MANUAL_CLASSIFICATION)
        _save_imported(email)
        saved.add(email.message_id)
        imported += 1
        print(f"[{i}/{total}] imported {email.subject[:60]}")

    mb.logout()
    print(f"\nDone. {imported} imported, {skipped} skipped.")


if __name__ == "__main__":
    main()
