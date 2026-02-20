# Gmail Receipt Extractor — Technical Spec

## מטרה

סקריפט Python שמזהה קבלות מתוך קבצי `.eml` באמצעות LLM מקומי, ומחלץ את הקבלה לקובץ.

## אבטחה

- **אין לך גישה לתיקייה מעל `src/`**
- **אל תנסה לקרוא `.env`, `.env.gpg`, או כל קובץ מחוץ ל-`src/`**
- הקוד מקבל נתיבים כפרמטרים, לא hardcode

## מבנה

```
gmail_receipts/              ← אין לך גישה
├── .env.gpg
├── run.sh
├── raw_emails/
├── output/
├── classification_results.json
│
└── src/                     ← אתה כאן
    ├── .venv/
    ├── CLAUDE.md
    ├── download.py
    ├── classify.py
    ├── extract.py
    ├── utils.py
    └── requirements.txt
```

## סביבה

- **Virtual environment** ב-`.venv/` (בתוך `src/`)
- הסקריפטים מורצים עם `.venv/bin/python` מתיקיית הפרויקט

## נתיבי ברירת מחדל

הסקריפטים מורצים מ-`gmail_receipts/` (לא מ-`src/`):

| פרמטר | ברירת מחדל |
|--------|-----------|
| `--input-dir` | `raw_emails/` |
| `--output-dir` | `output/` |
| `--results-file` | `classification_results.json` |

---

## download.py

הורדת מיילים מ-Gmail דרך IMAP.

```bash
python src/download.py --since 2025-01-01 --before 2026-01-01
```

- חיבור IMAP ל-`imap.gmail.com:993` (SSL)
- credentials מ-environment variables: `EMAIL_ADDRESS`, `APP_PASSWORD`
- סינון בצד השרת: `SINCE` + `BEFORE`
- שמירת כל מייל כ-`{YYYY-MM-DD}_{message_id_hash[:12]}.eml`
- שמירת `metadata.jsonl` — שורה per מייל: filename, subject, from, date, attachment_names
- Idempotent: דילוג לפי message ID hash

---

## classify.py

סיווג כל מייל כקבלה / לא קבלה.

```bash
python src/classify.py [--input-dir raw_emails/] [--results-file classification_results.json] [--model phi3.5]
```

### מה נשלח ל-LLM
- `from` (שם + כתובת)
- `subject`
- 200 מילים ראשונות מגוף המייל (plain text)
- שמות attachments

### Hints (מתווספים ל-prompt)
- `has_money_amount` — regex: ₪/$/€/ILS/USD + מספר
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
- מודל ברירת מחדל: `phi3.5`
- חומרה: RTX A1000, 4GB VRAM
- צפי: 0.5-1.5 שניות למייל

### פלט
- כתיבה incrementally ל-results file
- כל שורה: `{filename, is_receipt, confidence, reason}`
- Resume: דילוג על מיילים שכבר סווגו
- סף: `is_receipt == true` (בלי סינון confidence — העדפה ל-recall)

---

## extract.py

חילוץ קבלות מהמיילים שסווגו.

```bash
python src/extract.py [--input-dir raw_emails/] [--output-dir output/] [--results-file classification_results.json]
```

לכל מייל עם `is_receipt == true`:
1. יש attachment PDF? → שמירה ישירה
2. יש attachment תמונה (jpg/png)? → שמירה ישירה
3. אין attachment רלוונטי? → HTML → PDF עם `weasyprint`
4. כמה attachments רלוונטיים? → שמירת כולם

שם קובץ: `{YYYY-MM-DD}_{sanitized_subject}_{index}.{ext}`

---

## דרישות כלליות

- `tqdm` progress bar בכל סקריפט
- Logging לקובץ ול-stderr
- `argparse` לכל הפרמטרים
- Idempotent — הרצה חוזרת בטוחה
- מייל בעייתי לא עוצר את הריצה, רק מתועד ב-log
- Type hints
