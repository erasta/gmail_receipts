import json
import requests
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from fetch_emails import Attachment

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
    subject: str,
    from_: str,
    date_: str,
    body: str,
    download_attachments: Callable[[], list["Attachment"]],
):
    attachments = download_attachments()
    attachment_names = [a.filename for a in attachments]

    body_preview = " ".join(body.split()[:5000])
    prompt = PROMPT_TEMPLATE.format(
        from_=from_,
        subject=subject,
        attachments=", ".join(attachment_names) if attachment_names else "None",
        body_preview=body_preview,
    )

    resp = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": "llama3", "prompt": prompt, "stream": False, "format": "json"},
        timeout=120,
    )
    resp.raise_for_status()
    raw = resp.json()["response"].strip()

    print(f"UID:     {uid}")
    print(f"Date:    {date_}")
    print(f"From:    {from_}")
    print(f"Subject: {subject}")
    print(f"Body:    {body[:100]}")
    if attachment_names:
        print(f"Files:   {', '.join(attachment_names)}")
    print(f"LLM:     {raw}")
    print("-" * 60)
