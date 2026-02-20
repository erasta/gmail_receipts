import argparse
import email
import email.header
import email.message
import json
import re
import time
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
    parser.add_argument("--body-preview-chars", type=int, default=500, help="Max chars of body preview to store")
    parser.add_argument("--reset", action="store_true", help="Reset results file before running")
    return parser.parse_args()


def wrap_text(text: str, width: int = 70) -> str:
    words = text.split()
    lines: list[str] = []
    current = ""
    for w in words:
        if current and len(current) + len(w) + 1 > width:
            lines.append(current)
            current = w
        else:
            current = (current + " " + w).strip()
    if current:
        lines.append(current)
    return "\n".join(lines)


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
    # Strip markdown code fences if present
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*$", "", text)

    match = re.search(r"\{.*?\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {text}")
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        pass
    # Fallback: try to extract fields manually
    is_receipt = bool(re.search(r'"is_receipt"\s*:\s*true', text, re.IGNORECASE))
    conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
    reason_match = re.search(r'"reason"\s*:\s*"([^"]*)"', text)
    return {
        "is_receipt": is_receipt,
        "confidence": float(conf_match.group(1)) if conf_match else 0.5,
        "reason": reason_match.group(1) if reason_match else "parsed from malformed response",
    }


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

    results: list[dict] = []
    if args.reset and results_path.exists():
        results_path.unlink()
    if results_path.exists():
        results = json.loads(results_path.read_text(encoding="utf-8"))
    already_done = {r["filename"] for r in results}

    eml_files = sorted(input_dir.glob("*.eml"))
    to_process = [f for f in eml_files if f.name not in already_done]
    logger.info("Total: %d, Already done: %d, To process: %d", len(eml_files), len(already_done), len(to_process))

    for eml_path in tqdm(to_process, desc="Classifying"):
        try:
            msg = email.message_from_bytes(eml_path.read_bytes())
            from_ = str(email.header.make_header(email.header.decode_header(msg.get("From", ""))))
            subject = str(email.header.make_header(email.header.decode_header(msg.get("Subject", ""))))
            body_preview = get_body_preview(msg)
            attachments = get_attachment_names(msg)

            t0 = time.monotonic()
            result = classify_email(from_, subject, body_preview, attachments, args.model)
            elapsed = round(time.monotonic() - t0, 2)

            record = {
                "filename": eml_path.name,
                "from": from_,
                "subject": subject,
                "body_preview": wrap_text(body_preview[:args.body_preview_chars]),
                "is_receipt": result.get("is_receipt", False),
                "confidence": result.get("confidence", 0.0),
                "reason": wrap_text(result.get("reason", "")),
                "classify_time_sec": elapsed,
            }
            results.append(record)
            results_path.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        except Exception:
            logger.exception("Error classifying %s", eml_path.name)
    logger.info("Done.")


if __name__ == "__main__":
    main()
