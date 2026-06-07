# Import manually-labeled receipts (work in progress)

A pass that finds emails **you** labeled as receipts in Gmail but the LLM
missed, and imports them into `output/` seamlessly alongside the rest.

## Goal

For every email in a date range that carries a manual receipt label:

- **already saved as a receipt** (its `message_id` matches an existing
  `<base_name>.json`) → leave it alone.
- **not saved yet** (LLM said not-a-receipt, or never processed) → import it:
  save the metadata JSON + attachments + labels, mark it as manual, and set its
  `_processed.json` ledger entry to `is_receipt: true`.

## Decisions (locked)

1. **Dedup basis:** skip only if `message_id` matches a saved **receipt file**
   (not the processed ledger). So LLM mistakes still get imported.
2. **Missed marker:** imported receipts get a synthetic `classification`:
   `{ "is_receipt": true, "confidence": 1.0, "reason": "manual label", "source": "manual" }`.
   Absence of `source` means it came from the LLM.
3. **Ledger:** add or flip the `_processed.json` entry to `is_receipt: true`
   (so a later fetch run won't re-evaluate it).
4. **Labels:** read from env var `RECEIPT_LABELS` (comma-separated), e.g.
   `RECEIPT_LABELS="Receipts,Tax"`. Date range reuses `FETCH_SINCE` / `FETCH_BEFORE`.

## Files

- `import_labeled.py` — the importer.
- `import.sh` — minimal Docker launcher (no Ollama/GPU), build context `fetch/`,
  mounts project-root `output/`, passes `RECEIPT_LABELS` + `FETCH_SINCE`/`FETCH_BEFORE`.

Run (when finished):

```bash
RECEIPT_LABELS="Receipts" FETCH_SINCE=2025-01-01 FETCH_BEFORE=2025-02-01 \
  ./fetch/import_labeled/import.sh <gmail> <app-password>
```

## ⚠️ Current status: NOT runnable yet

`import_labeled.py` was written against two helpers that have since been
**reverted**, so it currently references things that don't exist:

1. **`from process_email import save_receipt`** — `save_receipt` was extracted
   from `process_email.py` but that extraction was reverted; `process_email.py`
   is back to its original inline saving. **`save_receipt` does not exist.**
2. **`em.message_id`** — a `message_id` field was added to the `FetchedEmail`
   dataclass in `fetch_emails.py` but that was reverted too. **`FetchedEmail`
   has no `message_id`.**

(What is NOT reverted and still works: `fetch_email()` / `FetchedEmail`, label
capture, the `HEADER_FIELDS` headers, and `process_email`'s `body_html` /
`headers` / `labels` params.)

## To finish — pick one path

**Path A — shared (DRY, but edits a core file):**
- Re-extract `save_receipt(...)` from `process_email.py` (month/timestamp,
  ledger add-or-flip, metadata JSON, attachments) and have `process_email` call it.
- Re-add `message_id: str` to `FetchedEmail` (set from `msg["Message-ID"]`).
- `import_labeled.py` already matches this shape — it would just work.
- (User felt the `process_email` change was "too big" — that's why it's reverted.)

**Path B — self-contained (no `process_email` changes):**
- Inline the save logic directly in `import_labeled.py` (copy the ~20 lines:
  derive month/timestamp from the date, ledger **add-or-flip** by `message_id`,
  write metadata JSON, write attachment files). Note: the ledger here must
  *find-or-flip*, not just append (an LLM-missed email is already in the ledger
  as `is_receipt: false`).
- Still need `message_id`: simplest is to add the one-line `message_id` field to
  `FetchedEmail` (low-risk, separate from the save_receipt question). Alternative
  is a separate header fetch, but the field is cleaner.

## How `import_labeled.py` works (already written)

1. Read creds, `RECEIPT_LABELS`, `FETCH_SINCE`/`FETCH_BEFORE`.
2. `_saved_message_ids()` — scan `output/*/*.json` (skip `_processed.json`) for
   `message_id`s already saved as receipts.
3. Per label: `UID SEARCH X-GM-LABELS "<label>" SINCE … BEFORE …`, union the UIDs.
4. For each UID: `fetch_email(by_uid=True)`; skip if `message_id` already saved,
   else build the manual metadata and save it (`save_receipt` / inline) + flip ledger.
5. Print `N imported, M skipped`.

## Caveats / not yet verified

- **Never run against live Gmail** (no Docker/Gmail in dev sandbox). The
  `X-GM-LABELS` search + the `"<label>"` quoting is reasoned, not observed —
  do a single-label, narrow-range smoke test first.
- **UI doesn't special-case manual imports yet.** It will show the synthetic
  `confidence 100%` chip. A "manually labeled" badge keyed on
  `classification.source === "manual"` is a possible follow-up.
