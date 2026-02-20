import argparse
import email
import email.message
import json
import re
from pathlib import Path

import requests
from tqdm import tqdm

from utils import setup_logging

logger = setup_logging("classify")

PROMPT_TEMPLATE = """You are classifying emails. Determine if this email is a receipt, invoice, payment confirmation, or expense-related document.

Hints from rule-based analysis:
{hints}

Email metadata:
From: {from_}
Subject: {subject}
Attachment names: {attachments}

Email body (first 200 words):
{body_preview}

Respond with ONLY a JSON object, no other text:
{{"is_receipt": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}}"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify emails as receipts or not")
    parser.add_argument("--input-dir", default="raw_emails/", help="Directory with .eml files")
    parser.add_argument("--results-file", default="classification_results.json", help="Output JSONL file")
    parser.add_argument("--model", default="phi3.5", help="Ollama model name")
    return parser.parse_args()


def get_body_preview(msg: email.message.Message, max_words: int = 200) -> str:
    for part in msg.walk():
        ct = part.get_content_type()
        if ct == "text/plain":
            try:
                payload = part.get_payload(decode=True)
                if not isinstance(payload, bytes):
                    continue
                words = payload.decode(errors="replace").split()[:max_words]
                return " ".join(words)
            except Exception:
                continue
    for part in msg.walk():
        ct = part.get_content_type()
        if ct == "text/html":
            try:
                payload = part.get_payload(decode=True)
                if not isinstance(payload, bytes):
                    continue
                html = payload.decode(errors="replace")
                text = re.sub(r"<[^>]+>", " ", html)
                words = text.split()[:max_words]
                return " ".join(words)
            except Exception:
                continue
    return ""


def get_hints(from_: str, subject: str, body: str, attachments: list[str]) -> str:
    hints = []
    money_re = r"[₪$€]\s*\d|(?:ILS|USD|EUR)\s*\d|\d\s*[₪$€]|\d\s*(?:ILS|USD|EUR)"
    if re.search(money_re, body + " " + subject):
        hints.append("has_money_amount: found currency/price pattern")

    sender_keywords = ["receipt", "invoice", "noreply", "billing", "order", "payment"]
    if any(kw in from_.lower() for kw in sender_keywords):
        hints.append(f"suspicious_sender: sender matches keywords")

    subject_keywords = ["קבלה", "חשבונית", "receipt", "invoice", "order", "confirmation", "payment"]
    if any(kw in subject.lower() for kw in subject_keywords):
        hints.append(f"suspicious_subject: subject matches keywords")

    return "\n".join(hints) if hints else "No hints triggered."


def classify_email(from_: str, subject: str, body_preview: str, attachments: list[str], model: str) -> dict:
    hints = get_hints(from_, subject, body_preview, attachments)
    prompt = PROMPT_TEMPLATE.format(
        hints=hints,
        from_=from_,
        subject=subject,
        attachments=", ".join(attachments) if attachments else "None",
        body_preview=body_preview,
    )

    resp = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=60,
    )
    resp.raise_for_status()
    text = resp.json()["response"].strip()

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {text}")
    return json.loads(match.group())


def get_attachment_names(msg: email.message.Message) -> list[str]:
    names = []
    for part in msg.walk():
        fn = part.get_filename()
        if fn:
            names.append(fn)
    return names


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    results_path = Path(args.results_file)

    already_done: set[str] = set()
    if results_path.exists():
        for line in results_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                already_done.add(json.loads(line)["filename"])

    eml_files = sorted(input_dir.glob("*.eml"))
    to_process = [f for f in eml_files if f.name not in already_done]
    logger.info("Total: %d, Already done: %d, To process: %d", len(eml_files), len(already_done), len(to_process))

    results_file = open(results_path, "a", encoding="utf-8")

    for eml_path in tqdm(to_process, desc="Classifying"):
        try:
            msg = email.message_from_bytes(eml_path.read_bytes())
            from_ = msg.get("From", "")
            subject = msg.get("Subject", "")
            body_preview = get_body_preview(msg)
            attachments = get_attachment_names(msg)

            result = classify_email(from_, subject, body_preview, attachments, args.model)

            record = {
                "filename": eml_path.name,
                "is_receipt": result.get("is_receipt", False),
                "confidence": result.get("confidence", 0.0),
                "reason": result.get("reason", ""),
            }
            results_file.write(json.dumps(record, ensure_ascii=False) + "\n")
            results_file.flush()
        except Exception:
            logger.exception("Error classifying %s", eml_path.name)

    results_file.close()
    logger.info("Done.")


if __name__ == "__main__":
    main()
