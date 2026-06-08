import glob
import json
import os
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
import requests

from models import Email

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/output")

_seen_message_ids: set[str] | None = None


def _get_seen_message_ids() -> set[str]:
    global _seen_message_ids
    if _seen_message_ids is None:
        print(f"Building seen message IDs")
        _seen_message_ids = set()
        files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*", "*_processed.json")))
        print(f"Loading seen message IDs from {len(files)} processed files...")
        for p in files:
            before = len(_seen_message_ids)
            with open(p, "r", encoding="utf-8") as f:
                for entry in json.load(f):
                    if "message_id" in entry:
                        _seen_message_ids.add(entry["message_id"])
            print(f"  {os.path.relpath(p, OUTPUT_DIR)}: +{len(_seen_message_ids) - before}")
        print(f"Loaded {len(_seen_message_ids)} seen message IDs.")
    return _seen_message_ids

PROMPT_TEMPLATE = """You are a JSON-only classifier. Reply with a single valid JSON object and nothing else.

Task: decide whether this email is a financial transaction document.

"is_receipt" must be true for: receipts, invoices, bills, order confirmations with a price, subscription charges, bank/credit card alerts, taxi/ride/delivery/travel confirmations with a charge, donation receipts, refund notifications, utility bills, government fees.

"is_receipt" must be false for: newsletters, marketing, promotions, shipping updates without price, account notifications, personal conversations, social media notifications.

"confidence" must be a decimal number between 0.0 and 1.0.

"reason" must be a short string, max 15 words.

The email may be in ANY language (including Hebrew, Bulgarian, Norwegian).

From: {from_}
Subject: {subject}
Attachments: {attachments}
Body: {body_preview}

Reply with ONLY valid JSON like this:
{{"is_receipt": true, "confidence": 0.85, "reason": "order confirmation with total price"}}"""


def classify(email: Email, attachment_names: list[str]) -> dict:
    """Ask the local LLM whether the email is a financial document.

    Returns the classification dict ({is_receipt, confidence, reason}); raises
    if the model never returns a usable reply within max_attempts.
    """
    body_preview = " ".join(email.text.split()[:5000])
    prompt = PROMPT_TEMPLATE.format(
        from_=email.from_,
        subject=email.subject,
        attachments=", ".join(attachment_names) if attachment_names else "None",
        body_preview=body_preview,
    )

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "llama3", "prompt": prompt, "stream": False, "format": "json"},
            timeout=200,
        )
        resp.raise_for_status()
        raw = resp.json()["response"].strip()

        result = json.loads(raw)
        try:
            is_receipt = result["is_receipt"]
            if not isinstance(is_receipt, bool):
                raise ValueError(f"is_receipt must be bool, got {type(is_receipt).__name__}: {is_receipt!r}")
            return result
        except (KeyError, ValueError) as e:
            print(f"[attempt {attempt}/{max_attempts}] bad LLM response: {e} — raw: {raw[:200]}")
            if attempt == max_attempts:
                raise
    raise RuntimeError("classification loop ended without a result")


def process_email(email: Email, index: int = 0, total: int = 0):
    seen = _get_seen_message_ids()
    if email.message_id in seen:
        print(f"[{index}/{total}] skip (already processed) {email.message_id}")
        return
    seen.add(email.message_id)

    attachment_names = [a.filename for a in email.attachments]

    t0 = time.time()
    email.classification = classify(email, attachment_names)
    duration = time.time() - t0
    is_receipt = email.classification["is_receipt"]

    try:
        dt = parsedate_to_datetime(email.date)
    except (ValueError, TypeError):
        dt = datetime.fromisoformat(email.date)
    month = dt.strftime("%Y-%m")
    timestamp = dt.strftime("%Y-%m-%dT%H-%M-%S")

    print(f"[{index}/{total}] UID: {email.uid}")
    print(f"Date:    {email.date}")
    print(f"From:    {email.from_}")
    print(f"Subject: {email.subject}")
    print(f"Body:    {email.body[:100]}")
    if attachment_names:
        print(f"Files:   {', '.join(attachment_names)}")
    print(f"LLM:     {email.classification}")
    print(f"Time:    {duration:.1f}s")
    print()
    print("=" * 60)
    print()

    month_dir = os.path.join(OUTPUT_DIR, month)
    os.makedirs(month_dir, exist_ok=True)

    processed_path = os.path.join(month_dir, f"{month}_processed.json")
    processed = []
    if os.path.exists(processed_path):
        with open(processed_path, "r", encoding="utf-8") as f:
            processed = json.load(f)
    processed.append({
        "uid": email.uid,
        "message_id": email.message_id,
        "timestamp": timestamp,
        "is_receipt": is_receipt,
    })
    with open(processed_path, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)

    if not is_receipt:
        return
    base_name = f"{timestamp}_{email.uid}"
    email.write(os.path.join(month_dir, f"{base_name}.json"))
