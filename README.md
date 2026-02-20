# Gmail Receipt Extractor

סקריפט שמוריד מיילים מ-Gmail, מזהה קבלות באמצעות LLM מקומי, ומחלץ אותן לתיקייה.

## מבנה

```
gmail_receipts/
├── README.md
├── .env.gpg               ← credentials מוצפנים
├── run.sh                 ← מפענח credentials + מריץ הורדה
├── encrypt.sh             ← מצפין .env ומוחק אותו
├── raw_emails/            ← מיילים שהורדו
├── output/                ← קבלות סופיות
├── classification_results.json
│
└── src/                   ← קוד (קלוד קוד עובד רק כאן)
    ├── .venv/
    ├── CLAUDE.md
    ├── download.py
    ├── classify.py
    ├── extract.py
    ├── utils.py
    └── requirements.txt
```

## אבטחה

קלוד קוד מורץ מתוך `src/` בלבד — אין לו גישה ל-credentials או למיילים.

## Setup

```bash
sh setup.sh          # יוצר תיקיות, venv, מתקין תלויות
nano .env            # ערוך עם המייל וה-App Password שלך
sh encrypt.sh        # מצפין ומוחק
```

### Prerequisites
- Python 3.10+
- Ollama + `ollama pull phi3.5`
- GPG
- Gmail App Password: https://myaccount.google.com/apppasswords

## הרצה

```bash
sh run.sh --since 2025-01-01 --before 2026-01-01        # הורדה
src/.venv/bin/python src/classify.py                      # סיווג
src/.venv/bin/python src/extract.py                       # חילוץ
```

## פיתוח

```bash
cd src && claude
```
