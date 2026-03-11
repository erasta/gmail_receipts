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

PROMPT_TEMPLATE = """You are a JSON-only classifier. You MUST reply with a single valid JSON object and nothing else. No text before or after the JSON.

Task: decide whether this email is a financial transaction document.

"is_receipt" must be true for: receipts, invoices, bills, order confirmations with a price, subscription charges, bank/credit card alerts, taxi/ride/delivery/travel confirmations with a charge, donation receipts, refund notifications, utility bills, government fees.

"is_receipt" must be false for: newsletters, marketing, promotions, shipping updates without price, account notifications, personal conversations, social media notifications.

"confidence" must be a decimal number between 0.0 and 1.0 (e.g. 0.85). 1.0 means absolutely certain, 0.5 means unsure.

"reason" must be a short string, max 15 words.

The email may be in ANY language.

Hints: {hints}

From: {from_}
Subject: {subject}
Attachments: {attachments}
Body: {body_preview}

Reply with ONLY valid JSON, exactly like this example:
{{"is_receipt": true, "confidence": 0.85, "reason": "order confirmation with total price"}}"""

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
    """Parse JSON from LLM response. Raises ValueError on failure."""
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*$", "", text)

    match = re.search(r"\{.*?\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM response: {text!r}")

    try:
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in LLM response: {text!r}") from e


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

        missing = [k for k in ("is_receipt", "confidence", "reason") if k not in parsed]
        if missing:
            raise ValueError(
                f"LLM response missing required fields {missing}: {raw!r}"
            )

        return ClassificationResult(
            email_id=email.id,
            is_receipt=parsed["is_receipt"],
            confidence=parsed["confidence"],
            reason=parsed["reason"],
            raw_response=raw,
        )
