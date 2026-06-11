import collections
import glob
import json
import os

from fastapi import Body, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Where the fetch pipeline writes its month folders. Same env var the
# pipeline uses; defaults to the repo's output/ at the project root.
OUTPUT_DIR = os.environ.get(
    "OUTPUT_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "output"),
)
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)

# Hand-picked marks live in a single file at the output root, kept entirely
# separate from the per-month receipt folders so they survive re-fetches and
# never touch the pipeline's output. Each mark is a kind, "export" or "hide".
# Shape: month -> {base_name: kind}, e.g.
# {"2025-01": {"2025-01-24T03-23-27_407402": "export"}}.
MARKS_PATH = os.path.join(OUTPUT_DIR, "marks.json")

app = FastAPI(title="Gmail Receipts Viewer")

# The Vite dev server runs on a different port, so allow it to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _month_dir(month: str) -> str:
    """Resolve a month folder, refusing anything that escapes OUTPUT_DIR."""
    path = os.path.abspath(os.path.join(OUTPUT_DIR, month))
    if os.path.dirname(path) != OUTPUT_DIR or not os.path.isdir(path):
        raise HTTPException(status_code=404, detail=f"No such month: {month}")
    return path


@app.get("/api/months")
def list_months() -> list[str]:
    """Every month folder that has data, newest first."""
    months = [
        os.path.basename(p)
        for p in glob.glob(os.path.join(OUTPUT_DIR, "*"))
        if os.path.isdir(p)
    ]
    return sorted(months, reverse=True)


@app.get("/api/labels")
def list_labels() -> list[dict]:
    """
    Every label found across all months, with how many emails carry it.
    Walks every receipt file (skipping the _processed.json ledgers) and
    tallies the labels. Sorted by count, most common first.
    """
    counts: collections.Counter = collections.Counter()
    for path in glob.glob(os.path.join(OUTPUT_DIR, "*", "*.json")):
        if path.endswith("_processed.json"):
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for label in data.get("labels") or []:
            counts[label] += 1
    return [
        {"label": label, "count": count}
        for label, count in counts.most_common()
    ]


@app.get("/api/months/{month}/receipts")
def list_receipts(month: str) -> list[dict]:
    """
    The receipts saved for a month. Each receipt is a self-describing
    <base_name>.json file; we skip the _processed.json ledger and return a
    trimmed summary (no full body) for the list view.
    """
    month_dir = _month_dir(month)
    receipts = []
    for path in sorted(glob.glob(os.path.join(month_dir, "*.json"))):
        if path.endswith("_processed.json"):
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        receipts.append({
            "base_name": os.path.basename(path)[: -len(".json")],
            "uid": data.get("uid"),
            "date": data.get("date"),
            "from": data.get("from"),
            "subject": data.get("subject"),
            "attachments": data.get("attachments", []),
            "classification": data.get("classification"),
            "labels": data.get("labels", []),
            "to": data.get("to"),
            "cc": data.get("cc"),
            "body": data.get("body"),
        })
    return receipts


@app.get("/api/months/{month}/receipts/{base_name}")
def get_receipt(month: str, base_name: str) -> dict:
    """The full metadata file for one receipt, body included."""
    month_dir = _month_dir(month)
    path = os.path.abspath(os.path.join(month_dir, f"{base_name}.json"))
    if os.path.dirname(path) != month_dir or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No such receipt")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # base_name lives in the filename, not the file; add it for the client.
    data["base_name"] = base_name
    return data


@app.get("/api/months/{month}/ledger")
def get_ledger(month: str) -> dict:
    """
    How many emails were seen this month and how many are receipts. A receipt is
    counted by the presence of its per-receipt file, not the ledger's is_receipt
    flag, so deleting a file correctly drops it from the count.
    """
    month_dir = _month_dir(month)
    receipts = sum(
        1 for p in glob.glob(os.path.join(month_dir, "*.json"))
        if not p.endswith("_processed.json")
    )
    # "seen" (emails scanned) still comes from the processed ledger.
    path = os.path.join(month_dir, f"{month}_processed.json")
    seen = 0
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            seen = len(json.load(f))
    return {"seen": seen, "receipts": receipts}


@app.get("/api/months/{month}/attachments/{base_name}/{filename}")
def get_attachment(month: str, base_name: str, filename: str) -> FileResponse:
    """Serve a receipt's attachment from its <base_name>/ sibling folder."""
    month_dir = _month_dir(month)
    att_dir = os.path.abspath(os.path.join(month_dir, base_name))
    path = os.path.abspath(os.path.join(att_dir, filename))
    if os.path.dirname(path) != att_dir or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No such attachment")
    return FileResponse(path)


@app.get("/api/months/{month}/receipts/{base_name}/pdf")
def render_receipt_pdf(month: str, base_name: str) -> Response:
    """
    Render just this email's HTML to a vector PDF with headless Chromium, with
    no attachments -- the frontend merges those. Needs Playwright
    (`pip install playwright` + `playwright install chromium`).
    """
    from html import escape
    from playwright.sync_api import sync_playwright

    data = get_receipt(month, base_name)

    # A small header block (from / to / date / subject) above the email's saved
    # HTML body. dir="auto" lets each line pick its own direction, so
    # right-to-left Hebrew lays out correctly.
    rows = ""
    for label, value in (
        ("From", data.get("from")),
        ("To", data.get("to")),
        ("Date", data.get("date")),
        ("Subject", data.get("subject")),
    ):
        if value:
            rows += (
                f"<tr><td style='color:#666;padding:2px 8px'>{escape(label)}</td>"
                f"<td dir='auto' style='padding:2px 8px'>{escape(str(value))}</td></tr>"
            )
    document = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
  body {{ font-family: Arial, sans-serif; margin: 24px; color: #111; }}
  table.header {{ border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }}
  hr {{ border: none; border-top: 1px solid #ccc; margin: 16px 0; }}
</style></head>
<body dir="auto">
  <table class="header"><tbody>{rows}</tbody></table>
  <hr>
  {data.get("body", "")}
</body></html>"""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(document, wait_until="load")
        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "12mm", "bottom": "12mm",
                    "left": "10mm", "right": "10mm"},
        )
        browser.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{base_name}.pdf"'},
    )


@app.get("/api/marks")
def get_marks() -> dict[str, dict[str, str]]:
    """
    Every marked receipt, grouped by month, each month a {base_name: kind} map:
    {"2025-01": {"2025-01-24T03-23-27_407402": "export"}}.
    """
    if not os.path.isfile(MARKS_PATH):
        return {}
    with open(MARKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.put("/api/marks")
def set_marks(
    updates: dict[str, dict[str, str | None]] = Body(...),
) -> dict[str, dict[str, str]]:
    """
    Set a batch of marks in one write and return the full marks dict. The body
    is the same shape as the marks file -- month -> {base_name: kind} -- where
    kind is "export", "hide", or null to clear that receipt's mark. Applies
    every update, then drops any cleared mark or emptied month.
    """
    marks = get_marks()

    # Apply every update: a kind sets the mark, None clears it.
    for month, month_updates in updates.items():
        for base_name, kind in month_updates.items():
            if kind is None:
                marks.get(month, {}).pop(base_name, None)
            else:
                marks.setdefault(month, {})[base_name] = kind

    # Drop any month left with no marks.
    marks = {m: items for m, items in marks.items() if items}

    with open(MARKS_PATH, "w", encoding="utf-8") as f:
        json.dump(marks, f, indent=2, ensure_ascii=False)
    return marks


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
