# Import manually-labeled receipts

A pass that finds emails **you** labeled as receipts in Gmail but the LLM
missed, and imports them into `output/` seamlessly alongside the rest.

## Goal

For every email in a date range that carries a manual receipt label:

- **already saved as a receipt** (its `message_id` matches an existing
  `<base_name>.json`) → leave it alone.
- **not saved yet** (LLM said not-a-receipt, or never processed) → import it:
  save the metadata JSON + attachments + labels, mark it as manual, and set its
  `_processed.json` ledger entry to `is_receipt: true`.

## Decisions

1. **Dedup basis:** skip only if `message_id` matches a saved **receipt file**
   (not the processed ledger). So LLM mistakes still get imported.
2. **Missed marker:** imported receipts get a synthetic `classification`:
   `{ "is_receipt": true, "confidence": 1.0, "reason": "manual label", "source": "manual" }`.
   Absence of `source` means it came from the LLM.
3. **Ledger:** add or flip the `_processed.json` entry to `is_receipt: true`.
4. **Labels:** env var `RECEIPT_LABELS` (comma-separated). Date range reuses
   `FETCH_SINCE` / `FETCH_BEFORE`.
5. **Self-contained:** the save/ledger logic lives in `import_labeled.py` (it
   does not touch `process_email`). It reuses `Mailbox` and `Email.write`.
6. **Abort on fetch failure** (fail-loud, like the migration).

## Files

- `import_labeled.py` — the importer (uses `Mailbox` + `Email`).
- `import.sh` — minimal Docker launcher (no Ollama/GPU, no pip deps — the import
  path is pure stdlib + our modules), build context `fetch/`, mounts
  project-root `output/`.

Run:

```bash
RECEIPT_LABELS="Receipts" FETCH_SINCE=2025-01-01 FETCH_BEFORE=2025-02-01 \
  ./fetch/import_labeled/import.sh <gmail> <app-password>
```

## How it works

1. Read creds, `RECEIPT_LABELS`, `FETCH_SINCE`/`FETCH_BEFORE`.
2. Per label: `Mailbox.search_label(label, since, before)`, union the UIDs.
3. `_saved_message_ids()` — scan `output/*/*.json` (skip `_processed.json`).
4. For each UID: `Mailbox.get(uid)` (abort if it fails). Skip if `message_id`
   already saved, else set the manual `classification`, write the receipt JSON
   (`Email.write`) and add/flip the ledger entry.
5. Print `N imported, M skipped`.

Tested in `tests/test_import_labeled.py` (mocked `Mailbox`, temp `OUTPUT_DIR`).

## Caveats / not yet verified

- **Never run against live Gmail** (no Docker/Gmail in dev). The `X-GM-LABELS`
  search + `"<label>"` quoting is reasoned, not observed — do a single-label,
  narrow-range smoke test first.
- **UI doesn't special-case manual imports yet** — it shows the synthetic
  `confidence 100%` chip. A "manually labeled" badge keyed on
  `classification.source === "manual"` is a possible follow-up.
