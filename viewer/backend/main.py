import collections
import glob
import json
import os

from fastapi import FastAPI, HTTPException
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
# never touch the pipeline's output. Shape: month -> {base_name: true}, e.g.
# {"2025-01": {"2025-01-24T03-23-27_407402": true}}.
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
    Summary from the month's _processed.json ledger: how many emails were
    seen and how many were classified as receipts.
    """
    month_dir = _month_dir(month)
    path = os.path.join(month_dir, f"{month}_processed.json")
    if not os.path.isfile(path):
        return {"seen": 0, "receipts": 0}
    with open(path, "r", encoding="utf-8") as f:
        entries = json.load(f)
    return {
        "seen": len(entries),
        "receipts": sum(1 for e in entries if e.get("is_receipt")),
    }


@app.get("/api/months/{month}/attachments/{base_name}/{filename}")
def get_attachment(month: str, base_name: str, filename: str) -> FileResponse:
    """Serve a receipt's attachment from its <base_name>/ sibling folder."""
    month_dir = _month_dir(month)
    att_dir = os.path.abspath(os.path.join(month_dir, base_name))
    path = os.path.abspath(os.path.join(att_dir, filename))
    if os.path.dirname(path) != att_dir or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No such attachment")
    return FileResponse(path)


@app.get("/api/marks")
def get_marks() -> dict[str, dict[str, bool]]:
    """
    Every marked receipt, grouped by month, each month a {base_name: true} map:
    {"2025-01": {"2025-01-24T03-23-27_407402": true}}.
    """
    if not os.path.isfile(MARKS_PATH):
        return {}
    with open(MARKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.put("/api/marks/{month}/{base_name}")
def set_mark(month: str, base_name: str, marked: bool) -> dict[str, dict[str, bool]]:
    """
    Mark or unmark one receipt (?marked=true / ?marked=false) and return the
    full marks dict. Adds or removes the base_name under its month, then writes
    the file back, dropping any month whose map goes empty.
    """
    marks = get_marks()
    month_marks = marks.get(month, {})
    month_marks[base_name] = marked
    marks[month] = {b: mrk for b, mrk in month_marks.items() if mrk}
    marks = {m: items for m, items in marks.items() if items}

    with open(MARKS_PATH, "w", encoding="utf-8") as f:
        json.dump(marks, f, indent=2, ensure_ascii=False)
    return marks


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
