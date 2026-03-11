"""Email classifier using a local Ollama LLM.

Same interface as MockClassifier:
    classifier.classify(email) -> ClassificationResult
"""

import json
import logging
import os
import re

import requests

from app.models import ClassificationResult, Email

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """Classify this email: is it a financial transaction document?

Answer "true" for ANY of these:
- Receipt or proof of payment
- Invoice or bill
- Order confirmation with a price
- Subscription charge or renewal
- Bank/credit card transaction alert
- Taxi, ride, delivery, or travel booking confirmation with a charge
- Donation receipt
- Refund notification
- Utility bill (electricity, water, internet, phone)
- Government fee or tax payment

Answer "false" for:
- Newsletters, marketing, promotions
- Shipping/delivery status updates (no price)
- Account notifications (password reset, login alert)
- Personal or work conversations
- Social media notifications

The email may be in ANY language (English, Hebrew, German, Bulgarian, Norwegian, etc.).

Hints:
{hints}

From: {from_}
Subject: {subject}
Attachments: {attachments}
Body: {body_preview}

Reply with ONLY this JSON:
{{"is_receipt": true, "confidence": 0.9, "reason": "max 15 words"}}"""

MONEY_RE = re.compile(
    r"[₪$€]\s*\d|(?:ILS|USD|EUR)\s*\d|\d\s*[₪$€]|\d\s*(?:ILS|USD|EUR)"
)
SENDER_KEYWORDS = ["receipt", "invoice", "noreply", "billing", "order", "payment"]
SUBJECT_KEYWORDS = [
    "קבלה", "חשבונית", "receipt", "invoice", "order", "confirmation", "payment",
]


def _get_hints(from_: str, subject: str, body: str) -> str:
    hints: list[str] = []
    if MONEY_RE.search(body + " " + subject):
        hints.append("has_money_amount: found currency/price pattern")
    if any(kw in from_.lower() for kw in SENDER_KEYWORDS):
        hints.append("suspicious_sender: sender matches keywords")
    if any(kw in subject.lower() for kw in SUBJECT_KEYWORDS):
        hints.append("suspicious_subject: subject matches keywords")
    return "\n".join(hints) if hints else "No hints triggered."


def _parse_llm_response(text: str) -> dict:
    """Extract JSON from LLM response, with fallback parsing."""
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*$", "", text)

    match = re.search(r"\{.*?\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    is_receipt = bool(re.search(r'"is_receipt"\s*:\s*true', text, re.IGNORECASE))
    conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
    reason_match = re.search(r'"reason"\s*:\s*"([^"]*)"', text)
    return {
        "is_receipt": is_receipt,
        "confidence": float(conf_match.group(1)) if conf_match else 0.5,
        "reason": reason_match.group(1) if reason_match else "parsed from malformed response",
    }


class OllamaClassifier:
    def __init__(
        self,
        ollama_url: str | None = None,
        model: str | None = None,
        body_max_words: int = 200,
    ):
        self._ollama_url = ollama_url or os.environ.get(
            "OLLAMA_URL",
            f"http://{os.environ.get('OLLAMA_HOST', 'localhost:11434')}",
        )
        self._model = model or os.environ.get("OLLAMA_MODEL", "phi3.5")
        self._body_max_words = body_max_words

    def classify(self, email: Email) -> ClassificationResult:
        body_preview = " ".join(email.body_text.split()[: self._body_max_words])
        hints = _get_hints(email.from_address, email.subject, body_preview)

        prompt = PROMPT_TEMPLATE.format(
            hints=hints,
            from_=email.from_address,
            subject=email.subject,
            attachments=", ".join(email.attachments) if email.attachments else "None",
            body_preview=body_preview,
        )

        resp = requests.post(
            f"{self._ollama_url}/api/generate",
            json={"model": self._model, "prompt": prompt, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()

        raw = resp.json()["response"].strip()
        logger.debug("Ollama response for %s: %s", email.id, raw)
        parsed = _parse_llm_response(raw)

        return ClassificationResult(
            email_id=email.id,
            is_receipt=parsed.get("is_receipt", False),
            confidence=parsed.get("confidence", 0.0),
            reason=parsed.get("reason", ""),
        )
