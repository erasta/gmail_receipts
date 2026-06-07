import glob
import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Where the fetch pipeline writes its month folders. Same env var the
# pipeline uses; defaults to the repo's fetch/output so this just works locally.
OUTPUT_DIR = os.environ.get(
    "OUTPUT_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "fetch", "output"),
)
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
