# Gmail Receipt Extractor

A script that downloads emails from Gmail, identifies receipts using a local LLM, and extracts them to a folder.

## Structure

```
gmail_receipts/
├── README.md
├── .env.gpg               ← encrypted credentials
├── run.sh                 ← decrypts credentials + runs download
├── encrypt.sh             ← encrypts .env and deletes it
├── raw_emails/            ← downloaded emails
├── output/                ← final receipts
├── classification_results.json
│
└── src/                   ← code (Claude Code works only here)
    ├── .venv/
    ├── CLAUDE.md
    ├── download.py
    ├── classify.py
    ├── extract.py
    ├── utils.py
    └── requirements.txt
```

## Security

Claude Code runs from `src/` only — it has no access to credentials or emails.

## Setup

```bash
sh setup.sh          # creates folders, venv, installs dependencies
nano .env            # edit with your email and App Password
sh encrypt.sh        # encrypts and deletes .env
```

### Prerequisites
- Python 3.10+
- Ollama + `ollama pull phi3.5`
- GPG
- Gmail App Password: https://myaccount.google.com/apppasswords

## Usage

```bash
sh run.sh --since 2025-01-01 --before 2026-01-01        # download
src/.venv/bin/python src/classify.py                      # classify
src/.venv/bin/python src/extract.py                       # extract
```

## Development

```bash
cd src && claude
```
