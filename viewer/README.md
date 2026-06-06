# Receipts Viewer

A read-only viewer for the receipt data written by `fetch/process_email.py`. It
reads the month folders in `OUTPUT_DIR` directly — nothing in `fetch/` is touched
or imported.

- **backend/** — FastAPI app that lists months, receipts, and the per-month
  ledger summary, and serves attachment files.
- **frontend/** — React + TypeScript + Vite single-page viewer.

## Run it

Two terminals.

**Backend** (defaults to reading `../../fetch/output`):

```bash
cd viewer/backend
.venv/bin/python main.py
```

Point it at a different data folder with the same env var the pipeline uses:

```bash
OUTPUT_DIR=/path/to/output .venv/bin/python main.py
```

**Frontend** (proxies `/api` to the backend on port 8000):

```bash
cd viewer/frontend
npm install   # first time only
npm run dev
```

Open the URL Vite prints (http://localhost:5173).

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/months` | month folders, newest first |
| `GET /api/months/{month}/receipts` | receipt summaries (no body) |
| `GET /api/months/{month}/receipts/{base_name}` | full receipt metadata |
| `GET /api/months/{month}/ledger` | `{ seen, receipts }` counts |
| `GET /api/months/{month}/attachments/{base_name}/{filename}` | the attachment file |
