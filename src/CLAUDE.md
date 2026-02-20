# Gmail Receipt Extractor — Technical Spec

## Purpose

A Python script that identifies receipts from `.eml` files using a local LLM, and extracts the receipt to a file.

## Security

- **You have no access to the directory above `src/`**
- **Do not try to read `.env`, `.env.gpg`, or any file outside `src/`**
- Code receives paths as parameters, no hardcoding

## Structure

```
gmail_receipts/              ← no access
├── .env.gpg
├── run.sh
├── raw_emails/
├── output/
├── classification_results.json
│
└── src/                     ← you are here
    ├── .venv/
    ├── CLAUDE.md
    ├── download.py
    ├── classify.py
    ├── extract.py
    ├── utils.py
    └── requirements.txt
```

## Environment

- **Virtual environment** in `.venv/` (inside `src/`)
- Scripts are run with `.venv/bin/python` from the project directory

## Default Paths

Scripts are run from `gmail_receipts/` (not from `src/`):

| Parameter | Default |
|-----------|---------|
| `--input-dir` | `raw_emails/` |
| `--output-dir` | `output/` |
| `--results-file` | `classification_results.json` |

---

## download.py

Download emails from Gmail via IMAP.

```bash
python src/download.py --since 2025-01-01 --before 2026-01-01
```

- IMAP connection to `imap.gmail.com:993` (SSL)
- Credentials from environment variables: `EMAIL_ADDRESS`, `APP_PASSWORD`
- Server-side filtering: `SINCE` + `BEFORE`
- Save each email as `{YYYY-MM-DD}_{message_id_hash[:12]}.eml`
- Save `metadata.jsonl` — one line per email: filename, subject, from, date, attachment_names
- Idempotent: skip by message ID hash

---

## classify.py

Classify each email as receipt / not receipt.

```bash
python src/classify.py [--input-dir raw_emails/] [--results-file classification_results.json] [--model phi3.5]
```

### What is sent to the LLM
- `from` (name + address)
- `subject`
- First 200 words of the email body (plain text)
- Attachment names

### Hints (added to prompt)
- `has_money_amount` — regex: ₪/$/€/ILS/USD + number
- `suspicious_sender` — receipt, invoice, noreply, billing, order, payment
- `suspicious_subject` — קבלה, חשבונית, receipt, invoice, order, confirmation, payment

### Prompt
```
You are classifying emails. Determine if this email is a receipt, invoice,
payment confirmation, or expense-related document.

Hints from rule-based analysis:
{hints}

Email metadata:
From: {from}
Subject: {subject}
Attachment names: {attachments}

Email body (first 200 words):
{body_preview}

Respond with ONLY a JSON object, no other text:
{"is_receipt": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}
```

### LLM
- Ollama HTTP API: `http://localhost:11434/api/generate`
- Default model: `phi3.5`
- Hardware: RTX A1000, 4GB VRAM
- Expected: 0.5-1.5 seconds per email

### Output
- Writes incrementally to results file (JSON array)
- Each entry: `{filename, from, subject, body_preview, is_receipt, confidence, reason, classify_time_sec}`
- Resume: skips already-classified emails
- Threshold: `is_receipt == true` (no confidence filtering — preference for recall)
- `--reset` flag to clear previous results

---

## extract.py

Extract receipts from classified emails.

```bash
python src/extract.py [--input-dir raw_emails/] [--output-dir output/] [--results-file classification_results.json]
```

For each email with `is_receipt == true`:
1. Has PDF attachment? → save directly
2. Has image attachment (jpg/png)? → save directly
3. No relevant attachment? → HTML → PDF with `weasyprint`
4. Multiple relevant attachments? → save all

Filename: `{YYYY-MM-DD}_{sanitized_subject}_{index}.{ext}`

---

## General Requirements

- `tqdm` progress bar in every script
- Logging to file and stderr
- `argparse` for all parameters
- Idempotent — safe to re-run
- Problematic emails don't stop execution, only logged
- Type hints
