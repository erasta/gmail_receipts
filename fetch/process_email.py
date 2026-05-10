import glob
import json
import os
import time
from email.utils import parsedate_to_datetime
import requests
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from fetch_emails import Attachment

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/output")

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


def process_email(
    uid: str,
    message_id: str,
    subject: str,
    from_: str,
    date_: str,
    body: str,
    download_attachments: Callable[[], list["Attachment"]],
    index: int = 0,
    total: int = 0,
):
    seen = set()
    for p in glob.glob(os.path.join(OUTPUT_DIR, "*", "*_processed.json")):
        with open(p, "r", encoding="utf-8") as f:
            for entry in json.load(f):
                if "message_id" in entry:
                    seen.add(entry["message_id"])
    if message_id in seen:
        print(f"[{index}/{total}] skip (already processed) {message_id}")
        return

    attachments = download_attachments()
    attachment_names = [a.filename for a in attachments]

    body_preview = " ".join(body.split()[:5000])
    prompt = PROMPT_TEMPLATE.format(
        from_=from_,
        subject=subject,
        attachments=", ".join(attachment_names) if attachment_names else "None",
        body_preview=body_preview,
    )

    t0 = time.time()
    resp = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": "llama3", "prompt": prompt, "stream": False, "format": "json"},
        timeout=200,
    )
    resp.raise_for_status()
    duration = time.time() - t0
    raw = resp.json()["response"].strip()

    result = json.loads(raw)
    is_receipt = result.get("is_receipt", False)

    dt = parsedate_to_datetime(date_)
    month = dt.strftime("%Y-%m")
    timestamp = dt.strftime("%Y-%m-%dT%H-%M-%S")

    print(f"[{index}/{total}] UID: {uid}")
    print(f"Date:    {date_}")
    print(f"From:    {from_}")
    print(f"Subject: {subject}")
    print(f"Body:    {body[:100]}")
    if attachment_names:
        print(f"Files:   {', '.join(attachment_names)}")
    print(f"LLM:     {raw}")
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
        "uid": uid,
        "message_id": message_id,
        "timestamp": timestamp,
        "is_receipt": is_receipt,
    })
    with open(processed_path, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)

    if not is_receipt:
        return
    base_name = f"{timestamp}_{uid}"

    metadata = {
        "uid": uid,
        "message_id": message_id,
        "date": date_,
        "from": from_,
        "subject": subject,
        "body": body,
        "classification": result,
        "attachments": attachment_names,
    }
    with open(os.path.join(month_dir, f"{base_name}.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    if attachments:
        att_dir = os.path.join(month_dir, base_name)
        os.makedirs(att_dir, exist_ok=True)
        for att in attachments:
            with open(os.path.join(att_dir, att.filename), "wb") as f:
                f.write(att.content)
